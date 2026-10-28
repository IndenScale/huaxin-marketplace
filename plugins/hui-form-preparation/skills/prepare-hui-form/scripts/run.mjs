import {context,list,unique,text,present,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

export function run(input) {
  const c=context(input,'G7','慧作业填报准备');
  requireValue(text(input.formId)&&text(input.recordKey),'formId/recordKey','请明确目标表单及业务记录标识');
  const fields=unique(list(input.fields,'fields'),'id','fields');
  requireValue(input.values&&typeof input.values==='object'&&!Array.isArray(input.values),'values','填报值须为对象');
  for(const id of Object.keys(input.values))requireValue(fields.has(id),'values.'+id,'存在未定义的表单字段');
  const results=[];
  for(const [id,f] of fields){
    requireValue(text(f.label)&&['string','number','boolean','date','enum'].includes(f.type)&&typeof f.required==='boolean','fields.'+id,'字段需含名称、有效类型及 required 布尔值');
    if(f.type==='enum')requireValue(Array.isArray(f.options)&&f.options.length>0&&f.options.every(text)&&new Set(f.options).size===f.options.length,'fields.'+id,'枚举项须为不重复的非空文字');
    if(f.maxLength!==undefined)requireValue(Number.isSafeInteger(f.maxLength)&&f.maxLength>0,'fields.'+id,'文字长度上限须为正整数');
    for(const limit of ['min','max'])if(f[limit]!==undefined)requireValue(typeof f[limit]==='number'&&Number.isFinite(f[limit]),'fields.'+id,'数值范围须为有限数字');
    requireValue(f.min===undefined||f.max===undefined||f.min<=f.max,'fields.'+id,'最小值不能大于最大值');
    const v=input.values[id];let status='可供确认',ref=null,reason='';
    if(!present(v)){status=f.required?'必填缺失':'未填写（可选）';if(f.required)reason='必填项未提供';}
    else {
      ref=evidence(c,input.evidence?.[id],'values.'+id,{value:v});
      if(f.type==='string'&&(typeof v!=='string'||!v.trim()||f.maxLength!==undefined&&[...v].length>f.maxLength))reason='文字类型或长度不符合要求';
      if(f.type==='number'&&(typeof v!=='number'||!Number.isFinite(v)||f.min!==undefined&&v<f.min||f.max!==undefined&&v>f.max))reason='数值类型或范围不符合要求';
      if(f.type==='boolean'&&typeof v!=='boolean')reason='须为布尔值';
      if(f.type==='enum'&&!f.options.includes(v))reason='不在允许选项中';
      if(f.type==='date'&&(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))reason='日期须为有效的 YYYY-MM-DD';
      if(reason)status='字段待修订';
    }
    if(reason)c.diagnostics.push(diagnostic('G7_FIELD',id,reason,'按目标表单规则补齐或修正，并保留来源'));
    results.push({id,label:f.label,type:f.type,value:v??null,status,evidence:ref});
  }
  c.tables.push({title:'填报内容预览',columns:['字段标识','字段名称','类型','值','状态','原文位置'],rows:results.map(r=>[r.id,r.label,r.type,r.value,r.status,r.evidence?r.evidence.sourceId+' '+r.evidence.locator:''])});
  return finish(c,{formId:input.formId,recordKey:input.recordKey,results,validationPassed:c.diagnostics.length===0,submission:{state:'prepared',submitted:false,platformConnected:false}},`准备 ${results.length} 个字段，${c.diagnostics.length} 个字段需要处理。下一步核对目标表单并确认填报内容。`);
}
cli(run,import.meta.url);
