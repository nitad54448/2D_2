/* SI units. No dependencies; shared by browser, worker and Node tests. */
(function (TE) {
  'use strict';
  TE.assert = (ok, message) => { if (!ok) throw new Error(message); };
  TE.finite = (x, name) => { TE.assert(Number.isFinite(x), `${name} must be finite.`); return x; };
  TE.law = (p, T) => {
    if (typeof p === 'function') return p(T);
    if (typeof p === 'number') return p;
    TE.assert(p && ['linear', 'inverseLinear'].includes(p.type), 'Unknown material law.');
    const v = p.value, slope = p.slope ?? 0, ref = p.reference ?? 300;
    return p.type === 'linear' ? v + slope * (T - ref) : v / (1 + slope * (T - ref));
  };
  class ThermoelectricMaterial {
    constructor({rho, Cp, k, sigma, alpha, name = 'Material', dalpha_dT = null}) {
      Object.assign(this, {rho, Cp, k, sigma, alpha, name, derivative: dalpha_dT});
    }
    evaluate(key, T) {
      TE.assert(Number.isFinite(T) && T > 0, 'Temperature must be finite and > 0 K.');
      const v = TE.finite(TE.law(this[key], T), `${this.name}: ${key}`);
      TE.assert(key === 'alpha' || v > 0, `${this.name}: ${key} must be positive.`);
      return v;
    }
    density(T) { return this.evaluate('rho', T); }
    heatCapacity(T) { return this.evaluate('Cp', T); }
    thermalConductivity(T) { return this.evaluate('k', T); }
    electricalConductivity(T) { return this.evaluate('sigma', T); }
    seebeck(T) { return this.evaluate('alpha', T); }
    electricalResistivity(T) { return 1 / this.electricalConductivity(T); }
    peltier(T) { return T * this.seebeck(T); }
    dalphaDT(T) {
      if (this.derivative !== null) return TE.law(this.derivative, T);
      if (typeof this.alpha === 'number') return 0;
      const h = Math.min(T / 2, Math.max(1, T) * 6e-6);
      return (this.seebeck(T + h) - this.seebeck(T - h)) / (2 * h);
    }
    thomson(T) { return T * this.dalphaDT(T); }
    ZT(T) { return this.seebeck(T) ** 2 * this.electricalConductivity(T) * T / this.thermalConductivity(T); }
  }
  class MaterialCollection {
    constructor(material) { this.materials = [material]; }
    get material() { return this.materials[0]; }
    addMaterial(m) { this.materials.push(m); }
  }
  Object.assign(TE, {ThermoelectricMaterial, MaterialCollection});
})(globalThis.TE = globalThis.TE || {});

/* Conservative application operating envelope, not material certification. */
(function(TE){
 TE.resultLimits=Object.freeze({temperature:2000,voltage:1e6,current:1e6,Jx:1e12,Jy:1e12,qx:1e12,qy:1e12,power:1e12});
 TE.checkRange=(value,key)=>{
  const limit=TE.resultLimits[key];
  TE.assert(Number.isFinite(value)&&Math.abs(value)<=limit&&(key!=='temperature'||value>=1),`Result rejected: ${key} is outside the application operating range (${key==='temperature'?'1–2000 K':'absolute limit '+limit+' SI units'}). Check units, dimensions, excitation and material properties. No clipped result is used.`);
  return value;
 };
 TE.checkResult=r=>{
  const periodic=r.method!=='steady';
  for(const key of ['temperature','voltage','current','terminalVoltage','Jx','Jy','qx','qy']){
   const kind=key==='terminalVoltage'?'voltage':key,value=r[key];
   const scan=v=>{if(Array.isArray(v))v.forEach(scan);else TE.checkRange(v,kind);};scan(value);
  }
  if(periodic)for(const [key,orders] of Object.entries(r.harmonics)){
   const kind=key==='terminalVoltage'?'voltage':key;
   const scan=z=>{if(Array.isArray(z))z.forEach(scan);else{TE.assert(Number.isFinite(z.re)&&Number.isFinite(z.im),'Result rejected: nonfinite harmonic.');TE.assert(Math.hypot(z.re,z.im)<=TE.resultLimits[kind]*2,'Result rejected: harmonic exceeds the application operating range.');}};scan(orders);
  }
  return r;
 };
})(globalThis.TE);

(function (TE) {
  // Peak phasors: u(t)=U0+Re(sum(Un*exp(i*n*omega*t))).
  TE.extractHarmonics = (history, count=3) => {
    const n=history.length, scalar=typeof history[0]==='number';
    TE.assert(Number.isInteger(count)&&count>=0&&n>2*count,'Too few samples for requested harmonics.');
    const data=scalar?history.map(v=>[v]):history, width=data[0].length;
    return Array.from({length:count+1},(_,k)=> {
      const row=Array.from({length:width},()=>({re:0,im:0}));
      for(let i=0;i<n;i++) {const a=2*Math.PI*k*i/n, scale=(k?2:1)/n; for(let j=0;j<width;j++) {row[j].re+=data[i][j]*Math.cos(a)*scale; row[j].im-=data[i][j]*Math.sin(a)*scale;}}
      return scalar?row[0]:row;
    });
  };
})(globalThis.TE);

(function(TE){
class Mesh2D {
 constructor({nx,ny,lx,ly,depth=1,materialMap}) {
  TE.assert(Number.isInteger(nx)&&Number.isInteger(ny)&&nx>=2&&ny>=1,'Use at least 2 cells along x and 1 along y.');
  TE.assert((nx+1)*(ny+1)<=1600,'Maximum 1600 nodes in this browser version.');
  TE.assert([lx,ly,depth].every(v=>Number.isFinite(v)&&v>0),'Dimensions and depth must be positive.');
  Object.assign(this,{nx,ny,lx,ly,depth});this.dx=lx/nx;this.dy=ly/ny;this.n=(nx+1)*(ny+1);
  this.map=materialMap??Array(nx*ny).fill(0);TE.assert(this.map.length===nx*ny,'Material map size does not match the grid.');
  this.x=[];this.y=[];this.cells=[];this.links=[];this.volumes=Array(this.n).fill(0);
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){this.x.push(i*this.dx);this.y.push(j*this.dy);}
  const volume=this.dx*this.dy*depth;
  TE.assert([volume/4,this.dx*depth/2,this.dy*depth/2].every(v=>Number.isFinite(v)&&v>0),'Dimensions produce zero or overflowing volumes/areas.');
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
   const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1,id=j*nx+i,m=this.map[id];
   const nodes=[a,b,c,d];nodes.forEach(n=>this.volumes[n]+=volume/4);
   const first=this.links.length;
   this.links.push({a,b,m,A:this.dy*depth/2,L:this.dx,axis:0,cell:id},{a:c,b:d,m,A:this.dy*depth/2,L:this.dx,axis:0,cell:id},
    {a,b:c,m,A:this.dx*depth/2,L:this.dy,axis:1,cell:id},{a:b,b:d,m,A:this.dx*depth/2,L:this.dy,axis:1,cell:id});
   this.cells.push({nodes,m,volume,links:[first,first+1,first+2,first+3]});
  }
  this.sides={left:[],right:[],bottom:[],top:[]};
  for(let j=0;j<=ny;j++){const A=this.dy*depth*(j===0||j===ny?.5:1);this.sides.left.push({node:j*(nx+1),A,u:j/ny});this.sides.right.push({node:j*(nx+1)+nx,A,u:j/ny});}
  for(let i=0;i<=nx;i++){const A=this.dx*depth*(i===0||i===nx?.5:1);this.sides.bottom.push({node:i,A,u:i/nx});this.sides.top.push({node:ny*(nx+1)+i,A,u:i/nx});}
 }
 electrode(side,range=[0,1]) {
  TE.assert(this.sides[side]&&range.length===2&&range.every(Number.isFinite)&&range[0]>=0&&range[1]<=1&&range[1]>range[0],'Invalid electrode side/range.');
  const nodes=this.sides[side].filter(f=>f.u>=range[0]-1e-12&&f.u<=range[1]+1e-12).map(f=>f.node);
  TE.assert(nodes.length>=2,'Each electrode needs at least two boundary nodes. Refine the grid or increase coverage.');return nodes;
 }
}
TE.Mesh2D=Mesh2D;
})(globalThis.TE);

