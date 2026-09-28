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
    assert(Math.abs(dc.terminalVoltage + .002) < 1e-12);
    assert(Math.abs(ac.harmonics.terminalVoltage[1].re + .002) < 1e-12);
    TE.checkProjectResult(dc); TE.checkProjectResult(ac);
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
  const metadataFile = (kind = 'single', selectedIndex = 0, probe = 2) => ({name: 'project.json', data: JSON.stringify({
    format: 'thermoelectric-lab-project', version: 1, kind, selectedIndex, view: {probe}, bodeOptions: kind === 'sweep' ? bode : null
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
  console.log(`\n${checks} regression checks passed.`);
})().catch(e => {console.error(e); process.exitCode = 1;});
