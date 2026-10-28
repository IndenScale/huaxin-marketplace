import {context,list,unique,text,present,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

export function run(input) {
  const c=context(input,'G6','综合台账更新预览');
  const fields=unique(list(input.fields,'fields'),'key','fields');
  for(const [key,f] of fields)requireValue(text(f.label)&&typeof f.required==='boolean','fields.'+key,'字段需含名称及 required 布尔值');
  const existing=unique(list(input.existing,'existing',{empty:true}),'key','existing'),incoming=list(input.incoming,'incoming',{empty:true});
  for(const [key,r] of existing)requireValue(r.values&&typeof r.values==='object'&&!Array.isArray(r.values),'existing.'+key,'已有记录需提供 values 对象');
  const groups=new Map();for(const [i,r] of incoming.entries()){
    requireValue(text(r.key)&&r.values&&typeof r.values==='object'&&!Array.isArray(r.values),'incoming.'+i,'新增材料需含事项主键和字段值');
    const refs={};for(const [field,value] of Object.entries(r.values)){
      requireValue(fields.has(field),'incoming.'+i+'.'+field,'输入包含未定义的台账字段');
      requireValue(!present(value)||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean','incoming.'+i+'.'+field,'字段值须为文字、数字、布尔值或空值');
      if(present(value))refs[field]=evidence(c,r.evidence?.[field],'incoming.'+i+'.'+field,{value});
    }
    groups.set(r.key,[...(groups.get(r.key)||[]),{...r,verifiedEvidence:refs}]);
  }
  const proposals=[];
  for(const [key,records] of groups){
    const old=existing.get(key)?.values||{},after={...old},refs={},conflicts=[];
    for(const [field,f] of fields){
      const values=records.filter(r=>present(r.values[field]));const distinct=new Map(values.map(r=>[JSON.stringify(r.values[field]),r.values[field]]));
      if(distinct.size>1){conflicts.push(field);c.diagnostics.push(diagnostic('G6_CONFLICT',key+'/'+field,JSON.stringify([...distinct.values()]),'选择采用值并保留确认记录'));continue;}
      if(values.length){after[field]=values[0].values[field];refs[field]=values.map(r=>r.verifiedEvidence[field]);}
      if(f.required&&!present(after[field])){conflicts.push(field);c.diagnostics.push(diagnostic('G6_REQUIRED',key+'/'+field,'必需字段为空','补齐字段及来源后重新预览'));}
    }
    const changes=[...fields].filter(([field])=>JSON.stringify(old[field])!==JSON.stringify(after[field])).map(([field,f])=>({field,label:f.label,before:old[field]??null,after:after[field]??null,evidence:refs[field]||[]}));
    const action=conflicts.length?'待确认':!existing.has(key)?'新增建议':changes.length?'更新建议':'无需变更';
    proposals.push({key,action,before:old,after,changes,conflicts,applyReady:conflicts.length===0});
  }
  c.tables.push({title:'事项处理预览',columns:['事项标识','动作','变更字段数','待确认字段'],rows:proposals.map(r=>[r.key,r.action,r.changes.length,r.conflicts.join('、')])},{title:'字段变更',columns:['事项标识','字段','原值','建议值','来源位置'],rows:proposals.flatMap(p=>p.changes.map(d=>[p.key,d.label,d.before,d.after,d.evidence.map(e=>e.sourceId+' '+e.locator).join('；')]))});
  return finish(c,{proposals,mutated:false},`整理 ${proposals.length} 个事项，${proposals.filter(p=>p.action==='新增建议').length} 项新增建议，${proposals.filter(p=>p.action==='更新建议').length} 项更新建议，${proposals.filter(p=>!p.applyReady).length} 项待确认。`);
}
cli(run,import.meta.url);
