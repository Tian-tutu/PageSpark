import { startReader } from './reader.js';
const $=id=>document.getElementById(id);
const fallback={likes:[],keep:true,reminders:false,times:['12:30','20:30']};
const api=window.reading||{call:async(action,value)=>{if(action==='state')return {...fallback,...JSON.parse(localStorage.getItem('reading')||'{}')};if(action==='settings'){Object.assign(fallback,value);localStorage.setItem('reading',JSON.stringify(fallback));return fallback;}if(action==='like'){fallback.likes=fallback.likes.includes(value)?fallback.likes.filter(x=>x!==value):[...fallback.likes,value];return fallback.likes;}},on:()=>{}};
let book,state,index=2,source='manual',idle,hover=false;
let library,scope=localStorage.getItem('reading-scope')||'all';
function chooseNext(){
 const available=scope==='all'?library.books:library.books.filter(b=>b.id===scope);
 const previous=book?.quotes[index]?.id;
 book=available[Math.floor(Math.random()*available.length)];
 const choices=book.quotes.map((q,i)=>i).filter(i=>book.quotes[i].id!==previous);
 index=choices[Math.floor(Math.random()*choices.length)];
}
function installPicker(){
 const footer=$('calendar').querySelector('footer');
 const bar=document.createElement('div');bar.className='book-bar';
 const trigger=document.createElement('button');trigger.id='book-picker';trigger.setAttribute('aria-label','选书');trigger.setAttribute('aria-haspopup','dialog');
 trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h6a4 4 0 0 1 3 1.5A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.5A4 4 0 0 0 9 19H3zM12 5.5v15"/></svg>';
 $('calendar').querySelector('.window-actions').prepend(trigger);
 const download=document.createElement('button');download.id='save-excerpt';download.textContent='书摘';download.title='保存为 PNG 图片';download.onclick=saveExcerpt;
 bar.append(download,$('next'));footer.after(bar);
 const panel=document.createElement('dialog');panel.id='book-dialog';panel.setAttribute('aria-label','推荐范围');
 const head=document.createElement('header');const title=document.createElement('h2');title.textContent='推荐范围';const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','关闭选书');close.onclick=()=>panel.close();head.append(title,close);panel.append(head);
 for(const item of [{id:'all',title:'所有书随机',type:'在 '+library.books.length+' 本书中随机推荐',author:''},...library.books]){
  const button=document.createElement('button');button.className='book-option';button.dataset.book=item.id;button.setAttribute('aria-pressed',String(scope===item.id));
  const name=document.createElement('span');name.textContent=item.title;const meta=document.createElement('small');meta.textContent=item.type+(item.author?' · '+item.author:'');button.append(name,meta);
  button.onclick=async()=>{scope=item.id;localStorage.setItem('reading-scope',scope);await api.call('settings',{scope});chooseNext();recolor();render();fitBookmark();panel.close();};panel.append(button);
 }
 document.body.append(panel);trigger.onclick=()=>{clearTimeout(idle);panel.showModal();};panel.addEventListener('close',()=>{trigger.focus();resetIdle();});
}
function updateBookLabels(){
 $('calendar').querySelector('.attribution > div').textContent='《'+book.title+'》';$('calendar').querySelector('.author').textContent=book.author;
 $('book-picker').title='选书 · '+(scope==='all'?'所有书随机':book.title);
 document.querySelectorAll('.book-option').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.book===scope)));
}
const palettes=['rose','lavender','moss'];
async function saveExcerpt(){
 const button=$('save-excerpt');if(!window.reading){alert('请在桌面版中保存书摘图片。');return;}
 button.disabled=true;button.textContent='保存中';clearTimeout(idle);
 try{const result=await api.call('save-excerpt',{quote:book.quotes[index].id,palette:document.body.dataset.palette,width:innerWidth,compact:$('calendar').classList.contains('compact'),day:$('day').textContent,month:$('month').textContent,weekday:$('weekday').textContent});if(result?.error)alert(result.error);}
 catch(e){console.error(e);alert('书摘保存失败，请重试。');}finally{button.disabled=false;button.textContent='书摘';resetIdle();}
}
let paletteIndex=-1;
function recolor(){paletteIndex=paletteIndex<0?Math.floor(Math.random()*palettes.length):(paletteIndex+1+Math.floor(Math.random()*(palettes.length-1)))%palettes.length;document.body.dataset.palette=palettes[paletteIndex];}
function fitBookmark(){
 const calendar=$('calendar'),passage=$('passage');
 calendar.classList.toggle('long',book.quotes[index].text.length>65);
 calendar.classList.remove('compact');passage.style.fontSize='';
 if(document.body.classList.contains('export-image')){calendar.classList.toggle('compact',new URLSearchParams(location.search).get('compact')==='1');return;}
 if(calendar.scrollHeight>innerHeight)calendar.classList.add('compact');
 // Keep the reference's type size. Longer passages may scroll, never shrink.
}
new ResizeObserver(()=>{if(book&&!$('calendar').hidden)fitBookmark();}).observe(document.documentElement);
document.fonts.ready.then(()=>{if(book&&!$('calendar').hidden)fitBookmark();});
function record(type){api.call('event',{type,quote:book.quotes[index].id,source});}
function date(){const d=new Date();$('day').textContent=d.getDate();$('month').textContent=d.toLocaleDateString('en-US',{month:'long'}).toUpperCase()+' '+d.getFullYear();$('weekday').textContent='星期'+['日','一','二','三','四','五','六'][d.getDay()];}
function resetIdle(){clearTimeout(idle);if(!state.keep&&!hover&&!$('preferences').open&&!$('book-dialog')?.open)idle=setTimeout(()=>api.call('hide'),45000);}
function render(){const q=book.quotes[index];$('quote').textContent=q.text;$('passage').classList.toggle('short',q.text.length<65);$('calendar').classList.toggle('long',q.text.length>125);$('counter').textContent=String(index+1).padStart(2,'0')+' / '+String(book.quotes.length).padStart(2,'0');$('like').setAttribute('aria-pressed',String(state.likes.includes(q.id)));$('like').textContent=state.likes.includes(q.id)?'已喜欢':'喜欢';date();resetIdle();record('display');}
function next(){chooseNext();recolor();render();fitBookmark();}
async function read(){record('open');if(window.reading)await api.call('open',book.quotes[index].id);else location.href='?mode=reader&quote='+book.quotes[index].id;}
async function settings(){state=await api.call('state');$('keep').checked=state.keep;$('reminders').checked=state.reminders;$('time1').value=state.times[0];$('time2').value=state.times[1];$('settings-status').textContent='';clearTimeout(idle);$('preferences').showModal();$('preferences-close').focus();}
async function saveSettings(){state=await api.call('settings',{keep:$('keep').checked,reminders:$('reminders').checked,times:[$('time1').value,$('time2').value]});resetIdle();}
try{
 library=await (await fetch('/data/library.json')).json();state=await api.call('state');
 scope=state.scope||scope;
 if(scope!=='all'&&!library.books.some(b=>b.id===scope))scope='all';
 if(new URLSearchParams(location.search).get('mode')==='reader'){
  const quoteId=new URLSearchParams(location.search).get('quote');book=library.books.find(b=>b.quotes.some(q=>q.id===quoteId))||library.books[0];
  $('calendar').hidden=true;$('reader').hidden=false;document.title='PageSpark · '+book.title;await startReader(book,api); 
 }else{
  chooseNext();installPicker();recolor();
  const params=new URLSearchParams(location.search);
  if(params.get('export')==='1'){
   const id=params.get('quote');book=library.books.find(b=>b.quotes.some(q=>q.id===id))||book;index=Math.max(0,book.quotes.findIndex(q=>q.id===id));
   if(palettes.includes(params.get('palette')))document.body.dataset.palette=params.get('palette');document.body.classList.add('export-image');
  }
  new MutationObserver(updateBookLabels).observe($('quote'),{childList:true});
  updateBookLabels();
  document.addEventListener('keydown',e=>{if($('book-dialog').open){if(e.key==='Escape'){e.preventDefault();$('book-dialog').close();}e.stopImmediatePropagation();}},true);
  render();
  if(params.get('export')==='1'){
   const fonts=await document.fonts.load('21px Huiwen');
   await document.fonts.ready;
   if(!fonts.length||fonts.some(font=>font.status!=='loaded'))throw Error('汇文字体未能加载');
   fitBookmark();document.body.dataset.exportReady='true';
  }
  $('next').onclick=()=>{source='manual';record('skip');next();};$('read').onclick=read;$('passage').onclick=read;
  $('like').onclick=async()=>{state.likes=await api.call('like',book.quotes[index].id);$('like').textContent=state.likes.includes(book.quotes[index].id)?'已喜欢':'喜欢';$('like').setAttribute('aria-pressed',String(state.likes.includes(book.quotes[index].id)));record('like_toggle');};
  $('close').onclick=()=>api.call('hide');$('settings').onclick=settings;
  $('preferences-close').onclick=()=>$('preferences').close();
  $('preferences').addEventListener('cancel',e=>{e.preventDefault();$('preferences').close();});
  for(const id of ['keep','reminders','time1','time2'])$(id).onchange=saveSettings;
  $('demo').onclick=()=>{$('preferences').close();api.call('demo');};$('pause').onclick=()=>{$('preferences').close();api.call('pause');};
  $('export').onclick=async()=>{$('settings-status').textContent=await api.call('export')?'使用记录已导出。':'未导出。';};
  $('calendar').addEventListener('mouseenter',()=>{hover=true;clearTimeout(idle);});$('calendar').addEventListener('mouseleave',()=>{hover=false;resetIdle();});
  $('preferences').addEventListener('close',()=>{$('settings').focus();resetIdle();});
  api.on('presented',presentation=>{source=presentation.source;if(presentation.next)next();else{date();resetIdle();record('display');}});
  document.addEventListener('keydown',e=>{if($('preferences').open){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();$('preferences').close();}return;}if(e.key==='ArrowRight'){source='manual';next();}if(e.key==='Escape')api.call('hide');});
 }
}catch(error){document.body.dataset.exportError=error.message;$('quote').textContent='书页暂时未能打开，请检查本地书籍文件。';console.error(error);}
