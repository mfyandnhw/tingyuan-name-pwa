const APP_VERSION = "0.1.5";
const $ = (s) => document.querySelector(s);
const state = { rules:null, traits:null, traditional:null, ocr:null, interpretations:null, strokes:null, surnames:null, nameOverrides:null, strokeVariants:null, chart:null, currentName:"", currentStrokes:[], surnameLength:1, deferredInstall:null };
const COMPOUNDS = new Set(("欧阳 歐陽 太史 端木 上官 司马 司馬 东方 東方 独孤 獨孤 南宫 南宮 万俟 萬俟 闻人 聞人 夏侯 诸葛 諸葛 尉迟 尉遲 公羊 赫连 赫連 澹台 皇甫 宗政 濮阳 濮陽 公冶 太叔 申屠 公孙 公孫 慕容 仲孙 仲孫 钟离 鍾離 长孙 長孫 宇文 司徒 鲜于 鮮于 司空 闾丘 閭丘 子车 子車 亓官 司寇 巫马 巫馬 公西 颛孙 顓孫 壤驷 壤駟 公良 漆雕 乐正 樂正 宰父 谷梁 谷樑 拓跋 夹谷 夾谷 轩辕 軒轅 令狐 段干 百里 呼延 东郭 東郭 南门 南門 羊舌 微生 梁丘 左丘 东门 東門 西门 西門 第五 公仪 公儀 公乘 公皙 南荣 南榮 东里 東里 申叔").split(" "));
const GRID_NAMES = ["天格","人格","地格","变格","外格","总格"];
const ELEMENTS = ["木","火","土","金","水"];
const STORAGE = { history:"tingyuan_history_v1", overrides:"tingyuan_stroke_overrides_v1" };

async function loadData(){
  const files = ["rules","interpretations","numerology-traits","strokes","surnames","name-strokes","stroke-variants","traditional-rules","numerology-ocr"];
  const values = await Promise.all(files.map(async n => {
    const r = await fetch(`./assets/${n}.json`);
    if(!r.ok) throw new Error(`数据文件加载失败：${n}.json`);
    return r.json();
  }));
  [state.rules,state.interpretations,state.traits,state.strokes,state.surnames,state.nameOverrides,state.strokeVariants,state.traditional,state.ocr] = values;
  renderNumberGrid();
}
function codepoints(s){ return [...s]; }
function norm(n){ return n<=81?n:((n-1)%80)+1; }
function element(n){ const x=n%10; return (x===1||x===2)?"木":(x===3||x===4)?"火":(x===5||x===6)?"土":(x===7||x===8)?"金":"水"; }
function grade(n){ const r=state.rules.numbers[norm(n)-1]; return $("#gender").value==="female"?r.female:r.male; }
function isGood(g){ return g==="吉"||g==="大吉"; }
function getSurnameLength(name){
  const mode=$("#surnameMode").value;
  if(mode==="1") return 1;
  if(mode==="2") return 2;
  return codepoints(name).length>=3 && COMPOUNDS.has(codepoints(name).slice(0,2).join("")) ? 2 : 1;
}
function autoStroke(ch,isSurname){
  const overrides=JSON.parse(localStorage.getItem(STORAGE.overrides)||"{}");
  const key=(isSurname?"s:":"n:")+ch;
  if(overrides[key]) return {value:Number(overrides[key]),source:"手动"};
  const direct=(isSurname?state.surnames[ch]:state.nameOverrides[ch]);
  if(Number.isInteger(direct)) return {value:direct,source:"原版字库"};
  const general=state.strokes[ch];
  return Number.isInteger(general)?{value:general,source:"康熙字库"}:{value:"",source:"未收录"};
}
function updateStrokeEditor(){
  const name=$("#nameInput").value.trim();
  const chars=codepoints(name);
  const len=name?getSurnameLength(name):1;
  state.surnameLength=len;
  const root=$("#strokeEditor");
  root.innerHTML="";
  chars.forEach((ch,i)=>{
    const info=autoStroke(ch,i<len);
    const cell=document.createElement("div"); cell.className="stroke-cell";
    const label=document.createElement("label");
    label.innerHTML=`<span>${ch} · ${i<len?"姓":"名"}</span><span>${i+1}</span>`;
    const input=document.createElement("input");
    input.type="number"; input.min="1"; input.max="80"; input.inputMode="numeric"; input.value=info.value;
    input.dataset.index=String(i); input.setAttribute("aria-label",`${ch}的笔画`);
    const small=document.createElement("small"); small.textContent=info.source;
    input.addEventListener("change",()=>{small.textContent="本次手动";});
    cell.append(label,input,small); root.append(cell);
  });
  $("#inputHint").textContent = chars.length ? `已识别姓氏${len}字；可直接修改每个字的笔画。` : "笔画优先读取原版康熙字库；未收录的字可手动补充。";
}
function readStrokes(){
  const inputs=[...$("#strokeEditor").querySelectorAll("input")];
  return inputs.map(x=>Number(x.value));
}
function calculateChart(strokes,surnameLength){
  if(strokes.length<2||strokes.length>4) throw new Error("姓名总字数需为二至四字。");
  if(strokes.some(n=>!Number.isInteger(n)||n<1||n>80)) throw new Error("每个字的笔画必须是 1—80 之间的整数。");
  if(surnameLength<1||surnameLength>2||surnameLength>=strokes.length) throw new Error("姓氏字数与姓名长度不匹配。");
  const compoundSingle=surnameLength===2&&strokes.length===3;
  let slots;
  if(compoundSingle) slots=[strokes[0],strokes[1],strokes[2],1];
  else if(strokes.length===2) slots=[1,strokes[0],strokes[1],1];
  else if(strokes.length===3) slots=[1,strokes[0],strokes[1],strokes[2]];
  else slots=strokes.slice();
  const total=strokes.reduce((a,b)=>a+b,0);
  const grids=[
    slots[0]+slots[1],
    slots[1]+slots[2],
    slots[2]+slots[3],
    slots[1]+((strokes.length===2||compoundSingle)?slots[2]:slots[3]),
    slots[0]+slots[3],
    total
  ];
  const triad=grids.slice(0,3).map(element).join("");
  return {strokes,slots,grids,triad,compoundSingle,surnameLength};
}
function saveManualStrokes(name,strokes,surnameLength){
  const chars=codepoints(name), overrides=JSON.parse(localStorage.getItem(STORAGE.overrides)||"{}");
  chars.forEach((ch,i)=>{
    const info=autoStroke(ch,i<surnameLength);
    if(Number(strokes[i])!==Number(info.value)){
      overrides[(i<surnameLength?"s:":"n:")+ch]=Number(strokes[i]);
    }
  });
  localStorage.setItem(STORAGE.overrides,JSON.stringify(overrides));
}
function calculate(){
  $("#formError").textContent="";
  const name=$("#nameInput").value.trim(), chars=codepoints(name);
  if(chars.length<2||chars.length>4){$("#formError").textContent="请输入二至四字姓名。";return;}
  const surnameLength=getSurnameLength(name);
  if(surnameLength>=chars.length){$("#formError").textContent="姓氏以外还需要至少一个名字字。";return;}
  const strokes=readStrokes();
  if(strokes.length!==chars.length||strokes.some(n=>!Number.isInteger(n)||n<1||n>80)){ $("#formError").textContent="请检查每个字的笔画，必须是 1—80 之间的整数。";return; }
  try{
    const chart=calculateChart(strokes,surnameLength);
    state.chart=chart; state.currentName=name; state.currentStrokes=strokes;
    saveManualStrokes(name,strokes,surnameLength);
    renderResult(name,chart);
    $("#resultSection").hidden=false;
    $("#resultSection").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){$("#formError").textContent=e.message;}
}

