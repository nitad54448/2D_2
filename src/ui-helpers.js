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
