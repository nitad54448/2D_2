const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),TE=require('./load.cjs');require('../src/ui-helpers.js');require('../src/sweep.js');require('../src/exports.js');
function context(){const ids={},$=id=>ids[id]??(ids[id]={value:'',addEventListener(){}});const ctx=vm.createContext({TE,$,worker:null,sweepResult:null,activeSweep:null,checkpoint:null,result:null,probe:0,fmt:v=>String(v),esc:s=>String(s).replace(/</g,'&lt;'),download(){},accept:r=>{ctx.result=r;},Blob});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/sweep-ui.js'),'utf8'),ctx);return {ctx,ids};}
function computed(){const c=TE.default2D();Object.assign(c,{nx:2,ny:1,samples:64,maxPeriods:4,materialMap:[0,0]});c.materials[0].alpha=0;c.electrical.value={bias:0,amplitude:.01,phase:0};c.sweep={enabled:true,min:1,max:2,points:2,spacing:'linear'};const results=[];TE.runSweep(c,e=>{if(e.type==='sweepPoint')results.push(e.result);});return {config:c,frequencies:[1,2],results,status:'complete'};}
const options={quantity:'impedance',harmonic:1,reference:'current',normalization:'raw',phaseFloor:1e-12,x:.5,y:.5,unwrap:false,scale:'physical',dbReference:1};
test('sweep report and full archive include every point, Bode settings and equations',async()=>{
 const {ctx}=context(),s=computed(),report=ctx.sweepReport(s,s.results[0],options,0);assert.ok(report.html.includes('Bode summary'));assert.ok(report.html.includes('Detailed report below: 1 Hz'));for(const e of TE.equationGuide)assert.ok(report.html.includes(e.html));
 const files=await ctx.sweepFiles(s,options,s.results[0],0),get=name=>files.find(f=>f.name===name)?.data;for(const folder of ['frequency-001','frequency-002']){assert.ok(get(folder+'/histories/temperature.csv'));assert.ok(get(folder+'/harmonics/qy.csv'));assert.ok(get(folder+'/report.html'));assert.ok(get(folder+'/results.json'));}
 assert.equal(JSON.parse(get('sweep-status.json')).bodeOptions.quantity,'impedance');assert.equal(get('bode.csv').split('\n').length,3);
 const db=ctx.sweepReport(s,s.results[0],{...options,scale:'db',dbReference:2},0);assert.ok(db.html.includes('dB re 2'));assert.throws(()=>ctx.sweepReport(s,s.results[0],{...options,scale:'db',dbReference:0},0));
 assert.ok(!/NaN|Infinity/.test(report.html));
});
test('stop retains completed frequencies and a provisional checkpoint; completed sweeps avoid duplicates',()=>{
 const {ctx}=context(),s=computed();ctx.refreshSweepPoints=()=>{};ctx.drawBode=()=>{};ctx.activeSweep={...s,results:[s.results[0]],status:'running'};ctx.checkpoint={...s.results[1],converged:false};ctx.finishSweep('Stopped');assert.equal(ctx.sweepResult.results.length,2);assert.equal(ctx.activeSweep,null);assert.equal(ctx.sweepResult.status,'stopped');assert.equal(ctx.result.converged,false);
 ctx.activeSweep=s;ctx.checkpoint=null;ctx.finishSweep('Done',true);assert.equal(ctx.sweepResult.results.length,2);assert.equal(ctx.sweepResult.status,'complete');
});
test('built UI contains all referenced static IDs and no unresolved injection markers',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../assets/app.js'),'utf8');
 for(const id of ['sweepSettings','sweepMin','sweepMax','sweepPoints','sweepSpacing','bodeCard','bodeQuantity','bodeReference','bodeNormalization','bodeMagnitude','bodePhase','bodeCsv','sweepPoint'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(!app.includes('/*SWEEP_UI*/'));assert.ok(app.includes('function finishSweep('));
});
