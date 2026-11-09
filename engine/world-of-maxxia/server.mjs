import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.maxxia':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav','.mid':'audio/midi','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2','.woff':'font/woff','.map':'application/json; charset=utf-8'};
export function createStaticServer(root = resolve(here, 'dist')) {
  return createServer(async (req,res) => {
    const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);};
    if (!['GET','HEAD'].includes(req.method || '')) {res.setHeader('Allow','GET, HEAD');reply(405,'Method not allowed');return;}
    try {
      const raw=(req.url || '/').split('?')[0];
      let pathname; try {pathname=decodeURIComponent(raw);}catch{reply(400,'Malformed URL');return;}
      if(pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(s=>s==='..'||s.startsWith('.'))) {reply(403,'Forbidden');return;}
      if(pathname==='/healthz'){let build={};try{build=JSON.parse(await readFile(resolve(root,'build-info.json'),'utf8'));}catch{}res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true,app:'world-of-maxxia',phase:build.release??'0.35.0',buildId:build.buildId??null}));return;}
      let file=resolve(root,'.'+pathname);
      if(file!==root&&!file.startsWith(root+sep)){reply(403,'Forbidden');return;}
      let info=await stat(file);if(info.isDirectory()) {file=resolve(file,'index.html');info=await stat(file);}
      const physical=await realpath(file), physicalRoot=await realpath(root);
      if(!physical.startsWith(physicalRoot+sep)){reply(403,'Forbidden');return;}
      const body=await readFile(file);
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':body.byteLength,'Cache-Control':/^\/assets\/runtime-[a-f0-9]+\//.test(pathname)?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch(error){if(['ENOENT','ENOTDIR'].includes(error.code)){reply(404,'Not found');}else{reply(500,'Unable to serve file');}}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||3000);const host=process.env.HOST||'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535){console.error('PORT must be an integer from 1 to 65535.');process.exit(1);}
  try{await stat(resolve(here,'dist/index.html'));}catch{console.error('Browser build is missing. In the source package, run npm ci then npm run build.');process.exit(1);}
  const server=createStaticServer();
  server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Stop the previous World of Maxxia launcher with Ctrl+C, then run this launcher again. This copy has NOT started. Folder: ${here}`:error.message);process.exitCode=1;});
  server.listen(port,host,()=>console.log(`World of Maxxia · Maxxia Maker MP27 / Engine 0.72.0\nServing ${here}\nOpen http://${host==='0.0.0.0'?'localhost':host}:${port}\nPress Ctrl+C to stop.`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
