const {test}=require('node:test'),assert=require('node:assert/strict'),TE=require('./load.cjs');
require('../src/ui-helpers.js');
test('surface maps use all cells, selected time, and instantaneous vector magnitudes',()=>{
 const r={config:{nx:2,ny:1},method:'BDF2',samples:2,
 temperature:[[0,2,4,6,8,10],[10,12,14,16,18,20]],
 Jx:[[3,0],[0,5]],Jy:[[4,2],[2,12]],qx:[[1,2],[3,4]]};
 assert.deepEqual(TE.surfaceField(r,'temperature',1).cells,[14,16]);
 assert.deepEqual(TE.surfaceField(r,'J',1).cells,[2,13]);
 assert.deepEqual(TE.surfaceField(r,'qx',0),{cells:[1,2],nodal:false,unit:'W/m²'});
 assert.throws(()=>TE.surfaceField(r,'temperature',2));
 assert.throws(()=>TE.surfaceField(r,'invalid'));
 const dc={...r,method:'steady',temperature:r.temperature[0]};
 assert.deepEqual(TE.surfaceField(dc,'temperature').cells,[4,6]);
});
test('Cu/BiTe example preserves transverse symmetry and prescribed current; DC noise arrows are suppressed',()=>{
 const c=TE.default2D(),r=TE.run2D(c),cols=c.nx+1;
 assert.ok(r.converged);
 for(const T of r.temperature)for(let j=1;j<=c.ny;j++)for(let i=0;i<=c.nx;i++)assert.ok(Math.abs(T[j*cols+i]-T[i])<1e-7);
 r.current.forEach((v,i)=>assert.ok(Math.abs(v-(c.electrical.value.bias+c.electrical.value.amplitude*Math.cos(2*Math.PI*c.frequency*r.time[i]+(c.electrical.value.phase||0)*Math.PI/180)))<1e-8));
 const peak=n=>Math.max(...r.harmonics.Jx[n].map((z,i)=>Math.hypot(z.re,z.im,r.harmonics.Jy[n][i].re,r.harmonics.Jy[n][i].im)));
 assert.ok(peak(0)<TE.arrowNoiseFloor(r));
 assert.ok(peak(1)>TE.arrowNoiseFloor(r));
});
