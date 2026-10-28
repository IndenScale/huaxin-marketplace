import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {scenarios} from './workshop-catalog.mjs';
import {synthetic} from '../tests/synthetic-inputs.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const host=process.env.HXG_SOURCE_ROOT;
if(!host)throw new Error('请使用 HXG_SOURCE_ROOT 指定华信小工源码根目录');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'hx-plugin-contract-'));
const before=Object.fromEntries(['HXG_HOST_HOME','PKB_HOST_HOME','PKB_AGENT_HOME'].map(k=>[k,process.env[k]]));
process.env.HXG_HOST_HOME=path.join(temp,'host');process.env.PKB_HOST_HOME=path.join(temp,'host');process.env.PKB_AGENT_HOME=path.join(temp,'agent');
let mcp;
try {
  const load=name=>import(pathToFileURL(path.join(host,'core',name+'.mjs')));
  const [{Plugins},{McpServices},{getTaskSkill,snapshotTaskSkills,createSkillRuntime}]=await Promise.all([load('plugins'),load('mcp-services'),load('task-skills')]);
  const [{initVault},{grant},{saveSpace,createProject,beginRun},{bindWorkspace,withWorkspaceSnapshot},{listWorkspaceCommands,actWorkspaceCommand}]=await Promise.all([load('store'),load('paths'),load('projects'),load('local-workspace'),load('workspace-commands')]);
  const vault=path.join(temp,'vault'),workspace=path.join(temp,'workspace');fs.mkdirSync(workspace);initVault(vault,{name:'抽象协议测试'});grant(vault);const space=saveSpace(vault,{name:'抽象协议测试'});bindWorkspace(vault,space.id,workspace);
  mcp=new McpServices({file:path.join(temp,'host/mcp.sqlite'),encrypt:x=>x,decrypt:x=>x});
  const plugins=new Plugins({mcp,vault:temp,runtime:{executable:process.execPath}}),checks=[];
  assert(!plugins.official().some(p=>scenarios.some(s=>s.name===p.manifest.name)),'场景插件不能预装为随应用内容');
  for(const s of scenarios){
    const archive=path.join(root,'dist/workshop',s.name+'-0.1.0.zip');
    const preview=await plugins.previewArchive(archive);assert.equal(preview.skills.length,1);assert.equal(preview.connectionNames.length,0);
    const installed=plugins.import(preview.token);assert(installed.installed&&installed.enabled);assert.equal(installed.state,'ready');
    const id=installed.skills[0].id,skill=getTaskSkill(id);assert.equal(skill.name,s.skill);assert.match(skill.instructions,/run_skill_script/);
    const runtime=createSkillRuntime(snapshotTaskSkills('',{},[id]),{root:temp,runId:'protocol-test',onEvent:()=>{}});
    try{const loaded=runtime.load(id);assert.equal(loaded.name,s.skill);assert.match(runtime.read(id,'scripts/run.mjs').text,/export function run/);}finally{runtime.close();}
    const input=path.join(temp,s.group+'.json');fs.writeFileSync(input,JSON.stringify(synthetic(s.group)));
    const run=spawnSync(process.execPath,[path.join(skill.source,'scripts/run.mjs'),input],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(run.stdout).group,s.group);
    const project=createProject(vault,{message:'抽象协议测试',requestId:randomUUID(),spaceId:space.id});
    const snapshot={...withWorkspaceSnapshot(vault,{documents:[],inputs:{}},space.id),skills:snapshotTaskSkills('',{},[id]).skills};
    const active=beginRun(vault,project.id,{requestId:randomUUID(),message:'抽象协议测试',snapshot,model:'protocol-test',endpoint:'http://localhost'}).run;
    const approved=createSkillRuntime(snapshot,{root:vault,runId:active.id});
    try{approved.load(id);const done=approved.run(id,'scripts/run.mjs',[input],'验证本机脚本协议与输出');const command=listWorkspaceCommands(vault,project.id).at(-1);assert.equal(command.status,'pending');actWorkspaceCommand(vault,command.id,'approve',command.reviewHash);const result=await done;assert.equal(result.status,'completed',result.error+' '+result.output);assert.equal(JSON.parse(result.output).group,s.group);}finally{approved.close();}
    plugins.enable(installed.id,false);assert(!snapshotTaskSkills().skills.some(s=>s.id===id));plugins.enable(installed.id,true);assert(snapshotTaskSkills().skills.some(s=>s.id===id));
    const reopened=new Plugins({mcp,vault:temp,runtime:{executable:process.execPath}});assert.equal(reopened.read(installed.id).installed,true);assert.equal(getTaskSkill(id).version,skill.version);
    plugins.remove(installed.id);assert(!snapshotTaskSkills().skills.some(s=>s.id===id));
    checks.push({group:s.group,archive:'passed',install:'passed',load:'passed',script:'passed',approvedSkillRuntime:'passed',enable:'passed',reopen:'passed',remove:'passed'});
  }
  const result={at:new Date().toISOString(),hostSource:host,businessSamples:0,isolated:true,checks,realModelTasks:false,externalPlatformConnections:false};
  fs.writeFileSync(path.join(root,'dist/workshop/host-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {
  if(mcp)await mcp.close();for(const [k,v] of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  fs.rmSync(temp,{recursive:true,force:true});
}
