import { readFile, readdir, mkdir, rm, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname, relative, extname } from "node:path";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const app = join(root, "apps/playground");
const dist = join(app, "dist");
const config = JSON.parse(await readFile(join(app, "registry.config.json"), "utf8"));
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function walk(folder) {
  const output = [];
  for (const ent of await readdir(folder, { withFileTypes: true })) {
    const full = join(folder, ent.name);
    if (ent.isDirectory()) output.push(...await walk(full));
    else if (ent.isFile()) output.push(full);
  }
  return output;
}
const pages = [];
for (const source of config.sources) {
  const folder = join(app, source.base);
  for (const file of await walk(folder)) {
    if (extname(file) !== source.include) continue;
    const name = relative(folder, file).replaceAll("\\", "/");
    const text = await readFile(file, "utf8");
    const title = text.match(/^# (.+)$/m)?.[1] || name.replace(/\\.[^.]+$/, "").replaceAll("-", " ");
    const item = { id: source.id + "/" + name, group: source.label, title, type: source.include === ".html" ? "html" : "markdown" };
    if (item.type === "html") {
      item.url = "content/" + source.id + "/" + name;
      const target = join(dist, item.url);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(file, target);
    } else item.content = text;
    pages.push(item);
  }
}
pages.sort((a,b) => a.id.localeCompare(b.id));
await writeFile(join(dist, "registry.json"), JSON.stringify(pages, null, 2));
for (const file of ["index.html","main.js","styles.css"]) await copyFile(join(app, "src", file),join(dist,file));
console.log("Built", pages.length, "pages into", dist);