(function(TE){
// Matrix-free symmetric graph Laplacian + positive diagonal. Dirichlet eliminated.
TE.graphSolve=(mesh,conductance,diagonal,rhs,fixed,{rtol=2e-12,maxIter=4000,initial}={})=>{
 TE.assert(Number.isFinite(rtol)&&rtol>0&&rtol<1,'Linear relative tolerance must satisfy 0 < rtol < 1.');
 TE.assert(Number.isInteger(maxIter)&&maxIter>0,'Linear iteration limit must be a positive integer.');
 TE.assert(conductance.length===mesh.links.length&&conductance.every(g=>Number.isFinite(g)&&g>0),'Invalid face conductance.');
 TE.assert(!initial||(initial.length===mesh.n&&initial.every(Number.isFinite)),'Invalid linear initial guess.');
 TE.assert(rhs.length===mesh.n&&diagonal.length===mesh.n&&rhs.every(Number.isFinite)&&diagonal.every(v=>Number.isFinite(v)&&v>=0),'Linear system coefficients/RHS must be finite with nonnegative diagonal.');
 for(const [i,v]of fixed)TE.assert(Number.isInteger(i)&&i>=0&&i<mesh.n&&Number.isFinite(v),'Invalid fixed boundary value.');
 const n=mesh.n,idx=new Int32Array(n).fill(-1),free=[];
 for(let i=0;i<n;i++)if(!fixed.has(i)){idx[i]=free.length;free.push(i);}
 const nf=free.length,out=new Float64Array(n);for(const [i,v] of fixed)out[i]=v;
 if(!nf)return Array.from(out);
 const D=new Float64Array(nf),b=new Float64Array(nf),x=new Float64Array(nf);
 for(let k=0;k<nf;k++){const i=free[k];D[k]=diagonal[i]??0;b[k]=rhs[i];x[k]=initial?initial[i]:0;}
 const edges=[];
 mesh.links.forEach((e,l)=>{const g=conductance[l],a=idx[e.a],bb=idx[e.b];TE.assert(Number.isFinite(g)&&g>0,'Invalid face conductance.');
  if(a>=0){D[a]+=g;if(bb<0)b[a]+=g*fixed.get(e.b);}
  if(bb>=0){D[bb]+=g;if(a<0)b[bb]+=g*fixed.get(e.a);}
  if(a>=0&&bb>=0)edges.push([a,bb,g]);
 });
 for(const d of D)TE.assert(d>0&&Number.isFinite(d),'Unanchored or invalid system.');
 const multiply=v=>{const z=Float64Array.from(v,(q,i)=>D[i]*q);for(const [a,bb,g] of edges){z[a]-=g*v[bb];z[bb]-=g*v[a];}return z;};
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 let Ax=multiply(x),r=Float64Array.from(b,(v,i)=>v-Ax[i]),z=Float64Array.from(r,(v,i)=>v/D[i]),p=Float64Array.from(z),rz=dot(r,z);
 TE.assert(Number.isFinite(dot(b,b))&&Number.isFinite(dot(r,r))&&Number.isFinite(rz),'Linear system magnitudes exceed the finite numerical range.');
 const target=rtol*Math.max(Math.sqrt(dot(b,b)),1e-20);
 let iteration=0;
 for(;Math.sqrt(dot(r,r))>target&&iteration<maxIter;iteration++){
  const Ap=multiply(p),den=dot(p,Ap);TE.assert(den>0&&Number.isFinite(den),'CG failed: matrix not positive definite.');
  const a=rz/den;for(let i=0;i<nf;i++){x[i]+=a*p[i];r[i]-=a*Ap[i];}
  z=Float64Array.from(r,(v,i)=>v/D[i]);const next=dot(r,z),beta=next/rz;for(let i=0;i<nf;i++)p[i]=z[i]+beta*p[i];rz=next;
 }
 TE.assert(Math.sqrt(dot(r,r))<=target&&x.every(Number.isFinite)&&r.every(Number.isFinite),'Sparse linear solver did not converge to a finite result.');
 free.forEach((node,i)=>out[node]=x[i]);return Array.from(out);
};
})(globalThis.TE);

