const fs=require('node:fs'),path=require('node:path'),Zip=require('jszip');
const root=path.resolve(__dirname,'..');
const definitions=[
 ['summer','你的夏天','你的夏天还好吗？','金爱烂','小说',[
 ['人生很难遇到真正有共同语言的人。','曾让我深深依赖。'],['前辈说喜欢我的文笔。','第一次让我请他喝酒。'],['显示器上缓缓闪过人们的身影。','我站在春天中间。'],['前辈也知道吗？','我心里真想连那个女人也一起爱。'],['听到某首曲子','这东西似乎永远跟随着事物。']]],
 ['return','回归','回归故里','迪迪埃·埃里蓬','社会纪实',[
 ['我可以重新找回这片','否认的那部分自己和解。'],['当读过安妮·埃尔诺','这种抽离感都会伴随我们。'],['她一辈子渴望的','这一理想也难以实现。'],['如同鲍德温对于父亲的思考','难以与他人形成良好的交往。'],['我们住在同一座城市','并没有对我来说重要。']]],
 ['energy','好能量','好能量','凯西·米恩斯','健康科普',[
 ['食物是来自外部世界的信息','或执行其他工作的机器。'],['你可能听过“线粒体”这个词','所需的能量。'],['让我们从细胞的角度思考食物是什么','完成它们的工作。'],['细胞信号传导：','以允许葡萄糖流入。'],['为了从有意识的无能转变为有意识的能干','这些习惯是如何可能的。']]],
 ['body','身体由我','身体由我','希拉·德利兹','身体科普',[
 ['然而，大部分女性对自己的身体','一代代传了下来。'],['如果你想看看自己的阴唇','结果大不相同！'],['只有知识储备升级了','掌握妇科基础知识完全不在话下。'],['最理想的状态是','为即将到来的变化做好准备。'],['从个人层面来说','让自己成为自己一直想成为的那个人。']]]
];
const plain=s=>s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'\u00a0').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0]==='x'?parseInt(n.slice(1),16):Number(n))).trim();
(async()=>{const books=[];for(const [id,key,title,author,type,ranges] of definitions){
 const dir=path.resolve(root,'../books'),name=fs.readdirSync(dir).find(n=>n.includes(key)&&n.endsWith('.epub'));if(!name)throw Error('缺少书籍 '+title);
 const bytes=fs.readFileSync(path.join(dir,name)),zip=await Zip.loadAsync(bytes);const container=await zip.file('META-INF/container.xml').async('string');const opf=container.match(/full-path=["']([^"']+)/)[1],base=path.posix.dirname(opf);
 const chapters=[];const quotes=[];
 for(const file of Object.keys(zip.files).filter(f=>/\.(xhtml|html|htm)$/.test(f))){const html=await zip.file(file).async('string');const heading=html.match(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i);const href=path.posix.relative(base,file);const chapter=heading?plain(heading[1]):title;
 chapters.push({href,title:chapter});
 for(const p of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)){const t=plain(p[1]);ranges.forEach(([start,end],i)=>{const a=t.indexOf(start),b=t.indexOf(end,a);if(a>=0&&b>=a&&!quotes.some(q=>q.id===id+'-'+i))quotes.push({id:id+'-'+i,text:t.slice(a,b+end.length),href,chapter});});}}
 if(quotes.length!==5)throw Error(title+' 匹配失败 '+quotes.length);quotes.sort((a,b)=>a.id.localeCompare(b.id));
 fs.mkdirSync(path.join(root,'data/library'),{recursive:true});fs.writeFileSync(path.join(root,'data/library',id+'.epub'),bytes);books.push({id,title,author,type,epub:'/data/library/'+id+'.epub',chapters,quotes});
 console.log(title+': '+quotes.length+' 条原文逐字匹配');
 }fs.writeFileSync(path.join(root,'data/library.json'),JSON.stringify({books},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
