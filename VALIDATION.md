# Validation of the 2D conversion

80 automated tests passed under Node.js v24.19.0. The raw run is in `validation.txt`.
The tests use the same numerical core shipped in assets/core.js and the embedded worker.

| Check | Acceptance |
|---|---|
| Volume / capacity | Summed control volumes and material-weighted capacities match the domain |
| Manufactured 2D Poisson | Quadratic solution T=300+c(x²+y²), error <1e-6 K |
| Full electrodes | Uniform current and analytical resistance; horizontal and vertical orientations |
| Partial electrode | Nonzero transverse current; equipotential contacts; interior Kirchhoff residual <1e-9 A |
| Series materials | Analytical total resistance with a grid-aligned interface |
| Interface capacity | Contributions from both materials retained |
| Seebeck | Open-circuit analytical voltage and linear temperature |
| Open-circuit loops | Zero terminal current with nonzero internal currents in a heterogeneous 2D model |
| Joule DC | Analytical parabola in the transversely uniform limit; energy residual <1e-8 W |
| Peltier interface | Analytical junction temperature; energy balance |
| Boundary Peltier | Analytic solution with zero total thermal flux at one boundary |
| Convection | Analytical terminal temperatures and energy balance |
| True 2D steady heat | Uniform Joule source, all four sides held at 300 K; comparison with a double sine series |
| Spatial convergence | 8×8 to 16×16 cells: center error reduced below 35%; fine error <0.002 K |
| True 2D 2ω heat | Complex double sine-series solution, relative tolerance 3% plus 1e-4 K on a 10×10 mesh |
| 1D nonlinear regression | 2D extrusion reproduces the corrected 1D BDF2 model, including 3ω voltage, within 0.8% +2e-11 V |
| Thomson | alpha=b log(T/300), constant tau=b; agreement with exact 1D limit |
| Heat-flux sign | Analytical vertical profile with inward top flux |
| Temporal convergence | 64→128→256 steps: successive 2ω discrepancy reduced below 40% |
| Error handling | Bad mesh, overlapping contacts, contradictory corner temperatures, unanchored steady problem and nonconverged periodic state rejected |
| Packaging | Five tab panels, no external script/style resources, complete embedded sources |
| Worker | Real 2D partial-contact calculation and explicit material-error delivery |

## Genuine 2D analytical reference

For a homogeneous rectangular plate with temperature Tb imposed on all four
sides, uniform volumetric source Q, dimensions Lx/Ly, and volumetric capacity c,
the complex temperature response at angular frequency Omega is:

```
T_hat(x,y) = sum over positive odd m,n of
    [16 Q / (pi² m n)] * sin(m*pi*x/Lx) * sin(n*pi*y/Ly)
    / [k*pi²*(m²/Lx² + n²/Ly²) + i*Omega*c]
```

For DC, take Omega=0 and add Tb. For pure sinusoidal current with constant
conductivity and alpha=0, the Joule source has equal DC and 2ω amplitudes
Q=Jpeak²/(2 sigma). This gives a 2D harmonic reference independently of the code's
matrix construction. The tests sum odd modes through 101 in both directions.

The spatial refinement test uses the constant-current DC source. The harmonic
check uses an AC current and compares both real and imaginary components at the
center, with all sides thermally clamped. This is not a 1D-only validation.

## Regression against the earlier 1D app

`tests/reference_1d.json` was generated from the earlier corrected 1D JavaScript
solver at 2 Hz, 10 spatial cells and 256 steps per period. The material has
rho=2000 kg/m³, Cp=500 J/kg K, k=2 W/m K and temperature-dependent resistivity
`rhoe=1e-5*(1+.01*(T-300))`. Current amplitude is 0.2 A through a 1 mm² section.
Both end temperatures are 300 K.

The 2D regression extrudes this case across four transverse cells with insulated
transverse boundaries. It compares all temperature harmonics and the terminal
voltage, including 3ω. The fixture is included, so the 1D project is not required
to run the tests. The optional generator accepts the earlier project's loader:

```bash
node tests/generate_1d_reference.cjs /path/to/thermoelectric_browser/tests/load.cjs
```

## Example execution

The default 12×8 Cu/BiTe periodic example was also executed. Its configuration and
computed terminal spectrum are in `example-summary.json`. Execution time is
hardware-dependent and is not a browser performance guarantee. Small 3ω values
require resolution/tolerance studies for the intended application.

## Browser verification status

