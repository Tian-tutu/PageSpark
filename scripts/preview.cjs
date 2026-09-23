const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const files={'/':'src/index.html','/index.html':'src/index.html','/style.css':'src/style.css','/app.js':'src/app.js','/reader.js':'src/reader.js','/data/book.json':'data/book.json','/data/book.epub':'data/book.epub','/vendor/jszip.js':'node_modules/jszip/dist/jszip.min.js','/vendor/epub.js':'node_modules/epubjs/dist/epub.min.js'};
files['/settings-fix.css']='src/settings-fix.css';
files['/bookmark.css']='src/bookmark.css';
files['/fonts/Huiwen.otf']='assets/fonts/Huiwen.otf';
files['/data/library.json']='data/library.json';
for(const id of ['summer','return','energy','body'])files['/data/library/'+id+'.epub']='data/library/'+id+'.epub';
http.createServer((req,res)=>{const name=files[new URL(req.url,'http://localhost').pathname];if(!name){res.writeHead(404);return res.end();}const ext=path.extname(name);res.setHeader('Content-Type',({'.otf':'font/otf','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.epub':'application/epub+zip'})[ext]||'application/octet-stream');fs.createReadStream(path.join(root,name)).on('error',()=>res.end()).pipe(res);}).listen(4317,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:4317'));
