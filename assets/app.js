(()=>{'use strict';
if(!globalThis.TE||typeof globalThis.TE.default2D!=='function')return;
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let clock=null,checkpoint=null,lastMeshEdit=null,sweepResult=null,activeSweep=null;
let config=TE.default2D(),selected=0,result=null,worker=null,probe=0,started=0,paint=false,geomFrame=null,resultFrame=null;
const fmt=v=>Math.abs(v)>1e4||(v!==0&&Math.abs(v)<.001)?v.toExponential(3):Number(v.toPrecision(5)).toString();
const amp=z=>Math.hypot(z.re,z.im),phase=z=>Math.atan2(z.im,z.re)*180/Math.PI,num=id=>{const e=$(id);TE.assert(e.value.trim()!=='',`${id}: value required.`);return TE.readNumberInput(e);};
function numberAttrs(value){return `value="${esc(TE.formatInputNumber(value))}" data-raw-number="${esc(value)}" data-display-number="${esc(TE.formatInputNumber(value))}"`;}
function input(label,key,value,unit=''){return `<label>${label}<span>${unit}</span><input data-key="${key}" type="number" step="any" required ${['rho','Cp','k','sigma','h'].includes(key)?'min="0"':''} ${numberAttrs(value)}></label>`;}
function notice(text,error=false){$('status').textContent=text;$('badge').textContent=error?'ERROR':'READY';$('badge').className=error?'error':'';}
function dirty(){if(worker)return;$('exportProfile').disabled=true;$('badge').textContent=result?'INPUTS CHANGED':'READY';$('badge').className='';$('exportResults').disabled=true;$('exportCsv').disabled=true;for(const id of ['exportMenuButton','exportPdf','exportZip'])$(id).disabled=true;$('exportMenu').hidden=true;$('exportMenuButton').setAttribute('aria-expanded','false');if(result)$('status').textContent='Inputs changed. Run again to update the displayed result.';}
function tab(name){document.querySelectorAll('[role=tab]').forEach(t=>{const active=t.dataset.tab===name;t.setAttribute('aria-selected',active);t.tabIndex=active?0:-1;});document.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==name);requestAnimationFrame(()=>{if(name==='geometry')drawGeometry();if(name==='results'){drawResults();drawProfile();drawBode();}});}
document.querySelectorAll('[role=tab]').forEach(t=>{t.onclick=()=>tab(t.dataset.tab);t.onkeydown=e=>{const tabs=[...document.querySelectorAll('[role=tab]')],i=tabs.indexOf(t);let next;if(e.key==='ArrowRight')next=tabs[(i+1)%tabs.length];if(e.key==='ArrowLeft')next=tabs[(i+tabs.length-1)%tabs.length];if(e.key==='Home')next=tabs[0];if(e.key==='End')next=tabs.at(-1);if(next){e.preventDefault();tab(next.dataset.tab);next.focus();}};});
function materialsForm(){
 $('materialCards').innerHTML=config.materials.map((m,i)=>`<div class="material-card" data-material="${i}" style="--material-color:${/^#[0-9a-f]{6}$/i.test(m.color)?m.color:'#73d8d0'}"><div class="name-row"><label>Material ${i+1}<input data-key="name" value="${esc(m.name)}"></label><label>Color<input type="color" data-key="color" value="${esc(m.color)}"></label></div><div class="grid2">${input('Density','rho',m.rho,'kg/m³')}${input('Heat capacity','Cp',m.Cp,'J/kg K')}${input('Thermal conductivity','k',m.k,'W/m K')}${input('Electrical conductivity','sigma',m.sigma,'S/m')}${input('Resistivity slope β','beta',m.beta??0,'1/K')}${input('Seebeck α₃₀₀','alpha',m.alpha*1e6,'µV/K')}${input('Seebeck slope α′','alphaSlope',(m.alphaSlope??0)*1e6,'µV/K²')}</div></div>`).join('');palette();
}
function palette(){$('palette').innerHTML=config.materials.map((m,i)=>`<button class="swatch ${i===selected?'active':''}" data-select="${i}" style="--swatch:${m.color}"><i></i>${esc(m.name)}</button>`).join('');}
function boundaryForm(){
 $('electrodes').innerHTML=['source','sink'].map(name=>{const e=config.electrical;return `<div class="electrode"><h3>${name.toUpperCase()} ELECTRODE</h3><div class="grid3"><label>Side<select id="${name}Side">${['left','right','bottom','top'].map(side=>`<option ${side===e[name+'Side']?'selected':''}>${side}</option>`).join('')}</select></label><label>Range start <span>%</span><input id="${name}Start" type="number" ${numberAttrs(100*e[name+'Range'][0])} min="0" max="100"></label><label>Range end <span>%</span><input id="${name}End" type="number" ${numberAttrs(100*e[name+'Range'][1])} min="0" max="100"></label></div></div>`;}).join('');
 $('thermalCards').innerHTML=Object.entries(config.thermal).map(([side,b])=>`<div class="thermal-card" data-side="${side}"><h3>${side.toUpperCase()}</h3><label>Condition<select data-key="kind">${['temperature','flux','convection'].map(k=>`<option value="${k}" ${b.kind===k?'selected':''}>${{temperature:'Temperature · K',flux:'Outward total flux · W/m²',convection:'Convection · ambient K'}[k]}</option>`).join('')}</select></label><div class="grid3">${input('DC value','bias',typeof b.value==='number'?b.value:b.value.bias??0)}${input('AC peak','amplitude',typeof b.value==='number'?0:b.value.amplitude??0)}${input('Phase','phase',typeof b.value==='number'?0:b.value.phase??0,'°')}${input('Convection h','h',b.h??0)}</div></div>`).join('');
}
function fill(){$('modelNote').textContent=config.description??'';$('modelNote').hidden=!config.description;materialsForm();boundaryForm();const v=config.electrical.value;
 for(const [id,value]of Object.entries({lx:config.lx*1000,ly:config.ly*1000,depth:config.depth*1000,nx:config.nx,ny:config.ny,electricalKind:config.electrical.kind,bias:typeof v==='number'?v:v.bias??0,amplitude:typeof v==='number'?0:v.amplitude??0,phase:typeof v==='number'?0:v.phase??0,mode:config.mode,frequency:config.frequency,samples:config.samples,maxPeriods:config.maxPeriods})){if($(id).type==='number')TE.setNumberInput($(id),value);else $(id).value=value;}
 $('excitationMode').value=config.sweep?.enabled?'sweep':config.mode==='steady'||typeof v==='number'||!(v.amplitude??0)?'steady':'periodic';
 if(config.mode==='steady')document.querySelectorAll('[data-side] [data-key="amplitude"]').forEach(e=>TE.setNumberInput(e,0));
 for(const [id,value] of Object.entries({sweepMin:config.sweep?.min??.1,sweepMax:config.sweep?.max??100,sweepPoints:config.sweep?.points??10}))TE.setNumberInput($(id),value);$('sweepSpacing').value=config.sweep?.spacing??'log';
 modes();drawGeometry();meshPreview();validateUI();}
function read(){const c=JSON.parse(JSON.stringify(config));
 c.materials=[...document.querySelectorAll('[data-material]')].map(card=>{const m={};card.querySelectorAll('[data-key]').forEach(e=>{TE.assert(e.value.trim()!=='','Complete material fields.');m[e.dataset.key]=['name','color'].includes(e.dataset.key)?e.value:TE.readNumberInput(e);});m.alpha/=1e6;m.alphaSlope/=1e6;return m;});
 for(const card of document.querySelectorAll('[data-side]')){const v={};card.querySelectorAll('[data-key]').forEach(e=>{TE.assert(e.value.trim()!=='','Complete thermal fields.');v[e.dataset.key]=e.dataset.key==='kind'?e.value:TE.readNumberInput(e);});c.thermal[card.dataset.side]={kind:v.kind,value:{bias:v.bias,amplitude:v.amplitude,phase:v.phase},h:v.h};}
 c.electrical={kind:$('electricalKind').value,value:{bias:num('bias'),amplitude:num('amplitude'),phase:num('phase')}};
 for(const name of ['source','sink']){c.electrical[name+'Side']=$(name+'Side').value;c.electrical[name+'Range']=[num(name+'Start')/100,num(name+'End')/100];}
 c.sweep=$('excitationMode').value==='sweep'?{enabled:true,min:num('sweepMin'),max:num('sweepMax'),points:num('sweepPoints'),spacing:$('sweepSpacing').value}:{enabled:false};
 c.mode=TE.inferSimulationMode(c);c.frequency=c.sweep.enabled?c.sweep.min:c.mode==='periodic'?num('frequency'):0;c.samples=c.mode==='periodic'?num('samples'):128;c.maxPeriods=c.mode==='periodic'?num('maxPeriods'):100;return c;
}
function modes(){const dc=$('excitationMode').value==='steady',open=$('electricalKind').value==='open_circuit';
 if(dc){TE.setNumberInput($('amplitude'),0);TE.setNumberInput($('phase'),0);}
 $('bias').disabled=open;$('amplitude').disabled=dc||open;$('phase').disabled=dc||open;
 const thermal={};document.querySelectorAll('[data-side]').forEach(card=>{const kind=card.querySelector('[data-key="kind"]').value,h=card.querySelector('[data-key="h"]'),a=card.querySelector('[data-key="amplitude"]');h.disabled=kind!=='convection';a.disabled=false;thermal[card.dataset.side]={kind,h:Number(h.value),value:{amplitude:Number(a.value)}};});
 const mode=TE.inferSimulationMode({electrical:{kind:$('electricalKind').value,value:{amplitude:Number($('amplitude').value)}},thermal});
 $('mode').value=mode;$('solverMethod').textContent=mode==='steady'?'DC stationary':'Periodic';$('periodicSettings').hidden=mode==='steady';$('periodicNote').hidden=mode==='steady';
 for(const id of ['frequency','samples','maxPeriods'])$(id).disabled=mode==='steady';
 const sweep=$('excitationMode').value==='sweep';$('sweepSettings').hidden=!sweep;$('singleFrequencyLabel').hidden=sweep;$('frequency').disabled=sweep||mode==='steady';
 for(const id of ['sweepMin','sweepMax','sweepPoints','sweepSpacing'])$(id).disabled=!sweep;
 if(sweep)$('solverMethod').textContent='Periodic · frequency sweep';
}
function canvasFrame(id,c){const canvas=$(id),width=canvas.clientWidth||700,height=canvas.clientHeight||400,dpr=devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 let w=width-80,h=height-65;if(w/h>c.lx/c.ly)w=h*c.lx/c.ly;else h=w*c.ly/c.lx;const left=50+(width-80-w)/2,top=22+(height-65-h)/2;
 ctx.fillStyle='#839aa9';ctx.font='10px monospace';ctx.textAlign='center';for(let i=0;i<=4;i++){ctx.fillText(fmt(c.lx*1000*i/4),left+w*i/4,top+h+19);ctx.textAlign='right';ctx.fillText(fmt(c.ly*1000*i/4),left-9,top+h-h*i/4+3);ctx.textAlign='center';}ctx.fillText('x · mm',left+w/2,top+h+37);ctx.textAlign='left';ctx.fillText('y · mm',left-25,top-9);return {ctx,left,top,w,h};}
function contacts(frame,c){const{ctx,left,top,w,h}=frame;ctx.lineWidth=5;for(const name of ['source','sink']){const side=c.electrical[name+'Side'],range=c.electrical[name+'Range'],count=['left','right'].includes(side)?c.ny:c.nx,start=Math.ceil(range[0]*count-1e-10)/count,end=Math.floor(range[1]*count+1e-10)/count;ctx.strokeStyle=name==='source'?'#ffffff':'#e47cd3';ctx.beginPath();if(side==='left'||side==='right'){const x=left+(side==='right'?w:0);ctx.moveTo(x,top+h*(1-start));ctx.lineTo(x,top+h*(1-end));}else{const y=top+(side==='bottom'?h:0);ctx.moveTo(left+w*start,y);ctx.lineTo(left+w*end,y);}ctx.stroke();}ctx.lineWidth=1;}
function drawGeometry(){if($('geometry').hidden)return;const c=config,f=canvasFrame('geometryCanvas',c);geomFrame=f;const{ctx,left,top,w,h}=f;
 for(let j=0;j<c.ny;j++)for(let i=0;i<c.nx;i++){ctx.fillStyle=c.materials[c.materialMap[j*c.nx+i]]?.color||'#aaa';ctx.globalAlpha=.75;ctx.fillRect(left+i*w/c.nx,top+(c.ny-1-j)*h/c.ny,w/c.nx,h/c.ny);ctx.globalAlpha=1;ctx.strokeStyle='#0b141d';ctx.strokeRect(left+i*w/c.nx,top+(c.ny-1-j)*h/c.ny,w/c.nx,h/c.ny);}contacts(f,c);$('gridInfo').textContent=`${c.nx} × ${c.ny} = ${c.nx*c.ny} elements · ${(c.nx+1)*(c.ny+1)} nodes`;}
function paintAt(e){if(worker||!geomFrame)return;const rect=$('geometryCanvas').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,f=geomFrame;if(x<f.left||x>=f.left+f.w||y<f.top||y>=f.top+f.h)return;
 const i=Math.floor((x-f.left)/f.w*config.nx),j=config.ny-1-Math.floor((y-f.top)/f.h*config.ny);config.materialMap[j*config.nx+i]=selected;drawGeometry();dirty();}
$('geometryCanvas').onpointerdown=e=>{paint=true;$('geometryCanvas').setPointerCapture(e.pointerId);paintAt(e);};$('geometryCanvas').onpointermove=e=>{if(paint)paintAt(e);};$('geometryCanvas').onpointerup=()=>paint=false;$('geometryCanvas').onpointercancel=()=>paint=false;
$('palette').onclick=e=>{const b=e.target.closest('[data-select]');if(b){selected=Number(b.dataset.select);palette();}};
function validationTargets(path){
 const direct={lx:'lx',ly:'ly',depth:'depth',nx:'nx',ny:'ny',mode:'mode',frequency:'frequency',samples:'samples',maxPeriods:'maxPeriods','electrical.kind':'electricalKind','electrical.value.bias':'bias','electrical.value.amplitude':'amplitude','electrical.value.phase':'phase'};
 if(direct[path])return [$(direct[path])];
 const material=path.match(/^materials\.(\d+)\.(\w+)$/);if(material)return [...document.querySelectorAll(`[data-material="${material[1]}"] [data-key="${material[2]}"]`)];
 const thermal=path.match(/^thermal\.(left|right|top|bottom)\.(?:value\.)?(\w+)$/);if(thermal)return [...document.querySelectorAll(`[data-side="${thermal[1]}"] [data-key="${thermal[2]}"]`)];
 const electrode=path.match(/^electrical\.(source|sink)(Side|Range)$/);if(electrode)return electrode[2]==='Side'?[$(electrode[1]+'Side')]:[$(electrode[1]+'Start'),$(electrode[1]+'End')];
 return [];
}
function validateUI(){
 const controls=[...document.querySelectorAll('.settings input,.settings select')];
 controls.forEach(e=>{e.setCustomValidity('');e.removeAttribute('aria-invalid');e.removeAttribute('title');});
 const issues=[];
 for(const e of controls.filter(e=>e.type==='number'&&!e.disabled)){
  try{TE.readNumberInput(e);}catch{issues.push({path:e.id||e.dataset.key,message:'Enter a finite numerical value.',elements:[e]});}
 }
 if(!issues.length){try{
  let draft=read();const g=geometryInput();
  if(Number.isInteger(g.nx)&&Number.isInteger(g.ny)&&g.nx>=2&&g.ny>=1&&(g.nx+1)*(g.ny+1)<=1600)draft=TE.remeshConfig(draft,{...g,lx:config.lx,ly:config.ly,depth:config.depth});
  Object.assign(draft,g);issues.push(...TE.validate2DConfig(draft));if(draft.sweep?.enabled)TE.validateSweep(draft);
 }catch(e){issues.push({path:'model',message:e.message});}}
 for(const issue of issues)for(const e of issue.elements||validationTargets(issue.path)){if(!e)continue;e.setCustomValidity(issue.message);e.setAttribute('aria-invalid','true');e.title=issue.message;}
 const summary=$('validationSummary');summary.hidden=!issues.length;
 summary.innerHTML=issues.length?'<strong>Correct these inputs before applying, exporting or running:</strong><ul>'+issues.slice(0,10).map(e=>`<li><b>${esc(e.path)}</b> — ${esc(e.message)}</li>`).join('')+'</ul>'+(issues.length>10?`<small>${issues.length-10} more issue(s) are highlighted in the form.</small>`:''):'';
 for(const id of ['run','save'])$(id).disabled=Boolean(worker)||issues.length>0;
 let pending=false,signature=null;try{const g=geometryInput();pending=meshChanged(g);signature=JSON.stringify(g);}catch{}
 const apply=$('applyGrid');apply.disabled=Boolean(worker)||issues.length>0||!pending;apply.classList.toggle('mesh-pending',!apply.disabled);
 if(!pending){lastMeshEdit=null;apply.classList.remove('mesh-flash');}
 else if(!apply.disabled&&signature!==lastMeshEdit){lastMeshEdit=signature;apply.classList.remove('mesh-flash');void apply.offsetWidth;apply.classList.add('mesh-flash');}
 return issues.length===0;
}
function geometryInput(){return {nx:num('nx'),ny:num('ny'),lx:num('lx')/1000,ly:num('ly')/1000,depth:num('depth')/1000};}
function meshChanged(g){return g.nx!==config.nx||g.ny!==config.ny||Math.abs(g.lx-config.lx)>1e-14||Math.abs(g.ly-config.ly)>1e-14||Math.abs(g.depth-config.depth)>1e-14;}
function meshPreview(){
 try{const g=geometryInput(),valid=Number.isInteger(g.nx)&&Number.isInteger(g.ny)&&g.nx>=2&&g.ny>=1;
  $('meshSummary').textContent=valid?`${g.nx} × ${g.ny} = ${g.nx*g.ny} elements / ${(g.nx+1)*(g.ny+1)} nodes`:'Enter whole-number counts: Nx ≥ 2 and Ny ≥ 1.';
  $('meshPending').textContent=valid&&(g.nx+1)*(g.ny+1)>1600?'Too large: maximum 1600 nodes.':meshChanged(g)?'Pending change — Apply mesh, Run simulation or Export model will apply it.':'Mesh is up to date.';
 }catch{$('meshSummary').textContent='Enter valid dimensions and element counts.';$('meshPending').textContent='';}
}
function applyGeometry(){const c=read(),g=geometryInput(),candidate=TE.remeshConfig(c,g);TE.assertValid2DConfig(candidate);if(candidate.sweep?.enabled)TE.validateSweep(candidate);config=candidate;drawGeometry();meshPreview();validateUI();return config;}
$('applyGrid').onclick=()=>{try{applyGeometry();dirty();$('status').textContent=`Mesh applied: ${config.nx} × ${config.ny} = ${config.nx*config.ny} elements, ${(config.nx+1)*(config.ny+1)} nodes. Inspect material regions after remeshing.`;}catch(e){notice(e.message,true);}};
$('fill').onclick=()=>{config.materialMap.fill(selected);drawGeometry();dirty();};
$('addMaterial').onclick=()=>{try{config=read();TE.assert(config.materials.length<12,'Maximum 12 materials.');config.materials.push({name:'New material',rho:2000,Cp:500,k:2,sigma:1e5,beta:0,alpha:0,alphaSlope:0,color:['#96a8f2','#dd88b8','#b1c47c'][config.materials.length%3]});materialsForm();dirty();validateUI();}catch(e){notice(e.message,true);}};
function color(t){const stops=[[24,44,89],[36,107,153],[87,182,173],[227,193,110],[244,141,75]],u=Math.max(0,Math.min(1,t))*4,i=Math.min(3,Math.floor(u)),f=u-i;return `rgb(${stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*f)).join(',')})`;}
function chart(id,x,y,label,xLabel='Time · ms'){const el=$(id),W=el.clientWidth||450,H=210,L=65,R=15,T=20,B=38;let lo=Math.min(...y),hi=Math.max(...y);if(hi-lo<1e-12*Math.max(1,Math.abs(hi))){lo-=Math.max(1e-8,Math.abs(hi)*1e-5);hi+=Math.max(1e-8,Math.abs(hi)*1e-5);}else{const d=(hi-lo)*.12;lo-=d;hi+=d;}const X=v=>L+(v-x[0])/(x.at(-1)-x[0]||1)*(W-L-R),Y=v=>H-B-(v-lo)/(hi-lo)*(H-B-T);let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><text x="${L}" y="11" fill="#8299a8" font-size="9">${esc(label)}</text>`;
 for(let i=0;i<5;i++){const v=lo+(hi-lo)*i/4,xx=x[0]+(x.at(-1)-x[0])*i/4;s+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#293b49" stroke-dasharray="3 5"/><text x="${L-8}" y="${Y(v)+3}" text-anchor="end" fill="#8299a8" font-size="9">${fmt(v)}</text><text x="${X(xx)}" y="${H-18}" text-anchor="middle" fill="#8299a8" font-size="9">${fmt(xx)}</text>`;}
 if(x.length===1)s+=`<circle cx="${X(x[0])}" cy="${Y(y[0])}" r="3" fill="#73d8d0"/>`;
 el.innerHTML=s+`<path d="${x.map((v,i)=>`${i?'L':'M'}${X(v)},${Y(y[i])}`).join(' ')}" fill="none" stroke="#73d8d0" stroke-width="2"/><text x="${W-R}" y="${H-2}" text-anchor="end" fill="#8299a8" font-size="9">${esc(xLabel)}</text></svg>`;}
