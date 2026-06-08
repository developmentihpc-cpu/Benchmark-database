/* Benchmark DB — application logic (vanilla JS, in-memory only). */

/* ---------- Benchmark database app (vanilla, in-memory only) ---------- */
if(typeof PROGRAMS==="undefined"||typeof OUTCOMES==="undefined"){
  addEventListener("DOMContentLoaded",function(){ document.body.innerHTML=
    "<div style='font-family:system-ui,sans-serif;max-width:560px;margin:14vh auto;padding:28px;text-align:center;color:#33424f'>"+
    "<h1 style='font-weight:600;font-size:22px'>Couldn’t load the dataset</h1>"+
    "<p style='line-height:1.6'>The data file (<code>js/data.js</code>) didn’t load. If you opened this page directly from disk, serve it over HTTP instead — see the README — or check that <code>js/data.js</code> is present.</p></div>"; });
  throw new Error("Benchmark DB: js/data.js failed to load (PROGRAMS/OUTCOMES undefined)");
}
const DONOR_COLORS={Bilateral:"#4F7CA3",Multilateral:"#2E8B86",NGO:"#C2683E",
  Foundation:"#8E5BA6","Private sector":"#6B7785",Private:"#6B7785",Academic:"#7E8A6F",Other:"#98A0A8",PPP:"#5FB0AB"};
const SECTORS=["Emergency response","Basic drinking water","Public sector policy & PFM",
  "Civil society & participation","Primary education","Agricultural development","Basic health care"];
const DONORS=["Bilateral","Multilateral","NGO","Foundation","Private sector"];
const REGIONS=["Sub-Saharan Africa","MENA + Afg/Pak","South Asia","East Asia & Pacific","Latin Am. & Carib.","Europe & C. Asia"];
const STATUS_CLASS={Ongoing:"st-ong",Planned:"st-plan",Finalisation:"st-fin",Closed:"st-clo",Suspended:"st-sus",Cancelled:"st-sus"};
/* Pure helpers (DAY, parseDate, durMonths, median, quantile, statsOf, pctRank,
   num, esc, cc, achClass, nf, fmtUSD, fmtCompact, fmtNum, fmtPct) live in
   js/lib.js, loaded before app.js. */
let BASIS="nominal";
function deflF(y){ if(BASIS!=="real"||typeof DEFLATOR==="undefined"||!DEFLATOR.f) return 1; const f=DEFLATOR.f[String(y)]; return (typeof f==="number")?f:1; }
function usdOf(r){ const x=RATES[r.c]; if(typeof x!=="number") return null; return r.a*x*deflF(r.year); }
function fxNote(p){ const r=RATES[p.c]; if(typeof r!=="number") return "no FX rate for "+(p.c||"(no currency reported)")+" — excluded from USD figures";
  let s=(p.c||"?")+"→USD ×"+r; if(BASIS==="real"){ const f=deflF(p.year); if(f!==1) s+=" · US CPI ×"+f.toFixed(3)+" → 2024"; } return s; }

PROGRAMS.forEach(p=>{ p._dur=durMonths(p.st,p.en); });
OUTCOMES.forEach(o=>{ o._ach=(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number")?o.ac/o.tg:null; });
function recomputeUSD(){ PROGRAMS.forEach(p=>{ p._usd=usdOf(p); }); }
recomputeUSD();
PROGRAMS.forEach((p,i)=>{p._i=i;});
const PROG_BY_NAME={}; PROGRAMS.forEach(p=>{ if(p.n!=null && !(p.n in PROG_BY_NAME)) PROG_BY_NAME[p.n]=p._i; });

/* nf, fmtUSD, fmtCompact, fmtNum, fmtPct, esc — see js/lib.js */

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

const REDUCE_MOTION=(typeof matchMedia!=="undefined")&&matchMedia("(prefers-reduced-motion: reduce)").matches;
function countUp(el,to,fmt){ if(!el) return; const from=(typeof el._val==="number")?el._val:0; el._val=(to==null?0:to);
  if(REDUCE_MOTION){ el.textContent=fmt(to); return; }
  if(to==null){ el.textContent=fmt(null); return; } const t0=performance.now(),d=460;
  function step(t){ const k=Math.min(1,(t-t0)/d),e=1-Math.pow(1-k,3); el.textContent=fmt(from+(to-from)*e); if(k<1) requestAnimationFrame(step); else el.textContent=fmt(to); }
  requestAnimationFrame(step); }

function renderStats(rows){
  const n=rows.length, medB=median(rows.map(r=>r._usd)), medD=median(rows.map(r=>r._dur));
  const wr=rows.filter(r=>r.re).length, noFx=rows.filter(r=>r._usd==null).length;
  countUp(document.getElementById("st-n"),n,v=>fmtNum(Math.round(v)));
  countUp(document.getElementById("st-budget"),medB,fmtCompact);
  countUp(document.getElementById("st-dur"),medD,v=>(v==null?"—":Math.round(v)));
  countUp(document.getElementById("st-res"),n?wr/n:null,fmtPct);
  const basis=BASIS==="real"?"≈ real 2024 USD (CPI)":"≈ nominal USD · FX";
  setText("st-budget-sub",basis+(noFx?" · "+nf.format(noFx)+" excl. (no currency)":""));
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
    const aria=isOn?(state.dir<0?"descending":"ascending"):"none";
    return "<th class='"+c.c+(nosort?" nosort":"")+"'"+(nosort?"":" data-key='"+c.k+"' tabindex='0' aria-sort='"+aria+"'")+(isOn?" data-on='1'":"")+">"+c.t+arr+"</th>"; }).join(""); }

function renderPrograms(){
  PCOLS[10].t="≈ USD"+(BASIS==="real"?" ’24":"");
  const filtered=filterPrograms(); const total=filtered.length;
  let rows=sortRows(filtered,PS.sort,PS.dir);
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
     "<td class='c-num strong' title='"+esc(fxNote(p))+"'>"+fmtUSD(p._usd)+"</td>"+
     "<td class='c-num rep' title='"+esc(p.rb||"")+"'>"+(p.rc===""||p.rc==null?"—":fmtNum(p.rc))+(p.rc&&p.rb?"<span class='sub'>"+esc((p.rb||"").slice(0,24))+"</span>":"")+"</td>"+
     "<td class='c-mid'>"+(p.re?"<span class='pill ok'>yes</span>":"<span class='dash'>–</span>")+"</td>"+
     "<td class='c-mid'><span class='rowmore'>open ›</span></td></tr>";
  }).join("")||"<tr><td colspan='14' class='empty'>No programmes match these filters.</td></tr>";
  const s=total?start+1:0,e=Math.min(start+PS.size,total);
  setText("p-count",nf.format(total)); setText("p-range",nf.format(s)+"–"+nf.format(e)); setText("p-page",PS.page+" / "+pages);
  setText("sb-n",nf.format(total));
  { const tbl=document.getElementById("pb").closest("table"); if(tbl) tbl.classList.toggle("virtual",slice.length>200); }
  renderHead("ph",PCOLS,PS); renderStats(filtered); syncURL();
}

