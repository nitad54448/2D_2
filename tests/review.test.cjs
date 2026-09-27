const {test}=require('node:test'),assert=require('node:assert/strict'),TE=require('./load.cjs');
require('../src/ui-helpers.js');
test('omitted convection h consistently means zero in validation and solver',()=>{
 const c=TE.default2D();c.mode='steady';c.electrical.value=0;delete c.thermal.right.h;
 assert.deepEqual(TE.validate2DConfig(c),[]);const r=TE.run2D(c);assert.ok(r.temperature.every(v=>Math.abs(v-300)<1e-6));
});
test('linear solver rejects invalid options instead of reporting false convergence',()=>{
 const mesh={n:2,links:[{a:0,b:1}]},solve=opts=>TE.graphSolve(mesh,[1],[0,0],[0,1],new Map([[0,0]]),opts);
 for(const rtol of [NaN,Infinity,0,-1,1])assert.throws(()=>solve({rtol}));
 for(const maxIter of [NaN,0,-1,1.5])assert.throws(()=>solve({maxIter}));
 assert.deepEqual(solve({maxIter:1}),[0,1]);
 assert.throws(()=>solve({initial:[0,NaN]}));
});
test('fully fixed graph still rejects invalid conductance',()=>{
 assert.throws(()=>TE.graphSolve({n:2,links:[{a:0,b:1}]},[Infinity],[0,0],[0,0],new Map([[0,0],[1,1]])));
});
test('unconverged plots do not fabricate a periodic closing sample',()=>{
 const r={time:[0,.25,.5,.75],frequency:1,converged:false};
 assert.deepEqual(TE.historyForPlot(r,[1,2,3,4]),{time:[0,250,500,750],values:[1,2,3,4]});
 assert.deepEqual(TE.historyForPlot({...r,converged:true},[1,2,3,4]),{time:[0,250,500,750,1000],values:[1,2,3,4,1]});
});
