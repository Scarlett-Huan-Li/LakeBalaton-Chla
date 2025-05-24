/**
 * @license
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * @author Justin Braaten (Google)
 * @author Zhiqiang Yang (USDA Forest Service)
 * @author Robert Kennedy (Oregon State University)
 * MODIFIED 1/2022 Ben Roberts-Pierel (Oregon State University)
 * 
 * MODIFICATIONS:
 * @author Huan Li (Balaton Limnological Research Institute)
 * @date 11/01/2025
 * Major modifications include:
 * - only the function getCombinedSRcollection and related functions left
 * - all other unused functions deleted 
 * - 
 * 
 * @description This file contains functions for working with the LandTrendr
 * change detection algorithm in Google Earth Engine. For information on 
 * LandTrendr and usage of functions in this file see
 * https://github.com/eMapR/LT-GEE. Please post issues to
 * https://github.com/eMapR/LT-GEE/issues.
 */

//########################################################################################################
//##### ANNUAL SR TIME SERIES COLLECTION BUILDING FUNCTIONS ##### 
//########################################################################################################
var removeImages = function(collection, exclude){
  // could not get (system:id) to work though, so getting via string split and slice
  if('exclude' in exclude){
    //print('in exclude')
    exclude = exclude.exclude;
    if('imgIds' in exclude){
      //print('in imgIds')
      var excludeList = exclude.imgIds;
      for(var i=0; i<excludeList.length; i++){
        //print('img blah blah')
        collection = collection.filter(ee.Filter.neq('system:index', excludeList[i].split('/').slice(-1).toString())); //system:id
      }
    }
    if('slcOff' in exclude){
      //print('in slcOff')
      if(exclude.slcOff === true){
        //print('slcOff is true')        
        //'SATELLITE' changed to SPACECRAFT_ID and 'SENSING_TIME' to 'SCENE_CENTER_TIME' in collection 2
        collection = collection.filter(ee.Filter.and(ee.Filter.eq('SPACECRAFT_ID', 'LANDSAT_7'), ee.Filter.gt('SCENE_CENTER_TIME', '2003-06-01T00:00')).not());
      }
    }
  }
  return collection;
};
exports.removeImages = removeImages;

//------ Define a function that scales Landsat surface reflectance images.
function scaleLandsat(image) {
  var getFactorImg = function(factorNames) {
    var factorList = image.toDictionary().select(factorNames).values();
    return ee.Image.constant(factorList);
  };
  var scaleImg = getFactorImg(['REFLECTANCE_MULT_BAND_.']);
  var offsetImg = getFactorImg(['REFLECTANCE_ADD_BAND_.']);
  var scaled = image.select('SR_B.').multiply(scaleImg).add(offsetImg).multiply(10000.0);
  
  // Replace original bands with scaled bands and apply masks.
  return image.addBands(scaled, null, true);
}

//------ FILTER A COLLECTION FUNCTION -----
var filterCollection = function(startYear, endYear, startDay, endDay, sensor, aoi){
  return ee.ImageCollection('LANDSAT/'+ sensor + '/C02/T1_L2')
           .filterBounds(aoi)
           .filterDate(startYear+'-'+startDay, endYear+'-'+endDay);
};

//------ BUILD A COLLECTION FOR A GIVEN SENSOR AND YEAR -----
var buildSensorYearCollection = function(startYear,endYear, startDay, endDay, sensor, aoi, exclude){
  var startMonth = parseInt(startDay.substring(0, 2));
  var endMonth = parseInt(endDay.substring(0, 2));
  var srCollection = filterCollection(startYear,endYear, startDay, endDay, sensor, aoi);
  
  srCollection = removeImages(srCollection, exclude)
  
  
  return srCollection;
}; 
exports.buildSensorYearCollection = buildSensorYearCollection


//------ RETRIEVE A SENSOR SR COLLECTION FUNCTION -----
//scaling values source: https://www.usgs.gov/faqs/how-do-i-use-scale-factor-landsat-level-2-science-products
//define a function to apply Collection 2 scaling coefficients 
var scaleLTdata = function(img){ 
  return ((img.multiply(0.0000275)).add(-0.2)).multiply(10000).toUint16();
}; 

