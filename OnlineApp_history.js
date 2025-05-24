var chla = ee.Image("users/lihuan/LakeBalaton/Chla_Landsat_2025"),
    bound = ee.FeatureCollection("users/lihuan/LakeBalaton/officialBoundary"),
    stations = ee.FeatureCollection("users/lihuan/LakeBalaton/stations");

/*
 * This script visualizes historical chlorophyll-a concentration in Lake Balaton from Landsat imagery
 * Author: Huan Li
 * Email: li.huan@blki.hu
 * Last modified: 2025-01-25
 * 
* MIT License
 * 
 * Copyright (c) 2025 HUN-REN Balaton Limnological Research Institute
 *
 * The app provides:
 * 1. Split-panel visualization of chlorophyll-a concentrations for different time periods
 * 2. Interactive time series charts for clicked locations
 * 3. Color-coded visualization with legend
 * 
 * Adaptation Guide for Other Lakes:
 * 1. Replace Asset References:
 *    - Update "chla" with your lake's chlorophyll-a image collection
 *    - Change "bound" to your lake's boundary FeatureCollection
 *    - Update "stations" if you have monitoring stations, or remove if not needed
 * 
 * 2. Adjust Parameters:
 *    - Modify "palette" colors based on your lake's chlorophyll-a range
 *    - Update vis_chla min/max values to match your lake's concentration range
 *    - Adjust waterMask NDWI threshold (default 0.02) based on your lake's characteristics
 * 
 * 3. Update Time Periods:
 *    - Modify splitYear variable based on your study period
 *    - Adjust date filters in chlaColBefore/chlaColAfter
 * 
 * 4. Configure Map:
 *    - Update map.setCenter coordinates to your lake's location
 *    - Adjust zoom level as needed
 */
var ltgee = require('users/lihuan/Share_ChlaBalaton:getSR_allLandsat');  

var palette=["2b83ba","abdda4","ffffbf","fdae61","d7191c"]
var vis_chla = {min: 0, max: 60, palette:palette};
var sa = bound.geometry();
var waterMask = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(sa)
                .filterDate('2020-09-02','2020-09-03')
                .mean()
                .normalizedDifference(['SR_B3','SR_B6'])
                .gt(0.02)
                // .clip(sa)

// prepare preprocessed images
var bandNames = chla.bandNames()//.slice(0,3)
var chlaCol = bandNames.map(function(band){
  var img = chla.select([band],['chla']);
  var time = ee.Date.parse('yyyyMMdd',ee.String(band).slice(-13,-5));
  var date = time.format('yyyy-MM-dd')
  
  return img.updateMask(waterMask).set('system:time_start',time.millis(),'imageName',band,'date',date);
})
chlaCol = ee.ImageCollection(chlaCol)
          
///////////////////////////////////////////////
// Create the main map and set the chlaCol layer.
var getImgDict = function(imgCol){
  var datalist = imgCol.aggregate_array('date').distinct();
  var imgList = datalist.map(function(date){
    return chlaCol.filter(ee.Filter.eq('date',date)).mean();
  })
  return ee.Dictionary.fromLists(datalist,imgList);
}

var splitYear = 2005;
var chlaColBefore = chlaCol.filter(ee.Filter.calendarRange(1984,2004,'year'))
var imagesLeft = getImgDict(chlaColBefore)//.aside(print,'left list');
var chlaColAfter = chlaCol.filter(ee.Filter.calendarRange(2005,2025,'year'))
var imagesRight = getImgDict(chlaColAfter)//.aside(print,'right list');

// Create the left map, and have it display layer 0.10
var leftMap = ui.Map();
leftMap.setControlVisibility({
  all: false,
  layerList: true
});
// leftMap.setOptions('SATELLITE')
leftMap.style().set('cursor', 'crosshair');
var leftSelector = addLayerSelector(leftMap, imagesLeft, 'bottom-left',284);

