const {test}=require('node:test'),assert=require('node:assert/strict'),TE=require('./load.cjs');
require('../src/ui-helpers.js');
test('decimal display removes conversion noise without erasing small signals',()=>{
 assert.equal(TE.formatInputNumber(.19999999999),'0.2');
 assert.equal(TE.formatInputNumber(2e-7*1e6),'0.2');
 assert.equal(TE.formatInputNumber(.1+.2),'0.3');
 assert.equal(TE.formatInputNumber(2e-14),'2E-14');
 assert.equal(TE.formatInputNumber(20),'20');
 assert.equal(TE.formatInputNumber(5000000),'5E6');
 assert.equal(TE.formatInputNumber(58000000),'5.8E7');
});
test('raw precision survives formatting, and a changed field takes the entered value',()=>{
 const e={value:'',dataset:{}},raw=.123456789012345;
 TE.setNumberInput(e,raw);assert.equal(e.value,'0.123456789');assert.equal(TE.readNumberInput(e),raw);
 e.value='0.25';assert.equal(TE.readNumberInput(e),.25);
 e.value='';assert.throws(()=>TE.readNumberInput(e));
});
test('changing Nx/Ny really changes elements and solver nodes while retaining material regions',()=>{
 const c=TE.default2D(),next=TE.remeshConfig(c,{nx:20,ny:10,lx:c.lx,ly:c.ly,depth:c.depth});
 assert.equal(next.materialMap.length,200);assert.equal(c.materialMap.length,96);
 for(let j=0;j<10;j++)for(let i=0;i<20;i++)assert.equal(next.materialMap[j*20+i],i<10?0:1);
 assert.equal(TE.from2DConfig(next).mesh.n,231);
});
test('dimension-only changes preserve painting and update domain measures',()=>{
 const c=TE.default2D();c.materialMap[5]=1;c.materialMap[70]=0;
 const next=TE.remeshConfig(c,{nx:c.nx,ny:c.ny,lx:.004,ly:.002,depth:.0005});
 assert.deepEqual(next.materialMap,c.materialMap);const m=TE.from2DConfig(next).mesh;
 assert.equal(m.lx,.004);assert.equal(m.ly,.002);assert.equal(m.depth,.0005);
});
test('invalid mesh edits fail before mutating the current model',()=>{
 const c=TE.default2D(),before=JSON.stringify(c);
 for(const pair of [[1,10],[2.5,10],[100,100]])assert.throws(()=>TE.remeshConfig(c,{nx:pair[0],ny:pair[1],lx:.002,ly:.001,depth:.001}));
 assert.equal(JSON.stringify(c),before);
 const max=TE.remeshConfig(c,{nx:39,ny:39,lx:.002,ly:.001,depth:.001});assert.equal(TE.from2DConfig(max).mesh.n,1600);
});

test('single-row remesh retains layered material order and rejects nonpositive Ny',()=>{
 const c=TE.default2D(),g={nx:12,ny:1,lx:c.lx,ly:c.ly,depth:c.depth};
 const next=TE.remeshConfig(c,g);assert.deepEqual(next.materialMap,[0,0,0,0,0,0,1,1,1,1,1,1]);
 assert.equal(TE.from2DConfig(next).mesh.n,26);
 for(const ny of [0,-1,1.5]){assert.throws(()=>TE.remeshConfig(c,{...g,ny}));assert.throws(()=>TE.from2DConfig({...next,ny}));}
});
