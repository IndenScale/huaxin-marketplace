import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {scenarios} from './workshop-catalog.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/build-workshop.mjs'),'--check'],{stdio:'inherit'});
const out=path.join(root,'dist/workshop');fs.mkdirSync(out,{recursive:true});
// 仅替换本脚本管理的当前插件发行包，不删除其他文件。
for(const entry of fs.readdirSync(out))if(scenarios.some(s=>new RegExp('^'+s.name+'-[0-9]+\\.[0-9]+\\.[0-9]+\\.zip$').test(entry)))fs.rmSync(path.join(out,entry));
const packages=[];
for(const s of scenarios){
  const directory=path.join(root,'plugins',s.name),manifest=JSON.parse(fs.readFileSync(path.join(directory,'plugin.json'),'utf8'));
  const name=`${s.name}-${manifest.version}.zip`,file=path.join(out,name);
  execFileSync('zip',['-q','-X','-r',file,'plugin.json','LICENSE','skills'],{cwd:directory});
  const contents=execFileSync('unzip',['-Z','-1',file],{encoding:'utf8'}).trim().split('\n').filter(x=>!x.endsWith('/'));
  if(!contents.includes('plugin.json')||!contents.includes(`skills/${s.skill}/scripts/run.mjs`)||contents.some(p=>p.startsWith('/')||p.split('/').includes('..')||!['plugin.json','LICENSE'].includes(p)&&!p.startsWith('skills/')))throw new Error('插件归档结构不符：'+name);
  const bytes=fs.readFileSync(file);packages.push({group:s.group,name:s.name,displayName:s.title,version:manifest.version,file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),files:contents.length});
}
const result={schema:'huaxin-workshop-packages/1',businessSamples:0,packages};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(out,'SHA256SUMS'),packages.map(p=>p.sha256+'  '+p.file).join('\n')+'\n');
console.log(JSON.stringify({directory:out,plugins:packages.length,bytes:packages.reduce((n,p)=>n+p.bytes,0),businessSamples:0},null,2));