const OCOLS=[{k:"n",t:"Programme",c:"c-name"},{k:"s",t:"Stream",c:"c-tag"},{k:"sn",t:"Sector",c:"c-tag"},
 {k:"t",t:"Type",c:"c-tag"},{k:"i",t:"Indicator",c:"c-ind"},{k:"bl",t:"Baseline",c:"c-num"},
 {k:"tg",t:"Target",c:"c-num"},{k:"ac",t:"Actual",c:"c-num"},{k:"_ach",t:"Achieved",c:"c-num"}];
/* achClass — see js/lib.js */
function renderOutcomes(){
  let rows=filterOutcomes(); const total=rows.length; rows=sortRows(rows,OS.sort,OS.dir);
  const pages=Math.max(1,Math.ceil(total/OS.size)); if(OS.page>pages) OS.page=pages;
  const start=(OS.page-1)*OS.size, slice=rows.slice(start,start+OS.size);
  document.getElementById("ob").innerHTML=slice.map(o=>{ const m=(o.m==="%")?"%":""; const pi=PROG_BY_NAME[o.n];
    return "<tr"+(pi!=null?" class='crow-click' data-i='"+pi+"'":"")+"><td class='c-name'>"+esc(o.n)+(pi!=null?" <span class='rowmore'>open ›</span>":"")+"</td><td class='c-tag'>"+esc(o.s)+"</td><td class='c-tag'>"+esc(o.sn)+"</td>"+
     "<td class='c-tag'>"+esc(o.t)+"</td><td class='c-ind'>"+esc(o.i)+"</td>"+
     "<td class='c-num rep'>"+(o.bl==null?"—":nf.format(o.bl)+m)+"</td>"+
     "<td class='c-num rep'>"+(o.tg==null?"—":nf.format(o.tg)+m)+"</td>"+
     "<td class='c-num rep'>"+(o.ac==null?"—":nf.format(o.ac)+m)+"</td>"+
     "<td class='c-num "+achClass(o._ach)+"'>"+fmtPct(o._ach)+"</td></tr>";
  }).join("")||"<tr><td colspan='9' class='empty'>No outcomes match these filters.</td></tr>";
  const s=total?start+1:0,e=Math.min(start+OS.size,total);
  setText("o-count",nf.format(total)); setText("o-range",nf.format(s)+"–"+nf.format(e)); setText("o-page",OS.page+" / "+pages);
  { const tbl=document.getElementById("ob").closest("table"); if(tbl) tbl.classList.toggle("virtual",slice.length>200); }
  renderHead("oh",OCOLS,OS); syncURL();
}

function groupStats(fn){ const r=PROGRAMS.filter(fn); return {n:r.length,mb:median(r.map(x=>x._usd)),md:median(r.map(x=>x._dur)),
  pr:r.length?r.filter(x=>x.re).length/r.length:null}; }
function btable(title,sub,desc,specs,labelHdr,showTotal,showDot){
  const stats=specs.map(s=>{const g=groupStats(s.fn); return {lab:s.lab,total:s.total,n:g.n,mb:g.mb,md:g.md,pr:g.pr};});
  const maxB=Math.max(1,...stats.map(s=>s.mb||0));
  let h="<div class='btable'><div class='bt-cap'><span>"+esc(title)+"</span><em>"+esc(sub)+"</em></div>"+
   (desc?"<p class='bt-desc'>"+esc(desc)+"</p>":"")+
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
    btable("A \u00b7 Bilateral programmes by sector","donor type = Bilateral — your headline benchmark","Median budget, duration and reporting rate for programmes funded by a single government (bilateral) — the closest comparator for a typical donor grant. Start your scope from the median budget; the bar shows it against the other sectors.",
      bilat,"Sector",true,false)+
    btable("B \u00b7 All programmes by sector","any donor type","The same metrics with every donor type pooled. Usually larger than A because it includes multilateral facilities, so read it for the full per-sector spread rather than a single grant.",
      all,"Sector",true,false)+
    btable("C \u00b7 By donor type","across all sectors & regions","How typical scale and reporting differ by funder type, across all sectors and regions — multilaterals generally run larger, longer programmes than NGOs or foundations.",
      don,"Donor type",false,true)+
    btable("D \u00b7 By region","across all sectors & donors","Typical scale and reporting by world region, across all sectors and donors — context for where a programme sits geographically.",
      reg,"Region",false,false)+
    btable("E \u00b7 By providing country","inferred funder country \u2014 bilateral & co-funded; top 12 by count","Indicative typical programme size per funding government, for bilateral and co-funded programmes (top 12 by count). Provider country is inferred from the funder/reporter, so treat as approximate.",
      prov,"Providing country",false,false)+
    "<p class='bnote'>Computed live over the "+nf.format(PROGRAMS.length)+" embedded programmes (a global sample; the recent IATI universe per sector is larger — see the 'In IATI' column and #read_me). Bars scale to the largest median in each table. <b>Cost-per-beneficiary and aggregate achievement are intentionally absent</b> — IATI reach and target/actual fields are non-comparable.</p>";
}

