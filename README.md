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
compares consecutive temperature cycles and terminal DC/1ω–3ω phasors. Only the last complete cycle is
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
gradients use diagonal (Jacobi) preconditioning. The solver caches free-node and
edge layouts by mesh and fixed-node set, and reuses typed work buffers.
Conductances, right-hand sides and fixed values are rebuilt on every solve;
temperature-dependent coefficients are never reused as if they were constant.

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
| Free-node heat-balance absolute tolerance | 10⁻⁹ W |
| Free-node heat-balance relative tolerance | 10⁻⁷ |
| Terminal-voltage harmonic absolute tolerance | 10⁻¹² V |
| Terminal-current harmonic absolute tolerance | 10⁻¹⁰ A |
| Terminal-harmonic relative tolerance | 10⁻⁶ |
| Minimum cycles | 3 in the normal application workflow |
| Maximum cycle budget | 3–1000; default 100 |
| GUI samples per period | 64, 128, 256, 512 or 1024; default 128 |
| Core samples per period | Integer 32–2048 |

### Algorithm: what happens during a calculation

The solution has three nested levels: a linear solve, a nonlinear thermal solve,
and (for AC) repetition of complete time cycles. Their stopping criteria are
separate; a small linear residual alone does not establish periodic convergence.

1. **Build the discrete model.** Assign a material to each rectangular cell,
   construct its four half-face links and corner heat capacities, and identify
   the electrical contacts and imposed-temperature nodes.
2. **Initialize temperature.** Start at 300 K unless the core caller supplies
   `T0`; apply imposed temperatures at the initial time.
3. **Update properties at the current temperature guess.** Evaluate conductivity,
   Seebeck coefficient, thermal conductivity and thermal capacity, then construct
   the electrical link conductances.
4. **Solve charge conservation.** Solve the electrical graph equations for V.
   Voltage control fixes the terminal voltage directly. Current/open-circuit
   control combines a Seebeck solution at zero terminal voltage with a
   unit-voltage solution to enforce the requested net terminal current.
5. **Construct the thermal equation.** Compute link currents, Peltier transport
   and electrical work. Assemble conduction and boundary terms, including thermal
   storage in a time-dependent calculation.
6. **Solve and check the temperature candidate.** Solve the thermal linear system.
   Compare the candidate with the current guess. When the maximum temperature
   update is small enough, recompute the coupled balance at the candidate and
   check its heat residual too. Accept only if both checks pass. Otherwise update
   the guess with 85% of the candidate correction and repeat steps 3–6, up to
   100 nonlinear iterations. Fixed-temperature nodes retain their prescribed values.
7. **Finish DC, or advance AC.** A DC calculation performs that nonlinear solve
   without a storage term. An AC calculation repeats it at each time step: one
   backward-Euler startup step, then BDF2 with fixed Δt = 1/(f × samples).
8. **Check an entire AC cycle.** Compare its temperature history and terminal
   DC/1ω/2ω/3ω phasors with the preceding cycle. Require both cycle checks and the
   heat-balance checks to pass, after at least three cycles by default. Otherwise
   continue until convergence or the maximum-cycle budget.
9. **Publish the result.** Reconstruct spatial fields and extract their DC–3ω
   phasors from the retained cycle. A saved checkpoint that has not passed the
   cycle checks is provisional and is excluded from Bode curves.

The electrical problem is quasistatic at each thermal iteration; there is no
separate electrical time integrator. Harmonics are extracted from the nonlinear
time-domain solution, not solved as independently decoupled harmonic equations.

## Understanding the displayed errors

Here, a **normalized error** is a numerical discrepancy divided by its allowed
tolerance. It is dimensionless. It is **not a percentage** and it is not an
estimate of the error relative to the exact physical solution.

| Normalized value | Interpretation |
|---|---|
| 0 | No difference/residual detected at the available numerical precision |
| 0.1 | One tenth of the allowed discrepancy |
| 1 | Exactly at the acceptance threshold |
| 5 | Five times the allowed discrepancy; this check fails |
| Pending / unavailable | No comparison is available yet, usually during the first cycle |