function drawResults(){if(!result||$('results').hidden)return;const r=result,c=r.config,periodic=r.method!=='steady',n=periodic?Number($('harmonic').value):0,field=$('field').value,representation=$('representation').value;const valuesFor=key=>periodic?r.harmonics[key][n]:r[key].map(v=>({re:v,im:0}));
 const vecX=valuesFor('Jx'),vecY=valuesFor('Jy');let values;
 if(field==='J'){values=vecX.map((z,i)=>Math.hypot(amp(z),amp(vecY[i])));$('representation').disabled=true;}else{const z=valuesFor(field);values=z.map(z=>n?(representation==='phase'?phase(z):representation==='real'?z.re:amp(z)):z.re);$('representation').disabled=!n;}
 // Keep the user's harmonic representation when temporarily viewing DC or |J|.
 $('representationHelp').textContent=field==='J'?'Current magnitude uses the vector norm; phase and real-part selection do not apply.':!n?'DC is the signed mean value. Select 1ω, 2ω or 3ω to view peak amplitude, phase or real part.':'Amplitude is the peak magnitude of this harmonic (not RMS). Phase and real part use the cosine reference.';
 const nodeField=field==='temperature'||field==='voltage',isPhase=n&&representation==='phase'&&field!=='J',unit=isPhase?'°':field==='temperature'?'K':field==='voltage'?'V':['qx','qy'].includes(field)?'W/m²':'A/m²';
 let lo=values.reduce((a,b)=>Math.min(a,b),Infinity),hi=values.reduce((a,b)=>Math.max(a,b),-Infinity);if(isPhase){lo=-180;hi=180;}
 const f=canvasFrame('resultCanvas',c);resultFrame=f;const{ctx,left,top,w,h}=f;
 for(let j=0;j<c.ny;j++)for(let i=0;i<c.nx;i++){const idx=j*c.nx+i;let v=values[idx];if(nodeField){const a=j*(c.nx+1)+i;const ids=[a,a+1,a+c.nx+1,a+c.nx+2];if(isPhase){const zs=valuesFor(field),re=ids.reduce((s,id)=>s+zs[id].re,0),im=ids.reduce((s,id)=>s+zs[id].im,0);v=Math.atan2(im,re)*180/Math.PI;}else v=ids.reduce((s,id)=>s+values[id],0)/4;}
  ctx.fillStyle=color(hi===lo?.5:(v-lo)/(hi-lo));ctx.fillRect(left+i*w/c.nx,top+(c.ny-1-j)*h/c.ny,w/c.nx+.4,h/c.ny+.4);
 }
 if($('arrows').checked){const vmax=vecX.reduce((s,z,i)=>Math.max(s,Math.hypot(z.re,vecY[i].re)),0),stride=Math.max(1,Math.ceil(Math.max(c.nx,c.ny)/18));if(vmax>TE.arrowNoiseFloor(r)){ctx.strokeStyle='#f8fafc';ctx.fillStyle='#f8fafc';ctx.lineWidth=1.15;for(let j=0;j<c.ny;j+=stride)for(let i=0;i<c.nx;i+=stride){const k=j*c.nx+i,u=vecX[k].re,v=vecY[k].re,length=Math.hypot(u,v);if(length<vmax*.005)continue;const L=Math.min(w/c.nx,h/c.ny)*stride*.72*Math.sqrt(length/vmax),dx=u/length*L,dy=-v/length*L,x=left+(i+.5)*w/c.nx,y=top+(c.ny-j-.5)*h/c.ny;ctx.beginPath();ctx.moveTo(x-dx/2,y-dy/2);ctx.lineTo(x+dx/2,y+dy/2);ctx.stroke();const a=Math.atan2(dy,dx),tipx=x+dx/2,tipy=y+dy/2;ctx.beginPath();ctx.moveTo(tipx,tipy);ctx.lineTo(tipx-4*Math.cos(a-.5),tipy-4*Math.sin(a-.5));ctx.lineTo(tipx-4*Math.cos(a+.5),tipy-4*Math.sin(a+.5));ctx.closePath();ctx.fill();}}}
 contacts(f,c);const pi=probe%(c.nx+1),pj=Math.floor(probe/(c.nx+1));ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(left+pi/c.nx*w,top+h-pj/c.ny*h,5,0,2*Math.PI);ctx.stroke();
 $('scaleMin').textContent=TE.formatInputNumber(lo);$('scaleMax').textContent=TE.formatInputNumber(hi);$('scaleUnit').textContent=unit;
 $('fieldCaption').textContent=`${$('field').selectedOptions[0].text} · ${n?n+'ω':'DC'}${n?' · '+(field==='J'?'vector amplitude':representation):''} · ${nodeField?'nodal values averaged per cell':'cell-centered field'}`;
 $('vectorNote').textContent='Arrows: real current phasor at 0° (direction and relative magnitude). White = source electrode; pink = sink. Click to move the probe. Vectors below 1E-8 of the strongest current harmonic (or 1E-12 A/m²) are hidden to avoid magnifying numerical noise.';
 $('probeLabel').textContent=`x = ${fmt(pi*c.lx/c.nx*1000)} mm, y = ${fmt(pj*c.ly/c.ny*1000)} mm`;
 $('timeCharts').hidden=!periodic;
 if(periodic){const thermal=TE.historyForPlot(r,r.temperature.map(T=>T[probe])),electric=TE.historyForPlot(r,r.terminalVoltage.map(v=>v*1000));chart('probeChart',thermal.time,thermal.values,'Temperature · K');chart('voltageChart',electric.time,electric.values,'Voltage · mV');}
 else{$('probeChart').textContent=`Steady temperature: ${r.temperature[probe].toFixed(6)} K`;$('voltageChart').textContent=`Steady terminal voltage: ${r.terminalVoltage.toExponential(6)} V`;}
}
$('resultCanvas').onclick=e=>{if(!result||!resultFrame)return;const r=$('resultCanvas').getBoundingClientRect(),f=resultFrame,c=result.config,x=(e.clientX-r.left-f.left)/f.w,y=1-(e.clientY-r.top-f.top)/f.h;if(x<0||x>1||y<0||y>1)return;probe=Math.round(y*c.ny)*(c.nx+1)+Math.round(x*c.nx);drawResults();};
for(const id of ['field','harmonic','representation','arrows'])$(id).onchange=drawResults;
function drawProfile(){if(!result||$('results').hidden)return;const r=result,c=r.config,periodic=r.method!=='steady';$('profileTimeControls').hidden=!periodic;$('profileTime').max=periodic?r.samples-1:0;
 const sample=periodic?Number($('profileTime').value):0,field=$('profileField').value,surface=TE.surfaceField(r,field,sample),lo=Math.min(...surface.cells),hi=Math.max(...surface.cells),f=canvasFrame('profileCanvas',c),{ctx,left,top,w,h}=f;
 for(let j=0;j<c.ny;j++)for(let i=0;i<c.nx;i++){const v=surface.cells[j*c.nx+i];ctx.fillStyle=color(hi===lo?.5:(v-lo)/(hi-lo));ctx.fillRect(left+i*w/c.nx,top+(c.ny-j-1)*h/c.ny,w/c.nx+.4,h/c.ny+.4);}contacts(f,c);
 $('surfaceMin').textContent=TE.formatInputNumber(lo);$('surfaceMax').textContent=TE.formatInputNumber(hi);$('surfaceUnit').textContent=surface.unit;
 $('profileCaption').textContent=(periodic?`t = ${fmt(r.time[sample]*1000)} ms · phase ${fmt(360*r.frequency*r.time[sample])}° · sample ${sample+1}/${r.samples}`:'DC stationary')+` · ${surface.nodal?'nodal values averaged per cell':'cell-centered values'}`+(r.converged?'':' · UNCONVERGED');
}
for(const id of ['profileField','profileTime'])$(id).addEventListener('input',drawProfile);
$('excitationMode').addEventListener('change',modes);
$('exportProfile').onclick=()=>{if(result)return $('exportZip').onclick();};

