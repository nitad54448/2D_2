# Thermoelectric Lab — browser application

## Installation and start

Extract this package into your application folder, replacing `index.html`,
`README.md` and the files in `assets/`. Keep the folder structure intact.
The package contains only the files needed to run the application and this guide.

Open `index.html`, or serve the folder with Python:

```bash
python -m http.server 8001 --bind 127.0.0.1
```

Open http://127.0.0.1:8001. Use `python3` if required by your system. After replacing
files, reload the page without its cached assets (Ctrl+Shift+R).
No internet connection or runtime package installation is required.

## Model

The application solves coupled electrical and thermal transport in a rectangular
2D domain containing multiple isotropic materials. It includes Seebeck, Peltier,
Thomson and Joule effects. Material regions follow the cell grid; interfaces are
perfect. Out-of-plane depth is uniform and converts densities into total currents
and heat flows. The model does not include melting, radiation or material failure.

The equations are:

- J = −σ(∇V + α∇T)
- ∇·J = 0
- q = αTJ − k∇T
- ρCp ∂T/∂t = −∇·q − J·∇V

The Solver tab describes the equations, boundary conditions and numerical method.
A stationary calculation solves the time-independent equations. A periodic
calculation integrates the nonlinear equations until consecutive cycles converge,
then extracts the DC, 1ω, 2ω and 3ω peak phasors.

## Set up a calculation

1. **Geometry:** enter Width X, Width Y, Elements X, Elements Y and out-of-plane
   depth. Apply the mesh and paint cells with the desired materials. Dimensions
   must be positive. The mesh is limited to 1600 nodes. Ny = 1 supports a 1D-like
   extrusion with appropriate full-width contacts and transverse insulation.
2. **Materials:** enter reference properties and temperature-dependent electrical
   resistivity and Seebeck slopes. Large values use scientific notation. Check
   each material's actual temperature range and the units of its properties.
3. **Boundaries:** set electrical contacts and current, voltage or open-circuit
   control. Thermal boundaries support imposed temperature, outward total heat
   flux and convection. Thermal waveforms have independent amplitudes and phases.
4. **Solver:** the method follows the active excitations. DC stationary requires
   no time settings. Periodic runs use a shared frequency, steps per period and
   maximum cycle count. All electrical and thermal AC inputs share the frequency.
5. **Results:** inspect harmonic maps, instantaneous spatial maps and terminal
   values. Periodic runs include a time slider, temperature probe and voltage
   history. DC time charts are hidden.

Positive current enters the source electrode. The stored terminal voltage is
V(sink) − V(source). Harmonic amplitudes are peak values, not RMS values.

## Frequency sweeps and Bode plots

Choose **Boundaries → Excitation → AC · multifrequency sweep**. Set positive
minimum/maximum frequencies, 2–100 points and logarithmic or linear spacing.
Both endpoints are included. At least one active AC excitation must be nonzero.
Biases, amplitudes and phases stay fixed while the shared frequency changes.
The retained-data estimate must not exceed 256 MiB; export adds memory overhead.

Each frequency starts independently. The progress display shows frequency, cycle
and step. A failed point stops the sweep. Stop retains completed points and, if
available, the last complete cycle of the interrupted point. Unconverged cycles
are marked provisional and excluded from Bode curves.

Bode controls select:

- Terminal voltage/current, impedance, temperature, potential, Jx/Jy or qx/qy.
- Harmonic 1ω, 2ω or 3ω. Impedance uses 1ω only.
- Spatial probe X/Y percentages, snapped to nodes for T/V or cells for J/q.
- Electrical, measured terminal, thermal or time-origin phase reference.
- Raw amplitude, amplitude divided by the reference fundamental, or amplitude
  divided by that reference raised to harmonic order n.
- Physical units or dB with an explicit positive reference in the same units.
- Wrapped/unwrapped phase and an adjustable raw-output phase threshold.

Relative phase is φ(output,n) − nφ(reference,1). Impedance uses the physical
voltage drop: Z = −Vterminal,1 / Iterminal,1. An Ohmic resistor therefore has
positive real impedance and zero phase. The frequency axis shows excitation
frequency, including when plotting 2ω or 3ω.