function dl(name,text){ const b=new Blob([text],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a"); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1500); }
/* cc (CSV cell) — see js/lib.js */
function exportPrograms(){ const rows=sortRows(filterPrograms(),PS.sort,PS.dir);
  const head=["Programme","Description","Country","ISO","Region","Donor type","Providing country","Funder","Reporting org","Reporter type","Stream","DAC code","Sector","Status","Start","End","Duration (mo)","Currency","Amount (orig)","Basis","USD approx","Reach","Reach basis","Reports results","IATI id"];
  const L=[head.map(cc).join(",")];
  rows.forEach(p=>L.push([p.n,(p.desc||""),p.co,p.cc,p.rg,p.d,p.pn,(p.fn||p.r),p.r,p.rt,p.s,p.sc,p.sn,p.sta,p.st,p.en,p._dur,p.c,p.a,p.b,(p._usd==null?"":Math.round(p._usd)),(p.rc===""?"":p.rc),p.rb,(p.re?"Y":"N"),p.id].map(cc).join(",")));
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

/* ---------- data quality / coverage ---------- */
function dqTile(k,v,s){ return "<div class='dqcard'><div class='dq-k'>"+esc(k)+"</div><div class='dq-v'>"+v+"</div><div class='dq-s'>"+esc(s)+"</div></div>"; }
function renderDQ(){
  const el=document.getElementById("dq"); if(!el) return; const N=PROGRAMS.length, pc=(n,d)=>d?Math.round(100*n/d)+"%":"—";
  const priced=PROGRAMS.filter(p=>p._usd!=null).length, noCur=PROGRAMS.filter(p=>!p.c).length;
  const dur=PROGRAMS.filter(p=>p._dur!=null).length, end=PROGRAMS.filter(p=>p.en).length;
  const res=PROGRAMS.filter(p=>p.re).length, reach=PROGRAMS.filter(p=>p.rc!=null&&p.rc!=="").length;
  const bilat=PROGRAMS.filter(p=>p.d==="Bilateral"), bilatProv=bilat.filter(p=>p.pcc).length, multi=PROGRAMS.filter(p=>p.multi).length;
  const years=PROGRAMS.map(p=>p.year).filter(Boolean), ymin=Math.min(...years), ymax=Math.max(...years);
  const O=OUTCOMES.length, oTgt=OUTCOMES.filter(o=>typeof o.tg==="number"&&o.tg>0).length, oAct=OUTCOMES.filter(o=>typeof o.ac==="number").length;
  const desc=PROGRAMS.filter(p=>p.desc).length;
  el.innerHTML=
    dqTile("English description",pc(desc,N),fmtNum(desc)+" of "+fmtNum(N)+" — real IATI text; rest use a derived summary")+
    dqTile("Budget priced to USD",pc(priced,N),fmtNum(priced)+" of "+fmtNum(N)+" · "+fmtNum(noCur)+" report no currency")+
    dqTile("Duration derivable",pc(dur,N),"valid start + end dates")+
    dqTile("End date present",pc(end,N),fmtNum(end)+" programmes")+
    dqTile("Report results",pc(res,N),fmtNum(res)+" programmes")+
    dqTile("Report reach",pc(reach,N),fmtNum(reach)+" — sparse & non-comparable")+
    dqTile("Bilateral: provider inferred",pc(bilatProv,bilat.length),"of "+fmtNum(bilat.length)+" bilateral")+
    dqTile("Multi-country",pc(multi,N),"flagged with +")+
    dqTile("Indicators (outcomes)",fmtNum(O),"target "+pc(oTgt,O)+" · actual "+pc(oAct,O))+
    dqTile("Start-year range",ymin+"–"+ymax,"reported activity start");
}

/* ---------- Plan a programme ---------- */
const COUNTRY_REGION=Object.assign({},(typeof DEVREGION!=="undefined"?DEVREGION:{}));
PROGRAMS.forEach(p=>{ if(p.co&&!COUNTRY_REGION[p.co]) COUNTRY_REGION[p.co]=p.rg; });
const ALL_COUNTRIES=(typeof DEVREGION!=="undefined")?Object.keys(DEVREGION).sort():uniq(PROGRAMS,"co");
const PL={country:"",sector:"Basic health care",donor:"",need:null,budget:null,dur:null,target:null,link:false,base:null};
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=(v==null?"":v); }
/* num, quantile, statsOf, pctRank — see js/lib.js */
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
  el.innerHTML=h; syncURL();
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
const SECTOR_DESC={
 "Emergency response":"Delivers emergency humanitarian relief — rapid assistance to people affected by conflict, disaster or displacement.",
 "Basic drinking water":"Builds and rehabilitates water supply and sanitation — wells, boreholes, piped water, treatment and latrines.",
 "Public sector policy & PFM":"Strengthens public-sector governance — policy, planning and public financial management.",
 "Civil society & participation":"Supports civil society and civic participation — community organisations, rights and inclusion.",
 "Primary education":"Supports primary education — schools, teaching, learning materials and access to basic schooling.",
 "Agricultural development":"Develops agriculture and rural livelihoods — supporting farmers, crops, livestock and value chains.",
 "Basic health care":"Provides basic health care — primary services, clinics, essential medicines and treatment."
};
function descOutputs(p){
  const os=OUTCOMES.filter(o=>o.n===p.n);
  if(!os.length) return [];
  os.sort((a,b)=>(a.t==="output"?0:1)-(b.t==="output"?0:1));   // concrete outputs first
  const seen=new Set(), items=[];
  for(const o of os){ let t=(o.i||"").replace(/\s+/g," ").trim(); if(!t) continue; if(t.length>90) t=t.slice(0,88)+"…";
    const k=t.toLowerCase(); if(seen.has(k)) continue; seen.add(k); items.push(t); if(items.length>=3) break; }
  return items;
}
function progDesc(p){
  if(p.desc) return p.desc;                                   // real IATI description (enriched)
  let s=SECTOR_DESC[p.sn]||((p.sn||"Development")+" programme.");
  const outs=descOutputs(p);
  if(outs.length) s+=" Reported outputs include "+outs.join("; ")+".";
  else if(p.rb) s+=" Activity tracked: "+p.rb+".";
  return s;
}
function progDescIsReal(p){ return !!p.desc; }
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
  const _ad=progDesc(p), _along=_ad.length>200;
  h+="<div class='cardsec cabout-sec'><p class='cabout"+(_along?" clamp":"")+"'>"+esc(_ad)+"</p>"+(_along?"<button class='cmore' type='button'>Show more</button>":"")+"<span class='tagmini"+(progDescIsReal(p)?" rep":"")+"'>"+(progDescIsReal(p)?"reported — IATI activity description":"derived — inferred from sector &amp; reported indicators")+"</span></div>";
  h+="<div class='cardsec'><div class='cardgrid'>"+cf("Receiving country",esc(p.co)+(p.multi?" <span class='muted'>(+ others)</span>":""))+((p.d==="Bilateral")?cf("Providing country",(p.pn?esc(p.pn)+" <span class='muted'>("+esc(p.pcc)+", inferred)</span>":"—")):"")+cf("Funder",esc(p.fn||p.r||"—"))+cf("Region",esc(p.rg))+cf("Reporting org",esc(p.r)+" <span class='muted'>("+esc(p.rt||"—")+")</span>")+cf("Sector code",esc(p.sc))+"</div></div>";
  h+="<div class='cardsec'><h3>Finance &amp; timeline</h3><div class='cardgrid'>"+cfBig("Budget",esc(p.c)+" "+nf.format(Math.round(p.a)))+cfBig(BASIS==="real"?"≈ real 2024 USD":"≈ nominal USD",fmtUSD(p._usd))+cf("FX applied",esc(fxNote(p)))+cf("Reported as",esc(p.b||"—"))+cf("Start",esc(p.st||"—"))+cf("End",esc(p.en||"—"))+cf("Duration",(p._dur==null?"—":p._dur+" months"))+"</div></div>";
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
  const _more=m.querySelector(".cmore"); if(_more) _more.addEventListener("click",()=>{ const pEl=m.querySelector(".cabout"); const ex=pEl.classList.toggle("expanded"); pEl.classList.toggle("clamp",!ex); _more.textContent=ex?"Show less":"Show more"; });
}

function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function showView(name){
  CURRENT_VIEW=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("show",v.id==="view-"+name));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="charts") renderCharts();
  if(name==="compare") renderCompare();
  syncURL();
}
function setTheme(t){ document.documentElement.setAttribute("data-theme",t);
  document.querySelectorAll(".theme-btn").forEach(b=>b.classList.toggle("on",b.dataset.theme===t)); }
