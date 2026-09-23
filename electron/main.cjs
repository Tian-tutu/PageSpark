const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
let quoteWindow, readerWindow, tray, server, origin, demoTimer, quitting=false, locked=false;
let state;
const statePath=()=>path.join(app.getPath('userData'),'reading-state.json');
function save(){fs.writeFileSync(statePath(),JSON.stringify(state,null,2));}
function event(type,detail={}){state.events.push({type,time:new Date().toISOString(),...detail});state.events=state.events.slice(-5000);save();}
function options(){return {contextIsolation:true,nodeIntegration:false,sandbox:true,preload:path.join(__dirname,'preload.cjs')};}
function secure(win){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(origin+'/'))e.preventDefault();});}
function showQuote(next=false,source='manual') {
 if(quoteWindow.isDestroyed())return;
 quoteWindow.showInactive();
 quoteWindow.webContents.send('presented',{source,next});
}
function openReader(id){
 if(!readerWindow||readerWindow.isDestroyed()){
  readerWindow=new BrowserWindow({width:1100,height:850,minWidth:700,minHeight:560,backgroundColor:'#faf9f6',title:'PageSpark · 阅读',autoHideMenuBar:true,webPreferences:options()});
  secure(readerWindow);readerWindow.loadURL(origin+'/index.html?mode=reader&quote='+encodeURIComponent(id));
 }else{readerWindow.loadURL(origin+'/index.html?mode=reader&quote='+encodeURIComponent(id));readerWindow.show();}
 quoteWindow.hide();
}
function safeRect(){
 const area=screen.getPrimaryDisplay().workArea;
 const height=Math.min(790,area.height-32),width=Math.min(440,area.width-32);
 const saved=state.bounds;
 if(saved){const display=screen.getDisplayMatching(saved).workArea;return {width,height,x:Math.max(display.x,Math.min(saved.x,display.x+display.width-width)),y:Math.max(display.y,Math.min(saved.y,display.y+display.height-height))};}
 return {width,height,x:area.x+area.width-width-24,y:area.y+area.height-height-16};
}
function createServer(){return new Promise(resolve=>{
 server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  const map={'/':'src/index.html','/index.html':'src/index.html','/style.css':'src/style.css','/app.js':'src/app.js','/reader.js':'src/reader.js','/data/book.json':'data/book.json','/data/book.epub':'data/book.epub','/vendor/jszip.js':'node_modules/jszip/dist/jszip.min.js','/vendor/epub.js':'node_modules/epubjs/dist/epub.min.js'};
  map['/settings-fix.css']='src/settings-fix.css';
  map['/bookmark.css']='src/bookmark.css';
  map['/fonts/Huiwen.otf']='assets/fonts/Huiwen.otf';
  map['/data/library.json']='data/library.json';
  for(const id of ['summer','return','energy','body'])map['/data/library/'+id+'.epub']='data/library/'+id+'.epub';
  if(!map[pathname]){res.writeHead(404);return res.end();}
  const file=path.join(root,map[pathname]);
  const ext=path.extname(file);const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.epub':'application/epub+zip'};
  res.setHeader('Content-Type',mime[ext]||'application/octet-stream');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; frame-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'");
  fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
 });server.listen(0,'127.0.0.1',()=>{origin=`http://127.0.0.1:${server.address().port}`;resolve();});
});}
if(!process.env.READING_QA && !app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(async()=>{
 if(process.env.READING_QA)app.setPath('userData',path.join(root,'qa','profile'));
 try{state=JSON.parse(fs.readFileSync(statePath(),'utf8'));}catch{state={};}
 state={likes:[],events:[],reminders:false,keep:true,pauseUntil:0,times:['12:30','20:30'],...state};
 await createServer();
 quoteWindow=new BrowserWindow({...safeRect(),frame:false,resizable:true,minWidth:350,minHeight:540,alwaysOnTop:true,show:false,backgroundColor:'#faf9f6',title:'PageSpark · 今日书页',webPreferences:options()});
 secure(quoteWindow);await quoteWindow.loadURL(origin+'/index.html');
 quoteWindow.showInactive();
 quoteWindow.on('close',e=>{if(!quitting){e.preventDefault();quoteWindow.hide();}});
 quoteWindow.on('moved',()=>{state.bounds=quoteWindow.getBounds();save();});
 const pixels=Buffer.alloc(16*16*4);for(let y=2;y<14;y++)for(let x=3;x<13;x++){let i=(y*16+x)*4;pixels[i]=60;pixels[i+1]=48;pixels[i+2]=39;pixels[i+3]=255; if(x===7||y===5||y===9){pixels[i]=245;pixels[i+1]=241;pixels[i+2]=231;}}
 tray=new Tray(nativeImage.createFromBitmap(pixels,{width:16,height:16}));tray.setToolTip('PageSpark · 今日书页');
 tray.setContextMenu(Menu.buildFromTemplate([{label:'打开今日书页',click:()=>showQuote()},{label:'十秒后展示一页（演示）',click:()=>scheduleDemo()},{label:'暂停一小时',click:()=>{state.pauseUntil=Date.now()+3600000;save();quoteWindow.hide();}},{type:'separator'},{label:'退出 PageSpark',click:()=>app.quit()}]));
 tray.on('double-click',()=>showQuote());
 powerMonitor.on('lock-screen',()=>{locked=true;quoteWindow.hide();});powerMonitor.on('unlock-screen',()=>locked=false);
 app.on('second-instance',()=>showQuote());
 setInterval(()=>{
  const now=new Date(),day=now.toLocaleDateString('en-CA'),time=now.toTimeString().slice(0,5),key=day+' '+time;
  if(!state.reminders||locked||Date.now()<state.pauseUntil||readerWindow?.isFocused()||powerMonitor.getSystemIdleTime()>300)return;
  if(state.times.includes(time)&&state.lastReminder!==key){state.lastReminder=key;save();showQuote(true,'scheduled');}
 },15000);
});
function scheduleDemo(){clearTimeout(demoTimer);quoteWindow.hide();demoTimer=setTimeout(()=>{if(!locked)showQuote(true,'demo');},10000);return true;}
ipcMain.handle('reading',async(e,action,value)=>{
 if(!e.senderFrame.url.startsWith(origin+'/'))throw Error('Unknown sender');
 switch(action){
  case 'state':return state;
  case 'highlights-list':return (state.highlights||[]).filter(h=>h.bookId===value);
  case 'highlights-save':{
   if(!value||!['summer','return','energy','body'].includes(value.bookId)||typeof value.cfi!=='string'||!value.cfi.startsWith('epubcfi(')||value.cfi.length>4000||typeof value.text!=='string'||!value.text.trim()||value.text.length>10000)throw Error('划线内容无效');
   const marks=state.highlights||[];
   const old=marks.find(h=>h.bookId===value.bookId&&h.cfi===value.cfi);
   if(old)return old;
   const mark={id:require('node:crypto').randomUUID(),bookId:value.bookId,cfi:value.cfi,text:value.text,chapter:String(value.chapter||'').slice(0,500),createdAt:new Date().toISOString()};
   state.highlights=[...marks,mark];save();event('highlight_add',{bookId:mark.bookId,highlightId:mark.id});return mark;
  }
  case 'highlights-delete':{
   const mark=(state.highlights||[]).find(h=>h.id===value);
   if(mark){state.highlights=state.highlights.filter(h=>h.id!==value);save();event('highlight_remove',{bookId:mark.bookId,highlightId:mark.id});}return true;
  }
  case 'save-excerpt':{
   if(e.sender!==quoteWindow.webContents)return;
   const library=JSON.parse(fs.readFileSync(path.join(root,'data/library.json'),'utf8'));
   const selected=library.books.find(b=>b.quotes.some(q=>q.id===value?.quote));
   if(!selected||!['rose','lavender','moss'].includes(value.palette))return {error:'书摘信息无效。'};
   const result=await dialog.showSaveDialog(quoteWindow,{title:'保存书摘图片',defaultPath:selected.title+'-书摘.png',filters:[{name:'PNG 图片',extensions:['png']}]});
   if(result.canceled)return {canceled:true};
   let exportWindow;
   try{
    const width=Math.max(350,Math.min(900,Math.round(Number(value.width)||440)));
    exportWindow=new BrowserWindow({width,height:790,show:false,frame:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});secure(exportWindow);
    await exportWindow.loadURL(origin+'/index.html?export=1&quote='+encodeURIComponent(value.quote)+'&palette='+value.palette+'&compact='+(value.compact?'1':'0'));
    await exportWindow.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{observer.disconnect();reject(new Error('书摘或字体加载超时'));},20000);
     const check=()=>{if(document.body.dataset.exportError||document.body.dataset.exportReady){clearTimeout(timer);observer.disconnect();document.body.dataset.exportError?reject(new Error(document.body.dataset.exportError)):resolve();}};
     const observer=new MutationObserver(check);observer.observe(document.body,{attributes:true});check();
    })`);
    await exportWindow.webContents.executeJavaScript(`document.getElementById('day').textContent=${JSON.stringify(String(value.day).slice(0,2))};document.getElementById('month').textContent=${JSON.stringify(String(value.month).slice(0,40))};document.getElementById('weekday').textContent=${JSON.stringify(String(value.weekday).slice(0,8))};`);
    const height=await exportWindow.webContents.executeJavaScript('Math.ceil(document.getElementById("calendar").scrollHeight)');
    if(height>6000)throw Error('书摘图片过长');
    exportWindow.setContentSize(width,Math.max(790,height));
    await exportWindow.webContents.executeJavaScript('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const picture=await exportWindow.webContents.capturePage({x:0,y:0,width,height});await fs.promises.writeFile(result.filePath,picture.toPNG());return {saved:true};
   }catch(error){return {error:'图片保存失败：'+error.message};}finally{exportWindow?.destroy();}
  }
  case 'like':if(typeof value!=='string')return;state.likes=state.likes.includes(value)?state.likes.filter(x=>x!==value):[...state.likes,value];save();return state.likes;
  case 'event':if(value&&typeof value.type==='string')event(value.type,{quote:value.quote,source:value.source});return;
  case 'open':if(typeof value==='string')openReader(value);return;
  case 'hide':quoteWindow.hide();return;
  case 'show':showQuote();return;
  case 'demo':return scheduleDemo();
  case 'settings':{
   if(['all','summer','return','energy','body'].includes(value.scope))state.scope=value.scope;
   if(typeof value.keep==='boolean')state.keep=value.keep;
   if(typeof value.reminders==='boolean')state.reminders=value.reminders;
   if(Array.isArray(value.times)&&value.times.length===2&&value.times.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))state.times=value.times;
   save();return state;
  }
  case 'pause':state.pauseUntil=Date.now()+3600000;save();quoteWindow.hide();return;
  case 'export':{
   const result=await dialog.showSaveDialog({title:'导出本地使用记录',defaultPath:'reading-events.json',filters:[{name:'JSON',extensions:['json']}]});
   if(!result.canceled){fs.writeFileSync(result.filePath,JSON.stringify({events:state.events,likes:state.likes,highlights:state.highlights||[]},null,2));return true;}return false;
  }
 }
});
app.on('before-quit',()=>{quitting=true;clearTimeout(demoTimer);server?.close();});
app.on('window-all-closed',()=>{});
