var chla = ee.Image("users/lihuan/LakeBalaton/Chla_Landsat4_9"),
    bound = ee.FeatureCollection("users/lihuan/LakeBalaton/officialBoundary"),
    stations = ee.FeatureCollection("users/lihuan/LakeBalaton/stations");

/**
 * @license
 * Copyright (c) 2025 Balaton Limnological Research Institute
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 * @author Huan Li (Balaton Limnological Research Institute)
 * @date 11/01/2025
 * 
 * @description This file contains functions for working with Landsat-based 
 * chlorophyll-a monitoring in Lake Balaton using Google Earth Engine. 
 * The app provides both historical (since 1980s) and real-time monitoring capabilities
 * for water quality assessment in Lake Balaton.Parts of the code use the LandTrendr
 * implementation for surface reflectance data acquisition.
 */
 
//////////////////////////////////////////////////////////////////////
// load global variables
var ltgee = require('users/lihuan/Share_ChlaBalaton:getSR_allLandsat');  
var blob = ee.Blob('gs://li-model/RF.txt');
var blobList = ee.List(blob.string().decodeJSON()) 
// print("blobList",blobList)
var classif_rf = ee.Classifier.decisionTreeEnsemble(blobList);
var dateNow = ee.Date(Date.now()).format('YYYY-MM-dd');
var currentYear = ee.Date(Date.now()).get('year').getInfo();

// create a mask
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

var selectedDate = '2024-08-04'
/////////////////////////////////////////////////////////////////
// prepare preprocessed images
var bandNames = chla.bandNames()//.slice(0,3)
var chlaCol = bandNames.map(function(band){
  var img = chla.select([band],['chla']);
  var time = ee.Date.parse('yyyyMMdd',ee.String(band).slice(-13,-5));
  var date = time.format('yyyy-MM-dd')
  
  return img.updateMask(waterMask).set('system:time_start',time.millis(),'imageName',band,'date',date);
})
chlaCol = ee.ImageCollection(chlaCol);

