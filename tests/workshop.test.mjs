import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {scenarios} from '../scripts/workshop-catalog.mjs';
import {html,markdown} from '../scripts/lib/workshop-common.mjs';
import {synthetic,reference} from './synthetic-inputs.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const engines=Object.fromEntries(await Promise.all(scenarios.map(async s=>[s.group,(await import(pathToFileURL(path.join(root,'plugins',s.name,'skills',s.skill,'scripts/run.mjs')))).run])));
for(const s of scenarios){
  test(s.group+' 输入保持只读，重复执行得到相同结果',()=>{const input=synthetic(s.group),before=structuredClone(input),result=engines[s.group](input);assert.deepEqual(input,before);assert.deepEqual(engines[s.group](input),result);assert.equal(result.group,s.group);assert.equal(result.sources[0].version,'T1');assert.match(result.inputSha256,/^[a-f0-9]{64}$/);});
  test(s.group+' 拒绝缺少范围、来源版本和场景错误',()=>{for(const mutate of [i=>i.scope='',i=>i.sources[0].version='',i=>i.group='OTHER']){const input=synthetic(s.group);mutate(input);assert.throws(()=>engines[s.group](input),e=>e.diagnostics?.[0].rule==='INPUT_INVALID');}});
  test(s.group+' 实际 Node CLI 输出三种格式且不改写输入',()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hx-protocol-'));try{const file=path.join(dir,'input.json'),body=JSON.stringify(synthetic(s.group));fs.writeFileSync(file,body);for(const format of ['json','markdown','html']){const result=spawnSync(process.execPath,[path.join(root,'plugins',s.name,'skills',s.skill,'scripts/run.mjs'),file,'--format',format],{encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);if(format==='json')assert.equal(JSON.parse(result.stdout).group,s.group);if(format==='markdown')assert.match(result.stdout,/规则|诊断/);if(format==='html')assert.match(result.stdout,/Content-Security-Policy/);assert.equal(fs.readFileSync(file,'utf8'),body);}}finally{fs.rmSync(dir,{recursive:true,force:true});}
  });
}

