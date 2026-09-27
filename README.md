# Thermoelectric Lab — 2D transport and nonlinear harmonics

Thermoelectric Lab is a local browser application for coupled electrical and
thermal transport in a rectangular, heterogeneous 2D domain. It resolves
stationary fields or a nonlinear periodic response, including Seebeck, Peltier,
Thomson and Joule effects. Calculations run in a Web Worker; plots and reports
are generated locally without external numerical libraries.

## Capabilities

| Area | Implemented capabilities |
|---|---|
| Geometry | Uniform rectangular mesh, cell painting, multiple materials and constant out-of-plane depth |
| Materials | 1–12 isotropic materials; editable reference properties, resistivity slope and Seebeck slope |
| Electrical control | Total current, prescribed sink voltage or zero net terminal current; partial equipotential contacts |
| Thermal control | Temperature, outward total heat flux or convection on each of four edges |
| Excitation | DC biases and sinusoidal inputs with independent amplitudes/phases at one shared frequency |
| Solvers | Nonlinear stationary solution or time integration to periodic convergence |
| Harmonics | Signed DC mean and complex peak phasors at 1ω, 2ω and 3ω |
| Sweeps | 2–100 independent periodic calculations, logarithmic or linear frequency spacing |
| Visualization | Harmonic maps, instantaneous maps, current arrows, temperature probe, voltage history and Bode curves |
| Data | Model import/export, result JSON, CSV, standalone SVG figures, printable reports and complete ZIP archives |

Presets illustrate DC Joule heating, Cu/BiTe layers, narrow-contact current
spreading, homogeneous Joule 2ω, nonlinear resistance 3ω and open-circuit Seebeck
voltage. Their material values are illustrative, not certified material datasets.
The default layered example has two regions; a Cu/BiTe/Cu stack can be painted
explicitly to study two interfaces.

## Physical model

The unknown fields are absolute temperature T(x,y,t) and electrical potential
V(x,y,t). The electrical problem is quasistatic: charge conservation is solved
at each thermal iteration, without electrical storage or electromagnetic dynamics.

```text
J = −σ(T) [∇V + α(T)∇T]
∇·J = 0
q = α(T) T J − k(T)∇T
ρ Cp ∂T/∂t = −∇·q − J·∇V
```

J is current density in A/m²; q is **total** heat flux in W/m², including
Peltier transport. Density ρ in kg/m³ is distinct from electrical resistivity
ρₑ = 1/σ in Ω·m. Internally, dimensions and exported physical quantities use SI
units. The geometry editor displays millimetres, and the Seebeck editor uses
µV/K and µV/K².

Within a smooth homogeneous material, the same equations imply:

```text
ρ Cp ∂T/∂t = ∇·(k∇T) + |J|²/σ − T (dα/dT) J·∇T
Π = αT                         Peltier coefficient
τ = T dα/dT                    Thomson coefficient
```

The Joule term is nonnegative for positive conductivity. Thomson heating or
cooling depends on the current direction, temperature gradient and Seebeck
slope. The implementation uses the conservative total-flux formulation;
additional Peltier or Thomson source terms must not be added to it.

### Material laws

The editor uses a reference temperature of 300 K:

```text
ρₑ(T) = [1 + β(T − 300)] / σ₃₀₀
σ(T)  = σ₃₀₀ / [1 + β(T − 300)]
α(T)  = α₃₀₀ + α′(T − 300)
```

| Editor property | Unit | Temperature dependence |
|---|---|---|
| Density ρ | kg/m³ | Constant |
| Heat capacity Cp | J/(kg·K) | Constant |
| Thermal conductivity k | W/(m·K) | Constant |
| Electrical conductivity σ₃₀₀ | S/m | Inverse-linear conductivity, equivalent to linear resistivity |
| Resistivity slope β | K⁻¹ | Coefficient in the resistivity law above |
| Seebeck coefficient α₃₀₀ | µV/K | Linear through α′ |
| Seebeck slope α′ | µV/K² | Constant derivative |

The denominator of σ(T) must remain positive throughout the actual solution.
The validator checks reference, initial and prescribed boundary temperatures;
property checks also run during the solve as interior temperatures evolve.