(function(TE){
TE.signal2D=(s,t,f)=>{if(typeof s==='number')return TE.finite(s,'Boundary');TE.assert(s&&typeof s==='object'&&!Array.isArray(s),'Invalid boundary signal.');for(const k of ['bias','amplitude','phase'])if(s[k]!==undefined)TE.assert(typeof s[k]==='number'&&Number.isFinite(s[k]),'Boundary '+k+' must be a finite number.');return TE.finite((s.bias??0)+(s.amplitude??0)*Math.cos(2*Math.PI*f*t+((s.phase??0)%360)*Math.PI/180),'Boundary');};
class Solver2D {
 constructor(mesh,materials,boundaries,electrical){this.mesh=mesh;this.materials=materials;this.boundaries=boundaries;this.electrical=electrical;this.frequency=0;
  mesh.map.forEach(id=>TE.assert(Number.isInteger(id)&&materials[id],'Unknown material in map.'));
  TE.assert(['voltage','current','open_circuit'].includes(electrical.kind),'Unknown electrical mode.');
  this.source=mesh.electrode(electrical.sourceSide,electrical.sourceRange);this.sink=mesh.electrode(electrical.sinkSide,electrical.sinkRange);
  const sourceSet=new Set(this.source);TE.assert(!this.sink.some(i=>sourceSet.has(i)),'Electrodes overlap at a node.');
  this.sourceSet=sourceSet;
  for(const side of ['left','right','bottom','top']){const b=boundaries[side];TE.assert(b&&['temperature','flux','convection'].includes(b.kind),'Define all four thermal boundaries.');TE.assert(Number.isFinite(b.h??0)&&(b.h??0)>=0,'Convection coefficient must be nonnegative.');}
 }
 properties(T){
  T.forEach(v=>TE.checkRange(v,'temperature'));
  const m=this.mesh,cap=Array(m.n).fill(0);
  m.cells.forEach(c=>c.nodes.forEach(i=>{const a=this.materials[c.m];cap[i]+=a.density(T[i])*a.heatCapacity(T[i])*c.volume/4;}));
  const p=m.links.map(e=>{const a=this.materials[e.m],Ta=T[e.a],Tb=T[e.b],rho=(a.electricalResistivity(Ta)+a.electricalResistivity(Tb))/2;
   return {g:e.A/(e.L*rho),k:e.A/e.L*(a.thermalConductivity(Ta)+a.thermalConductivity(Tb))/2,alpha:(a.seebeck(Ta)+a.seebeck(Tb))/2};});TE.assert(cap.every(v=>Number.isFinite(v)&&v>0),'Heat capacities overflow or underflow the numerical range.');return {p,cap};
 }
 thermal(t){
  const m=this.mesh,fixed=new Map(),diag=Array(m.n).fill(0),rhs=Array(m.n).fill(0),flux=Array(m.n).fill(0);
  for(const [side,faces] of Object.entries(m.sides)){const b=this.boundaries[side],v=TE.signal2D(b.value,t,this.frequency);
   if(b.kind==='temperature'||b.kind==='convection')TE.assert(v>0,side+' temperature must remain strictly above 0 K.');
   for(const {node,A} of faces){if(b.kind==='temperature'){TE.assert(v>0,'Temperature must be >0 K.');if(fixed.has(node))TE.assert(Math.abs(fixed.get(node)-v)<1e-8,'Conflicting temperatures at a corner. Use compatible boundary temperatures.');fixed.set(node,v);}
    if(b.kind==='flux'){rhs[node]-=v*A;flux[node]+=v*A;}
    if(b.kind==='convection'){diag[node]+=(b.h??0)*A;rhs[node]+=(b.h??0)*A*v;}
   }
  }return {fixed,diag,rhs,flux};
 }
 electric(T,p,t){
  const m=this.mesh,e=this.electrical,g=p.map(v=>v.g),zero=Array(m.n).fill(0),rhs=[...zero],fixed=new Map();
  this.source.forEach(i=>fixed.set(i,0));this.sink.forEach(i=>fixed.set(i,0));
  m.links.forEach((l,k)=>{const s=p[k].g*p[k].alpha*(T[l.b]-T[l.a]);rhs[l.a]+=s;rhs[l.b]-=s;});
  const current=(V,seebeck=true)=>m.links.map((l,k)=>g[k]*(V[l.a]-V[l.b]-(seebeck?p[k].alpha*(T[l.b]-T[l.a]):0)));
  const terminal=I=>m.links.reduce((s,l,k)=>s+I[k]*((this.sourceSet.has(l.a)?1:0)-(this.sourceSet.has(l.b)?1:0)),0);
  let V,terminalVoltage;
  if(e.kind==='voltage'){
   terminalVoltage=TE.signal2D(e.value,t,this.frequency);this.sink.forEach(i=>fixed.set(i,terminalVoltage));V=TE.graphSolve(m,g,zero,rhs,fixed);
  }else{
   const base=TE.graphSolve(m,g,zero,rhs,fixed);this.sink.forEach(i=>fixed.set(i,1));
   const unit=TE.graphSolve(m,g,zero,zero,fixed),Ibase=terminal(current(base)),Iunit=terminal(current(unit,false));
   TE.assert(Iunit<0,'Electrodes have no conducting connection.');
   const target=e.kind==='open_circuit'?0:TE.signal2D(e.value,t,this.frequency);
   terminalVoltage=(target-Ibase)/Iunit;V=base.map((v,i)=>v+terminalVoltage*unit[i]);
  }
  TE.assert(V.every(Number.isFinite),'Voltage exceeds the finite numerical range. Check excitation and material values.');
  V.forEach(v=>TE.checkRange(v,'voltage'));
  const I=current(V),terminalCurrent=terminal(I);TE.checkRange(terminalCurrent,'current');TE.assert(I.every(Number.isFinite)&&Number.isFinite(terminalCurrent)&&Number.isFinite(terminalVoltage),'Current or terminal voltage exceeds the finite numerical range.');return {V,I,terminalVoltage,current:terminalCurrent};
 }
 balance(T,t){
  const m=this.mesh,{p,cap}=this.properties(T),elect=this.electric(T,p,t),source=Array(m.n).fill(0),q=[],work=[];
  m.links.forEach((l,k)=>{const I=elect.I[k],P=I*(elect.V[l.a]-elect.V[l.b]),pel=p[k].alpha*(T[l.a]+T[l.b])/2*I;
   TE.checkRange(P,'power');TE.checkRange(pel,'power');
   TE.assert([I,P,pel].every(Number.isFinite),'Electrical/thermal power exceeds the finite numerical range.');
   source[l.a]+=-pel+P/2;source[l.b]+=pel+P/2;q.push(pel-p[k].k*(T[l.b]-T[l.a]));work.push(P);
  });TE.assert([...source,...q,...work].every(Number.isFinite),'Heat balance exceeds the finite numerical range.');return {p,cap,...elect,source,q,work};
 }
 initial(T0){
  let T=T0?[...T0]:Array(this.mesh.n).fill(300);TE.assert(T.length===this.mesh.n,'T0 length mismatch.');
  for(const [i,v] of this.thermal(0).fixed)T[i]=v;this.properties(T);return T;
 }
 implicit(t,target,gammaDt,{initial,tolerance=2e-9,maxIterations=100,relaxation=.85}={}){
  TE.assert(Number.isFinite(tolerance)&&tolerance>0,'Nonlinear tolerance must be positive.');
  TE.assert(Number.isInteger(maxIterations)&&maxIterations>=1,'Nonlinear iteration limit must be a positive integer.');
  TE.assert(Number.isFinite(relaxation)&&relaxation>0&&relaxation<=1,'Relaxation must satisfy 0 < value <= 1.');
  const m=this.mesh,bc=this.thermal(t);let T=[...initial],error=Infinity;
  for(const [i,v] of bc.fixed)T[i]=v;
  for(let iteration=0;iteration<maxIterations;iteration++){
   const b=this.balance(T,t),diag=bc.diag.map((v,i)=>v+(gammaDt?b.cap[i]/gammaDt:0)),rhs=b.source.map((v,i)=>v+bc.rhs[i]+(gammaDt?b.cap[i]/gammaDt*target[i]:0));
   const candidate=TE.graphSolve(m,b.p.map(p=>p.k),diag,rhs,bc.fixed,{initial:T});
   error=Math.max(...candidate.map((v,i)=>Math.abs(v-T[i])));
   TE.assert(candidate.every(v=>Number.isFinite(v)&&v>0),'Nonphysical temperature. Check excitation and material laws.');
   candidate.forEach(v=>TE.checkRange(v,'temperature'));
   if(error<=tolerance)return candidate;
   T=candidate.map((v,i)=>bc.fixed.has(i)?v:T[i]+relaxation*(v-T[i]));
  }
  throw new Error(`Nonlinear thermal iteration failed (update ${error.toExponential(2)} K). Reduce excitation or refine time steps.`);
 }
 snapshot(T,t=0,steady=false){
  const m=this.mesh,b=this.balance(T,t),Jx=[],Jy=[],qx=[],qy=[];
  m.cells.forEach(c=>{const [a,bb,cc,d]=c.links;Jx.push((b.I[a]+b.I[bb])/(m.dy*m.depth));Jy.push((b.I[cc]+b.I[d])/(m.dx*m.depth));qx.push((b.q[a]+b.q[bb])/(m.dy*m.depth));qy.push((b.q[cc]+b.q[d])/(m.dx*m.depth));});
  for(const [key,values] of Object.entries({Jx,Jy,qx,qy}))values.forEach(v=>TE.checkRange(v,key));
  const bc=this.thermal(t),res=b.source.map((v,i)=>v+bc.rhs[i]-bc.diag[i]*T[i]);
  m.links.forEach((e,k)=>{const v=b.p[k].k*(T[e.a]-T[e.b]);res[e.a]-=v;res[e.b]+=v;});
  let heatOut=0;for(const [side,faces] of Object.entries(m.sides)){const c=this.boundaries[side],v=TE.signal2D(c.value,t,this.frequency);if(c.kind!=='temperature')for(const {node,A} of faces)heatOut+=A*(c.kind==='flux'?v:(c.h??0)*(T[node]-v));}
  for(const [i] of bc.fixed)heatOut+=res[i];
  const electricalPower=-b.current*b.terminalVoltage;TE.checkRange(electricalPower,'power');
  TE.assert([...Jx,...Jy,...qx,...qy,electricalPower,heatOut,...res].every(Number.isFinite),'Derived current density, heat flux or power exceeds the finite numerical range.');
  return {temperature:[...T],voltage:b.V,Jx,Jy,qx,qy,current:b.current,terminalVoltage:b.terminalVoltage,electricalPower,
   energyResidual:steady?heatOut-electricalPower:null,freeResidualWatts:Math.max(0,...res.filter((_,i)=>!bc.fixed.has(i)).map(Math.abs))};
 }
 solveSteady(options={}){
  this.frequency=0;TE.assert(Object.values(this.boundaries).some(b=>b.kind==='temperature'||(b.kind==='convection'&&b.h>0)),'Steady state requires a thermal anchor.');
  const T=this.implicit(0,null,0,{...options,initial:this.initial(options.T0)});
  return {...this.snapshot(T,0,true),method:'steady',converged:true};
 }
 solvePeriodic(frequency,{samples=128,maxPeriods=100,minPeriods=3,periodicAtol=2e-7,periodicRtol=1e-10,tolerance=2e-9,T0,onProgress=()=>{},onCheckpoint}={}){
  TE.assert(Number.isFinite(frequency)&&frequency>0,'Frequency must be positive.');TE.assert(Number.isInteger(samples)&&samples>=32&&samples<=2048,'Use 32–2048 integer steps per period.');
  TE.assert(Number.isInteger(maxPeriods)&&maxPeriods<=1000&&Number.isInteger(minPeriods)&&maxPeriods>=minPeriods&&minPeriods>=2,'Invalid cycle limit.');
  TE.assert([periodicAtol,periodicRtol,tolerance].every(v=>Number.isFinite(v)&&v>0),'Solver tolerances must be strictly positive and finite.');
  TE.assert(Number.isFinite(1/(frequency*samples))&&1/(frequency*samples)>0,'Unrepresentable time step.');
  this.frequency=frequency;let T=this.initial(T0),older=null,previous=null,history,cycle,error=Infinity;const dt=1/(frequency*samples);
  const packageCycle=converged=>{
   const traces={},records=history.map((row,i)=>this.snapshot(row,((cycle-1)*samples+i)*dt));
   for(const key of ['temperature','voltage','Jx','Jy','qx','qy','current','terminalVoltage'])traces[key]=records.map(r=>r[key]);
   const harmonics={};for(const [key,value]of Object.entries(traces))harmonics[key]=TE.extractHarmonics(value,3);
   return {...traces,harmonics,time:Array.from({length:samples},(_,i)=>i*dt),frequency,samples,periods:cycle,cycleStartTime:(cycle-1)/frequency,periodicError:Number.isFinite(error)?error:null,finalTemperature:[...T],method:'BDF2 / nonlinear Picard / matrix-free CG',converged};
  };
  for(cycle=1;cycle<=maxPeriods;cycle++){
   history=[];
   for(let j=0;j<samples;j++){
    history.push([...T]);const target=T.map((v,i)=>older?4*v/3-older[i]/3:v),gamma=older?2/3:1;
    const next=this.implicit(((cycle-1)*samples+j+1)*dt,target,gamma*dt,{initial:T,tolerance});older=T;T=next;
    if(j%Math.max(1,Math.floor(samples/20))===0||j===samples-1)onProgress({cycle,maxPeriods,step:j+1,samples,error:Number.isFinite(error)?error:null});
   }
   if(previous){error=0;history.forEach((row,j)=>row.forEach((v,i)=>error=Math.max(error,Math.abs(v-previous[j][i])/(periodicAtol+periodicRtol*Math.max(Math.abs(v),Math.abs(previous[j][i]))))));}
   onProgress({cycle,maxPeriods,step:samples,samples,error:Number.isFinite(error)?error:null});if(cycle>=minPeriods&&error<=1)break;if(onCheckpoint)onCheckpoint(packageCycle(false));previous=history;
  }
  TE.assert(cycle<=maxPeriods,`Periodic state not reached in ${maxPeriods} cycles (error ${error.toExponential(2)}).`);
  return packageCycle(true);
 }
}
TE.Solver2D=Solver2D;
})(globalThis.TE);

