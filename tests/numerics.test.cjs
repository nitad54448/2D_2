'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {TE,model,periodic,near,complexDistance}=require('./helpers.cjs');

test('Ohmic voltage, analytic Joule profile and energy balance',()=>{
 const c=model(),r=TE.run2D(c);near(r.terminalVoltage,-.002);near(r.current,.2);near(r.energyResidual,0);
 r.temperature.forEach((v,i)=>{const x=r.mesh.x[i];near(v,300+(.2/1e-6)**2/1e5/(2*2)*x*(.001-x),1e-8,0)});
 assert(r.diagnostics.heatResidualNormalized<=1);
});
test('Voltage drive uses sink-source convention',()=>{const c=model();c.electrical.kind='voltage';c.electrical.value=-.002;near(TE.run2D(c).current,.2)});
test('Open-circuit Seebeck integrates a temperature-dependent coefficient',()=>{
 const c=model();c.materials[0].alpha=2e-4;c.materials[0].alphaSlope=2e-7;c.thermal.right.value=350;c.electrical.kind='open_circuit';
 const r=TE.run2D(c);near(r.terminalVoltage,-(2e-4*50+2e-7*50*50/2));near(r.current,0);
});
test('Fourier convention: DC, positive cosine phase, harmonics 1–3',()=>{
 const h=TE.extractHarmonics(Array.from({length:128},(_,j)=>3+2*Math.cos(2*Math.PI*j/128+.4)+.2*Math.cos(6*Math.PI*j/128-.7)));
 near(h[0].re,3);near(h[1].re,2*Math.cos(.4));near(h[1].im,2*Math.sin(.4));near(Math.hypot(h[2].re,h[2].im),0);near(h[3].im,-.2*Math.sin(.7));
});
test('Finite huge phases agree between waveform and Bode references',()=>{
 const r=TE.run2D(periodic());for(const degrees of [0,90,-450,1e15,1e308,-1e308]){
  r.config.electrical.value.phase=degrees;const angle=TE.phaseRadians(degrees),row=TE.bodeRows([r],{reference:'drive'})[0];
  near(TE.signal2D(r.config.electrical.value,0,r.frequency),.2*Math.cos(angle));assert(Number.isFinite(row.phase));near(row.referenceMagnitude,.2);
  const expected=((Math.atan2(r.harmonics.terminalVoltage[1].im,r.harmonics.terminalVoltage[1].re)*180/Math.PI-degrees%360+180)%360+360)%360-180;near(row.phase,expected);
 }
});
test('Periodic convergence includes heat balance and terminal harmonics',()=>{
 const r=TE.run2D(periodic());assert(r.converged&&r.periodicError<=1&&r.diagnostics.terminalHarmonicError<=1&&r.diagnostics.heatResidualNormalized<=1);
 const z=TE.bodeRows([r],{quantity:'impedance'})[0];near(z.magnitude,.01);near(z.phase,0);
 assert(Math.hypot(r.harmonics.temperature[2][4].re,r.harmonics.temperature[2][4].im)>1e-5);
});
test('Nonlinear resistance produces a nonzero 3ω voltage',()=>{
 const c=periodic();c.materials[0].beta=.01;const r=TE.run2D(c);assert(Math.hypot(r.harmonics.terminalVoltage[3].re,r.harmonics.terminalVoltage[3].im)>1e-9);
});
test('Cu-like/TE/Cu-like interfaces have opposite current-odd Peltier effects',()=>{
 const c=model({nx:12,materialMap:Array.from({length:12},(_,i)=>i>=4&&i<8?1:0)});
 c.materials.push({...c.materials[0],name:'TE',alpha:2e-4});c.electrical.value=.01;
 const forward=TE.run2D(c);c.electrical.value=-.01;const reverse=TE.run2D(c);
 assert(forward.temperature[4]<reverse.temperature[4]);assert(forward.temperature[8]>reverse.temperature[8]);
 near(forward.temperature[4],reverse.temperature[8],1e-7);near(forward.energyResidual,0,1e-9);
});
test('Thomson coupling changes the temperature under a thermal gradient',()=>{
 const c=model({nx:16,materialMap:Array(16).fill(0)});c.thermal.right.value=350;c.electrical.value=.1;c.materials[0].alpha=2e-4;
 const zero=TE.run2D(c);c.materials[0].alphaSlope=2e-6;const slope=TE.run2D(c);
 assert(Math.abs(slope.temperature[8]-zero.temperature[8])>1e-3);near(slope.energyResidual,0,1e-8);assert(slope.diagnostics.heatResidualNormalized<=1);
});
test('Narrow contacts spread current and increase resistance',()=>{
 const c=model({nx:8,ny:8,materialMap:Array(64).fill(0)});const wide=TE.run2D(c);c.electrical.sourceRange=[.25,.75];const narrow=TE.run2D(c);
 assert(Math.abs(narrow.terminalVoltage)>Math.abs(wide.terminalVoltage));assert(Math.max(...narrow.Jy.map(Math.abs))>1);near(narrow.current,.2);near(narrow.energyResidual,0,1e-8);
});
test('Thermal AC selects periodic mode with open-circuit electrical control',()=>{
 const c=periodic();c.electrical.kind='open_circuit';c.thermal.left.value={bias:300,amplitude:2,phase:35};
 assert.equal(TE.inferSimulationMode(c),'periodic');const r=TE.run2D(c);near(r.harmonics.temperature[1][0].re,2*Math.cos(TE.phaseRadians(35)),1e-8);near(r.harmonics.temperature[1][0].im,2*Math.sin(TE.phaseRadians(35)),1e-8);near(r.harmonics.current[1].re,0);
});
test('Time refinement reduces error in the thermal 2ω response',()=>{
 const results=[64,128,256].map(samples=>TE.run2D(periodic({samples})).harmonics.temperature[2][4]);
 assert(complexDistance(results[1],results[2])<complexDistance(results[0],results[1])/2.5);
});
test('Mesh refinement reduces thermal AC midpoint error',()=>{
 const results=[8,16,32].map(nx=>{const c=periodic({nx,materialMap:Array(nx).fill(0),samples:256});c.electrical.value=0;c.thermal.left.value={bias:300,amplitude:2,phase:0};return TE.run2D(c).harmonics.temperature[1][nx/2]});
 assert(complexDistance(results[1],results[2])<complexDistance(results[0],results[1])/2.5);
});
test('Single-frequency and sweep memory budgets reject excessive retained data',()=>{
 const c=periodic({nx:39,ny:39,materialMap:Array(39*39).fill(0),samples:2048});assert(TE.validate2DConfig(c).some(e=>/256 MiB/.test(e.message)));
 c.samples=128;c.sweep={min:1,max:10,points:100,spacing:'log'};assert.throws(()=>TE.validateSweep(c),/256 MiB/);
});
test('Cached graph layouts refresh conductances, fixed values, and node selections',()=>{
 const m=new TE.Mesh2D({nx:2,ny:1,lx:1,ly:1,materialMap:[0,0]}),zero=Array(m.n).fill(0),g=Array(m.links.length).fill(1);
 for(const potential of [1,4,-2]){const fixed=new Map([[0,0],[3,0],[2,potential],[5,potential]]);near(TE.graphSolve(m,g,zero,zero,fixed)[1],potential/2)}
 const fixed=new Map([[0,0],[3,0],[2,1],[5,1]]);const changed=g.map((v,i)=>i<4?2:1);near(TE.graphSolve(m,changed,zero,zero,fixed)[1],1/3);
 const different=new Map([[0,7],[1,7],[2,7],[3,7],[4,7],[5,7]]);assert.deepEqual(TE.graphSolve(m,g,zero,zero,different),Array(6).fill(7));
});
test('Checkpoint cadence preserves first and final failed cycles without publishing every cycle',()=>{
 const c=periodic({frequency:100,maxPeriods:6}),solver=TE.from2DConfig(c),cycles=[];
 assert.throws(()=>solver.solvePeriodic(c.frequency,{samples:64,maxPeriods:6,checkpointEvery:5,checkpointIntervalMs:1e9,onCheckpoint:r=>cycles.push(r.periods)}),/Periodic state not reached/);
 assert.deepEqual(cycles,[1,5,6]);
});
test('Tolerances and invalid properties are rejected',()=>{
 const s=TE.from2DConfig(model());assert.throws(()=>s.solveSteady({residualAtol:0}),/residual tolerances/);
 const c=model();c.materials[0].sigma=-1;assert(TE.validate2DConfig(c).length>0);
 assert.throws(()=>TE.phaseRadians(Infinity),/Phase must be finite/);
});
test('Unconverged Bode points and zero references remain omitted',()=>{
 const r=TE.run2D(periodic());r.converged=false;assert.equal(TE.bodeRows([r])[0].magnitude,null);
 r.converged=true;r.config.electrical.value.amplitude=0;const row=TE.bodeRows([r],{normalization:'fundamental'})[0];assert.equal(row.magnitude,null);assert.equal(row.phase,null);
});