The source-level material API additionally accepts scalar values, `linear` and
`inverseLinear` law objects, or JavaScript property functions. These extensions
are not exposed by the editor. GUI JSON import accepts scalar reference
properties only; functions cannot be transported through the normal JSON/worker
workflow. The material API also provides Π, τ and ZT = α²σT/k evaluations.

### Geometry and interfaces

There are Nx × Ny material cells and (Nx + 1)(Ny + 1) temperature/potential nodes.
Coordinates run rightward in x and upward in y. Each cell contains one material;
interfaces are grid aligned. Out-of-plane depth is uniform, converting current
densities and fluxes to total amperes and watts. No front/back surface losses
are included.

Interfaces are perfect: T and V are continuous, as are normal current and total
normal heat flux in the continuum model. A discontinuity in α changes the
conductive heat-flux balance:

```text
q_cond,right − q_cond,left = −Jn T (α_right − α_left)
```

The temperature slope can change without a temperature jump. Opposite interfaces
in a Cu/BiTe/Cu stack have opposite Peltier signs for a fixed current direction.
Reversing current reverses Peltier heating/cooling; Joule heating remains positive.
For zero-bias AC current, inspect temperature at 1ω using real part or phase;
unsigned amplitude hides the sign, and DC shows the cycle mean.

A 1D-like reduction along x uses Ny = 1, materials uniform across y, full left/right
contacts and insulated top/bottom boundaries. Its cross-section is Ly × depth.

## Boundary conditions and sign conventions

Electrical source and sink contacts each occupy a selected interval on an edge.
Each must cover at least two mesh nodes, and the contacts cannot share a node.
Vertical-edge ranges run bottom to top; horizontal-edge ranges run left to right.
Selected nodes are equipotential; current density need not be uniform along a
contact. The remaining electrical boundary is insulated.

| Electrical mode | Constraint |
|---|---|
| Current | Prescribed total current entering the source; sink potential adjusts |
| Voltage | Prescribed sink potential, with source potential fixed at 0 V |
| Open circuit | Zero net terminal current; sink potential adjusts |

Stored terminal voltage is Vterminal = V(sink) − V(source). Therefore a passive
Ohmic resistor driven by positive source current has negative terminal voltage.
Absorbed electrical power is −Iterminal Vterminal. Open circuit enforces zero
**net** current at the contacts; it does not prohibit internal circulating currents
in heterogeneous thermoelectric configurations.

Each thermal edge has one condition over the whole edge:

| Thermal mode | Constraint |
|---|---|
| Temperature | T = prescribed absolute temperature |
| Flux | q·n = prescribed outward total heat flux |
| Convection | q·n = h(T − Tambient), with h ≥ 0 |

Zero flux is adiabatic for **total** flux, including Peltier transport. A convection
waveform controls ambient temperature; h is constant. Fixed-temperature edges
meeting at a corner must prescribe matching waveforms. Stationary calculations
require an imposed temperature or convection with h > 0 to anchor the thermal
problem.

## Excitations and solution modes

Every active periodic boundary uses:

```text
s(t) = bias + amplitude cos(2π f t + phase·π/180)
```

Phases are entered in degrees and amplitudes are peak values. Electrical and
thermal inputs share f but have independent biases, amplitudes and phases.
The UI infers the solver from active AC inputs: a thermal AC input can select
periodic mode even with DC electrical drive or open circuit. Convection with
h = 0 does not count as an active thermal excitation.

Selecting DC electrical excitation clears its AC amplitude and phase. Loading a
configuration marked `steady` clears thermal AC amplitudes in the editor too.
At the source/API level, `TE.run2D` follows `config.mode`; steady conversion uses
biases only. Use `mode: "periodic"` when importing a model whose thermal AC drive
must be preserved.

Stationary mode solves ∂T/∂t = 0. Periodic mode starts at 300 K except for imposed
initial boundary temperatures, integrates the full nonlinear equations, and
compares consecutive temperature cycles. Only the last complete cycle is
retained for analysis; there is no general-purpose startup-history viewer.

## Numerical method

### Spatial discretization

