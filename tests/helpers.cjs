'use strict';
const assert=require('node:assert/strict');
require('../assets/core.js');require('../assets/worker.js');require('../assets/exports.js');
const TE=globalThis.TE;
function model(overrides={}) {
 const c=TE.default2D();Object.assign(c,{mode:'steady',nx:8,ny:1,lx:.001,ly:.001,depth:.001,materialMap:Array(8).fill(0),samples:64,maxPeriods:100});
 c.materials=[{name:'Test',rho:2000,Cp:500,k:2,sigma:1e5,beta:0,alpha:0,alphaSlope:0,color:'#73d8d0'}];
 c.thermal.right={kind:'temperature',value:300,h:0};c.electrical.value={bias:.2,amplitude:0,phase:0};
 return Object.assign(c,overrides);
}
function periodic(overrides={}) {const c=model({mode:'periodic',frequency:2,...overrides});c.electrical.value={bias:0,amplitude:.2,phase:0};return c;}
function near(a,b,atol=1e-9,rtol=1e-7) {assert(Number.isFinite(a)&&Math.abs(a-b)<=atol+rtol*Math.abs(b),`${a} != ${b}`);}
function complexDistance(a,b){return Math.hypot(a.re-b.re,a.im-b.im)}
module.exports={TE,model,periodic,near,complexDistance};
