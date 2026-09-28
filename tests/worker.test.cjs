'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');const {TE,model,periodic,near}=require('./helpers.cjs');
const bridge=`const {parentPort}=require('node:worker_threads'); const self={postMessage:(m,t)=>parentPort.postMessage(m,t)}; parentPort.on('message',data=>self.onmessage({data}));\n`;
function run(config){return new Promise((resolve,reject)=>{
 const worker=new Worker(bridge+TE.workerSource(),{eval:true}),messages=[];
 const timeout=setTimeout(()=>{worker.terminate();reject(Error('worker timeout'))},30000);
 worker.on('error',error=>{clearTimeout(timeout);reject(error)});
 worker.on('message',wire=>{
  if(wire.result){assert.equal(wire.result.temperature.encoding,'float64');assert(wire.result.temperature.buffer instanceof ArrayBuffer);}
  const message=TE.decodeWorkerMessage(wire);messages.push(message);
  if(['result','sweepDone','error','sweepError'].includes(message.type)){clearTimeout(timeout);worker.terminate();resolve(messages);}
 });worker.postMessage(config);
})}
test('Generated worker executes the same steady core and restores plain JSON arrays',async()=>{
 const c=model(),direct=TE.run2D(c),messages=await run(c);assert.equal(messages.at(-1).type,'result');const result=messages.at(-1).result;
 assert.deepEqual(result,direct);assert(Array.isArray(JSON.parse(JSON.stringify(result)).temperature));
});
test('Periodic worker transfers real/complex fields and leaves checkpoints usable',async()=>{
 const c=periodic(),direct=TE.run2D(c),messages=await run(c),last=messages.at(-1);
 assert.equal(last.type,'result');assert.deepEqual(last.result,direct);
 const checkpoint=messages.find(m=>m.type==='checkpoint').result;assert.equal(checkpoint.converged,false);TE.checkResult(checkpoint);
 assert.equal(checkpoint.temperature.length,c.samples);assert(checkpoint.temperature[0].every(Number.isFinite));
});
test('Frequency sweep reports all converged points through worker transport',async()=>{
 const c=periodic();c.sweep={enabled:true,min:1,max:2,points:2,spacing:'linear'};const messages=await run(c);
 assert.equal(messages.at(-1).type,'sweepDone');const points=messages.filter(m=>m.type==='sweepPoint').map(m=>m.result);
 assert.deepEqual(points.map(r=>r.frequency),[1,2]);for(const r of points){assert(r.converged);near(TE.bodeRows([r],{quantity:'impedance'})[0].magnitude,.01)}
});
test('Worker validation errors are structured and do not publish invalid results',async()=>{
 const c=model();c.materials[0].sigma=0;const messages=await run(c);assert.equal(messages.at(-1).type,'error');assert(!messages.some(m=>m.result));
});
test('Worker budget failure retains the last complete provisional cycle',async()=>{
 const c=periodic({frequency:100,maxPeriods:3});const messages=await run(c);assert.equal(messages.at(-1).type,'error');
 const last=messages.filter(m=>m.type==='checkpoint').at(-1).result;assert.equal(last.periods,3);assert.equal(last.converged,false);TE.checkResult(last);
});
module.exports={bridge};