Numerical code and exact embedded-worker execution passed. Full browser layout,
canvas interactions, keyboard navigation, file downloads and cancellation were
not exercised in an actual browser here because a browser executable was unavailable.
The supplied optional smoke test can be run when Playwright and Chromium exist:

```bash
npm install --no-save playwright
npx playwright install chromium
node tests/browser.spec.cjs
```

That browser test is not counted among the 80 passed tests. It covers tab switching,
a Seebeck run, a nonlinear harmonic run, result export, cancellation, page errors
and a narrow viewport.

## Scope of validation

Conservation and analytical limits are checked on the cases above; this is not
experimental validation or proof of accuracy for all parameter combinations.
Refine grid/time resolution and verify physical property ranges for your model.
Perfect interfaces and grid-aligned material regions are assumptions. Boundary
contact singularities and tiny painted regions particularly need spatial refinement.


## UI update: number formatting and editable element counts

Five new focused checks passed, plus the three embedded-worker checks rerun on the
updated HTML. Results are in `ui-fix-validation.txt`. No numerical-core changes
were made, so the earlier solver validation remains applicable.

- Decimal artifacts are rounded for display; very small nonzero signals remain visible.
- Unchanged formatted inputs retain their full original numerical value.
- A 20×10 remesh produces 200 elements and 231 solver nodes, retaining the layered map.
- Dimension-only edits retain painted cell assignments and change physical dimensions.
- Invalid edits do not mutate the original model; the 1600-node limit is checked.

Full visual browser testing remains unexecuted; the optional browser test now also
checks mesh editing and the displayed element/node counts.

## Physical-input validation update

The complete 49-test suite was rerun after adding shared validation and runtime
finite-value guards. All tests passed; see `validation.txt`. The 20 new tests in
`tests/validation.test.cjs` exercise zero/negative/nonfinite dimensions, geometry
underflow/overflow, nonpositive material properties, temperature-waveform minima,
convection, signed electrical/thermal signals, time and mesh counts, electrode
coverage/overlap, shared-corner consistency, temperature-dependent laws, capacity
and forcing overflow, solver settings, and malformed imports.

The form now highlights invalid inputs and blocks Apply, Run and Export. The
optional browser test includes depth and conductivity rejection/recovery checks;
these browser interaction checks have not been executed here. Numerical/schema
checks and embedded-worker tests are executed, not inferred from HTML attributes.

## Progress and retained results

The full 50-test suite passes after adding worker checkpoints. The new worker test
receives step progress and a full first-cycle result, terminates the worker, and
checks retained fields, harmonics, configuration and `converged: false`. Existing
analytical/convergence tests still pass. Browser layout and live timer interactions
remain unverified in an actual browser in this environment.

## Follow-up critical-error review

All 54 tests pass on the rebuilt package. New regressions cover omitted convection
h, invalid linear options, convergence on the final permitted iteration, invalid
conductance with all nodes fixed, and honest plotting of unconverged histories.
The review also adds finite-value guards for derived fields and terminal totals,
preserves harmonic representation selection across DC views, and exports the
absolute start time of each saved cycle. Existing analytical thermoelectric and
harmonic tests pass unchanged. This review does not establish absence of all bugs;
full browser interaction testing and experimental validation remain outstanding.

## Single-row / 1D reduction

Ny = 1 is accepted by the form, remesher, configuration validation and mesh.
Four additional tests cover single-row remeshing and invalid Ny values, analytical
Seebeck voltage, a Peltier material interface, and nonlinear DC/1ω/2ω/3ω agreement
with the independent 1D reference. All 58 tests pass. The one-row reduction uses
full left/right contacts and adiabatic top/bottom boundaries. Ly and depth still
set the positive physical cross-section; this is not a zero-height mesh.

## Full report and results archive

Four additional automated checks cover periodic/steady report contents, escaped
material names, field/history CSV row counts, lossless JSON, UTF-8 ZIP names,
binary/empty ZIP entries, ZIP headers and CRC. All 62 tests pass. A real periodic
sample produced a 70-entry archive; Python zipfile verified every CRC and the
model/results round trip. Its HTML report rendered to 16 A4 pages with WeasyPrint
for print-layout inspection. This verifies document rendering, not the browser's
popup/print/download interaction, which remains unexecuted in this environment.

## Reported startup syntax error

