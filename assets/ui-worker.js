(function (app) {
  'use strict';
  // One switch for every result export. Bode CSV is re-enabled only by drawBode, which also checks
  // that the current Bode selection is valid.
  app.setExports = function setExports(enabled) {
    for (const id of ['exportMenuButton', 'exportPdf', 'exportZip', 'exportResults', 'exportCsv', 'exportProfile']) app.$(id).disabled = !enabled;
    if (enabled) return;
    app.$('bodeCsv').disabled = true;
    app.$('exportMenu').hidden = true;
    app.$('exportMenuButton').setAttribute('aria-expanded', 'false');
  };
  app.accept = function accept(r, {preserveView = false} = {}) {
    const previous = preserveView ? app.captureResultView() : null;
    TE.checkResult(r);
    app.result = r;
    // A newly displayed result matches the inputs; browsing saved sweep points keeps the edited state.
    if (!preserveView) app.inputsChanged = false;
    app.$('profileTime').value = '0';
    const periodic = r.method !== 'steady';
    app.probe = Math.floor(r.config.ny / 2) * (r.config.nx + 1) + Math.floor(r.config.nx / 2);
    app.$('harmonic').value = '0';
    app.$('harmonic').disabled = !periodic;
    app.$('resultEmpty').hidden = true;
    let lo = Infinity, hi = -Infinity;
    for (const row of periodic ? r.temperature : [r.temperature]) {
      for (const value of row) { lo = Math.min(lo, value); hi = Math.max(hi, value); }
    }
    const hs = periodic ? r.harmonics.terminalVoltage : [{re: r.terminalVoltage, im: 0}];
    const v = hs[periodic ? 1 : 0];
    app.$('vLabel').textContent = 'TERMINAL VOLTAGE · ' + (periodic ? '1ω' : 'DC');
    app.$('vMetric').textContent = app.fmt((periodic ? app.amp(v) : v.re) * 1000) + ' mV';
    app.$('vPhase').textContent = periodic ? app.phase(v).toFixed(3) + '° · peak amplitude' : 'Signed stationary voltage';
    app.$('tMetric').textContent = lo.toFixed(3) + '–' + hi.toFixed(3) + ' K';
    app.$('cycleMetric').textContent = periodic ? r.periods + ' cycles' : 'DC';
    app.$('errorMetric').textContent = periodic ? (r.converged ? 'Normalized error ' : 'Unconverged cycle · error ') + (r.periodicError === null ? 'not available' : r.periodicError.toExponential(2)) + (r.converged ? ' ≤ 1' : '') : 'Energy residual ' + r.energyResidual.toExponential(2) + ' W';
    const diagnostics = r.diagnostics;
    app.$('diagnosticsNote').textContent = diagnostics
      ? (periodic ? `Cycle errors: temperature ${diagnostics.temperatureCycleError === null ? 'pending' : app.fmt(diagnostics.temperatureCycleError)}; terminal harmonics ${diagnostics.terminalHarmonicError === null ? 'pending' : app.fmt(diagnostics.terminalHarmonicError)}. ` : '') +
        `Heat balance: normalized residual ${app.fmt(diagnostics.heatResidualNormalized)}; maximum free-node residual ${app.fmt(diagnostics.heatResidualWatts)} W. Acceptance requires normalized errors ≤ 1.`
      : '';
    app.$('spectrum').innerHTML = hs.map((z, n) => `<tr><td>${n ? n + 'ω' : 'DC'}</td><td>${n ? app.fmt(n * r.frequency) : '0'} Hz</td><td>${app.amp(z).toExponential(5)}</td><td>${app.amp(z) > 1e-16 ? app.phase(z).toFixed(3) + '°' : '—'}</td><td>${z.re.toExponential(5)}</td><td>${z.im.toExponential(5)}</td></tr>`).join('');
    app.setExports(!app.inputsChanged);
    app.$('exportStatus').textContent = '';
    if (previous) app.restoreResultView(previous, r);
    app.tab('results');
  };
  app.stopClock = function stopClock() {
    clearInterval(app.clock);
    app.clock = null;
    app.$('runProgress').hidden = true;
    app.$('elapsed').textContent = ((performance.now() - app.started) / 1000).toFixed(1) + ' s';
  };
  // A displayed result must always belong to the current model. Anything else is cleared.
  app.sameModel = r => Boolean(r?.config) && JSON.stringify(r.config) === JSON.stringify(app.config);
  app.clearResults = function clearResults(message = 'Your 2D response will appear here.') {
    app.result = null;
    app.sweepResult = null;
    app.inputsChanged = false;
    app.probe = 0;
    app.$('bodeCard').hidden = true;
    app.$('sweepPoint').innerHTML = '';
    app.setExports(false);
    app.$('exportStatus').textContent = '';
    app.$('resultEmpty').textContent = message;
    app.$('resultEmpty').hidden = false;
    app.$('vLabel').textContent = 'TERMINAL VOLTAGE';
    for (const id of ['vMetric', 'tMetric', 'cycleMetric', 'scaleMin', 'scaleMax', 'surfaceMin', 'surfaceMax']) app.$(id).textContent = '—';
    for (const id of ['vPhase', 'diagnosticsNote', 'scaleUnit', 'surfaceUnit', 'probeChart', 'voltageChart', 'dcProbe']) app.$(id).textContent = '';
    app.$('errorMetric').textContent = 'No valid result';
    app.$('fieldCaption').textContent = 'No valid result for the current model.';
    app.$('profileCaption').textContent = 'No valid result for the current model.';
    app.$('dcProbe').hidden = true;
    app.$('spectrum').innerHTML = '<tr><td colspan="6">No computed result.</td></tr>';
    for (const id of ['resultCanvas', 'profileCanvas']) {
      const canvas = app.$(id);
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  app.retainResults = function retainResults(reason) {
    if (app.activeSweep) {
      app.finishSweep(reason);
      return;
    }
    let text;
    if (app.checkpoint) {
      // Saved complete cycle of THIS run: shown, but explicitly provisional.
      app.sweepResult = null;
      app.$('bodeCard').hidden = true;
      app.accept(app.checkpoint);
      app.$('badge').textContent = 'STOPPED · UNCONVERGED';
      text = ' Showing the latest saved complete cycle of this run; harmonics are provisional.';
    } else if (app.result && !app.sweepResult && app.sameModel(app.result)) {
      // Previous result of the identical model is still valid.
      app.accept(app.result);
      app.$('badge').textContent = 'PREVIOUS RESULT';
      text = ' The displayed result was computed earlier for this identical model.';
    } else {
      app.clearResults('No result: the last run failed or was stopped. ' + reason);
      app.$('badge').textContent = 'STOPPED';
      text = ' No result is displayed; earlier results belonged to a different model and were cleared.';
    }
    app.$('status').textContent = reason + text;
  };
  app.lock = function lock(value) {
    document.querySelectorAll('.settings').forEach(e => e.disabled = value);
    for (const id of ['preset', 'import', 'importProject', 'addMaterial', 'materialFilesButton', 'run', 'save']) app.$(id).disabled = value;
    app.$('cancel').hidden = !value;
    if (!value) {
      app.modes();
      app.validateUI();
    }
  };
  app.runSimulation = () => {
    if (app.worker || app.importingProject) return;
    try {
      app.applyGeometry();
      TE.from2DConfig(app.config);
      app.palette();
    } catch (e) {
      app.notice(e.message, true);
      return;
    }
    app.activeSweep = app.config.sweep?.enabled ? {
      config: JSON.parse(JSON.stringify(app.config)),
      frequencies: TE.validateSweep(app.config),
      results: [],
      status: 'running',
      index: 0
    } : null;
    app.lock(true);
    app.setExports(false);
    app.$('badge').textContent = 'COMPUTING';
    app.$('badge').className = '';
    app.$('status').textContent = 'Solving coupled 2D transport…';
    app.started = performance.now();
    app.checkpoint = null;
    app.$('elapsed').textContent = '0.0 s';
    app.$('runProgress').hidden = false;
    app.$('runProgress').removeAttribute('value');
    app.clock = setInterval(() => {
      app.$('elapsed').textContent = ((performance.now() - app.started) / 1000).toFixed(1) + ' s';
    }, 100);
    const finishError = message => {
      app.worker?.terminate();
      app.worker = null;
      app.stopClock();
      app.lock(false);
      app.retainResults(message);
      app.$('badge').textContent = 'ERROR';
      app.$('badge').className = 'error';
    };
    try {
      const url = URL.createObjectURL(new Blob([TE.workerSource()], {
        type: 'text/javascript'
      }));
      const worker = new Worker(url);
      app.worker = worker;
      URL.revokeObjectURL(url);
      // Ignore anything still queued from a worker that was stopped or replaced.
      worker.onmessage = event => {
        if (app.worker !== worker) return;
        let data;
        try {
          data = TE.decodeWorkerMessage(event.data);
        } catch (e) {
          finishError('Unable to decode solver result: ' + e.message);
          return;
        }
        if (data.type === 'sweepStart') {
          app.activeSweep.index = data.index;
          app.checkpoint = null;
          app.$('status').textContent = `Frequency ${data.index + 1}/${data.total}: ${app.fmt(data.frequency)} Hz`;
        } else if (data.type === 'progress') {
          const prefix = app.activeSweep ? `Frequency ${data.index + 1}/${data.total} · ${app.fmt(data.frequency)} Hz · ` : '';
          app.$('status').textContent = prefix + `Cycle ${data.progress.cycle}/${data.progress.maxPeriods} · step ${data.progress.step}/${data.progress.samples}${data.progress.error === null ? '' : ' · normalized error ' + data.progress.error.toExponential(2)}`;
          app.$('runProgress').max = app.activeSweep ? data.total : data.progress.maxPeriods;
          app.$('runProgress').value = app.activeSweep ? data.index + (data.progress.cycle - 1 + data.progress.step / data.progress.samples) / data.progress.maxPeriods : data.progress.cycle - 1 + data.progress.step / data.progress.samples;
          app.$('runProgress').title = 'Completed frequencies plus current cycle budget; convergence can finish earlier.';
        } else if (data.type === 'checkpoint') {
          try {
            TE.checkResult(data.result);
            app.checkpoint = data.result;
          } catch (e) {
            finishError(e.message);
          }
        } else if (data.type === 'sweepPoint') {
          try {
            TE.checkResult(data.result);
          } catch (e) {
            finishError(e.message);
            return;
          }
          app.activeSweep.results.push(data.result);
          app.checkpoint = null;
          app.sweepResult = app.activeSweep;
          app.refreshSweepPoints();
          app.drawBode();
          if (!data.result.converged) app.$('status').textContent = `Frequency ${data.index + 1}/${data.total} · ${app.fmt(data.frequency)} Hz did not converge in ${data.result.periods} cycles. Kept as unconverged (excluded from Bode); continuing.`;
        } else if (data.type === 'sweepDone') {
          app.worker.terminate();
          app.worker = null;
          app.stopClock();
          app.lock(false);
          const unconverged = app.activeSweep.results.filter(r => !r.converged).length;
          app.finishSweep(unconverged ? `Sweep completed with ${unconverged} unconverged point(s), excluded from Bode.` : 'Sweep completed.', true);
        } else if (data.type === 'sweepError' || data.type === 'error') finishError('Calculation failed: ' + data.message);else if (data.type === 'result') {
          try {
            TE.checkResult(data.result);
          } catch (e) {
            finishError(e.message);
            return;
          }
          app.worker.terminate();
          app.worker = null;
          app.stopClock();
          app.lock(false);
          app.sweepResult = null;
          app.$('bodeCard').hidden = true;
          app.accept(data.result);
          app.$('badge').textContent = 'CONVERGED';
          app.$('status').textContent = 'Computed successfully. Refine the mesh and time steps to check accuracy.';
        }
      };
      worker.onerror = e => {
        if (app.worker === worker) finishError('Worker error: ' + e.message);
      };
      worker.postMessage(app.config);
    } catch (e) {
      finishError('Unable to start: ' + e.message);
    }
  };
  app.cancelSimulation = () => {
    app.worker?.terminate();
    app.worker = null;
    app.stopClock();
    app.lock(false);
    app.retainResults('Stopped by user.');
  };
})(globalThis.TEApp);