function chartRows(name, chart){
  const chars = codepoints(name);
  return chars.map((ch, i) => ({ ch, stroke: chart.strokes[i], isSurname: i < chart.surnameLength }));
}
function gridButtonMarkup(label, raw, cls){
  const n = norm(raw), g = grade(raw), el = element(raw);
  return `<div class="visual-badge-name">${label}</div><div class="visual-badge-num">${raw}</div><div class="visual-badge-meta">${el} · ${g}</div>`;
}
function renderChartVisual(name, chart, triadGrade){
  const rows = chartRows(name, chart);
  const genderLabel = $("#gender").value === "female" ? "女" : "男";
  const wrapper = document.createElement("div");
  wrapper.className = "chart-visual-card";
  wrapper.innerHTML = `
    <div class="visual-header">
      <div>
        <div class="visual-name">${escapeHTML(name)}</div>
        <div class="visual-subtitle">六格排盘</div>
      </div>
      <div class="visual-gender">${genderLabel}</div>
    </div>
    <div class="visual-body">
      ${chart.slots[0] === 1 ? '<div class="virtual-mark top">+1</div>' : ''}
      <div class="line line-right-top"></div>
      <div class="line line-right-mid"></div>
      <div class="line line-right-bottom"></div>
      <div class="line line-left-outer"></div>
      <div class="line line-left-inner"></div>
      <div class="name-stack">
        ${rows.map(r => `<div class="name-row"><span class="name-char">${escapeHTML(r.ch)}</span><span class="name-stroke">${r.stroke}</span></div>`).join("")}
        ${chart.slots[3] === 1 ? '<div class="virtual-mark bottom">+1</div>' : ''}
      </div>
      <button class="visual-badge right tian" data-grid="0">${gridButtonMarkup("天格", chart.grids[0])}</button>
      <button class="visual-badge right ren" data-grid="1">${gridButtonMarkup("人格", chart.grids[1])}</button>
      <button class="visual-badge right di" data-grid="2">${gridButtonMarkup("地格", chart.grids[2])}</button>
      <button class="visual-badge left wai" data-grid="4">${gridButtonMarkup("外格", chart.grids[4])}</button>
      <button class="visual-badge left bian" data-grid="3">${gridButtonMarkup("变格", chart.grids[3])}</button>
      <button class="visual-total" data-grid="5"><span>总格</span><strong>${chart.grids[5]}</strong></button>
    </div>
    <div class="visual-footer">
      <div class="triad-summary-left">天・人・地</div>
      <div class="triad-summary-right">${chart.triad} · ${triadGrade}</div>
    </div>
    <div class="visual-link-hint">点击各格数字查看六格数理 ›</div>
  `;
  wrapper.querySelectorAll("[data-grid]").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.grid);
      const raw = chart.grids[index];
      const n = norm(raw);
      openNumber(n, `${GRID_NAMES[index]} · ${raw}（数理${n}）`, grade(raw));
    });
  });
  return wrapper;
}