The reported error was not reproduced in the retained ZIP: its scripts parsed
correctly, and its line numbers differed from the failing file. The build now
compiles each source and each final inline script, escapes HTML-sensitive script
sequences, and executes the first script to verify TE initialization before writing
the output. All nine startup/worker/export checks passed. An independent HTML5
parser also extracted three complete scripts, each accepted by the JS parser.
Browser installation was blocked by truncated download responses; actual browser
startup remains unverified. Build marker: export-startup-check-1.

## Exact uploaded-file investigation

The attached index(5).html was byte-identical to export-startup-check-1 (SHA-256
5fad1b6960145c45493ad19c67f024b3259a726551b6b4a15d68e440fea88d4c).
All three extracted scripts compiled; the original browser failure remains
unreproduced. As a compatibility workaround, separate-scripts-2 moves executing
JavaScript out of HTML into four local assets and preserves the first startup
error visibly. All nine packaging/worker/export checks pass for this build.
No solver equations were changed. This is not a claim of verified browser repair.

## DC / spatial-profile update

The numerical solver is unchanged. Three new profile regression tests pass:
analytical 1D DC temperature/voltage, exact time-sample and Y-cut indexing, and
cell-center instantaneous vector magnitude. The 12 profile/packaging/worker/export
checks passed after rebuilding; see profile-validation.txt. UI additions include
synchronized DC selection, a DC preset, spatial cuts and sample selection, and
an expandable guide documenting the implemented equations. Browser interactions
are not claimed as tested.

## DC controls, shared equation report and mesh feedback

Selecting DC now zeros and disables electrical AC peak/phase and thermal AC
amplitudes. Returning to harmonic mode keeps zero until the user enters a new
excitation. The detailed equation guide lives in src/equations.js and is shared
by the Solver view and two always-included report pages (PDF and ZIP report.html).
Apply mesh is disabled when geometry matches the applied mesh. A valid pending
geometry edit triggers one brief highlight and enables the button; applying it
clears the pending state. Invalid inputs and running calculations keep it disabled.
Reduced-motion preferences suppress animation while keeping the active highlight.

13 targeted DC-control/profile/export/worker checks passed (minor-validation.txt).
The new report equation pages were rendered and visually inspected. Browser
animation/interaction testing is not claimed.

## Automatic mode selection

14 targeted checks pass after removing the duplicate selector. Tests exercise
stationary/periodic visibility, electrical DC zeroing without thermal AC loss,
thermal-only periodic forcing, open-circuit drive suppression and h=0 convection.
The source UI functions are tested with controlled form elements, not a real
browser. All local script assets are compiled and worker/export checks pass.

## Surface UI and layered example review

The complete 70-test suite passes (validation.txt). The numerical solver is unchanged.
Analytical Seebeck, Joule, Peltier, Thomson, 2D heat-flow, energy conservation,
spatial/time convergence and nonlinear 3ω regressions were rerun.
Two new tests cover selected-time 2D field extraction and the actual default
Cu/BiTe run: convergence, prescribed terminal current, transverse temperature
symmetry within 1E-7 K, and suppression of insignificant DC arrows.

An independent execution of that same default model measured a maximum transverse
temperature difference of 1.0842E-9 K, maximum DC current density of 1.6713E-6 A/m²,
and fundamental current density of 1E5 A/m² (layered-review.json).
The horizontal asymmetry is expected: different Cu/BiTe transport properties,
a fixed-temperature left boundary and a convection right boundary. Previously,
normalized arrows exaggerated numerical residue in the nearly-zero DC current.
The new display threshold changes no solver values or exported data.

DC summary voltage now retains its sign and no longer labels it as peak amplitude.
No actual-browser layout, download or interaction verification is claimed.

## Multifrequency / Bode update

All 80 automated tests pass on the rebuilt package (validation.txt). Ten added
checks cover endpoint-inclusive frequency grids and input/memory limits, impedance
sign, n-times reference phase, normalization, inactive references, phase unwrapping,
probe selection, actual multifrequency Ohmic solutions, preserved points on failure,
complete per-frequency exports and shared equation reports, stop/checkpoint state,
built UI wiring, and the embedded worker finishing or stopping between frequencies.
Existing analytical Seebeck/Peltier/Thomson, nonlinear 3ω, conservation and convergence
tests were rerun unchanged. The numerical solver equations and time integrator are
unchanged; the sweep executes independent periodic solutions.

A Playwright launch was attempted, but the Chromium executable is absent. Thus
real-browser visual/interaction checks remain unexecuted. An additional optional
sweep-browser.spec.cjs covers the sweep form, Bode controls, point selection, PDF
popup, CSV/ZIP downloads and narrow layout when Chromium is available.
