'use strict';
const path=require('node:path'),{performance}=require('node:perf_hooks');
// Optional first argument is a previous core.js for a reproducible comparison.
require(process.argv[2]?path.resolve(process.argv[2]):'../assets/core.js');
const c=TE.default2D();Object.assign(c,{nx:8,ny:2,materialMap:Array.from({length:16},(_,i)=>i%8<4?0:1),samples:64,frequency:2});
TE.run2D(c);const times=[];let r;for(let i=0;i<5;i++){const start=performance.now();r=TE.run2D(c);times.push(performance.now()-start)}
console.log(JSON.stringify({case:'8 × 2 layered, 64 samples, 2 Hz',timesMs:times,medianMs:[...times].sort((a,b)=>a-b)[2],cycles:r.periods,terminal1:r.harmonics.terminalVoltage[1]},null,2));
