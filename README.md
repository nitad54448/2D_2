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

- The two electrodes are equipotential contacts on the domain edge; the sink is grounded at 0 V. All other edges are insulated (J·n = 0).
- The terminal voltage is U = V(source) − V(sink), and the terminal current I enters at the source and leaves at the sink. This is the passive sign convention: a resistor gives U = R·I, and the absorbed electrical power is U·I.
- **Total current**: I is prescribed (A). The terminal voltage adjusts to deliver it. Current density may vary across an electrode.
- **Terminal voltage**: U is prescribed (V).
- **Open circuit**: zero net terminal current.
- The external leads are ideal conductors with zero Seebeck coefficient. U is therefore measured against an α = 0 reference, and an electrode on thermoelectric material exchanges the contact Peltier heat α·T·I with its lead: heat is absorbed where positive current enters a material with α > 0 and released where it leaves. On a side with a flux or convection condition this heat stays in the domain.
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

**Electrical problem.** The potential is the superposition of a solution with both electrodes at 0 V (Seebeck sources only) and a unit solution with the source at 1 V and the sink at 0 V. Terminal currents follow from reciprocity over the whole domain, which keeps them accurate where highly conductive contacts meet resistive regions.

**Linear systems.** Matrix-free conjugate gradients with Jacobi preconditioning, relative tolerance 2·10⁻¹² in the Jacobi-weighted residual norm, warm-started from the previous solution.

**Nonlinear coupling.** The electrical and thermal problems are coupled by Picard iteration, undamped first. The Peltier and Thomson heat of each node has the exact form −T·c, with c computed from the link currents. Where c > 0 (Peltier cooling) this term is treated implicitly on the matrix diagonal: the matrix stays symmetric positive definite, the converged solution is unchanged, and the iteration does not oscillate at high current as it would with a lagged cooling term. In the thermoelectric module example the steady solution converges in 5 to 8 iterations up to at least 20 A. If an undamped step fails or stops contracting, it is repeated with damping 0.85; after three such fallbacks the run stays damped. A step is accepted when the temperature update is ≤ 2·10⁻⁹ K and the normalized heat-balance residual is ≤ 1. If the update has converged but the heat balance has not, the next thermal solve uses a 100× tighter conjugate-gradient tolerance. This matters with small time steps, where the linear tolerance, relative to heat capacity × absolute temperature, is looser than the heat-balance test.

**Time integration.** BDF2 after one backward-Euler startup step, with 64 to 1024 steps per period. With N steps per period, BDF2 shifts the effective frequency of harmonic n by about (2πn/N)²/3: 0.3 % at 1ω and 3 % at 3ω with 64 steps, 0.02 % and 0.2 % with 256. Use at least 256 steps for 3ω results.

**Periodic convergence.** A run converges, at the earliest in its third cycle, when the combined error is ≤ 1. The combined error is the largest of:

- the change of the temperature history between successive cycles, relative to 2·10⁻⁷ K + 10⁻¹⁰·|T|;
- the change of the terminal DC to 3ω phasors, relative to an absolute tolerance plus 10⁻⁶·|U|. For the current the absolute tolerance is 10⁻¹⁰ A. For the voltage it is αmax·2·10⁻⁷ K, at least 10⁻¹² V, where αmax is the largest Seebeck coefficient of the model (4·10⁻¹¹ V for Bi₂Te₃): a temperature change at the temperature tolerance moves the terminal voltage by about that much. The value used is reported with the diagnostics;
- the normalized heat-balance residual.

Otherwise the run ends at the maximum cycle count (3 to 1000) as unconverged.

**Cycle extrapolation.** The approach to the periodic state is dominated by the slowest thermal mode, so successive cycle-start states differ by d(k) ≈ λ·d(k−1). When three successive cycle starts show 0 < λ < 0.995 with nearly parallel drifts (cosine > 0.999), the cycle start is moved to the extrapolated limit, by d·λ/(1 − λ) (at most 200·d), and the preceding step is shifted by the same amount so BDF2 continues smoothly. The jump only changes a starting state: convergence is still tested on two unextrapolated cycles with unchanged tolerances, the last two cycles of the budget are never extrapolated, and a jump that would leave the operating range or the validity of a material law is skipped. Without a periodic state (no thermal anchor and a net heat input), the drift does not decay and no jump is made. In the RC example, 30 Hz converges in 6 cycles and 300 Hz in 24; without extrapolation they need 123 and 890 cycles for the same impedance to 7 digits. The number of extrapolations is reported with the diagnostics.

**Checkpoints.** The first and last cycles of a periodic run are always saved. Intermediate cycles are saved every 5 cycles or after one second, less often when saving would exceed about 10 % of the run time. **Stop** keeps the latest saved complete cycle, labelled unconverged and provisional.

