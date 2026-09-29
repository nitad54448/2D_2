const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const load = name => vm.runInThisContext(fs.readFileSync(path.join(root, 'assets', name), 'utf8'), {filename: name});
for (const name of ['core.js', 'exports.js', 'worker.js', 'project.js']) load(name);
function model(periodic = false) {
  const c = TE.default2D();
  Object.assign(c, {mode: periodic ? 'periodic' : 'steady', nx: 4, ny: 1, lx: .001, ly: .001, depth: .001,
    materialMap: [0, 0, 0, 0], samples: 64, frequency: 2, maxPeriods: 100});
  c.materials = [{name: 'Reference', color: '#73d8d0', rho: 2000, Cp: 500, k: 2, sigma: 1e5, alpha: 0, beta: 0, alphaSlope: 0}];
  c.electrical.value = {bias: periodic ? 0 : .2, amplitude: periodic ? .2 : 0, phase: 0};
  c.thermal.left = {kind: 'temperature', value: 300}; c.thermal.right = {kind: 'temperature', value: 300};
  return c;
}
const elements = new Map();
function el(id) {
  if (!elements.has(id)) elements.set(id, {value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, checked: false,
    max: 0, dataset: {}, style: {}, options: [], selectedOptions: [{text: 'Temperature'}], classList: {toggle(){}, remove(){}, add(){}},
    setAttribute(){}, removeAttribute(){}, setCustomValidity(){}, addEventListener(){}});
  return elements.get(id);
}
globalThis.document = {getElementById: el, querySelector: () => el('main'), querySelectorAll: () => []};
globalThis.window = {};
load('ui-state.js');
for (const name of ['ui-model.js', 'ui-plots.js', 'ui-sweep.js', 'ui-worker.js', 'ui-downloads.js', 'ui-project.js']) load(name);
const app = TEApp;
const noop = () => {};
app.tab = noop;
app.notice = (s, error) => {el('status').textContent = s; el('badge').textContent = error ? 'ERROR' : 'READY';};
app.canvasFrame = () => ({ctx: new Proxy({}, {get: () => noop, set: () => true}), left: 50, top: 20, w: 400, h: 200});
app.contacts = noop;
function setView() {
  Object.assign(el('field'), {value: 'temperature', selectedOptions: [{text: 'Temperature'}]});
  el('harmonic').value = '2'; el('representation').value = 'imaginary'; el('profileField').value = 'temperature';
  el('profileTime').value = '16'; el('arrows').checked = true; app.probe = 7;
}
const bode = {quantity: 'temperature', harmonic: 2, reference: 'current', normalization: 'raw', phaseFloor: 1e-12,
  unwrap: false, x: .5, y: .5, scale: 'physical', dbReference: 1};
