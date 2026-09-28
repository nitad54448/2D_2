(function (app) {
  'use strict';
  app.captureResultView = function captureResultView() {
    const r = app.result, c = r?.config;
    return {
      field: app.$('field').value,
      harmonic: Number(app.$('harmonic').value),
      representation: app.$('representation').value,
      arrows: app.$('arrows').checked,
      profileField: app.$('profileField').value,
      timeFraction: r && r.method !== 'steady' ? Number(app.$('profileTime').value) / r.samples : 0,
      probe: app.probe,
      x: c ? (app.probe % (c.nx + 1)) / c.nx : .5,
      y: c ? Math.floor(app.probe / (c.nx + 1)) / c.ny : .5
    };
  };
  app.restoreResultView = function restoreResultView(view, r) {
    for (const id of ['field', 'representation', 'profileField']) if (view[id] !== undefined) app.$(id).value = view[id];
    app.$('harmonic').value = String(r.method === 'steady' ? 0 : view.harmonic ?? 0);
    if (view.arrows !== undefined) app.$('arrows').checked = view.arrows;
    // Set max before value: range inputs otherwise clamp the restored sample to the old max.
    app.$('profileTime').max = r.method === 'steady' ? 0 : r.samples - 1;
    app.$('profileTime').value = String(r.method === 'steady' ? 0 : Math.min(r.samples - 1, Math.round((view.timeFraction ?? 0) * r.samples)));
    if (view.x !== undefined && view.y !== undefined) app.probe = Math.round(view.y * r.config.ny) * (r.config.nx + 1) + Math.round(view.x * r.config.nx);
    else if (view.probe !== undefined) app.probe = view.probe;
  };
  app.restoreBodeOptions = function restoreBodeOptions(o) {
    if (!o) return;
    for (const [id, value] of Object.entries({bodeQuantity: o.quantity, bodeHarmonic: o.harmonic,
      bodeReference: o.reference, bodeNormalization: o.normalization, bodeFloor: o.phaseFloor,
      bodeUnwrap: o.unwrap ? 'unwrapped' : 'wrapped', bodeX: 100 * o.x, bodeY: 100 * o.y,
      bodeScale: o.scale, bodeDb: o.dbReference, bodeRepresentation: o.representation ?? 'polar'})) {
      const e = app.$(id);
      if (e.type === 'number') TE.setNumberInput(e, value); else e.value = String(value);
    }
  };
  app.importProject = async function importProject() {
    const file = app.$('projectFile').files[0];
    if (!file || app.worker || app.importingProject) return;
    if (app.exporting) { app.notice('Wait for the current ZIP export to finish, then import the project.'); app.$('projectFile').value = ''; return; }
    app.importingProject = true;
    const main = document.querySelector('main'), wasInert = main.inert;
    main.inert = true;
    app.$('status').textContent = 'Reading and checking project archive…';
    try {
      // Parse and validate everything before replacing the current model/results.
      const project = await TE.readProjectZip(file);
      app.config = JSON.parse(JSON.stringify(project.config));
      app.selected = 0;
      app.checkpoint = null;
      app.activeSweep = null;
      app.sweepResult = project.sweep;
      app.fill();
      app.restoreBodeOptions(project.bodeOptions);
      app.$('bodeCard').hidden = !project.sweep;
      if (project.sweep) {
        app.refreshSweepPoints();
        app.$('sweepPoint').value = String(project.selected);
      }
      app.accept(project.result);
      app.restoreResultView(project.view, project.result);
      app.drawResults(); app.drawProfile(); app.drawBode();
      app.$('elapsed').textContent = '';
      app.$('badge').className = '';
      app.$('badge').textContent = project.sweep ? 'PROJECT · SWEEP' : project.result.converged ? 'PROJECT · CONVERGED' : 'PROJECT · UNCONVERGED';
      app.$('status').textContent = project.sweep
        ? `Imported project: ${project.sweep.results.length}/${project.sweep.frequencies.length} frequency points retained (${project.sweep.status}). Saved results are ready to inspect and export.`
        : `Imported project. ${project.result.converged ? 'Converged' : 'Unconverged, provisional'} saved results are ready to inspect and export.`;
    } catch (error) {
      app.notice('Project import failed: ' + error.message, true);
    } finally {
      app.importingProject = false;
      main.inert = wasInert;
      app.$('projectFile').value = '';
    }
  };
})(globalThis.TEApp);
