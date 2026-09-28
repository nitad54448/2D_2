# Changes — transport-review-11

This package contains complete replacement application files and the regression
suite. Keep the `assets/`, `tests/` and `tools/` paths shown in the archive.
The HTML now references additional UI modules and `assets/worker.js`, so replace
the complete application file set together.

## Implemented

1. **Single-source solver:** removed the embedded solver from `index.html`.
   The offline Blob worker is composed from the same self-contained core factory
   loaded by the page, without fetching worker dependencies.
2. **Consistent phase handling:** waveform, corner validation and Bode analysis
   share modulo-360 conversion, including very large finite input phases.
3. **Regression suite:** 32 dependency-free Node tests cover physical reference
   cases, refinement, worker transport, guards, exports and UI logic.
4. **Stronger convergence:** nonlinear solves require a heat-balance residual
   check; periodic convergence additionally checks terminal DC/1ω/2ω/3ω phasors.
   Separate diagnostics appear in the result data, UI and printable reports.
5. **Memory/transport:** both single-frequency and sweep runs enforce the retained
   data estimate; checkpoints are throttled and fields/harmonics use transferable
   Float64 wire buffers. Public result arrays and JSON formats remain compatible.
6. **Reliable phase display:** interactive/report maps share absolute/relative
   amplitude masks; weak or cancelling phasors are gray. Raw phasors are preserved.
7. **Maintainability/performance:** UI responsibilities are split into readable
   classic-script modules; graph topology and work buffers are reused while
   coefficients and boundary values are refreshed. The benchmark is included.

## Behavior changes to be aware of

- `periodicError` now combines temperature, terminal harmonics and heat residuals.
  Stricter acceptance can require more cycles or reject a formerly accepted run.
- Stop retains the latest saved checkpoint, which can precede the last completed
  cycle. First and final-budget cycles are always checkpointed when unconverged.
- Large single-frequency runs can now be rejected by the 256 MiB estimate.
- Gray phase-map cells mean insufficient amplitude, not zero phase.
- `TEApp` is the shared UI namespace; `TE.createCore` and `TE.workerSource` expose
  the single-source worker construction. Application scripts must load in the
  order used by `index.html`.

## Verification

All 32 regression tests passed. All JavaScript files passed syntax checks.
The small layered benchmark improved from a 965 ms median to 382 ms in this
runtime, with identical terminal fundamental values and cycle count. Performance
will vary with the model and runtime.

Browser/visual verification was blocked by the available browser's local-file
security policy. UI tests use DOM stubs; worker tests use a Node adapter around
the actual generated worker source. Those tests do not replace a native-browser
check of layout, popups, downloads and direct local-file loading.