Higher-harmonic ratios depend on excitation amplitude. With multiple simultaneous
excitations, the curve describes their combined response. Click a curve point or
select a map/report frequency after the calculation to inspect its spatial fields.

## Result rejection and operating limits

The application rejects nonfinite values and stops calculations outside the
following fixed application envelope. These are broad software safeguards, not
material-specific validity limits or evidence that every accepted result is physical.

| Quantity | Allowed range |
|---|---|
| Temperature | 1–2000 K |
| Nodal/terminal voltage | Absolute value ≤ 1E6 V |
| Total terminal current | Absolute value ≤ 1E6 A |
| Current density components | Absolute value ≤ 1E12 A/m² |
| Heat-flux components | Absolute value ≤ 1E12 W/m² |
| Electrical power and link transport-power terms | Absolute value ≤ 1E12 W |

Temperature guards run during nonlinear iterations. Fields are checked before a
cycle or final result is published. A rejected result is not plotted or exported,
and values are never clipped to the limits. The error identifies the failed guard.
Previously accepted points or checkpoints can remain visible, with their status.
Positive material properties and finite derived quantities are checked separately.

Bode references at or below 1E-12 in A or V, or 1E-9 in K or W/m², cannot define
phase or normalization. Measured terminal references must also exceed 1E-10 times
the largest terminal harmonic, including DC. Raw amplitude can still be shown when
its reference is unusable, but relative phase and normalized amplitude are absent.
Normalized magnitudes above 1E15 in the selected physical ratio units are omitted
with an explanation. Zero amplitudes have no phase and are omitted on dB plots.
Missing Bode values are blank in CSV, not replaced with zero. Unwrapping restarts
after an omitted point.

If a guard triggers, check input units, cross-section, current/voltage, heat flux,
material laws and cooling conditions. Do not interpret passing the guards as
validation: refine the mesh and time steps, ensure periodic convergence and stay
within the measured validity range of the material properties. The application
limits may be wider than those ranges.

## Exports

- **Export model:** the current applied input model as JSON.
- **Export results JSON:** the computed result or retained frequency sweep.
- **Spectrum CSV:** terminal harmonics at the selected frequency.
- **Export Bode CSV:** physical magnitudes, phases, probe coordinates and status.
- **Export data / complete ZIP:** all retained fields, histories, harmonics,
  coordinates, models, SVG figures and printable reports. Sweeps have one folder
  per retained frequency and a file recording Bode settings and sweep status.
- **Full PDF report:** opens a printable report; choose Save as PDF in the browser.
  A sweep report includes Bode and the selected-frequency detailed report. The ZIP
  also contains an individual full report for each retained frequency.

Periodic exports contain the last complete cycle at each retained frequency,
not the full startup history. CSV magnitudes remain in physical units when the
screen uses dB. Exported results use the computed model, not subsequent input edits.

## Peltier effects at material interfaces

Peltier transport is included through q = αTJ − k∇T. The solver uses each link's
material Seebeck coefficient; a discontinuity in α therefore contributes opposite
interface heating/cooling at the two junctions of a Cu/Bi₂Te₃/Cu stack. Do not add
a separate interface Peltier source on top of this flux formulation.

Perfect interfaces share a temperature node. Temperature is continuous, while
its gradient and conductive heat flux can change. In the left-to-right convention,
q_cond,right − q_cond,left = −Jx T(α_right − α_left). Total heat flux, including
Peltier transport, is continuous at an ideal interface. A finite temperature jump
would require thermal contact resistance, which this model does not include.

Use nonzero, distinct Seebeck coefficients for Cu and Bi₂Te₃. Reversing DC current
reverses Peltier heating/cooling; Joule heating remains positive and can dominate
at large current. For a pure AC excitation, inspect Temperature → 1ω → Real part
or Phase. DC shows the cycle mean, and amplitude maps hide the sign. Nonlinear
coupling can also generate other harmonic components. Spatial maps average nodal
values over each cell, so refine the mesh near interfaces and use exported nodal
data to examine local changes of slope.
