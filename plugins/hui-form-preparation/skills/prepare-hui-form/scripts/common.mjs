import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export function requireValue(ok, location, evidence, action='按随附输入样例补齐或修正后重试') {
  if (!ok) throw Object.assign(new Error(evidence), {diagnostics:[{rule:'INPUT_INVALID',location,evidence,action,severity:'error'}]});
}
export const text = value => typeof value === 'string' && value.trim().length > 0;
export const present = value => value !== undefined && value !== null && (typeof value!=='string'||value.trim().length>0);
export function list(value, location, {empty=false}={}) {
  requireValue(Array.isArray(value) && (empty || value.length>0) && value.length<=10000,location,'需要有效数组，最多 10000 项');return value;
}
export function unique(items, key, location) {
  const result=new Map();
  for (const [i,item] of items.entries()) {
    requireValue(item && typeof item==='object' && !Array.isArray(item),`${location}[${i}]`,'记录须为对象');
    requireValue(text(item[key]),`${location}[${i}].${key}`,'标识须为非空文字');
    requireValue(!['__proto__','prototype','constructor'].includes(item[key]),`${location}[${i}].${key}`,'标识不能使用对象保留属性名');
    requireValue(!result.has(item[key]),`${location}[${i}].${key}`,'标识重复：'+item[key]);result.set(item[key],item);
  }return result;
}
export function diagnostic(rule,location,evidence,action,severity='warning') {return {rule,location,evidence,action,severity};}
export function context(input, group, title) {
  requireValue(input && typeof input==='object' && !Array.isArray(input),'input','输入须为 JSON 对象');
  requireValue(input.schema==='huaxin-workshop-input/1','schema','输入格式须为 huaxin-workshop-input/1');
  requireValue(input.group===group,'group','场景标识须为 '+group);
  requireValue(text(input.scope),'scope','请明确本次检查范围');
  requireValue(input.fixture===true || input.fixture===false,'fixture','请明确是否为演示数据');
  const sources=unique(list(input.sources,'sources'),'id','sources');
  for(const s of sources.values())requireValue(text(s.title)&&text(s.version)&&text(s.text),'sources.'+s.id,'来源需包含标题、版本和原文');
  return {schema:'huaxin-workshop-result/1',group,title,scope:input.scope,fixture:input.fixture,
    inputSha256:createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    sources:[...sources.values()].map(({id,title,version,text:body})=>({id,title,version,sha256:createHash('sha256').update(body).digest('hex')})),
    diagnostics:[],tables:[],sourcesById:sources};
}
export function evidence(ctx,ref,location,{value}={}) {
  requireValue(ref && typeof ref==='object',location,'缺少来源证据');
  const source=ctx.sourcesById.get(ref.sourceId);
  requireValue(source,location+'.sourceId','来源标识未登记');
  requireValue(Number.isSafeInteger(ref.start)&&ref.start>=0&&text(ref.quote)&&text(ref.locator),location,'证据需含字符起点 start、原文 quote 和业务位置 locator');
  requireValue(source.text.slice(ref.start,ref.start+ref.quote.length)===ref.quote,location,'引文与来源原文或字符位置不一致');
  if(value!==undefined)requireValue(ref.quote.includes(String(value)),location,'字段值未出现在引文中');
  return {sourceId:source.id,version:source.version,locator:ref.locator,start:ref.start,end:ref.start+ref.quote.length,quote:ref.quote};
}
export function finish(ctx,data,summary) {
  const {sourcesById,...result}=ctx;return {...result,summary,...data};
}
const stringify=value=>value===undefined?'':typeof value==='string'?value:JSON.stringify(value);
const escape=value=>stringify(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function markdown(result) {
  const cell=v=>stringify(v).replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
  let body=`# ${result.title}\n\n范围：${result.scope}\n\n数据：${result.fixture?'演示':'用户提供'}\n\n${result.summary}\n`;
  for(const table of result.tables)body+=`\n## ${table.title}\n\n| ${table.columns.map(cell).join(' | ')} |\n| ${table.columns.map(()=> '---').join(' | ')} |\n${table.rows.map(row=>'| '+row.map(cell).join(' | ')+' |').join('\n')}\n`;
  body+='\n## 诊断与修订动作\n\n'+(result.diagnostics.map(d=>`- ${d.rule}｜${d.location}｜${d.evidence}｜${d.action}`).join('\n')||'当前检查未发现诊断项。')+'\n';return body;
}
export function html(result) {
  const tables=result.tables.map(t=>`<section><h2>${escape(t.title)}</h2><div class="table-wrap"><table><thead><tr>${t.columns.map(c=>`<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('');
  const ds=result.diagnostics.map(d=>[d.rule,d.location,d.evidence,d.action]);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(result.title)}</title><style>
:root{color-scheme:light dark;--bg:#f3f6fa;--paper:#fff;--ink:#203247;--line:#d5dfe9;--muted:#52657a;--accent:#175d9b}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 "PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1440px;margin:auto;padding:36px 28px 64px}header{border-left:5px solid var(--accent);padding:4px 0 4px 20px}h1{font-size:28px;font-weight:600;margin:0 0 8px}h2{font-size:18px;font-weight:600;margin:0;padding:16px 20px;border-bottom:1px solid var(--line)}p{margin:6px 0;max-width:80ch}.meta{color:var(--muted);font-size:13px}.toolbar{display:flex;gap:16px;align-items:center;margin:24px 0 12px;flex-wrap:wrap}input{font:inherit;border:1px solid var(--line);border-radius:7px;padding:8px 12px;background:var(--paper);color:inherit;width:min(100%,420px)}input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}section{margin:16px 0 24px;border:1px solid var(--line);border-radius:9px;background:var(--paper);overflow:hidden}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px 16px;border-bottom:1px solid var(--line);vertical-align:top;min-width:110px;overflow-wrap:anywhere}th{font-size:13px;color:var(--muted);font-weight:500;background:var(--bg)}tr:last-child td{border-bottom:0}tbody tr:hover{background:var(--bg)}details{margin-top:28px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.empty{padding:16px 20px;color:var(--muted)}@media(prefers-color-scheme:dark){:root{--bg:#15202d;--paper:#1c2c3e;--ink:#e3edf7;--line:#3b4e64;--muted:#b3c6d9;--accent:#7eb7ec}}@media(max-width:600px){main{padding:20px 12px}h1{font-size:23px}}@media print{.toolbar{display:none}main{padding:0}section{break-inside:avoid}}
</style><main><header><h1>${escape(result.title)}</h1><p>${escape(result.scope)}</p><p class="meta">${result.fixture?'演示数据':'用户提供数据'} · ${escape(result.group)} · 输入指纹 ${escape(result.inputSha256.slice(0,16))}</p><p>${escape(result.summary)}</p></header><div class="toolbar"><input id="query" type="search" aria-label="搜索结果与诊断" placeholder="搜索结果、位置或修订动作"><span id="count" aria-live="polite"></span></div>${tables}<section><h2>诊断与修订动作</h2>${ds.length?`<div class="table-wrap"><table><thead><tr><th>规则</th><th>位置</th><th>证据</th><th>修订动作</th></tr></thead><tbody>${ds.map(r=>`<tr>${r.map(c=>`<td>${escape(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="empty">当前检查未发现诊断项。</p>'}</section><details><summary>查看完整结果与来源指纹</summary><pre>${escape(JSON.stringify(result,null,2))}</pre></details></main><script>const q=document.getElementById('query'),rows=[...document.querySelectorAll('tbody tr')],count=document.getElementById('count');function filter(){let n=0;for(const row of rows){row.hidden=!row.textContent.toLocaleLowerCase().includes(q.value.trim().toLocaleLowerCase());if(!row.hidden)n++}count.textContent=n+' / '+rows.length+' 行'}q.addEventListener('input',filter);filter();</script></html>`;
}
export function cli(run,entry) {
  if(!process.argv[1]||fs.realpathSync(process.argv[1])!==fs.realpathSync(fileURLToPath(entry)))return;
  try {
    const args=process.argv.slice(2);requireValue(args.length===1||args.length===3,'args','用法：node run.mjs 输入.json [--format json|markdown|html]');
    const format=args.length===3&&args[1]==='--format'?args[2]:args.length===1?'json':'';
    requireValue(['json','markdown','html'].includes(format),'format','输出格式须为 json、markdown 或 html');
    const file=path.resolve(args[0]),stat=fs.statSync(file);requireValue(stat.isFile()&&stat.size<=4*1024*1024,'input','输入须为不超过 4 MB 的 JSON 文件');
    const result=run(JSON.parse(fs.readFileSync(file,'utf8')));
    process.stdout.write(format==='html'?html(result):format==='markdown'?markdown(result):JSON.stringify(result,null,2)+'\n');
  } catch(error) {
    process.stderr.write(JSON.stringify({ok:false,diagnostics:error.diagnostics||[diagnostic('INPUT_READ','input',error.message,'检查 JSON 文件和运行参数','error')]},null,2)+'\n');process.exitCode=1;
  }
}