var getSRcollection = function(startYear,endYear, startDay, endDay, sensor, aoi, maskThese, exclude) {
  // make sure that mask labels are correct
  maskThese = (typeof maskThese !== 'undefined') ?  maskThese : ['cloud','shadow','snow'];
  //var maskOptions = ['cloud', 'shadow', 'snow', 'water'];
  var maskOptions = ['cloud', 'shadow', 'snow', 'water', 'waterplus','nonforest']; // add new water and forest mask here Peter Clary 5/20/2020
  for(var i in maskThese){
    maskThese[i] =  maskThese[i].toLowerCase();
    var test = maskOptions.indexOf(maskThese[i]);
    if(test == -1){
      print('error: '+maskThese[i]+' is not included in the list maskable features. Please see ___ for list of maskable features to include in the maskThese parameter');
      return 'error';
    }
  }
  
  // get a landsat collection for given year, day range, and sensor
  var srCollection = buildSensorYearCollection(startYear,endYear, startDay, endDay, sensor, aoi, exclude);
  // apply the harmonization function to LC08 (if LC08), subset bands, unmask, and resample           
  srCollection = srCollection.map(function(img) {
    // img = scaleLandsat(img);
    
    var dat = ee.Image(
      ee.Algorithms.If(
        (sensor == 'LC08') || (sensor == 'LC09'),                            // condition - if image is OLI
        scaleLTdata(img.select(['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'],['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])),
        scaleLTdata(img.select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7'],['B1', 'B2', 'B3', 'B4', 'B5', 'B7']))
        // scaleLTdata(img.select(['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'],['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])),// .unmask()
        // //NOTE based on analysis of the effects of Roy coefficients for various places around the world
        // //we have opted to NOT include their use in this version of these modules
        // scaleLTdata(img.select(['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7'],['B1', 'B2', 'B3', 'B4', 'B5', 'B7']))                   // false - else select out the reflectance bands from the non-OLI image
        //   // .unmask()                                                       // ...unmask any previously masked pixels 
        //   //.resample('bicubic')                                          // ...resample by bicubic 
        //   // .set('system:time_start', img.get('system:time_start'))         // ...set the output system:time_start metadata to the input image time_start otherwise it is null
      )
    )
    .unmask()
    // .copyProperties(img,['system:time_start','CLOUD_COVER'])
    .set('system:time_start', img.get('system:time_start'),'CLOUD_COVER',img.get('CLOUD_COVER'));
    
    // makes a global forest mask
    var forCol = ee.ImageCollection("COPERNICUS/Landcover/100m/Proba-V/Global"); //PETER ADD
    var imgFor = forCol.toBands(); //PETER ADD
    var forestimage = imgFor.select('2015_forest_type') //PETER ADD
    
    // Computes the forest mask into a binary using an expression.
    var selectedForests = forestimage.expression( //PETER ADD
        'Band >= 0 ? 1 : 0', { //PETER ADD
          'Band': forestimage //PETER ADD
    }).clip(aoi); //PETER ADD
    
    //makes a global water mask
    var MappedWater = ee.Image("JRC/GSW1_1/GlobalSurfaceWater"); //PETER ADD
    // calculates water persistence 0 to 100 //PETER ADD
    var MappedWaterBinary = MappedWater.expression( //PETER ADD 
      'band > 99 ? 0 :  1  ', { //PETER ADD
        'band': MappedWater.select('recurrence') //PETER ADD
    }).clip(aoi); //PETER ADD
    
    
    var mask = ee.Image(1);
    if(maskThese.length !== 0){
      var qa = img.select('QA_PIXEL'); 
      for(var i in maskThese){
        if(maskThese[i] == 'water'){mask = qa.bitwiseAnd(1<<7).eq(0).multiply(mask)}
        if(maskThese[i] == 'shadow'){mask = qa.bitwiseAnd(1<<4).eq(0).multiply(mask)} 
        if(maskThese[i] == 'snow'){mask = qa.bitwiseAnd(1<<5).eq(0).multiply(mask)}
        if(maskThese[i] == 'cloud'){mask = qa.bitwiseAnd(1<<3).eq(0).multiply(mask)} 
        // added masked options for the UI
        if(maskThese[i] == 'waterplus'){mask = mask.mask(MappedWaterBinary)} //PETER ADD
        if(maskThese[i] == 'nonforest'){mask = mask.mask(selectedForests)} // PETER ADD
      }
      return dat.mask(mask); //apply the mask - 0's in mask will be excluded from computation and set to opacity=0 in display
    } else{
      return dat;
    }
  });

  return srCollection; // return the prepared collection
};
exports.getSRcollection = getSRcollection;


//------ FUNCTION TO COMBINE LT05, LE07, LC08 and LC09 COLLECTIONS -----
var getCombinedSRcollectionOrig = function(startYear,endYear, startDay, endDay, aoi, maskThese) {
    var lt5 = getSRcollection(startYear,endYear, startDay, endDay, 'LT05', aoi, maskThese);       // get TM collection for a given startYear,endYear date range, and area
    var le7 = getSRcollection(startYear,endYear, startDay, endDay, 'LE07', aoi, maskThese);       // get ETM+ collection for a given year, date range, and area
    var lc8 = getSRcollection(startYear,endYear, startDay, endDay, 'LC08', aoi, maskThese);       // get OLI collection for a given year, date range, and area
    var lc9 = getSRcollection(startYear,endYear, startDay, endDay, 'LC09', aoi, maskThese);       // get OLI collection for a given year, date range, and area
    var mergedCollection = ee.ImageCollection(lt5.merge(le7).merge(lc8).merge(lc9)); // merge the individual sensor collections into one imageCollection object
    return mergedCollection;                                              // return the Imagecollection
};
var getCombinedSRcollection = function(startYear,endYear, startDay, endDay, aoi, maskThese, exclude) {
    exclude = (typeof exclude !== 'undefined') ?  exclude : {}; // default to not exclude any images
    var lt5 = getSRcollection(startYear,endYear, startDay, endDay, 'LT05', aoi, maskThese, exclude);       // get TM collection for a given year, date range, and area
    var le7 = getSRcollection(startYear,endYear, startDay, endDay, 'LE07', aoi, maskThese, exclude);       // get ETM+ collection for a given year, date range, and area
    var lc8 = getSRcollection(startYear,endYear, startDay, endDay, 'LC08', aoi, maskThese, exclude);       // get OLI collection for a given year, date range, and area
    var lc9 = getSRcollection(startYear,endYear, startDay, endDay, 'LC09', aoi, maskThese, exclude);       // get OLI collection for a given year, date range, and area
    var mergedCollection = ee.ImageCollection(lt5.merge(le7).merge(lc8).merge(lc9)); // merge the individual sensor collections into one imageCollection object
    // if (incL89){
    //   mergedCollection = mergedCollection.merge(lc8).merge(lc9);
    // }
    //mergedCollection = removeImages(mergedCollection, exclude);
    return mergedCollection;                                              // return the Imagecollection
};
exports.getCombinedSRcollection = getCombinedSRcollection; 