The solver uses conservative nodal control volumes on a uniform rectangular
grid. Each cell contributes four half-face links and assigns one quarter of its
thermal capacity to each corner node. For a link a → b, length L and half-face
area A:

```text
gab = A / [L mean(ρₑ(Ta), ρₑ(Tb))]
Kab = (A/L) mean(k(Ta), k(Tb))
αab = mean(α(Ta), α(Tb))
Iab = gab [Va − Vb − αab(Tb − Ta)]
Qab = αab (Ta + Tb) Iab / 2 − Kab(Tb − Ta)
Pab = Iab(Va − Vb)
```

Pab is electrical work, shared equally between the two endpoint heat balances.
Link transport contributes equal and opposite flux terms. Cell-centred Jx/Jy and
qx/qy are reconstructed from the two corresponding directional links. T and V
remain nodal quantities.

The electrical solve in current/open-circuit mode combines a zero-terminal-voltage
Seebeck solution with a unit-voltage conduction solution to enforce total current.
Dirichlet nodes are eliminated from the linear systems. Matrix-free conjugate
gradients use diagonal (Jacobi) preconditioning.

### Nonlinear and time iteration

Coupled electrical and thermal equations use damped Picard iteration. Periodic
integration starts with one backward-Euler step, followed by fixed-step BDF2:

```text
Δt = 1 / (f × samples)
∂T/∂t ≈ (3Tnew − 4Told + Tolder) / (2Δt)
```

| Setting | Implemented default or bound |
|---|---|
| Linear relative tolerance | 2 × 10⁻¹²; target is rtol × max(norm(rhs), 10⁻²⁰) after boundary elimination |
| Linear iteration limit | 4000 |
| Nonlinear temperature-update tolerance | 2 × 10⁻⁹ K, maximum absolute nodal update |
| Nonlinear iteration limit | 100 |
| Picard relaxation | 0.85 |
| Periodic absolute tolerance | 2 × 10⁻⁷ K |
| Periodic relative tolerance | 10⁻¹⁰ |
| Minimum cycles | 3 in the normal application workflow |
| Maximum cycle budget | 3–1000; default 100 |
| GUI samples per period | 64, 128, 256, 512 or 1024; default 128 |
| Core samples per period | Integer 32–2048 |

Periodic convergence requires the maximum, over all nodes and sampled times, of

```text
|Tcycle − Tprevious| / [2E−7 + 1E−10 max(|Tcycle|, |Tprevious|)]
```

to be ≤ 1. This tests successive temperature histories, not every voltage or
higher-harmonic error independently. Exhausting the cycle budget raises an
error; any retained complete cycle remains provisional. Tight iteration
tolerances do not remove mesh or time-discretization errors.

For stationary results, the reported energy residual is total outward boundary
heat flow minus absorbed electrical power. Prescribed-temperature boundary heat
flows are inferred from nodal balances.

## Harmonics and visualization

The Fourier convention is:

```text
u(t) = U0 + Re[Σ Un exp(i n ω t)],  n = 1, 2, 3
U0   = (1/N) Σ uj
Un   = (2/N) Σ uj exp(−i 2π n j/N),  n > 0
```

U0 is signed; |Un| is a peak amplitude, not RMS. Phase is atan2(Im Un, Re Un),
relative to a cosine time reference. An imposed A cos(ωt + φ) has phasor A exp(iφ).
DC, 1ω, 2ω and 3ω are extracted for T, V, Jx, Jy, qx, qy and terminal current/voltage.

Constant-resistance Joule heating under zero-bias sinusoidal current produces
DC and 2ω forcing. Temperature-dependent resistance can mix the current and
thermal response to produce 3ω voltage. Thermoelectric and nonlinear coupling
can generate additional components; the displayed order limit does not truncate
the time-domain physics.

Harmonic maps offer amplitude, phase and real part. Nodal scalar maps average
values over each cell; phase maps use the angle of the mean complex phasor.
Amplitude maps average nodal amplitudes, which need not equal the amplitude of
the mean phasor when neighbouring phases differ. Inspect nodal exports for
interface gradients or cancellation effects.