// 本版使用有来源的数理标签和保守的近义分组，不进行自由推断。
const SIMILAR_GROUPS = [
  {label:"仁慈与宽厚", members:["善良仁慈","温和温良","雅量宽厚"], terms:["仁慈","温和","宽厚"]},
  {label:"正直与诚信", members:["正直诚信","忠厚老实","重承诺"], terms:["正直","诚信","忠厚"]},
  {label:"勤奋与上进", members:["勤奋上进","事业心强"], terms:["上进","事业心"]},
  {label:"果断与意志", members:["果断决断","意志坚定"], terms:["果断","坚定"]},
  {label:"独立与自主", members:["独立自主"], terms:["独立"]},
  {label:"聪慧与才智", members:["聪明智慧"], terms:["聪明","智慧"]},
  {label:"务实与踏实", members:["脚踏实地"], terms:["踏实"]},
  {label:"直率表达", members:["心直口快"], terms:["直说","直爽"]},
  {label:"固执与坚持己见", members:["固执任性"], terms:["固执"]},
  {label:"协调与交际", members:["善于协调","人缘好"], terms:["协调","人缘"]},
  {label:"领导与组织", members:["领导能力"], terms:["领导"]},
  {label:"艺术与才艺", members:["学识才艺"], terms:["才艺"]}
];
const SIMILAR_LOOKUP = new Map(SIMILAR_GROUPS.flatMap(g=>g.members.map(name=>[name,g.label])));
function groupOfTrait(name){return SIMILAR_LOOKUP.get(name)||name;}
function chartEvidence(chart){
  const notes=[];
  // 天格仅用于展现结构，不用于重复统计。
  chart.grids.forEach((raw,i)=>{
    if(i===0)return;
    const n=norm(raw), grid=GRID_NAMES[i];
    const list=state.traits.numbers[String(n)]||[];
    for(const item of list){
      if(item.name)notes.push({grid,raw,number:n,tag:item.name,group:groupOfTrait(item.name),detail:item.evidence?.join('、')||item.name,source:`${n} 数理特质索引`});
    }
  });
  const ren=chart.grids[1],el=element(ren),yy=ren%2===1?'阳':'阴';
  const personalityLabels = {
    木:[['善良仁慈','人格木：仁慈'],['正直诚信','人格木：正直'],['勤奋上进','人格木：上进']],
    火:[],
    土:[['正直诚信','人格土：信用'],['脚踏实地','人格土：做事踏实']],
    金:[],
    水:[['聪明智慧','人格水：聪明']]
  };
  const byYinYang={
    '阳火':[['心直口快','人格阳火：不开心或生气会直说']],
    '阳土':[['固执任性','人格阳土：固执']],
    '阳金':[['心直口快','人格阳金：做事直爽']]
  };
  for(const [tag,detail] of [...(personalityLabels[el]||[]),...(byYinYang[yy+el]||[])]){
    notes.push({grid:'人格',raw:ren,number:norm(ren),tag,group:groupOfTrait(tag),detail,source:'《人格》'});
  }
  // 同一格内即使来自不同文档、用词不同，也只能算一次。
  const groups=new Map();
  for(const item of notes){
    if(!groups.has(item.group))groups.set(item.group,new Map());
    const byGrid=groups.get(item.group);
    if(!byGrid.has(item.grid))byGrid.set(item.grid,[]);
    byGrid.get(item.grid).push(item);
  }
  const repeated=[...groups].filter(([,g])=>g.size>=2).map(([label,g])=>({
    label, count:g.size,
    sources:[...g].map(([grid,items])=>({grid,raw:items[0].raw,items}))
  })).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
  return {notes,groups,repeated};
}
function renderIntegrated(chart){
  const root=$('#integratedContent');root.innerHTML='';
  const data=state.traditional, evidence=chartEvidence(chart);
  const addSection=(title,description,rows=[])=>{
    const section=document.createElement('section');section.className='integrated-section';
    const heading=document.createElement('h4');heading.textContent=title;section.append(heading);
    const copy=document.createElement('p');copy.className='integrated-description';copy.textContent=description;section.append(copy);
    for(const row of rows){
      const item=document.createElement('div');item.className='integrated-row';
      const h=document.createElement('strong');h.textContent=row.title;
      const p=document.createElement('p');p.textContent=row.body;item.append(h,p);section.append(item);
    }
    root.append(section);
  };
  const repeated=evidence.repeated;
  addSection('一、跨格近义特质',
    `统计人格、地格、变格、外格、总格，天格不计入；同一格内同类词只记一次。本次识别到 ${repeated.length} 组跨格重复。`,
    repeated.length?repeated.map(r=>({title:`${r.label} · ${r.count} 格呼应`,body:r.sources.map(s=>`${s.grid}${s.raw}：${s.items.map(i=>`${i.detail}〔${i.source}〕`).join('；')}`).join('\n')})):[{title:'暂无可核验的跨格重复',body:'仅代表当前已录入的数理特质与文档语义表没有形成两格以上呼应；不表示不存在其他传统解释。'}]);
  const person=chart.grids[1],el=element(person),yy=person%2?'阳':'阴';
  const personality=data.personality[el];
  addSection('二、人格专属解读',`人格 ${person}（数理 ${norm(person)}）为${yy}${el}。人格五行与阴阳描述仅在“人格”这一格触发，不能把其他格的同数字当成人格解释。`,[
    {title:`${el} · ${personality.principle}`,body:`文档原文概述：${personality.base}（依据《人格》）`},
    {title:`${yy}${el}`,body:`文档原文概述：${yy==='阳'?personality.yang:personality.yin}（依据《人格》；阴阳按奇数阳、偶数阴的可修改约定）`}
  ]);
  const specs=data.special;
  const gridRules=[];
  chart.grids.forEach((raw,i)=>{
    if(i===0)return;
    const n=norm(raw),grid=GRID_NAMES[i];
    const add=(title,body,source)=>gridRules.push({title:`${grid}${raw} · ${title}`,body:`${body}〔${source}〕`});
    if(specs.imperial.includes(n))add('帝王术数字',`数理 ${n} 出现在${grid}，对应《特殊格局》所列帝王术。`, '《特殊格局》');
    if(specs.smallImperial.includes(n))add('小帝王术数字','29 在该格，文档列为“小帝王术”。','《特殊格局》');
    if(specs.art.includes(n))add('艺术格数字','20 在该格，文档列为“艺术格”。','《特殊格局》');
    if(specs.official.includes(n))add('官方方向数字','19 在该格，文档描述为“容易向官方走”。','《特殊格局》');
    if(specs.sickWood.includes(n))add('病木标记','属于文档所列“病木”数字，仅按传统类别展示，不作健康诊断。','《相克》');
    if(specs.longevityEarth.includes(n))add('福寿土标记','属于文档所列“福寿土”数字；不据此判断真实寿命。','《相克》');
    if(i===2 && n===9)add('地格专属数字 9','资料专门强调“地格有9”，此处只识别其格位与数理，不采信其寿命断言。','《特殊格局》');
    if(i===1 && n===10)add('人格专属数字 10','资料专门强调“人格有10”，此处只识别其格位与数理，不采信其寿命断言。','《特殊格局》');
    if((i===2||i===5)&&specs.familyNumbers.includes(n))add('家庭相关数字','文档将这些数字写在“地格大凶、家庭格／总格”一段；家庭格的完整算法尚不明确，本版仅在地格或总格显示提示，不作确定结论。','《特殊格局》');
  });
  addSection('三、格位限定与特殊数字',
    '只有数理出现在要求的格位，才触发相应专属说明。其他格出现同数字不冒充人格或地格专属规则；天格不纳入此段。',
    gridRules.length?gridRules:[{title:'未触发已明确的专属数字条件',body:'仍可在六格卡片点击查看对应数理原文。'}]);
  const five=[];
  chart.grids.forEach((raw,i)=>{
    if(i===0)return;
    const n=norm(raw),list=state.traits.numbers[String(n)]||[];
    five.push({title:`${GRID_NAMES[i]} ${raw} · ${element(raw)} · ${grade(raw)}`,body:list.length?`当前数理标签：${list.map(x=>x.name).join('、')}。\n索引证据：${list.map(x=>`${x.name}（${(x.evidence||[]).join('、')||'已整理标签'}）`).join('；')}。`:`该数理暂无人工核对的特质标签；点击排盘格可查看原始数理图片。`});
  });
  addSection('四、各格数理依据',
    '逐格列出五行、吉凶与当前数理特质标签；这些标签来自已有数理索引，不代表完整原文已全部转成可检索文本。',five);
  const tian=element(chart.grids[0]),ren=element(chart.grids[1]);
  const controls=(a,b)=>{const seq=['木','火','土','金','水'];return (seq.indexOf(a)+2)%5===seq.indexOf(b);};
  let relationship=`天格为${tian}、人格为${ren}：`;
  if(controls(ren,tian))relationship+='按常见五行相克顺序，属于“人克天”；《特殊格局》将其与顶撞上级的传统描述联系。';
  else if(controls(tian,ren))relationship+='按常见五行相克顺序，属于“天克人”。';
  else if(tian===ren)relationship+='五行相同。';
  else relationship+='未形成直接相克。';
  addSection('五、三才与五行关系',
    '天格可参与五行结构关系描述，但不参与命理特质的重复计数，也不根据天格推断个人吉凶。',[
      {title:`三才：${chart.triad}`,body:`传统三才等级：${state.rules.triads.find(x=>x.elements===chart.triad)?.grade||'未整理'}。`},
      {title:'人格与天格',body:relationship+'（依据《特殊格局》及《相克》；相克顺序是通行五行约定）'}
    ]);
  const ages=data.ageStages.map(x=>`${x.start}–${x.end}岁：${x.name}`).join('；');
  addSection('六、年龄阶段',
    `资料将年龄区间划分为：${ages}。资料没有提供全部格位与各阶段的完整对应计算公式，因此不会凭空填写某一年龄段的吉凶。`,[]);
  const notice=document.createElement('p');notice.className='integrated-caveat';notice.textContent='以上为传统姓名学文本的规则匹配与资料整理，不构成科学验证的人格、疾病、寿命、婚姻或职业预测。原始数理图片仍可逐格点击查看；31个数理仍缺人工确认的特质标签，已另行加入81数理OCR候选分析，但其内容需要对照原始图片逐条校对。';root.append(notice);
}