function setBasis(x){ BASIS=x; document.querySelectorAll(".basis-btn").forEach(b=>b.classList.toggle("on",b.dataset.basis===x)); recomputeUSD(); renderPrograms(); renderBenchmarks(); renderCharts(); renderCountry(); renderCompare(); if(typeof renderPlanRec==="function"){renderPlanRec();renderPlanCalc();} }

/* ---------- shareable URL state ---------- */
let CURRENT_VIEW="programmes", URL_READY=false;
function reflectControls(){
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v;};
  set("q",PS.q); set("sq",PS.q); set("f-donor",PS.d); set("f-region",PS.rg); set("f-country",PS.co);
  set("f-sector",PS.sc); set("f-status",PS.sta); set("f-res",PS.re); set("f-provider",PS.prov);
  set("pgsize",PS.size>=1e9?"all":String(PS.size));
  set("oq",OS.q); set("o-stream",OS.s); set("o-sector",OS.sn); set("o-type",OS.t);
  set("opgsize",OS.size>=1e9?"all":String(OS.size));
  if(CY.country) set("cy-pick",CY.country);
  set("ch-sector",CS.sc); set("ch-region",CS.rg); set("ch-donor",CS.d);
  set("cmp-dim",CMP.dim); fillCmpEntities();
}
function syncURL(){
  if(!URL_READY) return;
  const qp=new URLSearchParams();
  if(CURRENT_VIEW&&CURRENT_VIEW!=="programmes") qp.set("view",CURRENT_VIEW);
  if(BASIS==="real") qp.set("usd","real");
  if(CURRENT_VIEW==="programmes"){
    if(PS.q)qp.set("q",PS.q); if(PS.d)qp.set("donor",PS.d); if(PS.rg)qp.set("region",PS.rg); if(PS.co)qp.set("country",PS.co);
    if(PS.sc)qp.set("sector",PS.sc); if(PS.sta)qp.set("status",PS.sta); if(PS.re)qp.set("results",PS.re); if(PS.prov)qp.set("provider",PS.prov);
    if(PS.sort!=="_usd")qp.set("sort",PS.sort); if(PS.dir!==-1)qp.set("dir",PS.dir);
    if(PS.page>1)qp.set("page",PS.page); if(PS.size!==50)qp.set("size",PS.size>=1e9?"all":PS.size);
  } else if(CURRENT_VIEW==="outcomes"){
    if(OS.q)qp.set("q",OS.q); if(OS.s)qp.set("stream",OS.s); if(OS.sn)qp.set("sector",OS.sn); if(OS.t)qp.set("type",OS.t);
    if(OS.sort!=="_ach")qp.set("sort",OS.sort); if(OS.dir!==-1)qp.set("dir",OS.dir);
    if(OS.page>1)qp.set("page",OS.page); if(OS.size!==50)qp.set("size",OS.size>=1e9?"all":OS.size);
  } else if(CURRENT_VIEW==="countries"){
    if(CY.country)qp.set("country",CY.country);
  } else if(CURRENT_VIEW==="charts"){
    if(CS.sc)qp.set("sector",CS.sc); if(CS.rg)qp.set("region",CS.rg); if(CS.d)qp.set("donor",CS.d);
  } else if(CURRENT_VIEW==="compare"){
    qp.set("dim",CMP.dim); const it=CMP.items.filter(Boolean); if(it.length)qp.set("vs",it.join("~"));
  } else if(CURRENT_VIEW==="plan"){
    if(PL.country)qp.set("country",PL.country); if(PL.sector)qp.set("sector",PL.sector); if(PL.donor)qp.set("donor",PL.donor);
    if(PL.budget!=null)qp.set("budget",PL.budget); if(PL.dur!=null)qp.set("duration",PL.dur); if(PL.target!=null)qp.set("target",PL.target);
  }
  const qs=qp.toString();
  try{ history.replaceState(null,"",location.pathname+(qs?"?"+qs:"")); }catch(e){}
}
function route(){
  const qp=new URLSearchParams(location.search);
  if(qp.get("usd")==="real") setBasis("real");
  const view=qp.get("view");
  const plannerIntent = view==="plan"||qp.has("target")||qp.has("budget")||qp.has("duration")||qp.has("people");
  if(plannerIntent){ initPlanFromURL(); return; }
  if(view==="outcomes"){
    OS.q=qp.get("q")||""; OS.s=qp.get("stream")||""; OS.sn=qp.get("sector")||""; OS.t=qp.get("type")||"";
    if(qp.get("sort"))OS.sort=qp.get("sort"); if(qp.get("dir"))OS.dir=+qp.get("dir");
    if(qp.get("page"))OS.page=+qp.get("page"); const z=qp.get("size"); if(z)OS.size=(z==="all"?1e9:+z);
  } else if(view==="countries"){
    CY.country=qp.get("country")||"";
  } else if(view==="charts"){
    CS.sc=qp.get("sector")||""; CS.rg=qp.get("region")||""; CS.d=qp.get("donor")||"";
  } else if(view==="compare"){
    if(qp.get("dim")) CMP.dim=qp.get("dim"); const vs=qp.get("vs"); if(vs){ CMP.items=vs.split("~").slice(0,4); while(CMP.items.length<4)CMP.items.push(""); }
  } else if(!view||view==="programmes"){
    PS.q=qp.get("q")||""; PS.d=qp.get("donor")||""; PS.rg=qp.get("region")||""; PS.co=qp.get("country")||"";
    PS.sc=qp.get("sector")||""; PS.sta=qp.get("status")||""; PS.re=qp.get("results")||""; PS.prov=qp.get("provider")||"";
    if(qp.get("sort"))PS.sort=qp.get("sort"); if(qp.get("dir"))PS.dir=+qp.get("dir");
    if(qp.get("page"))PS.page=+qp.get("page"); const z=qp.get("size"); if(z)PS.size=(z==="all"?1e9:+z);
  }
  reflectControls();
  renderPrograms(); renderOutcomes(); renderCountry();
  showView(view||"programmes");
}

