// Bundle the public game assets served by the Worker.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {files,extensions} from '../server/public-files.mjs';
const root=new URL('../',import.meta.url), assets={};
for(const name of files){
  const bytes=await readFile(new URL(name,root));
  const ext=extname(name), binary=ext==='.png';
  assets[name]=[extensions[ext]||'text/plain',bytes.toString(binary?'base64':'utf8'),binary];
}
await mkdir(new URL('.build/',root),{recursive:true});
await writeFile(new URL('.build/public-assets.mjs',root),'export default '+JSON.stringify(assets)+';\n');