/* Shared validation for UI, JSON import and worker. Errors retain field paths. */
(function(TE){
 TE.validate2DConfig=c=>{
  const errors=[],add=(path,message)=>errors.push({path,message});
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const finite=(v,p)=>{if(typeof v!=='number'||!Number.isFinite(v)){add(p,'Must be a finite number.');return false;}return true;};
  const positive=(v,p)=>{if(!finite(v,p))return false;if(v<=0){add(p,'Must be strictly positive (greater than zero).');return false;}return true;};
  const integer=(v,p,min,max=Infinity)=>{if(!finite(v,p))return false;if(!Number.isInteger(v)||v<min||v>max){add(p,`Must be an integer from ${min}${max===Infinity?' upward':' to '+max}.`);return false;}return true;};
  if(!object(c))return [{path:'model',message:'The model must be a JSON object.'}];
  if(!['steady','periodic'].includes(c.mode))add('mode','Select steady or periodic mode.');
  const periodic=c.mode==='periodic';
  const nxOK=integer(c.nx,'nx',2),nyOK=integer(c.ny,'ny',1);
  if(nxOK&&nyOK&&(c.nx+1)*(c.ny+1)>1600){add('nx','The mesh may contain at most 1600 nodes.');add('ny','Reduce Nx or Ny to stay at or below 1600 nodes.');}
  const lxOK=positive(c.lx,'lx'),lyOK=positive(c.ly,'ly'),depthOK=positive(c.depth,'depth');
  if(nxOK&&nyOK&&lxOK&&lyOK&&depthOK){const dx=c.lx/c.nx,dy=c.ly/c.ny;for(const v of [dx,dy,dx*dy*c.depth/4,dx*c.depth/2,dy*c.depth/2,c.lx*c.ly*c.depth])if(!Number.isFinite(v)||v<=0){add('depth','Dimensions produce zero or overflowing cell volumes/areas. Use numerically representable dimensions.');break;}}
  if(finite(c.frequency,'frequency')&&(periodic?c.frequency<=0:c.frequency<0))add('frequency',periodic?'Frequency must be strictly positive for a periodic run.':'Frequency cannot be negative.');
  const samplesOK=integer(c.samples,'samples',32,2048);
  integer(c.maxPeriods,'maxPeriods',3,1000);
  if(periodic&&Number.isFinite(c.frequency)&&c.frequency>0&&samplesOK){const dt=1/(c.frequency*c.samples);if(!Number.isFinite(dt)||dt<=0)add('frequency','The frequency and step count produce an unrepresentable time step.');}
  function signal(s,path){
   if(typeof s==='number'){finite(s,path+'.bias');return {bias:s,amplitude:0,phase:0};}
   if(!object(s)){add(path,'Use a finite scalar or a bias/amplitude/phase object.');return null;}
   const p={bias:s.bias??0,amplitude:s.amplitude??0,phase:s.phase??0};
   for(const k of Object.keys(p))if(s[k]===null){add(path+'.'+k,'Null is not a number.');p[k]=NaN;}else finite(p[k],path+'.'+k);
   if(Number.isFinite(p.bias)&&Number.isFinite(p.amplitude)&&(!Number.isFinite(p.bias+Math.abs(p.amplitude))||!Number.isFinite(p.bias-Math.abs(p.amplitude))))add(path+'.amplitude','Bias and amplitude overflow the representable signal range.');
   return p;
  }
  const probeTemperatures=new Set([300]),thermalSignals={};
  if(!object(c.thermal))add('thermal','Define all four thermal boundaries.');
  for(const side of ['left','right','bottom','top']){
   const b=c.thermal?.[side],p='thermal.'+side;
   if(!object(b)){add(p,'Define this thermal boundary.');continue;}
   if(!['temperature','flux','convection'].includes(b.kind))add(p+'.kind','Unknown thermal condition.');
   const s=signal(b.value,p+'.value');thermalSignals[side]=s;
   const h=b.h===undefined?0:b.h;if(finite(h,p+'.h')&&h<0)add(p+'.h','Convection h must be nonnegative.');
   if(s&&['temperature','convection'].includes(b.kind)&&Object.values(s).every(Number.isFinite)){
    const low=s.bias-(periodic?Math.abs(s.amplitude):0),high=s.bias+(periodic?Math.abs(s.amplitude):0);
    if(low<=0||!Number.isFinite(high)){
     const msg=periodic?'Temperature must stay above 0 K for the entire cycle: DC > |AC peak|.':'Absolute temperature must be strictly greater than 0 K.';
     add(p+'.value.bias',msg);if(periodic)add(p+'.value.amplitude',msg);
    }else{probeTemperatures.add(low);probeTemperatures.add(high);}
   }
  }
  // Compare whole prescribed waveforms at shared Dirichlet corners, not only t=0.
  for(const [a,b]of [['left','bottom'],['left','top'],['right','bottom'],['right','top']]){
   if(c.thermal?.[a]?.kind!=='temperature'||c.thermal?.[b]?.kind!=='temperature')continue;
   const x=thermalSignals[a],y=thermalSignals[b];if(!x||!y||![...Object.values(x),...Object.values(y)].every(Number.isFinite))continue;
   const phasor=s=>[s.bias,periodic?s.amplitude*Math.cos((s.phase%360)*Math.PI/180):0,periodic?s.amplitude*Math.sin((s.phase%360)*Math.PI/180):0];
   const X=phasor(x),Y=phasor(y);
   if(X.some((v,i)=>Math.abs(v-Y[i])>1e-8)){add(`thermal.${a}.value.bias`,`Temperature waveforms conflict at the ${a}/${b} corner.`);add(`thermal.${b}.value.bias`,`Temperature waveforms conflict at the ${a}/${b} corner.`);}
  }
  if(c.mode==='steady'&&object(c.thermal)&&!Object.values(c.thermal).some(b=>b?.kind==='temperature'||(b?.kind==='convection'&&Number.isFinite(b.h)&&b.h>0)))add('thermal','A steady problem needs a thermal anchor: an imposed temperature or convection with h > 0.');
  const mats=c.materials;
  if(!Array.isArray(mats)||mats.length<1||mats.length>12)add('materials','Define between 1 and 12 materials.');
  else mats.forEach((m,i)=>{
   const p=`materials.${i}`;if(!object(m)){add(p,'Invalid material definition.');return;}
   if(m.name!==undefined&&(typeof m.name!=='string'||!m.name.trim()))add(p+'.name','Material name cannot be empty.');
   function law(value,path,isPositive){
    if(typeof value==='number'){if(isPositive)positive(value,path);else finite(value,path);return;}
    if(typeof value==='function')return; // Supported only through the source/API, never through JSON eval.
    if(!object(value)||!['linear','inverseLinear'].includes(value.type)){add(path,'Use a number or a supported temperature-dependent law.');return;}
    finite(value.value,path);if(value.slope!==undefined)finite(value.slope,path);if(value.reference!==undefined)positive(value.reference,path);
   }
   for(const k of ['rho','Cp','k','sigma','alpha'])law(m[k],p+'.'+k,k!=='alpha');
   for(const k of ['beta','alphaSlope'])if(m[k]!==undefined)finite(m[k],p+'.'+k);
   // Catch inadmissible laws at the reference, initial and prescribed extreme temperatures.
   for(const key of ['rho','Cp','k','sigma','alpha']){
    if(errors.some(e=>e.path===p+'.'+key))continue;
    let prop=m[key];if(key==='sigma'&&typeof prop==='number')prop={type:'inverseLinear',value:prop,slope:m.beta??0,reference:300};
    if(key==='alpha'&&typeof prop==='number')prop={type:'linear',value:prop,slope:m.alphaSlope??0,reference:300};
    for(const T of probeTemperatures){try{const v=TE.law(prop,T);if(!Number.isFinite(v)||(key!=='alpha'&&v<=0))throw new Error();}catch{add(p+'.'+key,`${key} must be ${key==='alpha'?'finite':'finite and strictly positive'} at ${T.toPrecision(6)} K. Check its temperature law.`);break;}}
   }
   if(!errors.some(e=>e.path===p+'.rho'||e.path===p+'.Cp'))for(const T of probeTemperatures){
    try{const capacity=TE.law(m.rho,T)*TE.law(m.Cp,T);if(!Number.isFinite(capacity)||capacity<=0)throw new Error();}catch{add(p+'.Cp','Density × heat capacity must be finite and strictly positive.');break;}
   }
  });
  if(!Array.isArray(c.materialMap)||!nxOK||!nyOK||c.materialMap.length!==c.nx*c.ny)add('materialMap','Material map must have exactly Nx × Ny cells.');
  else if(!Array.isArray(mats)||c.materialMap.some(id=>!Number.isInteger(id)||id<0||id>=mats.length))add('materialMap','Every cell must reference an existing material.');
  const e=c.electrical,contacts={};
  if(!object(e))add('electrical','Define the electrical contacts and control mode.');
  else{
   if(!['voltage','current','open_circuit'].includes(e.kind))add('electrical.kind','Unknown electrical control mode.');
   signal(e.value,'electrical.value');
   for(const name of ['source','sink']){
    const side=e[name+'Side'],range=e[name+'Range'],p='electrical.'+name+'Range';
    const sideOK=['left','right','bottom','top'].includes(side);if(!sideOK)add('electrical.'+name+'Side','Select a valid boundary side.');
    const rangeOK=Array.isArray(range)&&range.length===2&&range.every(v=>typeof v==='number'&&Number.isFinite(v))&&range[0]>=0&&range[1]<=1&&range[0]<range[1];
    if(!rangeOK)add(p,'Electrode range must satisfy 0% ≤ start < end ≤ 100%.');
    if(sideOK&&rangeOK&&nxOK&&nyOK&&(c.nx+1)*(c.ny+1)<=1600){
     const count=['left','right'].includes(side)?c.ny:c.nx,ids=[];
     for(let k=0;k<=count;k++)if(k/count>=range[0]-1e-12&&k/count<=range[1]+1e-12)ids.push(side==='left'?k*(c.nx+1):side==='right'?k*(c.nx+1)+c.nx:side==='bottom'?k:c.ny*(c.nx+1)+k);
     contacts[name]=ids;if(ids.length<2)add(p,'Electrode must cover at least two boundary nodes. Enlarge its range or refine the mesh.');
    }
   }
   if(contacts.source&&contacts.sink){const set=new Set(contacts.source);if(contacts.sink.some(n=>set.has(n))){add('electrical.sourceRange','Source and sink electrodes overlap at a node.');add('electrical.sinkRange','Source and sink electrodes must not overlap.');}}
  }
  return errors;
 };
 TE.assertValid2DConfig=c=>{const issues=TE.validate2DConfig(c);if(issues.length){const e=new Error(issues.map(v=>`${v.path}: ${v.message}`).join('\n'));e.validationIssues=issues;throw e;}return c;};
})(globalThis.TE);