let checks = 0;
async function check(label, fn) {await fn(); checks++; console.log('PASS', label);}
(async () => {
  for (const name of fs.readdirSync(path.join(root, 'assets')).filter(x => x.endsWith('.js'))) new vm.Script(fs.readFileSync(path.join(root, 'assets', name), 'utf8'));
  const dc = TE.run2D(model()), ac = TE.run2D(model(true));
  await check('DC / AC numerical smoke tests and imported-result dimensions', () => {
    assert(Math.abs(dc.terminalVoltage - .002) < 1e-12);
    assert(Math.abs(ac.harmonics.terminalVoltage[1].re - .002) < 1e-12);
    TE.checkProjectResult(dc); TE.checkProjectResult(ac);
  });
  await check('Passive sign convention: sink grounded, U = V(source) − V(sink), U = RI and P = UI', () => {
    // model(): source on the left edge (nodes 0, 5), sink on the right edge (nodes 4, 9), R = 0.01 Ω.
    for (const i of [4, 9]) assert.equal(dc.voltage[i], 0);
    for (const i of [0, 5]) assert.equal(dc.voltage[i], dc.terminalVoltage);
    assert(Math.abs(dc.current - .2) < 1e-15 && Math.abs(dc.electricalPower - 4e-4) < 1e-15);
    assert.equal(dc.electricalPower, dc.current * dc.terminalVoltage); assert(Math.abs(dc.energyResidual) < 1e-10);
    const v = model(); v.electrical = {...v.electrical, kind: 'voltage', value: {bias: .002, amplitude: 0, phase: 0}};
    const rv = TE.run2D(v); assert.equal(rv.terminalVoltage, .002); assert(Math.abs(rv.current - .2) < 1e-12);
    const o = model(); o.electrical = {...o.electrical, kind: 'open_circuit'}; assert(Math.abs(TE.run2D(o).current) < 1e-15);
  });
  await check('Ideal Peltier leg reproduces the analytic cooler solution', () => {
    // p-leg from a 300 K heat sink (sink electrode, left) to an insulated cold end (source electrode, right):
    // Tc = (K·Th + I²R/2) / (K + αI) and U = IR + α(Th − Tc). Implicit Peltier cooling needs few iterations.
    const I = 3, a = 2e-4, K = 1.6e-6 / 1.6e-3, R = 1.6e-3 / (1.1e5 * 1e-6), flux = () => ({kind: 'flux', value: 0});
    const c = TE.default2D(); Object.assign(c, {mode: 'steady', nx: 16, ny: 1, lx: 1.6e-3, ly: 1e-3, depth: 1e-3, materialMap: Array(16).fill(0)});
    c.materials = [{name: 'p-leg', color: '#73d8d0', rho: 7740, Cp: 154.4, k: 1.6, sigma: 1.1e5, alpha: a, beta: 0, alphaSlope: 0}];
    c.thermal = {left: {kind: 'temperature', value: 300}, right: flux(), top: flux(), bottom: flux()};
    c.electrical = {kind: 'current', value: {bias: I, amplitude: 0, phase: 0}, sourceSide: 'right', sinkSide: 'left', sourceRange: [0, 1], sinkRange: [0, 1]};
    const r = TE.run2D(c), Tc = (K * 300 + I * I * R / 2) / (K + a * I);
    for (const i of [16, 33]) assert(Math.abs(r.temperature[i] - Tc) < 1e-8);
    assert(Math.abs(r.terminalVoltage - (I * R + a * (300 - Tc))) < 1e-12);
    assert(Math.abs(r.energyResidual) < 1e-9 && r.diagnostics.iterations <= 5);
  });
  await check('Thermoelectric module example converges beyond its optimum current', async () => {
    const module = await app.moduleConfig(); // lib/ is not served here: built-in material copies
    const top = I => {
      const c = structuredClone(module); c.electrical.value.bias = I; const r = TE.run2D(c);
      assert(r.diagnostics.iterations <= 10 && Math.abs(r.energyResidual) < 1e-6 && r.terminalVoltage > 0);
      return Math.min(...r.temperature.slice(-(c.nx + 1)));
    };
    const t4 = top(4), t12 = top(12);
    assert(t4 < 240 && t12 > t4 && t12 < 300, `top plate ${t4} K at 4 A, ${t12} K at 12 A`);
  });
  await check('Generated worker executes and decodes', () => {
    let message; const context = {self: {postMessage: m => {if (m.type === 'result' || m.type === 'error') message = structuredClone(m);}}};
    vm.runInNewContext(TE.workerSource(), context); context.self.onmessage({data: model()});
    assert.equal(message.type, 'result'); TE.checkProjectResult(TE.decodeWorkerMessage(message).result);
  });
  await check('Unknown thermal boundaries rejected; renderer whitelists sides', () => {
    const c = model(); c.thermal['extra" data-injected="yes'] = {kind: 'flux', value: 0};
    assert.throws(() => TE.checkEditorModel(c), /Unknown thermal boundary/);
    app.config = c; app.boundaryForm(); assert(!el('thermalCards').innerHTML.includes('data-injected'));
  });
  await check('Cell phasors cancel before magnitude; signed Re/Im; phase mask', () => {
    const r = structuredClone(ac); const row = r.harmonics.temperature[1];
    row.forEach(z => {z.re = 0; z.im = 0;});
    for (const i of [0, 5]) row[i] = {re: 1, im: 2}; for (const i of [1, 6]) row[i] = {re: -1, im: -2};
    assert.equal(TE.harmonicMap(r, 'temperature', 1).values[0], 0);
    assert.equal(TE.harmonicMap(r, 'temperature', 1, 'phase').values[0], null);
    row.forEach(z => {z.re = -3; z.im = 4;});
    assert.equal(TE.harmonicMap(r, 'temperature', 1).values[0], 5);
    assert.equal(TE.harmonicMap(r, 'temperature', 1, 'real').values[0], -3);
    assert.equal(TE.harmonicMap(r, 'temperature', 1, 'imaginary').values[0], 4);
    assert(Math.abs(TE.harmonicMap(r, 'temperature', 1, 'phase').values[0] - 126.86989764584402) < 1e-10);
  });
  await check('DC probe visible and updated; imaginary map renders', () => {
    app.result = dc; setView(); el('results').hidden = false; app.drawResults();
    assert.equal(el('dcProbe').hidden, false); assert(el('dcProbe').textContent.includes('T ='));
    const old = el('dcProbe').textContent; app.probe = 0; app.drawResults(); assert.notEqual(el('dcProbe').textContent, old);
    app.result = ac; setView(); app.drawResults(); assert.equal(el('dcProbe').hidden, true);
  });
  await check('Colour scales of nodal fields span the nodal extremes', () => {
    const map = TE.harmonicMap(dc, 'temperature', 0);
    assert.equal(map.range.lo, 300); assert(Math.min(...map.values) > 300);
    assert.equal(map.range.hi, Math.max(...dc.temperature)); assert.deepEqual(TE.surfaceField(dc, 'temperature').range, map.range);
    app.result = dc; setView(); app.drawResults(); assert.equal(el('scaleMin').textContent, '300');
    assert.deepEqual(TE.harmonicMap(ac, 'temperature', 1, 'phase').range, {lo: -180, hi: 180});
  });
  await check('Sweep selection preserves harmonic, probe, representation and time fraction', () => {
    app.result = ac; setView(); const second = structuredClone(ac); second.frequency = 4; second.config.frequency = 4;
    app.sweepResult = {results: [ac, second]}; app.selectSweepPoint(1);
    assert.equal(app.result, second); assert.equal(el('harmonic').value, '2'); assert.equal(app.probe, 7);
    assert.equal(el('representation').value, 'imaginary'); assert.equal(el('profileTime').value, '16');
  });
  const dcFiles = await TE.completeResultsFiles(dc, {probe: 2}), acFiles = await TE.completeResultsFiles(ac, {probe: 7});
  await check('Exports include real and imaginary maps using shared rendering', () => {
    assert(acFiles.some(f => f.name === 'figures/temperature-1-real.svg'));
    assert(acFiles.some(f => f.name === 'figures/temperature-1-imaginary.svg'));
    assert(acFiles.find(f => f.name === 'report.html').data.includes('Complex nodal phasors are averaged'));
  });
  await check('Exports state the sign convention and the cycle diagnostics', () => {
    const report = acFiles.find(f => f.name === 'report.html').data, readme = acFiles.find(f => f.name === 'README.txt').data;
    assert(report.includes('terminal voltage U = V(source) − V(sink)') && report.includes('Cycle extrapolations') && report.includes('Terminal voltage tolerance (V)'));
    assert(readme.includes('Terminal voltage U = V(source) - V(sink)') && ac.convention.includes('V(source)-V(sink)'));
    assert.equal(JSON.parse(acFiles.find(f => f.name === 'manifest.json').data).formatVersion, 2);
  });
  const metadataFile = (kind = 'single', selectedIndex = 0, probe = 2) => ({name: 'project.json', data: JSON.stringify({
    format: 'thermoelectric-lab-project', version: TE.projectVersion, kind, selectedIndex, view: {probe}, bodeOptions: kind === 'sweep' ? bode : null
  })});
  await check('DC and AC project ZIPs restore exact data and probe', async () => {
    for (const [r, files, probe] of [[dc, dcFiles, 2], [ac, acFiles, 7]]) {
      const project = await TE.readProjectZip(await TE.zipFiles([...files, metadataFile('single', 0, probe)]));
      assert.deepEqual(project.result, r); assert.equal(project.view.probe, probe);
    }
  });
  const config = model(true); config.sweep = {enabled: true, min: 2, max: 4, points: 2, spacing: 'linear'};
  const results = []; TE.runSweep(config, m => {if (m.type === 'sweepPoint') results.push(m.result); if (m.type === 'sweepError') throw new Error(m.message);});
  const sweep = {config, results, frequencies: [2, 4], status: 'complete', message: 'Sweep completed.'};
  const sweepFiles = await app.sweepFiles(sweep, bode, results[0], 7);
  await check('Complete and stopped project sweeps import', async () => {
    const loaded = await TE.readProjectZip(await TE.zipFiles([...sweepFiles, metadataFile('sweep', 1, 7)])); assert.deepEqual(loaded.sweep, sweep);
    const stopped = {...sweep, results: [results[0]], status: 'stopped'};
    const loadedStopped = await TE.readProjectZip(await TE.zipFiles([...await app.sweepFiles(stopped, bode, results[0], 7), metadataFile('sweep', 0, 7)]));
    assert.equal(loadedStopped.sweep.results.length, 1); assert.equal(loadedStopped.sweep.status, 'stopped');
  });
  await check('Impedance is U/I with no phase correction', () => {
    for (const row of TE.bodeRows(results, {quantity: 'impedance'})) assert(Math.abs(row.magnitude - .01) < 1e-12 && Math.abs(row.phase) < 1e-9);
    for (const row of TE.bodeRows(results, {quantity: 'terminalVoltage', reference: 'current'})) assert(Math.abs(row.phase) < 1e-9);
  });
  const rc = {...await app.rcConfig(), sweep: {enabled: false}, frequency: 30};
  let rcRun;
  await check('Cycle extrapolation reaches the same periodic state in far fewer cycles', () => {
    const run = extrapolate => TE.from2DConfig(rc).solvePeriodic(30, {samples: 32, maxPeriods: 400, extrapolate});
    const fast = run(true), plain = run(false), a = fast.harmonics.terminalVoltage[1], b = plain.harmonics.terminalVoltage[1];
    assert(fast.periods <= 10 && plain.periods >= 50, `${fast.periods} vs ${plain.periods} cycles`);
    assert(fast.diagnostics.cycleExtrapolations >= 1 && plain.diagnostics.cycleExtrapolations === 0);
    assert(Math.hypot(a.re - b.re, a.im - b.im) / Math.hypot(b.re, b.im) < 1e-6);
    rcRun = TE.run2D(rc); // the application's path extrapolates by default
    assert(rcRun.converged && rcRun.periods <= 10 && rcRun.diagnostics.cycleExtrapolations >= 1, `run2D: ${rcRun.periods} cycles`);
    assert.deepEqual(TE.cycleExtrapolation([[0, 0], [1, 2], [1.5, 3]]).shift, [.5, 1]); // λ = 1/2: limit (2, 4)
    assert.equal(TE.cycleExtrapolation([[0], [1], [.5]]), null); // oscillating drift
    assert.equal(TE.cycleExtrapolation([[0], [1], [1.999]]), null); // λ ≥ 0.995: no reliable limit
    assert.equal(TE.cycleExtrapolation([[0, 0], [1, 0], [1, .5]]), null); // drift changes direction
  });
  await check('No extrapolation without a periodic state', () => {
    const c = model(true); c.maxPeriods = 10; for (const side of ['left', 'right', 'top', 'bottom']) c.thermal[side] = {kind: 'flux', value: 0};
    let last; assert.throws(() => TE.run2D(c, noop, r => {last = r;}), /Periodic state not reached/); // adiabatic: Joule heat accumulates
    assert.equal(last.periods, 10); assert.equal(last.diagnostics.cycleExtrapolations, 0);
  });
  await check('Terminal-voltage tolerance follows the largest Seebeck coefficient', () => {
    assert.equal(ac.diagnostics.harmonicVoltageAtol, 1e-12); // α = 0: floor
    assert(Math.abs(rcRun.diagnostics.harmonicVoltageAtol - 2e-4 * 2e-7) < 1e-25); // Bi₂Te₃ × temperature tolerance
  });
  await check('Archives without project.json are rejected for DC, AC and sweeps', async () => {
    for (const files of [dcFiles, acFiles, sweepFiles]) {
      await assert.rejects(() => TE.zipFiles(files).then(TE.readProjectZip), /not a supported project/);
    }
  });
  let newZip;
  await check('Actual UI ZIP export restores sweep, selected point and view', async () => {
    app.result = results[0]; app.sweepResult = sweep; setView(); app.bodeOptions = () => bode;
    app.download = (name, data) => {newZip = data;}; const view = app.captureResultView();
    await app.exportZip(); assert(newZip instanceof Blob, el('exportStatus').textContent);
    const loaded = await TE.readProjectZip(newZip); assert.equal(loaded.selected, 0); assert.deepEqual(loaded.view, view); assert.deepEqual(loaded.sweep, sweep);
    assert.deepEqual(loaded.bodeOptions, bode);
  });
  await check('Actual UI single-result project export round trip', async () => {
    app.result = dc; app.sweepResult = null; setView(); app.$('harmonic').value = '0';
    let zip; app.download = (name, data) => {zip = data;}; await app.exportZip();
    const loaded = await TE.readProjectZip(zip); assert.deepEqual(loaded.result, dc); assert.equal(loaded.sweep, null);
  });
  await check('UI import restores sweep and selection without running solver', async () => {
    const fill = app.fill, drawBode = app.drawBode, refresh = app.refreshSweepPoints;
    app.fill = noop; app.drawBode = noop; app.refreshSweepPoints = noop;
    el('projectFile').files = [newZip]; await app.importProject();
    assert.deepEqual(app.result, results[0]); assert.equal(el('sweepPoint').value, '0'); assert.equal(el('representation').value, 'imaginary');
    assert.equal(el('profileTime').value, '16'); assert.equal(app.probe, 7); assert.equal(app.importingProject, false);
    app.fill = fill; app.drawBode = drawBode; app.refreshSweepPoints = refresh;
  });
  await check('Bad input preserves the open project and unlocks import', async () => {
    const before = app.result; el('projectFile').files = [new Blob(['invalid zip'])]; await app.importProject();
    assert.equal(app.result, before); assert.equal(app.importingProject, false); assert(el('status').textContent.startsWith('Project import failed:'));
  });
  const minimal = r => [metadataFile(), {name: 'model.json', data: JSON.stringify(r.config)}, {name: 'results.json', data: JSON.stringify(r)}];
  await check('Only the current model and project versions are accepted', async () => {
    assert.equal(TE.default2D().version, TE.modelVersion);
    for (const bad of [{...model(), version: 1}, (({version, ...rest}) => rest)(model())]) assert.throws(() => TE.checkEditorModel(bad), /Unsupported model version/);
    const oldMetadata = {name: 'project.json', data: JSON.stringify({format: 'thermoelectric-lab-project', version: 1, kind: 'single', selectedIndex: 0, view: {probe: 2}, bodeOptions: null})};
    await assert.rejects(() => TE.zipFiles([oldMetadata, ...minimal(dc).slice(1)]).then(TE.readProjectZip), /Unsupported project/);
    const oldModel = structuredClone(dc); oldModel.config.version = 1;
    await assert.rejects(() => TE.zipFiles(minimal(oldModel)).then(TE.readProjectZip), /Unsupported model version/);
    el('file').files = [new Blob([JSON.stringify({...model(), version: 1})])]; await app.importModel();
    assert(el('status').textContent.startsWith('Import failed: Unsupported model version'));
  });
  await check('Malformed arrays, metadata, JSON properties and unknown boundary rejected', async () => {
    const bad = structuredClone(ac); bad.temperature[0].pop();
    await assert.rejects(() => TE.zipFiles(minimal(bad)).then(TE.readProjectZip), /dimensions/);
    const badC = structuredClone(dc); badC.config.thermal.evil = {kind: 'flux', value: 0};
    await assert.rejects(() => TE.zipFiles(minimal(badC)).then(TE.readProjectZip), /Unknown thermal/);
    await assert.rejects(() => TE.zipFiles([...minimal(dc).filter(f => f.name !== 'project.json'), {name: 'project.json', data: '{"format":"thermoelectric-lab-project","version":99,"kind":"single"}'}]).then(TE.readProjectZip), /Unsupported project/);
    await assert.rejects(() => TE.zipFiles([metadataFile(), {name: 'model.json', data: '{"__proto__":{}}'}, {name: 'results.json', data: '{}'}]).then(TE.readProjectZip), /Unsafe JSON/);
  });
  await check('Deflate-compressed projects import with bounded decompression', async () => {
    const source = new Uint8Array(await (await TE.zipFiles(minimal(dc))).arrayBuffer());
    const sv = new DataView(source.buffer), end = source.length - 22;
    let at = sv.getUint32(end + 16, true), offset = 0;
    const body = [], directory = [];
    for (let i = 0; i < sv.getUint16(end + 10, true); i++) {
      const nl = sv.getUint16(at + 28, true), local = sv.getUint32(at + 42, true), len = sv.getUint32(at + 24, true);
      const data = source.subarray(local + 30 + nl, local + 30 + nl + len);
      const compressed = require('node:zlib').deflateRawSync(data);
      const header = source.slice(local, local + 30 + nl), hv = new DataView(header.buffer);
      hv.setUint16(8, 8, true); hv.setUint32(18, compressed.length, true);
      const cd = source.slice(at, at + 46 + nl), cv = new DataView(cd.buffer);
      cv.setUint16(10, 8, true); cv.setUint32(20, compressed.length, true); cv.setUint32(42, offset, true);
      body.push(header, compressed); directory.push(cd); offset += header.length + compressed.length; at += cd.length;
    }
    const footer = source.slice(end), fv = new DataView(footer.buffer);
    fv.setUint32(12, directory.reduce((n, a) => n + a.length, 0), true); fv.setUint32(16, offset, true);
    const loaded = await TE.readProjectZip(new Blob([...body, ...directory, footer]));
    assert.deepEqual(loaded.result, dc);
  });
  await check('Traversal, duplicate paths, truncated archives and CRC damage rejected', async () => {
    await assert.rejects(() => TE.zipFiles([{name: '../model.json', data: '{}'}]).then(TE.readProjectZip), /Unsafe archive/);
    await assert.rejects(() => TE.zipFiles([{name: 'model.json', data: '{}'}, {name: 'model.json', data: '{}'}]).then(TE.readProjectZip), /Duplicate/);
    await assert.rejects(() => TE.readProjectZip(newZip.slice(0, newZip.size - 5)), /truncated/);
    const good = await TE.zipFiles(minimal(dc)); const bytes = new Uint8Array(await good.arrayBuffer()); bytes[30 + 'project.json'.length] ^= 1;
    await assert.rejects(() => TE.readProjectZip(new Blob([bytes])), /Corrupt/);
  });
  await check('HTML script paths and static IDs are consistent', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]); assert.equal(ids.length, new Set(ids).size);
    for (const m of html.matchAll(/<script src="([^"]+)"/g)) assert(fs.existsSync(path.join(root, m[1])));
    for (const name of fs.readdirSync(path.join(root, 'assets'))) {
      const code = fs.readFileSync(path.join(root, 'assets', name), 'utf8');
      for (const m of code.matchAll(/app\.\$\('([^']+)'\)/g)) assert(ids.includes(m[1]), 'Missing HTML ID ' + m[1]);
    }
    assert(html.indexOf('id="importProject"') < html.indexOf('id="import"'));
  });
  await check('Solver-tab equations match the shared report guide', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const section of TE.equationGuide) for (const [, p] of section.html.matchAll(/<p>(.*?)<\/p>/g)) assert(html.includes(p), 'index.html differs: ' + p.slice(0, 60));
  });
  console.log(`\n${checks} regression checks passed.`);
})().catch(e => {console.error(e); process.exitCode = 1;});
