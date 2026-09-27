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
