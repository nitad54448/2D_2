const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
globalThis.TE = {assert(condition, message) { if (!condition) throw new Error(message); }, formatInputNumber: String};
const input = {files: [], value: ''};
const cards = {innerHTML: ''};
let error = null;
const app = globalThis.TEApp = {
  $: id => id === 'materialFiles' ? input : cards,
  esc: s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
  notice: message => { error = message; },
  dirty() {}, validateUI() {}, drawGeometry() {}
};
vm.runInThisContext(fs.readFileSync(path.join(root, 'assets/ui-model.js'), 'utf8'));
app.palette = () => {};
app.validateUI = () => {};
app.drawGeometry = () => {};
const material = {name: 'User copper', rho: 8960, Cp: 385, k: 400, sigma: 5.8e7, alpha: 1.5e-6};
const parsed = app.parseMaterialJson(JSON.stringify(material));
assert.equal(parsed.beta, 0);
assert.equal(parsed.alphaSlope, 0);
assert.equal(parsed.alpha, 1.5e-6);
assert.deepEqual(app.parseMaterialJson(JSON.stringify({material, referenceTemperature: 300})), parsed);
for (const bad of [{...material, sigma: -1}, {...material, alpha: '1.5'}, {...material, name: ''}, {material, referenceTemperature: 273}, {...material, color: 'red'}]) {
  assert.throws(() => app.parseMaterialJson(JSON.stringify(bad)));
}
(async () => {
  app.config = {materials: [{...parsed, name: 'Existing edit'}], materialMap: [0, 0]};
  app.read = () => structuredClone(app.config);
  input.files = [{size: 100, text: async () => JSON.stringify(material)}];
  await app.importMaterialJson();
  assert.equal(error, null);
  assert.equal(app.config.materials.length, 2);
  assert.equal(app.config.materials[0].name, 'Existing edit');
  assert.deepEqual(app.config.materialMap, [0, 0]);
  assert.match(cards.innerHTML, /User copper/);
  assert.doesNotMatch(cards.innerHTML, /disabled|material-picker|libraryFile/);
  assert.equal(input.value, '');
  const snapshot = JSON.stringify(app.config);
  input.files = [{size: 1, text: async () => '{'}];
  await app.importMaterialJson();
  assert.ok(error);
  assert.equal(JSON.stringify(app.config), snapshot);
  error = null;
  input.files = [{size: 100, text: async () => { app.worker = {}; return JSON.stringify(material); }}];
  await app.importMaterialJson();
  assert.ok(error);
  assert.equal(JSON.stringify(app.config), snapshot);
  app.worker = null;
  app.config.materials = Array.from({length: 12}, () => ({...parsed}));
  input.files = [{size: 100, text: async () => JSON.stringify(material)}];
  await app.importMaterialJson();
  assert.equal(app.config.materials.length, 12);
  assert.match(error, /Maximum 12/);
  console.log('PASS material JSON validation, append, editable cards, unchanged map, invalid input, operation race and material limit');
})().catch(e => { console.error(e); process.exitCode = 1; });
