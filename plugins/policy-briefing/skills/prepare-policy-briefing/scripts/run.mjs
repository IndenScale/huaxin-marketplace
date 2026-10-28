import {context,list,unique,text,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function run(input) {
  const c=context(input,'G3','专项政策分析与汇报准备');
  requireValue(text(input.audience)&&text(input.topic),'audience/topic','请指定汇报对象和一个专题');
  requireValue(date(input.asOf),'asOf','请提供有效的分析基准日期 YYYY-MM-DD');
  const policies=unique(structuredClone(list(input.policies,'policies')),'sourceId','policies'),claims=unique(list(input.claims,'claims'),'id','claims');
  for(const [id,p] of policies){
    requireValue(c.sourcesById.has(id),'policies.'+id,'政策来源未登记');
    requireValue(date(p.publishedOn)&&(!p.effectiveOn||date(p.effectiveOn))&&(!p.endsOn||date(p.endsOn)),'policies.'+id,'政策发布日期及可选生效、终止日期须有效');
    requireValue(!p.endsOn||!p.effectiveOn||p.endsOn>=p.effectiveOn,'policies.'+id,'终止日期不能早于生效日期');
    p.timing=p.publishedOn>input.asOf?'基准日后发布':!p.effectiveOn?'生效日期待确认':p.effectiveOn>input.asOf?'尚未生效':p.endsOn&&p.endsOn<input.asOf?'已过所填终止日':'基准日可供分析';
  }
  const results=[];
  for(const [id,item] of claims){
    requireValue(['fact','analysis','action'].includes(item.kind)&&text(item.text),'claims.'+id,'条目需包含 fact、analysis 或 action 分类及内容');
    const refs=list(item.evidence,'claims.'+id+'.evidence',{empty:true}).map((r,i)=>{requireValue(policies.has(r.sourceId),'claims.'+id+'.evidence.'+i,'分析依据须来自本专题政策清单');return evidence(c,r,'claims.'+id+'.evidence.'+i);});
    const outside=refs.some(r=>policies.get(r.sourceId).timing!=='基准日可供分析');
    const status=!refs.length?'缺少依据':outside?'日期适用性待确认':item.kind==='fact'?'原文依据已定位':'分析判断待复核';
    if(!refs.length||outside)c.diagnostics.push(diagnostic(!refs.length?'G3_EVIDENCE':'G3_TIMING',id,item.text+'；'+status,'补充有效依据，或明确其为历史、未来或待确认信息'));
    results.push({id,kind:item.kind,text:item.text,status,evidence:refs,included:refs.length>0&&!outside});
  }
  c.tables.push({title:'政策材料时间范围',columns:['政策','发布日期','生效日期','终止日期','日期状态'],rows:[...policies].map(([id,p])=>[c.sourcesById.get(id).title,p.publishedOn,p.effectiveOn||'待确认',p.endsOn||'未填写',p.timing])},{title:'事实、分析与建议',columns:['条目','类型','内容','状态','依据位置'],rows:results.map(x=>[x.id,{fact:'事实摘录',analysis:'分析判断',action:'行动建议'}[x.kind],x.text,x.status,x.evidence.map(e=>e.sourceId+' '+e.locator).join('；')])});
  const outline=results.filter(r=>r.included).map(r=>({kind:r.kind,text:r.text,evidence:r.evidence}));
  return finish(c,{asOf:input.asOf,audience:input.audience,topic:input.topic,results,outline},`整理 ${results.length} 条内容，${outline.length} 条具有基准日范围内的所填依据；${c.diagnostics.length} 条需要补充或确认。`);
}
cli(run,import.meta.url);