An absolute tolerance supplies a floor near zero. A relative tolerance allows
an additional discrepancy proportional to a specified scale. Unless stated
otherwise, the reported value is the **maximum**, not an average: a large error
at one node, time sample or terminal harmonic cannot be hidden by smaller errors
elsewhere.

### 1. Linear algebra residual: internal CG stopping test

After eliminating fixed-value nodes, each linear system has the form `A x = b`.
The conjugate-gradient solver stops when:

```text
||r||₂ ≤ 2E−12 × max(||b||₂, 1E−20),  where r ≈ b − A x
```

The implementation uses the residual updated by the CG recurrence; the
`1E−20` floor is in the corresponding right-hand-side units. Electrical equations
balance currents, and thermal equations balance powers. The iteration limit is
4000. This test is internal and is not the UI's “Normalized error”. It measures
how accurately the current *linearized* equations have been solved.

### 2. Nonlinear temperature update: an absolute difference in kelvin

Within Picard iteration, the temperature candidate must satisfy:

```text
ΔTmax = max_i |Tcandidate,i − Tguess,i| ≤ 2E−9 K
```

This is the full candidate update, before applying the 0.85 damping factor.
It is an absolute temperature difference, not a dimensionless normalized value.
A small update is necessary but is insufficient by itself: the candidate must
also satisfy the free-node heat-balance test below.

### 3. Heat balance: normalized local residual and residual in watts

For a free temperature node i, define:

```text
Si       = assembled electrical-work/Peltier source at node i                 [W]
Bi       = thermal boundary RHS_i − convection_diagonal_i × Ti               [W]
D_i      = Ci × (Ti − Ttarget,i) / gammaDt                                    [W]
Fij      = Kij × (Ti − Tj), conductive power outward on incident link i→j    [W]
Ri       = Si + Bi − D_i − Σ_j Fij                                           [W]
scale_i  = |Si| + |Bi| + |D_i| + Σ_j |Fij|                                   [W]
Eheat    = max_free_i |Ri| / [1E−9 W + 1E−7 × scale_i]
Rheat_W  = max_free_i |Ri|                                                    [W]
```

Ci is the nodal heat capacity in J/K. In DC, `D_i = 0`. For the first
backward-Euler step, `Ttarget = Told` and `gammaDt = Δt`. For BDF2,
`Ttarget = (4Told − Tolder)/3` and `gammaDt = 2Δt/3`. Link orientation in the
formula is outward from the node being checked.

All terms are recomputed at the candidate temperature. The source `Si` is the
assembled signed nodal source; the code takes its absolute value **after**
assembly, not the sum of absolute individual Peltier/work contributions.
Similarly, `Bi` is the net boundary term. Each incident conductive link enters
the scale separately through its absolute power.

Prescribed-temperature nodes are excluded: the heat needed to maintain their
specified temperature is a boundary reaction, not an equation that should have
zero free-node residual. With no free temperature nodes, both maxima are zero.

The nonlinear solution requires `Eheat ≤ 1`. In a periodic result, the displayed
heat values are the maxima over the accepted steps in that cycle. The node/step
with the largest residual in watts need not have the largest normalized residual.
In a steady result, they describe the accepted stationary solution.

**Example:** if a node has `scale_i = 0.01 W`, its allowed residual is
`1E−9 + 1E−7 × 0.01 = 2E−9 W`. A residual of `1E−9 W` gives `Eheat = 0.5`
at that node and passes.

### 4. Temperature-cycle error: is the thermal waveform repeating?

Compare temperatures at matching nodes i and time samples j in consecutive
cycles k and k−1:

```text
ET = max_i,j |Tk,i,j − Tk−1,i,j| /
     [2E−7 K + 1E−10 × max(|Tk,i,j|, |Tk−1,i,j|)]
```

The scale uses absolute temperature, not the AC temperature amplitude. This is
stored as `diagnostics.temperatureCycleError`. It is only available once two
complete histories exist.

