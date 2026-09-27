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
 const decorate=r=>({...r,config:c,mesh:{nx:c.nx,ny:c.ny,lx:c.lx,ly:c.ly,depth:c.depth,x:s.mesh.x,y:s.mesh.y,materialMap:s.mesh.map},convention:'Peak phasors: u(t)=U0+Re(sum(Un exp(i n omega t))). Terminal voltage = V(sink)-V(source).'});
 const r=c.mode==='steady'?s.solveSteady():s.solvePeriodic(c.frequency,{samples:c.samples,maxPeriods:c.maxPeriods,onProgress:progress,onCheckpoint:checkpoint?r=>checkpoint(decorate(r)):undefined});
 return decorate(r);};
})(globalThis.TE);
