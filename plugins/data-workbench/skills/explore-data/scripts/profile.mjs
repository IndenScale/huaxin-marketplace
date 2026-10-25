import fs from 'node:fs';
import path from 'node:path';
// A bounded RFC 4180 reader. Quoted delimiters, newlines and escaped quotes are retained.
export function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
 const push=()=>{row.push(cell);cell='';closed=false;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new Error('CSV 引号位置无效');quoted=true;}
  else if(c===','){push();}
  else if(c==='\n'||c==='\r'){push();rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
  else{if(closed)throw new Error('CSV 引号后有多余字符');cell+=c;}
 }
 if(quoted)throw new Error('CSV 引号未闭合');
 if(cell||row.length||closed){push();rows.push(row);}
 return rows;
}
export function profileCSV(text){
 const [headers,...rows]=parseCSV(text);if(!headers?.length)throw new Error('CSV 为空');
 if(new Set(headers).size!==headers.length||headers.some(h=>!h.trim()))throw new Error('CSV 表头为空或重复，请先明确字段');
 const invalid=rows.map((row,index)=>({line:index+2,columns:row.length})).filter(r=>r.columns!==headers.length);
 if(invalid.length)throw new Error('CSV 字段数不一致，记录位置：'+invalid.slice(0,10).map(r=>r.line).join('、'));
 const columns=headers.map((name,i)=>{
  const values=rows.map(row=>row[i]),nonempty=values.filter(v=>v.trim()!==''),numeric=nonempty.filter(v=>/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())).map(Number).filter(Number.isFinite),unique=new Set(nonempty);
  const result={name,missing:values.length-nonempty.length,distinct:unique.size,numericValues:numeric.length};
  if(numeric.length){const sorted=numeric.slice().sort((a,b)=>a-b),n=sorted.length;Object.assign(result,{min:sorted[0],max:sorted[n-1],mean:numeric.reduce((sum,n)=>sum+n,0)/n,median:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2});}
  return result;
 });
 return {records:rows.length,duplicateRecords:rows.length-new Set(rows.map(row=>JSON.stringify(row))).size,columns};
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
 try{const file=process.argv[2];if(!file||!path.isAbsolute(file))throw new Error('请提供 CSV 文件的绝对路径');if(fs.statSync(file).size>20*1024*1024)throw new Error('文件超过 20 MB，请先分批处理');const text=new TextDecoder('utf-8',{fatal:true}).decode(fs.readFileSync(file));console.log(JSON.stringify(profileCSV(text),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