The harmonic current-magnitude map shows sqrt(|Jx,n|² + |Jy,n|²), not the nth
Fourier component of instantaneous |J(t)|. Arrows show the real current phasor
at 0°, regardless of scalar-map representation. Instantaneous maps use saved
time samples directly, including all temporally resolved components.

Clicking the harmonic map selects a nodal temperature probe. Periodic charts
show probe temperature and terminal voltage; only converged histories are closed
back to their first sample on screen. Phase maps do not apply the Bode amplitude
threshold, so phase near zero amplitude should not be interpreted.

## Frequency sweeps and Bode analysis

Sweeps require 0 < minimum < maximum frequency, 2–100 points and at least one
nonzero active AC excitation. Both endpoints are included. Each frequency starts
independently; the previous frequency is not used as a warm start. Biases,
amplitudes, phases and geometry remain fixed.

A failed point stops the sweep. Stop retains completed points and, when available,
the latest complete cycle of the interrupted point. Unconverged points are
excluded from Bode curves but can remain available for inspection/export.

Bode controls provide terminal voltage/current, impedance, or a spatial T/V/J/q
component at a probe. T/V probes snap to nodes; J/q probes select cells. Supported
response orders are 1ω–3ω, except impedance, which uses 1ω only.

```text
Relative phase = φ(output,n) − n φ(reference,1)
Z = −Vterminal,1 / Iterminal,1
Normalized magnitude = |Un| / |Reference1|
Order-normalized magnitude = |Un| / |Reference1|ⁿ
Magnitude in dB = 20 log10(magnitude / dB_reference)
```

References can be the electrical drive, measured terminal current or voltage,
a thermal boundary waveform, or the time origin. Time origin has no amplitude
for normalization. Thermal convection references use ambient-temperature
amplitude. Impedance uses its own current reference and has positive real value
and zero phase for a pure resistor under the implemented sign convention.

The horizontal axis is excitation frequency f, including for 2ω/3ω outputs.
Higher-order ratios depend on drive amplitude; with simultaneous excitations,
they describe a combined nonlinear response rather than a unique small-signal
transfer function. Wrapped/unwrapped phase and physical/dB magnitude are
available. Unwrapping restarts after an omitted phase point.

## Workflow and data format

1. Define dimensions and mesh, apply changes and paint the material regions.
   Run and Export model also apply pending mesh edits. Remeshing transfers
   materials by nearest old cell at each new cell centre; inspect thin regions.
2. Set material properties and all electrical/thermal boundaries.
3. Check the inferred solution mode and periodic settings or sweep range.
4. Run, inspect convergence and refine the mesh/time steps before interpreting
   weak harmonics or localized interface effects.
5. Export the computed result and its associated model for reproducibility.

The model contains `mode`, `nx`, `ny`, `lx`, `ly`, `depth`, `materials`,
`materialMap`, `electrical`, `thermal`, `frequency`, `samples`, `maxPeriods`
and optional `sweep` settings. Boundary signals are scalars or objects containing
`bias`, `amplitude` and `phase`. GUI model import requires JSON smaller than
2,000,000 bytes and a supported GUI sample count.

Indices are zero based: node = j(Nx + 1) + i and cell = jNx + i, with j = 0 at
the bottom. Steady T/V are nodal arrays, J/q components are cell arrays and
terminal values are scalars. Periodic fields add an outer sample dimension;
`harmonics[field][order]` contains `{re, im}` values or spatial arrays of them.
`time` is time within the retained cycle; `cycleStartTime` supplies its absolute
offset. `finalTemperature` is the integration endpoint, following the final
stored pre-step sample.

## Exports

| Export | Contents |
|---|---|
| Model JSON | Current applied input model |
| Results JSON | Computed result or retained sweep, including full-precision arrays and harmonics |
| Spectrum CSV | Selected frequency's terminal voltage DC/1ω/2ω/3ω values and convergence status |
| Bode CSV | Physical magnitudes, relative phases, actual probe coordinates and omission/status reasons |
| Complete ZIP | Model/results JSON, node/cell coordinates, field histories/harmonics, terminal data, SVG figures, manifest and printable HTML report |
| Full PDF report | Printable HTML opened in a new window; PDF is produced through the browser print dialog |

