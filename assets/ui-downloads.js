(function (app) {
  'use strict';
  app.sweepReport = function sweepReport(s, r, options = app.bodeOptions(), reportProbe = app.probe) {
    TE.assert(options.scale !== 'db' || Number.isFinite(options.dbReference) && options.dbReference > 0, 'The dB reference must be strictly positive.');
    const rows = TE.bodeRows(s.results, options),
      report = TE.resultReport(r, {
        probe: reportProbe
      }),
      opts = {
        log: s.config.sweep.spacing === 'log',
        db: options.scale === 'db',
        dbReference: options.dbReference ?? 1
      };
    const page = `<section class="page"><header>THERMOELECTRIC LAB · FREQUENCY SWEEP</header><h1>Bode summary</h1><p>${app.esc(s.status)} · ${s.results.filter(r => r.converged).length}/${s.frequencies.length} converged points. Detailed report below: ${app.fmt(r.frequency)} Hz.</p><p>Quantity: ${app.esc(options.quantity)} · harmonic ${options.harmonic} · reference ${app.esc(options.reference)} · normalization ${app.esc(options.normalization)} · phase threshold ${options.phaseFloor}. Phase ${options.unwrap ? 'unwrapped' : 'wrapped'}.</p><p>Table magnitudes use physical units; graphs follow the selected scale. dB reference: ${app.fmt(options.dbReference ?? 1)} in module units.</p><p>Probe X/Y: ${app.fmt(options.x * 100)}% / ${app.fmt(options.y * 100)}%. Impedance is (source − sink voltage) / current at 1ω. Other phases subtract n times the reference phase. Unconverged points are excluded.</p>${app.bodeSvg(rows, 'magnitude', opts)}${app.bodeSvg(rows, 'phase', opts)}<table><thead><tr><th>Hz</th><th>Module</th><th>Unit</th><th>Phase °</th><th>Status</th></tr></thead><tbody>${rows.map(v => `<tr><td>${app.fmt(v.frequency)}</td><td>${v.magnitude === null ? '—' : app.fmt(v.magnitude)}</td><td>${app.esc(v.unit)}</td><td>${v.phase === null ? '—' : app.fmt(v.phase)}</td><td>${app.esc(v.reason || 'Converged')}</td></tr>`).join('')}</tbody></table></section>`;
    report.html = report.html.replace('<section class="page">', page + '<section class="page">');
    return report;
  };
  app.sweepFiles = async function sweepFiles(s, options, selected, selectedProbe) {
    const rows = TE.bodeRows(s.results, options),
      report = app.sweepReport(s, selected, options, selectedProbe);
    const files = [{
      name: 'sweep-model.json',
      data: JSON.stringify(s.config, null, 2)
    }, {
      name: 'sweep-status.json',
      data: JSON.stringify({
        status: s.status,
        message: s.message,
        requestedFrequencies: s.frequencies,
        retainedFrequencies: s.results.map(r => r.frequency),
        bodeOptions: options
      }, null, 2)
    }, {
      name: 'bode.csv',
      data: TE.bodeCsv(rows)
    }, {
      name: 'report.html',
      data: report.html
    }];
    for (let i = 0; i < s.results.length; i++) {
      const part = await TE.completeResultsFiles(s.results[i], {
        probe: selectedProbe
      });
      for (const file of part) files.push({
        name: `frequency-${String(i + 1).padStart(3, '0')}/` + file.name,
        data: file.data
      });
    }
    files.push({
      name: 'README.txt',
      data: 'Frequency sweep results. Each frequency-NNN folder contains the complete model, all field histories, harmonics, CSV, SVG and printable report for that point. Root report.html contains the Bode summary and the selected frequency detailed report. bode.csv records physical magnitudes and the selected phase/normalization settings are in sweep-status.json. Only the last complete cycle per frequency is retained. Unconverged cycles are retained but excluded from Bode. Requested but uncomputed frequencies are recorded in sweep-status.json.\n'
    });
    return files;
  };
  app.download = function download(name, data, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([data], {
        type
      })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  app.exportModel = () => {
    try {
      app.download('thermoelectric-2d-model.json', JSON.stringify(app.applyGeometry(), null, 2));
    } catch (e) {
      app.notice(e.message, true);
    }
  };
  app.exportPdf = () => {
    if (!app.result) return;
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      app.$('exportStatus').textContent = 'Allow pop-ups for this page, then try the PDF report again.';
      return;
    }
    try {
      const report = app.sweepResult?.results.includes(app.result) ? app.sweepReport(app.sweepResult, app.result) : TE.resultReport(app.result, {
        probe: app.probe
      });
      reportWindow.opener = null;
      reportWindow.document.open();
      reportWindow.document.write(report.html);
      reportWindow.document.close();
      app.$('exportStatus').textContent = 'Full report opened. Click Save as PDF / Print and select Save as PDF.';
    } catch (e) {
      reportWindow.close();
      app.$('exportStatus').textContent = 'Report export failed: ' + e.message;
    }
  };
  app.exportZip = async () => {
    if (!app.result || app.exporting || app.importingProject) return;
    app.exporting = true;
    const saved = app.result,
      savedProbe = app.probe,
      savedSweep = app.sweepResult?.results.includes(app.result) ? {
        ...app.sweepResult,
        results: [...app.sweepResult.results]
      } : null,
      savedOptions = savedSweep ? app.bodeOptions() : null,
      savedView = app.captureResultView();
    app.$('exportZip').disabled = true;
    app.$('exportStatus').textContent = 'Preparing complete results archive…';
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (savedOptions) TE.validateProjectBode(savedOptions);
      const files = savedSweep ? await app.sweepFiles(savedSweep, savedOptions, saved, savedProbe) : await TE.completeResultsFiles(saved, {
        probe: savedProbe
      });
      files.push({name: 'project.json', data: JSON.stringify({
        format: 'thermoelectric-lab-project', version: 1,
        kind: savedSweep ? 'sweep' : 'single',
        selectedIndex: savedSweep ? savedSweep.results.indexOf(saved) : 0,
        view: savedView, bodeOptions: savedOptions
      }, null, 2)});
      const manifest = files.find(f => f.name === 'manifest.json');
      if (manifest) { const data = JSON.parse(manifest.data); data.files.push('project.json'); manifest.data = JSON.stringify(data, null, 2); }
      const readme = files.find(f => f.name === 'README.txt');
      if (readme) readme.data += '\nReopen this ZIP using Import Project in Thermoelectric Lab. It restores the saved model, all retained results, and the selected view. No recalculation is required.\n';
      const jsonBytes = files.filter(f => f.name.endsWith('.json')).reduce((sum, f) => sum + new Blob([f.data]).size, 0);
      TE.assert(jsonBytes <= TE.projectLimits.jsonBytes, 'Project JSON exceeds the import limit. Reduce retained sweep points or time steps.');
      const zip = await TE.zipFiles(files);
      TE.assert(zip.size <= TE.projectLimits.archiveBytes, 'Project ZIP exceeds the 2 GiB import limit. Reduce retained sweep points or time steps.');
      const now = new Date(),
        pad = value => String(value).padStart(2, '0'),
        date = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-'),
        time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-');
      app.download(`TE_2D_${date}_${time}.zip`, zip, 'application/zip');
      app.$('exportStatus').textContent = 'Project ZIP downloaded. Use Import Project to reopen the model, saved results and view. Reports, SVG figures and CSV data are also included.';
    } catch (e) {
      app.$('exportStatus').textContent = 'ZIP export failed: ' + e.message;
    } finally {
      app.exporting = false;
      app.$('exportZip').disabled = app.$('exportMenuButton').disabled;
    }
  };
  app.exportResults = () => {
    if (app.result) app.download('thermoelectric-2d-results.json', JSON.stringify(app.sweepResult?.results.includes(app.result) ? app.sweepResult : app.result));
  };
  app.exportSpectrum = () => {
    if (!app.result) return;
    const hs = app.result.method === 'steady' ? [{
      re: app.result.terminalVoltage,
      im: 0
    }] : app.result.harmonics.terminalVoltage;
    app.download('thermoelectric-2d-spectrum.csv', ['harmonic,frequency_Hz,peak_V,phase_deg,real_V,imag_V,converged,completed_cycles', ...hs.map((z, n) => [n, n * (app.result.frequency ?? 0), app.amp(z), app.amp(z) > 1e-16 ? app.phase(z) : '', z.re, z.im, app.result.converged, app.result.periods ?? 0].join(','))].join('\n'), 'text/csv');
  };
})(globalThis.TEApp);