/////////////////////////////////////////////////////////////////
// prepare selected decades' background images
var img1 = ee.ImageCollection([ee.Image('LANDSAT/LT05/C02/T1_L2/LT05_188028_19940803')]).mean();
var img2 = ee.ImageCollection([ee.Image('LANDSAT/LT05/C02/T1_L2/LT05_189027_19950813'),ee.Image('LANDSAT/LT05/C02/T1_L2/LT05_189028_19950813')]).mean();
var img3 = ee.ImageCollection([ee.Image('LANDSAT/LT05/C02/T1_L2/LT05_188027_20060905'),ee.Image('LANDSAT/LT05/C02/T1_L2/LT05_188028_20060905')]).mean();
var img4 = ee.ImageCollection([ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_189027_20190831'),ee.Image('LANDSAT/LC08/C02/T1_L2/LC08_189028_20190831')]).mean();
var decades = ee.Dictionary({
  '1984-1994':[1984,1994, img1,['SR_B3','SR_B2','SR_B1']],
  '1995-2004':[1995,2004, img2,['SR_B3','SR_B2','SR_B1']],
  '2005-2014':[2005,2014, img3,['SR_B3','SR_B2','SR_B1']],
  '2015-2023':[2015,2023, img4,['SR_B4','SR_B3','SR_B2']],
})
var decImgColDict = decades.map(function(key, value){
  value = ee.List(value);
  var startY = value.getNumber(0)
  var endY = value.getNumber(1)
  var decImg = chlaCol
              .filter(ee.Filter.calendarRange(startY,endY,'year'))
              .filter(ee.Filter.calendarRange(8,8,'month'))
              .mean();
  
  return value.add(decImg);
})
          
//////////////////////////////////////////////////////////////////////
// visualization
// Create the left map, and have it display layer 0.10
var leftMap = ui.Map();
leftMap.setControlVisibility({
  all: false,
  layerList: true
});
// leftMap.setOptions('SATELLITE')
leftMap.style().set('cursor', 'crosshair');
var leftSelector = addLayerSelector(leftMap, decImgColDict, 'bottom-left',0,1,'Choose a decade to visualize');

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
var rightSelector = addLayerSelector(rightMap, decImgColDict, 'bottom-right',3,1,'Choose a decade to visualize');//'middle-right''middle-left'

// Adds a layer Landsat_sr widget to the given map, to allow users to change
// which image is displayed in the associated map.
function addLayerSelector(mapToChange, images, position, index, showBackground,promptSelBox) {
  var label = ui.Label(promptSelBox);

  // This function changes the given map to show the selected image.
  function updateMap(selection) {
    var list = ee.List(images.get(selection));
    var imgCol_sr = ee.Image(list.get(2))//.aside(print,'filtered L_sr');
    
    // background image
    var backImg = imgCol_sr;
      
    // update realtime date
    if(!showBackground){
      selectedDate = selection;
      vis_chla.max = 30
      // print('change selectbox', selectedDate)
    }
    else {
      vis_chla.max = 60
      // background image
      backImg = imgCol_sr.multiply(0.0000275).add(-0.2);
    }        
    
    var bacImgVis = ui.Map.Layer(backImg, {bands:list.get(3).getInfo(),min:0,max:0.3,gamma:1.2},"image for "+ selection, showBackground);
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
    value: 'Long-term Chlorophyll-a of Lake Balaton since 1980s',
    style: {fontSize: '23px', fontWeight: 'bold'}
  }),
  ui.Label('We have built a machine learning model to retrieve water surface Chlorophyll-a (Chl-a) based on Landsat images since 1984. \
  Please choose a decade from the panels of the split window to inspect the water quality change along time.\
  What\'s more, the time series of Chl-a concentration can be visualized and downloaded by click a location on the map. \
  The data can be downloaded by clicking the little arrow on the top-right of the time series chart.\n'),
  ui.Label({
    value: 'Please click a location on the map to see the long-term Chl-a:',
    style: {fontSize: '16px', fontWeight: 'bold'}
  })
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
var chlaCol_new = chlaCol.merge(L89_new);
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
  var chlaColChart = ui.Chart.image.series(chlaCol_new, point, ee.Reducer.mean(), 100);

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
      1: {
        color: 'red',
        lineWidth: 0,
        pointsVisible: true,
        pointSize: 2,
      }
    },
    legend: {position: 'right'},
  });
  // Add the chart at a fixed position, so that new charts overwrite older ones.
  inspectorPanel.widgets().set(2, chlaColChart);
};

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
inspectorPanel.widgets().set(3,leg)

// external links
var linkLabel = ui.Label({
  value: 'Related applications:',
  style: {fontSize: '14px', margin: '8px 1px 8px 8px', fontWeight: 'bold'}
});
var historicalLink = ui.Label({
  value: 'Historical Data on Each Date',
  style: {
    fontSize: '12px',
    margin: '8px 8px',
    color: 'blue',
    textDecoration: 'underline'
  },
  targetUrl: 'https://lihuan.projects.earthengine.app/view/chla-balaton-history'
});
var realtimeLink = ui.Label({
  value: 'Realtime Data in Recent One Month',
  style: {
    fontSize: '12px',
    margin: '8px 8px',
    color: 'blue',
    textDecoration: 'underline'
  },
  targetUrl: 'https://lihuan.projects.earthengine.app/view/chla-balaton-realtime'
});
inspectorPanel.widgets().set(4,ui.Panel([linkLabel, historicalLink, realtimeLink],ui.Panel.Layout.flow('vertical')));


// contact
var contact = ui.Label({
    value: 'If you have any queries, please contact:',
    style: {fontSize: '12px', margin: '8px 1px 8px 8px', fontWeight: 'bold'}
  });
var email = ui.Label({
  value: 'li.huan@blki.hu',
  style: {fontSize: '12px', margin: '8px 0px 8px 1px', textAlign: 'left', color: 'blue', textDecoration: 'underline' },
  targetUrl: 'mailto:li.huan@blki.hu'
  });
inspectorPanel.widgets().set(5,ui.Panel([contact,email],ui.Panel.Layout.flow('horizontal')));


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