var bound = ee.FeatureCollection("users/lihuan/LakeBalaton/officialBoundary"),
    L8_sr = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    L9_sr = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2");

/*
 * This script provides real-time chlorophyll-a monitoring for Lake Balaton using Landsat imagery
 * Author: Huan Li
 * Email: li.huan@blki.hu
 * Last modified: 2025-05-25
 * 
 * MIT License
 * 
 * Copyright (c) 2025 HUN-REN Balaton Limnological Research Institute
 * 
 * The app provides:
 * 1. Near real-time visualization of chlorophyll-a for the latest month
 * 2. Click-based concentration queries for any location
 * 3. Color-coded visualization with dynamic legend
 * 
 * Adaptation Guide for Other Lakes:
 * 1. Replace Asset References:
 *    - Update "bound" to your lake's boundary FeatureCollection
 *    - Modify Landsat collection filters as needed
 * 
 * 2. Model Integration:
 *    - Update "blob" path to your trained model
 *    - Adjust modelBandNames based on your model's requirements
 * 
 * 3. Visualization:
 *    - Modify "palette" colors for your lake's concentration range
 *    - Update vis_chla min/max values accordingly
 *    - Adjust waterMask parameters for your water body
 * 
 * 4. Configure Interface:
 *    - Update map.setCenter coordinates
 *    - Modify panel widths and layout as needed
 */
// load external resources
var ltgee = require('users/lihuan/Share_ChlaBalaton:getSR_allLandsat');   
var blob = ee.Blob('gs://li-model/RF.txt');
var blobList = ee.List(blob.string().decodeJSON()) 
// print("blobList",blobList)
var classif_rf = ee.Classifier.decisionTreeEnsemble(blobList);

var dateNow = ee.Date(Date.now()).format('YYYY-MM-dd');
var currentMonth = ee.Date(Date.now()).get('month').getInfo();
var currentYear = ee.Date(Date.now()).get('year').getInfo();
var legendMax = 30
if(currentMonth == '1' | currentMonth == '2' | currentMonth == '3' | currentMonth == '4'){
  legendMax = 15;
}


// load global variables
var palette=["2b83ba","abdda4","ffffbf","fdae61","d7191c"]
var vis_chla = {min: 0, max: legendMax, palette:palette};
var sa = bound.geometry();
var waterMask = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(sa)
                .filterDate('2020-09-02','2020-09-03')
                .mean()
                .normalizedDifference(['SR_B3','SR_B6'])
                .gt(0.02)
                // .clip(sa)
