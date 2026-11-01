
const fs=require("fs");
const src=fs.readFileSync(process.argv[2],"utf8");
function extract(name){
  const start=src.indexOf(`function ${name}(`);
  if(start<0) throw new Error("missing "+name);
  const brace=src.indexOf("{",start); let depth=0, end=-1;
  for(let i=brace;i<src.length;i++){ if(src[i]==="{")depth++; else if(src[i]==="}"){depth--; if(depth===0){end=i+1;break;}}}
  return src.slice(start,end);
}
const code=[extract("norm"),extract("element"),extract("calculateChart")].join("\n");
const calculate=new Function(code+"; return calculateChart;")();
const cases=[
  {s:[7,8],surname:1,grids:[8,15,9,15,2,15],triad:"金土水"},
  {s:[7,8,9],surname:1,grids:[8,15,17,16,10,24],triad:"金土金"},
  {s:[8,9,10],surname:2,grids:[17,19,11,19,9,27],triad:"金水木"},
  {s:[8,9,10,11],surname:2,grids:[17,19,21,20,19,38],triad:"金水木"}
];
for(const c of cases){
 const r=calculate(c.s,c.surname);
 if(JSON.stringify(r.grids)!==JSON.stringify(c.grids)) throw new Error("grid mismatch "+JSON.stringify(r));
 if(r.triad!==c.triad) throw new Error("triad mismatch "+r.triad+" expected "+c.triad);
}
console.log("PASS",cases.length,"chart cases");
