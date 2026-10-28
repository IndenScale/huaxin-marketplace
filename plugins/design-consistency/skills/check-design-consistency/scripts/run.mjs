import {context,list,unique,text,present,requireValue,evidence,diagnostic,finish,cli} from './common.mjs';

export function run(input) {
  const c=context(input,'G1','设计文档一致性核对');
  requireValue(text(input.profession),'profession','请指定无线或传输等单一专业');
  const fields=unique(list(input.fields,'fields'),'key','fields');
  requireValue(fields.size<=30,'fields','单次最多核对 30 个指定字段');
  for(const f of fields.values())requireValue(text(f.label),'fields.'+f.key,'请填写字段名称');
  const docs=list(input.documents,'documents');requireValue(docs.length===2,'documents','本任务核对两类文档');
  unique(docs,'id','documents');
  const maps=docs.map((d,i)=>{requireValue(text(d.name),'documents.'+i,'请填写文档名称');return unique(list(d.records,'documents.'+i+'.records'),'key','documents.'+i+'.records');});
  const cells=maps.map((map,di)=>{
    const result=new Map();for(const [key,r] of map){
      requireValue(r.values&&typeof r.values==='object'&&!Array.isArray(r.values),'records.'+key+'.values','字段值须为对象');
      const row=new Map();for(const f of fields.values())if(present(r.values[f.key])){
        const v=r.values[f.key];requireValue(typeof v==='string'||typeof v==='number'&&Number.isFinite(v),'records.'+key+'.'+f.key,'只接受文字或有限数值');
        const ref=evidence(c,r.evidence?.[f.key],`documents[${di}].${key}.${f.key}`,{value:v});
        row.set(f.key,{value:v,unit:r.units?.[f.key]||'',evidence:ref});
      }result.set(key,row);
    }return result;
  });
  const findings=[];
  for(const key of new Set([...maps[0].keys(),...maps[1].keys()]))for(const f of fields.values()){
    const left=cells[0].get(key)?.get(f.key),right=cells[1].get(key)?.get(f.key);
    let rule='G1_MATCH',status='一致',action='';
    if(!left||!right){rule='G1_MISSING';status='缺少字段或对象';action='补齐两份文档中该对象的字段及原文证据';}
    else if(left.unit!==right.unit){rule='G1_UNIT';status='单位待确认';action='核实单位与换算口径后重新核对';}
    else if(String(left.value).trim()!==String(right.value).trim()){rule='G1_DIFFERENCE';status='不一致';action='回查两份原文，确认采用值后修订';}
    const location=key+'/'+f.key;
    if(action)c.diagnostics.push(diagnostic(rule,location,JSON.stringify({left,right}),action));
    findings.push({key,field:f.key,label:f.label,status,left:left||null,right:right||null});
  }
  c.tables.push({title:'字段核对结果',columns:['对象','字段','状态',docs[0].name,docs[1].name,'原文位置'],rows:findings.map(x=>[x.key,x.label,x.status,x.left?`${x.left.value} ${x.left.unit}`:'缺失',x.right?`${x.right.value} ${x.right.unit}`:'缺失',[x.left,x.right].filter(Boolean).map(v=>v.evidence.sourceId+' '+v.evidence.locator).join('；')])});
  return finish(c,{profession:input.profession,findings},`核对 ${findings.length} 项字段，${c.diagnostics.length} 项需要处理。`);
}
cli(run,import.meta.url);
