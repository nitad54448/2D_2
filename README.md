# Thermoelectric Lab — update 13, simplified project import

Extract this entire application ZIP to a new folder and open `index.html` in a modern browser. Keep the `assets` folder beside it. No installation, server or internet connection is required for normal operation.

## Share and reopen a calculation

1. Run a calculation or frequency sweep.
2. On Results, choose **Export → Save project / complete results ZIP**.
3. Send that results ZIP to a colleague who has this updated application.
4. They open `index.html`, click **Import Project** (left of Import model), and select the results ZIP. Do not extract the results ZIP before importing it.

The project restores the computed model, all retained field histories and harmonics, convergence information, sweep points, selected frequency, probe, harmonic representation, time position and Bode settings. Results can be inspected and exported without recalculation. The model can also be edited and run again.

The archive also contains the printable HTML report, SVG figures, full-precision JSON and CSV data. Exports save the model belonging to the computed results, not later uncomputed input edits. Periodic results contain the last retained complete cycle, not every startup cycle. Stopped/unconverged results remain labelled provisional; importing never resumes a calculation automatically.

Import Project requires a project ZIP exported by update 13 or later, containing the versioned `project.json` metadata. Older results-only ZIPs are rejected; there is no legacy import fallback. The reader supports original uncompressed ZIPs and ZIPs recompressed with Deflate when the browser supports raw Deflate decompression. Encrypted, split and ZIP64 archives are unsupported. Import is bounded to 2 GiB per archive, 256 MiB of selected JSON and the solver's existing retained-data memory budget. Archived HTML and scripts are never executed during import.

## Display changes

- Harmonic scalar fields offer **Amplitude**, **Phase**, **Re** and **Im**. Temperature and potential first average the four complex nodal phasors per cell, then derive the selected representation. Exported maps follow the same rule and include Re/Im maps.
- DC remains the signed mean. The `|J|` map remains the vector phasor norm; choose Jx or Jy for phase, Re or Im. Im is the signed imaginary coefficient in `Re(U exp(inωt))`, so it multiplies `−sin(nωt)`.
- DC results show the clicked probe's temperature, potential and coordinates.
- Switching sweep frequencies preserves the field, harmonic, representation, probe and cycle fraction.
- Imported thermal boundaries are restricted to the four known sides; unexpected keys are rejected and the renderer uses a fixed side list.

## Files and verification

The changes-only ZIP contains full replacements for `assets/project.js`, `tests/regression.cjs` and this README. Extract it into the update 13 application folder, replacing those three files. The other update 13 files, including `index.html`, stay as they are.

With Node.js 24 or newer, run `node tests/regression.cjs`. Tests cover solver smoke cases, worker encoding/decoding, spatial phasors, display-state handling, current project round trips, rejection of older results-only ZIPs, and malformed archive rejection. UI tests use DOM/canvas test doubles; actual browser rendering and interaction were not verified in the development environment because a browser binary was unavailable.
