# Thermoelectric Lab · 2D

Thermoelectric Lab solves coupled heat and charge transport in a planar 2D domain. You paint materials on a rectangular grid, place two electrodes, set the thermal condition of each side, and compute temperature T(x,y,t) and electric potential V(x,y,t) under DC, single-frequency AC or swept-frequency excitation. All computation runs locally in the browser, in a background worker.

## Running the application

The application folder contains:

- `index.html`: the application
- `assets/`: scripts and styles
- `lib/`: the material library (`index.json` and one JSON file per material)
- `tests/regression.cjs`: the Node regression suite

Serve the folder with any static web server and open `index.html`, for example `python3 -m http.server 8000` in the folder, then `http://localhost:8000/`. No internet connection is needed.

Opening `index.html` directly from disk also works, except for the material library: browsers do not let a page opened from disk read `lib/`, so **Select preset…** cannot load materials, and the thermoelectric module example uses its built-in copies of the library materials.

The interface has a dark and a light theme. It follows the system setting until you choose one with the header toggle, and remembers that choice.

## Workflow

1. **Geometry**: set the widths, element counts and out-of-plane depth, then **Apply mesh**. Paint cells with the selected material. The bars on the domain edges are the electrodes, labelled *source* and *sink*.
2. **Materials**: edit properties, add materials (up to 12), load presets from the library, or import a material JSON file.
3. **Boundaries**: choose the excitation, the electrical control mode, the electrode positions and the thermal condition of each side.
4. **Solver**: shows the solution method; periodic runs set the frequency, time steps per period and maximum cycles here.
5. **Run simulation**, then inspect **Results**.

**Run simulation** and **Export model** also apply pending mesh changes. Remeshing resamples the material map, so inspect material regions afterwards. Invalid inputs are highlighted and listed above the tabs; Run and Export stay disabled until they are corrected.

## Physical model

### Governing equations

T is absolute temperature (K), V electric potential (V), J current density and q total heat flux. Each material defines σ(T), k(T), α(T), density ρ and heat capacity Cp.

```
J = −σ(T) [∇V + α(T) ∇T]
∇·J = 0
q = α(T) T J − k(T) ∇T
ρ Cp ∂T/∂t = −∇·q − J·∇V
```

Within a smooth homogeneous material these equations give

```
ρ Cp ∂T/∂t = ∇·(k ∇T) + |J|²/σ − T (dα/dT) J·∇T
```

where the last two terms are Joule and Thomson heating. Π = αT is the Peltier coefficient; discontinuities in α at material interfaces produce Peltier transport through q. Joule, Peltier and Thomson effects are all contained in the total flux and must not be added a second time.

### Material laws

Properties are referenced to 300 K:

```
ρe(T) = [1 + β (T − 300)] / σ300      electrical resistivity
α(T)  = α300 + α′ (T − 300)          Seebeck coefficient
```

Density, heat capacity and thermal conductivity are constant. Materials are isotropic. σ, k, ρ and Cp must remain strictly positive at 300 K and at the extreme prescribed temperatures of the model.

### Boundary and interface conditions

Electrical:

- The two electrodes are equipotential contacts on the domain edge; the source is at 0 V. All other edges are insulated (J·n = 0).
- **Total current**: the current entering the source (A). The sink voltage adjusts to deliver it. Current density may vary across an electrode.
- **Sink voltage**: V(sink) is prescribed (V).
- **Open circuit**: zero net terminal current.
- The terminal voltage is V(sink) − V(source). Positive current enters at the source and leaves at the sink.
- Electrode ranges are given in % along the edge, bottom→top on vertical edges and left→right on horizontal edges. Each electrode needs at least two boundary nodes, and the electrodes must not share a node.

Thermal, for each side (n is the outward normal):

- **Temperature**: T is prescribed (K).
- **Outward total flux**: q·n is prescribed (W/m², positive outward, including Peltier transport). Zero flux is adiabatic.
- **Convection**: q·n = h (T − Tambient); the entered value is the ambient temperature (K). A side with h = 0 is inactive.

Fixed-temperature sides that meet at a corner must have identical waveforms. A steady problem needs a thermal anchor: a temperature side, or convection with h > 0.

Interfaces are ideal: T, V, normal J and normal total q are continuous, with no contact resistance. Peltier coupling changes the conductive-flux balance at an interface, qcond,right − qcond,left = −Jn T (αright − αleft); T stays continuous while its slope changes.

### Excitation and harmonics

Every electrical and thermal input has the form `b + A cos(2πft + φ)`: DC bias b, AC peak A and phase φ in degrees. One frequency f applies to all inputs.

