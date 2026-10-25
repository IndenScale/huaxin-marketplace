import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const market=JSON.parse(fs.readFileSync(path.join(root,'marketplace.json'))),names=new Set();
assert.equal(market.name,'华信官方插件市场');assert(Array.isArray(market.plugins)&&market.plugins.length>0);
let skills=0,files=0;
for(const entry of market.plugins){
 assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)&&!names.has(entry.name));names.add(entry.name);
 assert.equal(entry.source,'./plugins/'+entry.name);
 const folder=path.join(root,entry.source),manifest=JSON.parse(fs.readFileSync(path.join(folder,'plugin.json')));
 assert.equal(manifest.name,entry.name);assert.equal(manifest.version,entry.version);assert(/^\d+\.\d+\.\d+$/.test(manifest.version));assert.equal(manifest.license,'MIT');
 assert(fs.existsSync(path.join(folder,'LICENSE')));
 for(const name of fs.readdirSync(path.join(folder,'skills'))){
  const body=fs.readFileSync(path.join(folder,'skills',name,'SKILL.md'),'utf8');assert(body.startsWith('---\n'));assert(body.includes('\nname: '+name+'\n'));skills++;
 }
 const scan=directory=>{for(const item of fs.readdirSync(directory,{withFileTypes:true})){assert(!item.isSymbolicLink());const file=path.join(directory,item.name);if(item.isDirectory())scan(file);else{files++;assert(!/^(?:\.env(?:\..*)?|.*\.(?:pem|key|sqlite|db))$/i.test(item.name));assert(fs.statSync(file).size<4*1024*1024);}}};scan(folder);
}
const {profileCSV}=await import('../plugins/data-workbench/skills/explore-data/scripts/profile.mjs');
const result=profileCSV('名称,金额\n甲,10\n乙,20\n');assert.equal(result.records,2);assert.equal(result.columns[1].mean,15);
console.log(JSON.stringify({market:market.name,plugins:market.plugins.length,skills,files,checks:'passed'},null,2));
