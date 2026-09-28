(function (app) {
  'use strict';
  app.numberAttrs = function numberAttrs(value) {
    return `value="${app.esc(TE.formatInputNumber(value))}" data-raw-number="${app.esc(value)}" data-display-number="${app.esc(TE.formatInputNumber(value))}"`;
  };
  app.input = function input(label, key, value, unit = '') {
    return `<label>${label}<span>${unit}</span><input data-key="${key}" type="number" step="any" required ${['rho', 'Cp', 'k', 'sigma', 'h'].includes(key) ? 'min="0"' : ''} ${app.numberAttrs(value)}></label>`;
  };
  app.materialsForm = function materialsForm() {
    const canRemove = app.config.materials.length > 1;
    app.$('materialCards').innerHTML = app.config.materials.map((m, i) => `<div class="material-card" data-material="${i}" style="--material-color:${/^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#73d8d0'}"><div class="name-row"><label>Material ${i + 1}<input data-key="name" value="${app.esc(m.name)}"></label><label>Color<input type="color" data-key="color" value="${app.esc(m.color)}"></label><button type="button" class="remove-material" data-remove="${i}" title="Remove material" ${canRemove ? '' : 'disabled'}>✕</button></div><div class="grid2">${app.input('Density', 'rho', m.rho, 'kg/m³')}${app.input('Heat capacity', 'Cp', m.Cp, 'J/kg K')}${app.input('Thermal conductivity', 'k', m.k, 'W/m K')}${app.input('Electrical conductivity', 'sigma', m.sigma, 'S/m')}${app.input('Resistivity slope β', 'beta', m.beta ?? 0, '1/K')}${app.input('Seebeck α₃₀₀', 'alpha', m.alpha * 1e6, 'µV/K')}${app.input('Seebeck slope α′', 'alphaSlope', (m.alphaSlope ?? 0) * 1e6, 'µV/K²')}</div></div>`).join('');
    app.palette();
    if (app.updateMaterialCap) app.updateMaterialCap();
  };
  app.palette = function palette() {
    app.$('palette').innerHTML = app.config.materials.map((m, i) => `<button class="swatch ${i === app.selected ? 'active' : ''}" data-select="${i}" style="--swatch:${/^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#73d8d0'}"><i></i>${app.esc(m.name)}</button>`).join('');
  };
  app.boundaryForm = function boundaryForm() {
    app.$('electrodes').innerHTML = ['source', 'sink'].map(name => {
      const e = app.config.electrical;
      return `<div class="electrode"><h3>${name.toUpperCase()} ELECTRODE</h3><div class="grid3"><label>Side<select id="${name}Side">${['left', 'right', 'bottom', 'top'].map(side => `<option ${side === e[name + 'Side'] ? 'selected' : ''}>${side}</option>`).join('')}</select></label><label>Range start <span>%</span><input id="${name}Start" type="number" ${app.numberAttrs(100 * e[name + 'Range'][0])} min="0" max="100"></label><label>Range end <span>%</span><input id="${name}End" type="number" ${app.numberAttrs(100 * e[name + 'Range'][1])} min="0" max="100"></label></div></div>`;
    }).join('');
    app.$('thermalCards').innerHTML = ['left', 'right', 'bottom', 'top'].map(side => { const b = app.config.thermal[side]; return `<div class="thermal-card" data-side="${side}"><h3>${side.toUpperCase()}</h3><label>Condition<select data-key="kind">${['temperature', 'flux', 'convection'].map(k => `<option value="${k}" ${b.kind === k ? 'selected' : ''}>${{
      temperature: 'Temperature · K',
      flux: 'Outward total flux · W/m²',
      convection: 'Convection · ambient K'
    }[k]}</option>`).join('')}</select></label><div class="grid3">${app.input('DC value', 'bias', typeof b.value === 'number' ? b.value : b.value.bias ?? 0)}${app.input('AC peak', 'amplitude', typeof b.value === 'number' ? 0 : b.value.amplitude ?? 0)}${app.input('Phase', 'phase', typeof b.value === 'number' ? 0 : b.value.phase ?? 0, '°')}${app.input('Convection h', 'h', b.h ?? 0)}</div></div>`; }).join('');
  };
  app.fill = function fill() {
    app.$('modelNote').textContent = app.config.description ?? '';
    app.$('modelNote').hidden = !app.config.description;
    app.materialsForm();
    app.boundaryForm();
    const v = app.config.electrical.value;
    for (const [id, value] of Object.entries({
      lx: app.config.lx * 1000,
      ly: app.config.ly * 1000,
      depth: app.config.depth * 1000,
      nx: app.config.nx,
      ny: app.config.ny,
      electricalKind: app.config.electrical.kind,
      bias: typeof v === 'number' ? v : v.bias ?? 0,
      amplitude: typeof v === 'number' ? 0 : v.amplitude ?? 0,
      phase: typeof v === 'number' ? 0 : v.phase ?? 0,
      mode: app.config.mode,
      frequency: app.config.frequency,
      samples: app.config.samples,
      maxPeriods: app.config.maxPeriods
    })) {
      if (app.$(id).type === 'number') TE.setNumberInput(app.$(id), value);else app.$(id).value = value;
    }
    app.$('excitationMode').value = app.config.sweep?.enabled ? 'sweep' : app.config.mode === 'steady' || typeof v === 'number' || !(v.amplitude ?? 0) ? 'steady' : 'periodic';
    if (app.config.mode === 'steady') document.querySelectorAll('[data-side] [data-key="amplitude"]').forEach(e => TE.setNumberInput(e, 0));
    for (const [id, value] of Object.entries({
      sweepMin: app.config.sweep?.min ?? .1,
      sweepMax: app.config.sweep?.max ?? 100,
      sweepPoints: app.config.sweep?.points ?? 10
    })) TE.setNumberInput(app.$(id), value);
    app.$('sweepSpacing').value = app.config.sweep?.spacing ?? 'log';
    app.modes();
    app.drawGeometry();
    app.meshPreview();
    app.validateUI();
  };
  // Ignore fields whose boundary condition makes them inactive. Leave their
  // displayed values intact so switching back can restore the user's inputs.
  app.readBoundaryNumber = function readBoundaryNumber(element, inactiveValue = 0) {
    return element.disabled ? inactiveValue : TE.readNumberInput(element);
  };
  app.read = function read() {
    const c = JSON.parse(JSON.stringify(app.config));
    c.materials = [...document.querySelectorAll('[data-material]')].map(card => {
      const m = {};
      card.querySelectorAll('[data-key]').forEach(e => {
        TE.assert(e.value.trim() !== '', 'Complete material fields.');
        m[e.dataset.key] = ['name', 'color'].includes(e.dataset.key) ? e.value : TE.readNumberInput(e);
      });
      m.alpha /= 1e6;
      m.alphaSlope /= 1e6;
      return m;
    });
    for (const card of document.querySelectorAll('[data-side]')) {
      const v = {};
      card.querySelectorAll('[data-key]').forEach(e => {
        v[e.dataset.key] = e.dataset.key === 'kind' ? e.value : app.readBoundaryNumber(e, e.dataset.key === 'bias' ? 300 : 0);
      });
      c.thermal[card.dataset.side] = {
        kind: v.kind,
        value: {
          bias: v.bias,
          amplitude: v.amplitude,
          phase: v.phase
        },
        h: v.h
      };
    }
    c.electrical = {
      kind: app.$('electricalKind').value,
      value: {
        bias: app.readBoundaryNumber(app.$('bias')),
        amplitude: app.readBoundaryNumber(app.$('amplitude')),
        phase: app.readBoundaryNumber(app.$('phase'))
      }
    };
    for (const name of ['source', 'sink']) {
      c.electrical[name + 'Side'] = app.$(name + 'Side').value;
      c.electrical[name + 'Range'] = [app.num(name + 'Start') / 100, app.num(name + 'End') / 100];
    }
    c.sweep = app.$('excitationMode').value === 'sweep' ? {
      enabled: true,
      min: app.num('sweepMin'),
      max: app.num('sweepMax'),
      points: app.num('sweepPoints'),
      spacing: app.$('sweepSpacing').value
    } : {
      enabled: false
    };
    c.mode = TE.inferSimulationMode(c);
    c.frequency = c.sweep.enabled ? c.sweep.min : c.mode === 'periodic' ? app.num('frequency') : 0;
    c.samples = c.mode === 'periodic' ? app.num('samples') : 128;
    c.maxPeriods = c.mode === 'periodic' ? app.num('maxPeriods') : 100;
    return c;
  };
  app.modes = function modes() {
    const dc = app.$('excitationMode').value === 'steady',
      open = app.$('electricalKind').value === 'open_circuit';
    // DC disables the AC fields without erasing them, so switching back to AC restores them.
    // Disabled fields are read as 0 (readBoundaryNumber), so DC still solves without electrical AC.
    app.$('bias').disabled = open;
    app.$('amplitude').disabled = dc || open;
    app.$('phase').disabled = dc || open || Number(app.$('amplitude').value) === 0;
    const thermal = {};
    document.querySelectorAll('[data-side]').forEach(card => {
      const kind = card.querySelector('[data-key="kind"]').value,
        h = card.querySelector('[data-key="h"]'),
        a = card.querySelector('[data-key="amplitude"]'),
        bias = card.querySelector('[data-key="bias"]'),
        phase = card.querySelector('[data-key="phase"]');
      h.disabled = kind !== 'convection';
      const inactiveConvection = kind === 'convection' && h.value.trim() !== '' && Number(h.value) === 0;
      bias.disabled = inactiveConvection;
      // Thermal AC is independent of the electrical DC/AC selector.
      a.disabled = inactiveConvection;
      phase.disabled = inactiveConvection || Number(a.value) === 0;
      thermal[card.dataset.side] = {
        kind,
        h: Number(h.value),
        value: {
          amplitude: Number(a.value)
        }
      };
    });
    const mode = TE.inferSimulationMode({
      electrical: {
        kind: app.$('electricalKind').value,
        value: {
          amplitude: dc ? 0 : Number(app.$('amplitude').value)
        }
      },
      thermal
    });
    app.$('mode').value = mode;
    app.$('solverMethod').textContent = mode === 'steady' ? 'DC stationary' : 'Periodic';
    app.$('periodicSettings').hidden = mode === 'steady';
    app.$('periodicNote').hidden = mode === 'steady';
    for (const id of ['frequency', 'samples', 'maxPeriods']) app.$(id).disabled = mode === 'steady';
    const sweep = app.$('excitationMode').value === 'sweep';
    app.$('sweepSettings').hidden = !sweep;
    app.$('singleFrequencyLabel').hidden = sweep;
    app.$('frequency').disabled = sweep || mode === 'steady';
    for (const id of ['sweepMin', 'sweepMax', 'sweepPoints', 'sweepSpacing']) app.$(id).disabled = !sweep;
    if (sweep) app.$('solverMethod').textContent = 'Periodic · frequency sweep';
  };
  app.paintAt = function paintAt(e) {
    if (app.worker || app.importingProject || !app.geomFrame) return;
    const rect = app.$('geometryCanvas').getBoundingClientRect(),
      x = e.clientX - rect.left,
      y = e.clientY - rect.top,
      f = app.geomFrame;
    if (x < f.left || x >= f.left + f.w || y < f.top || y >= f.top + f.h) return;
    const i = Math.floor((x - f.left) / f.w * app.config.nx),
      j = app.config.ny - 1 - Math.floor((y - f.top) / f.h * app.config.ny),
      k = j * app.config.nx + i;
    if (app.config.materialMap[k] === app.selected) return;
    app.config.materialMap[k] = app.selected;
    app.dirty();
    // Coalesce redraws while dragging: at most one full canvas redraw per frame.
    if (!app.geometryFrame) app.geometryFrame = requestAnimationFrame(() => {
      app.geometryFrame = 0;
      app.drawGeometry();
    });
  };
  app.validationTargets = function validationTargets(path) {
    const direct = {
      lx: 'lx',
      ly: 'ly',
      depth: 'depth',
      nx: 'nx',
      ny: 'ny',
      mode: 'mode',
      frequency: 'frequency',
      samples: 'samples',
      maxPeriods: 'maxPeriods',
      'electrical.kind': 'electricalKind',
      'electrical.value.bias': 'bias',
      'electrical.value.amplitude': 'amplitude',
      'electrical.value.phase': 'phase'
    };
    if (direct[path]) return [app.$(direct[path])];
    const material = path.match(/^materials\.(\d+)\.(\w+)$/);
    if (material) return [...document.querySelectorAll(`[data-material="${material[1]}"] [data-key="${material[2]}"]`)];
    const thermal = path.match(/^thermal\.(left|right|top|bottom)\.(?:value\.)?(\w+)$/);
    if (thermal) return [...document.querySelectorAll(`[data-side="${thermal[1]}"] [data-key="${thermal[2]}"]`)];
    const electrode = path.match(/^electrical\.(source|sink)(Side|Range)$/);
    if (electrode) return electrode[2] === 'Side' ? [app.$(electrode[1] + 'Side')] : [app.$(electrode[1] + 'Start'), app.$(electrode[1] + 'End')];
    return [];
  };
  app.validateUI = function validateUI() {
    const controls = [...document.querySelectorAll('.settings input,.settings select')];
    controls.forEach(e => {
      e.setCustomValidity('');
      e.removeAttribute('aria-invalid');
      e.removeAttribute('title');
    });
    const issues = [];
    for (const e of controls.filter(e => e.type === 'number' && !e.disabled)) {
      try {
        TE.readNumberInput(e);
      } catch {
        issues.push({
          path: e.id || e.dataset.key,
          message: 'Enter a finite numerical value.',
          elements: [e]
        });
      }
    }
    if (!issues.length) {
      try {
        let draft = app.read();
        const g = app.geometryInput();
        if (Number.isInteger(g.nx) && Number.isInteger(g.ny) && g.nx >= 2 && g.ny >= 1 && (g.nx + 1) * (g.ny + 1) <= 1600) draft = TE.remeshConfig(draft, {
          ...g,
          lx: app.config.lx,
          ly: app.config.ly,
          depth: app.config.depth
        });
        Object.assign(draft, g);
        issues.push(...TE.validate2DConfig(draft));
        if (draft.sweep?.enabled) TE.validateSweep(draft);
      } catch (e) {
        issues.push({
          path: 'model',
          message: e.message
        });
      }
    }
    for (const issue of issues) for (const e of issue.elements || app.validationTargets(issue.path)) {
      if (!e) continue;
      e.setCustomValidity(issue.message);
      e.setAttribute('aria-invalid', 'true');
      e.title = issue.message;
    }
    const summary = app.$('validationSummary');
    summary.hidden = !issues.length;
    summary.innerHTML = issues.length ? '<strong>Correct these inputs before applying, exporting or running:</strong><ul>' + issues.slice(0, 10).map(e => `<li><b>${app.esc(e.path)}</b> — ${app.esc(e.message)}</li>`).join('') + '</ul>' + (issues.length > 10 ? `<small>${issues.length - 10} more issue(s) are highlighted in the form.</small>` : '') : '';
    for (const id of ['run', 'save']) app.$(id).disabled = Boolean(app.worker) || issues.length > 0;
    let pending = false,
      signature = null;
    try {
      const g = app.geometryInput();
      pending = app.meshChanged(g);
      signature = JSON.stringify(g);
    } catch {}
    const apply = app.$('applyGrid');
    apply.disabled = Boolean(app.worker) || issues.length > 0 || !pending;
    apply.classList.toggle('mesh-pending', !apply.disabled);
    if (!pending) {
      app.lastMeshEdit = null;
      apply.classList.remove('mesh-flash');
    } else if (!apply.disabled && signature !== app.lastMeshEdit) {
      app.lastMeshEdit = signature;
      apply.classList.remove('mesh-flash');
      void apply.offsetWidth;
      apply.classList.add('mesh-flash');
    }
    return issues.length === 0;
  };
  app.geometryInput = function geometryInput() {
    return {
      nx: app.num('nx'),
      ny: app.num('ny'),
      lx: app.num('lx') / 1000,
      ly: app.num('ly') / 1000,
      depth: app.num('depth') / 1000
    };
  };
  app.meshChanged = function meshChanged(g) {
    return g.nx !== app.config.nx || g.ny !== app.config.ny || Math.abs(g.lx - app.config.lx) > 1e-14 || Math.abs(g.ly - app.config.ly) > 1e-14 || Math.abs(g.depth - app.config.depth) > 1e-14;
  };
  app.meshPreview = function meshPreview() {
    try {
      const g = app.geometryInput(),
        valid = Number.isInteger(g.nx) && Number.isInteger(g.ny) && g.nx >= 2 && g.ny >= 1;
      app.$('meshSummary').textContent = valid ? `${g.nx} × ${g.ny} = ${g.nx * g.ny} elements / ${(g.nx + 1) * (g.ny + 1)} nodes` : 'Enter whole-number counts: Nx ≥ 2 and Ny ≥ 1.';
      app.$('meshPending').textContent = valid && (g.nx + 1) * (g.ny + 1) > 1600 ? 'Too large: maximum 1600 nodes.' : app.meshChanged(g) ? 'Pending change — Apply mesh, Run simulation or Export model will apply it.' : 'Mesh is up to date.';
    } catch {
      app.$('meshSummary').textContent = 'Enter valid dimensions and element counts.';
      app.$('meshPending').textContent = '';
    }
  };
  app.applyGeometry = function applyGeometry() {
    const c = app.read(),
      g = app.geometryInput(),
      candidate = TE.remeshConfig(c, g);
    TE.assertValid2DConfig(candidate);
    if (candidate.sweep?.enabled) TE.validateSweep(candidate);
    app.config = candidate;
    app.drawGeometry();
    app.meshPreview();
    app.validateUI();
    return app.config;
  };
  app.applyMesh = () => {
    try {
      app.applyGeometry();
      app.dirty();
      app.$('status').textContent = `Mesh applied: ${app.config.nx} × ${app.config.ny} = ${app.config.nx * app.config.ny} elements, ${(app.config.nx + 1) * (app.config.ny + 1)} nodes. Inspect material regions after remeshing.`;
    } catch (e) {
      app.notice(e.message, true);
    }
  };
  app.fillMaterial = () => {
    app.config.materialMap.fill(app.selected);
    app.drawGeometry();
    app.dirty();
  };
  app.updateMaterialCap = () => {
    const atLimit = app.config.materials.length >= 12;
    if (app.$('addMaterial')) app.$('addMaterial').disabled = atLimit;
    if (app.$('presetMaterial')) app.$('presetMaterial').disabled = atLimit;
    if (app.$('materialFilesButton')) app.$('materialFilesButton').disabled = atLimit;
  };
  app.removeMaterial = (index) => {
    if (app.config.materials.length <= 1) return;
    try {
      app.config = app.read();
      app.config.materials.splice(index, 1);
      for (let k = 0; k < app.config.materialMap.length; k++) {
        const m = app.config.materialMap[k];
        if (m === index) app.config.materialMap[k] = 0;
        else if (m > index) app.config.materialMap[k] = m - 1;
      }
      if (app.selected === index) app.selected = 0;
      else if (app.selected > index) app.selected--;
      app.materialsForm();
      app.drawGeometry();
      app.dirty();
      app.validateUI();
    } catch (e) {
      app.notice(e.message, true);
    }
  };
  app.addMaterial = () => {
    try {
      app.config = app.read();
      TE.assert(app.config.materials.length < 12, 'Maximum 12 materials.');
      app.config.materials.push({
        name: 'New material',
        rho: 2000,
        Cp: 500,
        k: 2,
        sigma: 1e5,
        beta: 0,
        alpha: 0,
        alphaSlope: 0,
        color: ['#96a8f2', '#dd88b8', '#b1c47c'][app.config.materials.length % 3]
      });
      app.materialsForm();
      app.dirty();
      app.validateUI();
    } catch (e) {
      app.notice(e.message, true);
    }
  };
  // Material files use SI units, including alpha in V/K and alphaSlope in V/K².
  app.parseMaterialJson = function parseMaterialJson(text) {
    const data = JSON.parse(text);
    TE.assert(data && typeof data === 'object' && !Array.isArray(data), 'Expected a material JSON object.');
    if (data.material !== undefined) {
      TE.assert(data.referenceTemperature === undefined || data.referenceTemperature === 300,
        'Material properties must be referenced to 300 K.');
    }
    const source = data.material ?? data;
    TE.assert(source && typeof source === 'object' && !Array.isArray(source), 'Expected a material object.');
    TE.assert(typeof source.name === 'string' && source.name.trim().length > 0 && source.name.length <= 200,
      'Material name must contain 1–200 characters.');
    const material = {name: source.name.trim()};
    for (const key of ['rho', 'Cp', 'k', 'sigma', 'alpha', 'beta', 'alphaSlope']) {
      const value = source[key] === undefined && ['beta', 'alphaSlope'].includes(key) ? 0 : source[key];
      TE.assert(typeof value === 'number' && Number.isFinite(value), `Material ${key} must be a finite number in SI units.`);
      if (['rho', 'Cp', 'k', 'sigma'].includes(key)) TE.assert(value > 0, `Material ${key} must be positive.`);
      material[key] = value;
    }
    TE.assert(source.color === undefined || /^#[0-9a-f]{6}$/i.test(source.color), 'Material color must use #RRGGBB.');
    material.color = source.color ?? '#73d8d0';
    return material;
  };
  app.importMaterialJson = async () => {
    const input = app.$('materialFiles');
    const file = input.files[0];
    if (!file) return;
    try {
      TE.assert(!app.worker && !app.importingProject, 'Wait until the current operation finishes.');
      TE.assert(file.size <= 65536, 'Material JSON must be at most 64 KB.');
      const material = app.parseMaterialJson(await file.text());
      TE.assert(!app.worker && !app.importingProject, 'Wait until the current operation finishes, then add the material again.');
      const config = app.read();
      TE.assert(config.materials.length < 12, 'Maximum 12 materials.');
      config.materials.push(material);
      app.config = config;
      app.materialsForm();
      app.drawGeometry();
      app.dirty();
      app.validateUI();
    } catch (error) {
      app.notice(error.message, true);
    } finally {
      input.value = '';
    }
  };
  app.importModel = async () => {
    const f = app.$('file').files[0];
    if (!f) return;
    try {
      TE.assert(f.size < 2e6, 'Model JSON must be <2 MB.');
      const c = JSON.parse(await f.text());
      TE.checkEditorModel(c);
      TE.from2DConfig(c);
      if (c.sweep?.enabled) TE.validateSweep(c);
      TE.assert(c.materials.every(m => ['rho', 'Cp', 'k', 'sigma', 'alpha'].every(k => typeof m[k] === 'number')), 'The editor imports scalar reference laws only.');
      TE.assert([64, 128, 256, 512, 1024].includes(c.samples), 'Unsupported GUI step count.');
      c.materials.forEach(m => {
        if (!/^#[0-9a-f]{6}$/i.test(m.color)) m.color = '#73d8d0';
      });
      app.config = c;
      app.selected = 0;
      app.fill();
      app.dirty();
      app.notice('Model imported. Run to compute its response.');
    } catch (e) {
      app.notice('Import failed: ' + e.message, true);
    } finally {
      app.$('file').value = '';
    }
  };
  // Thermoelectric module example: one n/p Bi2Te3 couple between alumina plates, cut through the
  // middle of the legs. Cells are 0.2 mm (x) × 0.1 mm (y): legs 1.4 × 1.6 mm, copper 0.3 mm,
  // alumina 0.6 mm, air gap 1 mm. Material indices: 0 p, 1 n, 2 copper, 3 alumina, 4 air.
  app.moduleLayout = function moduleLayout() {
    const lead = 3, leg = 7, gap = 5, ceramic = 6, copper = 3, height = 16,
      nx = 2 * lead + 2 * leg + gap,
      ny = 2 * ceramic + 2 * copper + height,
      P = 0, N = 1, CU = 2, CERAMIC = 3, AIR = 4,
      map = Array(nx * ny).fill(AIR),
      fill = (i0, i1, j0, j1, m) => {
        for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) map[j * nx + i] = m;
      };
    const nStart = lead, pStart = lead + leg + gap, strap = ceramic, legBottom = ceramic + copper, legTop = legBottom + height;
    fill(0, nx, 0, ceramic, CERAMIC);
    fill(0, nx, ny - ceramic, ny, CERAMIC);
    fill(0, nStart + leg, strap, legBottom, CU); // left lead under the n leg
    fill(pStart, nx, strap, legBottom, CU); // right lead under the p leg
    fill(nStart, pStart + leg, legTop, legTop + copper, CU); // top strap joining the legs
    fill(nStart, nStart + leg, legBottom, legTop, N);
    fill(pStart, pStart + leg, legBottom, legTop, P);
    return {nx, ny, lx: 5e-3, ly: 3.4e-3, map, contact: [strap / ny, legBottom / ny]};
  };
  // All five materials come from the material library (the files behind "Select preset…"). The
  // built-in copies mirror those files and are used only for a file that is missing, invalid, or
  // unsuitable for its role (legs need the right Seebeck sign; plates and gaps must insulate).
  app.moduleMaterials = async function moduleMaterials() {
    const insulating = m => m.sigma < 1e-6,
      entries = [
        ['Bi2Te3.json', m => m.alpha > 0, {name: 'Bi2Te3 (p-type benchmark)', rho: 7740, Cp: 154.4, k: 1.6, sigma: 1.1e5, beta: 0, alpha: 2e-4, alphaSlope: 0, color: '#73d8d0'}],
        ['Bi2Te3_n_type.json', m => m.alpha < 0, {name: 'Bi2Te3 n-type (illustrative)', rho: 7740, Cp: 154.4, k: 1.6, sigma: 1.1e5, beta: 0, alpha: -2e-4, alphaSlope: 0, color: '#ae92d9'}],
        ['Copper.json', m => m.sigma > 1e6, {name: 'Copper', rho: 8960, Cp: 385, k: 401, sigma: 57478566.4581124, beta: 0.004176967424511028, alpha: 1.83e-6, alphaSlope: 0, color: '#edaf6e'}],
        ['Alumina.json', insulating, {name: 'Alumina (96% Al2O3)', rho: 3750, Cp: 750, k: 24, sigma: 1e-12, beta: 0, alpha: 0, alphaSlope: 0, color: '#d9d4c7'}],
        ['Air.json', insulating, {name: 'Air (1 atm, still)', rho: 1.1614, Cp: 1007, k: .0263, sigma: 1e-14, beta: 0, alpha: 0, alphaSlope: 0, color: '#46535f'}]
      ];
    const loaded = await Promise.all(entries.map(async ([file, ok, fallback]) => {
      try {
        const res = await fetch('lib/' + file);
        if (!res.ok) throw new Error();
        const material = app.parseMaterialJson(await res.text());
        if (!ok(material)) throw new Error();
        return {material, file};
      } catch {
        return {material: {...fallback}, file: null};
      }
    }));
    const materials = loaded.map(v => v.material), [p, n] = materials;
    if (p.color.toLowerCase() === n.color.toLowerCase()) n.color = p.color.toLowerCase() === '#ae92d9' ? '#73d8d0' : '#ae92d9';
    const library = loaded.filter(v => v.file).map(v => 'lib/' + v.file),
      builtIn = loaded.filter(v => !v.file).map(v => v.material.name);
    return {
      materials,
      source: (library.length ? 'from ' + library.join(', ') : '') + (library.length && builtIn.length ? '; ' : '') + (builtIn.length ? 'built-in copies for ' + builtIn.join(', ') : '')
    };
  };
  app.moduleConfig = async function moduleConfig() {
    const {materials, source} = await app.moduleMaterials(),
      {nx, ny, lx, ly, map, contact} = app.moduleLayout(),
      flux = () => ({kind: 'flux', value: {bias: 0, amplitude: 0, phase: 0}, h: 0});
    return {
      ...TE.default2D(),
      description: 'Thermoelectric module: one Bi2Te3 n/p couple between alumina plates, cut through the middle of the legs (2D, depth 1.4 mm). ' +
        'Current enters the left copper lead, rises through the n leg, crosses the top strap and returns down the p leg to the right lead: the legs are electrically in series and thermally in parallel. ' +
        'Default: Peltier cooler at 4 A DC. The bottom plate sits on a 300 K heat sink and the top plate is insulated, so the top cools to its no-load limit. ' +
        'Try: current arrows on the Results map; more current (cooling improves up to an optimum, then Joule heating wins); a heat load as a negative top flux (positive = outward); a negative current to reverse the heat flow; ' +
        'a generator with bottom 350 K, top temperature 300 K and open circuit (Seebeck voltage). A real module repeats this couple (e.g. 127 times): voltage and heat pumping scale with the number of couples. ' +
        'Idealized: no contact resistance, no radiation or convection in the air gap, insulated side edges. Material properties ' + source + '.',
      mode: 'steady',
      nx,
      ny,
      lx,
      ly,
      depth: 1.4e-3,
      frequency: .5,
      materials,
      materialMap: map,
      thermal: {left: flux(), right: flux(), top: flux(), bottom: {kind: 'temperature', value: {bias: 300, amplitude: 0, phase: 0}, h: 0}},
      electrical: {kind: 'current', value: {bias: 4, amplitude: 0, phase: 0}, sourceSide: 'left', sinkSide: 'right', sourceRange: [...contact], sinkRange: [...contact]}
    };
  };
  app.loadPreset = async () => {
    const token = ++app.presetToken,
      p = app.$('preset').value;
    if (p === 'module') {
      try {
        const config = await app.moduleConfig();
        // Ignore a slow library load if another preset, a run or an import started meanwhile.
        if (token !== app.presetToken || app.worker || app.importingProject) return;
        TE.assertValid2DConfig(config);
        app.config = config;
        app.selected = 0;
        app.fill();
        app.dirty();
      } catch (e) {
        app.notice('Could not load the thermoelectric module: ' + e.message, true);
      }
      return;
    }
    app.config = TE.default2D();
    app.selected = 0;
    if (p === 'spreading') {
      app.config.mode = 'steady';
      app.config.electrical.value = {
        bias: .1,
        amplitude: 0
      };
      app.config.electrical.sourceRange = [.25, .75];
    }
    if (['dc', 'joule', 'nonlinear', 'seebeck'].includes(p)) {
      app.config.nx = 12;
      app.config.ny = 6;
      app.config.lx = .001;
      app.config.ly = .001;
      app.config.materials = [{
        name: p === 'seebeck' ? 'Thermoelectric material' : 'Resistive material',
        rho: 2000,
        Cp: 500,
        k: 2,
        sigma: 1e5,
        beta: p === 'nonlinear' ? .01 : 0,
        alpha: p === 'seebeck' ? 2e-4 : 0,
        alphaSlope: 0,
        color: '#73d8d0'
      }];
      app.config.materialMap = Array(app.config.nx * app.config.ny).fill(0);
      app.config.thermal.right = {
        kind: 'temperature',
        value: {
          bias: p === 'seebeck' ? 350 : 300,
          amplitude: 0
        },
        h: 0
      };
      app.config.electrical.value.amplitude = p === 'nonlinear' ? .2 : 1;
      if (p === 'seebeck') {
        app.config.mode = 'steady';
        app.config.electrical.kind = 'open_circuit';
      }
    }
    if (p === 'dc') {
      app.config.mode = 'steady';
      app.config.ny = 1;
      app.config.materialMap = Array(app.config.nx).fill(0);
      app.config.electrical.value = {
        bias: .2,
        amplitude: 0,
        phase: 0
      };
    }
    app.fill();
    app.dirty();
  };
})(globalThis.TEApp);