// Create the right map, and have it display layer 1.17
var rightMap = ui.Map();
rightMap.setControlVisibility({
  all: true,
  mapTypeControl: false,
  zoomControl:false,
  fullscreenControl:false
});
// Configure the map.
// rightMap.setOptions('SATELLITE');
rightMap.style().set('cursor', 'crosshair');
var rightSelector = addLayerSelector(rightMap, imagesRight, 'bottom-right',34);

// Adds a layer Landsat_sr widget to the given map, to allow users to change
// which image is displayed in the associated map.
function addLayerSelector(mapToChange, images, position, index) {
  var label = ui.Label('Choose an image to visualize');

  // This function changes the given map to show the selected image.
  function updateMap(selection) {
    var selectDate = ee.Date.parse('yyyy-M-d',selection);
    var endDate = selectDate.advance(1,'day');
    var endStr = endDate.format('yyyy-MM-dd').getInfo();
    var imgCol_sr = ltgee.getCombinedSRcollection(
      selection.substring(0,4),
      endStr.substring(0,4), 
      selection.substring(5), 
      endStr.substring(5), sa);
    
    // background image
    var backImg = imgCol_sr.mosaic()//.multiply(0.0000275).add(-0.2);
    var bacImgVis = ui.Map.Layer(backImg, {bands:['B3','B2','B1'],min:200,max:3000,gamma:1.2},"image for "+ selection);
    mapToChange.layers().set(0, bacImgVis);
    
    // chla
    var chlaImage = ee.Image(images.get(selection));
    mapToChange.layers().set(1, ui.Map.Layer(chlaImage,vis_chla,'chla'));
  }

  // Configure a Landsat_sr dropdown to allow the user to choose between images,
  // and set the map to update when a user makes a Landsat_sr.
  var select = ui.Select({items: images.keys().getInfo(), onChange: updateMap});
  // print(images, images.keys(), images.get(images.keys().get(0)),'Object.keys(images)')
  select.setValue(images.keys().get(index).getInfo(), true);

  var controlPanel =
      ui.Panel({widgets: [label, select], style: {position: position}});
      
  mapToChange.add(controlPanel);
}


/*
 * Tie everything together
 */

// Create a SplitPanel to hold the adjacent, linked maps.
var splitPanel = ui.SplitPanel({
  firstPanel: leftMap,
  secondPanel: rightMap,
  wipe: true,
  style: {stretch: 'both'}
});

// Set the SplitPanel as the only thing in the UI root.
var linker = ui.Map.Linker([leftMap, rightMap]);
leftMap.setCenter(17.28, 46.73, 12);

/*
* Panel setup
*/

// Create a panel to hold title, intro text, chart and legend components.
var inspectorPanel = ui.Panel({style: {width: '20%'}});

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'Satellite-based Historical Chl-a of Lake Balaton on a Specific Date',
    style: {fontSize: '23px', fontWeight: 'bold'}
  }),
  ui.Label('This is a program to retrieve the water quality parameter chlorophyll a concentration based on Landsat images since 1984. \
  Choose a date from the split window to see corresponding images and Chla concentration or click a location to see its values.\n')
]);
inspectorPanel.add(intro);

// Create a panel to show Clicked position and corresponding water quality information
// Create panels to hold lon/lat values.
var lon = ui.Label();
var lat = ui.Label();
// Add clicked wq info
var leftInfo = ui.Label();
var rightInfo = ui.Label()
var clickInfo = ui.Panel([ui.Label('lon: '), lon, ui.Label('lat: '), lat], ui.Panel.Layout.flow('horizontal'))
inspectorPanel.add(clickInfo);

// Add placeholders for the chart and legend.
inspectorPanel.add(ui.Label('[Chart]'));
inspectorPanel.add(ui.Label('[Legend]'));


/*
* Chart setup
*/
var getMapValue = function(map, index, point){
  var leftChla = ee.Image(map.layers().get(index).getEeObject()).reduceRegion(ee.Reducer.mean(),point,100)
  return leftChla.values().getInfo();
}

