const {test}=require('node:test'),assert=require('node:assert/strict'),TE=require('./load.cjs');
const check=(edit,path)=>{const c=TE.default2D();edit(c);const errors=TE.validate2DConfig(c);assert.ok(errors.some(e=>e.path===path),JSON.stringify(errors));assert.throws(()=>TE.from2DConfig(c));};
test('all example defaults are valid',()=>assert.deepEqual(TE.validate2DConfig(TE.default2D()),[]));
for(const key of ['lx','ly','depth'])test(key+' rejects zero, negative, missing, null and non-finite values',()=>{for(const v of [0,-.1,NaN,Infinity,null,undefined,'1'])check(c=>c[key]=v,key);});
for(const key of ['rho','Cp','k','sigma'])test(key+' requires a strictly positive finite material value',()=>{for(const v of [0,-1,NaN,Infinity,null,'2'])check(c=>c.materials[0][key]=v,'materials.0.'+key);});
test('geometry underflow/overflow is rejected',()=>{check(c=>{c.lx=1e300;c.ly=1e300;},'depth');check(c=>c.depth=Number.MIN_VALUE,'depth');});
test('temperature waveforms must be positive for the complete cycle',()=>{
 for(const kind of ['temperature','convection'])for(const s of [{bias:0,amplitude:0},{bias:-1,amplitude:0},{bias:300,amplitude:300},{bias:300,amplitude:-301}])check(c=>{c.thermal.right.kind=kind;c.thermal.right.value=s;},'thermal.right.value.bias');
 const c=TE.default2D();c.mode='steady';c.thermal.right.value={bias:300,amplitude:400};assert.deepEqual(TE.validate2DConfig(c),[]);
});
test('valid signed currents, voltages, fluxes and thermoelectric coefficients remain allowed',()=>{
 const c=TE.default2D();c.electrical.value={bias:-.1,amplitude:-.2,phase:-720};c.thermal.top.value={bias:-100,amplitude:-20,phase:-40};c.materials[0].alpha=-2e-4;c.materials[0].alphaSlope=-1e-7;c.materials[0].beta=-.002;assert.deepEqual(TE.validate2DConfig(c),[]);
});
test('negative convection and non-finite signals fail',()=>{
 check(c=>c.thermal.right.h=-1,'thermal.right.h');
 for(const v of [null,'300',Infinity,NaN])check(c=>c.thermal.left.value={bias:v,amplitude:0},'thermal.left.value.bias');
 for(const k of ['bias','amplitude','phase'])check(c=>c.electrical.value[k]=Infinity,'electrical.value.'+k);
 check(c=>c.electrical.value={bias:1e308,amplitude:1e308},'electrical.value.amplitude');
});
test('mesh counts and map are validated independently',()=>{
 for(const v of [0,1,2.5,Infinity])check(c=>c.nx=v,'nx');check(c=>c.ny=1000,'ny');
 check(c=>c.materialMap.pop(),'materialMap');check(c=>c.materialMap[0]=99,'materialMap');check(c=>c.materialMap[0]=.5,'materialMap');
});
test('frequency, time samples and cycle budget are validated',()=>{
 for(const v of [0,-1,Infinity])check(c=>c.frequency=v,'frequency');
 for(const v of [0,31,32.5,2049,NaN])check(c=>c.samples=v,'samples');
 for(const v of [0,2,3.5,1001,Infinity])check(c=>c.maxPeriods=v,'maxPeriods');
 const c=TE.default2D();c.mode='steady';c.frequency=0;assert.deepEqual(TE.validate2DConfig(c),[]);
});
test('electrode coverage, sides and overlap are rejected early',()=>{
 for(const r of [[0,0],[-.1,.5],[.5,1.1],[.6,.3],[NaN,1],[.01,.02]])check(c=>c.electrical.sourceRange=r,'electrical.sourceRange');
 check(c=>c.electrical.sourceSide='unknown','electrical.sourceSide');check(c=>c.electrical.sinkSide='left','electrical.sinkRange');
});
test('all-time corner consistency, not just t=0, is enforced',()=>{
 check(c=>{c.thermal.left.value={bias:300,amplitude:0};c.thermal.top={kind:'temperature',value:{bias:299,amplitude:1,phase:0},h:0};},'thermal.left.value.bias');
 const c=TE.default2D();c.thermal.left.value={bias:300,amplitude:1,phase:0};c.thermal.top={kind:'temperature',value:{bias:300,amplitude:-1,phase:180},h:0};assert.deepEqual(TE.validate2DConfig(c),[]);
});
test('laws that become invalid at prescribed temperatures and overflowing capacity are rejected',()=>{
 check(c=>{c.materials[0].beta=-.02;c.thermal.right.value=400;},'materials.0.sigma');
 check(c=>{c.materials[0].rho=1e308;c.materials[0].Cp=1e308;},'materials.0.Cp');
});
test('runtime checks reject an evolving invalid law and non-finite power',()=>{
 const s=TE.from2DConfig(TE.default2D());s.materials[0].sigma=T=>T>310?-1:1e5;assert.throws(()=>s.properties(Array(s.mesh.n).fill(320)),/positive/);
 const c=TE.default2D();c.mode='steady';c.electrical.value=1e300;assert.throws(()=>TE.run2D(c),/finite|range|overflow/);
});
test('direct solver API rejects invalid numerical settings',()=>{
 const s=TE.from2DConfig(TE.default2D());assert.throws(()=>s.solvePeriodic(2,{periodicAtol:0}),/tolerance/);assert.throws(()=>s.solvePeriodic(2,{minPeriods:2.5}),/cycle/);assert.throws(()=>s.solveSteady({relaxation:0}),/Relaxation/);
});
test('malformed imported objects produce validation errors rather than silent coercion',()=>{
 for(const c of [null,[],3,'model',{}, {...TE.default2D(),materials:[null]},{...TE.default2D(),thermal:null}]){assert.ok(TE.validate2DConfig(c).length);assert.throws(()=>TE.assertValid2DConfig(c));}
});
