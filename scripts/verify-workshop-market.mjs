import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {scenarios} from './workshop-catalog.mjs';
import {synthetic} from '../tests/synthetic-inputs.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),host=process.env.HXG_SOURCE_ROOT;
if(!host)throw new Error('请用 HXG_SOURCE_ROOT 指定华信小工源码根目录');
const [{readRepositoryMarket,readRepositoryPlugin,repositorySpec},{packagePlugin,normalizePackage}]=await Promise.all(['plugin-repositories','plugins'].map(name=>import(pathToFileURL(path.join(host,'core',name+'.mjs')))));
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'hx-market-published-')),directory=path.join(temporary,'repository');fs.mkdirSync(directory);
const repository='https://github.com/IndenScale/huaxin-marketplace',ref=process.argv[2]||'main';
assert(/^[a-zA-Z0-9._/-]+$/.test(ref)&&!ref.startsWith('-')&&!ref.includes('..'));
const git=args=>({stdout:execFileSync('git',['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','protocol.ext.allow=never',...args],{cwd:directory,encoding:'utf8',timeout:90000,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})});
try {
  git(['init','--quiet']);git(['fetch','--quiet','--depth=1','--no-tags',repository+'.git',ref]);git(['checkout','--quiet','--detach','FETCH_HEAD']);
  const commit=git(['rev-parse','HEAD']).stdout.trim();
  const acquire=async(spec,visit)=>{assert(spec.url===repository+'.git');assert(!spec.ref||spec.ref===ref||spec.ref===commit);return visit(directory,commit,async args=>git(args));};
  const market=await readRepositoryMarket(repositorySpec(repository,commit),{acquire});assert.deepEqual(market.issues,[]);assert.equal(market.entries.length,10);
  const checks=[];
  for(const s of scenarios){
    const entry=market.entries.find(e=>e.entry.name===s.name);assert(entry);assert.equal(entry.entry.version,'0.1.0');
    const capture=folder=>JSON.parse(packagePlugin(folder).text).files;
    const files=await readRepositoryPlugin(entry.target,{acquire,capture});
    const pack=normalizePackage(files,{sourceId:'published',sourceName:market.name,location:repository});assert.deepEqual(pack.skillNames,[s.skill]);assert.equal(Object.keys(pack.servers).length,0);
    const published=capture(path.join(directory,'plugins',s.name)),local=capture(path.join(root,'plugins',s.name));
    assert.deepEqual(published.map(f=>[f.path,f.sha256]),local.map(f=>[f.path,f.sha256]),'远程文件与本次检查的插件不一致');
    const input=path.join(temporary,s.group+'.json');fs.writeFileSync(input,JSON.stringify(synthetic(s.group)));
    const output=spawnSync(process.execPath,[path.join(directory,'plugins',s.name,'skills',s.skill,'scripts/run.mjs'),input],{encoding:'utf8',timeout:10000});assert.equal(output.status,0,output.stderr);assert.equal(JSON.parse(output.stdout).group,s.group);
    checks.push({group:s.group,name:s.name,version:'0.1.0',catalog:'passed',package:'passed',localHashes:'passed',publishedScript:'passed'});
  }
  const result={at:new Date().toISOString(),repository,commit,plugins:market.entries.length,businessSamples:0,userInstallations:0,modelRequests:0,checks};
  fs.mkdirSync(path.join(root,'dist/workshop'),{recursive:true});fs.writeFileSync(path.join(root,'dist/workshop/market-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {fs.rmSync(temporary,{recursive:true,force:true});}