**Result checks.** Results outside the operating range are rejected, never clipped: temperature 1 to 2000 K, |V| ≤ 10⁶ V, |I| ≤ 10⁶ A, |J| and |q| ≤ 10¹² SI units, power ≤ 10¹² W.

## Frequency sweeps and Bode analysis

- Frequencies run from a minimum to a maximum over 2 to 100 points, with logarithmic or linear spacing. Bias, amplitude and phase stay fixed, and every frequency starts independently with no shared transient history.
- A frequency that reaches the maximum cycle count is kept as an unconverged point and the sweep continues. Unconverged points are excluded from the Bode plots. A solver error stops the sweep. **Stop** keeps the completed points and the latest saved cycle of the current point.
- **Quantity**: terminal voltage (source − sink), terminal current, impedance, or the temperature, potential, Jx, Jy, qx or qy at a probe given in % of the width and height. Temperature and potential snap to the nearest node; J and q use the containing cell.
- **Impedance** is U/I = (V(source) − V(sink)) / I at 1ω.
- **Harmonic**: 1ω, 2ω or 3ω.
- **Reference** for phase and normalization: the electrical excitation, the measured terminal current or voltage at 1ω, the excitation of a thermal side, or the time origin cos(nωt). References that are inactive in the model are disabled.
- **Phase** = φ(output, n) − n·φ(reference, 1), wrapped to ±180° or unwrapped. It is shown only when the raw output amplitude exceeds the phase threshold.
- **Normalization**: raw, divided by the reference amplitude, or divided by the reference amplitude to the power n.
- **Representation**: Magnitude / Phase, or the Real / Imaginary parts of magnitude·exp(i·phase).
- **Magnitude scale**: physical units, or dB as 20·log₁₀(module / reference). dB applies to the magnitude only and is unavailable for Real / Imaginary.
- Clicking a point, or choosing **Map / report frequency**, shows the spatial results for that frequency.
- **Export Bode CSV** writes magnitudes in physical units (never dB) and phases.

## Results

- **Metrics**: terminal voltage U = V(source) − V(sink) (1ω peak amplitude and phase for periodic runs, the signed value for DC), temperature range, convergence and heat-balance diagnostics. Under current drive a resistor shows a phase near 0°; a thermoelectric element shows a small negative (capacitive) phase.
- **Spatial response**: maps of temperature, voltage, |J|, Jx, Jy, qx and qy at DC, 1ω, 2ω or 3ω, as Amplitude, Phase, Re or Im.
  - DC is the signed mean.
  - Temperature and voltage average the four complex nodal phasors of each cell before the representation is taken. Their colour scale spans the nodal values as well as the cell values, so its ends show the true extremes, such as a prescribed boundary temperature, which cell averages never reach.
  - |J| is the vector norm √(|Jx|² + |Jy|²), not a harmonic of instantaneous |J|.
  - Phase maps grey out cells whose amplitude is at or below max(absolute threshold, 10⁻⁶ × field peak). The absolute thresholds are 10⁻⁷ K, 10⁻¹² V, and 10⁻⁹ SI units for J and q.
- **Current arrows** show the real current phasor at 0°: direction and relative magnitude. Vectors below 10⁻⁸ of the strongest current harmonic (or 10⁻¹² A/m²) are hidden.
- **Probe**: click the map to move it. Periodic runs plot its temperature and the terminal voltage over the saved cycle; DC runs show its coordinates, temperature and potential.
- **Spatial field · selected time**: the instantaneous field at any stored sample of the cycle.
- **Terminal harmonics**: DC to 3ω peak phasors of the terminal voltage U = V(source) − V(sink), referenced to cos(ωt).

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
| RC circuit · thermoelectric impedance spectrum | A thermoelectric element with the impedance of an RC circuit, swept from 0.003 to 30 Hz (below). |

### Thermoelectric module example

A 2D cut through the middle of one Bi₂Te₃ couple, with a depth of 1.4 mm and 25 × 34 cells of 0.2 mm × 0.1 mm:

- alumina plates 0.6 mm thick, copper leads and strap 0.3 mm thick, n and p legs 1.4 mm wide and 1.6 mm high, separated by a 1 mm air gap;
- current enters the left copper lead, rises through the n leg, crosses the top strap and returns down the p leg to the right lead, so the legs are electrically in series and thermally in parallel;
- default setup: a Peltier cooler at 4 A DC, with the bottom plate on a 300 K heat sink and the top plate insulated;
- as a generator: bottom 350 K, top temperature 300 K, open circuit.