**Example:** near 300 K, the denominator is approximately `2.3E−7 K`.
A cycle-to-cycle temperature change of `1E−7 K` gives `ET ≈ 0.435`, which passes.
A value of `0.435` does not mean a 43.5% temperature error.

### 5. Terminal-harmonic error: are terminal amplitudes and phases repeating?

Let Un be a complex peak phasor of terminal voltage or terminal current. For each
quantity and each order n = 0, 1, 2, 3:

```text
difference = sqrt[(Re Un,k − Re Un,k−1)² + (Im Un,k − Im Un,k−1)²]
En = difference / [atol + 1E−6 × max(|Un,k|, |Un,k−1|)]
EH = maximum En over both terminal quantities and all four orders

atol = 1E−12 V for terminal voltage
atol = 1E−10 A for terminal current
```

The complex difference detects changes in both amplitude and phase. Each order
is scaled by its own amplitude; a strong fundamental cannot conceal a changing
weak 3ω component. Voltage and current are normalized separately before taking
the maximum. This is stored as `diagnostics.terminalHarmonicError`.

**Example:** a 3ω voltage of about `1E−6 V` has a denominator of about
`1E−12 + 1E−6 × 1E−6 = 2E−12 V`. A complex cycle-to-cycle change of
`1E−12 V` gives `En ≈ 0.5`, which passes. Signals comparable to or below the
absolute floor do not gain relative-accuracy certification from passing this test.

### 6. Combined “Normalized error”: the periodic acceptance test

```text
Ecombined = max(ET, EH, Eheat)
```

The result stores this as `periodicError`. Periodic convergence requires
`Ecombined ≤ 1` and at least three completed cycles in the normal application
workflow. Every time step must already have passed the nonlinear update and
heat-balance checks.

For example, `ET = 0.43`, `EH = 0.5`, `Eheat = 0.8` produces a displayed
combined error of `0.8`, and passes. If `EH = 3`, the combined error is at least
3 and the calculation continues even when the temperature waveform has settled.

During a cycle, the progress line carries the most recent **completed-cycle**
comparison. It updates at cycle boundaries; it is not a fresh comparison at every
time step. The first cycle has no preceding history and is reported as pending.
Saved provisional cycles can have a pending or failing combined error. Reaching
the cycle budget does not turn them into converged results.

### 7. Steady energy residual: global balance, not a normalized error

```text
energyResidual = total outward boundary heat flow − absorbed electrical power   [W]
absorbed electrical power = −Iterminal × Vterminal                              [W]
```

This is a signed global diagnostic in watts. Positive means the computed net
outward heat flow exceeds absorbed electrical power; negative means the reverse.
It should be close to zero. It is reported after the solve; the implementation
does not impose a separate global-energy acceptance threshold. Local normalized
heat balance and the nonlinear temperature update are the stationary stopping
criteria. Global cancellation can make this diagnostic small even when individual
local residuals are larger, so inspect both.

### Where to find each quantity

| Results label / purpose | Stored field | Units | Acceptance |
|---|---|---|---|
| Normalized error (periodic) | `periodicError` | Dimensionless | ≤ 1, after minimum cycles |
| Cycle errors: temperature | `diagnostics.temperatureCycleError` | Dimensionless | ≤ 1 |
| Cycle errors: terminal harmonics | `diagnostics.terminalHarmonicError` | Dimensionless | ≤ 1 |
| Heat balance: normalized residual | `diagnostics.heatResidualNormalized` | Dimensionless | ≤ 1 |
| Maximum free-node residual | `diagnostics.heatResidualWatts` | W | Interpreted through the local normalized test |
| Energy residual (steady) | `energyResidual` | W | Reported diagnostic, no separate global threshold |
| Nonlinear temperature update (steady JSON) | `diagnostics.updateKelvin` | K | ≤ 2E−9 K by default |

