import {context,list,unique,text,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

export function run(input) {
  const c=context(input,'G4','数据中心交付资料齐套检查');
  requireValue(text(input.stage),'stage','请指定一个交付阶段');
  const requirements=unique(list(input.requirements,'requirements'),'id','requirements');
  const files=unique(structuredClone(list(input.files,'files',{empty:true})),'id','files');
  for(const [id,f] of files){
    requireValue(requirements.has(f.requirementId),'files.'+id+'.requirementId','文件须映射到已登记清单项');
    requireValue(text(f.filename)&&text(f.revision)&&text(f.status),'files.'+id,'文件需含名称、业务修订和状态');
    f.verifiedEvidence=evidence(c,f.evidence,'files.'+id+'.evidence');
  }
  const results=[];
  for(const [id,r] of requirements){
    requireValue(text(r.title)&&typeof r.required==='boolean','requirements.'+id,'清单项需含名称及 required 布尔值');
    list(r.acceptedStatuses,'requirements.'+id+'.acceptedStatuses');requireValue(r.acceptedStatuses.every(text),'requirements.'+id,'允许状态须为文字');
    const basis=evidence(c,r.evidence,'requirements.'+id+'.evidence');
    const matches=[...files.values()].filter(f=>f.requirementId===id);let status='齐备',rule='',action='';
    if(!matches.length){status=r.required?'缺失':'未提供（可选）';if(r.required){rule='G4_MISSING';action='补交该清单项要求的资料';}}
    else if(matches.length>1){status='存在多份待确定';rule='G4_AMBIGUOUS';action='指定本次交付采用的唯一文件及修订';}
    else if(r.revision&&matches[0].revision!==r.revision){status='修订不符';rule='G4_REVISION';action='提交约定修订，或确认并变更清单要求';}
    else if(!r.acceptedStatuses.includes(matches[0].status)){status='状态不符';rule='G4_STATUS';action='按交付约定完成审批或替换文件';}
    if(rule)c.diagnostics.push(diagnostic(rule,id,JSON.stringify({requirement:r,matches}),action));
    results.push({id,title:r.title,status,required:r.required,requirementEvidence:basis,files:matches.map(({verifiedEvidence,...f})=>({...f,evidence:verifiedEvidence}))});
  }
  c.tables.push({title:'交付资料清单',columns:['清单项','资料名称','状态','文件及修订','下一步'],rows:results.map(r=>[r.id,r.title,r.status,r.files.map(f=>f.filename+' / '+f.revision+' / '+f.status).join('；'),c.diagnostics.find(d=>d.location===r.id)?.action||'按约定复核资料内容'])});
  return finish(c,{stage:input.stage,results,technicallyApproved:false},`核对 ${results.length} 项交付要求，${c.diagnostics.length} 项需要处理。检查范围为清单、修订与登记状态。`);
}
cli(run,import.meta.url);
