import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {scenarios,commonInstructions} from './workshop-catalog.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),check=process.argv.includes('--check');
const common=fs.readFileSync(path.join(root,'scripts/lib/workshop-common.mjs'),'utf8'),license=fs.readFileSync(path.join(root,'LICENSE'),'utf8');
function save(file,body){if(check)assert.equal(fs.readFileSync(file,'utf8'),body,'生成内容不同步：'+path.relative(root,file));else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}}
const market=JSON.parse(fs.readFileSync(path.join(root,'marketplace.json'),'utf8'));
for(const s of scenarios){
  const folder=path.join(root,'plugins',s.name),skill=path.join(folder,'skills',s.skill);
  const manifest={$schema:'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',name:s.name,displayName:s.title,version:'0.1.0',description:s.description,author:{name:'华信'},license:'MIT',category:s.category,extensions:{'com.openai':{interface:{displayName:s.title,shortDescription:s.description,capabilities:[]}}}};
  save(path.join(folder,'plugin.json'),JSON.stringify(manifest,null,2)+'\n');save(path.join(folder,'LICENSE'),license);
  const metadata={category:s.category,publisher:'华信',publishedAt:'2026-10-28',updated:'2026-10-28T00:00:00.000Z',tags:[s.group,s.title],examples:[s.prompt]};
  save(path.join(skill,'SKILL.md'),`---\nname: ${s.skill}\ndescription: ${JSON.stringify(s.description+' '+s.purpose)}\nmetadata: ${JSON.stringify(metadata)}\n---\n\n# ${s.title}\n\n${s.purpose}\n\n## 工作步骤\n\n${s.workflow}\n\n## 范围\n\n${s.boundary}\n\n${commonInstructions}\n`);
  save(path.join(skill,'agents/openai.yaml'),`interface:\n  display_name: ${JSON.stringify(s.title)}\n  short_description: ${JSON.stringify(s.description)}\n  default_prompt: ${JSON.stringify(s.prompt)}\n`);
  save(path.join(skill,'scripts/common.mjs'),common);save(path.join(skill,'assets/input.template.json'),JSON.stringify(s.template,null,2)+'\n');
  const entry={name:s.name,displayName:s.title,description:s.description,version:'0.1.0',category:s.category,author:{name:'华信'},source:'./plugins/'+s.name};
  const existing=market.plugins.findIndex(p=>p.name===s.name);if(existing<0)market.plugins.push(entry);else market.plugins[existing]=entry;
}
save(path.join(root,'marketplace.json'),JSON.stringify(market,null,2)+'\n');
console.log(JSON.stringify({plugins:scenarios.length,mode:check?'checked':'built',businessSamples:0}));
