import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    // Preview exposes only the actual public site, never Git, statements or test data.
    const allowed=new Set(['index.html','growth.css','growth.mjs','growth-core.mjs','catalog.mjs','cafe-scene.png','overview.png','mug.png','espresso.png']);
    if(!allowed.has(file.slice(root.length).replace(/^[/\\]/,'')))throw Error('Not public');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(8794,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:8794'));