The materials are loaded from `lib/Bi2Te3.json`, `lib/Bi2Te3_n_type.json`, `lib/Copper.json`, `lib/Alumina.json` and `lib/Air.json`. If a file is missing or unsuitable for its role (legs need the right Seebeck sign, copper must conduct, plates and gap must insulate), a built-in copy with the same values is used. The model description states which source was used. A real module repeats this couple; voltage and heat pumping scale with the number of couples.

### RC circuit example: thermoelectric impedance spectrum

The application has no electrical capacitance: charge transport is resistive (∇·J = 0). A thermoelectric element nevertheless has the impedance of an RC circuit, because heat storage acts as a capacitor. This example builds such an element from two library materials, `lib/Bi2Te3.json` and `lib/Copper.json` (with built-in copies as for the module example), and computes its impedance spectrum.

**Structure.** A 1D stack along x (Ny = 1) with a 1 mm × 1 mm cross-section (Ly × depth), meshed with 0.05 mm cells:

| Part | Length | Role |
|---|---|---|
| Left end, source electrode | — | Heat sink at 300 K |
| Bi₂Te₃ layer | L = 0.2 mm (4 cells) | Electrical resistance and thermal resistance |
| Copper block | Lc = 1 mm (20 cells) | Heat capacity |
| Right end, sink electrode | — | Insulated (zero total flux) |

The drive is an AC current of 0.1 A peak with no DC bias, swept over 13 logarithmic points from 0.003 to 30 Hz, with 64 steps per period and at most 400 cycles. Loading the example sets the Bode quantity to **Impedance** and the representation to **Real / Imaginary**.

**How the RC arises.** The current I passes through the Bi₂Te₃ layer into the copper.

1. Peltier transport delivers heat α·T0·I to the copper block, where α is the Seebeck coefficient of Bi₂Te₃ and T0 = 300 K.
2. The copper conducts so well that it stays isothermal, at T0 + θ. It stores heat with capacity C_th and loses it back through the layer to the heat sink, through the thermal resistance R_th = L/(kA).
3. The temperature difference θ across the layer adds a Seebeck voltage α·θ to the ohmic drop.

The copper's own Seebeck coefficient drops out, for two reasons:

- At the Bi₂Te₃/copper junction the Peltier heat is (α − α_Cu)·T0·I. The insulated end has zero total heat flux, so the heat α_Cu·T0·I carried by the copper's current is deposited there. Together they give α·T0·I.
- The isothermal copper contributes no Seebeck voltage.

The element therefore behaves as Bi₂Te₃ measured against an α = 0 reference, which is how the application defines terminal voltages.

With θ the temperature rise of the copper, the energy balance and the terminal voltage are

```
C_th dθ/dt = α T0 I − θ / R_th
V(source) − V(sink) = R0 I + α θ
```

For a sinusoidal current, with phasors,

```
θ = α T0 R_th I / (1 + iωτ)

Z(ω) = R0 + R_TE / (1 + iωτ)

R0   = L/(σA) + Lc/(σ_Cu A)        ohmic resistance
R_th = L/(kA)                      thermal resistance of the layer
C_th = ρCp_Cu·Lc·A + ρCp·L·A/3     heat capacity (copper + one third of the layer)
R_TE = α² T0 R_th                  thermoelectric resistance
C_TE = C_th / (α² T0)              thermoelectric capacitance
τ    = R_th C_th = R_TE C_TE       time constant, corner frequency fc = 1/(2πτ)
```

This is the impedance of a resistor R0 in series with a parallel R_TE ∥ C_TE: the simple RC element of impedance spectroscopy, with the same form as an electrochemical cell without diffusion (series resistance plus charge-transfer resistance in parallel with the double-layer capacitance). The one third of the layer's heat capacity is the first-order correction for heat stored in the layer, whose temperature rises linearly from the heat sink to the junction.

Two limits have a physical meaning:

- **Z(0) = R0 + R_TE**: at low frequency the Seebeck voltage follows the Peltier heating fully.
- **Z(∞) = R0**: at high frequency the heat capacity holds the temperature constant, so only the ohmic resistance remains.

For the layer alone, R_TE / (L/σA) = α²σT0/k = ZT. Measuring the two limits therefore gives the figure of merit; this is the principle of ZT measurement by impedance spectroscopy and by the Harman method.

**Expected values** with the library properties (Bi₂Te₃: σ = 1.1·10⁵ S/m, k = 1.6 W/(m K), α = 200 µV/K, ρCp = 1.195·10⁶ J/(m³ K); copper: σ = 5.75·10⁷ S/m, ρCp = 3.45·10⁶ J/(m³ K)):

| Quantity | Value |
|---|---|
| R0 | 1.836 mΩ (1.818 mΩ layer + 0.017 mΩ copper) |
| R_th | 125 K/W |
| R_TE | 1.500 mΩ |
| ZT of the layer | 0.825 |
| C_th | 3.53·10⁻³ J/K |
| C_TE | 294 F |
| τ | 0.441 s |
| fc | 0.361 Hz |