(function(TE){
TE.default2D=()=>({version:1,mode:'periodic',nx:12,ny:8,lx:.002,ly:.001,depth:.001,frequency:2,samples:128,maxPeriods:100,
 materials:[{name:'Copper',rho:8960,Cp:385,k:400,sigma:5.8e7,beta:.0039,alpha:1.5e-6,alphaSlope:0,color:'#edaf6e'},
 {name:'BiTe',rho:7700,Cp:150,k:1.5,sigma:1e5,beta:.002,alpha:2e-4,alphaSlope:2e-7,color:'#73d8d0'}],
 materialMap:Array.from({length:96},(_,i)=>i%12<6?0:1),
 thermal:{left:{kind:'temperature',value:{bias:300,amplitude:0},h:10000},right:{kind:'convection',value:{bias:300,amplitude:0},h:10000},
 bottom:{kind:'flux',value:{bias:0,amplitude:0},h:1000},top:{kind:'flux',value:{bias:0,amplitude:0},h:1000}},
 electrical:{kind:'current',value:{bias:0,amplitude:.1,phase:0},sourceSide:'left',sinkSide:'right',sourceRange:[0,1],sinkRange:[0,1]}});
TE.from2DConfig=c=>{
 TE.assertValid2DConfig(c);
 TE.assert(['steady','periodic'].includes(c.mode),'Unknown simulation mode.');TE.assert(Array.isArray(c.materials)&&c.materials.length>0,'Define at least one material.');
 const mesh=new TE.Mesh2D({nx:c.nx,ny:c.ny,lx:c.lx,ly:c.ly,depth:c.depth,materialMap:c.materialMap});
 const materials=c.materials.map(m=>new TE.ThermoelectricMaterial({...m,sigma:typeof m.sigma==='number'?{type:'inverseLinear',value:m.sigma,slope:m.beta??0,reference:300}:m.sigma,
 alpha:typeof m.alpha==='number'?{type:'linear',value:m.alpha,slope:m.alphaSlope??0,reference:300}:m.alpha}));
 const thermal=JSON.parse(JSON.stringify(c.thermal)),electric=JSON.parse(JSON.stringify(c.electrical));
 if(c.mode==='steady'){const dc=v=>typeof v==='number'?v:v.bias??0;for(const b of Object.values(thermal))b.value=dc(b.value);electric.value=dc(electric.value);}
 return new TE.Solver2D(mesh,materials,thermal,electric);
};
TE.run2D=(c,progress,checkpoint)=>{const s=TE.from2DConfig(c);
 const decorate=r=>({...TE.checkResult(r),config:c,mesh:{nx:c.nx,ny:c.ny,lx:c.lx,ly:c.ly,depth:c.depth,x:s.mesh.x,y:s.mesh.y,materialMap:s.mesh.map},convention:'Peak phasors: u(t)=U0+Re(sum(Un exp(i n omega t))). Terminal voltage = V(sink)-V(source).'});
 const r=c.mode==='steady'?s.solveSteady():s.solvePeriodic(c.frequency,{samples:c.samples,maxPeriods:c.maxPeriods,onProgress:progress,onCheckpoint:checkpoint?r=>checkpoint(decorate(r)):undefined});
 return decorate(r);};
})(globalThis.TE);

