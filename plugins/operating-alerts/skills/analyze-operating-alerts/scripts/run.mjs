import {context,list,unique,text,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

const operators={gt:(a,b)=>a>b,gte:(a,b)=>a>=b,lt:(a,b)=>a<b,lte:(a,b)=>a<=b};
export function run(input) {
  const c=context(input,'G5','经营指标分析与预警');
  const rows=structuredClone(list(input.rows,'rows')),metrics=unique(structuredClone(list(input.metrics,'metrics')),'id','metrics'),rules=unique(structuredClone(list(input.rules,'rules',{empty:true})),'id','rules');
  const keys=new Set();for(const [i,r] of rows.entries()){
    requireValue(text(r.entity)&&text(r.period)&&r.values&&typeof r.values==='object'&&!Array.isArray(r.values),'rows.'+i,'数据行需含经营单元、期间及数值对象');
    const key=JSON.stringify([r.entity,r.period]);requireValue(!keys.has(key),'rows.'+i,'同一单元、期间存在重复行');keys.add(key);
    for(const [field,value] of Object.entries(r.values))requireValue(value===null||typeof value==='number'&&Number.isFinite(value),'rows.'+i+'.'+field,'数值只接受有限数字或明确的 null，不自动把空值转成零');
    r.verifiedEvidence=evidence(c,r.evidence,'rows.'+i+'.evidence');
    for(const value of Object.values(r.values).filter(v=>v!==null))requireValue(r.evidence.quote.includes(String(value)),'rows.'+i+'.evidence','数值未出现在所引数据原文中');
  }
  for(const [id,m] of metrics){
    requireValue(text(m.label)&&text(m.unit)&&['value','difference','ratio'].includes(m.operation),'metrics.'+id,'指标需含名称、单位和 value、difference 或 ratio 运算');
    requireValue(text(m.left)&&(m.operation==='value'||text(m.right)),'metrics.'+id,'指标缺少字段');
    requireValue(m.multiplier===undefined||typeof m.multiplier==='number'&&Number.isFinite(m.multiplier),'metrics.'+id,'倍率须为有限数字');
    m.verifiedEvidence=evidence(c,m.evidence,'metrics.'+id+'.evidence');
  }
  for(const [id,r] of rules){requireValue(metrics.has(r.metricId)&&Object.hasOwn(operators,r.operator)&&typeof r.threshold==='number'&&Number.isFinite(r.threshold),'rules.'+id,'预警需指向有效指标，并给出比较符和有限阈值');r.verifiedEvidence=evidence(c,r.evidence,'rules.'+id+'.evidence');}
  const results=[],alerts=[];
  for(const row of rows)for(const [id,m] of metrics){
    const a=row.values[m.left],b=row.values[m.right];let value=null,reason='';
    if(a===null||a===undefined||m.operation!=='value'&&(b===null||b===undefined))reason='指标所需字段缺失';
    else if(m.operation==='ratio'&&b===0)reason='分母为零';
    else {value=(m.operation==='value'?a:m.operation==='difference'?a-b:a/b)*(m.multiplier??1);if(!Number.isFinite(value)){value=null;reason='计算结果超出有限数值范围';}}
    const location=row.entity+'/'+row.period+'/'+id;
    if(reason)c.diagnostics.push(diagnostic('G5_UNCALCULABLE',location,reason,'补齐数据或确认业务口径后重算'));
    const result={entity:row.entity,period:row.period,metricId:id,label:m.label,value,unit:m.unit,formula:m.operation==='value'?m.left:`${m.left} ${m.operation==='difference'?'-':'/'} ${m.right}`,multiplier:m.multiplier??1,status:reason||'已计算',dataEvidence:row.verifiedEvidence,definitionEvidence:m.verifiedEvidence};results.push(result);
    if(value!==null)for(const [ruleId,r] of rules)if(r.metricId===id&&operators[r.operator](value,r.threshold)){
      alerts.push({...result,ruleId,operator:r.operator,threshold:r.threshold,ruleEvidence:r.verifiedEvidence});
      c.diagnostics.push(diagnostic('G5_THRESHOLD',location,`${m.label}=${value}${m.unit}，触发 ${ruleId} ${r.operator} ${r.threshold}`,'核实数据与业务原因，记录处理动作'));}
  }
  c.tables.push({title:'指标计算',columns:['经营单元','期间','指标','数值','单位','状态'],rows:results.map(r=>[r.entity,r.period,r.label,r.value===null?'待补充':r.value,r.unit,r.status])},{title:'预警清单',columns:['经营单元','期间','指标','数值','规则','阈值'],rows:alerts.map(r=>[r.entity,r.period,r.label,r.value,r.ruleId,r.operator+' '+r.threshold])});
  return finish(c,{results,alerts},`计算 ${results.length} 项指标，触发 ${alerts.length} 条预警，${results.filter(r=>r.value===null).length} 项无法计算。`);
}
cli(run,import.meta.url);
