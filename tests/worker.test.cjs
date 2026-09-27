const {test}=require('node:test'),assert=require('node:assert/strict'),{Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),TE=require('./load.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),source=html.match(/<script id="workerSource" type="text\/plain">([\s\S]*?)<\/script>/)[1];
function run(c){return new Promise((resolve,reject)=>{const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=data=>parentPort.postMessage(data);\n${source}\nparentPort.on('message',data=>self.onmessage({data}));`,{eval:true});const timeout=setTimeout(()=>{w.terminate();reject(new Error('Timeout'));},30000);w.on('message',data=>{if(data.type==='result'||data.type==='error'){clearTimeout(timeout);w.terminate();resolve(data);}});w.on('error',e=>{clearTimeout(timeout);reject(e);});w.postMessage(c);});}
test('offline document loads local scripts and has five accessible tabs',()=>{assert.ok(!/<script[^>]+src=["\']https?:/i.test(html));assert.equal((html.match(/role="tab"/g)||[]).length,5);assert.equal((html.match(/role="tabpanel"/g)||[]).length,5);assert.ok(!/\/\*(CORE|STYLE|APP|WORKER)\*\//.test(html));});
test('embedded worker computes a real 2D partial-contact case',async()=>{const c=TE.default2D();c.mode='steady';c.electrical.value={bias:.1,amplitude:0};c.electrical.sourceRange=[.25,.75];const r=await run(c);assert.equal(r.type,'result');assert.equal(r.result.Jx.length,c.nx*c.ny);assert.ok(Math.max(...r.result.Jy.map(Math.abs))>100);});
test('embedded worker rejects bad material properties',async()=>{const c=TE.default2D();c.mode='steady';c.materials[0].k=-1;const r=await run(c);assert.equal(r.type,'error');assert.match(r.message,/positive/);});
test('worker supplies progress and a complete provisional cycle before termination',async()=>{
 const c=TE.default2D();c.nx=2;c.ny=2;c.materialMap=Array(4).fill(0);c.samples=64;
 const checkpoint=await new Promise((resolve,reject)=>{
  const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=data=>parentPort.postMessage(data);\n${source}\nparentPort.on('message',data=>self.onmessage({data}));`,{eval:true});
  let progress=false;const timeout=setTimeout(()=>{w.terminate();reject(new Error('Timeout'));},30000);
  w.on('error',e=>{clearTimeout(timeout);w.terminate();reject(e);});
  w.on('message',data=>{if(data.type==='progress'){progress=true;assert.ok(data.progress.step>0&&data.progress.step<=c.samples);}if(data.type==='checkpoint'||data.type==='error'){clearTimeout(timeout);w.terminate();if(data.type==='error')reject(new Error(data.message));else{assert.ok(progress);resolve(data.result);}}});w.postMessage(c);
 });
 assert.equal(checkpoint.converged,false);assert.equal(checkpoint.periods,1);assert.equal(checkpoint.temperature.length,64);assert.equal(checkpoint.harmonics.temperature.length,4);assert.equal(checkpoint.config.depth,c.depth);assert.ok(checkpoint.temperature.flat().every(Number.isFinite));
});
test('separate scripts compile and initialize TE in HTML load order',()=>{
 const vm=require('node:vm'),sources=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(sources,['assets/startup.js','assets/core.js','assets/exports.js','assets/app.js']);
 const context=vm.createContext({});for(const file of sources){const code=fs.readFileSync(path.join(__dirname,'..',file),'utf8');assert.doesNotThrow(()=>new vm.Script(code,{filename:file}));if(file.endsWith('/core.js')||file.endsWith('/exports.js'))vm.runInContext(code,context);}
 assert.equal(typeof context.TE.default2D,'function');assert.equal(typeof context.TE.resultReport,'function');assert.equal(typeof context.TE.completeResultsFiles,'function');
 assert.ok(html.includes('id="startupError"'));assert.ok(!html.includes('TE.resultReport='));
});

test('sweep worker emits both converged points and supports termination at the next point',async()=>{
 const c=TE.default2D();Object.assign(c,{nx:2,ny:1,samples:64,maxPeriods:4,materialMap:[0,0]});c.materials[0].alpha=0;c.electrical.value={bias:0,amplitude:.01,phase:0};c.sweep={enabled:true,min:1,max:10,points:2,spacing:'log'};
 async function execute(stop){return new Promise((resolve,reject)=>{
  const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=data=>parentPort.postMessage(data);\n${source}\nparentPort.on('message',data=>self.onmessage({data}));`,{eval:true});const rows=[];
  const timeout=setTimeout(()=>{w.terminate();reject(Error('Sweep timeout'));},30000);
  w.on('error',e=>{clearTimeout(timeout);w.terminate();reject(e);});
  w.on('message',data=>{if(data.type==='sweepPoint')rows.push(data.result);if(data.type==='sweepDone'||(stop&&data.type==='sweepStart'&&data.index===1)){clearTimeout(timeout);w.terminate();resolve(rows);}if(['error','sweepError'].includes(data.type)){clearTimeout(timeout);w.terminate();reject(Error(data.message));}});w.postMessage(c);
 });}
 const full=await execute(false);assert.deepEqual(full.map(r=>r.frequency),[1,10]);assert.ok(full.every(r=>r.converged&&!r.config.sweep.enabled));
 const stopped=await execute(true);assert.equal(stopped.length,1);assert.equal(stopped[0].frequency,1);assert.ok(stopped[0].temperature.length===64);
});
