import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const app = fileURLToPath(new URL("../", import.meta.url));
const build = () => spawnSync(process.execPath,[join(app,"scripts/build.mjs")],{stdio:"inherit"});
if (build().status !== 0) process.exit(1);
const folder = join(app, "dist");
const mime = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
createServer(async(req,res)=>{
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const path = resolve(folder,"."+decodeURIComponent(url.pathname));
    if (path !== folder && !path.startsWith(folder + sep)) { res.writeHead(403).end(); return; }
    const file = (await stat(path)).isDirectory() ? join(path, "index.html") : path;
    res.setHeader("Content-Type",mime[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.writeHead(404).end("Not found"); }
}).listen(4173, "0.0.0.0",()=>console.log("Playground: http://localhost:4173"));