function accept(r){TE.checkResult(r);result=r;$('profileTime').value='0';$('exportProfile').disabled=false;const periodic=r.method!=='steady';probe=Math.floor(r.config.ny/2)*(r.config.nx+1)+Math.floor(r.config.nx/2);$('harmonic').value='0';$('harmonic').disabled=!periodic;$('resultEmpty').hidden=true;
 const values=periodic?r.temperature.flat():r.temperature,lo=values.reduce((a,b)=>Math.min(a,b),Infinity),hi=values.reduce((a,b)=>Math.max(a,b),-Infinity),hs=periodic?r.harmonics.terminalVoltage:[{re:r.terminalVoltage,im:0}],v=hs[periodic?1:0];
 $('vLabel').textContent='TERMINAL VOLTAGE · '+(periodic?'1ω':'DC');$('vMetric').textContent=fmt((periodic?amp(v):v.re)*1000)+' mV';$('vPhase').textContent=periodic?phase(v).toFixed(3)+'° · peak amplitude':'Signed stationary voltage';$('tMetric').textContent=lo.toFixed(3)+'–'+hi.toFixed(3)+' K';$('cycleMetric').textContent=periodic?r.periods+' cycles':'DC';$('errorMetric').textContent=periodic?(r.converged?'Normalized error ':'Unconverged cycle · error ')+(r.periodicError===null?'not available':r.periodicError.toExponential(2))+(r.converged?' ≤ 1':''):'Energy residual '+r.energyResidual.toExponential(2)+' W';
 $('spectrum').innerHTML=hs.map((z,n)=>`<tr><td>${n?n+'ω':'DC'}</td><td>${n?fmt(n*r.frequency):'0'} Hz</td><td>${amp(z).toExponential(5)}</td><td>${amp(z)>1e-16?phase(z).toFixed(3)+'°':'—'}</td><td>${z.re.toExponential(5)}</td><td>${z.im.toExponential(5)}</td></tr>`).join('');$('exportResults').disabled=false;$('exportCsv').disabled=false;for(const id of ['exportMenuButton','exportPdf','exportZip'])$(id).disabled=false;$('exportStatus').textContent='';tab('results');}
