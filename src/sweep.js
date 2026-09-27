/* Frequency sweep orchestration and complex-response analysis. No DOM dependencies. */
(function(TE){'use strict';
TE.sweepFrequencies=s=>{
 TE.assert(s&&Number.isFinite(s.min)&&s.min>0&&Number.isFinite(s.max)&&s.max>s.min,'Sweep: require 0 < minimum < maximum frequency.');
 TE.assert(Number.isInteger(s.points)&&s.points>=2&&s.points<=100,'Sweep: use 2–100 frequency points.');
 TE.assert(['log','linear'].includes(s.spacing),'Sweep: choose logarithmic or linear spacing.');
 const f=Array.from({length:s.points},(_,i)=>i===0?s.min:i===s.points-1?s.max:s.spacing==='log'?Math.exp(Math.log(s.min)+(Math.log(s.max)-Math.log(s.min))*i/(s.points-1)):s.min+(s.max-s.min)*i/(s.points-1));
 TE.assert(f.every((v,i)=>Number.isFinite(v)&&v>0&&(!i||v>f[i-1])),'Sweep frequencies are too close to resolve.');return f;
};
TE.validateSweep=c=>{
 const frequencies=TE.sweepFrequencies(c.sweep);
 TE.assert(TE.inferSimulationMode(c)==='periodic','A frequency sweep needs a nonzero active electrical or thermal AC excitation.');
 const bytes=frequencies.length*c.samples*(2*(c.nx+1)*(c.ny+1)+4*c.nx*c.ny)*32;
 TE.assert(bytes<=256*1024*1024,'Sweep retained data exceeds the 256 MiB estimate. Reduce frequency points, mesh size or time steps.');
 for(const frequency of frequencies)TE.assertValid2DConfig({...c,mode:'periodic',frequency});return frequencies;
};
TE.runSweep=(c,emit=()=>{})=>{
 const frequencies=TE.validateSweep(c);let completed=0;
 for(let index=0;index<frequencies.length;index++){
  const frequency=frequencies[index],point={index,frequency,total:frequencies.length};emit({type:'sweepStart',...point});
  try{const r=TE.run2D({...c,sweep:{...c.sweep,enabled:false},mode:'periodic',frequency},p=>emit({type:'progress',progress:p,...point}),r=>emit({type:'checkpoint',result:r,...point}));emit({type:'sweepPoint',result:r,...point});completed++;}
  catch(e){emit({type:'sweepError',message:e.message,...point});return;}
 }
 emit({type:'sweepDone',completed});
};
const mag=z=>Math.hypot(z.re,z.im),angle=z=>Math.atan2(z.im,z.re)*180/Math.PI,wrap=v=>((v+180)%360+360)%360-180;
const signal=s=>{const a=typeof s==='number'?0:s?.amplitude??0,p=(s?.phase??0)*Math.PI/180;return {re:a*Math.cos(p),im:a*Math.sin(p)};};
TE.bodeRows=(results,o={})=>{
 const {quantity='terminalVoltage',harmonic=1,reference='drive',normalization='raw',phaseFloor=1e-12,unwrap=false,x=.5,y=.5}=o;
 TE.assert(['terminalVoltage','current','impedance','temperature','voltage','Jx','Jy','qx','qy'].includes(quantity),'Unknown Bode quantity.');
 TE.assert([1,2,3].includes(harmonic),'Choose harmonic 1, 2 or 3.');
 TE.assert(['raw','fundamental','power'].includes(normalization),'Unknown Bode normalization.');
 TE.assert(['time','drive','current','terminalVoltage','left','right','top','bottom'].includes(reference),'Unknown phase reference.');
 TE.assert(Number.isFinite(phaseFloor)&&phaseFloor>=0,'Phase threshold must be finite and nonnegative.');
 TE.assert([x,y].every(v=>Number.isFinite(v)&&v>=0&&v<=1),'Probe coordinates must be between 0 and 100%.');
 TE.assert(quantity!=='impedance'||harmonic===1,'Impedance uses the fundamental (1ω).');
 TE.assert(quantity==='impedance'||reference!=='time'||normalization==='raw','Time reference has no amplitude for normalization.');
 let previous=null;
 return results.map(r=>{
  const c=r.config,n=quantity==='impedance'?1:harmonic,nodal=['temperature','voltage'].includes(quantity),i=nodal?Math.round(x*c.nx):Math.min(c.nx-1,Math.floor(x*c.nx)),j=nodal?Math.round(y*c.ny):Math.min(c.ny-1,Math.floor(y*c.ny));
  const index=j*(c.nx+(nodal?1:0))+i;
  const z=quantity==='impedance'?r.harmonics.terminalVoltage[1]:['terminalVoltage','current'].includes(quantity)?r.harmonics[quantity][n]:r.harmonics[quantity][n][index];
  let unit=quantity==='impedance'?'Ω':quantity==='current'?'A':quantity==='temperature'?'K':['terminalVoltage','voltage'].includes(quantity)?'V':['qx','qy'].includes(quantity)?'W/m²':'A/m²',ref={re:1,im:0},refUnit='',reason='';
  if(quantity==='impedance'||reference==='current'){ref=r.harmonics.current[1];refUnit='A';if(c.electrical.kind==='open_circuit')reason='Open circuit: zero terminal-current reference.';}
  else if(reference==='terminalVoltage'){ref=r.harmonics.terminalVoltage[1];refUnit='V';}
  else if(reference==='drive'){ref=signal(c.electrical.value);refUnit=c.electrical.kind==='current'?'A':'V';if(c.electrical.kind==='open_circuit')reason='Electrical drive is inactive in open circuit.';}
  else if(reference!=='time'){const b=c.thermal[reference];ref=signal(b.value);refUnit=b.kind==='flux'?'W/m²':'K';if(b.kind==='convection'&&b.h===0)reason='Convection reference is inactive (h = 0).';}
  const a=mag(z),refMag=mag(ref),refSeries=quantity==='impedance'||reference==='current'?r.harmonics.current:reference==='terminalVoltage'?r.harmonics.terminalVoltage:null;
  // Relative noise gate for measured terminal references; imposed references are exact inputs.
  const refFloor=refSeries?Math.max(...refSeries.map(mag))*1e-10:0;
  if(!Number.isFinite(refMag)||refMag<=refFloor)reason=reason||'Reference amplitude is zero or below numerical resolution.';
  const exponent=normalization==='power'?n:1,divisor=quantity==='impedance'?refMag:normalization==='raw'?1:refMag**exponent;
  let magnitude=(reason&&(quantity==='impedance'||normalization!=='raw'))?null:a/divisor;
  if(magnitude!==null&&!Number.isFinite(magnitude)){magnitude=null;reason=reason||'Normalization exceeds the finite numerical range.';}
  if(quantity!=='impedance'&&normalization!=='raw')unit+='/('+refUnit+(exponent===1?'':'^'+exponent)+')';
  let phase=!reason&&a>phaseFloor?wrap(angle(z)+(quantity==='impedance'?180:0)-n*angle(ref)):null;
  if(!r.converged){magnitude=null;phase=null;reason='Unconverged point: excluded from Bode.';}
  if(phase!==null&&unwrap&&previous!==null)phase+=360*Math.round((previous-phase)/360);
  previous=phase;
  return {frequency:r.frequency,outputFrequency:n*r.frequency,magnitude,phase,unit,rawMagnitude:a,referenceMagnitude:refMag,converged:r.converged,reason:reason||(phase===null?'Output below phase threshold.':''),nodeOrCell:['terminalVoltage','current','impedance'].includes(quantity)?null:index,x_m:nodal?i*c.lx/c.nx:(i+.5)*c.lx/c.nx,y_m:nodal?j*c.ly/c.ny:(j+.5)*c.ly/c.ny};
 });
};
TE.bodeCsv=(rows)=>['frequency_Hz,output_frequency_Hz,magnitude,unit,phase_deg,raw_magnitude,reference_magnitude,converged,node_or_cell,x_m,y_m,status',...rows.map(r=>[r.frequency,r.outputFrequency,r.magnitude,r.unit,r.phase,r.rawMagnitude,r.referenceMagnitude,r.converged,r.nodeOrCell,r.x_m,r.y_m,r.reason].map(v=>v==null?'':'"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
})(globalThis.TE);
