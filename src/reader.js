export async function startReader(data,api){
 const $=id=>document.getElementById(id);
 document.body.classList.add('reading-mode');
 $('chapter-label').textContent=data.title;
 $('toc-toggle').setAttribute('aria-controls','toc');
 $('location-label').textContent=data.title+' · '+data.author;
 const status=$('reader-status');let font=Number(localStorage.getItem('reading-font')||20),currentId=null,highlight=null,queue=Promise.resolve(),active=0,lastInput=Date.now(),sent=false;
 const book=window.ePub(data.epub||'/data/book.epub');
 await book.ready;
 const navigation=await book.loaded.navigation;
 const entries=[],buttons=new Map();
 const numeral=s=>{if(/^\d+$/.test(s))return Number(s);let total=0,current=0;const digits='零一二三四五六七八九';for(const ch of s){if('十百千'.includes(ch)){total+=(current||1)*({十:10,百:100,千:1000}[ch]);current=0;}else current=ch==='两'?2:digits.indexOf(ch);}return total+current;};
 function label(raw){return raw.replace(/\s+/g,' ').trim().replace(/^第\s*([\d零一二三四五六七八九十百千两]+)\s*(章|部分)\s*[:：]?\s*/,(_,n,kind)=>'第 '+numeral(n)+' '+kind+'：');}
 const pathOf=href=>{try{return decodeURIComponent(new URL(href,'https://book.local/').pathname);}catch{return href.split('#')[0];}};
 const tree=navigation.toc?.length?navigation.toc:(data.chapters||[]).map(c=>({label:c.title,href:c.href}));
 let pinnedTarget=null,opening=false,lastSize='',resizeFrame;
 function releaseTarget(){pinnedTarget=null;}
 const spineIndex=href=>book.spine.get(href.split('#')[0])?.index;
 function chapterFor(href){
  const index=spineIndex(href);
  const exact=entries.filter(e=>pathOf(e.href)===pathOf(href));
  if(exact.length)return exact.find(e=>!e.href.includes('#'))||exact[0];
  // EPUB chapters may span multiple spine files without extra TOC entries.
  return entries.filter(e=>spineIndex(e.href)!==undefined&&spineIndex(e.href)<=index).sort((a,b)=>spineIndex(b.href)-spineIndex(a.href))[0];
 }
 function build(items,parent){
  for(const item of items){
   const entry={href:item.href,title:label(item.label||''),children:item.subitems||[]};entries.push(entry);
   let host=parent;
   if(entry.children.length){const group=document.createElement('details');group.open=true;const summary=document.createElement('summary');summary.setAttribute('aria-label','展开或收起 '+entry.title);group.append(summary);parent.append(group);host=summary;entry.group=group;}
   const button=document.createElement('button');button.className='toc-entry';button.title=entry.title;button.setAttribute('aria-label',entry.title);
   const chapter=entry.title.match(/^第 (\d+) 章：(.*)$/);
   const part=entry.title.match(/^第 (\d+) 部分：(.*)$/);
   if(chapter){const number=document.createElement('span');number.className='toc-number';number.textContent=chapter[1].padStart(2,'0');button.append(number);}
   const text=document.createElement('span');text.className='toc-title';
   const textValue=chapter?chapter[2]:part?'第 '+part[1]+' 部分':entry.title;
   const [main,...sub]=textValue.split(/\s*[|｜]\s*/);text.textContent=main;
   if(part||sub.length){const small=document.createElement('small');small.textContent=part?part[2]:sub.join(' | ');text.append(small);}
   button.append(text);
   button.onclick=async e=>{e.preventDefault();try{releaseTarget();if(innerWidth<850)setToc(false);await settledLayout();await rendition.display(entry.href);select(entry);}catch(error){status.hidden=false;status.textContent='这一章节暂时无法打开。';}};
   host.append(button);buttons.set(entry,button);
   if(entry.children.length){const children=document.createElement('div');children.className='toc-children';entry.group.append(children);build(entry.children,children);}
  }
 }
 function select(entry){if(!entry)return;$('chapter-label').textContent=entry.title;const changed=buttons.get(entry)?.getAttribute('aria-current')!=='location';for(const [e,b] of buttons){if(e===entry)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');}let parent=buttons.get(entry)?.parentElement;while(parent&&parent!==$('toc')){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}if(changed)buttons.get(entry)?.scrollIntoView({block:'nearest'});}
 function setToc(open){$('toc').hidden=!open;$('toc-toggle').setAttribute('aria-expanded',String(open));}
 const rendition=book.renderTo('viewer',{width:'100%',height:'100%',spread:'none',flow:'paginated',allowScriptedContent:false});
 rendition.themes.default({
  'html':{'background':'#202123 !important','color':'#dedee2 !important'},
  'body':{'font-family':'"Songti SC","SimSun",serif !important','color':'#dedee2 !important','background':'#202123 !important','line-height':'1.95 !important'},
  'p':{'line-height':'1.95 !important','margin-top':'0 !important','margin-bottom':'1em !important','color':'inherit !important','font-size':'1em !important'},
  'h1,h2,h3':{'color':'#f1eef2 !important','line-height':'1.5 !important','margin':'1em 0 !important'},
  'h1':{'font-size':'1.6em !important'},'h2':{'font-size':'1.35em !important'},'h3':{'font-size':'1.15em !important'},
  'a':{'color':'#efabd8 !important'},'img,svg':{'max-width':'100% !important'},'table':{'max-width':'100% !important'},'li':{'line-height':'1.9 !important'}
 });
 rendition.themes.fontSize(font+'px');
 // User underlines are separate from the recommendation's temporary highlight.
 let marks=[],pending=null;
 async function markCall(action,value){
  if(window.reading)return api.call(action,value);
  const key='reading-highlights',all=JSON.parse(localStorage.getItem(key)||'[]');
  if(action==='highlights-list')return all.filter(h=>h.bookId===value);
  if(action==='highlights-delete'){localStorage.setItem(key,JSON.stringify(all.filter(h=>h.id!==value)));return true;}
  const old=all.find(h=>h.bookId===value.bookId&&h.cfi===value.cfi);if(old)return old;
  const mark={...value,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
  localStorage.setItem(key,JSON.stringify([...all,mark]));return mark;
 }
 const markBar=document.createElement('div');markBar.className='mark-toolbar';markBar.hidden=true;
 const markSave=document.createElement('button');markSave.textContent='划线';
 const markCancel=document.createElement('button');markCancel.textContent='取消';
 const markMessage=document.createElement('span');markMessage.setAttribute('role','status');
 markBar.append(markSave,markCancel,markMessage);$('reader').append(markBar);
 const marksButton=document.createElement('button');marksButton.textContent='我的划线';marksButton.title='查看本书划线';marksButton.setAttribute('aria-haspopup','dialog');
 $('font-down').before(marksButton);
 const marksDialog=document.createElement('dialog');marksDialog.className='marks-dialog';marksDialog.setAttribute('aria-label','我的划线');
 const marksHeader=document.createElement('header');const marksTitle=document.createElement('h2');marksTitle.textContent='我的划线';
 const marksClose=document.createElement('button');marksClose.textContent='关闭';marksClose.onclick=()=>marksDialog.close();
 marksHeader.append(marksTitle,marksClose);const marksList=document.createElement('div');marksDialog.append(marksHeader,marksList);document.body.append(marksDialog);
 const highlightStyle={fill:'#efabd8','fill-opacity':'0.17',stroke:'none'};
 function paintMark(mark){rendition.annotations.remove(mark.cfi,'highlight');rendition.annotations.highlight(mark.cfi,{id:mark.id},()=>{renderMarks();if(!marksDialog.open)marksDialog.showModal();},'user-highlight',highlightStyle);}
 function renderMarks(){
  marksList.replaceChildren();if(!marks.length){marksList.textContent='选中原文中的文字，再点“划线”，就能留在这里。';return;}
  for(const mark of marks){const row=document.createElement('article');const text=document.createElement('p');text.textContent=mark.text;const meta=document.createElement('small');meta.textContent=mark.chapter;
   const jump=document.createElement('button');jump.textContent='回到原文';jump.onclick=async()=>{marksDialog.close();pinnedTarget=mark.cfi;await settledLayout();await rendition.display(mark.cfi);await alignPinned();};
   const remove=document.createElement('button');remove.textContent='取消划线';remove.onclick=async()=>{try{await markCall('highlights-delete',mark.id);rendition.annotations.remove(mark.cfi,'highlight');if(mark.cfi===highlight)rendition.annotations.highlight(highlight,{},null,'reading-highlight',highlightStyle);marks=marks.filter(h=>h.id!==mark.id);renderMarks();}catch(error){remove.textContent='删除失败，请重试';}};
   row.append(text,meta,jump,remove);marksList.append(row);
  }
 }
 marksButton.onclick=()=>{renderMarks();marksDialog.showModal();};
 markCancel.onclick=()=>{pending=null;markBar.hidden=true;};
 let selectedContents=null,hideMarkTimer;
 rendition.on('selected',(cfi,contents)=>{
  const text=contents.range(cfi).toString();if(!text.trim())return;
  clearTimeout(hideMarkTimer);selectedContents=contents;
  pending={bookId:data.id,cfi,text,chapter:$('chapter-label').textContent};markMessage.textContent='';markSave.textContent=marks.some(m=>m.cfi===cfi)?'已划线':'划线';markBar.hidden=false;
  const frame=contents.document.defaultView.frameElement,offset=frame.getBoundingClientRect();
  const viewport=$('viewer').getBoundingClientRect();
  const rects=[...contents.range(cfi).getClientRects()].filter(r=>offset.left+r.right>viewport.left&&offset.left+r.left<viewport.right&&offset.top+r.bottom>viewport.top&&offset.top+r.top<viewport.bottom);
  const rect=rects[rects.length-1]||contents.range(cfi).getBoundingClientRect();
  const width=markBar.offsetWidth,height=markBar.offsetHeight;
  markBar.style.left=Math.max(viewport.left+12,Math.min(viewport.right-width-12,offset.left+rect.right-width))+'px';
  const below=offset.top+rect.bottom+10;
  markBar.style.top=Math.max(70,Math.min(innerHeight-height-60,below+height<innerHeight-60?below:offset.top+rect.top-height-10))+'px';
 });
 markSave.onclick=async()=>{
  if(!pending)return;const selected=pending;markSave.disabled=true;
  try{if(selected.text.length>10000)throw Error('请分段划线，每次不超过一万字');
   const mark=await markCall('highlights-save',selected);
   if(!marks.some(m=>m.id===mark.id)){marks.push(mark);paintMark(mark);}
   selectedContents?.window?.getSelection()?.removeAllRanges();
   markMessage.textContent='已保存';markSave.textContent='已划线';hideMarkTimer=setTimeout(()=>{markBar.hidden=true;},900);
  }catch(error){markMessage.textContent=error.message||'保存失败，请重试';}finally{markSave.disabled=false;}
 };
 rendition.on('relocated',()=>{markBar.hidden=true;pending=null;});
 try{marks=await markCall('highlights-list',data.id);for(const mark of marks)paintMark(mark);}catch(error){console.warn('读取划线失败',error);}
 function syncSize(){const el=$('viewer'),width=Math.floor(el.clientWidth),height=Math.floor(el.clientHeight),key=width+':'+height;if(!rendition.manager?.stage||width<1||height<1||key===lastSize)return;lastSize=key;rendition.resize(width,height,pinnedTarget||undefined);}
 async function settledLayout(){await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));syncSize();await rendition.q.enqueue(()=>{});}
 // Align to the first glyph, never to a multi-column range's bounding box.
 async function alignPinned(){
  const target=pinnedTarget;if(!target)return;
  await rendition.q.enqueue(()=>{});
  const index=new window.ePub.CFI(target).spinePos;
  const contents=rendition.getContents().find(c=>c.sectionIndex===index);if(!contents)return;
  await contents.document.fonts.ready;
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(pinnedTarget!==target)return;
  const range=contents.range(target),rect=[...range.getClientRects()].find(r=>r.width>0&&r.height>0);
  if(rect){rendition.manager.moveTo({left:rect.left,top:0},contents.document.defaultView.frameElement.clientWidth);rendition.reportLocation();}
 }
 rendition.on('resized',()=>queueMicrotask(async()=>{
  const target=pinnedTarget;if(!target||opening)return;
  try{await rendition.display(target);await alignPinned();}catch(error){console.warn('重排后定位失败',error);}
 }));
 const resize=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{if(!opening)syncSize();});});resize.observe($('viewer'));
 function getRange(doc,needle){
  const walker=doc.createTreeWalker(doc.body||doc.documentElement,NodeFilter.SHOW_TEXT);const nodes=[];let text='',node;
  while(node=walker.nextNode()){nodes.push({node,start:text.length});text+=node.textContent;}
  const a=text.indexOf(needle);if(a<0)throw Error('原文位置无法匹配');
  const b=a+needle.length;const first=nodes.find(x=>x.start+x.node.length>a);const last=nodes.find(x=>x.start+x.node.length>=b);
  const range=doc.createRange();range.setStart(first.node,a-first.start);range.setEnd(last.node,b-last.start);return range;
 }
 async function open(id){
  const q=data.quotes.find(q=>q.id===id)||data.quotes[0];currentId=q.id;active=0;sent=false;lastInput=Date.now();delete $('viewer').dataset.quoteId;status.hidden=false;status.className='';status.textContent='正在翻到这一段…';
  try{
   const section=book.spine.get(q.href);if(!section)throw Error('章节未找到');
   await section.load(book.load.bind(book));const range=getRange(section.document,q.text);const cfi=section.cfiFromRange(range);
   opening=true;pinnedTarget=cfi;
   if(highlight&&!marks.some(m=>m.cfi===highlight))rendition.annotations.remove(highlight,'highlight');
   await settledLayout();await rendition.display(cfi);
   for(const contents of rendition.getContents())await contents.document.fonts.ready;
   await settledLayout();await rendition.display(cfi);await alignPinned();highlight=cfi;
   if(!marks.some(m=>m.cfi===cfi))rendition.annotations.highlight(cfi,{},null,'reading-highlight',highlightStyle);
   select(chapterFor(q.href));status.hidden=true;
   window.readerProof={quote:q.id,matchedText:range.toString(),cfi};$('viewer').dataset.quoteId=q.id;$('viewer').dataset.matchedText=range.toString();$('viewer').dataset.cfi=cfi;
   await api.call('event',{type:'reader_open',quote:q.id});
  }catch(e){console.error(e);status.className='error';status.textContent='未能精确定位，已打开篇目。';await rendition.display(q.href).catch(()=>{status.textContent='书籍未能打开，请重新启动。';});}finally{opening=false;}
 }
 function enqueue(id){queue=queue.then(()=>open(id));return queue;}
 const heading=document.createElement('h2');heading.textContent='目录';$('toc').append(heading);
 const front=tree.filter(i=>/^(封面|版权|标题页|献辞|内容$|目录$|赞美)/.test((i.label||'').trim()));
 if(front.length){const group=document.createElement('details');const summary=document.createElement('summary');summary.textContent='前言与其他';group.append(summary);$('toc').append(group);build(front,group);}
 build(tree.filter(i=>!front.includes(i)),$('toc'));
 setToc(innerWidth>=850);
 $('toc-toggle').onclick=()=>setToc($('toc').hidden);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){setToc(false);$('toc-toggle').focus();}});
 $('return').onclick=()=>{if(window.reading){api.call('show');window.close();}else location.href='/';};
 $('previous-page').onclick=()=>{releaseTarget();rendition.prev();};$('next-page').onclick=()=>{releaseTarget();rendition.next();};
 function size(change){font=Math.max(16,Math.min(30,font+change));rendition.themes.fontSize(font+'px');localStorage.setItem('reading-font',font);$('font-down').disabled=font===16;$('font-up').disabled=font===30;}
 $('font-down').onclick=()=>size(-2);$('font-up').onclick=()=>size(2);
 let relocation=0;
 rendition.on('relocated',async location=>{
  const token=++relocation;localStorage.setItem('reading-position-'+data.id,location.start.cfi);
  const matches=entries.filter(e=>pathOf(e.href)===pathOf(location.start.href));
  let current=chapterFor(location.start.href);
  const section=book.spine.get(location.start.href);
  if(section&&matches.some(e=>e.href.includes('#'))){
   try{await section.load(book.load.bind(book));const compare=new window.ePub.CFI();
    for(const entry of matches){const fragment=entry.href.split('#')[1];if(!fragment)continue;
     const target=section.document.getElementById(decodeURIComponent(fragment));if(!target)continue;
     const range=section.document.createRange();range.selectNodeContents(target);range.collapse(true);
     if(compare.compare(section.cfiFromRange(range),location.start.cfi)<=0)current=entry;
    }
   }catch(error){console.warn('章节锚点同步失败',error);}
  }
  if(token===relocation)select(current);
 });
 api.on('open-quote',enqueue);
 await enqueue(new URLSearchParams(location.search).get('quote'));
 const touch=()=>lastInput=Date.now();document.addEventListener('pointerdown',touch);document.addEventListener('keydown',touch);rendition.on('click',touch);rendition.on('keyup',touch);
 setInterval(()=>{if(document.hasFocus()&&!document.hidden&&Date.now()-lastInput<120000){active+=1;if(active>=120&&!sent){sent=true;api.call('event',{type:'reading_2min',quote:currentId});}}},1000);
}