- **DC · constant electrical drive** solves the stationary problem (∂T/∂t = 0) using only the DC biases. It disables the electrical AC peak and phase but keeps their values for when AC is selected again.
- **AC · single frequency** integrates in time until the solution is periodic.
- **AC · multifrequency sweep** repeats the periodic solution over a list of frequencies (see *Frequency sweeps and Bode analysis*).
- A nonzero thermal AC peak selects the periodic solver even with DC electrical drive.
- In periodic runs, prescribed and ambient temperatures must stay above 0 K for the whole cycle (DC > |AC peak|).

The nonlinear time-domain solution is described by peak phasors (not RMS) of the last complete cycle:

```
u(t) = U0 + Re[ Σ Un exp(i n ω t) ],   n = 1, 2, 3
```

U0 is the signed DC mean. Re and Im are the signed components of Un; Im multiplies −sin(nωt). Instantaneous fields use the stored time samples, which contain all resolved harmonics, not only DC to 3ω.

### Planar 2D and scope

The out-of-plane depth is constant throughout the domain. It converts current density to amperes and heat flux to watts, and Ly × depth is the cross-section of a 1D reduction. For the transverse-uniform 1D limit along x, set Ny = 1, use full left/right electrodes and zero top/bottom flux.

Not modelled: contact resistance, electrical capacitance or inductance, radiation, convection inside the domain, front/back surface heat loss and anisotropic properties.

## Numerical method

**Discretization.** Conservative, grid-aligned nodal control volumes on a uniform mesh of Nx × Ny rectangular cells with (Nx + 1)(Ny + 1) nodes. Each cell contributes four half-face links. For a link a→b of length L and half-face area A:

```
g   = A / [L · mean(ρe(Ta), ρe(Tb))]
Iab = g [Va − Vb − αmean (Tb − Ta)]
Qab = αmean (Ta + Tb) Iab / 2 − kmean A (Tb − Ta) / L
```

Electrical work Iab(Va − Vb) is shared equally between the two nodes. Each cell's heat capacity is split among its four corners.

**Electrical problem.** The potential is the superposition of a solution with both electrodes at 0 V (Seebeck sources only) and a unit solution with the sink at 1 V. Terminal currents follow from reciprocity over the whole domain, which keeps them accurate where highly conductive contacts meet resistive regions.

**Linear systems.** Matrix-free conjugate gradients with Jacobi preconditioning, relative tolerance 2·10⁻¹² in the Jacobi-weighted residual norm, warm-started from the previous solution.

**Nonlinear coupling.** The electrical and thermal problems are coupled by Picard iteration, undamped first. If an undamped step fails or stops contracting, it is repeated with damping 0.85; after three such fallbacks the run stays damped. A step is accepted when the temperature update is ≤ 2·10⁻⁹ K and the normalized heat-balance residual is ≤ 1.

**Time integration.** BDF2 after one backward-Euler startup step, with 64 to 1024 steps per period.

**Periodic convergence.** A run converges, at the earliest in its third cycle, when the combined error is ≤ 1. The combined error is the largest of:

- the change of the temperature history between successive cycles, relative to 2·10⁻⁷ K + 10⁻¹⁰·|T|;
- the change of the terminal DC to 3ω phasors, relative to 10⁻¹² V (voltage) or 10⁻¹⁰ A (current) + 10⁻⁶·|U|;
- the normalized heat-balance residual.

Otherwise the run ends at the maximum cycle count (3 to 1000) as unconverged.

**Checkpoints.** The first and last cycles of a periodic run are always saved. Intermediate cycles are saved every 5 cycles or after one second, less often when saving would exceed about 10 % of the run time. **Stop** keeps the latest saved complete cycle, labelled unconverged and provisional.

**Result checks.** Results outside the operating range are rejected, never clipped: temperature 1 to 2000 K, |V| ≤ 10⁶ V, |I| ≤ 10⁶ A, |J| and |q| ≤ 10¹² SI units, power ≤ 10¹² W.

## Frequency sweeps and Bode analysis

