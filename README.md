# Thermoelectric Lab — 2D browser edition

An offline HTML/CSS/JavaScript workbench for nonlinear planar thermoelectric
transport. The model solves spatial temperature, voltage and current fields in
multiple materials, including Seebeck, Joule, Peltier and Thomson effects. Periodic
runs return DC and the 1ω, 2ω and 3ω components.

## Start

Extract the entire ZIP and open **index.html**. Keep its **assets/** folder beside
it. No runtime packages or internet connection are needed. JavaScript is loaded
from local assets; styles and worker source remain embedded. Do not move or copy
index.html alone.

To use Python's local web server, open a terminal in this extracted folder:

```bash
python -m http.server 8001 --bind 127.0.0.1
```

Open **http://127.0.0.1:8001**. Use `python3` if that is your Python command.
Port 8001 avoids interfering with a 1D app already running on port 8000. Stop the
server with Ctrl+C. Python only serves static files; the solver runs in JavaScript.

Keep this version in its own folder. It does not overwrite the 1D application.
All files in the ZIP are complete.

## The five tabs

| Tab | Controls / output |
|---|---|
| Geometry | Width, height, out-of-plane depth, x/y cell counts, paintable material grid |
| Materials | Material reference properties and temperature-dependent resistivity/Seebeck laws |
| Boundaries | Two equipotential electrical contacts, their positions/coverage, four thermal sides |
| Solver | Steady or periodic mode, drive frequency, steps per period, maximum cycles |
| Results | 2D heatmaps, harmonic amplitude/phase/real part, current arrows, movable temperature probe, terminal spectrum and exports |

Tabs retain their values. Arrow keys, Home and End navigate the tab list.

Suggested first runs:

1. **Open circuit · Seebeck DC** — checks the sign and value of Seebeck voltage.
2. **Narrow contact · current spreading** — a genuinely 2D stationary example.
3. **Homogeneous · Joule 2ω** — time-periodic Joule heating.
4. **Nonlinear resistance · 3ω** — voltage mixing through temperature-dependent resistivity.
5. **Cu / BiTe · layered** — coupled multilayer response.

Preset properties are illustrative, not certified material data.

## Geometry and materials

The domain is a filled rectangle in x/y, extruded through a constant physical
depth. x increases to the right; y increases upward. GUI dimensions are in mm;
the model configuration uses meters. Depth converts current density into amperes
and heat flux into watts. This is planar 2D, not axisymmetric geometry.

Click a palette material, then click/drag on the grid to paint its cells. Add
materials in the Materials tab. Painting is disabled while the worker is running.
The grid can represent arbitrary *grid-aligned* material regions, not holes,
unmeshed voids or curved boundaries. Each cell must have a conducting material.

Set **Elements along x (Nx)** and **Elements along y (Ny)** in the Geometry tab.
The total element count is **Nx × Ny**, and the node count is **(Nx+1) × (Ny+1)**.
For example, Nx=20 and Ny=10 gives 200 elements and 231 nodes. There is no fixed
127-element count. For a 1D reduction along x, set **Ny = 1**, use full
left/right electrical contacts, and set the top/bottom thermal boundaries to
zero flux. Materials can vary along x. Keep Ly and depth positive: the physical
cross-section is **Ly × depth**. This is one row of 2D cells with two node rows;
Ny = 1 alone does not enforce a 1D solution under asymmetric boundary conditions. **Time steps per period** is a separate temporal setting.

After changing dimensions or element counts, click **Apply mesh** to update the
preview immediately. **Run simulation** and **Export model** also apply pending
mesh changes automatically. The live summary shows pending and applied counts.
Mesh controls are disabled during a running calculation; use Stop before editing.
Remeshing resamples the old cell map by cell-center location. Inspect small regions
after remeshing; they can disappear on a coarse grid. All interfaces follow grid
lines. Electrode endpoints are resolved on boundary nodes and effectively snap
inward to nodes within the selected range.

The editor uses:

```
rhoe(T) = [1 + beta*(T - 300)] / sigma300
alpha(T) = alpha300 + alphaSlope*(T - 300)
```

Density, heat capacity and thermal conductivity are constant in the GUI. Seebeck
is entered in µV/K and its slope in µV/K². Temperatures are absolute K. The solver
requires positive finite density, heat capacity, electrical conductivity and
thermal conductivity. Alpha may have either sign.

The JS material class also accepts functions of T or serialized `linear` and
`inverseLinear` descriptors. Custom functions must be defined in source; they
cannot be transferred through worker messages. The GUI imports scalar reference
properties and its built-in linear laws; it does not evaluate text as code.

## Input validation

Invalid fields are highlighted immediately with an error summary. Apply mesh,
Run simulation and Export model remain disabled until the inputs are corrected.
Values are not silently clamped. The same validation runs for JSON imports and
inside the worker before computation.

| Input | Accepted values |
|---|---|
| Width, height, out-of-plane depth | Finite and strictly greater than zero |
| Density, heat capacity, thermal/electrical conductivity | Finite and strictly positive |
| Imposed/ambient absolute temperature | Above 0 K throughout the cycle: DC > absolute AC peak |
| Convection coefficient h | Finite and nonnegative; zero means no convection |
| Current, voltage, heat flux, Seebeck coefficient and slopes | Either sign, but finite |
| Frequency | Positive for periodic runs; nonnegative in steady mode |
| Nx, Ny | Integers: Nx ≥ 2, Ny ≥ 1; at most 1600 total nodes |
| Steps per cycle | Integer 32–2048 through the API; GUI choices 64–1024 |
| Maximum cycles | Integer 3–1000 |
| Electrode ranges | 0 ≤ start < end ≤ 100%, at least two covered nodes, no overlap |

Prescribed temperature waveforms must agree at shared corners. Steady runs need
an imposed temperature or nonzero convection. Material maps must match the mesh
and reference existing materials. Temperature-dependent laws are checked at 300 K,
at prescribed temperature extremes, and again at temperatures reached during the
solve. Numerical overflow, underflow of cell geometry, and nonfinite computed
fields cause an explicit failure. These checks cannot establish experimental
validity of material laws outside their measured calibration range.

## Electrical contacts

Select a source and a sink side: left, right, bottom or top. Each contact is an
equipotential segment occupying a percentage range on that side. Ranges go:

- bottom to top on left/right sides;
- left to right on bottom/top sides.

White lines show the source, pink lines the sink. Each contact requires at least
two boundary nodes; overlapping contacts, including a shared corner, are rejected.
All other exterior nodes have zero normal electrical current.

The source potential is zero. Control modes are:

- **Voltage:** prescribe V(sink). V(source)=0.
- **Total current:** solve for the sink potential so the total current entering
  through the source equals the requested amperes. Local current density is not
  prescribed and can vary strongly over the contact.
- **Open circuit:** net current through each contact is zero, but each contact
  remains equipotential. Internal thermoelectric circulating currents can still
  exist in 2D. This does not impose J=0 in every material.

Positive total current enters at the source and exits at the sink. Reported
terminal voltage is **V(sink)−V(source)**. A passive isothermal resistor therefore
has negative terminal voltage under positive current.

Electrical excitation is `bias + peak*cos(2*pi*f*t + phase)`; phase is in degrees.
Steady mode uses only the DC bias. Periodic mode retains both bias and AC.
There is no external circuit capacitance or inductance.

## Thermal boundaries

Each of the four sides can use:

| Condition | Meaning |
|---|---|
| Temperature | Prescribed absolute temperature in K |
| Flux | Prescribed **total outward** heat flux in W/m² |
| Convection | Total outward heat flux h(T−Tambient), h in W/m² K |

Zero total flux is adiabatic, including Peltier transport. A fixed-temperature
boundary absorbs/provides the required reaction heat. Adjacent fixed-temperature
sides must agree at their common corner; contradictory values are rejected.
Temperature and flux boundary values may contain DC and AC components. The GUI
uses phase zero for thermal signals; the JS boundary descriptors can also specify
phase. Thermal electrodes and electrical contacts are independent settings.
There are no losses through the front/back faces associated with the extrusion
depth. Include those only after explicitly extending the model.

## Equations and conservative spatial model

```
J = -sigma * (grad(V) + alpha*grad(T))
div(J) = 0
q = alpha*T*J - k*grad(T)
rho*Cp*dT/dt = -div(q) - J.dot(grad(V))
```

The model uses scalar isotropic properties. Inside a smooth material, expansion
yields Joule heating J²/sigma and Thomson heating −T(dalpha/dT)J·grad(T).
Material jumps produce Peltier transport through the total heat flux. Those terms
must not be added again as separate interface or volumetric sources.

The implementation is a nodal conservative control-volume network on a rectangular
grid. Each material cell contributes four links between adjacent corner nodes:
two x links and two y links, each with half the cell's transverse face area.
Neighboring material cells can contribute separate parallel links along the same
node pair. This retains each side's material rather than averaging unrelated
materials into one nodal coefficient. Temperature and potential are continuous
at shared interface nodes; contacts between materials are ideal.

For a link a→b in one material:

```
g = Ahalf / (length * mean(rhoe(Ta), rhoe(Tb)))
Iab = g * [Va - Vb - alphaMean*(Tb - Ta)]
Qab = alphaMean*(Ta+Tb)/2 * Iab - kMean*Ahalf/length*(Tb-Ta)
Pab = Iab*(Va-Vb)
```

The thermal node balance receives −Qab at a, +Qab at b and half Pab at each end.
Each cell contributes one quarter of its local heat capacity to each corner.
Internal link fluxes cancel in global balances. An interface node receives
capacity contributions from all its neighboring materials.

These are finite-grid approximations. Small inclusions, sharp corners, high
property contrasts and contact singularities need spatial refinement. The app
is not a mesh-independent description of point contacts.

## Electrical and nonlinear solution

For fixed T, the electric graph problem is linear. Voltage mode solves it once.
Current/open-circuit mode combines a Seebeck-driven zero-terminal-voltage solution
with a unit-terminal-voltage solution, then chooses the terminal voltage satisfying
the total-current constraint. Current is a spatial field, not the uniform scalar
used by the 1D reduction.

Electric and thermal linear systems are symmetric graph operators solved using
Jacobi-preconditioned, matrix-free conjugate gradients. Fixed boundary nodes are
eliminated. There is no dense numerical Jacobian.

Nonlinear thermal/electric coupling uses damped Picard iterations. Each iteration
re-evaluates material laws, solves voltage/current, assembles thermal transport
and solves temperature. Default relaxation is 0.85, update tolerance 2e-9 K and
maximum 100 nonlinear iterations. Failure raises an explicit error. Picard can
fail on difficult strongly nonlinear cases; this version does not silently
switch algorithms or accept an unfinished iterate.

Periodic runs use fixed-step BDF2 with one backward-Euler startup step. Consecutive
full temperature cycles are compared using absolute tolerance 2e-7 K plus relative
tolerance 1e-10 of the absolute temperature. At least three cycles are required.
Default GUI settings: 128 steps per period and a 100-cycle budget. All serialized
boundary signals share the specified drive frequency, so no arbitrary nonperiodic
function is accepted as a boundary signal.

**A converged cycle does not guarantee accurate small harmonics.** Repeat with
twice as many cells and twice as many steps. For weak 3ω responses, start with
256 or 512 steps and compare refinements. Tighten nonlinear/cycle tolerances through
the API when necessary. Strong heating may have no stable periodic state.

The app caps the mesh at 1600 nodes. Start around 12×8 cells. Time and memory costs
increase with cell count, time samples, nonlinear iterations and cycles. The worker
keeps the page responsive; Stop terminates the calculation. No result is marked
converged after a solver failure.

Elapsed wall time updates independently every 0.1 s in the browser. Periodic runs
report steps within each cycle and show the fraction of the cycle budget used;
this is not a predicted completion percentage, since convergence can finish early.
The existing Web Worker keeps computation off the UI thread.

Stop retains the latest complete periodic cycle, or the previous result if no
complete cycle exists. Provisional cycles are labelled unconverged, and their
harmonics need not represent a settled periodic response. JSON and CSV exports
include convergence status. Steady runs retain the previous result when stopped;
unfinished nonlinear iterates are not exported. Completed-cycle checkpoints add
some computation and message-transfer overhead.

## Harmonics and field display

```
u(t) = U0 + Re[sum(Un * exp(i*n*omega*t))]
```

All phasors use **peak**, not RMS, amplitudes. `{re, im}` stores each complex
coefficient. A positive sine has a negative imaginary phasor.

- Temperature and voltage are nodal. Their heatmaps display an average of the
  four corner values per cell; phase uses the average complex phasor before
  taking its angle. The color scale spans the underlying nodal values.
- Jx, Jy and heat-flux components are reconstructed at cell centers from the two
  corresponding half-face contributions. Cell-average reconstructions are for
  plotting; current conservation is enforced on the original link network.
- The current-magnitude map uses `sqrt(|Jx_n|² + |Jy_n|²)` for harmonic n. It is a
  vector phasor norm, not a Fourier coefficient of the instantaneous scalar |J|.
  Its phase is not defined, so the phase control is disabled for this map.
- DC displays signed real values, except |J|. At higher harmonics select amplitude,
  phase or real part.
- Current arrows show the **real vector phasor at 0°** of the selected harmonic,
  not a streamline calculation. Arrow length is scaled relative to the maximum.
- Phase has little meaning when the corresponding amplitude is near numerical
  noise. Inspect amplitudes and refinement before interpreting phase patterns.
- Click the field to select a temperature probe. Probe histories use the nearest
  node, rather than the cell-averaged display value.

## Export formats

Numeric input fields display at most 10 significant digits and remove binary
floating-point artifacts such as 0.19999999999. Unchanged fields retain their full
stored numerical value; exports and calculations retain full precision.

Export model: JSON configuration. Export results: configuration, mesh coordinates,
full histories, terminal quantities and complex harmonic arrays. Spectrum CSV
contains terminal-voltage DC/1ω/2ω/3ω amplitude, phase, real and imaginary values.
Model edits disable result exports until a new run, to avoid associating old results
with changed controls. Results already displayed remain the previous computed run.

Indexing:

```
node index = j*(nx+1) + i        i=0..nx, j=0..ny
cell index = j*nx + i           i=0..nx-1, j=0..ny-1
```

j=0 is the bottom. Temperature/voltage histories use `[sample][node]`; Jx/Jy/qx/qy
use `[sample][cell]`. Harmonics use `[order][node or cell]` entries `{re,im}`.
Terminal quantities have one value per sample/order. The steady output contains
one spatial snapshot. `energyResidual` is heat leaving minus electrical power
absorbed, in W, and is reported for steady states only. `freeResidualWatts` is a
local semi-discrete thermal balance diagnostic, not a temperature-error estimate.

## Source files and editing

| File | Role |
|---|---|
| `src/index.template.html` | Five-tab layout |
| `src/styles.css` | Responsive styles |
| `src/app.js` | Controls, painting, canvas maps, plots, exports |
| `src/ui-helpers.js` | Precision-preserving display formatting and validated remeshing |
| `src/worker.js` | Background execution |
| `src/core/materials.js` | Material laws, adapted from the 1D version |
| `src/core/mesh2d.js` | Nodal grid, material cells, conservative links, boundary measures |
| `src/core/sparse.js` | Matrix-free graph solves with Dirichlet elimination |
| `src/core/solver2d.js` | 2D electric transport, thermal balance, nonlinear and periodic solves |
| `src/core/fourier.js` | Harmonic projection, using the same convention as the 1D version |
| `src/core/validation.js` | Shared physical and configuration validation |
| `src/core/config2d.js` | Serializable configuration and model construction |
| `build.cjs` | Builds index.html and syntax-checked local assets |

Edit the full files in `src/`, then rebuild index.html and assets/ with Node.js:

```bash
node build.cjs
```

No npm install is required for rebuilding or numerical tests.
The JS API is also usable from Node:

```js
const TE = require('./tests/load.cjs');
const config = TE.default2D();
config.mode = 'steady';
config.electrical.value = {bias: .1, amplitude: 0};
config.electrical.sourceRange = [.25, .75];
const result = TE.run2D(config);
console.log(result.terminalVoltage, result.energyResidual);
```

For custom numerical tolerances, construct `TE.from2DConfig(config)` and call
`solvePeriodic(f, {samples, maxPeriods, periodicAtol, periodicRtol, tolerance})`
or `solveSteady({tolerance, maxIterations, relaxation})` directly. Do not add
unrecognized numerical keys to GUI configuration expecting them to be used.

## Validation and remaining limits

Run:

```bash
node --test tests/solver.test.cjs tests/worker.test.cjs tests/ui-helpers.test.cjs tests/validation.test.cjs tests/review.test.cjs tests/exports.test.cjs
```

All 62 automated tests passed on this package: 24 numerical tests, four packaging/
worker checks, six precision/remeshing checks 20 input-validation checks four review regression checks and four export checks.
They cover analytical 2D solutions, current spreading, circulating currents in
open circuit, interface Peltier, Thomson, energy balances, mesh/time refinement,
agreement with the corrected 1D solver, and rejection of invalid configurations.
See `VALIDATION.md` and `validation.txt`.

Full visual/click browser testing was not executed here because no browser binary
was available. The exact embedded worker source was tested with Node workers,
and an optional Playwright browser test is supplied. This does not substitute
for checking your browser's local-file/Blob policy or your target screen layout.

This model remains a rectangular, constant-depth, isotropic, perfect-contact
approximation. It does not support holes, curved or unstructured meshes, variable
depth, anisotropic tensors, contact resistances, front/back surface losses,
radiation or dynamic external electrical circuits. Material data and experimental
agreement must be validated for the intended application.

## Follow-up consistency review

An omitted convection coefficient consistently defaults to zero. The linear solver
rejects invalid tolerances/iteration limits and accepts convergence on the last
permitted iteration. Derived densities, heat fluxes and powers must remain finite.
Stopped-cycle plots show only sampled data, without a fabricated periodic closing
point. Switching to DC/current magnitude preserves the selected harmonic display
mode. Periodic JSON includes `cycleStartTime` in seconds; `time` remains relative
to that cycle. The four new regression tests are in `tests/review.test.cjs`.

## Full PDF report and complete results ZIP

At the top of Results, click **Export**:

- **Full PDF report** opens an offline print-ready report in a new tab. Click
  **Save as PDF / Print**, then select **Save as PDF** in your browser. Use A4
  portrait; browser headers/footers can be disabled. Allow pop-ups if prompted.
- **Complete results ZIP** downloads the saved model, complete retained results
  JSON, node/cell coordinates, all field histories and harmonics as CSV, terminal
  data, standalone SVG figures, and the same report as `report.html`. The report
  can be opened offline and saved as PDF later. The ZIP does not contain an
  automatically generated PDF: PDF creation uses the browser print dialog.

Periodic reports include DC and 1ω/2ω/3ω amplitude maps of temperature, voltage,
Jx, Jy, qx, qy and current vector magnitude, plus phase maps of the component
fields. They also include material properties, thermal/electrical boundaries,
convergence status, geometry, terminal spectrum and the selected probe history.
Steady reports contain DC results only. All exports use the computed result's
model; pending inputs are never substituted. Provisional cycles are explicitly
labelled unconverged in the report, JSON, manifest and terminal harmonic CSV.

“Complete” means all retained solver data. Periodic exports contain the latest
saved full cycle, not every startup cycle. JSON retains full numeric precision;
report tables use readable rounding. SVG maps use cell averages for nodal fields.
Each map has its own scale. Phase near zero magnitude may be numerical noise.

The archive is a standard uncompressed ZIP for offline compatibility. Large
meshes/time histories produce large downloads and require additional browser
memory. CSV construction yields between batches so progress messages can repaint.
No server, internet connection or third-party runtime package is required.

`src/exports.js` owns report/SVG/CSV/ZIP creation independently of the live form.

## Startup diagnostics / separate-script build

Build `separate-scripts-2` loads startup.js, core.js, exports.js and app.js from
assets/ in that order. Report HTML is no longer embedded in the main HTML script.
A red startup message preserves the first failure, its source file/line and browser
identity. If startup still fails, send this message and the browser/version.
The uploaded failing file matched the prior generated build byte-for-byte and
passed JavaScript parsing checks; the browser-specific failure is not yet reproduced.

## DC excitation, instantaneous spatial profiles and equation guide

In Boundaries, select **DC · stationary** under Excitation, then set the constant
current or voltage in **DC bias**. The Solver method is inferred automatically from active electrical and thermal inputs. AC peak,
phase and time integration settings are ignored in DC. The new **DC · Joule
heating / spatial profile** preset provides a one-row example with a 0.2 A drive.
This is a stationary DC solution, not a DC switch-on transient.

Results includes **Spatial field · selected time**, a 2D map of temperature,
voltage, current components/magnitude or heat flux. For periodic runs, the slider
selects a stored sample of the last saved complete cycle. Temperature and voltage
are averaged over each cell's four corners for display; exports retain raw nodal
values. **Export data · all fields** downloads the complete results ZIP: all field
histories, DC/1ω/2ω/3ω components, coordinates, terminal values, model and report.
DC results hide the time charts; signed terminal voltage remains in the summary.

Solver includes an expandable **Detailed equations, boundary conditions and
numerical method** guide: constitutive laws, charge/energy conservation, Joule,
Peltier/Thomson coupling, interface and boundary conditions, DC/phasor conventions,
and the actual finite-volume link/BDF2/Picard discretization used in this code.

Profile regressions: `node --test tests/profiles.test.cjs`. Three new tests verify
analytical DC Seebeck profiles, sample/axis indexing and instantaneous vector
magnitude at cell centers. Together with worker/export checks, 12 focused checks
passed (`profile-validation.txt`). Browser interaction testing is still pending.

## DC controls, shared equation report and mesh feedback

Selecting electrical DC zeros and disables electrical AC peak/phase. Thermal AC remains independent. Returning to harmonic mode keeps zero until the user enters a new
excitation. The detailed equation guide lives in src/equations.js and is shared
by the Solver view and two always-included report pages (PDF and ZIP report.html).
Apply mesh is disabled when geometry matches the applied mesh. A valid pending
geometry edit triggers one brief highlight and enables the button; applying it
clears the pending state. Invalid inputs and running calculations keep it disabled.
Reduced-motion preferences suppress animation while keeping the active highlight.

13 targeted DC-control/profile/export/worker checks passed (minor-validation.txt).
The new report equation pages were rendered and visually inspected. Browser
animation/interaction testing is not claimed.

## Automatic Solver UI

There is no second mode selector in Solver. With constant active inputs it displays
**DC stationary**, without frequency, step count or cycle budget. Nonzero active
AC electrical excitation or thermal forcing selects **Periodic** and reveals
exactly those three controls. The equation guide is available in both cases.
Choosing electrical DC does not erase thermal AC. Open-circuit electrical AC values
and ambient AC with h=0 do not activate periodic solving. Selecting AC electrical
input with amplitude zero still gives a stationary solution until active AC is set.
The derived mode is written into exported configurations and used when running.
Hidden periodic settings do not block DC validation. The programmatic solver API
continues to honor explicit configuration mode; automatic selection is a UI feature.

14 targeted controls/profile/worker/export tests pass; see
`automatic-solver-validation.txt`. Full browser interaction testing remains pending.

## Surface display and Cu/BiTe review

Large material input values use scientific notation (for example 5.8E7); unchanged
inputs retain full raw precision. Tabs have larger labels without number prefixes.
Geometry order is Width X, Width Y, Elements X, Elements Y, out-of-plane depth.

The default layered example is deliberately asymmetric along X: copper and BiTe
have different conductivities, the left edge is fixed at 300 K, and the right edge
uses convection. The Y temperature variation is below 1E-7 K in the regression.
Almost-zero DC current arrows formerly magnified numerical residue. Arrows now
hide values below 1E-8 of the strongest current harmonic, with a 1E-12 A/m² floor.
This is a visualization threshold only; raw numerical values remain in exports.

## Multifrequency sweep and Bode plots

In **Boundaries → Excitation**, choose **AC · multifrequency sweep**. Enter the
minimum and maximum frequency (Hz), number of points, and logarithmic or linear
spacing. Both endpoints are included. At least one active electrical or thermal
AC input must be nonzero. All active AC inputs share the swept frequency; their
amplitudes, phases and DC biases remain fixed. Thermal phase is now editable too.
The Solver tab shows **Periodic · frequency sweep** and the common time-step and
cycle-budget controls. Its single-frequency input is hidden.

Each frequency starts independently using the existing nonlinear periodic solver.
The progress line reports the current frequency, cycle and step. High frequencies
may require more cycles to establish the mean temperature; increasing the cycle
budget is different from increasing the time steps per period. Refine both time
and space resolution before interpreting small 2ω/3ω responses.

In Results, **Frequency sweep · Bode** offers:

- Terminal voltage/current, impedance, temperature, potential, Jx/Jy or qx/qy.
- Harmonics 1ω, 2ω or 3ω; impedance is restricted to 1ω.
- A spatial probe as X/Y percentages, snapped to the nearest node for T/V or
  containing cell for current/heat flux. The actual coordinates are shown.
- Phase reference: imposed electrical waveform, measured terminal current or
  voltage at 1ω, a thermal boundary waveform, or the time origin.
- Raw magnitude, division by the reference fundamental amplitude, or division by
  that amplitude raised to harmonic order n. Units follow the selected operation.
- Physical magnitude or 20 log10(module / positive dB reference). The dB reference
  has the same units as the chosen module; it is not implicitly dimensionless.
- Wrapped or unwrapped phase, and an adjustable raw-output phase threshold.

Relative phase is φ(output,n) − n φ(reference,1). An inactive or zero reference
cannot define a phase or normalized amplitude. A time-origin reference allows
raw amplitudes only. Unwrapping restarts after undefined/excluded values. Exactly
zero magnitude is not plotted in dB. Very small phases are not reliable simply
because they fall above the chosen display threshold.

The solver stores terminal voltage as V(sink) − V(source), while positive current
enters the source. Therefore physical impedance is **−Vterminal,1 / Iterminal,1**:
a passive Ohmic resistor has positive real impedance and zero phase. Raw terminal
voltage retains the original sign convention. Higher-order ratios are nonlinear
responses, dependent on drive amplitude; they are not linear transfer functions.
Several simultaneous excitations produce a combined response, not an isolated
transfer function for each source. Complex vector components are offered rather
than assigning an ambiguous phase to a vector magnitude.

Click a curve point or use **Map / report frequency** after computation to inspect
its maps. **Stop** retains completed frequencies and the last complete cycle, if
available, of the interrupted frequency. Unconverged points remain inspectable and
exportable but are excluded from Bode. A failed frequency stops the sweep and
preserves preceding results. A new successful run replaces the previous run.

**Export Bode CSV** saves physical modules, phases, actual probe coordinates and
point status. **Export results JSON** saves the retained sweep. **Export data** /
complete ZIP saves every retained frequency's full fields, histories, harmonics,
CSV, SVG and report in separate folders, plus Bode CSV and its settings. The root
printable report contains Bode plus the selected-frequency detailed report;
individual-frequency full reports are in their folders. CSV stays in physical
units even when the graph uses dB. Only the last complete cycle at each frequency
is retained, not every startup cycle. Per-frequency model files reproduce a
single-frequency run; sweep-model.json reproduces the full sweep settings.

Sweeps allow 2–100 points with a conservative 256 MiB retained-data estimate.
Reduce points, mesh or samples when the estimate is exceeded; actual browser
memory and export overhead also depend on the environment.

Run automated tests with `node --test tests/*.test.cjs`.
Optional real-browser sweep checks: `node tests/sweep-browser.spec.cjs` (requires
Playwright and Chromium). Browser checks were not executed in this environment.