(function(TE){
TE.ptWire3omega=()=>{
 const c=TE.default2D();Object.assign(c,{nx:80,ny:1,lx:5e-3,ly:1e-5,depth:5e-7,mode:'periodic',frequency:10,samples:256,maxPeriods:100});
 c.materials=[{name:'Pt wire · representative properties',rho:21450,Cp:133,k:72,sigma:1e7,beta:.003,alpha:0,alphaSlope:0,color:'#c1c9d5'}];
 c.materialMap=Array(c.nx*c.ny).fill(0);
 c.electrical={kind:'current',value:{bias:0,amplitude:.014,phase:0},sourceSide:'left',sinkSide:'right',sourceRange:[0,1],sinkRange:[0,1]};
 // Match substrate conductance k_s * L * w / d_s with the two modeled edges:
 // 2 * h_edge * L * wire_thickness = k_s * L * w / d_s.
 const hEdge=1/1e-5*c.ly/(2*c.depth);
 c.thermal={left:{kind:'temperature',value:300,h:0},right:{kind:'temperature',value:300,h:0},bottom:{kind:'convection',value:300,h:hEdge},top:{kind:'convection',value:300,h:hEdge}};
 c.sweep={enabled:false,min:1,max:1000,points:9,spacing:'log'};
 c.description='Pt-wire 3ω example: L=5 mm, width=10 µm, assumed thickness=0.5 µm, σ300=1E7 S/m gives R300=100 Ω; resistance slope β=0.003/K; current=14 mA peak. End contacts: 300 K. Top/bottom h=1E6 W/(m² K) are equivalent cooling edges, matching a 1 W/(m K), 10 µm substrate with a 300 K backside (total conductance 0.005 W/K). This is a static substrate-cooling approximation: substrate heat capacity, diffusivity and lateral spreading are not modeled. Pt properties are representative; Seebeck is set to zero to isolate resistive 3ω. Outputs are peak phasors (RMS=peak/√2). Suggested Bode: terminal voltage, 3ω, electrical reference, raw amplitude. Preset assumptions are not recalibrated automatically after parameter edits.';
 return c;
};
})(globalThis.TE);

