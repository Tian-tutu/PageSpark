const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const root = path.resolve(__dirname, '../..');
const definitions = [
 ['summer', '现在我依然相信树木喷出的植物防御物质', '露骨却又新鲜。'],
 ['melancholy', '我总是陷入莫名其妙的忧郁。', '甚至期待有人了解这种忧郁。'],
 ['absence', '后来有人问我爱情是什么的时候', '知道我不在的人”。'],
 ['light', '柔和的淡绿色的风景和阳光射入玻璃窗。', '一颗一颗渗透进来。'],
 ['memory', '听到某首曲子', '这东西似乎永远跟随着事物。'],
 ['spring', '那是以樱花做背景', '我站在春天中间。'],
 ['warmth', '那时带给我安慰的是触手可及的某人的体温', '他也是这样。'],
 ['back', '姐姐和我，经常在这里背对背度过漫漫长夜。', '因为我们两个人都是除了梦想，还要背负着很多东西。'],
 ['tree', '我们默默地凝视窗外。', '正在风中神圣而美丽地摇曳。'],
 ['years', '这期间，姐姐也度过了无法用几行文字概括的岁月吧？', '说出来也只能独自承受的秘密和心事。'],
 ['city', '这种时候，感觉房间不是某个空间或场所', '漂亮的首尔，我在这里。']
];
(async () => {
 const names = fs.readdirSync(root).filter(n => n.endsWith('.epub'));
 if (names.length !== 1) throw Error('请在 reading 根目录保留一本测试 EPUB。');
 const bytes = fs.readFileSync(path.join(root, names[0]));
 const zip = await JSZip.loadAsync(bytes);
 const parser = new DOMParser();
 const ncx = parser.parseFromString(await zip.file('OEBPS/toc.ncx').async('string'), 'application/xml');
 const chapters = [];
 for (const nav of Array.from(ncx.getElementsByTagName('navPoint'))) {
  const href = nav.getElementsByTagName('content')[0].getAttribute('src').split('#')[0];
  if (!/^text000(0[5-9]|1[0-2])\.html$/.test(href)) continue;
  const doc = parser.parseFromString(await zip.file('OEBPS/'+href).async('string'), 'application/xhtml+xml');
  chapters.push({href, title: nav.getElementsByTagName('text')[0].textContent, paragraphs: Array.from(doc.getElementsByTagName('p')).map(p=>p.textContent)});
 }
 const quotes = definitions.map(([id,start,end]) => {
  for (const chapter of chapters) for (let index=0;index<chapter.paragraphs.length;index++) {
   const text = chapter.paragraphs[index]; const a=text.indexOf(start); const b=text.indexOf(end,a);
   if(a>=0 && b>=a) return {id,text:text.slice(a,b+end.length),href:chapter.href,chapter:chapter.title,paragraph:index};
  }
  throw Error('无法精确匹配原文：'+id);
 });
 const data = path.resolve(__dirname,'../data'); fs.mkdirSync(data,{recursive:true});
 fs.writeFileSync(path.join(data,'book.epub'), bytes);
 fs.writeFileSync(path.join(data,'book.json'),JSON.stringify({title:'你的夏天还好吗？',author:'金爱烂',translator:'薛舟',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),chapters:chapters.map(({href,title})=>({href,title})),quotes},null,2));
 console.log(`准备完成：${chapters.length} 篇小说，${quotes.length} 条逐字匹配的原文。`);
})().catch(e=>{console.error(e);process.exitCode=1});
