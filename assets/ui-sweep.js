(function (app) {
  'use strict';
  app.bodeOptions = function bodeOptions() {
    return {
      quantity: app.$('bodeQuantity').value,
      harmonic: Number(app.$('bodeHarmonic').value),
      reference: app.$('bodeReference').value,
      normalization: app.$('bodeNormalization').value,
      phaseFloor: Number(app.$('bodeFloor').value),
      unwrap: app.$('bodeUnwrap').value === 'unwrapped',
      x: Number(app.$('bodeX').value) / 100,
      y: Number(app.$('bodeY').value) / 100,
      scale: app.$('bodeScale').value,
      dbReference: Number(app.$('bodeDb').value),
      representation: app.$('bodeRepresentation').value
    };
  };
  app.refreshSweepPoints = function refreshSweepPoints() {
    if (!app.sweepResult) return;
    const select = app.$('sweepPoint'),
      old = select.value;
    select.innerHTML = app.sweepResult.results.map((r, i) => `<option value="${i}">${app.fmt(r.frequency)} Hz${r.converged ? '' : ' · UNCONVERGED'}</option>`).join('');
    select.value = Number(old) < app.sweepResult.results.length ? old : '0';
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    select.disabled = Boolean(app.worker);
    app.$('bodeCard').hidden = false;
  };
  app.finishSweep = function finishSweep(message, complete = false) {
    const saved = app.activeSweep;
    if (!saved) return;
    if (app.checkpoint && !complete) saved.results.push(app.checkpoint);
    app.checkpoint = null;
    app.activeSweep = null;
    saved.status = complete ? 'complete' : 'stopped';
    saved.message = message;
    if (saved.results.length) {
      app.sweepResult = saved;
      app.refreshSweepPoints();
      app.$('sweepPoint').value = String(saved.results.length - 1);
      app.accept(saved.results.at(-1));
      app.drawBode();
    } else {
      // No point of this sweep was computed: never fall back to an older result.
      app.clearResults('No result: the sweep stopped before its first frequency point. ' + message);
    }
    app.$('badge').textContent = complete ? 'SWEEP COMPLETE' : 'SWEEP STOPPED';
    app.$('status').textContent = message + ` ${saved.results.filter(r => r.converged).length}/${saved.frequencies.length} converged frequency points retained.`;
  };
  app.selectSweepPoint = function selectSweepPoint(i) {
    if (app.worker || !app.sweepResult?.results[i]) return;
    app.$('sweepPoint').value = String(i);
    app.accept(app.sweepResult.results[i], {preserveView: true});
    app.$('status').textContent = `Sweep map / report: ${app.fmt(app.result.frequency)} Hz · ${app.result.converged ? 'converged' : 'unconverged, excluded from Bode'}${app.inputsChanged ? ' · inputs changed since this sweep; run again to export.' : ''}`;
  };
  // Fixed paper palette for printed and archived reports, independent of the interface theme.
  app.reportPlotColors = Object.freeze({
    text: '#193242',
    grid: '#d8e0e5',
    line: '#187d98',
    point: '#be6733',
    background: '#ffffff'
  });
  // Real/imaginary parts of the (normalized, referenced) phasor shown in the Bode rows.
  app.complexBodeRows = rows => rows.map(r => {
    if (r.magnitude === null || r.phase === null) return {...r, real: null, imag: null};
    const rad = r.phase * Math.PI / 180;
    return {...r, real: r.magnitude * Math.cos(rad), imag: r.magnitude * Math.sin(rad)};
  });
  // Both Bode charts for the chosen representation. dB applies only to the magnitude chart.
  app.bodeCharts = function bodeCharts(rows, {representation = 'polar', ...opts} = {}) {
    if (representation === 'complex') {
      const complex = app.complexBodeRows(rows);
      return [app.bodeSvg(complex, 'real', {...opts, db: false}), app.bodeSvg(complex, 'imag', {...opts, db: false})];
    }
    return [app.bodeSvg(rows, 'magnitude', opts), app.bodeSvg(rows, 'phase', opts)];
  };
  // key: 'magnitude' (optionally in dB), 'phase', 'real' or 'imag'.
  app.bodeSvg = function bodeSvg(rows, key, {
    log = true,
    db = false,
    dbReference = 1,
    colors = app.plotColors()
  } = {}) {
    const W = 580,
      H = 240,
      L = 85,
      R = 20,
      T = 30,
      B = 48,
      valid = rows.map(r => key !== 'magnitude' ? r[key] ?? null : r.magnitude === null ? null : db ? r.magnitude > 0 ? 20 * Math.log10(r.magnitude / dbReference) : null : r.magnitude);
    const numbers = valid.filter(v => v !== null && Number.isFinite(v));
    const unit = rows[0]?.unit ?? '';
    const title = key === 'phase' ? 'Phase · °' : key === 'real' ? `Real part · ${unit}` : key === 'imag' ? `Imaginary part · ${unit}` : db ? `Magnitude · dB re ${app.fmt(dbReference)} ${unit}` : `Magnitude · ${unit}`;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${app.esc(title)}"><rect width="${W}" height="${H}" fill="${colors.background}"/><text x="${L}" y="16" fill="${colors.text}" font-size="11">${app.esc(title)}</text>`;
    if (!numbers.length) return svg + `<text x="85" y="100" fill="${colors.text}" font-size="12">No valid values for this selection.</text></svg>`;
    let lo = Math.min(...numbers),
      hi = Math.max(...numbers),
      pad = hi === lo ? Math.max(Math.abs(lo) * .05, 1e-12) : (hi - lo) * .1;
    lo -= pad;
    hi += pad;
    const fx = v => log ? Math.log10(v) : v,
      start = fx(rows[0].frequency),
      end = fx(rows.at(-1).frequency),
      X = v => L + (fx(v) - start) / (end - start || 1) * (W - L - R),
      Y = v => H - B - (v - lo) / (hi - lo) * (H - B - T);
    for (let i = 0; i <= 4; i++) {
      const v = lo + (hi - lo) * i / 4,
        f = start + (end - start) * i / 4;
      svg += `<path d="M${L} ${Y(v)}H${W - R}" stroke="${colors.grid}"/><text x="${L - 7}" y="${Y(v) + 3}" text-anchor="end" fill="${colors.text}" font-size="10">${app.fmt(v)}</text><text x="${L + (W - L - R) * i / 4}" y="${H - 25}" text-anchor="middle" fill="${colors.text}" font-size="10">${app.fmt(log ? 10 ** f : f)}</text>`;
    }
    let path = '',
      pen = false;
    valid.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      path += (pen ? 'L' : 'M') + X(rows[i].frequency) + ' ' + Y(v) + ' ';
      pen = true;
    });
    svg += `<path d="${path}" fill="none" stroke="${colors.line}" stroke-width="2"/>`;
    valid.forEach((v, i) => {
      if (v !== null && Number.isFinite(v)) svg += `<circle data-bode-point="${i}" cx="${X(rows[i].frequency)}" cy="${Y(v)}" r="5" fill="${colors.point}" style="cursor:pointer"><title>${app.fmt(rows[i].frequency)} Hz · ${app.fmt(v)}</title></circle>`;
    });
    return svg + `<text x="${W - R}" y="${H - 5}" text-anchor="end" fill="${colors.text}" font-size="10">Excitation frequency · Hz${log ? ' · logarithmic axis' : ''}</text></svg>`;
  };
  app.drawBode = function drawBode() {
    if (!app.sweepResult?.results.length) return;
    app.$('bodeCard').hidden = false;
    const rs = app.sweepResult.results,
      imp = app.$('bodeQuantity').value === 'impedance';
    if (imp) {
      app.$('bodeHarmonic').value = '1';
      app.$('bodeNormalization').value = 'raw';
    }
    for (const id of ['bodeHarmonic', 'bodeReference', 'bodeNormalization']) app.$(id).disabled = imp;
    const spatial = !['terminalVoltage', 'current', 'impedance'].includes(app.$('bodeQuantity').value);
    app.$('bodeX').disabled = !spatial;
    app.$('bodeY').disabled = !spatial;
    const complex = app.$('bodeRepresentation').value === 'complex';
    // Real/imaginary parts are signed, so the dB scale does not apply to them.
    app.$('bodeScale').disabled = complex;
    app.$('bodeDb').disabled = complex || app.$('bodeScale').value !== 'db';
    // Imposed inactive references are unavailable; measured zeros can vary with frequency.
    for (const option of app.$('bodeReference').options) {
      const rows = TE.bodeRows(rs, {
        quantity: 'terminalVoltage',
        reference: option.value
      });
      option.disabled = rows.every(r => r.reason && /reference|inactive|Open circuit/i.test(r.reason));
    }
    if (!imp && app.$('bodeReference').selectedOptions[0]?.disabled) {
      app.$('bodeReference').value = 'time';
      app.$('bodeNormalization').value = 'raw';
    }
    app.$('bodeNormalization').options[1].disabled = app.$('bodeReference').value === 'time';
    app.$('bodeNormalization').options[2].disabled = app.$('bodeReference').value === 'time';
    if (app.$('bodeReference').value === 'time') app.$('bodeNormalization').value = 'raw';
    app.$('sweepStatus').textContent = `${rs.filter(r => r.converged).length}/${app.sweepResult.frequencies.length} converged · ${app.sweepResult.status}${app.worker ? ' · computation continues' : ''}.`;
    try {
      for (const id of ['bodeFloor', 'bodeX', 'bodeY']) TE.assert(app.$(id).value.trim() !== '', 'Complete Bode numerical inputs.');
      const rows = TE.bodeRows(rs, app.bodeOptions()),
        db = !complex && app.$('bodeScale').value === 'db',
        dbReference = Number(app.$('bodeDb').value);
      TE.assert(!db || Number.isFinite(dbReference) && dbReference > 0, 'The dB reference must be strictly positive.');
      const [top, bottom] = app.bodeCharts(rows, {
        representation: complex ? 'complex' : 'polar',
        log: app.sweepResult.config.sweep.spacing === 'log',
        db,
        dbReference
      });
      app.$('bodeMagnitude').innerHTML = top;
      app.$('bodePhase').innerHTML = bottom;
      const reasons = [...new Set(rows.map(r => r.reason).filter(Boolean))];
      app.$('bodeNote').textContent = `${spatial ? `Probe snaps to ${['temperature', 'voltage'].includes(app.$('bodeQuantity').value) ? 'node' : 'cell'} ${rows[0].nodeOrCell}: x=${app.fmt(rows[0].x_m * 1000)} mm, y=${app.fmt(rows[0].y_m * 1000)} mm. ` : ''}${reasons.join(' ')} Phase threshold applies to raw output amplitude; tiny harmonics need convergence checks.${complex ? ' Real/Imaginary parts use physical units; the dB scale applies only to magnitude.' : ''}`;
      app.$('bodeCsv').disabled = Boolean(app.worker) || app.inputsChanged;
    } catch (e) {
      app.$('bodeNote').textContent = e.message;
      app.$('bodeMagnitude').textContent = '';
      app.$('bodePhase').textContent = '';
      app.$('bodeCsv').disabled = true;
    }
  };
})(globalThis.TEApp);
