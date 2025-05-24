# Lake Balaton Water Quality Monitoring (Chlorophyll-a)

This project provides a suite of Google Earth Engine (GEE) applications for monitoring Chlorophyll-a (Chl-a) concentrations in Lake Balaton, Hungary, using Landsat satellite imagery. The applications offer historical analysis, real-time monitoring, and tools for inspecting surface reflectance data.

**Author:** Huan Li
**Affiliation:** Balaton Limnological Research Institute (HUN-REN BLKI)
**Contact:** li.huan@blki.hu

## License

This project is licensed under the MIT License. See the license details within individual script files.

## Applications

The project includes the following GEE applications:

1.  **`OnlineApp.js` - Long-Term & Decadal Chl-a Monitoring**
    *   **Purpose:** Visualizes long-term Chl-a trends in Lake Balaton from the 1980s to the present. It allows for the comparison of Chl-a concentrations across different decades.
    *   **Features:**
        *   Split-panel map interface to compare Chl-a for selected decades.
        *   Generates time-series charts of Chl-a concentration for any clicked location on the map.
        *   Utilizes a machine learning model (Random Forest) for Chl-a retrieval from Landsat surface reflectance.
        *   Provides links to more specific historical and real-time applications.
    *   **To Run:** Copy the code from `OnlineApp.js` into the GEE Code Editor.
    *   **Live App (Main Portal):** (Assumed, based on links in the script)
        *   Historical Data Link: `https://lihuan.projects.earthengine.app/view/chla-balaton-history`
        *   Real-time Data Link: `https://lihuan.projects.earthengine.app/view/chla-balaton-realtime`

2.  **`OnlineApp_history.js` - Historical Chl-a Viewer**
    *   **Purpose:** Allows users to visualize historical Chl-a maps for Lake Balaton on specific dates.
    *   **Features:**
        *   Split-panel interface to compare Chl-a maps from two user-selected historical dates (before and after 2005 by default).
        *   Selection of specific dates from available Landsat imagery.
        *   Time-series chart generation for Chl-a at clicked locations.
        *   Includes an "Adaptation Guide for Other Lakes" in its comments for users wishing to apply the script elsewhere.
    *   **To Run:** Copy the code from `OnlineApp_history.js` into the GEE Code Editor.

3.  **`OnlineApp_realtime.js` - Real-Time Chl-a Monitoring**
    *   **Purpose:** Provides near real-time Chl-a monitoring for Lake Balaton, focusing on imagery from the latest month.
    *   **Features:**
        *   Displays Chl-a maps derived from the most recent Landsat 8/9 imagery (typically within the last month).
        *   Users can select specific dates from the recent period to view corresponding Chl-a maps.
        *   Click-based inspection of Chl-a concentration values on the map.
        *   Utilizes a Random Forest model for Chl-a prediction.
        *   Includes an "Adaptation Guide for Other Lakes" in its comments.
    *   **To Run:** Copy the code from `OnlineApp_realtime.js` into the GEE Code Editor.

4.  **`visualize_SR_timeseries.js` - Landsat Surface Reflectance Time Series Viewer**
    *   **Purpose:** A utility to inspect and visualize raw Landsat (4-9) surface reflectance (SR) time series data for any clicked location globally.
    *   **Features:**
        *   Generates interactive charts for multiple Landsat bands (Blue, Green, Red, NIR, SWIR1, SWIR2).
        *   Allows comparison of SR values across different Landsat sensors (L4, L5, L7, L8, L9).
        *   Useful for data validation, understanding spectral signatures, or detailed spectral analysis.
    *   **To Run:** Copy the code from `visualize_SR_timeseries.js` into the GEE Code Editor.

## Core Scripts & Modules

*   **`getSR_allLandsat.js`:**
    *   This is a crucial helper script, modified from a common GEE LandTrendr utility.
    *   It is responsible for fetching, preprocessing, and harmonizing Landsat 4, 5, 7, 8, and 9 Surface Reflectance (SR) collections.
    *   Functions include scaling SR values, renaming bands for consistency, and applying cloud, shadow, and snow masks.
    *   The `getCombinedSRcollection` function is extensively used by the other applications to acquire analysis-ready SR data.