function stopClock(){clearInterval(clock);clock=null;$('runProgress').hidden=true;$('elapsed').textContent=((performance.now()-started)/1000).toFixed(1)+' s';}
function retainResults(reason){if(activeSweep){finishSweep(reason);return;}if(checkpoint){accept(checkpoint);$('badge').textContent='STOPPED · UNCONVERGED';}else if(result){accept(result);$('badge').textContent='PREVIOUS RESULT';}else $('badge').textContent='STOPPED';$('status').textContent=reason+(checkpoint?' Showing the last complete cycle; harmonics are provisional.':result?' Previous results retained.':' No complete cycle is available yet.');}
function lock(value){document.querySelectorAll('.settings').forEach(e=>e.disabled=value);for(const id of ['preset','import','addMaterial','run'])$(id).disabled=value;$('cancel').hidden=!value;if(!value){modes();validateUI();}}
$('run').onclick=()=>{try{applyGeometry();TE.from2DConfig(config);palette();}catch(e){notice(e.message,true);return;}
 activeSweep=config.sweep?.enabled?{config:JSON.parse(JSON.stringify(config)),frequencies:TE.validateSweep(config),results:[],status:'running',index:0}:null;
 lock(true);$('exportProfile').disabled=true;$('exportResults').disabled=true;$('exportCsv').disabled=true;for(const id of ['exportMenuButton','exportPdf','exportZip','bodeCsv'])$(id).disabled=true;$('exportMenu').hidden=true;$('exportMenuButton').setAttribute('aria-expanded','false');$('badge').textContent='COMPUTING';$('badge').className='';$('status').textContent='Solving coupled 2D transport…';started=performance.now();checkpoint=null;$('elapsed').textContent='0.0 s';$('runProgress').hidden=false;$('runProgress').removeAttribute('value');clock=setInterval(()=>{$('elapsed').textContent=((performance.now()-started)/1000).toFixed(1)+' s';},100);
 const finishError=message=>{worker?.terminate();worker=null;stopClock();lock(false);retainResults(message);$('badge').textContent='ERROR';};
 try{const url=URL.createObjectURL(new Blob([$('workerSource').textContent],{type:'text/javascript'}));worker=new Worker(url);URL.revokeObjectURL(url);
  worker.onmessage=({data})=>{
   if(data.type==='sweepStart'){activeSweep.index=data.index;checkpoint=null;$('status').textContent=`Frequency ${data.index+1}/${data.total}: ${fmt(data.frequency)} Hz`;}
   else if(data.type==='progress'){const prefix=activeSweep?`Frequency ${data.index+1}/${data.total} · ${fmt(data.frequency)} Hz · `:'';$('status').textContent=prefix+`Cycle ${data.progress.cycle}/${data.progress.maxPeriods} · step ${data.progress.step}/${data.progress.samples}${data.progress.error===null?'':' · normalized error '+data.progress.error.toExponential(2)}`;
    $('runProgress').max=activeSweep?data.total:data.progress.maxPeriods;$('runProgress').value=activeSweep?data.index+(data.progress.cycle-1+data.progress.step/data.progress.samples)/data.progress.maxPeriods:data.progress.cycle-1+data.progress.step/data.progress.samples;$('runProgress').title='Completed frequencies plus current cycle budget; convergence can finish earlier.';}
   else if(data.type==='checkpoint'){try{TE.checkResult(data.result);checkpoint=data.result;}catch(e){finishError(e.message);}}
   else if(data.type==='sweepPoint'){try{TE.checkResult(data.result);}catch(e){finishError(e.message);return;}activeSweep.results.push(data.result);checkpoint=null;sweepResult=activeSweep;refreshSweepPoints();drawBode();}
   else if(data.type==='sweepDone'){worker.terminate();worker=null;stopClock();lock(false);finishSweep('Sweep completed.',true);}
   else if(data.type==='sweepError'||data.type==='error')finishError('Calculation failed: '+data.message);
   else if(data.type==='result'){worker.terminate();worker=null;stopClock();lock(false);sweepResult=null;$('bodeCard').hidden=true;accept(data.result);$('badge').textContent='CONVERGED';$('status').textContent='Computed successfully. Refine the mesh and time steps to check accuracy.';}
  };
  worker.onerror=e=>finishError('Worker error: '+e.message);worker.postMessage(config);
 }catch(e){finishError('Unable to start: '+e.message);}};
