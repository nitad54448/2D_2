(function (app) {
  'use strict';
  app.notice = function notice(text, error = false) {
    app.$('status').textContent = text;
    app.$('badge').textContent = error ? 'ERROR' : 'READY';
    app.$('badge').className = error ? 'error' : '';
  };
  app.dirty = function dirty() {
    if (app.worker) return;
    app.$('exportProfile').disabled = true;
    app.$('badge').textContent = app.result ? 'INPUTS CHANGED' : 'READY';
    app.$('badge').className = '';
    app.$('exportResults').disabled = true;
    app.$('exportCsv').disabled = true;
    for (const id of ['exportMenuButton', 'exportPdf', 'exportZip']) app.$(id).disabled = true;
    app.$('exportMenu').hidden = true;
    app.$('exportMenuButton').setAttribute('aria-expanded', 'false');
    if (app.result) app.$('status').textContent = 'Inputs changed. Run again to update the displayed result.';
  };
  app.tab = function tab(name) {
    document.querySelectorAll('[role=tab]').forEach(t => {
      const active = t.dataset.tab === name;
      t.setAttribute('aria-selected', active);
      t.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[role=tabpanel]').forEach(p => p.hidden = p.id !== name);
    requestAnimationFrame(() => {
      if (name === 'geometry') app.drawGeometry();
      if (name === 'results') {
        app.drawResults();
        app.drawProfile();
        app.drawBode();
      }
    });
  };
  document.querySelectorAll('[role=tab]').forEach(t => {
    t.onclick = () => app.tab(t.dataset.tab);
    t.onkeydown = e => {
      const tabs = [...document.querySelectorAll('[role=tab]')],
        i = tabs.indexOf(t);
      let next;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i + tabs.length - 1) % tabs.length];
      if (e.key === 'Home') next = tabs[0];
      if (e.key === 'End') next = tabs.at(-1);
      if (next) {
        e.preventDefault();
        app.tab(next.dataset.tab);
        next.focus();
      }
    };
  });
  app.$('geometryCanvas').onpointerdown = e => {
    app.paint = true;
    app.$('geometryCanvas').setPointerCapture(e.pointerId);
    app.paintAt(e);
  };
  app.$('geometryCanvas').onpointermove = e => {
    if (app.paint) app.paintAt(e);
  };
  app.$('geometryCanvas').onpointerup = () => app.paint = false;
  app.$('geometryCanvas').onpointercancel = () => app.paint = false;
  app.$('palette').onclick = e => {
    const b = e.target.closest('[data-select]');
    if (b) {
      app.selected = Number(b.dataset.select);
      app.palette();
    }
  };
  app.$('applyGrid').onclick = app.applyMesh;
  app.$('fill').onclick = app.fillMaterial;
  app.$('addMaterial').onclick = app.addMaterial;
  app.$('materialFilesButton').onclick = () => app.$('materialFiles').click();
  app.$('materialFiles').onchange = app.importMaterialJson;
  app.$('presetMaterial').onchange = async () => {
    const select = app.$('presetMaterial');
    const file = select.value;
    if (!file) return;
    try {
      TE.assert(!app.worker && !app.importingProject, 'Wait until the current operation finishes.');
      app.config = app.read();
      TE.assert(app.config.materials.length < 12, 'Maximum 12 materials.');
      const res = await fetch('lib/' + file);
      if (!res.ok) throw new Error('Could not load preset.');
      const material = app.parseMaterialJson(await res.text());
      app.config.materials.push(material);
      app.materialsForm();
      app.drawGeometry();
      app.dirty();
      app.validateUI();
    } catch (e) {
      app.notice(e.message, true);
    } finally {
      select.value = '';
    }
  };
  app.$('materials').addEventListener('click', e => {
    const btn = e.target.closest('.remove-material');
    if (btn) app.removeMaterial(Number(btn.dataset.remove));
  });
  app.$('resultCanvas').onclick = e => {
    if (!app.result || !app.resultFrame) return;
    const r = app.$('resultCanvas').getBoundingClientRect(),
      f = app.resultFrame,
      c = app.result.config,
      x = (e.clientX - r.left - f.left) / f.w,
      y = 1 - (e.clientY - r.top - f.top) / f.h;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    app.probe = Math.round(y * c.ny) * (c.nx + 1) + Math.round(x * c.nx);
    app.drawResults();
  };
  for (const id of ['field', 'harmonic', 'representation', 'arrows']) app.$(id).onchange = app.drawResults;
  for (const id of ['profileField', 'profileTime']) app.$(id).addEventListener('input', app.drawProfile);
  app.$('excitationMode').addEventListener('change', app.modes);
  app.$('exportProfile').onclick = () => {
    if (app.result) return app.$('exportZip').onclick();
  };
  app.$('run').onclick = app.runSimulation;
  app.$('cancel').onclick = app.cancelSimulation;
  // Sweep selections always refer to the saved computed model.

  app.$('sweepPoint').onchange = () => app.selectSweepPoint(Number(app.$('sweepPoint').value));
  for (const id of ['bodeQuantity', 'bodeHarmonic', 'bodeRepresentation', 'bodeReference', 'bodeNormalization', 'bodeScale', 'bodeDb', 'bodeX', 'bodeY', 'bodeFloor', 'bodeUnwrap']) app.$(id).addEventListener('input', app.drawBode);
  for (const id of ['bodeMagnitude', 'bodePhase']) app.$(id).onclick = e => {
    const node = e.target.closest('[data-bode-point]');
    if (node) app.selectSweepPoint(Number(node.dataset.bodePoint));
  };
  app.$('bodeCsv').onclick = () => {
    try {
      app.download('thermoelectric-bode.csv', TE.bodeCsv(TE.bodeRows(app.sweepResult.results, app.bodeOptions())), 'text/csv');
    } catch (e) {
      app.$('bodeNote').textContent = e.message;
    }
  };
  app.$('save').onclick = app.exportModel;
  app.$('exportMenuButton').onclick = () => {
    const open = app.$('exportMenu').hidden;
    app.$('exportMenu').hidden = !open;
    app.$('exportMenuButton').setAttribute('aria-expanded', String(open));
  };
  app.$('exportPdf').onclick = app.exportPdf;
  app.$('exportZip').onclick = app.exportZip;
  app.$('exportResults').onclick = app.exportResults;
  app.$('exportCsv').onclick = app.exportSpectrum;
  app.$('importProject').onclick = () => app.$('projectFile').click();
  app.$('projectFile').onchange = app.importProject;
  app.$('import').onclick = () => app.$('file').click();
  app.$('file').onchange = app.importModel;
  app.$('preset').onchange = app.loadPreset;
  document.querySelectorAll('.settings').forEach(e => {
    e.addEventListener('input', event => {
      if (event.target.type === 'number') {
        delete event.target.dataset.rawNumber;
        delete event.target.dataset.displayNumber;
      }
      app.modes();
      app.dirty();
      app.meshPreview();
      app.validateUI();
    });
    e.addEventListener('change', () => {
      app.modes();
      try {
        app.config = app.read();
        app.palette();
        app.drawGeometry();
      } catch {}
      app.dirty();
      app.meshPreview();
      app.validateUI();
    });
  });
  // Normalize completed numeric edits, retaining the full raw number behind the display.
  document.addEventListener('focusout', e => {
    if (e.target.matches('input[type=number]') && e.target.value.trim() !== '') {
      try {
        TE.setNumberInput(e.target, TE.readNumberInput(e.target));
        app.meshPreview();
        app.validateUI();
      } catch {}
    }
  });
  window.addEventListener('resize', () => {
    clearTimeout(app.timer);
    app.timer = setTimeout(() => {
      app.drawGeometry();
      app.drawResults();
      app.drawProfile();
      app.drawBode();
    }, 120);
  });

  const initPresets = async () => {
    const fallback = ["Aluminum.json", "Bi2Te3.json", "Bi2Te3_n_type.json", "Copper.json", "Gold.json", "PbTe.json", "Platinum.json"];
    let files = fallback;
    try {
      const res = await fetch('lib/index.json');
      if (res.ok) files = (await res.json()).files || fallback;
    } catch {}
    const select = app.$('presetMaterial');
    if (select) {
      select.innerHTML += files.map(f => {
        const name = f.replace('.json', '').replace(/_/g, ' ');
        return `<option value="${app.esc(f)}">${app.esc(name)}</option>`;
      }).join('');
    }
  };
  initPresets();

  app.fill();
  globalThis.TE_APP_READY = true;
})(globalThis.TEApp);
