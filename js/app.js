/* Benchmark DB — application logic (vanilla JS, in-memory only). */

/* ---------- Benchmark database app (vanilla, in-memory only) ---------- */
const DONOR_COLORS={Bilateral:"#4F7CA3",Multilateral:"#2E8B86",NGO:"#C2683E",
  Foundation:"#8E5BA6","Private sector":"#6B7785",Private:"#6B7785",Academic:"#7E8A6F",Other:"#98A0A8",PPP:"#5FB0AB"};
const SECTORS=["Emergency response","Basic drinking water","Public sector policy & PFM",
  "Civil society & participation","Primary education","Agricultural development","Basic health care"];
const DONORS=["Bilateral","Multilateral","NGO","Foundation","Private sector"];
const REGIONS=["Sub-Saharan Africa","MENA + Afg/Pak","South Asia","East Asia & Pacific","Latin Am. & Carib.","Europe & C. Asia"];
const STATUS_CLASS={Ongoing:"st-ong",Planned:"st-plan",Finalisation:"st-fin",Closed:"st-clo",Suspended:"st-sus",Cancelled:"st-sus"};
const DAY=864e5;

function parseDate(s){ if(!s) return null; const t=Date.parse(s); return isNaN(t)?null:t; }
function durMonths(st,en){ const a=parseDate(st),b=parseDate(en); if(a==null||b==null||b<a) return null; return Math.round((b-a)/(DAY*30.44)); }
function median(arr){ const a=arr.filter(v=>typeof v==="number"&&!isNaN(v)).sort((x,y)=>x-y); if(!a.length) return null; const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
let BASIS="nominal";
function deflF(y){ if(BASIS!=="real"||typeof DEFLATOR==="undefined"||!DEFLATOR.f) return 1; const f=DEFLATOR.f[String(y)]; return (typeof f==="number")?f:1; }
function usdOf(r){ const x=RATES[r.c]; if(typeof x!=="number") return null; return r.a*x*deflF(r.year); }

PROGRAMS.forEach(p=>{ p._dur=durMonths(p.st,p.en); });
OUTCOMES.forEach(o=>{ o._ach=(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number")?o.ac/o.tg:null; });
function recomputeUSD(){ PROGRAMS.forEach(p=>{ p._usd=usdOf(p); }); }
recomputeUSD();
PROGRAMS.forEach((p,i)=>{p._i=i;});

const nf=new Intl.NumberFormat("en-US");
function fmtUSD(v){ return (v==null)?"—":"$"+nf.format(Math.round(v)); }
function fmtCompact(v){ if(v==null) return "—"; const a=Math.abs(v); if(a>=1e9) return "$"+(v/1e9).toFixed(1)+"B"; if(a>=1e6) return "$"+(v/1e6).toFixed(1)+"M"; if(a>=1e3) return "$"+Math.round(v/1e3)+"k"; return "$"+Math.round(v); }
function fmtNum(v){ return (v==null)?"—":nf.format(v); }
function fmtPct(v){ return (v==null)?"—":Math.round(v*100)+"%"; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

const PS={q:"",d:"",rg:"",co:"",sc:"",sta:"",re:"",prov:"",sort:"_usd",dir:-1,page:1,size:50};
const OS={q:"",s:"",sn:"",t:"",sort:"_ach",dir:-1,page:1,size:50};

function uniq(arr,key){ return [...new Set(arr.map(x=>x[key]).filter(Boolean))].sort(); }
function fillSelect(id,vals,label){ const el=document.getElementById(id); if(!el) return; el.innerHTML="<option value=''>"+label+"</option>"+vals.map(v=>"<option>"+esc(v)+"</option>").join(""); }

function filterPrograms(){ const q=PS.q.toLowerCase(); return PROGRAMS.filter(p=>{
  if(PS.d&&p.d!==PS.d) return false; if(PS.rg&&p.rg!==PS.rg) return false; if(PS.co&&p.co!==PS.co) return false;
  if(PS.sc&&p.sn!==PS.sc) return false; if(PS.sta&&p.sta!==PS.sta) return false;
  if(PS.re==="Y"&&!p.re) return false; if(PS.re==="N"&&p.re) return false;
  if(PS.prov&&p.pn!==PS.prov) return false;
  if(q&&!((p.n||"").toLowerCase().includes(q)||(p.r||"").toLowerCase().includes(q)||(p.co||"").toLowerCase().includes(q))) return false;
  return true; }); }
function filterOutcomes(){ const q=OS.q.toLowerCase(); return OUTCOMES.filter(o=>{
  if(OS.s&&o.s!==OS.s) return false; if(OS.sn&&o.sn!==OS.sn) return false; if(OS.t&&o.t!==OS.t) return false;
  if(q&&!((o.n||"").toLowerCase().includes(q)||(o.i||"").toLowerCase().includes(q))) return false;
  return true; }); }
function sortRows(rows,key,dir){ return rows.slice().sort((a,b)=>{
  let x=a[key],y=b[key]; const xn=(x==null),yn=(y==null);
  if(xn&&yn) return 0; if(xn) return 1; if(yn) return -1;
  if(typeof x==="string"||typeof y==="string"){ x=String(x).toLowerCase(); y=String(y).toLowerCase(); return x<y?-dir:x>y?dir:0; }
  return (x-y)*dir; }); }

function countUp(el,to,fmt){ if(!el) return; const from=(typeof el._val==="number")?el._val:0; el._val=(to==null?0:to);
  if(to==null){ el.textContent=fmt(null); return; } const t0=performance.now(),d=460;
  function step(t){ const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3); el.textContent=fmt(from+(to-from)*e); if(k<1) requestAnimationFrame(step); else el.textContent=fmt(to); }
  requestAnimationFrame(step); }

function renderStats(rows){
  const n=rows.length, medB=median(rows.map(r=>r._usd)), medD=median(rows.map(r=>r._dur));
  const wr=rows.filter(r=>r.re).length, wreach=rows.filter(r=>r.rc!=null&&r.rc!=="").length;
  countUp(document.getElementById("st-n"),n,v=>fmtNum(Math.round(v)));
  countUp(document.getElementById("st-budget"),medB,fmtCompact);
  countUp(document.getElementById("st-dur"),medD,v=>(v==null?"—":Math.round(v)));
  countUp(document.getElementById("st-res"),n?wr/n:null,fmtPct);
  const r=document.getElementById("st-reach"); if(r) r.textContent=fmtNum(wreach);
}

function statusPill(s){ if(!s) return "<span class='dash'>–</span>"; const cls=STATUS_CLASS[s]||"st-clo"; return "<span class='stp "+cls+"'>"+esc(s)+"</span>"; }
function chip(d){ const col=DONOR_COLORS[d]||"#8A98A3"; return "<span class='chip' style='--c:"+col+"'><i class='cdot'></i>"+esc(d)+"</span>"; }

const PCOLS=[{k:"n",t:"Programme",c:"c-name"},{k:"co",t:"Country",c:"c-tag"},{k:"rg",t:"Region",c:"c-tag"},
 {k:"d",t:"Donor",c:"c-chip"},{k:"sn",t:"Sector",c:"c-tag"},{k:"sta",t:"Status",c:"c-mid"},
 {k:"st",t:"Start",c:"c-dim"},{k:"en",t:"End",c:"c-dim"},{k:"_dur",t:"Dur",c:"c-num"},
 {k:"a",t:"Amount",c:"c-num"},{k:"_usd",t:"≈ USD",c:"c-num"},{k:"rc",t:"Reach",c:"c-num"},
 {k:"re",t:"Results",c:"c-mid"},{k:"src",t:"Source",c:"c-mid"}];
const PSTR="n co rg d sn sta st en";
function renderHead(trId,cols,state,strkeys){ const tr=document.getElementById(trId); if(!tr) return;
  tr.innerHTML=cols.map(c=>{ const nosort=(c.k==="src"); const isOn=(state.sort===c.k);
    const arr=isOn?("<span class='arr'>"+(state.dir<0?"↓":"↑")+"</span>"):"";
    return "<th class='"+c.c+(nosort?" nosort":"")+"'"+(nosort?"":" data-key='"+c.k+"'")+(isOn?" data-on='1'":"")+">"+c.t+arr+"</th>"; }).join(""); }

function renderPrograms(){
  PCOLS[10].t="≈ USD"+(BASIS==="real"?" ’24":""); setText("st-budget-sub",BASIS==="real"?"≈ real 2024 USD (CPI)":"≈ nominal USD · FX");
  let rows=filterPrograms(); const total=rows.length;
  rows=sortRows(rows,PS.sort,PS.dir);
  const pages=Math.max(1,Math.ceil(total/PS.size)); if(PS.page>pages) PS.page=pages;
  const start=(PS.page-1)*PS.size, slice=rows.slice(start,start+PS.size);
  document.getElementById("pb").innerHTML=slice.map(p=>{
    return "<tr class='crow-click' data-i='"+p._i+"'>"+
     "<td class='c-name'><span class='pname'>"+esc(p.n)+"</span><span class='pid'>"+esc(p.r)+" · "+esc(p.sc)+"</span></td>"+
     "<td class='c-tag'"+(p.multi?" title='multiple recipient countries'":"")+">"+esc(p.co)+(p.multi?" <span class='multi'>+</span>":"")+"</td>"+
     "<td class='c-tag'>"+esc(p.rg)+"</td>"+
     "<td class='c-chip'>"+chip(p.d)+(p.d==="Bilateral"&&p.pcc?" <span class='provcc' title='providing country (inferred)'>"+esc(p.pcc)+"</span>":"")+"</td>"+
     "<td class='c-tag'>"+esc(p.sn)+"</td>"+
     "<td class='c-mid'>"+statusPill(p.sta)+"</td>"+
     "<td class='c-dim'>"+esc(p.st||"—")+"</td>"+"<td class='c-dim'>"+esc(p.en||"—")+"</td>"+
     "<td class='c-num'>"+(p._dur==null?"—":p._dur)+"</td>"+
     "<td class='c-num rep'>"+esc(p.c)+" "+nf.format(Math.round(p.a))+"<span class='sub'>"+esc(p.b)+"</span></td>"+
     "<td class='c-num strong'>"+fmtUSD(p._usd)+"</td>"+
     "<td class='c-num rep' title='"+esc(p.rb||"")+"'>"+(p.rc===""||p.rc==null?"—":fmtNum(p.rc))+(p.rc&&p.rb?"<span class='sub'>"+esc((p.rb||"").slice(0,24))+"</span>":"")+"</td>"+
     "<td class='c-mid'>"+(p.re?"<span class='pill ok'>yes</span>":"<span class='dash'>–</span>")+"</td>"+
     "<td class='c-mid'><span class='rowmore'>open ›</span></td></tr>";
  }).join("")||"<tr><td colspan='14' class='empty'>No programmes match these filters.</td></tr>";
  const s=total?start+1:0,e=Math.min(start+PS.size,total);
  setText("p-count",nf.format(total)); setText("p-range",nf.format(s)+"–"+nf.format(e)); setText("p-page",PS.page+" / "+pages);
  setText("sb-n",nf.format(total));
  renderHead("ph",PCOLS,PS); renderStats(filterPrograms());
}

const OCOLS=[{k:"n",t:"Programme",c:"c-name"},{k:"s",t:"Stream",c:"c-tag"},{k:"sn",t:"Sector",c:"c-tag"},
 {k:"t",t:"Type",c:"c-tag"},{k:"i",t:"Indicator",c:"c-ind"},{k:"bl",t:"Baseline",c:"c-num"},
 {k:"tg",t:"Target",c:"c-num"},{k:"ac",t:"Actual",c:"c-num"},{k:"_ach",t:"Achieved",c:"c-num"}];
function achClass(v){ if(v==null) return ""; if(v>=1) return "a5"; if(v>=.75) return "a4"; if(v>=.5) return "a3"; if(v>=.25) return "a2"; return "a1"; }
function renderOutcomes(){
  let rows=filterOutcomes(); const total=rows.length; rows=sortRows(rows,OS.sort,OS.dir);
  const pages=Math.max(1,Math.ceil(total/OS.size)); if(OS.page>pages) OS.page=pages;
  const start=(OS.page-1)*OS.size, slice=rows.slice(start,start+OS.size);
  document.getElementById("ob").innerHTML=slice.map(o=>{ const m=(o.m==="%")?"%":"";
    return "<tr><td class='c-name'>"+esc(o.n)+"</td><td class='c-tag'>"+esc(o.s)+"</td><td class='c-tag'>"+esc(o.sn)+"</td>"+
     "<td class='c-tag'>"+esc(o.t)+"</td><td class='c-ind'>"+esc(o.i)+"</td>"+
     "<td class='c-num rep'>"+(o.bl==null?"—":nf.format(o.bl)+m)+"</td>"+
     "<td class='c-num rep'>"+(o.tg==null?"—":nf.format(o.tg)+m)+"</td>"+
     "<td class='c-num rep'>"+(o.ac==null?"—":nf.format(o.ac)+m)+"</td>"+
     "<td class='c-num "+achClass(o._ach)+"'>"+fmtPct(o._ach)+"</td></tr>";
  }).join("")||"<tr><td colspan='9' class='empty'>No outcomes match these filters.</td></tr>";
  const s=total?start+1:0,e=Math.min(start+OS.size,total);
  setText("o-count",nf.format(total)); setText("o-range",nf.format(s)+"–"+nf.format(e)); setText("o-page",OS.page+" / "+pages);
  renderHead("oh",OCOLS,OS);
}

function groupStats(fn){ const r=PROGRAMS.filter(fn); return {n:r.length,mb:median(r.map(x=>x._usd)),md:median(r.map(x=>x._dur)),
  pr:r.length?r.filter(x=>x.re).length/r.length:null}; }
function btable(title,sub,specs,labelHdr,showTotal,showDot){
  const stats=specs.map(s=>{const g=groupStats(s.fn); return {lab:s.lab,total:s.total,n:g.n,mb:g.mb,md:g.md,pr:g.pr};});
  const maxB=Math.max(1,...stats.map(s=>s.mb||0));
  let h="<div class='btable'><div class='bt-cap'><span>"+esc(title)+"</span><em>"+esc(sub)+"</em></div>"+
   "<table class='grid'><thead><tr><th>"+esc(labelHdr)+"</th><th class='c-num'>n</th>"+
   "<th class='c-num'>Median budget &asymp;USD</th><th class='c-num'>Median dur (mo)</th><th class='c-num'>% results</th>"+
   (showTotal?"<th class='c-num'>In IATI</th>":"")+"</tr></thead><tbody>";
  stats.forEach(s=>{ const w=s.mb?Math.max(3,Math.round(100*s.mb/maxB)):0;
   h+="<tr><td class='c-name b-lab'>"+(showDot?"<i class='cdot' style='background:"+(DONOR_COLORS[s.lab]||"#8A98A3")+"'></i>":"")+esc(s.lab)+"</td>"+
     "<td class='c-num'>"+s.n+"</td>"+
     "<td class='c-num bar-cell'><span class='bar' style='width:"+w+"%'></span><span class='bv'>"+fmtCompact(s.mb)+"</span></td>"+
     "<td class='c-num'>"+(s.md==null?"—":s.md)+"</td>"+
     "<td class='c-num'>"+fmtPct(s.pr)+"</td>"+
     (showTotal?"<td class='c-num dim'>"+fmtNum(s.total)+"</td>":"")+"</tr>"; });
  return h+"</tbody></table></div>";
}
function renderBenchmarks(){
  const el=document.getElementById("bench"); if(!el) return;
  const bilat=SECTORS.map(s=>({lab:s,total:(TOTALS[s]||{}).recent_total,fn:p=>p.sn===s&&p.d==="Bilateral"}));
  const all=SECTORS.map(s=>({lab:s,total:(TOTALS[s]||{}).recent_total,fn:p=>p.sn===s}));
  const don=DONORS.map(d=>({lab:d,fn:p=>p.d===d}));
  const reg=REGIONS.map(rg=>({lab:rg,fn:p=>p.rg===rg}));
  const provCount={}; PROGRAMS.forEach(p=>{ if(p.pcc) provCount[p.pn]=(provCount[p.pn]||0)+1; });
  const provTop=Object.keys(provCount).sort((x,y)=>provCount[y]-provCount[x]).slice(0,12);
  const prov=provTop.map(pn=>({lab:pn,fn:p=>p.pn===pn}));
  el.innerHTML=
    btable("A \u00b7 Bilateral programmes by sector","donor type = Bilateral — your headline benchmark",bilat,"Sector",true,false)+
    btable("B \u00b7 All programmes by sector","any donor type",all,"Sector",true,false)+
    btable("C \u00b7 By donor type","across all sectors & regions",don,"Donor type",false,true)+
    btable("D \u00b7 By region","across all sectors & donors",reg,"Region",false,false)+
    btable("E \u00b7 By providing country","inferred funder country \u2014 bilateral & co-funded; top 12 by count",prov,"Providing country",false,false)+
    "<p class='bnote'>Computed live over the "+nf.format(PROGRAMS.length)+" embedded programmes (a global sample; the recent IATI universe per sector is larger — see the 'In IATI' column and #read_me). Bars scale to the largest median in each table. <b>Cost-per-beneficiary and aggregate achievement are intentionally absent</b> — IATI reach and target/actual fields are non-comparable.</p>";
}

function dl(name,text){ const b=new Blob([text],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a"); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1500); }
function cc(v){ v=(v==null?"":String(v)); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
function exportPrograms(){ const rows=sortRows(filterPrograms(),PS.sort,PS.dir);
  const head=["Programme","Country","ISO","Region","Donor type","Providing country","Funder","Reporting org","Reporter type","Stream","DAC code","Sector","Status","Start","End","Duration (mo)","Currency","Amount (orig)","Basis","USD approx","Reach","Reach basis","Reports results","IATI id"];
  const L=[head.map(cc).join(",")];
  rows.forEach(p=>L.push([p.n,p.co,p.cc,p.rg,p.d,p.pn,(p.fn||p.r),p.r,p.rt,p.s,p.sc,p.sn,p.sta,p.st,p.en,p._dur,p.c,p.a,p.b,(p._usd==null?"":Math.round(p._usd)),(p.rc===""?"":p.rc),p.rb,(p.re?"Y":"N"),p.id].map(cc).join(",")));
  dl("benchmark_programmes_filtered.csv",L.join("\n")); }
function exportOutcomes(){ const rows=sortRows(filterOutcomes(),OS.sort,OS.dir);
  const head=["Programme","Stream","Sector","Type","Indicator","Measure","Baseline","Target","Actual","Achieved (act/tgt)"];
  const L=[head.map(cc).join(",")];
  rows.forEach(o=>L.push([o.n,o.s,o.sn,o.t,o.i,o.m,o.bl,o.tg,o.ac,(o._ach==null?"":o._ach.toFixed(3))].map(cc).join(",")));
  dl("benchmark_outcomes_filtered.csv",L.join("\n")); }

function buildFX(){ const wrap=document.getElementById("fx"); if(!wrap) return; const keys=Object.keys(RATES);
  wrap.innerHTML=keys.map(k=>"<label class='fxrow'><span>"+k+"</span><input type='number' step='0.0001' data-cur='"+k+"' value='"+RATES[k]+"'></label>").join("");
  wrap.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{ const v=parseFloat(e.target.value);
    RATES[e.target.dataset.cur]=isNaN(v)?undefined:v; recomputeUSD(); renderPrograms(); renderBenchmarks(); if(typeof renderPlanRec==="function"){renderPlanRec();renderPlanCalc();} })); }

/* ---------- Plan a programme ---------- */
const COUNTRY_REGION=Object.assign({},(typeof DEVREGION!=="undefined"?DEVREGION:{}));
PROGRAMS.forEach(p=>{ if(p.co&&!COUNTRY_REGION[p.co]) COUNTRY_REGION[p.co]=p.rg; });
const ALL_COUNTRIES=(typeof DEVREGION!=="undefined")?Object.keys(DEVREGION).sort():uniq(PROGRAMS,"co");
const PL={country:"",sector:"Basic health care",donor:"",need:null,budget:null,dur:null,target:null,link:false,base:null};
function num(v){ const x=parseFloat(v); return isNaN(x)?null:x; }
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=(v==null?"":v); }
function quantile(s,p){ if(!s.length) return null; const i=(s.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i); return lo===hi?s[lo]:s[lo]+(s[hi]-s[lo])*(i-lo); }
function statsOf(rows,key){ const a=rows.map(r=>r[key]).filter(v=>typeof v==="number"&&!isNaN(v)).sort((x,y)=>x-y);
  return {n:a.length,min:a[0],max:a[a.length-1],p25:quantile(a,.25),med:quantile(a,.5),p75:quantile(a,.75),arr:a}; }
function pctRank(arr,v){ if(!arr.length||v==null) return null; let c=0; for(const x of arr) if(x<=v) c++; return c/arr.length; }
function planCohort(){
  let base=PROGRAMS.filter(p=>p.sn===PL.sector);
  if(PL.donor) base=base.filter(p=>p.d===PL.donor);
  if(PL.country){ const c=base.filter(p=>p.co===PL.country);
    if(c.length>=8) return {rows:c,scope:"in "+PL.country};
    const rg=COUNTRY_REGION[PL.country]; const r=base.filter(p=>p.rg===rg);
    if(rg&&r.length>=8) return {rows:r,scope:"in "+rg+" (few comparators in "+PL.country+")"};
    return {rows:base,scope:"across developing countries (few comparators in "+PL.country+")"}; }
  return {rows:base,scope:(PL.donor?PL.donor+" · ":"")+"across all developing countries"};
}
function recStat(k,v,s){ return "<div class='rs1'><div class='rs1-k'>"+esc(k)+"</div><div class='rs1-v'>"+v+"</div><div class='rs1-s'>"+esc(s)+"</div></div>"; }
function renderPlanRec(){
  const el=document.getElementById("pl-rec"); if(!el) return;
  if(!PL.sector){ el.innerHTML="<div class='pcard-h'><span class='pstep'>2</span><h2>Recommended benchmark</h2></div><p class='pscope'>Choose an intervention / sector above to see a benchmark.</p>"; return; }
  const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  const resPct=rows.length?rows.filter(r=>r.re).length/rows.length:null;
  const mix={}; rows.forEach(r=>mix[r.d]=(mix[r.d]||0)+1);
  const mixTop=Object.entries(mix).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>esc(k)+" "+Math.round(100*v/rows.length)+"%").join(" · ");
  const provM={}; rows.forEach(r=>{ if(r.pcc) provM[r.pn]=(provM[r.pn]||0)+1; });
  const provTopStr=Object.entries(provM).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>esc(k)+" "+Math.round(100*v/rows.length)+"%").join(" · ");
  const med=b.med||0; const comp=rows.slice().sort((x,y)=>Math.abs((x._usd||0)-med)-Math.abs((y._usd||0)-med)).slice(0,5);
  let h="<div class='pcard-h'><span class='pstep'>2</span><h2>Recommended benchmark</h2></div>";
  h+="<p class='pscope'>Based on <b>"+rows.length+"</b> comparable programmes — "+esc(scope)+".</p>";
  if(rows.length<8) h+="<p class='pflag'>Thin sample — treat as indicative, or widen the need.</p>";
  h+="<div class='prec'>"+
    recStat("Median budget",fmtCompact(b.med),"typical "+fmtCompact(b.p25)+"–"+fmtCompact(b.p75))+
    recStat("Typical duration",(d.med==null?"—":Math.round(d.med)+" mo"),"typical "+(d.p25==null?"—":Math.round(d.p25))+"–"+(d.p75==null?"—":Math.round(d.p75))+" mo")+
    recStat("Report results",fmtPct(resPct),rows.length+" programmes")+
    recStat("Common funders",mixTop||"—","by share of cohort")+
  "</div>";
  if(provTopStr) h+="<p class='pmix'>Typical providing countries: <b>"+provTopStr+"</b></p>";
  h+="<div class='pcomp'><div class='pcomp-h'>Closest comparable programmes</div>"+comp.map(p=>
    "<div class='pcomp-row crow-click' data-i='"+p._i+"'><span class='pcn'>"+esc(p.n)+"</span><span class='pcm'>"+esc(p.co)+" · "+chip(p.d)+" · "+fmtCompact(p._usd)+" · "+(p._dur==null?"—":p._dur+" mo")+" · <span class='rowmore'>open ›</span></span></div>").join("")+"</div>";
  h+="<button id='pl-use' class='btn'>Use this benchmark to start a plan →</button>";
  el.innerHTML=h;
  const u=document.getElementById("pl-use"); if(u) u.addEventListener("click",()=>seedPlan(b.med,d.med));
}
function seedPlan(medBudget,medDur){
  PL.budget=medBudget?Math.round(medBudget):null; PL.dur=medDur?Math.round(medDur):null;
  if(PL.need) PL.target=PL.need; PL.base={budget:PL.budget,target:PL.target};
  setVal("pl-budget",PL.budget); setVal("pl-dur",PL.dur); setVal("pl-target",PL.target);
  renderPlanCalc();
  const pw=document.getElementById("pl-planwrap"); if(pw&&pw.scrollIntoView) pw.scrollIntoView({behavior:"smooth",block:"start"});
}
function calcStat(k,v,s){ return "<div class='cs1'><div class='cs1-k'>"+esc(k)+"</div><div class='cs1-v'>"+v+"</div><div class='cs1-s'>"+esc(s)+"</div></div>"; }
function strip(label,st,val,log){
  if(!st.n) return "";
  const lo=st.min,hi=st.max;
  function pos(v){ if(v==null) return null; if(log){ const a=Math.log(Math.max(1,lo)),bb=Math.log(Math.max(2,hi)),x=Math.log(Math.max(1,v)); return Math.max(0,Math.min(100,100*(x-a)/((bb-a)||1))); } return Math.max(0,Math.min(100,100*(v-lo)/((hi-lo)||1))); }
  const a=pos(st.p25),c=pos(st.p75),m=pos(st.med),mk=pos(val);
  return "<div class='strip'><div class='strip-l'>"+esc(label)+"</div><div class='strip-bar'>"+
    "<span class='strip-band' style='left:"+a+"%;width:"+Math.max(1,c-a)+"%'></span>"+
    "<span class='strip-med' style='left:"+m+"%'></span>"+
    (mk==null?"":"<span class='strip-mk' style='left:"+mk+"%'></span>")+
    "</div></div>";
}
function renderPlanCalc(){
  const el=document.getElementById("pl-calc"); if(!el) return;
  const {rows}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  const budget=PL.budget,dur=PL.dur,target=PL.target;
  const burn=(budget&&dur)?budget/dur:null, cpp=(budget&&target)?budget/target:null;
  const bp=pctRank(b.arr,budget), dp=pctRank(d.arr,dur);
  let h="<div class='pcalc'>"+
    calcStat("Monthly burn",burn==null?"—":fmtCompact(burn)+"/mo","budget ÷ duration")+
    calcStat("Cost / person",cpp==null?"—":"$"+nf.format(Math.round(cpp)),target?"your budget ÷ your target":"set a target")+
    calcStat("Budget vs peers",bp==null?"—":Math.round(bp*100)+"th pct","of "+b.n+" comparables")+
    calcStat("Duration vs peers",dp==null?"—":Math.round(dp*100)+"th pct","of comparables")+
  "</div>";
  h+="<div class='pstrip-wrap'>"+strip("Budget",b,budget,true)+strip("Duration",d,dur,false)+"</div>";
  const f=[];
  if(budget!=null&&b.n>=8){ if(budget<b.p25) f.push("Budget is below the typical range ("+fmtCompact(b.p25)+"–"+fmtCompact(b.p75)+") for comparable programmes — consider trimming scope or duration."); else if(budget>b.p75) f.push("Budget is above the typical range ("+fmtCompact(b.p25)+"–"+fmtCompact(b.p75)+") — make sure scope justifies it."); }
  if(dur!=null&&d.n>=8&&dur<d.p25) f.push("Duration is shorter than most comparable programmes ("+Math.round(d.p25)+"–"+Math.round(d.p75)+" mo).");
  if(cpp!=null) f.push("Cost per person is your own figure (budget ÷ target). Comparable programmes rarely report reach, so there is no external benchmark — sense-check against sector unit-cost studies.");
  if(f.length) h+="<ul class='pflags'>"+f.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>";
  el.innerHTML=h;
}
function exportPlan(){ const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  const L=[["field","value"].join(",")]; const add=(k,v)=>L.push([cc(k),cc(v)].join(","));
  add("Country",PL.country||"Any"); add("Intervention / sector",PL.sector); add("Donor type",PL.donor||"Any");
  add("Cohort",scope); add("Comparable programmes (n)",rows.length);
  add("Benchmark median budget USD",b.med?Math.round(b.med):""); add("Benchmark p25 USD",b.p25?Math.round(b.p25):""); add("Benchmark p75 USD",b.p75?Math.round(b.p75):"");
  add("Benchmark median duration (mo)",d.med?Math.round(d.med):"");
  add("PLAN budget USD",PL.budget||""); add("PLAN duration (mo)",PL.dur||""); add("PLAN target reach",PL.target||"");
  add("PLAN monthly burn USD",(PL.budget&&PL.dur)?Math.round(PL.budget/PL.dur):""); add("PLAN cost per person USD",(PL.budget&&PL.target)?Math.round(PL.budget/PL.target):"");
  dl("programme_plan.csv",L.join("\n")); }
function wirePlan(){
  fillSelect("pl-country",ALL_COUNTRIES,"Any country");
  fillSelect("pl-sector",uniq(PROGRAMS,"sn"),"Select sector");
  fillSelect("pl-donor",DONORS.filter(d=>PROGRAMS.some(p=>p.d===d)),"Any donor type");
  setVal("pl-sector",PL.sector);
  const on=(id,ev,fn)=>{const el=document.getElementById(id); if(el) el.addEventListener(ev,fn);};
  on("pl-country","change",e=>{PL.country=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-sector","change",e=>{PL.sector=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-donor","change",e=>{PL.donor=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-need","input",e=>{PL.need=num(e.target.value);});
  on("pl-budget","input",e=>{const nb=num(e.target.value); if(PL.link&&PL.base&&PL.base.budget&&PL.base.target&&nb){PL.target=Math.round(PL.base.target*nb/PL.base.budget); setVal("pl-target",PL.target);} PL.budget=nb; renderPlanCalc();});
  on("pl-dur","input",e=>{PL.dur=num(e.target.value);renderPlanCalc();});
  on("pl-target","input",e=>{PL.target=num(e.target.value); PL.base={budget:PL.budget,target:PL.target}; renderPlanCalc();});
  on("pl-link","change",e=>{PL.link=e.target.checked; PL.base={budget:PL.budget,target:PL.target};});
  on("pl-reset","click",()=>{const {rows}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur"); seedPlan(b.med,d.med);});
  on("pl-export","click",exportPlan);
  renderPlanRec(); renderPlanCalc();
}
function initPlanFromURL(){
  if(typeof location==="undefined") return;
  const qp=new URLSearchParams(location.search); if(![...qp.keys()].length) return;
  const c=qp.get("country"); if(c){ const bn=PROGRAMS.find(p=>(p.co||"").toLowerCase()===c.toLowerCase()); const bi=PROGRAMS.find(p=>(p.cc||"").toLowerCase()===c.toLowerCase()); PL.country=bn?bn.co:(bi?bi.co:""); }
  const sc=qp.get("sector"); if(sc){ const bn=SECTORS.find(s=>s.toLowerCase()===sc.toLowerCase()); const bc=PROGRAMS.find(p=>p.sc===sc); PL.sector=bn||(bc?bc.sn:PL.sector); }
  const dn=qp.get("donor"); if(dn){ const m=DONORS.find(x=>x.toLowerCase()===dn.toLowerCase()); if(m) PL.donor=m; }
  const need=num(qp.get("target")||qp.get("people")); if(need) PL.need=need;
  setVal("pl-country",PL.country); setVal("pl-sector",PL.sector); setVal("pl-donor",PL.donor); if(PL.need) setVal("pl-need",PL.need);
  renderPlanRec();
  const {rows}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  seedPlan(num(qp.get("budget"))||b.med, num(qp.get("duration"))||d.med);
  showView("plan");
}

/* ---------- programme detail card ---------- */
function eatt(s){ return esc(s); }
function cf(k,v){ return "<div class='cfield'><span class='ck'>"+k+"</span><span class='cv'>"+v+"</span></div>"; }
function cfBig(k,v){ return "<div class='cfield'><span class='ck'>"+k+"</span><span class='cv big'>"+v+"</span></div>"; }
function fnum(v){ return (v==null||v==="")?"—":fmtNum(v); }
function closeCard(){ const m=document.getElementById("cardModal"); if(m) m.hidden=true; }
function fallbackCopy(txt,done){ try{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); done&&done(); }catch(e){} }
function copyText(txt,btn){ const done=()=>{ if(btn){ const o=btn.textContent; btn.textContent="Copied ✓"; setTimeout(()=>{btn.textContent=o;},1200);} };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done)); } else fallbackCopy(txt,done); }catch(e){ fallbackCopy(txt,done); } }
function openCard(p){ if(!p) return;
  const dpAct="https://d-portal.org/ctrack.html#view=act&aid="+encodeURIComponent(p.id);
  const dpRaw="https://d-portal.org/q.html?aid="+encodeURIComponent(p.id);
  const os=OUTCOMES.filter(o=>o.n===p.n);
  let h="<div class='cardh'><h2>"+esc(p.n)+"</h2><div class='sub'>"+statusPill(p.sta)+chip(p.d)+"<span>"+esc(p.sn)+"</span><span class='muted'>· "+esc(p.s)+"</span>"+((p.d==="Bilateral"&&p.pcc)?"<span class='flow'>"+esc(p.pcc)+" → "+esc(p.cc)+"</span>":"")+"</div></div>";
  h+="<div class='cardsec'><div class='cardgrid'>"+cf("Receiving country",esc(p.co)+(p.multi?" <span class='muted'>(+ others)</span>":""))+((p.d==="Bilateral")?cf("Providing country",(p.pn?esc(p.pn)+" <span class='muted'>("+esc(p.pcc)+", inferred)</span>":"—")):"")+cf("Funder",esc(p.fn||p.r||"—"))+cf("Region",esc(p.rg))+cf("Reporting org",esc(p.r)+" <span class='muted'>("+esc(p.rt||"—")+")</span>")+cf("Sector code",esc(p.sc))+"</div></div>";
  h+="<div class='cardsec'><h3>Finance &amp; timeline</h3><div class='cardgrid'>"+cfBig("Budget",esc(p.c)+" "+nf.format(Math.round(p.a)))+cfBig(BASIS==="real"?"≈ real 2024 USD":"≈ nominal USD",fmtUSD(p._usd))+cf("Reported as",esc(p.b||"—"))+cf("Start",esc(p.st||"—"))+cf("End",esc(p.en||"—"))+cf("Duration",(p._dur==null?"—":p._dur+" months"))+"</div></div>";
  let rr=cf("Reach (reported)",(p.rc===""||p.rc==null)?"—":fmtNum(p.rc));
  if(p.rc&&p.rb) rr+=cf("Reach indicator",esc(p.rb));
  rr+=cf("Reports results?",p.re?"Yes":"No");
  h+="<div class='cardsec'><h3>Reach &amp; results</h3><div class='cardgrid'>"+rr+"</div>";
  if(os.length) h+="<table class='cotable'><thead><tr><th>Indicator</th><th>Base</th><th>Target</th><th>Actual</th></tr></thead><tbody>"+os.slice(0,12).map(o=>"<tr><td class='ind'>"+esc(o.i||o.t||"—")+"</td><td>"+fnum(o.bl)+"</td><td>"+fnum(o.tg)+"</td><td>"+fnum(o.ac)+"</td></tr>").join("")+"</tbody></table>";
  h+="</div>";
  h+="<div class='cardsec'><h3>Source</h3><div class='csrc'>"+
     "<div class='csrc-row'><a class='cbtn prim' href=\""+eatt(dpAct)+"\" target='_blank' rel='noopener'>Open in d-portal ↗</a>"+
     "<a class='cbtn' href=\""+eatt(dpRaw)+"\" target='_blank' rel='noopener'>Raw IATI data ↗</a>"+
     "<button class='cbtn' data-copy=\""+eatt(dpAct)+"\">Copy link</button></div>"+
     "<div class='csrc-row'><span class='ck'>IATI ID</span> <code>"+esc(p.id)+"</code> <button class='cbtn' data-copy=\""+eatt(p.id)+"\">Copy ID</button></div>"+
     "<div class='cnote'>If a link doesn't open in this preview, copy it into your browser. Every figure here is REPORTED or DERIVED from this activity's own IATI record.</div>"+
     "</div></div>";
  document.getElementById("cardBody").innerHTML=h;
  const m=document.getElementById("cardModal"); m.hidden=false;
  m.querySelectorAll("[data-copy]").forEach(btn=>btn.addEventListener("click",()=>copyText(btn.getAttribute("data-copy"),btn)));
}

function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("show",v.id==="view-"+name));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
}
function setTheme(t){ document.documentElement.setAttribute("data-theme",t);
  document.querySelectorAll(".theme-btn").forEach(b=>b.classList.toggle("on",b.dataset.theme===t)); }