The tolerances above are application defaults. The editor exposes mesh size,
frequency, samples and cycle budget, not the detailed tolerances. Source-level
callers can set the supported options on `graphSolve`, `solveSteady` and
`solvePeriodic`; exported periodic diagnostics record the terminal-harmonic
tolerances used.

### What to do when a check does not pass

- **Linear or nonlinear solve fails:** check units, material-law positivity,
  contacts and thermal anchoring. Reduce extreme excitation; for periodic runs,
  increase samples per period to reduce the time step.
- **Temperature-cycle error remains above 1:** the thermal startup transient may
  not have decayed. Increase the cycle budget and check that cooling permits a
  periodic state. A thermally isolated device with net positive mean heating
  cannot settle to a periodic temperature.
- **Terminal-harmonic error remains above 1:** allow more cycles and inspect the
  weak harmonics. Refine time sampling and mesh resolution; do not interpret a
  stable temperature plot as proof that a tiny 3ω voltage is resolved.
- **Heat-balance error remains above 1:** the candidate does not satisfy the local
  nonlinear thermal equations at the required tolerance. Check material laws,
  excitation and time-step resolution; a small temperature update alone is not
  sufficient.

Passing these tests establishes numerical consistency and repeatability for the
chosen discrete model. It does **not** estimate mesh error, time-discretization
error, material uncertainty or agreement with experiment. Verify mesh/time
refinement separately, especially for weak higher harmonics.

### Bode normalization is a different operation

Bode amplitude normalization divides an output amplitude by the reference
fundamental amplitude, or its nth power. It changes the plotted quantity and
its units; it is not a convergence error. A missing normalized Bode value can
mean a zero/weak reference or an unconverged point, as explained in the Bode
section. A dB value is also a display ratio, not the solver's normalized error.

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
back to their first sample on screen. Interactive and exported phase maps share a masking rule. A cell is gray when
the magnitude of its complex phasor is at or below the larger of the absolute
floor below and 1E−6 times the largest nodal/cell amplitude of the selected field
and harmonic. For nodal fields, the cell phasor is averaged before applying the
mask, so cancellation is handled correctly. The threshold and masked-cell count
are shown in the interface; exported figures label the threshold.

| Phase-map field | Absolute amplitude floor |
|---|---|
| Temperature | 1E−7 K |
| Potential | 1E−12 V |
| Jx/Jy | 1E−9 A/m² |
| qx/qy | 1E−9 W/m² |

These are display thresholds, not error estimates. Raw complex phasors remain
unchanged in the data exports. The Bode threshold remains separately adjustable.

## Frequency sweeps and Bode analysis

Sweeps require 0 < minimum < maximum frequency, 2–100 points and at least one
nonzero active AC excitation. Both endpoints are included. Each frequency starts
independently; the previous frequency is not used as a warm start. Biases,
amplitudes, phases and geometry remain fixed.

A failed point stops the sweep. Stop retains completed points and, when available,
the latest saved complete-cycle checkpoint of the interrupted point. Unconverged points are
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
| Single-frequency/sweep retained-data estimate | ≤ 256 MiB |

The estimate is points × samples × [2 × nodes + 4 × cells] × 32 bytes, with
points = 1 for a single-frequency run. Both single-frequency periodic runs and
sweeps enforce the 256 MiB estimate before solving. It is a heuristic, not a hard
bound on total browser memory or export memory. Harmonic magnitudes are checked
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

## Source architecture

| File | Responsibility |
|---|---|
| `index.html` | Interface/style and ordered classic-script loading |
| `assets/core.js` | Self-contained core factory: materials, mesh, validation, solvers, harmonics, phase masking and Bode helpers |
| `assets/worker.js` | Offline worker composition, message handling and transferable-buffer encoding/decoding |
| `assets/ui-state.js` | Shared UI state and formatting/input helpers |
| `assets/ui-model.js` | Materials, boundaries, mesh editing, import and presets |
| `assets/ui-plots.js` | Geometry, harmonic maps, instantaneous fields and time charts |
| `assets/ui-sweep.js` | Sweep selection, Bode controls and curves |
| `assets/ui-worker.js` | Run/stop lifecycle, result acceptance and diagnostics |
| `assets/ui-downloads.js` | User-triggered model/result/report/archive exports |
| `assets/app.js` | UI bootstrap and event bindings |
| `assets/exports.js` | Report, CSV/SVG and ZIP generation |
| `assets/startup.js` | Early script-loading and initialization diagnostics |
| `tests/*.test.cjs` | Dependency-free numerical, worker, export and UI-logic regression tests |
| `tools/benchmark.cjs` | Repeatable small layered-case timing comparison |

