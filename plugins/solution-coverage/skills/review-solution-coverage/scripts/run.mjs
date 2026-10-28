import {context,list,unique,text,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

export function run(input) {
  const c=context(input,'G2','技术方案需求覆盖审查');
  const requirements=unique(list(input.requirements,'requirements'),'id','requirements');
  const mappings=unique(list(input.coverage,'coverage',{empty:true}),'requirementId','coverage');
  for(const id of mappings.keys())requireValue(requirements.has(id),'coverage.'+id,'映射指向未知需求');
  const results=[];
  for(const [id,r] of requirements){
    requireValue(text(r.text),'requirements.'+id,'需求内容不能为空');
    const requirementEvidence=evidence(c,r.evidence,'requirements.'+id+'.evidence');
    const mapping=mappings.get(id);let status='未提供覆盖证据',refs=[];
    if(mapping){
      requireValue(['full','partial','none'].includes(mapping.assessment),'coverage.'+id+'.assessment','覆盖判断须为 full、partial 或 none');
      requireValue(text(mapping.reason),'coverage.'+id+'.reason','请记录判断理由');
      refs=list(mapping.evidence,'coverage.'+id+'.evidence',{empty:mapping.assessment==='none'}).map((ref,i)=>evidence(c,ref,'coverage.'+id+'.evidence.'+i));
      status={full:'覆盖判断待复核',partial:'部分覆盖',none:'未覆盖'}[mapping.assessment];
    }
    if(!mapping||mapping.assessment!=='full')c.diagnostics.push(diagnostic('G2_COVERAGE',id,r.text+'；'+(mapping?.reason||'没有方案映射'),'补齐方案响应或确认不适用，并由业务专家复核'));
    results.push({id,requirement:r.text,status,assessment:mapping?.assessment||'unmapped',reason:mapping?.reason||'',requirementEvidence,solutionEvidence:refs,reviewed:false});
  }
  c.tables.push({title:'需求与方案映射',columns:['需求','内容','覆盖状态','判断理由','方案位置'],rows:results.map(r=>[r.id,r.requirement,r.status,r.reason,r.solutionEvidence.map(e=>e.sourceId+' '+e.locator).join('；')])});
  return finish(c,{results,professionalApproval:false},`检查 ${results.length} 条需求，${c.diagnostics.length} 条存在覆盖缺口。覆盖判断等待业务专家复核。`);
}
cli(run,import.meta.url);
