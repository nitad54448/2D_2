# Material presets

Copy this `lib` directory beside `index.html`. This update also replaces the supplied files in `assets` and `index.html`.

In Materials, each card has a **Find material** search and a **Material preset** selector. Custom is first. An empty search lists up to 50 filenames alphabetically; typing `B` shows filenames starting with B (case insensitive). Choosing a preset prefills its scalar properties. Choose **Custom** to keep those values and edit every field.

The library contains Copper, Platinum, Gold, Aluminum, Bi2Te3 (positive-Seebeck benchmark), an explicitly illustrative n-type Bi2Te3 partner, and a representative PbTe room-temperature model. Each JSON documents its source URLs, units and modeling assumptions. These are starting points, not specimen-specific calibrated properties. All reference laws in this application use 300 K; nearby-temperature data are approximated or rebased as explained in each file. In particular, zero slopes mean an assumed constant coefficient, not a measured zero derivative.

## Add or edit a material

Copy one of the material JSONs and change its filename and values. Keep `format: "TE_2D_material"`, `version: 1` and `referenceTemperature: 300`. The `material` object requires `name`, a six-digit hex `color`, and all seven SI properties:

| Key | Units |
|---|---|
| rho | kg/m³ (mass density) |
| Cp | J/(kg K) |
| k | W/(m K) |
| sigma | S/m (conductivity, not resistivity) |
| alpha | V/K |
| beta | 1/K (resistivity slope) |
| alphaSlope | V/K² |

Density, heat capacity and conductivities must be positive. Include a `notes` string describing composition, temperature range and assumptions, and source URLs for traceability. The UI displays alpha in µV/K and alphaSlope in µV/K²; the JSON uses V/K and V/K².

**Add one JSON:** click **Add material json** and select one material JSON file. It adds a preset to the existing list and a prefilled material card to the model, selecting that material for painting. Existing materials and their values stay intact. The new card is locked to the preset until you choose Custom. If an identical filename and preset already exist, that preset is reused for the new card. A conflicting filename is rejected; rename the JSON to add it as a separate preset. The model supports 12 material cards and the library supports 1000 presets.

**Opening index.html directly:** the bundled `catalog.js` snapshot supplies the initial list. Added JSON presets remain available for this page session; choosing a file does not write it into `/lib`. To include one permanently at startup, copy its JSON into `lib`, run `python lib/build_catalog.py`, and reopen the page. Used material values are embedded in saved projects regardless of where the JSON lives.

**Serving the app over HTTP(S):** the app automatically reads `lib/index.json` and the listed files. Run the same build script after adding or renaming files, or edit the index's `files` array. No directory-listing server or backend is needed. If reading fails, the bundled snapshot remains available and the UI explains the failure.

A project embeds the actual chosen properties and short preset notes, so colleagues can reopen and calculate with a project even without that material JSON. Refreshing the hosted library never silently replaces the embedded values. Choose a preset explicitly to apply its latest values. Library files are not added to the project ZIP as a separate global collection.

Validation rejects malformed files and conflicting filenames without changing the current library or model. Each added JSON must be no larger than 64 KiB. Folder loading is not supported.
