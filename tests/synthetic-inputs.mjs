// 仅用于程序验证的抽象字段与合成数值，不包含业务材料或业务案例。
const lines=['a=10 b=2','a=11','x','y','z','a / b * 100 U','gt 400','F1 R1 S1','K1','2026-02-28','2026-02-30','true false','0'];
export function synthetic(group) {
  const body=lines.join('\n');
  const ref=quote=>({sourceId:'S',start:body.indexOf(quote),locator:'合成字符 '+body.indexOf(quote),quote});
  const base={schema:'huaxin-workshop-input/1',group,fixture:true,scope:'抽象协议与规则测试',sources:[{id:'S',title:'合成技术测试文本',version:'T1',text:body}]};
  const data={
    G1:{profession:'P',fields:[{key:'a',label:'字段甲'}],documents:[{id:'D1',name:'输入甲',records:[{key:'K1',values:{a:10},units:{a:'U'},evidence:{a:ref('a=10 b=2')}}]},{id:'D2',name:'输入乙',records:[{key:'K1',values:{a:11},units:{a:'U'},evidence:{a:ref('a=11')}}]}]},
    G2:{requirements:[{id:'Q1',text:'x',evidence:ref('x')}],coverage:[{requirementId:'Q1',assessment:'full',reason:'抽象映射验证',evidence:[ref('y')]}]},
    G3:{topic:'抽象条目',audience:'协议测试',asOf:'2026-10-28',policies:[{sourceId:'S',publishedOn:'2026-01-01',effectiveOn:'2026-01-02'}],claims:[{id:'C1',kind:'fact',text:'x',evidence:[ref('x')]}]},
    G4:{stage:'T',requirements:[{id:'Q1',title:'字段甲',required:true,revision:'R1',acceptedStatuses:['S1'],evidence:ref('F1 R1 S1')}],files:[{id:'F1',requirementId:'Q1',filename:'F1',revision:'R1',status:'S1',evidence:ref('F1 R1 S1')}]},
    G5:{rows:[{entity:'E1',period:'T1',values:{a:10,b:2},evidence:ref('a=10 b=2')}],metrics:[{id:'M1',label:'字段甲',unit:'U',operation:'ratio',left:'a',right:'b',multiplier:100,evidence:ref('a / b * 100 U')}],rules:[{id:'R1',metricId:'M1',operator:'gt',threshold:400,evidence:ref('gt 400')}]},
    G6:{fields:[{key:'a',label:'字段甲',required:true}],existing:[{key:'K1',values:{a:'x'}}],incoming:[{key:'K1',values:{a:'y'},evidence:{a:ref('y')}}]},
    G7:{formId:'F1',recordKey:'K1',fields:[{id:'a',label:'字段甲',type:'enum',required:true,options:['x','y']}],values:{a:'x'},evidence:{a:ref('x')}}
  };
  return {...base,...data[group]};
}
export function reference(input,quote){return {sourceId:'S',start:input.sources[0].text.indexOf(quote),locator:'合成字符',quote};}