/* ---------- Charts (zero-dependency SVG) ---------- */
function svgBars(data,o){ o=o||{}; const W=o.w||540,H=o.h||230,pL=44,pR=10,pT=10,pB=o.rot?52:30;
  const max=Math.max(1,...data.map(d=>d.v)),iw=W-pL-pR,ih=H-pT-pB,bw=iw/(data.length||1); let g="",b="",x="";
  for(let i=0;i<=4;i++){const y=pT+ih*(1-i/4); g+="<line class='cg' x1='"+pL+"' y1='"+y.toFixed(1)+"' x2='"+(W-pR)+"' y2='"+y.toFixed(1)+"'/><text class='ct' x='"+(pL-5)+"' y='"+(y+3).toFixed(1)+"' text-anchor='end'>"+fmtNum(Math.round(max*i/4))+"</text>";}
  data.forEach((d,i)=>{const h=ih*(d.v/max),bx=pL+bw*i+bw*0.16,w=bw*0.68,by=pT+ih-h,cx=bx+w/2;
    b+="<rect class='cbar' x='"+bx.toFixed(1)+"' y='"+by.toFixed(1)+"' width='"+w.toFixed(1)+"' height='"+Math.max(0,h).toFixed(1)+"' rx='2'><title>"+esc(d.l)+": "+fmtNum(d.v)+(d.s?" · "+esc(d.s):"")+"</title></rect>";
    x+= o.rot ? "<text class='cx' x='"+cx.toFixed(1)+"' y='"+(H-pB+12)+"' text-anchor='end' transform='rotate(-40 "+cx.toFixed(1)+" "+(H-pB+12)+")'>"+esc(d.l)+"</text>"
              : "<text class='cx' x='"+cx.toFixed(1)+"' y='"+(H-pB+14)+"' text-anchor='middle'>"+esc(d.l)+"</text>";
  });
  return "<svg viewBox='0 0 "+W+" "+H+"' class='chart' preserveAspectRatio='xMidYMid meet'>"+g+b+x+"</svg>";
}
function svgHBars(data,o){ o=o||{}; const W=o.w||540,rowH=27,pL=132,pR=58,pT=6,H=pT*2+rowH*(data.length||1);
  const max=Math.max(1,...data.map(d=>d.v)); let s="";
  data.forEach((d,i)=>{const y=pT+rowH*i,bw=(W-pL-pR)*(d.v/max);
    s+="<text class='chl' x='"+(pL-8)+"' y='"+(y+rowH/2+3).toFixed(1)+"' text-anchor='end'>"+esc(d.l)+"</text>";
    s+="<rect class='cbar' x='"+pL+"' y='"+(y+5).toFixed(1)+"' width='"+Math.max(1,bw).toFixed(1)+"' height='"+(rowH-12)+"' rx='2'><title>"+esc(d.l)+": "+fmtNum(d.v)+(d.s?" · "+esc(d.s):"")+"</title></rect>";
    s+="<text class='cval' x='"+(pL+bw+5).toFixed(1)+"' y='"+(y+rowH/2+3).toFixed(1)+"'>"+esc(d.disp||fmtNum(d.v))+"</text>";
  });
  return "<svg viewBox='0 0 "+W+" "+H+"' class='chart' preserveAspectRatio='xMidYMid meet'>"+s+"</svg>";
}
function svgScatter(pts,o){ o=o||{}; const W=o.w||540,H=o.h||250,pL=46,pR=12,pT=10,pB=34,iw=W-pL-pR,ih=H-pT-pB;
  const xs=pts.map(p=>p.x).filter(v=>v>0); if(!xs.length) return "<svg viewBox='0 0 "+W+" "+H+"' class='chart'></svg>";
  const xmin=Math.log10(Math.min(...xs)),xmax=Math.log10(Math.max(...xs)),ymax=Math.max(1,...pts.map(p=>p.y)),span=(xmax-xmin)||1; let g="",c="";
  for(let e=Math.ceil(xmin);e<=Math.floor(xmax);e++){const px=pL+iw*((e-xmin)/span); g+="<line class='cg' x1='"+px.toFixed(1)+"' y1='"+pT+"' x2='"+px.toFixed(1)+"' y2='"+(pT+ih)+"'/><text class='cx' x='"+px.toFixed(1)+"' y='"+(H-pB+14)+"' text-anchor='middle'>"+fmtCompact(Math.pow(10,e))+"</text>";}
  for(let i=0;i<=4;i++){const y=pT+ih*(1-i/4); g+="<line class='cg' x1='"+pL+"' y1='"+y.toFixed(1)+"' x2='"+(W-pR)+"' y2='"+y.toFixed(1)+"'/><text class='ct' x='"+(pL-5)+"' y='"+(y+3).toFixed(1)+"' text-anchor='end'>"+Math.round(ymax*i/4)+"</text>";}
  pts.forEach(p=>{ if(!(p.x>0))return; const px=pL+iw*((Math.log10(p.x)-xmin)/span),py=pT+ih*(1-Math.min(1,p.y/ymax)); c+="<circle class='cpt' cx='"+px.toFixed(1)+"' cy='"+py.toFixed(1)+"' r='2.4'><title>"+esc(p.t||"")+"</title></circle>"; });
  return "<svg viewBox='0 0 "+W+" "+H+"' class='chart' preserveAspectRatio='xMidYMid meet'>"+g+c+"</svg>";
}
function chartCard(t,s,svg){ return "<div class='chartcard'><h3>"+esc(t)+"</h3><p class='csub'>"+esc(s)+"</p>"+svg+"</div>"; }
const CS={sc:"",rg:"",d:""};
function chartRows(){ return PROGRAMS.filter(p=> (!CS.sc||p.sn===CS.sc) && (!CS.rg||p.rg===CS.rg) && (!CS.d||p.d===CS.d)); }
function renderCharts(){
  const el=document.getElementById("charts"); if(!el) return;
  const rows=chartRows(), usdLab=BASIS==="real"?"real 2024 USD":"nominal USD";
  const filtered=!!(CS.sc||CS.rg||CS.d);
  setText("ch-count",fmtNum(rows.length)+(filtered?" of "+fmtNum(PROGRAMS.length):"")+" programmes");
  const edges=[1e4,1e5,1e6,1e7,1e8,1e9],blab=["<10k","10k–100k","100k–1M","1M–10M","10M–100M","100M–1B",">1B"],bc=new Array(7).fill(0);
  rows.forEach(p=>{ if(p._usd==null)return; let bi=0; while(bi<edges.length&&p._usd>=edges[bi])bi++; bc[bi]++; });
  const c1=svgBars(blab.map((l,i)=>({l,v:bc[i]})),{});
  const yc={}; rows.forEach(p=>{ if(p.year&&p.year>=2012) yc[p.year]=(yc[p.year]||0)+1; });
  const years=Object.keys(yc).map(Number).sort((a,b)=>a-b);
  const c2=svgBars(years.map(y=>({l:String(y),v:yc[y]})),{rot:years.length>10});
  const pts=rows.filter(p=>p._usd!=null&&p._dur!=null&&p._dur>0).map(p=>({x:p._usd,y:p._dur,t:p.n+" · "+fmtCompact(p._usd)+" · "+p._dur+"mo"}));
  const c3=svgScatter(pts,{});
  // 4th chart: by region normally, but by sector when a single region is selected
  let c4,c4t,c4s;
  if(CS.rg){ const bs=SECTORS.map(s=>{const r=rows.filter(p=>p.sn===s);return {l:s,v:r.length,s:"med "+fmtCompact(median(r.map(x=>x._usd))),disp:fmtNum(r.length)};}).filter(d=>d.v).sort((a,b)=>b.v-a.v);
    c4=svgHBars(bs,{}); c4t="By sector"; c4s="Within "+CS.rg+"; median budget on hover"; }
  else { const rc=REGIONS.map(rg=>{const r=rows.filter(p=>p.rg===rg);return {l:rg,v:r.length,s:"med "+fmtCompact(median(r.map(x=>x._usd))),disp:fmtNum(r.length)};}).filter(d=>d.v).sort((a,b)=>b.v-a.v);
    c4=svgHBars(rc,{}); c4t="By region"; c4s="Programme count; median budget on hover"; }
  el.innerHTML=
    chartCard("Budget distribution","Programmes by ≈USD band ("+usdLab+") — "+fmtNum(rows.filter(p=>p._usd!=null).length)+" priced",c1)+
    chartCard("Programmes by start year","Count by reported start year",c2)+
    chartCard("Budget vs duration","Each point a programme — log budget ("+usdLab+") × months",c3)+
    chartCard(c4t,c4s,c4);
}

