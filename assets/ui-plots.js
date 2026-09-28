(function (app) {
  'use strict';
  app.canvasFrame = function canvasFrame(id, c) {
    const canvas = app.$(id),
      width = canvas.clientWidth || 700,
      height = canvas.clientHeight || 400,
      dpr = devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    let w = width - 80,
      h = height - 65;
    if (w / h > c.lx / c.ly) w = h * c.lx / c.ly;else h = w * c.ly / c.lx;
    const left = 50 + (width - 80 - w) / 2,
      top = 22 + (height - 65 - h) / 2;
    ctx.fillStyle = '#839aa9';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText(app.fmt(c.lx * 1000 * i / 4), left + w * i / 4, top + h + 19);
      ctx.textAlign = 'right';
      ctx.fillText(app.fmt(c.ly * 1000 * i / 4), left - 9, top + h - h * i / 4 + 3);
      ctx.textAlign = 'center';
    }
    ctx.fillText('x · mm', left + w / 2, top + h + 37);
    ctx.textAlign = 'left';
    ctx.fillText('y · mm', left - 25, top - 9);
    return {
      ctx,
      left,
      top,
      w,
      h
    };
  };
  app.contacts = function contacts(frame, c) {
    const {
      ctx,
      left,
      top,
      w,
      h
    } = frame;
    ctx.lineWidth = 5;
    for (const name of ['source', 'sink']) {
      const side = c.electrical[name + 'Side'],
        range = c.electrical[name + 'Range'],
        count = ['left', 'right'].includes(side) ? c.ny : c.nx,
        start = Math.ceil(range[0] * count - 1e-10) / count,
        end = Math.floor(range[1] * count + 1e-10) / count;
      ctx.strokeStyle = name === 'source' ? '#ffffff' : '#e47cd3';
      ctx.beginPath();
      if (side === 'left' || side === 'right') {
        const x = left + (side === 'right' ? w : 0);
        ctx.moveTo(x, top + h * (1 - start));
        ctx.lineTo(x, top + h * (1 - end));
      } else {
        const y = top + (side === 'bottom' ? h : 0);
        ctx.moveTo(left + w * start, y);
        ctx.lineTo(left + w * end, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  };
  app.drawGeometry = function drawGeometry() {
    if (app.$('geometry').hidden) return;
    const c = app.config,
      f = app.canvasFrame('geometryCanvas', c);
    app.geomFrame = f;
    const {
      ctx,
      left,
      top,
      w,
      h
    } = f;
    for (let j = 0; j < c.ny; j++) for (let i = 0; i < c.nx; i++) {
      ctx.fillStyle = c.materials[c.materialMap[j * c.nx + i]]?.color || '#aaa';
      ctx.globalAlpha = .75;
      ctx.fillRect(left + i * w / c.nx, top + (c.ny - 1 - j) * h / c.ny, w / c.nx, h / c.ny);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0b141d';
      ctx.strokeRect(left + i * w / c.nx, top + (c.ny - 1 - j) * h / c.ny, w / c.nx, h / c.ny);
    }
    app.contacts(f, c);
    app.$('gridInfo').textContent = `${c.nx} × ${c.ny} = ${c.nx * c.ny} elements · ${(c.nx + 1) * (c.ny + 1)} nodes`;
  };
  app.color = function color(t) {
    const stops = [[24, 44, 89], [36, 107, 153], [87, 182, 173], [227, 193, 110], [244, 141, 75]],
      u = Math.max(0, Math.min(1, t)) * 4,
      i = Math.min(3, Math.floor(u)),
      f = u - i;
    return `rgb(${stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f)).join(',')})`;
  };
  app.chart = function chart(id, x, y, label, xLabel = 'Time · ms') {
    const el = app.$(id),
      W = el.clientWidth || 450,
      H = 210,
      L = 65,
      R = 15,
      T = 20,
      B = 38;
    let lo = Math.min(...y),
      hi = Math.max(...y);
    if (hi - lo < 1e-12 * Math.max(1, Math.abs(hi))) {
      lo -= Math.max(1e-8, Math.abs(hi) * 1e-5);
      hi += Math.max(1e-8, Math.abs(hi) * 1e-5);
    } else {
      const d = (hi - lo) * .12;
      lo -= d;
      hi += d;
    }
    const X = v => L + (v - x[0]) / (x.at(-1) - x[0] || 1) * (W - L - R),
      Y = v => H - B - (v - lo) / (hi - lo) * (H - B - T);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${app.esc(label)}"><text x="${L}" y="11" fill="#8299a8" font-size="9">${app.esc(label)}</text>`;
    for (let i = 0; i < 5; i++) {
      const v = lo + (hi - lo) * i / 4,
        xx = x[0] + (x.at(-1) - x[0]) * i / 4;
      s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#293b49" stroke-dasharray="3 5"/><text x="${L - 8}" y="${Y(v) + 3}" text-anchor="end" fill="#8299a8" font-size="9">${app.fmt(v)}</text><text x="${X(xx)}" y="${H - 18}" text-anchor="middle" fill="#8299a8" font-size="9">${app.fmt(xx)}</text>`;
    }
    if (x.length === 1) s += `<circle cx="${X(x[0])}" cy="${Y(y[0])}" r="3" fill="#73d8d0"/>`;
    el.innerHTML = s + `<path d="${x.map((v, i) => `${i ? 'L' : 'M'}${X(v)},${Y(y[i])}`).join(' ')}" fill="none" stroke="#73d8d0" stroke-width="2"/><text x="${W - R}" y="${H - 2}" text-anchor="end" fill="#8299a8" font-size="9">${app.esc(xLabel)}</text></svg>`;
  };
  app.drawResults = function drawResults() {
    if (!app.result || app.$('results').hidden) return;
    const r = app.result,
      c = r.config,
      periodic = r.method !== 'steady',
      n = periodic ? Number(app.$('harmonic').value) : 0,
      field = app.$('field').value,
      representation = app.$('representation').value;
    const valuesFor = key => periodic ? r.harmonics[key][n] : r[key].map(v => ({
      re: v,
      im: 0
    }));
    const vecX = valuesFor('Jx'),
      vecY = valuesFor('Jy');
    let values;
    if (field === 'J') {
      values = vecX.map((z, i) => Math.hypot(app.amp(z), app.amp(vecY[i])));
      app.$('representation').disabled = true;
    } else {
      const z = valuesFor(field);
      values = z.map(z => n ? representation === 'phase' ? app.phase(z) : representation === 'real' ? z.re : app.amp(z) : z.re);
      app.$('representation').disabled = !n;
    }
    // Keep the user's harmonic representation when temporarily viewing DC or |J|.
    app.$('representationHelp').textContent = field === 'J' ? 'Current magnitude uses the vector norm; phase and real-part selection do not apply.' : !n ? 'DC is the signed mean value. Select 1ω, 2ω or 3ω to view peak amplitude, phase or real part.' : 'Amplitude is the peak magnitude of this harmonic (not RMS). Phase and real part use the cosine reference. For signed Peltier heating/cooling under AC, select temperature at 1ω and Real part; amplitude removes its sign.';
    const nodeField = field === 'temperature' || field === 'voltage',
      isPhase = n && representation === 'phase' && field !== 'J',
      unit = isPhase ? '°' : field === 'temperature' ? 'K' : field === 'voltage' ? 'V' : ['qx', 'qy'].includes(field) ? 'W/m²' : 'A/m²';
    let lo = values.reduce((a, b) => Math.min(a, b), Infinity),
      hi = values.reduce((a, b) => Math.max(a, b), -Infinity);
    if (isPhase) {
      lo = -180;
      hi = 180;
    }
    const phaseMap = isPhase ? TE.phaseMap(r, field, n) : null;
    const f = app.canvasFrame('resultCanvas', c);
    app.resultFrame = f;
    const {
      ctx,
      left,
      top,
      w,
      h
    } = f;
    for (let j = 0; j < c.ny; j++) for (let i = 0; i < c.nx; i++) {
      const idx = j * c.nx + i;
      let v = values[idx];
      if (nodeField) {
        const a = j * (c.nx + 1) + i;
        const ids = [a, a + 1, a + c.nx + 1, a + c.nx + 2];
        if (!isPhase) v = ids.reduce((s, id) => s + values[id], 0) / 4;
      }
      if (isPhase) v = phaseMap.values[idx];
      ctx.fillStyle = v === null ? '#56616d' : app.color(hi === lo ? .5 : (v - lo) / (hi - lo));
      ctx.fillRect(left + i * w / c.nx, top + (c.ny - 1 - j) * h / c.ny, w / c.nx + .4, h / c.ny + .4);
    }
    if (app.$('arrows').checked) {
      const vmax = vecX.reduce((s, z, i) => Math.max(s, Math.hypot(z.re, vecY[i].re)), 0),
        stride = Math.max(1, Math.ceil(Math.max(c.nx, c.ny) / 18));
      if (vmax > TE.arrowNoiseFloor(r)) {
        ctx.strokeStyle = '#f8fafc';
        ctx.fillStyle = '#f8fafc';
        ctx.lineWidth = 1.15;
        for (let j = 0; j < c.ny; j += stride) for (let i = 0; i < c.nx; i += stride) {
          const k = j * c.nx + i,
            u = vecX[k].re,
            v = vecY[k].re,
            length = Math.hypot(u, v);
          if (length < vmax * .005) continue;
          const L = Math.min(w / c.nx, h / c.ny) * stride * .72 * Math.sqrt(length / vmax),
            dx = u / length * L,
            dy = -v / length * L,
            x = left + (i + .5) * w / c.nx,
            y = top + (c.ny - j - .5) * h / c.ny;
          ctx.beginPath();
          ctx.moveTo(x - dx / 2, y - dy / 2);
          ctx.lineTo(x + dx / 2, y + dy / 2);
          ctx.stroke();
          const a = Math.atan2(dy, dx),
            tipx = x + dx / 2,
            tipy = y + dy / 2;
          ctx.beginPath();
          ctx.moveTo(tipx, tipy);
          ctx.lineTo(tipx - 4 * Math.cos(a - .5), tipy - 4 * Math.sin(a - .5));
          ctx.lineTo(tipx - 4 * Math.cos(a + .5), tipy - 4 * Math.sin(a + .5));
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    app.contacts(f, c);
    const pi = app.probe % (c.nx + 1),
      pj = Math.floor(app.probe / (c.nx + 1));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(left + pi / c.nx * w, top + h - pj / c.ny * h, 5, 0, 2 * Math.PI);
    ctx.stroke();
    app.$('scaleMin').textContent = TE.formatInputNumber(lo);
    app.$('scaleMax').textContent = TE.formatInputNumber(hi);
    app.$('scaleUnit').textContent = unit;
    app.$('fieldCaption').textContent = `${app.$('field').selectedOptions[0].text} · ${n ? n + 'ω' : 'DC'}${n ? ' · ' + (field === 'J' ? 'vector amplitude' : representation) : ''} · ${nodeField ? 'nodal values averaged per cell' : 'cell-centered field'}${isPhase ? ` · gray: ${phaseMap.masked} cells at/below ${app.fmt(phaseMap.threshold)} field units` : ''}`;
    app.$('vectorNote').textContent = 'Arrows: real current phasor at 0° (direction and relative magnitude). White = source electrode; pink = sink. Click to move the probe. Vectors below 1E-8 of the strongest current harmonic (or 1E-12 A/m²) are hidden to avoid magnifying numerical noise.';
    app.$('probeLabel').textContent = `x = ${app.fmt(pi * c.lx / c.nx * 1000)} mm, y = ${app.fmt(pj * c.ly / c.ny * 1000)} mm`;
    app.$('timeCharts').hidden = !periodic;
    if (periodic) {
      const thermal = TE.historyForPlot(r, r.temperature.map(T => T[app.probe])),
        electric = TE.historyForPlot(r, r.terminalVoltage.map(v => v * 1000));
      app.chart('probeChart', thermal.time, thermal.values, 'Temperature · K');
      app.chart('voltageChart', electric.time, electric.values, 'Voltage · mV');
    } else {
      app.$('probeChart').textContent = `Steady temperature: ${r.temperature[app.probe].toFixed(6)} K`;
      app.$('voltageChart').textContent = `Steady terminal voltage: ${r.terminalVoltage.toExponential(6)} V`;
    }
  };
  app.drawProfile = function drawProfile() {
    if (!app.result || app.$('results').hidden) return;
    const r = app.result,
      c = r.config,
      periodic = r.method !== 'steady';
    app.$('profileTimeControls').hidden = !periodic;
    app.$('profileTime').max = periodic ? r.samples - 1 : 0;
    const sample = periodic ? Number(app.$('profileTime').value) : 0,
      field = app.$('profileField').value,
      surface = TE.surfaceField(r, field, sample),
      lo = Math.min(...surface.cells),
      hi = Math.max(...surface.cells),
      f = app.canvasFrame('profileCanvas', c),
      {
        ctx,
        left,
        top,
        w,
        h
      } = f;
    for (let j = 0; j < c.ny; j++) for (let i = 0; i < c.nx; i++) {
      const v = surface.cells[j * c.nx + i];
      ctx.fillStyle = app.color(hi === lo ? .5 : (v - lo) / (hi - lo));
      ctx.fillRect(left + i * w / c.nx, top + (c.ny - j - 1) * h / c.ny, w / c.nx + .4, h / c.ny + .4);
    }
    app.contacts(f, c);
    app.$('surfaceMin').textContent = TE.formatInputNumber(lo);
    app.$('surfaceMax').textContent = TE.formatInputNumber(hi);
    app.$('surfaceUnit').textContent = surface.unit;
    app.$('profileCaption').textContent = (periodic ? `t = ${app.fmt(r.time[sample] * 1000)} ms · phase ${app.fmt(360 * r.frequency * r.time[sample])}° · sample ${sample + 1}/${r.samples}` : 'DC stationary') + ` · ${surface.nodal ? 'nodal values averaged per cell' : 'cell-centered values'}` + (r.converged ? '' : ' · UNCONVERGED');
  };
})(globalThis.TEApp);