- Frequencies run from a minimum to a maximum over 2 to 100 points, with logarithmic or linear spacing. Bias, amplitude and phase stay fixed, and every frequency starts independently with no shared transient history.
- A frequency that reaches the maximum cycle count is kept as an unconverged point and the sweep continues. Unconverged points are excluded from the Bode plots. A solver error stops the sweep. **Stop** keeps the completed points and the latest saved cycle of the current point.
- **Quantity**: terminal voltage (sink − source), terminal current, impedance, or the temperature, potential, Jx, Jy, qx or qy at a probe given in % of the width and height. Temperature and potential snap to the nearest node; J and q use the containing cell.
- **Impedance** is (V(source) − V(sink)) / I at 1ω.
- **Harmonic**: 1ω, 2ω or 3ω.
- **Reference** for phase and normalization: the electrical excitation, the measured terminal current or voltage at 1ω, the excitation of a thermal side, or the time origin cos(nωt). References that are inactive in the model are disabled.
- **Phase** = φ(output, n) − n·φ(reference, 1), wrapped to ±180° or unwrapped. It is shown only when the raw output amplitude exceeds the phase threshold.
- **Normalization**: raw, divided by the reference amplitude, or divided by the reference amplitude to the power n.
- **Representation**: Magnitude / Phase, or the Real / Imaginary parts of magnitude·exp(i·phase).
- **Magnitude scale**: physical units, or dB as 20·log₁₀(module / reference). dB applies to the magnitude only and is unavailable for Real / Imaginary.
- Clicking a point, or choosing **Map / report frequency**, shows the spatial results for that frequency.
- **Export Bode CSV** writes magnitudes in physical units (never dB) and phases.

## Results

- **Metrics**: terminal voltage (1ω peak amplitude and phase for periodic runs, the signed value for DC), temperature range, convergence and heat-balance diagnostics.
- **Spatial response**: maps of temperature, voltage, |J|, Jx, Jy, qx and qy at DC, 1ω, 2ω or 3ω, as Amplitude, Phase, Re or Im.
  - DC is the signed mean.
  - Temperature and voltage average the four complex nodal phasors of each cell before the representation is taken.
  - |J| is the vector norm √(|Jx|² + |Jy|²), not a harmonic of instantaneous |J|.
  - Phase maps grey out cells whose amplitude is at or below max(absolute threshold, 10⁻⁶ × field peak). The absolute thresholds are 10⁻⁷ K, 10⁻¹² V, and 10⁻⁹ SI units for J and q.
- **Current arrows** show the real current phasor at 0°: direction and relative magnitude. Vectors below 10⁻⁸ of the strongest current harmonic (or 10⁻¹² A/m²) are hidden.
- **Probe**: click the map to move it. Periodic runs plot its temperature and the terminal voltage over the saved cycle; DC runs show its coordinates, temperature and potential.
- **Spatial field · selected time**: the instantaneous field at any stored sample of the cycle.
- **Terminal harmonics**: DC to 3ω peak phasors of the terminal voltage, referenced to cos(ωt).

## Examples

| Example | What it shows |
|---|---|
| DC · Joule heating / spatial profile | 1D resistive bar (Ny = 1) carrying 0.2 A DC between two 300 K ends: the Joule heating profile. |
| Cu / BiTe · layered | Copper and BiTe in series, driven by 0.1 A at 2 Hz: Peltier heat at the interface and the harmonic temperature response. |
| Narrow contact · current spreading | 0.1 A DC entering through the middle half of the left edge and spreading into the domain. |
| Homogeneous · Joule 2ω | Resistive block driven by 1 A at 2 Hz: Joule heating at DC and 2ω. |
| Nonlinear resistance · 3ω | β = 0.01 K⁻¹ with 0.2 A: the temperature-dependent resistance produces a 3ω voltage. |
| Open circuit · Seebeck DC | α = 200 µV/K between 300 K and 350 K in open circuit: the Seebeck voltage. |
| Thermoelectric module · Bi₂Te₃ n/p couple | A single thermoelectric couple as in a Peltier module (below). |

### Thermoelectric module example

A 2D cut through the middle of one Bi₂Te₃ couple, with a depth of 1.4 mm and 25 × 34 cells of 0.2 mm × 0.1 mm:

- alumina plates 0.6 mm thick, copper leads and strap 0.3 mm thick, n and p legs 1.4 mm wide and 1.6 mm high, separated by a 1 mm air gap;
- current enters the left copper lead, rises through the n leg, crosses the top strap and returns down the p leg to the right lead, so the legs are electrically in series and thermally in parallel;
- default setup: a Peltier cooler at 4 A DC, with the bottom plate on a 300 K heat sink and the top plate insulated;
- as a generator: bottom 350 K, top temperature 300 K, open circuit.

The materials are loaded from `lib/Bi2Te3.json`, `lib/Bi2Te3_n_type.json`, `lib/Copper.json`, `lib/Alumina.json` and `lib/Air.json`. If a file is missing or unsuitable for its role (legs need the right Seebeck sign, copper must conduct, plates and gap must insulate), a built-in copy with the same values is used. The model description states which source was used. A real module repeats this couple; voltage and heat pumping scale with the number of couples.

## Material library