// OCR 未经逐条人工校对；格位匹配仅使用 OCR 中出现的明确位置词。
function perGridOcr(chart){
  const result=[];
  for(let i=1;i<chart.grids.length;i++){
    const raw=chart.grids[i],n=norm(raw),grid=GRID_NAMES[i];
    for(const rule of state.ocr.numbers[String(n)]?.scoped||[]){
      if(rule.slots.includes(grid))result.push({grid,raw,number:n,text:rule.text,trigger:rule.trigger,page:rule.page});
    }
  }
  return result;
}
const OCR_TRAIT_TERMS=[
  {label:'仁慈与善良',patterns:['仁慈','善良','仁爱','心肠软']},
  {label:'正直与诚信',patterns:['正直','诚信','忠厚','信誉良好','守信用']},
  {label:'勤奋与上进',patterns:['勤奋','上进','努力','奋斗','进取']},
  {label:'聪明与才智',patterns:['聪明','智慧','智达','聪慧','才智','机敏']},
  {label:'领导与组织',patterns:['首领','领导','领袖','统率']},
  {label:'温和与宽厚',patterns:['温和','温良','宽厚','包容']},
  {label:'务实与踏实',patterns:['踏实','务实','脚踏实地']},
  {label:'直率与爽直',patterns:['直爽','直率','心直口快']},
  {label:'固执与倔强',patterns:['固执','倔强','一根筋']},
  {label:'独立与自主',patterns:['独立','自主','自立']},
  {label:'艺术与才艺',patterns:['艺术','才艺','技艺','文艺']},
  {label:'投机倾向',patterns:['投机','冒险']},
  {label:'孤独与孤立',patterns:['孤独','孤立','孤寡']},
  {label:'自尊与好强',patterns:['自尊','要面子','好强']},
  {label:'人际与交际',patterns:['人缘','交际','交友','善于协调']}
];
function getOcrCandidates(chart){
  const result=new Map();
  chart.grids.forEach((raw,i)=>{
    if(i===0)return; // 天格永不统计
    const grid=GRID_NAMES[i],number=norm(raw),info=state.ocr.numbers[String(number)];
    if(!info)return;
    // 规则仅从含义正文起抽取，避免‘健康’‘基业’等其他分段干扰；
    // 如果 OCR 没正确识别含义字段，则仅在明确格位句里匹配。
    const common=info.sections.map(s=>{
      const m=s.text.match(/(?:含义|合义)\s*[:：;]/);
      return m?s.text.slice(m.index+m[0].length):'';
    }).join(' ');
    const specific=info.scoped.filter(s=>s.slots.includes(grid)).map(s=>s.text).join(' ');
    const scopeExcluded=info.scoped.map(s=>s.text).join(' ');
    const source=common.replaceAll(scopeExcluded,' ')+' '+specific;
    for(const trait of OCR_TRAIT_TERMS){
      const hit=trait.patterns.find(p=>source.includes(p));
      if(!hit)continue;
      if(!result.has(trait.label))result.set(trait.label,new Map());
      result.get(trait.label).set(grid,{grid,raw,number,word:hit,kind:'OCR关键词候选'});
    }
  });
  return [...result].filter(([,v])=>v.size>=2).map(([label,items])=>({label,count:items.size,sources:[...items.values()]})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
}
function renderOcrDetail(chart){
 const root=$('#ocrExpandedContent');if(!root)return;
 root.innerHTML='';
 const candidates=getOcrCandidates(chart);
 const section=document.createElement('section');section.className='integrated-section';
 const title=document.createElement('h4');title.textContent='七、81 数理 OCR 候选与格位专属解释';section.append(title);
 const intro=document.createElement('p');intro.className='integrated-description';intro.textContent='以下为对全部81个数理OCR底稿的自动关键词初筛，包含原来31个无标签的数字。仅用于发现可能重复的近义描述，未经人工校对，不能视为确认的命理事实。人格/变格等格位专属句仅在对应格位出现时匹配；天格不纳入统计。';section.append(intro);
 const p=document.createElement('p');p.className='integrated-description';p.textContent=`本次找到 ${candidates.length} 组跨格OCR候选（需逐条核对原图）。`;section.append(p);
 for(const c of candidates){
   const item=document.createElement('div');item.className='integrated-row';
   const h=document.createElement('strong');h.textContent=`${c.label} · ${c.count}格（候选）`;
   const t=document.createElement('p');t.textContent=c.sources.map(s=>`${s.grid}${s.raw}：关键词「${s.word}」〔数理${s.number} OCR〕`).join('；');
   item.append(h,t);section.append(item);
 }
 if(!candidates.length){const p=document.createElement('p');p.className='integrated-description';p.textContent='当前姓名未形成跨格OCR关键词候选。';section.append(p);}
 const scoped=perGridOcr(chart);
 const sh=document.createElement('h4');sh.textContent='格位限定的原文段落';section.append(sh);
 if(!scoped.length){const p=document.createElement('p');p.className='integrated-description';p.textContent='当前格位没有识别出明确限定句；并非没有传统解释。';section.append(p);}
 for(const r of scoped){
   const row=document.createElement('div');row.className='integrated-row';const h=document.createElement('strong');h.textContent=`${r.grid} ${r.raw} · OCR 第${r.page}页`;
   const t=document.createElement('p');t.textContent=`原文触发词「${r.trigger}」：${r.text}`;
   row.append(h,t);section.append(row);
 }
 const all=document.createElement('details');all.className='traditional-sources';
 const sum=document.createElement('summary');sum.textContent='展开查看本次五格完整OCR底稿（待人工校对）';all.append(sum);
 for(let i=1;i<chart.grids.length;i++){
   const n=norm(chart.grids[i]);const data=state.ocr.numbers[String(n)];
   const h=document.createElement('h4');h.textContent=`${GRID_NAMES[i]} ${chart.grids[i]}（数理${n}）`;all.append(h);
   for(const page of data.sections){const p=document.createElement('p');p.textContent=`原始图片第${page.page}页 OCR：\n${page.text}`;all.append(p);}
 }
 section.append(all);root.append(section);
}

function renderResult(name,chart){
  $("#resultName").textContent=name;
  const triadGrade=state.rules.triads.find(x=>x.elements===chart.triad)?.grade||"待补充";
  $("#triadLine").textContent=[...chart.triad].join(" · ");
  $("#triadGrade").textContent=triadGrade;
  $("#triadNote").textContent=`五行：${chart.triad.split("").join("、")}　｜　三才：${triadGrade}`;
  const cards=$("#gridCards");
  cards.innerHTML="";
  cards.append(renderChartVisual(name, chart, triadGrade));
  const quick = document.createElement("div");
  quick.className = "grid-quick-list";
  chart.grids.forEach((raw,i)=>{
    const n=norm(raw), g=grade(raw), el=document.createElement("button");
    el.className="grid-quick-item";
    el.innerHTML=`<div class="grid-quick-name">${GRID_NAMES[i]}</div><div class="grid-quick-num">${raw}</div><div class="grid-quick-meta">${element(raw)} · ${g}</div>`;
    el.addEventListener("click",()=>openNumber(n,`${GRID_NAMES[i]} · ${raw}（数理${n}）`,g));
    quick.append(el);
  });
  cards.append(quick);
  renderTraits(chart);
  renderTraditional(chart);
  renderIntegrated(chart);
  renderOcrDetail(chart);
}
function renderTraditional(chart){
  const data=state.traditional, holder=$("#traditionalContent");
  holder.innerHTML="";
  if(!data){holder.textContent="传统规则尚未加载";return;}
  const addSection=(heading,content,tip="")=>{
    const section=document.createElement("section");section.className="traditional-section";
    const h=document.createElement("div");h.className="traditional-heading";h.textContent=heading;
    const body=document.createElement("div");body.className="traditional-body";body.textContent=content;
    section.append(h,body);
    if(tip){const small=document.createElement("p");small.className="traditional-tip";small.textContent=tip;section.append(small);}
    holder.append(section);
  };
  // 阴阳仅用于人格：原文只描述阴阳属性，奇偶对应是可修改的通行约定。
  const rawRen=chart.grids[1],renNum=norm(rawRen),el=element(rawRen),yy=rawRen%2===1?"阳":"阴";
  const p=data.personality[el];
  addSection(`人格 ${rawRen} · ${yy}${el}（${p.principle}）`, `五行描述：${p.base}\n${yy}${el}描述：${yy==="阳"?p.yang:p.yin}`,data.yinYangAssumption);
  const names=GRID_NAMES;
  const included=chart.grids.slice(1).map((raw,j)=>({name:names[j+1],raw,norm:norm(raw)}));
  const special=data.special;
  const matches=[];
  for(const a of included){
    if(special.imperial.includes(a.norm)) matches.push(`${a.name}${a.raw}：帝王术数理（${a.norm}）`);
    else if(special.smallImperial.includes(a.norm)) matches.push(`${a.name}${a.raw}：小帝王术数理（29）`);
    if(special.art.includes(a.norm))matches.push(`${a.name}${a.raw}：艺术格（20）`);
    if(special.official.includes(a.norm))matches.push(`${a.name}${a.raw}：资料描述“容易向官方走”（19）`);
    if(special.sickWood.includes(a.norm))matches.push(`${a.name}${a.raw}：病木数理（${a.norm}）`);
    if(special.longevityEarth.includes(a.norm))matches.push(`${a.name}${a.raw}：福寿土数理（5）`);
  }
  addSection("特殊数理标记（不含天格）",matches.length?matches.join("\n"):"人格、地格、变格、外格、总格暂未命中所列特殊数字。","仅标注原文所列数字；不据此推断领导概率、寿命、婚姻或健康。");
  const relation=data.fiveElementControl;
  const tianEl=element(chart.grids[0]), renEl=element(chart.grids[1]);
  const controls=(a,b)=>{const order=["木","火","土","金","水"];return (order.indexOf(a)+2)%5===order.indexOf(b);};
  let rel="天格与人格五行："+tianEl+" / "+renEl+"。";
  if(controls(renEl,tianEl))rel+=" 按常见五行相克规则，属于“人克天”（文档对应语句为“会顶撞上面”）。";
  else if(controls(tianEl,renEl))rel+=" 按常见五行相克规则，属于“天克人”。";
  else if(renEl===tianEl)rel+=" 两格五行相同。";
  else rel+=" 未形成直接相克。";
  addSection("五行关系",rel,`${data.relationAssumption}；天格只参与这一结构关系展示，不参与吉凶和重复特质统计。`);
  addSection("人生阶段（资料分段）",data.ageStages.map(s=>`${s.start}—${s.end}岁：${s.name}`).join("\n"),`原文提及转换期约${data.transitionYears}年，但没有说明六格到各年龄段的完整映射，因此暂不生成各阶段吉凶结论。`);
  const details=document.createElement("details");details.className="traditional-sources";
  const summary=document.createElement("summary");summary.textContent="查看原始资料与尚未确定的规则";
  details.append(summary);
  const list=document.createElement("div");list.className="traditional-source-text";
  for(const [name,lines] of Object.entries(data.sources)){
    const label=document.createElement("h4");label.textContent=`《${name}》`;
    const text=document.createElement("p");text.textContent=lines.join("\n");
    list.append(label,text);
  }
  const pending=document.createElement("h4");pending.textContent="待明确条件，未自动判断";
  const pendingText=document.createElement("p");pendingText.textContent=data.undetermined.join("、");
  list.append(pending,pendingText);details.append(list);holder.append(details);
  const caveat=document.createElement("p");caveat.className="traditional-caveat";caveat.textContent=data.caveat;holder.append(caveat);
}

function renderTraits(chart){
  const evidence=chartEvidence(chart);
  const covered=chart.grids.slice(1).filter(raw=>(state.traits.numbers[String(norm(raw))]||[]).length>0).length;
  $("#traitCoverage").textContent=`${covered}/5 格有数理标签`;
  const root=$("#traitsContent");root.innerHTML="";
  const groups=[{title:'出现 2 格',rows:evidence.repeated.filter(r=>r.count===2)},{title:'出现 3 格及以上',rows:evidence.repeated.filter(r=>r.count>=3)}];
  groups.forEach(group=>{
    const el=document.createElement('div');el.className='trait-group';
    const h=document.createElement('div');h.className='trait-group-title';h.textContent=group.title;el.append(h);
    if(!group.rows.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='当前没有符合条件的跨格同义重复。';el.append(empty);}
    group.rows.forEach(row=>{
      const item=document.createElement('div');item.className='trait-row';
      const left=document.createElement('div');left.className='trait-name';left.textContent=row.label;
      const sources=document.createElement('div');sources.className='trait-sources';sources.textContent='来源：'+row.sources.map(s=>`${s.grid}${s.raw}（${[...new Set(s.items.map(i=>i.tag))].join('、')}）`).join('；');left.append(sources);
      const count=document.createElement('span');count.className='trait-count';count.textContent=row.count+' 格';item.append(left,count);el.append(item);
    });root.append(el);
  });
  const note=document.createElement('p');note.className='subtle-copy';note.textContent='同义归并仅限已列出的保守近义词组，人格文档可参与语义比对；同一格相似词不重复计数。天格不计入统计，31 个缺少人工标签的数理现已另列 OCR 关键词候选，尚未经人工核验。';root.append(note);
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openNumber(number,title="",gradeText=""){
  const entry=state.interpretations.entries.find(x=>x.number===Number(number));
  if(!entry)return;
  $("#dialogTitle").textContent=title||`${number} 数理全文`;
  const rule=state.rules.numbers[number-1];
  const g=gradeText||($("#gender").value==="female"?rule.female:rule.male);
  $("#dialogMeta").textContent=`数理 ${number} · ${g} · 原版数理图片`;
  const box=$("#dialogImages");box.innerHTML="";
  entry.segments.forEach(seg=>{
    const img=document.createElement("img");img.loading="lazy";img.alt=`${number}号数理原文，第${seg.page}页`;img.src=`./assets/${seg.asset}`;box.append(img);
  });
  $("#detailDialog").showModal();
}
function renderNumberGrid(){
  const root=$("#numberGrid");root.innerHTML="";
  for(let n=1;n<=81;n++){
    const rule=state.rules.numbers[n-1],g=$("#gender").value==="female"?rule.female:rule.male;
    const b=document.createElement("button");b.className="number-item";b.innerHTML=`${n}<span>${g}</span>`;b.addEventListener("click",()=>openNumber(n));root.append(b);
  }
}
function renderHistory(){
  const root=$("#historyList");root.innerHTML="";
  const records=JSON.parse(localStorage.getItem(STORAGE.history)||"[]");
  if(!records.length){root.innerHTML='<div class="empty-state">还没有保存的姓名记录。排盘后点击“保存记录”即可保存到本机。</div>';return;}
  records.forEach((r,index)=>{
    const card=document.createElement("div");card.className="history-card";
    const info=document.createElement("div");info.innerHTML=`<div class="history-name">${escapeHTML(r.name)}</div><div class="history-meta">${new Date(r.time).toLocaleString()} · ${r.strokes.join("-")} 画</div>`;
    const actions=document.createElement("div");actions.className="history-actions";
    const open=document.createElement("button");open.textContent="打开";open.addEventListener("click",()=>{switchTab("chart");$("#nameInput").value=r.name;updateStrokeEditor();[...$("#strokeEditor").querySelectorAll("input")].forEach((x,i)=>x.value=r.strokes[i]);$("#surnameMode").value=String(r.surnameLength);$("#gender").value=r.gender;state.chart=calculateChart(r.strokes,r.surnameLength);state.currentName=r.name;state.currentStrokes=r.strokes;renderResult(r.name,state.chart);$("#resultSection").hidden=false;window.scrollTo({top:0,behavior:"smooth"});});
    const del=document.createElement("button");del.textContent="删除";del.addEventListener("click",()=>{const list=records.filter((_,i)=>i!==index);localStorage.setItem(STORAGE.history,JSON.stringify(list));renderHistory();});
    actions.append(open,del);card.append(info,actions);root.append(card);
  });
}
function saveRecord(){
  if(!state.chart)return;
  const records=JSON.parse(localStorage.getItem(STORAGE.history)||"[]");
  records.unshift({name:state.currentName,strokes:state.currentStrokes,surnameLength:state.chart.surnameLength,gender:$("#gender").value,time:new Date().toISOString()});
  localStorage.setItem(STORAGE.history,JSON.stringify(records.slice(0,100)));
  $("#saveRecordBtn").textContent="已保存";renderHistory();setTimeout(()=>$("#saveRecordBtn").textContent="保存记录",1300);
}
function switchTab(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${tab}`));
  if(tab==="history")renderHistory();
}
function bindUI(){
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#nameInput").addEventListener("input",updateStrokeEditor);
  $("#surnameMode").addEventListener("change",updateStrokeEditor);
  $("#calculateBtn").addEventListener("click",calculate);
  $("#saveRecordBtn").addEventListener("click",saveRecord);
  $("#gender").addEventListener("change",()=>{if(state.chart)renderResult(state.currentName,state.chart);renderNumberGrid();});
  $("#numberSearch").addEventListener("input",()=>{const v=Number($("#numberSearch").value);if(v>=1&&v<=81&&Number.isInteger(v))openNumber(v);});
  $("#closeDialog").addEventListener("click",()=>$("#detailDialog").close());
  $("#closeAbout").addEventListener("click",()=>$("#aboutDialog").close());
  $("#aboutBtn").addEventListener("click",()=>$("#aboutDialog").showModal());
  $("#clearHistoryBtn").addEventListener("click",()=>{if(confirm("确定清空本机保存的全部记录吗？")){localStorage.removeItem(STORAGE.history);renderHistory();}});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.deferredInstall=e;$("#installBtn").hidden=false;});
  $("#installBtn").addEventListener("click",async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$("#installBtn").hidden=true;});
}
async function init(){
  bindUI();$("#appVersion").textContent=APP_VERSION;
  try{await loadData();updateStrokeEditor();}catch(e){$("#formError").textContent=e.message;}
  if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(()=>{});}
}
init();
