'use strict';
// Logic-level DOM stubs: these tests do not claim browser layout or rendering coverage.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {TE,model,periodic}=require('./helpers.cjs');
function ui() {
 const elements=new Map();const get=id=>{
  if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){},add(){},remove(){}},setAttribute(){},removeAttribute(){},addEventListener(){},getContext(){return new Proxy({},{get:()=>()=>{}})},getBoundingClientRect(){return{left:0,top:0}},clientWidth:700,clientHeight:400,selectedOptions:[{text:'Temperature'}]});
  return elements.get(id);
 };
 const context=vm.createContext({TE,document:{getElementById:get,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},requestAnimationFrame:()=>{},clearInterval,clearTimeout,setTimeout,setInterval,performance,devicePixelRatio:1});
 const root=path.join(__dirname,'../assets');for(const name of ['ui-state','ui-model','ui-plots','ui-sweep','ui-worker','ui-downloads'])vm.runInContext(fs.readFileSync(path.join(root,name+'.js'),'utf8'),context,{filename:name+'.js'});
 const app=context.TEApp;app.fill=()=>{};vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});
 return {app,context,get};
}
test('All UI modules load and bootstrap binds handlers to their owners',()=>{
 const {app,context,get}=ui();assert(context.TE_APP_READY);assert.equal(get('run').onclick,app.runSimulation);assert.equal(get('file').onchange,app.importModel);assert.equal(get('exportZip').onclick,app.exportZip);assert.equal(get('preset').onchange,app.loadPreset);
});
test('All six preset handlers generate valid converged models',()=>{
 const {app,get}=ui();app.dirty=()=>{};
 for(const preset of ['dc','layers','spreading','joule','nonlinear','seebeck']){
  get('preset').value=preset;app.loadPreset();const r=TE.run2D(app.config);assert(r.converged,preset);assert(r.diagnostics.heatResidualNormalized<=1,preset);
 }
});
test('Accepting a result exposes diagnostics and preserves representation choices',()=>{
 const {app,get}=ui();app.tab=()=>{};get('representation').value='phase';app.accept(TE.run2D(periodic()));
 assert(get('diagnosticsNote').textContent.includes('terminal harmonics'));assert.equal(get('representation').value,'phase');assert.equal(get('exportZip').disabled,false);
});
test('Input edits disable result exports and keep the computed model untouched',()=>{
 const {app,get}=ui();app.tab=()=>{};app.accept(TE.run2D(model()));const before=JSON.stringify(app.result.config);app.dirty();assert.equal(get('exportZip').disabled,true);assert.equal(get('badge').textContent,'INPUTS CHANGED');assert.equal(JSON.stringify(app.result.config),before);
});
test('Import handler preserves active thermal AC and rejects incompatible files',async()=>{
 const {app,get}=ui();app.dirty=()=>{};app.fill=()=>{};const c=periodic();c.electrical.value=0;c.thermal.left.value={bias:300,amplitude:2,phase:0};
 get('file').files=[{size:1000,text:async()=>JSON.stringify(c)}];await app.importModel();assert.equal(app.config.thermal.left.value.amplitude,2);assert.equal(app.config.mode,'periodic');
 get('file').files=[{size:3000000,text:async()=>''}];await app.importModel();assert(get('status').textContent.includes('Import failed'));
});
