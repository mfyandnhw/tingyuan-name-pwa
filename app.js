const APP_VERSION = "0.1.2";
const $ = (s) => document.querySelector(s);
const state = { rules:null, traits:null, interpretations:null, strokes:null, surnames:null, nameOverrides:null, strokeVariants:null, chart:null, currentName:"", currentStrokes:[], surnameLength:1, deferredInstall:null };
const COMPOUNDS = new Set(("欧阳 歐陽 太史 端木 上官 司马 司馬 东方 東方 独孤 獨孤 南宫 南宮 万俟 萬俟 闻人 聞人 夏侯 诸葛 諸葛 尉迟 尉遲 公羊 赫连 赫連 澹台 皇甫 宗政 濮阳 濮陽 公冶 太叔 申屠 公孙 公孫 慕容 仲孙 仲孫 钟离 鍾離 长孙 長孫 宇文 司徒 鲜于 鮮于 司空 闾丘 閭丘 子车 子車 亓官 司寇 巫马 巫馬 公西 颛孙 顓孫 壤驷 壤駟 公良 漆雕 乐正 樂正 宰父 谷梁 谷樑 拓跋 夹谷 夾谷 轩辕 軒轅 令狐 段干 百里 呼延 东郭 東郭 南门 南門 羊舌 微生 梁丘 左丘 东门 東門 西门 西門 第五 公仪 公儀 公乘 公皙 南荣 南榮 东里 東里 申叔").split(" "));
const GRID_NAMES = ["天格","人格","地格","变格","外格","总格"];
const ELEMENTS = ["木","火","土","金","水"];
const STORAGE = { history:"tingyuan_history_v1", overrides:"tingyuan_stroke_overrides_v1" };

async function loadData(){
  const files = ["rules","interpretations","numerology-traits","strokes","surnames","name-strokes","stroke-variants"];
  const values = await Promise.all(files.map(async n => {
    const r = await fetch(`./assets/${n}.json`);
    if(!r.ok) throw new Error(`数据文件加载失败：${n}.json`);
    return r.json();
  }));
  [state.rules,state.interpretations,state.traits,state.strokes,state.surnames,state.nameOverrides,state.strokeVariants] = values;
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
}
function renderTraits(chart){
  const occurrences=new Map();let covered=0;
  chart.grids.forEach((raw,i)=>{
    if(i===0) return; // 天格不计入重复特质统计
    const n=norm(raw), list=state.traits.numbers[String(n)]||[];
    if(list.length) covered++;
    const seen=new Set();
    list.forEach(item=>{
      const name=item.name;
      if(!name||seen.has(name))return;
      seen.add(name);
      if(!occurrences.has(name))occurrences.set(name,[]);
      occurrences.get(name).push({grid:GRID_NAMES[i],number:n,raw});
    });
  });
  const repeated=[...occurrences.entries()].filter(([,sources])=>sources.length>=2);
  const twice=repeated.filter(([,s])=>s.length===2).sort((a,b)=>a[0].localeCompare(b[0],"zh-CN"));
  const three=repeated.filter(([,s])=>s.length>=3).sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0],"zh-CN"));
  const total=5; // 人格、地格、变格、外格、总格
  $("#traitCoverage").textContent=`${covered}/${total} 格有标签`;
  const root=$("#traitsContent");root.innerHTML="";
  const addGroup=(title,items)=>{
    const group=document.createElement("div");group.className="trait-group";
    const heading=document.createElement("div");heading.className="trait-group-title";heading.textContent=title;
    group.append(heading);
    if(!items.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="当前排盘没有符合条件的重复特质。";group.append(empty);}
    items.forEach(([name,sources])=>{
      const row=document.createElement("div");row.className="trait-row";
      const left=document.createElement("div");left.innerHTML=`<div class="trait-name">${escapeHTML(name)}</div><div class="trait-sources">来源：${sources.map(s=>`${s.grid} ${s.raw}`).join("、")}</div>`;
      const count=document.createElement("span");count.className="trait-count";count.textContent=`${sources.length} 次`;
      row.append(left,count);group.append(row);
    });
    root.append(group);
  };
  addGroup("出现 2 次",twice);
  addGroup("出现 3 次及以上",three);
  const note=document.createElement("div");note.className="subtle-copy";note.textContent="当前特质统计只计算人格、地格、变格、外格、总格；天格的吉凶与命理不计入统计。当前特质库有标签的数理为 50 个；其余 31 个尚未提取的数理暂不参与统计。";
  root.append(note);
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
