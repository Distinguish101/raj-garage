// Local preview: node serve.js, then open http://localhost:5179
// The page file is an artifact fragment (no <html> wrapper), so it is wrapped here.
const http=require('http'),fs=require('fs'),path=require('path');
const root=__dirname,PORT=process.env.PORT||5179;
const TYPES={'.html':'text/html','.js':'text/javascript','.json':'application/json','.txt':'text/plain','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary'};
// Roughly the artifact host's rules, so blocked loads show up locally too
const CSP="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:";
http.createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',CSP);
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/'){
    const body=fs.readFileSync(path.join(root,'redline-garage.html'),'utf8');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+body+'</body></html>');
  }
  const f=path.join(root,p);
  if(!f.startsWith(root)){res.writeHead(403);return res.end();}
  fs.readFile(f,(err,data)=>{
    if(err){res.writeHead(404);return res.end('Not found');}
    res.writeHead(200,{'content-type':TYPES[path.extname(f)]||'application/octet-stream'});res.end(data);
  });
}).listen(PORT,()=>console.log('Redline Garage on http://localhost:'+PORT));