var selectedDate = '2024-08-04'
//////////////////////////////////////////////////////////////////
// predict with newest images  
var modelBandNames = ['B1','B2','B3','B4','B5','B7','month'];
var L89 = ltgee.getCombinedSRcollection(2024,currentYear, "01-01", "12-31", sa)//.aside(print,'L89 in 2024');
var L89_new = L89.map(function(img){
  var date = img.date();
  var mon = date.get('month')
  var dateStr = date.format('YYYY-MM-dd');
  return img
         .addBands(ee.Image(mon).select([0],['month']))
         .select(modelBandNames)
         .classify(classif_rf,'chla_pred').exp()
         .select([0],['chla'])
         .updateMask(waterMask)
         .set('system:time_start',date.millis(),'dateStr',dateStr);
})//.aside(print,'L89 prediction in 2024')
//////////////////////////////////////////////////////////////////////
// visualization
// Applies scaling factors.
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}
// Adds a layer Landsat_sr widget to the given map, to allow users to change
// which image is displayed in the associated map.
function addLayerSelector(mapToChange, images, position, index, showBackground,promptSelBox) {
  var label = ui.Label(promptSelBox);

  // This function changes the given map to show the selected image.
  function updateMap(selection) {
    var list = ee.List(images.get(selection));
    var date = ee.Date(selection);
    var imgCol_sr = L8_sr.merge(L9_sr)
                    .filterBounds(sa)
                    .filterDate(date, date.advance(1,'day'))
                    .mean()//ee.Image(list.get(2))
                    // .aside(print,'filtered L_sr');
    
    // background image
    var backImg = imgCol_sr;
      
    // update realtime date
    if(!showBackground){
      selectedDate = selection;
      vis_chla.max = legendMax;
      // print('change selectbox', selectedDate)
    }
    else {
      vis_chla.max = 60
      // background image
      backImg = imgCol_sr.multiply(0.0000275).add(-0.2);
    }        
    
    // var bacImgVis = ui.Map.Layer(backImg, {bands:list.get(3).getInfo(),min:0,max:0.3,gamma:1.2},"image for "+ selection, showBackground);
    var bacImgVis = ui.Map.Layer(applyScaleFactors(backImg), {bands:['SR_B4','SR_B3','SR_B2'],min:0,max:0.3},"image for "+ selection, showBackground);
    mapToChange.layers().set(0, bacImgVis);
    
    // chla
    var chlaImage = ee.Image(list.get(4));
    mapToChange.layers().set(1, ui.Map.Layer(chlaImage,vis_chla,'chla'));
    
    // update realtime date
    if(!showBackground){
      selectedDate = selection;
      // print('change selectbox', selectedDate)
    }
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
* Panel setup
*/

// Create a panel to hold title, intro text, chart and legend components.
var inspectorPanel = ui.Panel({style: {width: '20%'}});

// Create an intro panel with labels.
var intro = ui.Panel([
  ui.Label({
    value: 'Real-time Chl-a of Lake Balaton in Recent One Month',
    style: {fontSize: '23px', fontWeight: 'bold'}
  }),
  ui.Label('We have built a Random Forest model to retrieve water surface Chlorophyll-a (Chl-a) based on Landsat images since 1984. \
  Please choose a  date from the select box to inspect the water quality change in recent one month. \
  If no map shows, it may be caused by heavy cloud cover of the Landsat image, which can be checked from Layers widget.\
  What\'s more, the Chl-a value can be inspected by click a location on the map. \n'),
  ui.Label({
    value: 'Please click a location on the map to see Chl-a concentration (μg/L).',
    style: {fontSize: '14px', fontWeight: 'bold'}//
  })
]);
inspectorPanel.add(intro);

////////////////////////////////////////////////////////////////////////////
// add reatime map
var dateNow = ee.Date(Date.now()).format('YYYY-MM-dd')
var oneMonthBef = ee.Date(Date.now()).advance(-1,'month').format('YYYY-MM-dd')
var latest1mon = L89_new.filterDate(oneMonthBef,dateNow).sort('system:time_start',false)//.aside(print)
var datelist = latest1mon.aggregate_array('dateStr').distinct()
// print(datelist)
var latestInd = datelist.size().subtract(1).getInfo();
var latest1monChlaList =  datelist.map(function(date){
  var d = ee.Date(date);
  return [0,0,L89.filterDate(d, d.advance(1,'day')).mean().divide(10000),['B3','B2','B1'],latest1mon.filter(ee.Filter.eq('dateStr',date)).mean()];
})
var latest1monDict = ee.Dictionary.fromLists(datelist, latest1monChlaList);
// print('latest1monChlaList',latest1monChlaList,latest1monDict)L89.filter(ee.Filter.eq('dateStr',date)).mean()
// Create a panel to hold the map with specified dimensions
var mapPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '80%', height: '100%'} // Adjust the width and height as needed
});
// Create the nearest one month maps
var realtimeMap = ui.Map();
realtimeMap.setControlVisibility({
  all: false,
  layerList: true
});
// leftMap.setOptions('SATELLITE')
realtimeMap.style().set('cursor', 'crosshair');
realtimeMap.setCenter(17.75, 46.88, 11);
// Create an inspector panel with a horizontal layout.
var valueInspector = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal')
});
// Add a label to the panel.
valueInspector.add(ui.Label('Clicked Chla:'));
// Add the panel to the default map.
realtimeMap.add(valueInspector);
// Add the map to the mapPanel
mapPanel.add(realtimeMap);
// clicked value
realtimeMap.onClick(function(coords) {
  // Clear the panel and show a loading message.
  valueInspector.clear();
  var point = ee.Geometry.Point(coords.lon, coords.lat);
 
  var sampledPoint = latest1mon.filter(ee.Filter.eq('dateStr',selectedDate)).mean().reduceRegion(ee.Reducer.mean(), point, 100);
  // print('selectedDate',selectedDate,sampledPoint)
  valueInspector.add(ui.Label("Chl-a: "+sampledPoint.getNumber('chla').format('%.2f').getInfo()));
});
var realtimeSelector = addLayerSelector(realtimeMap, latest1monDict, 'bottom-right',latestInd,0,'Latest dates:');


////////////////////////////////////////////////////////////////////////////
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
inspectorPanel.widgets().set(5,leg)
var contact = ui.Label({
    value: 'If you have any queries, please contact:',
    style: {fontSize: '12px', margin: '8px 1px 8px 8px', fontWeight: 'bold'}
  });
var email = ui.Label({
  value: 'li.huan@blki.hu',
  style: {fontSize: '12px', margin: '8px 0px 8px 1px', textAlign: 'left', color: 'blue', textDecoration: 'underline' },
  targetUrl: 'mailto:li.huan@blki.hu'
  });
inspectorPanel.widgets().set(6,ui.Panel([contact,email],ui.Panel.Layout.flow('horizontal')));


/*
* Initialize the app
*/

// Replace the root with a SplitPanel that contains the inspector and map.
ui.root.clear();
ui.root.add(ui.SplitPanel(mapPanel, inspectorPanel));