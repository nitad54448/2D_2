const {test}=require('node:test'),assert=require('node:assert/strict'),TE=require('./load.cjs');require('../src/ui-helpers.js');require('../src/sweep.js');
const z=(a,p)=>({re:a*Math.cos(p*Math.PI/180),im:a*Math.sin(p*Math.PI/180)});
function fixture(){const c=TE.default2D();c.electrical.value={bias:0,amplitude:2,phase:30};return {config:c,converged:true,frequency:1,harmonics:{current:[z(0,0),z(2,30),z(0,0),z(0,0)],terminalVoltage:[z(0,0),z(8,-150),z(12,70),z(16,110)]}};}
test('frequency grids include endpoints and reject invalid or oversized sweeps',()=>{
 assert.deepEqual(TE.sweepFrequencies({min:1,max:100,points:3,spacing:'log'}).map(v=>Math.round(v)),[1,10,100]);
 assert.deepEqual(TE.sweepFrequencies({min:1,max:5,points:3,spacing:'linear'}),[1,3,5]);
 for(const change of [{min:0},{max:1},{points:1},{points:101},{points:2.2},{min:NaN},{spacing:'bad'}])assert.throws(()=>TE.sweepFrequencies({min:1,max:100,points:3,spacing:'log',...change}));
 const c=TE.default2D();c.sweep={enabled:true,min:1,max:10,points:2,spacing:'log'};assert.equal(TE.validateSweep(c).length,2);
 assert.throws(()=>TE.validateSweep({...c,samples:1024,sweep:{...c.sweep,points:100}}),/256 MiB/);
 c.electrical.value.amplitude=0;assert.throws(()=>TE.validateSweep(c),/nonzero/);
});
test('impedance sign convention yields positive resistance and zero phase',()=>{
 const r=fixture(),row=TE.bodeRows([r],{quantity:'impedance'})[0];assert.ok(Math.abs(row.magnitude-4)<1e-12);assert.ok(Math.abs(row.phase)<1e-12);assert.equal(row.unit,'Ω');
 assert.throws(()=>TE.bodeRows([r],{quantity:'impedance',harmonic:2}));
});
test('higher harmonic phase subtracts n times reference; amplitude normalization is independent',()=>{
 const r=fixture();let row=TE.bodeRows([r],{harmonic:3,normalization:'power'})[0];assert.ok(Math.abs(row.magnitude-2)<1e-12);assert.ok(Math.abs(row.phase-20)<1e-12);
 row=TE.bodeRows([r],{harmonic:2,normalization:'fundamental'})[0];assert.ok(Math.abs(row.magnitude-6)<1e-12);assert.ok(Math.abs(row.phase-10)<1e-12);
 r.config.thermal.left.value={bias:300,amplitude:4,phase:20};row=TE.bodeRows([r],{harmonic:2,reference:'left',normalization:'power'})[0];assert.ok(Math.abs(row.magnitude-.75)<1e-12);assert.ok(Math.abs(row.phase-30)<1e-12);
});
test('zero/inactive references and unconverged points cannot produce misleading Bode values',()=>{
 const r=fixture();r.config.electrical.value.amplitude=0;let row=TE.bodeRows([r])[0];assert.equal(row.phase,null);assert.ok(row.magnitude>0);
 assert.equal(TE.bodeRows([r],{normalization:'fundamental'})[0].magnitude,null);
 r.config.electrical.kind='open_circuit';assert.equal(TE.bodeRows([r],{quantity:'impedance'})[0].magnitude,null);
 r.converged=false;row=TE.bodeRows([r],{reference:'time'})[0];assert.equal(row.magnitude,null);assert.equal(row.phase,null);
 assert.throws(()=>TE.bodeRows([r],{reference:'time',normalization:'power'}));
});
test('phase unwrapping resets over undefined points, probe sampling and CSV retain nulls',()=>{
 const a=fixture(),b=fixture(),c=fixture();a.harmonics.terminalVoltage[1]=z(1,170);b.harmonics.terminalVoltage[1]=z(1,-170);c.harmonics.terminalVoltage[1]=z(1,-160);
 let rows=TE.bodeRows([a,b,c],{reference:'time',unwrap:true});assert.deepEqual(rows.map(r=>Math.round(r.phase)),[170,190,200]);b.converged=false;rows=TE.bodeRows([a,b,c],{reference:'time',unwrap:true});assert.deepEqual(rows.map(r=>r.phase===null?null:Math.round(r.phase)),[170,null,-160]);assert.ok(TE.bodeCsv(rows).includes('Unconverged'));
 a.harmonics.temperature=Array.from({length:4},()=>Array.from({length:117},(_,i)=>z(i,0)));const row=TE.bodeRows([a],{quantity:'temperature',reference:'time',x:1,y:1})[0];assert.equal(row.nodeOrCell,116);assert.equal(row.magnitude,116);
});
test('actual sweep preserves Ohmic resistance at every frequency and reports failure without losing prior points',()=>{
 const c=TE.default2D();Object.assign(c,{nx:2,ny:1,samples:64,maxPeriods:4,materialMap:[0,0]});c.materials[0].alpha=0;c.electrical.value={bias:0,amplitude:.01,phase:37};c.sweep={enabled:true,min:1,max:10,points:2,spacing:'log'};
 const events=[];TE.runSweep(c,e=>events.push(e));const rs=events.filter(e=>e.type==='sweepPoint').map(e=>e.result);assert.equal(rs.length,2);assert.equal(events.at(-1).type,'sweepDone');
 const expected=c.lx/(c.materials[0].sigma*c.ly*c.depth);for(const row of TE.bodeRows(rs,{quantity:'impedance'})){assert.ok(Math.abs(row.magnitude/expected-1)<1e-7);assert.ok(Math.abs(row.phase)<1e-7);}
 const original=TE.run2D;let n=0;try{TE.run2D=(cfg,p,cp)=>{if(n++)throw Error('Injected second-point failure');return rs[0];};const failed=[];TE.runSweep(c,e=>failed.push(e));assert.equal(failed.filter(e=>e.type==='sweepPoint').length,1);assert.equal(failed.at(-1).type,'sweepError');assert.equal(failed.at(-1).index,1);}finally{TE.run2D=original;}
});