test('G1 找出差异、单位问题、缺项，保留零值',()=>{
  const i=synthetic('G1');assert.equal(engines.G1(i).diagnostics[0].rule,'G1_DIFFERENCE');
  i.documents[1].records[0].units.a='V';assert.equal(engines.G1(i).diagnostics[0].rule,'G1_UNIT');
  delete i.documents[1].records[0].values.a;assert.equal(engines.G1(i).diagnostics[0].rule,'G1_MISSING');
  for(const d of i.documents){d.records[0].values.a=0;d.records[0].units.a='U';d.records[0].evidence.a=reference(i,'0');}
  assert.equal(engines.G1(i).findings[0].left.value,0);assert.equal(engines.G1(i).diagnostics.length,0);
});
test('G1 拒绝重复主键、虚假引文和字段值不在原文',()=>{
  for(const mutate of [i=>i.documents[0].records.push(structuredClone(i.documents[0].records[0])),i=>i.documents[0].records[0].evidence.a.start=999,i=>i.documents[0].records[0].values.a=999]){const i=synthetic('G1');mutate(i);assert.throws(()=>engines.G1(i));}
});
test('G2 检出无映射、部分响应，完整响应保持待复核',()=>{
  const i=synthetic('G2');assert.equal(engines.G2(i).professionalApproval,false);assert.equal(engines.G2(i).results[0].reviewed,false);
  i.coverage[0].assessment='partial';assert.equal(engines.G2(i).diagnostics.length,1);
  i.coverage=[];assert.equal(engines.G2(i).results[0].assessment,'unmapped');
});
test('G2 拒绝未知需求与无依据完整响应',()=>{for(const mutate of [i=>i.coverage[0].requirementId='unknown',i=>i.coverage[0].evidence=[]]){const i=synthetic('G2');mutate(i);assert.throws(()=>engines.G2(i));}});
test('G3 排除无依据及基准日后内容，保留分类',()=>{
  const i=synthetic('G3');i.claims[0].kind='analysis';assert.equal(engines.G3(i).outline[0].kind,'analysis');
  i.policies[0].effectiveOn='2027-01-01';assert.equal(engines.G3(i).outline.length,0);assert.equal(engines.G3(i).diagnostics[0].rule,'G3_TIMING');
  i.claims[0].evidence=[];assert.equal(engines.G3(i).diagnostics[0].rule,'G3_EVIDENCE');
});
test('G3 拒绝无效日期和未登记材料',()=>{for(const mutate of [i=>i.asOf='2026-02-30',i=>i.policies[0].sourceId='unknown']){const i=synthetic('G3');mutate(i);assert.throws(()=>engines.G3(i));}});
test('G3 缺少生效日期时不推定生效',()=>{const i=synthetic('G3');delete i.policies[0].effectiveOn;const r=engines.G3(i);assert.equal(r.outline.length,0);assert.equal(r.diagnostics[0].rule,'G3_TIMING');});
test('G4 核对修订、状态、缺失及多份冲突',()=>{
  const i=synthetic('G4');assert.equal(engines.G4(i).diagnostics.length,0);assert.equal(engines.G4(i).technicallyApproved,false);
  i.files[0].revision='R2';assert.equal(engines.G4(i).diagnostics[0].rule,'G4_REVISION');i.files[0].revision='R1';
  i.files[0].status='S2';assert.equal(engines.G4(i).diagnostics[0].rule,'G4_STATUS');
  i.files.push({...i.files[0],id:'F2'});assert.equal(engines.G4(i).diagnostics[0].rule,'G4_AMBIGUOUS');
  i.files=[];assert.equal(engines.G4(i).diagnostics[0].rule,'G4_MISSING');i.requirements[0].required=false;assert.equal(engines.G4(i).diagnostics.length,0);
});
test('G5 精确使用公式、倍率、阈值，不自动判断因果',()=>{const r=engines.G5(synthetic('G5'));assert.equal(r.results[0].value,500);assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].threshold,400);assert.equal(r.results[0].formula,'a / b');});
test('G5 零分母和空值返回无法计算，重复粒度或数字文字拒绝',()=>{
  const i=synthetic('G5');i.rows[0].values.b=0;i.rows[0].evidence=reference(i,'0');i.rows[0].values.a=0;assert.equal(engines.G5(i).results[0].value,null);assert.equal(engines.G5(i).alerts.length,0);
  i.rows[0].values.a=null;assert.match(engines.G5(i).results[0].status,/缺失/);
  i.rows.push(structuredClone(i.rows[0]));assert.throws(()=>engines.G5(i));i.rows.pop();i.rows[0].values.a='10';assert.throws(()=>engines.G5(i));
});
test('G5 拒绝任意运算符和无限阈值',()=>{for(const mutate of [i=>i.metrics[0].operation='eval',i=>i.rules[0].operator='constructor',i=>i.rules[0].threshold=Infinity]){const i=synthetic('G5');mutate(i);assert.throws(()=>engines.G5(i));}});
test('G6 保留旧字段，不清空，采用后重复处理无变更',()=>{
  const i=synthetic('G6');i.existing[0].values.other='keep';const r=engines.G6(i);assert.equal(r.mutated,false);assert.equal(r.proposals[0].after.other,'keep');
  i.existing[0].values=r.proposals[0].after;assert.equal(engines.G6(i).proposals[0].action,'无需变更');
  i.incoming[0].values.a=null;assert.equal(engines.G6(i).proposals[0].after.a,'y');
});
test('G6 对同事项冲突不选值，新增时检查必填',()=>{
  const i=synthetic('G6');i.incoming.push({key:'K1',values:{a:'z'},evidence:{a:reference(i,'z')}});const r=engines.G6(i);assert.equal(r.proposals[0].applyReady,false);assert.equal(r.proposals[0].after.a,'x');assert.equal(r.diagnostics[0].rule,'G6_CONFLICT');
  i.existing=[];i.incoming=[{key:'K2',values:{}}];assert.equal(engines.G6(i).diagnostics[0].rule,'G6_REQUIRED');
});
test('G6 拒绝未知字段和不安全字段名',()=>{const i=synthetic('G6');i.incoming[0].values.unknown='x';assert.throws(()=>engines.G6(i));const j=synthetic('G6');j.fields[0].key='__proto__';assert.throws(()=>engines.G6(j));});
test('G7 校验枚举与必填，结果不伪装平台连接或提交',()=>{
  const i=synthetic('G7'),r=engines.G7(i);assert.equal(r.validationPassed,true);assert.deepEqual(r.submission,{state:'prepared',submitted:false,platformConnected:false});
  i.values.a='z';i.evidence.a=reference(i,'z');assert.equal(engines.G7(i).validationPassed,false);
  i.values={};assert.equal(engines.G7(i).results[0].status,'必填缺失');
});
test('G7 严格检查日期、数值范围、布尔值与 Unicode 长度',()=>{
  const i=synthetic('G7');i.fields[0]={id:'a',label:'字段甲',type:'date',required:true};i.values.a='2026-02-30';i.evidence.a=reference(i,i.values.a);assert.equal(engines.G7(i).validationPassed,false);
  i.values.a='2026-02-28';i.evidence.a=reference(i,i.values.a);assert.equal(engines.G7(i).validationPassed,true);
  i.fields[0].type='number';i.fields[0].max=5;i.values.a=10;i.evidence.a=reference(i,'a=10 b=2');assert.equal(engines.G7(i).validationPassed,false);
  i.fields[0].type='boolean';i.values.a=false;i.evidence.a=reference(i,'true false');assert.equal(engines.G7(i).validationPassed,true);
  i.fields[0].type='string';i.fields[0].maxLength=1;i.sources[0].text+='\n😀';i.values.a='😀';i.evidence.a=reference(i,'😀');assert.equal(engines.G7(i).validationPassed,true);
});
test('证据偏移按 UTF-16 验证，未知来源和伪引文拒绝',()=>{const i=synthetic('G2');i.sources[0].text='😀x\ny';i.requirements[0].evidence=reference(i,'x');i.coverage[0].evidence=[reference(i,'y')];assert.equal(i.requirements[0].evidence.start,2);assert.equal(engines.G2(i).diagnostics.length,0);i.requirements[0].evidence.quote='z';assert.throws(()=>engines.G2(i));i.requirements[0].evidence.sourceId='unknown';assert.throws(()=>engines.G2(i));});
test('HTML 转义输入，禁止外部连接，Markdown 保持表格完整',()=>{const r=engines.G2(synthetic('G2'));r.scope='<script>globalThis.pwned=1</script>';r.tables[0].rows[0][1]='a|b\nc';const page=html(r);assert(!page.includes('<script>globalThis.pwned=1</script>'));assert(page.includes('&lt;script&gt;'));assert(page.includes("connect-src 'none'"));assert(markdown(r).includes('a\\|b c'));});
test('CLI 对无效 JSON 和未知参数返回结构化失败',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'hx-invalid-'));try{const f=path.join(d,'x.json');fs.writeFileSync(f,'{');const script=path.join(root,'plugins',scenarios[0].name,'skills',scenarios[0].skill,'scripts/run.mjs');for(const args of [[f],[f,'--bad','json']]){const p=spawnSync(process.execPath,[script,...args],{encoding:'utf8'});assert.equal(p.status,1);assert.equal(JSON.parse(p.stderr).ok,false);assert.equal(p.stdout,'');}}finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('CLI 经文件系统路径别名调用仍实际执行',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hx-alias-'));try{const link=path.join(dir,'run.mjs'),input=path.join(dir,'input.json');fs.symlinkSync(path.join(root,'plugins',scenarios[0].name,'skills',scenarios[0].skill,'scripts/run.mjs'),link);fs.writeFileSync(input,JSON.stringify(synthetic('G1')));const p=spawnSync(process.execPath,[link,input],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.equal(JSON.parse(p.stdout).group,'G1');}finally{fs.rmSync(dir,{recursive:true,force:true});}});