$('cancel').onclick=()=>{worker?.terminate();worker=null;stopClock();lock(false);retainResults('Stopped by user.');};
// Included inside app.js closure; uses immutable per-frequency results.
function bodeOptions(){return {quantity:$('bodeQuantity').value,harmonic:Number($('bodeHarmonic').value),reference:$('bodeReference').value,normalization:$('bodeNormalization').value,phaseFloor:Number($('bodeFloor').value),unwrap:$('bodeUnwrap').value==='unwrapped',x:Number($('bodeX').value)/100,y:Number($('bodeY').value)/100,scale:$('bodeScale').value,dbReference:Number($('bodeDb').value)};}
function refreshSweepPoints(){if(!sweepResult)return;const select=$('sweepPoint'),old=select.value;select.innerHTML=sweepResult.results.map((r,i)=>`<option value="${i}">${fmt(r.frequency)} Hz${r.converged?'':' · UNCONVERGED'}</option>`).join('');select.value=Number(old)<sweepResult.results.length?old:'0';if(select.selectedIndex<0)select.selectedIndex=0;select.disabled=Boolean(worker);$('bodeCard').hidden=false;}
function finishSweep(message,complete=false){
 const saved=activeSweep;if(!saved)return;
 if(checkpoint&&!complete)saved.results.push(checkpoint);
 checkpoint=null;activeSweep=null;saved.status=complete?'complete':'stopped';saved.message=message;
 if(saved.results.length){sweepResult=saved;refreshSweepPoints();$('sweepPoint').value=String(saved.results.length-1);accept(saved.results.at(-1));drawBode();}
 else if(result){accept(result);refreshSweepPoints();drawBode();}
 $('badge').textContent=complete?'SWEEP COMPLETE':'SWEEP STOPPED';$('status').textContent=message+` ${saved.results.filter(r=>r.converged).length}/${saved.frequencies.length} converged frequency points retained.`;
}
function selectSweepPoint(i){if(worker||!sweepResult?.results[i])return;$('sweepPoint').value=String(i);accept(sweepResult.results[i]);$('status').textContent=`Sweep map / report: ${fmt(result.frequency)} Hz · ${result.converged?'converged':'unconverged, excluded from Bode'}`;}
$('sweepPoint').onchange=()=>selectSweepPoint(Number($('sweepPoint').value));
function bodeSvg(rows,key,{log=true,db=false,dbReference=1}={}){
 const W=580,H=240,L=85,R=20,T=30,B=48,valid=rows.map(r=>key==='phase'?r.phase:r.magnitude===null?null:db?(r.magnitude>0?20*Math.log10(r.magnitude/dbReference):null):r.magnitude);
 const numbers=valid.filter(v=>v!==null&&Number.isFinite(v));
 const title=key==='phase'?'Phase · °':db?`Magnitude · dB re ${fmt(dbReference)} ${rows[0]?.unit??''}`:`Magnitude · ${rows[0]?.unit??''}`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><rect width="${W}" height="${H}" fill="#121c26"/><text x="${L}" y="16" fill="#c9dce7" font-size="11">${esc(title)}</text>`;
 if(!numbers.length)return svg+'<text x="85" y="100" fill="#b7cbd7" font-size="12">No valid values for this selection.</text></svg>';
 let lo=Math.min(...numbers),hi=Math.max(...numbers),pad=hi===lo?Math.max(Math.abs(lo)*.05,1e-12):(hi-lo)*.1;lo-=pad;hi+=pad;
 const fx=v=>log?Math.log10(v):v,start=fx(rows[0].frequency),end=fx(rows.at(-1).frequency),X=v=>L+(fx(v)-start)/(end-start||1)*(W-L-R),Y=v=>H-B-(v-lo)/(hi-lo)*(H-B-T);
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,f=start+(end-start)*i/4;svg+=`<path d="M${L} ${Y(v)}H${W-R}" stroke="#304552"/><text x="${L-7}" y="${Y(v)+3}" text-anchor="end" fill="#b7cbd7" font-size="10">${fmt(v)}</text><text x="${L+(W-L-R)*i/4}" y="${H-25}" text-anchor="middle" fill="#b7cbd7" font-size="10">${fmt(log?10**f:f)}</text>`;}
 let path='',pen=false;valid.forEach((v,i)=>{if(v===null||!Number.isFinite(v)){pen=false;return;}path+=(pen?'L':'M')+X(rows[i].frequency)+' '+Y(v)+' ';pen=true;});
 svg+=`<path d="${path}" fill="none" stroke="#73d8d0" stroke-width="2"/>`;
 valid.forEach((v,i)=>{if(v!==null&&Number.isFinite(v))svg+=`<circle data-bode-point="${i}" cx="${X(rows[i].frequency)}" cy="${Y(v)}" r="5" fill="#f0ad72" style="cursor:pointer"><title>${fmt(rows[i].frequency)} Hz · ${fmt(v)}</title></circle>`;});
 return svg+`<text x="${W-R}" y="${H-5}" text-anchor="end" fill="#b7cbd7" font-size="10">Excitation frequency · Hz${log?' · logarithmic axis':''}</text></svg>`;
}
function drawBode(){
 if(!sweepResult?.results.length)return;
 $('bodeCard').hidden=false;const rs=sweepResult.results,imp=$('bodeQuantity').value==='impedance';
 if(imp){$('bodeHarmonic').value='1';$('bodeNormalization').value='raw';}
 for(const id of ['bodeHarmonic','bodeReference','bodeNormalization'])$(id).disabled=imp;
 const spatial=!['terminalVoltage','current','impedance'].includes($('bodeQuantity').value);$('bodeX').disabled=!spatial;$('bodeY').disabled=!spatial;$('bodeDb').disabled=$('bodeScale').value!=='db';
 // Imposed inactive references are unavailable; measured zeros can vary with frequency.
 for(const option of $('bodeReference').options){const rows=TE.bodeRows(rs,{quantity:'terminalVoltage',reference:option.value});option.disabled=rows.every(r=>r.reason&&/reference|inactive|Open circuit/i.test(r.reason));}
 if(!imp&&$('bodeReference').selectedOptions[0]?.disabled){$('bodeReference').value='time';$('bodeNormalization').value='raw';}
 $('bodeNormalization').options[1].disabled=$('bodeReference').value==='time';$('bodeNormalization').options[2].disabled=$('bodeReference').value==='time';
 if($('bodeReference').value==='time')$('bodeNormalization').value='raw';
 $('sweepStatus').textContent=`${rs.filter(r=>r.converged).length}/${sweepResult.frequencies.length} converged · ${sweepResult.status}${worker?' · computation continues':''}.`;
 try{
  for(const id of ['bodeFloor','bodeX','bodeY'])TE.assert($(id).value.trim()!=='','Complete Bode numerical inputs.');
  const rows=TE.bodeRows(rs,bodeOptions()),db=$('bodeScale').value==='db',dbReference=Number($('bodeDb').value);TE.assert(!db||(Number.isFinite(dbReference)&&dbReference>0),'The dB reference must be strictly positive.');
  const opts={log:sweepResult.config.sweep.spacing==='log',db,dbReference};$('bodeMagnitude').innerHTML=bodeSvg(rows,'magnitude',opts);$('bodePhase').innerHTML=bodeSvg(rows,'phase',opts);
  const reasons=[...new Set(rows.map(r=>r.reason).filter(Boolean))];$('bodeNote').textContent=`${spatial?`Probe snaps to ${['temperature','voltage'].includes($('bodeQuantity').value)?'node':'cell'} ${rows[0].nodeOrCell}: x=${fmt(rows[0].x_m*1000)} mm, y=${fmt(rows[0].y_m*1000)} mm. `:''}${reasons.join(' ')} Phase threshold applies to raw output amplitude; tiny harmonics need convergence checks.`;
  $('bodeCsv').disabled=Boolean(worker);
 }catch(e){$('bodeNote').textContent=e.message;$('bodeMagnitude').textContent='';$('bodePhase').textContent='';$('bodeCsv').disabled=true;}
}
for(const id of ['bodeQuantity','bodeHarmonic','bodeReference','bodeNormalization','bodeScale','bodeDb','bodeX','bodeY','bodeFloor','bodeUnwrap'])$(id).addEventListener('input',drawBode);
for(const id of ['bodeMagnitude','bodePhase'])$(id).onclick=e=>{const node=e.target.closest('[data-bode-point]');if(node)selectSweepPoint(Number(node.dataset.bodePoint));};
$('bodeCsv').onclick=()=>{try{download('thermoelectric-bode.csv',TE.bodeCsv(TE.bodeRows(sweepResult.results,bodeOptions())),'text/csv');}catch(e){$('bodeNote').textContent=e.message;}};
function sweepReport(s,r,options=bodeOptions(),reportProbe=probe){
 TE.assert(options.scale!=='db'||(Number.isFinite(options.dbReference)&&options.dbReference>0),'The dB reference must be strictly positive.');
 const rows=TE.bodeRows(s.results,options),report=TE.resultReport(r,{probe:reportProbe}),opts={log:s.config.sweep.spacing==='log',db:options.scale==='db',dbReference:options.dbReference??1};
 const page=`<section class="page"><header>THERMOELECTRIC LAB · FREQUENCY SWEEP</header><h1>Bode summary</h1><p>${esc(s.status)} · ${s.results.filter(r=>r.converged).length}/${s.frequencies.length} converged points. Detailed report below: ${fmt(r.frequency)} Hz.</p><p>Quantity: ${esc(options.quantity)} · harmonic ${options.harmonic} · reference ${esc(options.reference)} · normalization ${esc(options.normalization)} · phase threshold ${options.phaseFloor}. Phase ${options.unwrap?'unwrapped':'wrapped'}.</p><p>Table magnitudes use physical units; graphs follow the selected scale. dB reference: ${fmt(options.dbReference??1)} in module units.</p><p>Probe X/Y: ${fmt(options.x*100)}% / ${fmt(options.y*100)}%. Impedance is (source − sink voltage) / current at 1ω. Other phases subtract n times the reference phase. Unconverged points are excluded.</p>${bodeSvg(rows,'magnitude',opts)}${bodeSvg(rows,'phase',opts)}<table><thead><tr><th>Hz</th><th>Module</th><th>Unit</th><th>Phase °</th><th>Status</th></tr></thead><tbody>${rows.map(v=>`<tr><td>${fmt(v.frequency)}</td><td>${v.magnitude===null?'—':fmt(v.magnitude)}</td><td>${esc(v.unit)}</td><td>${v.phase===null?'—':fmt(v.phase)}</td><td>${esc(v.reason||'Converged')}</td></tr>`).join('')}</tbody></table></section>`;
 report.html=report.html.replace('<section class="page">',page+'<section class="page">');return report;
}
async function sweepFiles(s,options,selected,selectedProbe){
 const rows=TE.bodeRows(s.results,options),report=sweepReport(s,selected,options,selectedProbe);
 const files=[{name:'sweep-model.json',data:JSON.stringify(s.config,null,2)},{name:'sweep-status.json',data:JSON.stringify({status:s.status,message:s.message,requestedFrequencies:s.frequencies,retainedFrequencies:s.results.map(r=>r.frequency),bodeOptions:options},null,2)},{name:'bode.csv',data:TE.bodeCsv(rows)},{name:'report.html',data:report.html}];
 for(let i=0;i<s.results.length;i++){
  const part=await TE.completeResultsFiles(s.results[i],{probe:selectedProbe});
  for(const file of part)files.push({name:`frequency-${String(i+1).padStart(3,'0')}/`+file.name,data:file.data});
 }
 files.push({name:'README.txt',data:'Frequency sweep results. Each frequency-NNN folder contains the complete model, all field histories, harmonics, CSV, SVG and printable report for that point. Root report.html contains the Bode summary and the selected frequency detailed report. bode.csv records physical magnitudes and the selected phase/normalization settings are in sweep-status.json. Only the last complete cycle per frequency is retained. Unconverged cycles are retained but excluded from Bode. Requested but uncomputed frequencies are recorded in sweep-status.json.\n'});return files;
}

function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>{try{download('thermoelectric-2d-model.json',JSON.stringify(applyGeometry(),null,2));}catch(e){notice(e.message,true);}};
$('exportMenuButton').onclick=()=>{const open=$('exportMenu').hidden;$('exportMenu').hidden=!open;$('exportMenuButton').setAttribute('aria-expanded',String(open));};
$('exportPdf').onclick=()=>{if(!result)return;const reportWindow=window.open('','_blank');if(!reportWindow){$('exportStatus').textContent='Allow pop-ups for this page, then try the PDF report again.';return;}try{const report=sweepResult?.results.includes(result)?sweepReport(sweepResult,result):TE.resultReport(result,{probe});reportWindow.opener=null;reportWindow.document.open();reportWindow.document.write(report.html);reportWindow.document.close();$('exportStatus').textContent='Full report opened. Click Save as PDF / Print and select Save as PDF.';}catch(e){reportWindow.close();$('exportStatus').textContent='Report export failed: '+e.message;}};
let exporting=false;
$('exportZip').onclick=async()=>{if(!result||exporting)return;exporting=true;const saved=result,savedProbe=probe,savedSweep=sweepResult?.results.includes(result)?{...sweepResult,results:[...sweepResult.results]}:null,savedOptions=bodeOptions();$('exportZip').disabled=true;$('exportStatus').textContent='Preparing complete results archive…';try{await new Promise(resolve=>setTimeout(resolve,0));const files=savedSweep?await sweepFiles(savedSweep,savedOptions,saved,savedProbe):await TE.completeResultsFiles(saved,{probe:savedProbe});const zip=await TE.zipFiles(files);download('thermoelectric-2d-complete-results.zip',zip,'application/zip');$('exportStatus').textContent='Complete archive downloaded: report, SVG figures, JSON and CSV data.';}catch(e){$('exportStatus').textContent='ZIP export failed: '+e.message;}finally{exporting=false;$('exportZip').disabled=$('exportMenuButton').disabled;}};
$('exportResults').onclick=()=>{if(result)download('thermoelectric-2d-results.json',JSON.stringify(sweepResult?.results.includes(result)?sweepResult:result));};
$('exportCsv').onclick=()=>{if(!result)return;const hs=result.method==='steady'?[{re:result.terminalVoltage,im:0}]:result.harmonics.terminalVoltage;download('thermoelectric-2d-spectrum.csv',['harmonic,frequency_Hz,peak_V,phase_deg,real_V,imag_V,converged,completed_cycles',...hs.map((z,n)=>[n,n*(result.frequency??0),amp(z),amp(z)>1e-16?phase(z):'',z.re,z.im,result.converged,result.periods??0].join(','))].join('\n'),'text/csv');};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{TE.assert(f.size<2e6,'Model JSON must be <2 MB.');const c=JSON.parse(await f.text());TE.from2DConfig(c);if(c.sweep?.enabled)TE.validateSweep(c);TE.assert(c.materials.every(m=>['rho','Cp','k','sigma','alpha'].every(k=>typeof m[k]==='number')),'The editor imports scalar reference laws only.');TE.assert([64,128,256,512,1024].includes(c.samples),'Unsupported GUI step count.');c.materials.forEach(m=>{if(!/^#[0-9a-f]{6}$/i.test(m.color))m.color='#73d8d0';});config=c;selected=0;fill();dirty();notice('Model imported. Run to compute its response.');}catch(e){notice('Import failed: '+e.message,true);}finally{$('file').value='';}};
$('preset').onchange=()=>{config=TE.default2D();selected=0;const p=$('preset').value;
 if(p==='ptwire'){config=TE.ptWire3omega();$('bodeQuantity').value='terminalVoltage';$('bodeHarmonic').value='3';$('bodeReference').value='drive';$('bodeNormalization').value='raw';}
 if(p==='spreading'){config.mode='steady';config.electrical.value={bias:.1,amplitude:0};config.electrical.sourceRange=[.25,.75];}
 if(['dc','joule','nonlinear','seebeck'].includes(p)){config.nx=12;config.ny=6;config.lx=.001;config.ly=.001;config.materials=[{name:p==='seebeck'?'Thermoelectric material':'Resistive material',rho:2000,Cp:500,k:2,sigma:1e5,beta:p==='nonlinear'?.01:0,alpha:p==='seebeck'?2e-4:0,alphaSlope:0,color:'#73d8d0'}];config.materialMap=Array(config.nx*config.ny).fill(0);config.thermal.right={kind:'temperature',value:{bias:p==='seebeck'?350:300,amplitude:0},h:0};config.electrical.value.amplitude=p==='nonlinear'?.2:1;if(p==='seebeck'){config.mode='steady';config.electrical.kind='open_circuit';}}
 if(p==='dc'){config.mode='steady';config.ny=1;config.materialMap=Array(config.nx).fill(0);config.electrical.value={bias:.2,amplitude:0,phase:0};}
 fill();dirty();};
document.querySelectorAll('.settings').forEach(e=>{e.addEventListener('input',event=>{if(event.target.type==='number'){delete event.target.dataset.rawNumber;delete event.target.dataset.displayNumber;}modes();dirty();meshPreview();validateUI();});e.addEventListener('change',()=>{modes();try{config=read();palette();drawGeometry();}catch{}dirty();meshPreview();validateUI();});});
// Normalize completed numeric edits, retaining the full raw number behind the display.
document.addEventListener('focusout',e=>{if(e.target.matches('input[type=number]')&&e.target.value.trim()!==''){try{TE.setNumberInput(e.target,TE.readNumberInput(e.target));meshPreview();validateUI();}catch{}}});
let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{drawGeometry();drawResults();drawProfile();drawBode();},120);});fill();globalThis.TE_APP_READY=true;
})();
