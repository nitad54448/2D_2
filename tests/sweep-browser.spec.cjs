// Optional real-browser check: node tests/sweep-browser.spec.cjs (requires Chromium).
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
 await page.waitForFunction(()=>globalThis.TE_APP_READY);
 await page.locator('#preset').selectOption('joule');await page.locator('#tab-geometry').click();await page.locator('#nx').fill('2');await page.locator('#ny').fill('1');await page.locator('#applyGrid').click();
 await page.locator('#tab-boundaries').click();await page.locator('#amplitude').fill('0.01');await page.locator('#excitationMode').selectOption('sweep');assert.ok(await page.locator('#sweepSettings').isVisible());
 await page.locator('#sweepMin').fill('1');await page.locator('#sweepMax').fill('2');await page.locator('#sweepPoints').fill('2');
 await page.locator('#sweepMax').fill('0');assert.ok(await page.locator('#run').isDisabled());await page.locator('#sweepMax').fill('2');
 await page.locator('#tab-solver').click();assert.ok(await page.locator('#singleFrequencyLabel').isHidden());assert.match(await page.locator('#solverMethod').textContent(),/sweep/);
 await page.locator('#samples').selectOption('64');await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#badge').textContent==='SWEEP COMPLETE',null,{timeout:60000});
 assert.equal(await page.locator('#sweepPoint option').count(),2);await page.locator('#bodeQuantity').selectOption('impedance');assert.ok(await page.locator('#bodeHarmonic').isDisabled());assert.equal(await page.locator('#bodeMagnitude circle').count(),2);
 await page.locator('#bodeScale').selectOption('db');await page.locator('#bodeDb').fill('1');assert.match(await page.locator('#bodeMagnitude').textContent(),/dB/);
 await page.locator('#sweepPoint').selectOption('0');assert.match(await page.locator('#status').textContent(),/1 Hz/);
 const download=page.waitForEvent('download');await page.locator('#bodeCsv').click();assert.match((await download).suggestedFilename(),/bode/);
 await page.locator('#exportMenuButton').click();const popup=page.waitForEvent('popup');await page.locator('#exportPdf').click();const report=await popup;await report.waitForLoadState();assert.ok((await report.content()).includes('Bode summary'));await report.close();
 const zip=page.waitForEvent('download');await page.locator('#exportZip').click();assert.match((await zip).suggestedFilename(),/zip$/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);console.log('Sweep browser checks passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