## Data Sources

*   **Satellite Imagery:**
    *   Landsat 4 TM Surface Reflectance Tier 1 (USGS Collection 2)
    *   Landsat 5 TM Surface Reflectance Tier 1 (USGS Collection 2)
    *   Landsat 7 ETM+ Surface Reflectance Tier 1 (USGS Collection 2)
    *   Landsat 8 OLI/TIRS Surface Reflectance Tier 1 (USGS Collection 2)
    *   Landsat 9 OLI-2/TIRS-2 Surface Reflectance Tier 1 (USGS Collection 2)
*   **Pre-computed Chl-a Data (GEE Assets):**
    *   `users/lihuan/LakeBalaton/Chla_Landsat4_9` (used in `OnlineApp.js`)
    *   `users/lihuan/LakeBalaton/Chla_Landsat_2025` (used in `OnlineApp_history.js`)
*   **Lake Balaton Boundary (GEE Asset):**
    *   `users/lihuan/LakeBalaton/officialBoundary`
*   **Monitoring Stations (GEE Asset):**
    *   `users/lihuan/LakeBalaton/stations`

## Models

The Chl-a retrieval relies on machine learning models:
*   **Random Forest (RF) Model:**
    *   Used in: `OnlineApp_realtime.js` and `OnlineApp.js`
    *   Source: `gs://li-model/RF.txt` (Google Cloud Storage blob)

These models are trained to predict Chl-a concentrations based on Landsat surface reflectance bands and ancillary data (e.g., month).

## How to Use

1.  **Access Google Earth Engine:** You need a GEE account (sign up at earthengine.google.com).
2.  **Open GEE Code Editor:** Navigate to the GEE Code Editor.
3.  **Access the Scripts:** You have two primary ways to access and run the application scripts:
    *   **Option A: Accept Shared Repository (Recommended)**
        *   Click on the following link to accept the shared GEE repository:
            https://code.earthengine.google.com/?accept_repo=users/lihuan/Share_ChlaBalaton
        *   Once accepted, the scripts (e.g., `OnlineApp.js`, `OnlineApp_history.js`) will be available in your GEE Code Editor under the "Reader" or "Owner" section of the "Scripts" tab, typically under a path like `users/lihuan/Share_ChlaBalaton`.
        *   Open the desired script directly from your GEE Code Editor.
    *   **Option B: Copy-Paste Individual Scripts**
        *   Open one of the JavaScript files from this project directory (e.g., `OnlineApp.js`).
        *   Copy the entire content of the script.
        *   Paste it into a new script file in the GEE Code Editor.
4.  **Run an Application:**
    *   With the desired script open in the GEE Code Editor (either from the shared repository or after pasting), click the "Run" button.
    *   The application interface will load, typically including maps and control panels.
5.  **Interact with the Apps:**
    *   Follow the on-screen instructions and labels within each application.
    *   Click on maps to generate time-series charts or retrieve Chl-a values.
    *   Use dropdown menus to select dates or decades for visualization.

## Adaptation for Other Lakes

The `OnlineApp_history.js` and `OnlineApp_realtime.js` scripts include an "Adaptation Guide for Other Lakes" within their comments. This guide provides instructions on how to modify the scripts for use with different geographical areas or datasets, including:

*   Updating GEE asset references for lake boundaries and Chl-a data.
*   Adjusting visualization parameters (e.g., color palettes, min/max values).
    *   Modifying model paths and band names if using a custom Chl-a retrieval model.

## Citation

If you use this project or its components in your research, please consider citing the associated publication (details to be added if applicable).

*(Placeholder for citation: e.g., Li, H. et al. (Year). Title of Paper. Journal Name. DOI)*

---

*This README was generated based on the code and comments within the project files by Gemini Code Assist.*
*Last updated: 2025-05-24*