/* Presentation helpers: displayed rounding never replaces an unchanged raw value. */
(function(TE){
 TE.formatInputNumber=value=>{
  if(!Number.isFinite(value))return String(value);
  const rounded=Number(value.toPrecision(10));
  if(rounded!==0&&(Math.abs(rounded)>=1e4||Math.abs(rounded)<1e-3))return rounded.toExponential().replace('e+','E').replace('e','E');
  return String(rounded);
 };
 TE.setNumberInput=(element,value)=>{
  const display=TE.formatInputNumber(value);
  element.value=display;element.dataset.rawNumber=String(value);element.dataset.displayNumber=display;
 };
 TE.readNumberInput=element=>{
  TE.assert(element.value.trim()!=='','A numerical value is required.');
  const raw=element.dataset.rawNumber;
  return TE.finite(Number(raw!==undefined&&element.value===element.dataset.displayNumber?raw:element.value),'Numerical value');
 };
 TE.historyForPlot=(result,values)=>{
  const time=result.time.map(v=>v*1000),y=[...values];
  // Only a converged periodic history may be closed back to its first sample.
  if(result.converged){time.push(1000/result.frequency);y.push(values[0]);}
  return {time,values:y};
 };
 TE.remeshConfig=(config,{nx,ny,lx,ly,depth})=>{
  // Validate before allocating or mutating the displayed model.
  TE.assert(Number.isInteger(nx)&&Number.isInteger(ny)&&nx>=2&&ny>=1,'Element counts must be integers: Nx ≥ 2 and Ny ≥ 1.');
  TE.assert((nx+1)*(ny+1)<=1600,`Requested mesh: ${nx*ny} elements, ${(nx+1)*(ny+1)} nodes. The browser limit is 1600 nodes; reduce Nx or Ny.`);
  TE.assert([lx,ly,depth].every(v=>Number.isFinite(v)&&v>0),'Dimensions and depth must be positive.');
  const next={...config,nx,ny,lx,ly,depth};
  next.materialMap=Array.from({length:nx*ny},(_,k)=>{
   const i=k%nx,j=Math.floor(k/nx),oldI=Math.min(config.nx-1,Math.floor((i+.5)/nx*config.nx)),oldJ=Math.min(config.ny-1,Math.floor((j+.5)/ny*config.ny));
   return config.materialMap[oldJ*config.nx+oldI];
  });
  return next;
 };
})(globalThis.TE);
(function(TE){
 TE.spatialProfile=(r,{field='temperature',axis='x',position=.5,sample=0}={})=>{
  TE.assert(['temperature','voltage','Jx','Jy','qx','qy','J'].includes(field),'Unknown profile field.');
  TE.assert(['x','y'].includes(axis)&&Number.isFinite(position)&&position>=0&&position<=1,'Invalid profile cut.');
  const periodic=r.method!=='steady',count=periodic?r.samples:1;
  TE.assert(Number.isInteger(sample)&&sample>=0&&sample<count,'Invalid time sample.');
  const c=r.config,nodal=['temperature','voltage'].includes(field),get=k=>periodic?r[k][sample]:r[k];
  const data=field==='J'?get('Jx').map((v,i)=>Math.hypot(v,get('Jy')[i])):get(field);
  const cols=c.nx+(nodal?1:0),rows=c.ny+(nodal?1:0),transverse=axis==='x'?rows:cols;
  const line=Math.max(0,Math.min(transverse-1,Math.round(position*(axis==='x'?c.ny:c.nx)-(nodal?0:.5))));
  const length=axis==='x'?cols:rows,x=[],values=[];
  for(let k=0;k<length;k++){x.push((k+(nodal?0:.5))*(axis==='x'?c.lx/c.nx:c.ly/c.ny));values.push(data[axis==='x'?line*cols+k:k*cols+line]);}
  return {x,values,axis,field,sample,time:periodic?r.time[sample]:0,absoluteTime:periodic?(r.cycleStartTime??0)+r.time[sample]:0,line,transverseCoordinate:(line+(nodal?0:.5))*(axis==='x'?c.ly/c.ny:c.lx/c.nx),unit:field==='temperature'?'K':field==='voltage'?'V':['qx','qy'].includes(field)?'W/m²':'A/m²'};
 };
})(globalThis.TE);
(function(TE){
 TE.inferSimulationMode=c=>{
  const ac=v=>typeof v==='object'&&v!==null&&Number.isFinite(v.amplitude)&&v.amplitude!==0;
  if(c.electrical.kind!=='open_circuit'&&ac(c.electrical.value))return 'periodic';
  if(Object.values(c.thermal).some(b=>ac(b.value)&&(b.kind!=='convection'||b.h>0)))return 'periodic';
  return 'steady';
 };
})(globalThis.TE);