Sweep ZIPs contain one `frequency-NNN/` folder per retained point, plus sweep
status, requested frequencies, Bode options, Bode CSV and a selected-frequency
summary report. Each point also has its own full report. ZIP entries use STORE
(no compression); export can require substantially more memory than retained
solver data. Reports include amplitude and phase maps; the interactive real-part
selection is not a separate exported map set.

Exports use the model associated with the computed result, not subsequent input
edits. Periodic exports contain only the last retained complete cycle at each
frequency, not startup history. CSV Bode magnitudes stay in physical units even
when the screen uses dB. DC signs are preserved in real-value columns; peak
columns contain absolute magnitudes.

## Validation and operating limits

| Quantity | Implemented limit |
|---|---|
| Mesh | Nx ≥ 2, Ny ≥ 1; at most 1600 nodes |
| Materials | 1–12 |
| Temperature | 1–2000 K during the solution |
| Nodal/terminal voltage | Absolute value ≤ 10⁶ V |
| Terminal current | Absolute value ≤ 10⁶ A |
| Jx/Jy and qx/qy | Absolute value ≤ 10¹² in their SI units |
| Electrical power and checked link work/Peltier terms | Absolute value ≤ 10¹² W |
| Sweep retained-data estimate | ≤ 256 MiB |

The sweep estimate is points × samples × [2 × nodes + 4 × cells] × 32 bytes;
it is a heuristic, not a hard bound on browser memory. Single-frequency runs
have no equivalent retained-data estimate check. Harmonic magnitudes are checked
against twice their associated instantaneous field limit. Nonfinite results and
invalid positive-property laws are rejected; values are not clipped to limits.

Bode reference amplitudes must exceed 10⁻¹² A/V or 10⁻⁹ K/(W/m²), as applicable.
Measured terminal references must also exceed 10⁻¹⁰ times their largest terminal
harmonic, including DC. An unusable reference suppresses relative phase and
normalization; raw output magnitude may still be available. Magnitudes above
10¹⁵ are omitted by the current Bode implementation, including raw and impedance
selections. Zero magnitude is omitted on dB plots; unavailable CSV values are
blank, not zero. The adjustable Bode phase threshold applies to raw output.

The physical model excludes anisotropy, nonrectangular/adaptive meshes, contact
resistance, radiation, front/back losses, electrical capacitance/inductance,
melting and material failure. These software limits do not establish physical
validity. Check material calibration ranges, mesh refinement, time refinement
and convergence separately.

## Source architecture and review notes

| File | Responsibility |
|---|---|
| `index.html` | Interface/style, equation text and embedded `workerSource` solver copy |
| `assets/core.js` | Materials, mesh, validation, transport solvers, harmonics and Bode/data helpers |
| `assets/app.js` | Editor state, worker orchestration, rendering and user-triggered exports |
| `assets/exports.js` | Offline reports, CSV/SVG generation and ZIP writer |
| `assets/startup.js` | Early script-loading and initialization diagnostics |

The embedded worker contains a duplicate of the executable core. In the reviewed
files it matches `core.js` through the Bode helpers, excluding the report equation
guide and adding the worker message handler. Changes to solver code must be
synchronized in both places; editing `assets/core.js` alone does not change the
solver executed by the browser worker.

Review of the supplied revision found one reproducible phase-conversion edge
case: `TE.signal2D` reduces phase modulo 360 before conversion, while the Bode
reference helper converts the unreduced phase. Very large finite phase values
can therefore give an incorrect or nonfinite Bode reference despite a finite
solver waveform. For example, a phase of `1e308` degrees passes validation but
causes the Bode reference to be reported below numerical resolution. Keep
entered phases within a conventional range such as −180° to 180°. A code fix
should apply the same modulo conversion in both core copies. This documentation
update does not patch the JavaScript.

Verification performed for this revision: syntax checks of all four JavaScript
files and the embedded worker; analytic Ohmic voltage/Joule temperature checks;
open-circuit Seebeck voltage; Fourier sign/scale; periodic resistor convergence
and impedance; embedded-worker steady calculation; report/ZIP generation and ZIP
CRC verification. These focused checks passed. Full browser interaction testing,
all-preset coverage and a systematic mesh/time-convergence study were not performed.
