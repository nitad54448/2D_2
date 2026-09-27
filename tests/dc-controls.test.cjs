const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),TE=require('./load.cjs');require('../src/ui-helpers.js');
test('DC controls clear saved raw AC values and disable electrical AC without erasing thermal excitation',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
 const body=source.slice(source.indexOf('function modes(){'),source.indexOf('function canvasFrame('));
 const ids={};for(const id of ['mode','excitationMode','electricalKind','frequency','samples','maxPeriods','bias','amplitude','phase','solverMethod','periodicSettings','periodicNote','sweepSettings','singleFrequencyLabel','sweepMin','sweepMax','sweepPoints','sweepSpacing'])ids[id]={value:'',dataset:{},disabled:false};
 ids.excitationMode.value='steady';ids.electricalKind.value='current';TE.setNumberInput(ids.amplitude,.3);TE.setNumberInput(ids.phase,45);
 const ac={value:'12',dataset:{}},h={value:'0'},card={dataset:{side:'left'},querySelector:s=>s.includes('kind')?{value:'flux'}:s.includes('amplitude')?ac:h};
 vm.runInNewContext(body+'modes();',{$:id=>ids[id],TE,document:{querySelectorAll:s=>s.includes('amplitude')?[ac]:[card]}});
 for(const id of ['amplitude','phase']){assert.equal(TE.readNumberInput(ids[id]),0);assert.equal(ids[id].disabled,true);}
 assert.equal(ac.value,'12');assert.equal(ac.disabled,false);assert.equal(ids.mode.value,'periodic');assert.equal(ids.periodicSettings.hidden,false);assert.equal(ids.solverMethod.textContent,'Periodic');assert.equal(ids.bias.disabled,false);assert.equal(ids.excitationMode.value,'steady');
 ac.value='0';vm.runInNewContext(body+'modes();',{$:id=>ids[id],TE,document:{querySelectorAll:()=>[card]}});assert.equal(ids.solverMethod.textContent,'DC stationary');assert.equal(ids.periodicSettings.hidden,true);for(const id of ['frequency','samples','maxPeriods'])assert.equal(ids[id].disabled,true);
});

test('automatic solver accounts for thermal forcing and ignores inactive sources',()=>{
 const c=TE.default2D();c.electrical.value={bias:.1,amplitude:0};assert.equal(TE.inferSimulationMode(c),'steady');
 c.thermal.top.value.amplitude=2;assert.equal(TE.inferSimulationMode(c),'periodic');
 c.thermal.top.value.amplitude=0;c.electrical.value.amplitude=.1;assert.equal(TE.inferSimulationMode(c),'periodic');
 c.electrical.kind='open_circuit';assert.equal(TE.inferSimulationMode(c),'steady');
 c.thermal.right.value.amplitude=5;c.thermal.right.h=0;assert.equal(TE.inferSimulationMode(c),'steady');
 c.thermal.right.h=10;assert.equal(TE.inferSimulationMode(c),'periodic');
});