function setBasis(x){ BASIS=x; document.querySelectorAll(".basis-btn").forEach(b=>b.classList.toggle("on",b.dataset.basis===x)); recomputeUSD(); renderPrograms(); renderBenchmarks(); if(typeof renderPlanRec==="function"){renderPlanRec();renderPlanCalc();} }

function init(){
  fillSelect("f-donor",DONORS.filter(d=>PROGRAMS.some(p=>p.d===d)),"All donor types");
  fillSelect("f-region",REGIONS.filter(r=>PROGRAMS.some(p=>p.rg===r)),"All regions");
  fillSelect("f-country",uniq(PROGRAMS,"co"),"All countries");
  fillSelect("f-sector",uniq(PROGRAMS,"sn"),"All sectors");
  fillSelect("f-status",uniq(PROGRAMS,"sta"),"Any status");
  fillSelect("f-provider",uniq(PROGRAMS.filter(p=>p.pcc),"pn"),"Donor country: any");
  fillSelect("o-stream",uniq(OUTCOMES,"s"),"All streams");
  fillSelect("o-sector",uniq(OUTCOMES,"sn"),"All sectors");
  fillSelect("o-type",uniq(OUTCOMES,"t"),"All types");
  setText("badge-prog",nf.format(PROGRAMS.length));
  setText("badge-out",nf.format(OUTCOMES.length));

  const on=(id,ev,fn)=>{ const el=document.getElementById(id); if(el) el.addEventListener(ev,fn); };
  on("q","input",e=>{PS.q=e.target.value;PS.page=1;renderPrograms();});
  on("sq","input",e=>{PS.q=e.target.value;const m=document.getElementById("q");if(m)m.value=e.target.value;PS.page=1;renderPrograms();showView("programmes");});
  on("f-donor","change",e=>{PS.d=e.target.value;PS.page=1;renderPrograms();});
  on("f-region","change",e=>{PS.rg=e.target.value;PS.page=1;renderPrograms();});
  on("f-country","change",e=>{PS.co=e.target.value;PS.page=1;renderPrograms();});
  on("f-sector","change",e=>{PS.sc=e.target.value;PS.page=1;renderPrograms();});
  on("f-status","change",e=>{PS.sta=e.target.value;PS.page=1;renderPrograms();});
  on("f-res","change",e=>{PS.re=e.target.value;PS.page=1;renderPrograms();});
  on("f-provider","change",e=>{PS.prov=e.target.value;PS.page=1;renderPrograms();});
  on("pgsize","change",e=>{PS.size=(e.target.value==="all"?1e9:parseInt(e.target.value));PS.page=1;renderPrograms();});
  on("p-prev","click",()=>{if(PS.page>1){PS.page--;renderPrograms();}});
  on("p-next","click",()=>{PS.page++;renderPrograms();});
  on("reset","click",()=>{Object.assign(PS,{q:"",d:"",rg:"",co:"",sc:"",sta:"",re:"",prov:"",page:1});
    ["q","sq","f-donor","f-provider","f-region","f-country","f-sector","f-status","f-res"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});renderPrograms();});
  on("export","click",exportPrograms);

  on("oq","input",e=>{OS.q=e.target.value;OS.page=1;renderOutcomes();});
  on("o-stream","change",e=>{OS.s=e.target.value;OS.page=1;renderOutcomes();});
  on("o-sector","change",e=>{OS.sn=e.target.value;OS.page=1;renderOutcomes();});
  on("o-type","change",e=>{OS.t=e.target.value;OS.page=1;renderOutcomes();});
  on("opgsize","change",e=>{OS.size=(e.target.value==="all"?1e9:parseInt(e.target.value));OS.page=1;renderOutcomes();});
  on("o-prev","click",()=>{if(OS.page>1){OS.page--;renderOutcomes();}});
  on("o-next","click",()=>{OS.page++;renderOutcomes();});
  on("o-export","click",exportOutcomes);

  const phEl=document.getElementById("ph"); if(phEl) phEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th||th.classList.contains("nosort"))return;const k=th.dataset.key;if(!k)return;if(PS.sort===k)PS.dir*=-1;else{PS.sort=k;PS.dir=PSTR.split(" ").includes(k)?1:-1;}renderPrograms();});
  const ohEl=document.getElementById("oh"); if(ohEl) ohEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th)return;const k=th.dataset.key;if(!k)return;if(OS.sort===k)OS.dir*=-1;else{OS.sort=k;OS.dir=("n i s sn t".split(" ").includes(k))?1:-1;}renderOutcomes();});

  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  document.querySelectorAll(".theme-btn").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
  document.querySelectorAll(".basis-btn").forEach(b=>b.addEventListener("click",()=>setBasis(b.dataset.basis)));
  const _m=document.getElementById("cardModal"); if(_m) _m.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeCard));
  document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeCard(); });
  const _pb=document.getElementById("pb"); if(_pb) _pb.addEventListener("click",e=>{ const tr=e.target.closest&&e.target.closest("tr.crow-click"); if(tr) openCard(PROGRAMS[+tr.getAttribute("data-i")]); });
  const _rec=document.getElementById("pl-rec"); if(_rec) _rec.addEventListener("click",e=>{ const row=e.target.closest&&e.target.closest(".pcomp-row[data-i]"); if(row) openCard(PROGRAMS[+row.getAttribute("data-i")]); });

  setTheme("light"); buildFX(); renderBenchmarks(); renderPrograms(); renderOutcomes(); wirePlan(); initPlanFromURL();
}
document.addEventListener("DOMContentLoaded",init);