(function(TE){
 TE.surfaceField=(r,key,sample=0)=>{
  TE.assert(['temperature','voltage','Jx','Jy','J','qx','qy'].includes(key),'Unknown surface field.');
  const periodic=r.method!=='steady',c=r.config;TE.assert(Number.isInteger(sample)&&sample>=0&&sample<(periodic?r.samples:1),'Invalid surface sample.');
  const get=k=>periodic?r[k][sample]:r[k],nodal=['temperature','voltage'].includes(key);
  const raw=key==='J'?get('Jx').map((v,i)=>Math.hypot(v,get('Jy')[i])):get(key);
  const cells=nodal?Array.from({length:c.nx*c.ny},(_,k)=>{const i=k%c.nx,j=Math.floor(k/c.nx),a=j*(c.nx+1)+i;return (raw[a]+raw[a+1]+raw[a+c.nx+1]+raw[a+c.nx+2])/4;}):[...raw];
  return {cells,nodal,unit:key==='temperature'?'K':key==='voltage'?'V':['qx','qy'].includes(key)?'W/m²':'A/m²'};
 };
 TE.arrowNoiseFloor=r=>{
  let reference=0;const p=r.method!=='steady';if(p){for(let n=0;n<r.harmonics.Jx.length;n++)for(let i=0;i<r.harmonics.Jx[n].length;i++){const a=r.harmonics.Jx[n][i],b=r.harmonics.Jy[n][i];reference=Math.max(reference,Math.hypot(a.re,a.im,b.re,b.im));}}
  else for(let i=0;i<r.Jx.length;i++)reference=Math.max(reference,Math.hypot(r.Jx[i],r.Jy[i]));
  return Math.max(1e-12,reference*1e-8);
 };
})(globalThis.TE);

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
  const refFloor=reference==='time'&&quantity!=='impedance'?0:Math.max(refUnit==='K'||refUnit==='W/m²'?1e-9:1e-12,refSeries?Math.max(...refSeries.map(mag))*1e-10:0);
  if(!Number.isFinite(refMag)||refMag<=refFloor)reason=reason||'Reference amplitude is zero or below numerical resolution.';
  const exponent=normalization==='power'?n:1,divisor=quantity==='impedance'?refMag:normalization==='raw'?1:refMag**exponent;
  let magnitude=(reason&&(quantity==='impedance'||normalization!=='raw'))?null:a/divisor;
  if(magnitude!==null&&!Number.isFinite(magnitude)){magnitude=null;reason=reason||'Normalization exceeds the finite numerical range.';}
  if(quantity!=='impedance'&&normalization!=='raw')unit+='/('+refUnit+(exponent===1?'':'^'+exponent)+')';
  let phase=!reason&&a>phaseFloor?wrap(angle(z)+(quantity==='impedance'?180:0)-n*angle(ref)):null;
  if(magnitude!==null&&magnitude>1e15){magnitude=null;phase=null;reason='Normalized magnitude exceeds the display limit (1E15). Check reference amplitude and units.';}
  if(!r.converged){magnitude=null;phase=null;reason='Unconverged point: excluded from Bode.';}
  if(phase!==null&&unwrap&&previous!==null)phase+=360*Math.round((previous-phase)/360);
  previous=phase;
  return {frequency:r.frequency,outputFrequency:n*r.frequency,magnitude,phase,unit,rawMagnitude:a,referenceMagnitude:refMag,converged:r.converged,reason:reason||(phase===null?'Output below phase threshold.':''),nodeOrCell:['terminalVoltage','current','impedance'].includes(quantity)?null:index,x_m:nodal?i*c.lx/c.nx:(i+.5)*c.lx/c.nx,y_m:nodal?j*c.ly/c.ny:(j+.5)*c.ly/c.ny};
 });
};
TE.bodeCsv=(rows)=>['frequency_Hz,output_frequency_Hz,magnitude,unit,phase_deg,raw_magnitude,reference_magnitude,converged,node_or_cell,x_m,y_m,status',...rows.map(r=>[r.frequency,r.outputFrequency,r.magnitude,r.unit,r.phase,r.rawMagnitude,r.referenceMagnitude,r.converged,r.nodeOrCell,r.x_m,r.y_m,r.reason].map(v=>v==null?'':'"'+String(v).replace(/"/g,'""')+'"').join(','))].join('\n');
})(globalThis.TE);

/* Shared text for the interface and printed report. */
(function(TE){TE.equationGuide=[{"title": "Governing equations and boundaries", "html": "<h3>Unknown fields and constitutive laws</h3><p>T(x,y,t) is absolute temperature (K), V(x,y,t) electric potential (V). The local material defines σ(T), k(T), α(T), density ρ(T), and Cp(T). J is electric current density; q is total heat flux.</p><p>J = −σ(T)[∇V + α(T)∇T]<br>∇·J = 0<br>q = α(T)TJ − k(T)∇T<br>ρCp ∂T/∂t = −∇·q − J·∇V</p><h3>Thermoelectric coupling</h3><p>Within a smooth homogeneous material, these equations give:<br>ρCp ∂T/∂t = ∇·(k∇T) + |J|²/σ − T(dα/dT)J·∇T.<br>The last two terms are Joule and Thomson heating. Π = αT is the Peltier coefficient; discontinuities in α produce interface Peltier transport through q. These effects are already included in total flux and must not be added a second time.</p><h3>Boundary and interface conditions</h3><p>Electrical contacts are equipotential. V(source) = 0. Voltage mode prescribes V(sink); current mode sets total current entering the source; open circuit imposes zero net contact current. Other edges satisfy J·n = 0. Thermal edges prescribe T, q·n = qout, or q·n = h(T − Tambient), where n is the outward normal. Zero total flux includes Peltier transport. Ideal interfaces have continuous T, V, normal J and total normal q; contact resistance is absent.</p>"}, {"title": "Excitation and numerical method", "html": "<h3>DC and harmonic excitation</h3><p>DC solves the stationary system with ∂T/∂t = 0, using only DC biases. Periodic inputs use b + A cos(2πft + φ); φ is in degrees in the editor. The nonlinear time-domain solution generates harmonics:<br>u(t) = U₀ + Re[Σ Uₙ exp(inωt)], n = 1,2,3.<br>Coefficients are peak phasors, not RMS. Instantaneous spatial profiles use stored time samples, including all resolved harmonics; they are not reconstructed from only 1ω–3ω.</p><h3>Discretization and iteration</h3><p>Each rectangular cell contributes four half-face links. For a link a→b of length L and half-face area A:<br>g = A/[L mean(ρₑ(Ta),ρₑ(Tb))]<br>Iab = g[Va − Vb − αmean(Tb − Ta)]<br>Qab = αmean(Ta + Tb)Iab/2 − kmean A(Tb − Ta)/L.<br>Electrical work Iab(Va − Vb) is shared between the two nodes. Cell heat capacity is split among its four corners. Coupled equations are iterated with damped Picard; linear graph systems use preconditioned conjugate gradients. BDF2 advances periodic runs after one backward-Euler startup step. Cycle convergence is assessed from successive temperature histories.</p><p>Ly × depth gives the cross-section of a 1D reduction. Ny = 1, full left/right contacts and zero top/bottom flux produce the transverse-uniform limit. Grid/time refinement remains necessary, especially for weak 3ω. The model assumes isotropic properties, perfect interfaces and no front/back heat losses.</p>"}];})(globalThis.TE);
