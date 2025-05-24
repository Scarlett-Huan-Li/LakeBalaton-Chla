/*
 * This script visualizes surface reflectance time series from Landsat 4-9 for any clicked location
 * Author: Huan Li
 * Email: li.huan@blki.hu
 * Last modified: 2025-01-25
 * 
 * MIT License
 * 
 * Copyright (c) 2025 HUN-REN Balaton Limnological Research Institute
 * 
 * The app provides:
 * 1. Interactive map interface for location selection
 * 2. SR time series data comparison and download of all Landsat bands (L4-9)
 */
// Define band mappings for different Landsat sensors
var bandsL457 = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7'];
var bandsL89 = ['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7']; 
var bandNames = ['Blue', 'Green', 'Red', 'NIR', 'SWIR1', 'SWIR2']; 
// Define time range
var startDate = '1984-01-01';
var endDate = ee.Date(Date.now());

function maskL457Clouds(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Unused
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBand = image.select('ST_B6').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBand, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

function maskL89sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

// Define Landsat collections with renamed bands
var l4 = ee.ImageCollection('LANDSAT/LT04/C02/T1_L2')
    .filterDate(startDate, endDate)
    // .filterBounds(point)
    .map(maskL457Clouds)
    // .select(['SR_B1'], ['Green'])  // Rename band to 'Green'
    .select(bandsL457, bandNames)
    .map(function(img) {
      return img.set('system:time_start', img.get('system:time_start'))
        .set('SATELLITE', 'L4');
    });

var l5 = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
    .filterDate(startDate, endDate)
    // .filterBounds(point)
    .map(maskL457Clouds)
    // .select(['SR_B1'], ['Green'])
    .select(bandsL457, bandNames)
    .map(function(img) {
      return img.set('system:time_start', img.get('system:time_start'))
        .set('SATELLITE', 'L5');
    });

var l7 = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
    .filterDate(startDate, endDate)
    // .filterBounds(point)
    .map(maskL457Clouds)
    // .select(['SR_B1'], ['Green'])
    .select(bandsL457, bandNames)
    .map(function(img) {
      return img.set('system:time_start', img.get('system:time_start'))
        .set('SATELLITE', 'L7');
    });

var l8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate(startDate, endDate)
    // .filterBounds(point)
    .map(maskL89sr)
    // .select(['SR_B2'], ['Green'])
    .select(bandsL89, bandNames)
    .map(function(img) {
      return img.set('system:time_start', img.get('system:time_start'))
        .set('SATELLITE', 'L8');
    });

var l9 = ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
    .filterDate(startDate, endDate)
    // .filterBounds(point)
    .map(maskL89sr)
    // .select(['SR_B2'], ['Green'])
    .select(bandsL89, bandNames)
    .map(function(img) {
      return img.set('system:time_start', img.get('system:time_start'))
        .set('SATELLITE', 'L9');
    });

// Merge all collections
var mergedCollection = l4.merge(l5).merge(l7).merge(l8).merge(l9);

// Create main panels
var mainPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {width: '100%', height: '100%'}
});

// Create map panel
var mapPanel = ui.Map();
mapPanel.setOptions('HYBRID');
mapPanel.style().set('cursor', 'crosshair');
mapPanel.style().set({width: '70%', height: '100%'});

// Create chart panel
var InstructionPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '30%',
    height: '100%',
    padding: '8px'
  }
});

// Add title to chart panel
var titleLabel = ui.Label('Time Series Charts', {
  fontWeight: 'bold',
  fontSize: '18px',
  margin: '10px 0'
});
InstructionPanel.add(titleLabel);

// Create an info panel
var infoPanel = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)'
  }
});
// Add instruction text
var instructionText = ui.Label({
  value: 'Please click anywhere on the map to get the surface reflectance series of Landsat 4-9',
  style: {
    fontSize: '16px',
    margin: '0 0'
  }
});
// Add contact information
var contactText = ui.Label({
  value: 'For queries, contact: li.huan@blki.hu',
  style: {
    fontSize: '12px',
    margin: '4px',
    color: '#666'
  }
});
// Add labels to the panel
infoPanel.add(instructionText);
infoPanel.add(contactText);
// Add the panel to the map
InstructionPanel.add(infoPanel);

var chartPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '100%',
    height: '100%',
    padding: '8px'
  }
});
InstructionPanel.add(chartPanel);

// Add panels to main panel
mainPanel.add(mapPanel);
mainPanel.add(InstructionPanel);

// Create charts for each band
function createChart(fcList, bandName) {
  return ui.Chart.feature.groups({
    features: fcList,
    xProperty: 'time',
    yProperty: bandName,
    seriesProperty: 'satellite'
  })
  .setChartType('ScatterChart')
  .setOptions({
    title: 'Landsat ' + bandName + ' Band Surface Reflectance Time Series',
    vAxis: {
      title: 'Surface Reflectance',
      viewWindow: {min: 0, max: 0.4}
    },
    hAxis: {
      title: 'Date',
      format: 'yyyy',
    },
    series: {
      0: {color: '#4B0082'},  // Indigo for L4
      1: {color: '#1E90FF'},  // DodgerBlue for L5
      2: {color: '#FF4500'},  // OrangeRed for L7
      3: {color: '#32CD32'},  // LimeGreen for L8
      4: {color: '#FF1493'},  // DeepPink for L9
    },
    pointSize: 3,
    legend: {position: 'right'}
  });
}

// Function to generate charts for a point
var generateChart = function(coords) {
  mapPanel.layers().reset();
  chartPanel.clear();
  
  // Create and add coordinate display
  var coordLabel = ui.Label('Selected Location: ' + 
    coords.lon.toFixed(4) + '°, ' + coords.lat.toFixed(4) + '°', 
    {margin: '3px 0'});
  chartPanel.add(coordLabel);
  
  var point = ee.Geometry.Point(coords.lon, coords.lat);
  
  // Create a feature collection with time and reflectance values
  var fcList = mergedCollection
  .filterBounds(point)
  .map(function(image) {
    var b = image.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: point,
        scale: 30
      });
    return ee.Feature(null, {
      'time': image.get('system:time_start'),
      'Blue': b.get('Blue'),
      'Green': b.get('Green'),
      'Red': b.get('Red'),
      'NIR': b.get('NIR'),
      'SWIR1': b.get('SWIR1'),
      'SWIR2': b.get('SWIR2'),
      'satellite': image.get('SATELLITE')
    });
  });
  
  // Add new point to map
  mapPanel.addLayer(point, {color: 'FF0000'}, 'Selected Point');
  mapPanel.setOptions('HYBRID');
  
  // Create time series for each band
  bandNames.forEach(function(band) {
    var chart = createChart(fcList, band);
    chartPanel.add(chart);
  });
};

// Add a map click handler
mapPanel.onClick(function(coords) {
  generateChart(coords);
});

// Add the point to the map
mapPanel.centerObject(point, 12);
mapPanel.addLayer(point, {color: 'red'}, 'Sample Point');

/*
* Initialize the app
*/

// Replace the root with main panel.
// Clear the root and add the main panel
ui.root.clear();
ui.root.add(mainPanel);

generateChart({
  lon: point.coordinates().get(0).getInfo(),
  lat: point.coordinates().get(1).getInfo()
});