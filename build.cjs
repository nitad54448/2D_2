const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const core=['materials','fourier','mesh2d','sparse','solver2d','validation','config2d'].map(n=>read('src/core/'+n+'.js')).join('\n');
const assets={'startup.js':read('src/startup.js'),'core.js':core+'\n'+read('src/ui-helpers.js')+'\n'+read('src/sweep.js')+'\n'+read('src/equations.js'),'exports.js':read('src/exports.js'),'app.js':read('src/app.js').replace('/*SWEEP_UI*/',()=>read('src/sweep-ui.js'))};
const dest=path.join(__dirname,'assets');fs.mkdirSync(dest,{recursive:true});
for(const [name,source]of Object.entries(assets)){new vm.Script(source,{filename:name});fs.writeFileSync(path.join(dest,name),source);}
const context=vm.createContext({});vm.runInContext(assets['core.js'],context);vm.runInContext(assets['exports.js'],context);
if(typeof context.TE?.default2D!=='function'||typeof context.TE?.resultReport!=='function')throw new Error('Core/export initialization failed.');
const worker=core+'\n'+read('src/ui-helpers.js')+'\n'+read('src/sweep.js')+'\n'+read('src/worker.js');new vm.Script(worker,{filename:'worker.js'});
// Worker source has no HTML markup and remains inert until a run creates a Blob.
if(/<\/script|<!--|<script/i.test(worker))throw new Error('Unsafe embedded worker source.');
let html=read('src/index.template.html').replace('/*STYLE*/',()=>read('src/styles.css'))
 .replace('<script>/*CORE*/</script>',()=>'<script src="assets/startup.js"></script><script src="assets/core.js"></script><script src="assets/exports.js"></script>')
 .replace('/*EQUATIONS*/',()=>context.TE.equationGuide.map(p=>p.html).join(''))
 .replace('/*WORKER*/',()=>worker).replace('<script>/*APP*/</script>','<script src="assets/app.js"></script>');
html=html.replace('</footer>','<span>Build: frequency-sweep-7</span></footer>');
fs.writeFileSync(path.join(__dirname,'index.html'),html);console.log('Built separate-script app:',Buffer.byteLength(html),'HTML bytes; all four assets syntax-checked.');