There is one solver source. `TE.createCore` builds the page API; `TE.workerSource()`
serializes the same self-contained factory and the worker handler into a Blob.
No solver code is embedded in HTML, and no worker-side fetch or `importScripts`
is required. Classic scripts preserve direct local-file use without ES-module
fetch requirements. There is no build step or generated solver copy to synchronize.
Keep the factory self-contained when extending it: worker execution must not
depend on page-only functions or variables. UI modules expose their operations
and shared state on `TEApp`; event handlers are bound after all modules load.

Waveform generation, corner-waveform validation and Bode references now share
`TE.phaseRadians`, which reduces degrees modulo 360 before conversion. This fixes
the large-finite-phase discrepancy in the previous revision.

### Checkpoints and transport

Complete-cycle checkpoints are published after the first cycle, every fifth
cycle, at the final failed cycle budget, or at a cycle boundary after at least
one second since the previous checkpoint. Whichever condition occurs first
applies. Final converged results are always published. Core API callers may set
`checkpointEvery` and `checkpointIntervalMs` on `solvePeriodic`.

Stopping terminates the worker and retains the latest **saved** checkpoint;
intervening completed cycles may not have been published. The UI labels such
results provisional. A failure during a cycle similarly preserves only an
already accepted checkpoint.

Field histories and complex harmonics are flattened into Float64 buffers for
worker messages and transferred rather than recursively cloned. Wire buffers
are separate from solver-owned arrays, so sending a checkpoint cannot detach
the ongoing calculation's state. The main thread reconstructs ordinary arrays
and `{re, im}` objects, preserving JSON/CSV compatibility. Large-array allocation
is also reduced in graph iteration, checkpoint packaging and temperature-range
display. Memory estimates remain necessary because transport and exports still
create temporary data.

## Developer verification

With Node.js 20 or later, run the included tests from the project directory:

```bash
node --test tests/*.test.cjs
node tools/benchmark.cjs
```

The application itself needs no Node runtime. The benchmark optionally accepts
the path to an older `core.js` as its first argument. It warms up once, then
reports five timings and their median for the same 8 × 2 layered case at 2 Hz
with 64 samples per period.

The 32 regression tests cover:

- Analytic Ohmic voltage and Joule temperature, voltage control, Seebeck voltage
  with a temperature-dependent coefficient, and energy balance.
- Peltier current reversal at two interfaces, Thomson coupling, partial contacts,
  thermal AC and nonlinear 3ω voltage.
- Fourier sign/scale, large phases, convergence diagnostics and mesh/time refinement.
- Memory limits, graph-cache invalidation, checkpoint cadence and invalid inputs.
- The generated worker's steady/periodic/sweep/error paths, transferred data and
  provisional checkpoints, using a Node worker-thread adapter.
- Shared phase masking, finite report figures, export JSON/CSV and ZIP CRCs.
- Modular UI bootstrap/handlers, all six presets, result diagnostics, dirty-state
  exports and imports, using DOM stubs for logic-level checks.

In the measured small layered benchmark, the median fell from about 965 ms to
382 ms (approximately 2.5× faster). Both versions completed five cycles and
returned identical terminal fundamental values in that comparison. This is one
case on one runtime, not a general performance guarantee.

Visual/browser interaction testing remains outstanding: the available browser
security policy blocked opening local project files. The Node worker tests and
DOM-stub tests do not validate browser layout, native downloads, popup behavior
or direct `file://` execution. See `CHANGELOG.md` for the change summary.