The thermoelectric capacitance is huge because it is a thermal capacity divided by the small factor α²T0 = 1.2·10⁻⁵ V²/K.

**Reading the result.**

- **Real / Imaginary** (default):
  - Re(Z) falls from R0 + R_TE = 3.336 mΩ to R0 = 1.836 mΩ, crossing the midpoint at fc.
  - −Im(Z) peaks at R_TE/2 = 0.75 mΩ at fc.
  - Im(Z) is negative: the element is capacitive.
- **Magnitude / Phase**: |Z| steps down from 3.336 to 1.836 mΩ. The phase has its minimum of about −17° at fc·√(1 + R_TE/R0) ≈ 0.49 Hz.
- **Export Bode CSV** gives magnitude and phase at every frequency for fitting or for plotting −Im against Re (a semicircle of diameter R_TE starting at R0).

**Simulation versus the formula.** The computed spectrum agrees with Z(ω) within 0.02 % below 0.1 Hz and within 0.5 % at every frequency:

| f (Hz) | Simulated Z (mΩ) | Formula (mΩ) |
|---|---|---|
| 0.003 | 3.3355 − 0.0125i | 3.3355 − 0.0125i |
| 0.030 | 3.3251 − 0.1244i | 3.3253 − 0.1239i |
| 0.300 | 2.7187 − 0.7340i | 2.7224 − 0.7374i |
| 3.0 | 1.8658 − 0.1750i | 1.8570 − 0.1778i |
| 30 | 1.8450 − 0.0188i | 1.8358 − 0.0180i |

The remaining difference at high frequency is physical, not numerical: refining the mesh or the time steps leaves it unchanged. Above a few hertz, heat no longer spreads uniformly: the layer's diffusion time L²/a ≈ 0.03 s and the copper's heat penetration depth approach the frequency scale. A single RC cannot represent this distributed response, which adds a small, slowly decaying tail (the thermal analogue of a Warburg element).

The lumped model is accurate here because the example satisfies its assumptions:

- the copper's diffusion time Lc²/a_Cu ≈ 9 ms is much shorter than τ, so the copper is isothermal;
- the layer stores only about 7 % as much heat as the copper.

**Linearity.** At 0.1 A the copper temperature swings by at most α·T0·R_th·I = 0.75 K. Joule heating, I²R0 ≈ 18 µW at the current peak, raises the mean temperature by about 1 mK and appears only at DC and 2ω. The 1ω impedance is therefore independent of the amplitude as long as the temperature swing stays small compared with T0.

**Changing the circuit.** Edit the geometry or the Bi₂Te₃ properties; the uniform grid requires lengths that are whole numbers of cells.

| Change | Effect |
|---|---|
| Thicker Bi₂Te₃ (L) | R0, R_TE and τ increase in proportion. R_TE/R0 stays near ZT. |
| Longer copper block (Lc) | C_th, C_TE and τ increase; fc decreases. R0 barely changes. |
| Larger cross-section (A = Ly × depth) | Every resistance divides by A and C_TE multiplies by A; τ and fc do not change. |
| Different layer material | R_TE/R0 follows α²σT0/k; τ follows L·Lc·ρCp_Cu/k. |

**Run time and convergence.** Each frequency starts from 300 K and must reach a periodic state. Transients decay with τ, so low frequencies converge in the minimum of 3 cycles. At higher frequencies the slow transient spans many cycles (123 at 30 Hz), and cycle extrapolation removes it: every point of the sweep converges within 3 to 8 cycles, and the full sweep takes a few seconds in a browser. Frequencies well above 30 Hz still need somewhat more cycles (24 at 300 Hz); raise **Maximum cycles** if points come back unconverged.

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

**Export model / Import model.** The model as JSON, up to 2 MB, with `"version": 2`, scalar material values and 64, 128, 256, 512 or 1024 steps per period. Models with another version are rejected.

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

- Import accepts project ZIPs containing `project.json` (format `thermoelectric-lab-project`, version 2) with version-2 models, stored or Deflate-compressed. Deflate requires browser support for raw Deflate decompression.
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

With Node.js 24 or newer, run `node tests/regression.cjs` (29 checks, a few seconds). The suite covers solver smoke cases and the terminal sign convention, an ideal Peltier leg against its analytic solution, convergence of the module example beyond its optimum current, cycle extrapolation and the terminal-voltage tolerance, worker encoding and decoding, spatial phasors and colour-scale ranges, display-state handling, project round trips, model and project version checks, rejection of results ZIPs without `project.json`, malformed archive rejection, and agreement of the Solver-tab equations with the report guide. UI tests use DOM and canvas test doubles.
