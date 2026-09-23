const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require('C:/Users/TuTu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'qa');fs.mkdirSync(qa,{recursive:true});
(async()=>{
 const env={...process.env,READING_QA:'1'};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:path.resolve(root,'../runtime/electron.exe'),args:[root],env,cwd:path.resolve(root,'../runtime')});
 app.process().stderr.on('data',b=>console.log('ELECTRON',b.toString()));
 const errors=[];app.on('window',p=>{p.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});});
 try{
  const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');console.log('PAGE',page.url());console.log(await page.locator('body').innerText());await page.screenshot({path:path.join(qa,'startup.png')});await page.locator('#quote').filter({hasText:'知道我不在的人'}).waitFor();
  await page.screenshot({path:path.join(qa,'calendar-short.png')});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);
  await page.locator('#like').click();assert.equal(await page.locator('#like').getAttribute('aria-pressed'),'true');
  await page.locator('#next').click();await page.locator('#next').click();
  await page.locator('#quote').filter({hasText:'听到某首曲子'}).waitFor();await page.screenshot({path:path.join(qa,'calendar-long.png')});
  const readerPromise=app.waitForEvent('window');await page.locator('#read').click();const reader=await readerPromise;
  await reader.waitForFunction(()=>window.readerProof?.quote==='memory');
  const proof=await reader.evaluate(()=>window.readerProof);assert.ok(proof.matchedText.startsWith('听到某首曲子'));assert.ok(proof.cfi.startsWith('epubcfi('));
  await reader.screenshot({path:path.join(qa,'reader.png')});
  await reader.locator('#font-up').click();await reader.locator('#next-page').click();await reader.locator('#previous-page').click();
  for(const q of JSON.parse(fs.readFileSync(path.join(root,'data/book.json'),'utf8')).quotes){
   await app.evaluate(({BrowserWindow},id)=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('你的夏天')).webContents.send('open-quote',id),q.id);
   await reader.waitForFunction(id=>window.readerProof?.quote===id,q.id);assert.equal(await reader.evaluate(()=>window.readerProof.matchedText),q.text);
  }
  await reader.locator('#return').click();await page.locator('#settings').click();
  await page.locator('#demo').click();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  await page.waitForTimeout(11000);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
  const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
  const result={pass:true,quotesMatched:11,alwaysOnTop:true,likes:true,readerNavigation:true,fontChange:true,demoReminder:true,bounds,errors};
  assert.equal(errors.length,0);fs.writeFileSync(path.join(qa,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
