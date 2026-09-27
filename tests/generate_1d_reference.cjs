// Optional: node tests/generate_1d_reference.cjs /path/to/thermoelectric_browser/tests/load.cjs
const TE=require(require('node:path').resolve(process.argv[2])),fs=require('node:fs'),path=require('node:path');
const m=new TE.ThermoelectricMaterial({rho:2000,Cp:500,k:2,sigma:T=>1e5/(1+.01*(T-300)),alpha:0});
const s=new TE.HarmonicSolver(new TE.Mesh1D({length:.001,nNodes:11,area:1e-6}),m);s.electricalBC=new TE.ElectricalBC('current',{amplitude:.2});
const r=s.solvePeriodic(2,{samples:256});
fs.writeFileSync(path.join(__dirname,'reference_1d.json'),JSON.stringify({temperature:r.harmonics.temperature,voltage:r.harmonics.terminalVoltage,x:r.x},null,2));console.log('1D reference generated');