// Generates a new time series chart of chlaCol for the given coordinates.
var generateChart = function (coords) {
  // Update the lon/lat panel with values from the click event.
  lon.setValue(coords.lon.toFixed(2));
  lat.setValue(coords.lat.toFixed(2));

  // Add a dot for the point clicked on.
  var point = ee.Geometry.Point(coords.lon, coords.lat).buffer(200);
  var dot = ui.Map.Layer(point, {color: '000000'}, 'clicked region');
  var dot1 = ui.Map.Layer(point, {color: '000000'}, 'clicked region');
  // Add the dot as the second layer, so it shows up on top of the composite.
  rightMap.layers().set(2, dot);
  leftMap.layers().set(2, dot1);

  // Make a chart from the time series.
  var chlaColChart = ui.Chart.image.series(chlaCol, point, ee.Reducer.mean(), 30);

  // Customize the chart.
  chlaColChart.setOptions({
    title: 'Chl-a concentration: time series',
    vAxis: {title: 'Chl-a (μg/L)'},
    hAxis: {title: 'Date', format: 'MM-yy', gridlines: {count: 7}},
    series: {
      0: {
        color: 'blue',
        lineWidth: 0,
        pointsVisible: true,
        pointSize: 2,
      },
    },
    legend: {position: 'right'},
  });
  // Add the chart at a fixed position, so that new charts overwrite older ones.
  inspectorPanel.widgets().set(2, chlaColChart);
};


/*
* Legend setup
*/
// Creates a color bar thumbnail image for use in legend from the given color
// palette.
function makeColorBarParams(palette) {
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min: 0,
    max: 1,
    palette: palette,
  };
}

var setLegend = function(title,index, palette, min, max){
  // Create the color bar for the legend.
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: makeColorBarParams(palette),
    style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
  });
  
  // Create a panel with three numbers for the legend.
  var legendLabels = ui.Panel({
    widgets: [
      ui.Label(min, {margin: '4px 8px'}),
      ui.Label(
          (max / 2),
          {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
      ui.Label(max, {margin: '4px 8px'})
    ],
    layout: ui.Panel.Layout.flow('horizontal')
  });
  
  var legendTitle = ui.Label({
    value: title,
    style: {fontWeight: 'bold'}
  });
  
  return ui.Panel([legendTitle, colorBar, legendLabels]);
}
var leg = setLegend('Chl-a concentration (μg/L)', 6, vis_chla.palette, vis_chla.min, vis_chla.max);
inspectorPanel.widgets().set(3,leg)
var contact = ui.Label({
    value: 'If you have any queries, please contact:',
    style: {fontSize: '12px', margin: '8px 1px 8px 8px', fontWeight: 'bold'}
  });
var email = ui.Label({
  value: 'li.huan@blki.hu',
  style: {fontSize: '12px', margin: '8px 0px 8px 1px', textAlign: 'left', color: 'blue', textDecoration: 'underline' },
  targetUrl: 'mailto:li.huan@blki.hu'
  });
inspectorPanel.widgets().set(4,ui.Panel([contact,email],ui.Panel.Layout.flow('horizontal')));


/*
* Map setup
*/

// Register a callback on the default map to be invoked when the map is clicked.
rightMap.onClick(generateChart);
leftMap.onClick(generateChart);
// Initialize with a test point.
var initialPoint = ee.Feature(stations.filter(ee.Filter.eq('name','Keszthely')).first()).geometry()//ee.Geometry.Point(18.0473, 46.9679);
rightMap.centerObject(initialPoint, 12);


/*
* Initialize the app
*/

// Replace the root with a SplitPanel that contains the inspector and map.
ui.root.clear();
ui.root.add(ui.SplitPanel(ui.Panel().add(splitPanel), inspectorPanel));

generateChart({
  lon: initialPoint.coordinates().get(0).getInfo(),
  lat: initialPoint.coordinates().get(1).getInfo()
});