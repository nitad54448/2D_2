'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const {TE,model,periodic,near}=require('./helpers.cjs');

test('Phase maps mask weak fields and vector cancellation after nodal averaging',()=>{
 const r=TE.run2D(periodic());r.harmonics.temperature[1]=r.temperature[0].map(()=>({re:0,im:0}));
 assert.equal(TE.phaseMap(r,'temperature',1).masked,r.config.nx*r.config.ny);
 r.harmonics.voltage[1]=r.voltage[0].map((_,i)=>({re:i%2?1:-1,im:0}));
 assert.equal(TE.phaseMap(r,'voltage',1).masked,r.config.nx*r.config.ny);
 r.harmonics.Jx[1]=r.Jx[0].map((_,i)=>({re:i===0?1:i===1?1e-7:0,im:0}));
 const map=TE.phaseMap(r,'Jx',1);near(map.threshold,1e-6);assert.equal(map.values[0],0);assert.equal(map.values[1],null);
});
test('Report phase figures share masking, diagnostics and finite SVG geometry',()=>{
 const r=TE.run2D(periodic()),report=TE.resultReport(r,{createdAt:'2026-09-27T00:00:00Z'});
 const figure=report.figures.find(f=>f.name==='figures/Jy-1-phase.svg');assert(figure.data.includes('#56616d'));assert(figure.data.includes('Gray: amplitude'));
 assert(report.html.includes('Terminal harmonic error'));assert(!/NaN|Infinity/.test(report.html));
});
test('Complete exports preserve JSON arrays, SI histories and valid ZIP CRCs',async()=>{
 const r=TE.run2D(periodic()),files=await TE.completeResultsFiles(r),blob=await TE.zipFiles(files),zip=Buffer.from(await blob.arrayBuffer());
 const result=JSON.parse(files.find(f=>f.name==='results.json').data);assert.deepEqual(result,r);
 const crcTable=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0});
 let offset=0,count=0;
 while(zip.readUInt32LE(offset)===0x04034b50){const expected=zip.readUInt32LE(offset+14),size=zip.readUInt32LE(offset+18),nameSize=zip.readUInt16LE(offset+26),extra=zip.readUInt16LE(offset+28),start=offset+30+nameSize+extra;let crc=0xffffffff;for(const byte of zip.subarray(start,start+size))crc=crcTable[(crc^byte)&255]^(crc>>>8);assert.equal((crc^0xffffffff)>>>0,expected);count++;offset=start+size}
 assert.equal(count,files.length);assert.equal(zip.readUInt32LE(offset),0x02014b50);
 const csv=await files.find(f=>f.name==='histories/temperature.csv').data.text();assert(csv.startsWith('sample,time_in_cycle_s,node,value_K'));
});
test('Source manifest references existing classic scripts and contains no embedded solver copy',()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(!html.includes('id="workerSource"'));assert(!html.includes('class Solver2D'));
 for(const [,src] of html.matchAll(/<script src="([^"]+)"/g))assert(fs.existsSync(path.join(root,src)),src);
 assert(TE.workerSource().includes('class Solver2D'));assert(!TE.workerSource().includes('importScripts'));
});
