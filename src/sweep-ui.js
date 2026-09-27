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