`lib/index.json` lists the files offered under **Materials → Select preset…**: Air, Alumina, Aluminum, Bi2Te3, Bi2Te3_n_type, Copper, Gold, PbTe and Platinum. Each file documents its values in `notes` and `sources`. The n-type Bi₂Te₃ is illustrative: the p-type benchmark values with the Seebeck sign reversed.

Material file format:

```json
{
  "format": "TE_2D_material",
  "version": 1,
  "referenceTemperature": 300,
  "units": { "rho": "kg/m^3", "Cp": "J/(kg K)", "k": "W/(m K)", "sigma": "S/m",
             "alpha": "V/K", "beta": "1/K", "alphaSlope": "V/K^2" },
  "material": {
    "name": "Example", "rho": 7740, "Cp": 154.4, "k": 1.6, "sigma": 110000,
    "alpha": 0.0002, "beta": 0, "alphaSlope": 0, "color": "#73d8d0"
  },
  "notes": "Assumptions and validity.",
  "sources": [ { "url": "https://…", "properties": "Which values come from this source." } ]
}
```

- Values are in SI units: α in V/K and α′ in V/K². The editor displays them in µV/K and µV/K².
- rho, Cp, k and sigma must be positive. beta and alphaSlope default to 0.
- The name has 1 to 200 characters, the colour is `#RRGGBB`, and `referenceTemperature`, if present, must be 300.
- A bare material object without the wrapper is also accepted.

**Add material json** imports such a file (up to 64 KB). To offer a material under **Select preset…**, place its file in `lib/` and list it in `lib/index.json`.

## Models, projects and exports

**Export model / Import model.** The model as JSON, up to 2 MB, with scalar material values and 64, 128, 256, 512 or 1024 steps per period.

**Save project / complete results ZIP** (Results → Export). The archive holds everything needed to reopen the results. **Import Project** (left of Import model) restores:

- the model and all retained results;
- sweep points and the selected frequency;
- the probe, field, harmonic, representation, arrows and time position;
- the Bode settings, including the representation.

Results can be inspected and exported without recalculation, and the model can be edited and run again. Import the ZIP as downloaded; do not extract it first.

Project ZIP contents:

- `project.json`: format metadata and the saved view.
- Single run:
  - `model.json`, `results.json` (full precision), `report.html`, `figures/*.svg`;
  - CSV files `nodes`, `cells`, `terminal`, `terminal_harmonics`, `histories/*` and `harmonics/*`;
  - `manifest.json`, `README.txt`.
- Sweep:
  - `sweep-model.json`;
  - `sweep-status.json`, with the requested and retained frequencies and the Bode settings;
  - `bode.csv`, and `report.html` with the Bode summary followed by the selected frequency;
  - one `frequency-NNN/` folder per retained point, containing the single-run files;
  - `README.txt`.

Export rules:

- Exports contain the computed model, not later input edits. After any input change, exports are disabled until the next run, including while browsing sweep points.
- Periodic results hold only the last saved complete cycle.
- Unconverged and stopped results stay labelled provisional, and importing never resumes a calculation.
- ZIP entries are stored without compression.

Import requirements:

- Import accepts project ZIPs containing `project.json` (format `thermoelectric-lab-project`, version 1), stored or Deflate-compressed. Deflate requires browser support for raw Deflate decompression.
- Encrypted, split and ZIP64 archives, and results ZIPs without `project.json`, are rejected.
- Limits: 2 GiB per archive, 256 MiB of JSON, and the retained-data budget.
- Archived HTML and scripts are never executed.

Other exports:

- **Full PDF report** opens a printable report; allow pop-ups, then choose **Save as PDF / Print**.
  - It covers model and convergence, materials and boundary conditions, the terminal spectrum and probe, the equations, and every field map in every representation.
  - Sweep reports start with a Bode summary that follows the selected representation.
  - Reports use a fixed paper palette regardless of the interface theme.
- **Export results JSON**: the displayed result, or the whole sweep.
- **Spectrum CSV**: terminal voltage phasors from DC to 3ω.
- **Export data · all fields**: the project ZIP.
- **Export Bode CSV**: see *Frequency sweeps and Bode analysis*.

## Limits

- Mesh: Nx ≥ 2, Ny ≥ 1, at most 1600 nodes.
- 1 to 12 materials.
- Steps per period 64 to 1024; maximum cycles 3 to 1000; sweeps of 2 to 100 points.
- Retained periodic data for all sweep points together must fit an estimated 256 MiB.

## Tests

With Node.js 24 or newer, run `node tests/regression.cjs`. The suite covers solver smoke cases, worker encoding and decoding, spatial phasors, display-state handling, project round trips, rejection of results ZIPs without `project.json`, and malformed archive rejection. UI tests use DOM and canvas test doubles.