/* ---------- Country profiles ---------- */
const CY={country:""};
function cyTop(rows,key,n){ const m={}; rows.forEach(r=>{const k=r[key]; if(k) m[k]=(m[k]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n); }
function cyBars(items){ const max=Math.max(1,...items.map(d=>d.v)); return items.map(d=>"<div class='cp-bar-row'><span class='cp-bl'>"+esc(d.l)+"</span><span class='cp-bar'><span style='width:"+Math.round(100*d.v/max)+"%'></span></span><span class='cp-bv'>"+esc(d.disp||String(d.v))+"</span></div>").join("")||"<p class='muted'>—</p>"; }
function renderCountry(){
  const el=document.getElementById("country"); if(!el) return;
  if(!CY.country){ el.innerHTML="<div class='cprompt'>Select a country above to see its profile.</div>"; syncURL(); return; }
  const rows=PROGRAMS.filter(p=>p.co===CY.country);
  if(!rows.length){ el.innerHTML="<div class='cprompt'>No programmes for "+esc(CY.country)+".</div>"; syncURL(); return; }
  const rg=rows[0].rg,medB=median(rows.map(r=>r._usd)),medD=median(rows.map(r=>r._dur)),resPct=rows.filter(r=>r.re).length/rows.length;
  const secMap={}; rows.forEach(r=>{(secMap[r.sn]=secMap[r.sn]||[]).push(r);});
  const secs=Object.entries(secMap).map(([k,v])=>({l:k,v:v.length,disp:v.length+" · "+fmtCompact(median(v.map(x=>x._usd)))})).sort((a,b)=>b.v-a.v);
  const donors=cyTop(rows,"d",6).map(([l,v])=>({l,v,disp:String(v)}));
  const provs=cyTop(rows.filter(r=>r.pcc),"pn",5).map(([l,v])=>({l,v,disp:String(v)}));
  const recent=rows.slice().sort((a,b)=>(b.st||"").localeCompare(a.st||"")).slice(0,8);
  let h="<div class='cprofile'>";
  h+="<div class='cp-head'><div class='cp-region'>"+esc(rg||"")+"</div><div class='cp-actions'><button id='cy-grid' class='btn ghost'>View "+fmtNum(rows.length)+" in Programmes →</button><button id='cy-plan' class='btn'>Plan in "+esc(CY.country)+" →</button></div></div>";
  h+="<div class='cp-stats'>"+
    "<div class='cp-card'><div class='cp-k'>Programmes</div><div class='cp-v'>"+fmtNum(rows.length)+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Median budget</div><div class='cp-v'>"+fmtCompact(medB)+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Median duration</div><div class='cp-v'>"+(medD==null?"—":Math.round(medD)+" mo")+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Report results</div><div class='cp-v'>"+fmtPct(resPct)+"</div></div></div>";
  h+="<div class='cp-grid2'>"+
    "<div class='cp-panel'><h3>By sector</h3>"+cyBars(secs)+"</div>"+
    "<div class='cp-panel'><h3>By donor type</h3>"+cyBars(donors)+(provs.length?"<h3 class='cp-h2'>Top providing countries</h3>"+cyBars(provs):"")+"</div></div>";
  h+="<div class='cp-panel'><h3>Recent programmes</h3>"+recent.map(p=>"<div class='cp-prog crow-click' data-i='"+p._i+"'><span class='pcn'>"+esc(p.n)+"</span><span class='pcm'>"+esc(p.sn)+" · "+chip(p.d)+" · "+fmtCompact(p._usd)+" · "+esc(p.st||"—")+" · <span class='rowmore'>open ›</span></span></div>").join("")+"</div>";
  h+="</div>";
  el.innerHTML=h;
  const g=document.getElementById("cy-grid"); if(g) g.addEventListener("click",()=>{ Object.assign(PS,{q:"",d:"",rg:"",co:CY.country,sc:"",sta:"",re:"",prov:"",page:1}); reflectControls(); showView("programmes"); renderPrograms(); });
  const pl=document.getElementById("cy-plan"); if(pl) pl.addEventListener("click",()=>{ PL.country=CY.country; setVal("pl-country",PL.country); showView("plan"); renderPlanRec(); renderPlanCalc(); });
  el.querySelectorAll(".cp-prog[data-i]").forEach(r=>r.addEventListener("click",()=>openCard(PROGRAMS[+r.getAttribute("data-i")])));
  syncURL();
}

/* ---------- Compare ---------- */
const CMP_DIMS=[
  {k:"co",label:"Country",vals:()=>uniq(PROGRAMS,"co")},
  {k:"sn",label:"Sector",vals:()=>uniq(PROGRAMS,"sn")},
  {k:"d",label:"Donor type",vals:()=>DONORS.filter(d=>PROGRAMS.some(p=>p.d===d))},
  {k:"rg",label:"Region",vals:()=>REGIONS.filter(r=>PROGRAMS.some(p=>p.rg===r))}
];
const CMP={dim:"sn",items:["Primary education","Agricultural development","Basic health care",""]};
function cmpDimLabel(k){ const d=CMP_DIMS.find(x=>x.k===k); return d?d.label:k; }
function cmpDimVals(k){ const d=CMP_DIMS.find(x=>x.k===k); return d?d.vals():[]; }
function cmpTop(rows,key){ const m={}; rows.forEach(r=>{const v=r[key]; if(v)m[v]=(m[v]||0)+1;}); const e=Object.entries(m).sort((a,b)=>b[1]-a[1])[0]; return (e&&rows.length)?esc(e[0])+" <span class='muted'>"+Math.round(100*e[1]/rows.length)+"%</span>":"—"; }
function cmpMetrics(rows){ const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  return { n:rows.length, medB:b.med, p25:b.p25, p75:b.p75, medD:d.med,
    res:rows.length?rows.filter(r=>r.re).length/rows.length:null,
    reach:rows.length?rows.filter(r=>r.rc!=null&&r.rc!=="").length/rows.length:null, rows }; }
function fillCmpEntities(){ const vals=cmpDimVals(CMP.dim); for(let i=0;i<4;i++){ fillSelect("cmp-"+i,vals,i<1?"Select…":"+ add"); setVal("cmp-"+i,CMP.items[i]||""); } }
function renderCompare(){
  const el=document.getElementById("compare"); if(!el) return; const f=CMP.dim;
  const items=CMP.items.filter((v,i,a)=>v&&a.indexOf(v)===i);
  if(!items.length){ el.innerHTML="<div class='cprompt'>Pick at least one "+esc(cmpDimLabel(f).toLowerCase())+" above to compare.</div>"; syncURL(); return; }
  const cols=items.map(v=>({v,m:cmpMetrics(PROGRAMS.filter(p=>p[f]===v))}));
  const maxB=Math.max(1,...cols.map(c=>c.m.medB||0));
  const best=(arr,hi)=>{ let bi=-1,bv=hi?-Infinity:Infinity; arr.forEach((x,i)=>{ if(x==null)return; if(hi?x>bv:x<bv){bv=x;bi=i;} }); return bi; };
  function bcell(m){ if(m.medB==null) return "<span class='muted'>—</span>"; const w=Math.max(4,Math.round(100*m.medB/maxB)); return "<span class='cmp-bar'><span style='width:"+w+"%'></span></span><span class='cmp-bv'>"+fmtCompact(m.medB)+"</span>"; }
  const defs=[
    {k:"Programmes", v:m=>fmtNum(m.n), pick:cols.map(c=>c.m.n), hi:true},
    {k:"Median budget", v:m=>bcell(m), pick:cols.map(c=>c.m.medB), hi:true},
    {k:"Typical range (p25–p75)", v:m=>m.p25==null?"—":fmtCompact(m.p25)+" – "+fmtCompact(m.p75)},
    {k:"Median duration", v:m=>m.medD==null?"—":Math.round(m.medD)+" mo"},
    {k:"Report results", v:m=>fmtPct(m.res), pick:cols.map(c=>c.m.res), hi:true},
    {k:"Report reach", v:m=>fmtPct(m.reach)}
  ];
  if(f!=="sn") defs.push({k:"Top sector", v:m=>cmpTop(m.rows,"sn")});
  if(f!=="d") defs.push({k:"Top donor type", v:m=>cmpTop(m.rows,"d")});
  if(f!=="rg"&&f!=="co") defs.push({k:"Top region", v:m=>cmpTop(m.rows,"rg")});
  let h="<div class='cmp-wrap'><table class='cmp-table'><thead><tr><th class='cmp-corner'>"+esc(cmpDimLabel(f))+"</th>"+cols.map(c=>"<th>"+esc(c.v)+"</th>").join("")+"</tr></thead><tbody>";
  defs.forEach(d=>{ const bi=d.pick?best(d.pick,d.hi):-1;
    h+="<tr><td class='cmp-k'>"+esc(d.k)+"</td>"+cols.map((c,i)=>"<td"+(i===bi?" class='cmp-best'":"")+">"+d.v(c.m)+"</td>").join("")+"</tr>"; });
  h+="</tbody></table><p class='cmp-note'>Highlighted = highest in that row. Medians over the embedded sample; budgets in "+(BASIS==="real"?"real 2024":"nominal")+" USD.</p></div>";
  el.innerHTML=h; syncURL();
}

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
  fillSelect("cy-pick",uniq(PROGRAMS,"co"),"Select a country");
  fillSelect("ch-sector",uniq(PROGRAMS,"sn"),"All sectors");
  fillSelect("ch-region",REGIONS.filter(r=>PROGRAMS.some(p=>p.rg===r)),"All regions");
  fillSelect("ch-donor",DONORS.filter(d=>PROGRAMS.some(p=>p.d===d)),"All donor types");
  const _dimSel=document.getElementById("cmp-dim"); if(_dimSel){ _dimSel.innerHTML=CMP_DIMS.map(d=>"<option value='"+d.k+"'>By "+esc(d.label)+"</option>").join(""); _dimSel.value=CMP.dim; }
  fillCmpEntities();
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
  on("cy-pick","change",e=>{CY.country=e.target.value;renderCountry();});
  on("ch-sector","change",e=>{CS.sc=e.target.value;renderCharts();syncURL();});
  on("ch-region","change",e=>{CS.rg=e.target.value;renderCharts();syncURL();});
  on("ch-donor","change",e=>{CS.d=e.target.value;renderCharts();syncURL();});
  on("cmp-dim","change",e=>{CMP.dim=e.target.value;CMP.items=["","","",""];fillCmpEntities();renderCompare();});
  for(let i=0;i<4;i++){ const idx=i; on("cmp-"+i,"change",e=>{CMP.items[idx]=e.target.value;renderCompare();}); }

  const phEl=document.getElementById("ph"); if(phEl) phEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th||th.classList.contains("nosort"))return;const k=th.dataset.key;if(!k)return;if(PS.sort===k)PS.dir*=-1;else{PS.sort=k;PS.dir=PSTR.split(" ").includes(k)?1:-1;}renderPrograms();});
  const ohEl=document.getElementById("oh"); if(ohEl) ohEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th)return;const k=th.dataset.key;if(!k)return;if(OS.sort===k)OS.dir*=-1;else{OS.sort=k;OS.dir=("n i s sn t".split(" ").includes(k))?1:-1;}renderOutcomes();});
  [phEl,ohEl].forEach(elx=>{ if(elx) elx.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const th=e.target.closest&&e.target.closest("th[data-key]"); if(th){ e.preventDefault(); th.click(); } } }); });

  const _mt=document.getElementById("menu-toggle"),_scrim=document.getElementById("navScrim");
  const setNav=open=>{ document.body.classList.toggle("nav-open",open); if(_mt) _mt.setAttribute("aria-expanded",open?"true":"false"); };
  if(_mt) _mt.addEventListener("click",()=>setNav(!document.body.classList.contains("nav-open")));
  if(_scrim) _scrim.addEventListener("click",()=>setNav(false));
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{showView(b.dataset.view);setNav(false);}));
  document.querySelectorAll(".theme-btn").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
  document.querySelectorAll(".basis-btn").forEach(b=>b.addEventListener("click",()=>setBasis(b.dataset.basis)));
  const _m=document.getElementById("cardModal"); if(_m) _m.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeCard));
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeCard(); setNav(false); } });
  const _pb=document.getElementById("pb"); if(_pb) _pb.addEventListener("click",e=>{ const tr=e.target.closest&&e.target.closest("tr.crow-click"); if(tr) openCard(PROGRAMS[+tr.getAttribute("data-i")]); });
  const _ob=document.getElementById("ob"); if(_ob) _ob.addEventListener("click",e=>{ const tr=e.target.closest&&e.target.closest("tr.crow-click"); if(tr) openCard(PROGRAMS[+tr.getAttribute("data-i")]); });
  const _rec=document.getElementById("pl-rec"); if(_rec) _rec.addEventListener("click",e=>{ const row=e.target.closest&&e.target.closest(".pcomp-row[data-i]"); if(row) openCard(PROGRAMS[+row.getAttribute("data-i")]); });

  setTheme("light"); buildFX(); renderDQ(); renderBenchmarks(); renderCharts(); renderCountry(); renderCompare(); renderPrograms(); renderOutcomes(); wirePlan();
  route(); URL_READY=true; syncURL();
}
document.addEventListener("DOMContentLoaded",init);

