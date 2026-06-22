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
const SECTORS_LEAD=["Emergency response","Basic drinking water","Public sector policy & PFM",
  "Civil society & participation","Primary education","Agricultural development","Basic health care"];
/* Benchmark "by sector" tables: lead with the curated sectors, then auto-include
 * any other sector with enough programmes to benchmark (added via add_sector.py),
 * ordered by representation. Keeps the view complete as the dataset grows. */
const SECTORS=(function(){ const c={}; PROGRAMS.forEach(p=>{ if(p.sn) c[p.sn]=(c[p.sn]||0)+1; });
  const lead=SECTORS_LEAD.filter(s=>c[s]);
  const extra=Object.keys(c).filter(s=>SECTORS_LEAD.indexOf(s)<0 && c[s]>=8).sort((a,b)=>c[b]-c[a]);
  return lead.concat(extra); })();
const DONORS=["Bilateral","Multilateral","NGO","Foundation","Private sector"];
const REGIONS=["Sub-Saharan Africa","MENA + Afg/Pak","South Asia","East Asia & Pacific","Latin Am. & Carib.","Europe & C. Asia"];
const STATUS_CLASS={Ongoing:"st-ong",Planned:"st-plan",Finalisation:"st-fin",Closed:"st-clo",Suspended:"st-sus",Cancelled:"st-sus"};
/* Pure helpers (DAY, parseDate, durMonths, median, quantile, statsOf, pctRank,
   num, esc, cc, achClass, nf, fmtUSD, fmtCompact, fmtNum, fmtPct) live in
   js/lib.js, loaded before app.js. */
let BASIS="nominal";
function deflF(y){ if(BASIS!=="real"||typeof DEFLATOR==="undefined"||!DEFLATOR.f) return 1; const f=DEFLATOR.f[String(y)]; return (typeof f==="number")?f:1; }
function usdOf(r){ const x=RATES[r.c]; if(typeof x!=="number") return null;
  if(!(typeof r.a==="number"&&r.a>0)) return null;            // no/zero amount = GAP, not a $0 programme
  return r.a*x*deflF(r.year); }
function fxNote(p){ const r=RATES[p.c]; if(typeof r!=="number") return "no FX rate for "+(p.c||"(no currency reported)")+" — excluded from USD figures";
  let s=(p.c||"?")+"→USD ×"+r; if(BASIS==="real"){ const f=deflF(p.year); if(f!==1) s+=" · US CPI ×"+f.toFixed(3)+" → 2024"; } return s; }

PROGRAMS.forEach(p=>{ p._dur=durMonths(p.st,p.en); });
OUTCOMES.forEach(o=>{ o._ach=(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number")?o.ac/o.tg:null; });
const AGG_USD=2e9;   // a single "programme" above this is a facility/portfolio total, not a discrete activity
function recomputeUSD(){ PROGRAMS.forEach(p=>{ p._usd=usdOf(p);
  const x=RATES[p.c]; p._agg=(typeof x==="number"&&p.a>0&&p.a*x>AGG_USD); }); }
recomputeUSD();
PROGRAMS.forEach((p,i)=>{p._i=i;});
const PROG_BY_NAME={}; PROGRAMS.forEach(p=>{ if(p.n!=null && !(p.n in PROG_BY_NAME)) PROG_BY_NAME[p.n]=p._i; });
const OUT_BY_NAME={}; OUTCOMES.forEach(o=>{ (OUT_BY_NAME[o.n]=OUT_BY_NAME[o.n]||[]).push(o); });
/* Display title: prefer the LLM English translation (name_en, added by enrich_llm.py)
 * over the raw — possibly non-English — title n. Linking/indexing still uses n. */
function pName(p){ return p?(p.name_en||i18n(p.n)):""; }
function ord(n){ const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function usdBasisLabel(){ return BASIS==="real"?"real 2024 USD (CPI-adjusted)":"nominal USD"; }

/* nf, fmtUSD, fmtCompact, fmtNum, fmtPct, esc — see js/lib.js */

const PS={q:"",d:"",rg:"",co:"",sc:"",sta:"",re:"",prov:"",sort:"_usd",dir:-1,page:1,size:50};
const OS={q:"",s:"",sn:"",t:"",prog:"",sort:"_ach",dir:-1,page:1,size:50};

function uniq(arr,key){ return [...new Set(arr.map(x=>x[key]).filter(Boolean))].sort(); }
function fillSelect(id,vals,label){ const el=document.getElementById(id); if(!el) return; el.innerHTML="<option value=''>"+label+"</option>"+vals.map(v=>"<option>"+esc(v)+"</option>").join(""); }

function filterPrograms(){ const q=PS.q.toLowerCase(); return PROGRAMS.filter(p=>{
  if(PS.d&&p.d!==PS.d) return false; if(PS.rg&&p.rg!==PS.rg) return false; if(PS.co&&p.co!==PS.co) return false;
  if(PS.sc&&p.sn!==PS.sc) return false; if(PS.sta&&p.sta!==PS.sta) return false;
  if(PS.re==="Y"&&!p.re) return false; if(PS.re==="N"&&p.re) return false;
  if(PS.prov&&p.pn!==PS.prov) return false;
  if(q&&!(((p.n||"")+" "+(p.name_en||"")).toLowerCase().includes(q)||(p.r||"").toLowerCase().includes(q)||(p.co||"").toLowerCase().includes(q))) return false;
  return true; }); }
function filterOutcomes(){ const q=OS.q.toLowerCase(); return OUTCOMES.filter(o=>{
  if(OS.prog&&o.n!==OS.prog) return false;
  if(OS.s&&o.s!==OS.s) return false; if(OS.sn&&o.sn!==OS.sn) return false; if(OS.t&&o.t!==OS.t) return false;
  if(q&&!(((o.n||"")+" "+(o.i||"")+" "+i18n(o.n||"")+" "+i18n(o.i||"")).toLowerCase().includes(q))) return false;
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
  requestAnimationFrame(step);
  clearTimeout(el._ct); el._ct=setTimeout(function(){ el.textContent=fmt(to); }, d+90); }   // safety net if rAF is throttled (backgrounded tab)

function renderStats(rows){
  const n=rows.length, medB=median(rows.map(r=>r._usd)), medD=median(rows.map(r=>r._dur));
  const wr=rows.filter(r=>r.re).length, noFx=rows.filter(r=>r._usd==null).length;
  countUp(document.getElementById("st-n"),n,v=>fmtNum(Math.round(v)));
  countUp(document.getElementById("st-budget"),medB,fmtUSD);
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
    return "<tr class='crow-click' data-i='"+p._i+"' tabindex='0' role='button' aria-label='Open details for "+esc(pName(p))+"'>"+
     "<td class='c-name'><span class='pname'>"+esc(pName(p))+"</span><span class='pid'>"+esc(i18n(p.r))+" · "+esc(p.sc)+"</span></td>"+
     "<td class='c-tag'"+(p.multi?" title='multiple recipient countries'":"")+">"+esc(p.co)+(p.multi?" <span class='multi'>+</span>":"")+"</td>"+
     "<td class='c-tag'>"+esc(p.rg)+"</td>"+
     "<td class='c-chip'>"+chip(p.d)+(p.d==="Bilateral"&&p.pcc?" <span class='provcc' title='providing country (inferred)'>"+esc(p.pcc)+"</span>":"")+"</td>"+
     "<td class='c-tag'>"+esc(p.sn)+"</td>"+
     "<td class='c-mid'>"+statusPill(p.sta)+"</td>"+
     "<td class='c-dim'>"+esc(p.st||"—")+"</td>"+"<td class='c-dim'>"+esc(p.en||"—")+"</td>"+
     "<td class='c-num'>"+(p._dur==null?"—":p._dur)+"</td>"+
     "<td class='c-num rep'>"+esc(p.c)+" "+nf.format(Math.round(p.a))+"<span class='sub'>"+esc(p.b)+"</span></td>"+
     "<td class='c-num strong' title='"+esc(fxNote(p))+"'>"+fmtUSD(p._usd)+(p._agg?"<span class='aggtag' title='Facility / portfolio total — not a single programme; excluded from the charts'>facility</span>":"")+"</td>"+
     "<td class='c-num rep' title='"+esc(i18n(p.rb)||"")+"'>"+(p.rc===""||p.rc==null?"—":fmtNum(p.rc))+(p.rc&&p.rb?"<span class='sub'>"+esc((i18n(p.rb)||"").slice(0,24))+"</span>":"")+"</td>"+
     "<td class='c-mid'>"+(p.re?"<span class='pill ok'>yes</span>":"<span class='dash'>–</span>")+"</td>"+
     "<td class='c-mid'><span class='rowmore'>open ›</span></td></tr>";
  }).join("")||"<tr><td colspan='14' class='empty'>No programmes match these filters.</td></tr>";
  const s=total?start+1:0,e=Math.min(start+PS.size,total);
  setText("p-count",nf.format(total)); setText("p-range",nf.format(s)+"–"+nf.format(e)); setText("p-page",PS.page+" / "+pages);
  setText("sb-n",nf.format(total));
  { const tbl=document.getElementById("pb").closest("table"); if(tbl) tbl.classList.toggle("virtual",slice.length>200); }
  renderHead("ph",PCOLS,PS); renderStats(filtered); renderChips(); syncURL();
}
const CHIP_DEFS=[{f:"d",label:"Donor",sel:"f-donor"},{f:"prov",label:"Donor country",sel:"f-provider"},{f:"rg",label:"Region",sel:"f-region"},{f:"co",label:"Country",sel:"f-country"},{f:"sc",label:"Sector",sel:"f-sector"},{f:"sta",label:"Status",sel:"f-status"},{f:"re",label:"Results",sel:"f-res"}];
function chipText(f,v){ return f==="re" ? (v==="Y"?"Reports results":"No results") : v; }
function renderChips(){
  const el=document.getElementById("chips"); if(!el) return;
  const active=CHIP_DEFS.filter(c=>PS[c.f]); const cnt=active.length;
  const fc=document.getElementById("filters-count"); if(fc){ fc.textContent=cnt; fc.hidden=cnt===0; }
  const fb=document.getElementById("filters-btn"); if(fb) fb.classList.toggle("on",cnt>0);
  if(!cnt){ el.innerHTML=""; el.hidden=true; return; }
  el.hidden=false;
  el.innerHTML=active.map(c=>"<button class='chip-x' data-f='"+c.f+"' data-sel='"+c.sel+"'>"+esc(c.label)+": "+esc(chipText(c.f,PS[c.f]))+" <span class='x'>×</span></button>").join("")+"<button class='chip-reset'>Reset all</button>";
}
function buildSortMenu(){ const m=document.getElementById("sort-menu"); if(!m) return;
  m.innerHTML=PCOLS.filter(c=>c.k!=="src").map(c=>{ const on=PS.sort===c.k; return "<button class='sort-item"+(on?" on":"")+"' data-k='"+c.k+"'>"+esc(c.t)+(on?" <span class='sarr'>"+(PS.dir<0?"↓":"↑")+"</span>":"")+"</button>"; }).join("");
}

const OCOLS=[{k:"n",t:"Programme",c:"c-name"},{k:"s",t:"Stream",c:"c-tag"},{k:"sn",t:"Sector",c:"c-tag"},
 {k:"t",t:"Type",c:"c-tag"},{k:"i",t:"Indicator",c:"c-ind"},{k:"bl",t:"Baseline",c:"c-num"},
 {k:"tg",t:"Target",c:"c-num"},{k:"ac",t:"Actual",c:"c-num"},{k:"_ach",t:"Achieved",c:"c-num"}];
/* achClass — see js/lib.js */
function renderOutcomes(){
  const pf=document.getElementById("o-progfilter");
  if(pf){ if(OS.prog){ const pi=PROG_BY_NAME[OS.prog]; const dn=(pi!=null&&PROGRAMS[pi])?pName(PROGRAMS[pi]):OS.prog;
      pf.innerHTML="<span class='pf-lab'>Results for</span> <b>"+esc(dn)+"</b> <button id='o-progclear' class='pf-x' type='button' title='Clear'>Show all ✕</button>";
      pf.hidden=false; } else { pf.hidden=true; pf.innerHTML=""; } }
  let rows=filterOutcomes(); const total=rows.length; rows=sortRows(rows,OS.sort,OS.dir);
  const pages=Math.max(1,Math.ceil(total/OS.size)); if(OS.page>pages) OS.page=pages;
  const start=(OS.page-1)*OS.size, slice=rows.slice(start,start+OS.size);
  document.getElementById("ob").innerHTML=slice.map(o=>{ const m=(o.m==="%")?"%":""; const pi=PROG_BY_NAME[o.n];
    return "<tr"+(pi!=null?" class='crow-click' data-i='"+pi+"' tabindex='0' role='button' aria-label='Open programme details'":"")+"><td class='c-name'>"+esc(i18n(o.n))+(pi!=null?" <span class='rowmore'>open ›</span>":"")+"</td><td class='c-tag'>"+esc(o.s)+"</td><td class='c-tag'>"+esc(o.sn)+"</td>"+
     "<td class='c-tag'>"+esc(o.t)+"</td><td class='c-ind'>"+esc(i18n(o.i))+"</td>"+
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

function groupStats(fn){ const r=PROGRAMS.filter(fn); const b=statsOf(r,"_usd"); return {n:r.length,mb:b.med,b25:b.p25,b75:b.p75,md:median(r.map(x=>x._dur)),
  pr:r.length?r.filter(x=>x.re).length/r.length:null}; }
function btable(title,sub,desc,specs,labelHdr,showTotal,showDot){
  const stats=specs.map(s=>{const g=groupStats(s.fn); return {lab:s.lab,total:s.total,n:g.n,mb:g.mb,b25:g.b25,b75:g.b75,md:g.md,pr:g.pr};});
  const vals=[]; stats.forEach(s=>[s.b25,s.mb,s.b75].forEach(v=>{ if(typeof v==="number"&&v>0) vals.push(v); }));
  const lo=vals.length?Math.min(...vals):1, hi=vals.length?Math.max(...vals):10;
  const la=Math.log(Math.max(1,lo)), lb=Math.log(Math.max(2,hi)), span=(lb-la)||1;
  const pos=v=>(v==null||v<=0)?null:Math.max(0,Math.min(100,100*(Math.log(Math.max(1,v))-la)/span));
  let h="<details class='btable' open><summary class='bt-cap'><span>"+esc(title)+"</span><em>"+esc(sub)+"</em></summary>"+
   (desc?"<p class='bt-desc'>"+esc(desc)+"</p>":"")+
   "<table class='grid'><thead><tr><th>"+esc(labelHdr)+"</th><th class='c-num'>n</th>"+
   "<th>Budget &asymp;USD <span class='bt-h-sub'>median + middle 50%</span></th><th class='c-num'>Median dur (mo)</th><th class='c-num'>% results</th>"+
   (showTotal?"<th class='c-num'>In IATI</th>":"")+"</tr></thead><tbody>";
  stats.forEach(s=>{ const a=pos(s.b25),c=pos(s.b75),m=pos(s.mb);
   const cell=(m==null)?"<span class='muted'>—</span>":
     "<span class='bstrip'>"+((a!=null&&c!=null)?"<span class='bstrip-band' style='left:"+Math.min(a,c)+"%;width:"+Math.max(2,Math.abs(c-a))+"%'></span>":"")+"<span class='bstrip-med' style='left:"+m+"%'></span></span>"+
     "<span class='bv' title='median "+esc(fmtUSD(s.mb))+(s.b25!=null?" · middle 50% "+esc(fmtUSD(s.b25))+"–"+esc(fmtUSD(s.b75)):"")+"'>"+fmtCompact(s.mb)+"</span>";
   const thin=(s.n>0&&s.n<8);
   h+="<tr><td class='c-name b-lab'>"+(showDot?"<i class='cdot' style='background:"+(DONOR_COLORS[s.lab]||"#8A98A3")+"'></i>":"")+esc(s.lab)+"</td>"+
     "<td class='c-num'>"+s.n+(thin?" <span class='bt-thin' title='Fewer than 8 comparable programmes — treat this median as indicative'>⚠</span>":"")+"</td>"+
     "<td class='bcell'><div class='bcell-in'>"+cell+"</div></td>"+
     "<td class='c-num'>"+(s.md==null?"—":s.md)+"</td>"+
     "<td class='c-num'>"+fmtPct(s.pr)+"</td>"+
     (showTotal?"<td class='c-num dim'>"+fmtNum(s.total)+"</td>":"")+"</tr>"; });
  h+="</tbody></table><p class='bt-scale'>Budget axis: log scale "+fmtCompact(lo)+" – "+fmtCompact(hi)+" (this table) · <span class='bt-band-key'></span> middle 50% · <span class='bt-med-key'></span> median</p>";
  return h+"</details>";
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
    "<p class='bnote'>Computed live over the "+nf.format(PROGRAMS.length)+" embedded programmes (a global sample; the recent IATI universe per sector is larger — see the 'In IATI' column and #read_me). Each budget strip shows the middle 50% of programmes (p25–p75) with the median marked, on a shared log scale per table. <b>Cost-per-beneficiary and aggregate achievement are intentionally absent</b> — IATI reach and target/actual fields are non-comparable.</p>";
}

function dl(name,text){ const b=new Blob([text],{type:"text/csv;charset=utf-8"}),u=URL.createObjectURL(b),a=document.createElement("a"); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1500); }
/* cc (CSV cell) — see js/lib.js */
function exportPrograms(){ const rows=sortRows(filterPrograms(),PS.sort,PS.dir);
  const head=["Programme","Description","Country","ISO","Region","Donor type","Providing country","Funder","Reporting org","Reporter type","Stream","DAC code","Sector","Status","Start","End","Duration (mo)","Currency","Amount (orig)","Basis","USD approx","Reach","Reach basis","Reports results","IATI id"];
  const L=[head.map(cc).join(",")];
  rows.forEach(p=>L.push([pName(p),progDesc(p),p.co,p.cc,p.rg,p.d,p.pn,i18n(p.fn||p.r),i18n(p.r),p.rt,p.s,p.sc,p.sn,p.sta,p.st,p.en,p._dur,p.c,p.a,p.b,(p._usd==null?"":Math.round(p._usd)),(p.rc===""?"":p.rc),i18n(p.rb),(p.re?"Y":"N"),p.id].map(cc).join(",")));
  dl("benchmark_programmes_filtered.csv",L.join("\n")); }
function exportOutcomes(){ const rows=sortRows(filterOutcomes(),OS.sort,OS.dir);
  const head=["Programme","Stream","Sector","Type","Indicator","Measure","Baseline","Target","Actual","Achieved (act/tgt)"];
  const L=[head.map(cc).join(",")];
  rows.forEach(o=>L.push([i18n(o.n),o.s,o.sn,o.t,i18n(o.i),o.m,o.bl,o.tg,o.ac,(o._ach==null?"":o._ach.toFixed(3))].map(cc).join(",")));
  dl("benchmark_outcomes_filtered.csv",L.join("\n")); }

function buildFX(){ const wrap=document.getElementById("fx"); if(!wrap) return; const keys=Object.keys(RATES);
  wrap.innerHTML=keys.map(k=>"<label class='fxrow'><span>"+k+"</span><input type='number' step='0.0001' data-cur='"+k+"' value='"+RATES[k]+"'></label>").join("");
  wrap.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",e=>{ const v=parseFloat(e.target.value);
    RATES[e.target.dataset.cur]=isNaN(v)?undefined:v; recomputeUSD(); renderPrograms(); renderBenchmarks(); if(typeof renderPlanRec==="function"){renderPlanRec();renderPlanCalc();} })); }

/* Recent-IATI-universe table (#read_me) — built from TOTALS so it stays in sync
 * as sectors are added (TOTALS is populated by add_sector.py). Stream falls back
 * to the sector's stream as seen in the data; count shows "—" until extracted. */
/* Sidebar/footer counts — kept in sync with the actual data (so adding programmes
 * via add_uae.py / add_sector.py is reflected everywhere, not just the grid). */
function renderMeta(){ const np=PROGRAMS.length, nc=uniq(PROGRAMS,"co").length, no=OUTCOMES.length;
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set("m-nprog",nf.format(np)); set("f-nprog",nf.format(np));
  set("m-ncountry",nc); set("f-ncountry",nc); set("m-ncountry2",nc); set("f-nout",nf.format(no)); }
function renderUniverse(){ const tb=document.getElementById("iati-universe"); if(!tb) return;
  const snStream={}, snCount={};
  PROGRAMS.forEach(p=>{ if(p.sn){ if(!(p.sn in snStream)) snStream[p.sn]=p.s; snCount[p.sn]=(snCount[p.sn]||0)+1; } });
  const crs=(typeof CRS!=="undefined")?CRS:{};
  tb.innerHTML=SECTORS.map(function(s){ const t=TOTALS[s]||{};
    const st=t.stream||snStream[s]||"—";
    const samp=snCount[s]||0, uni=t.recent_total;
    const cov=(uni!=null&&uni>0)?Math.min(100,Math.round(100*samp/uni))+"%":"—";
    const c=crs[s], crsCell=(c&&c.oda!=null)?fmtCompact(c.oda):"—";
    return "<tr><td>"+esc(s)+"</td><td>"+esc(st)+"</td><td class='c-num'>"+nf.format(samp)+"</td>"+
      "<td class='c-num'>"+(uni!=null?nf.format(uni):"—")+"</td><td class='c-num'>"+cov+"</td>"+
      "<td class='c-num'>"+crsCell+"</td></tr>"; }).join(""); }

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
  const desc=PROGRAMS.filter(p=>p.summary||p.desc).length;
  const transl=PROGRAMS.filter(p=>p.name_en).length;
  el.innerHTML=
    dqTile("English description",pc(desc,N),fmtNum(desc)+" of "+fmtNum(N)+" — IATI text summarised; rest use a derived summary")+
    (transl?dqTile("Titles translated to English",pc(transl,N),fmtNum(transl)+" non-English titles translated; English titles unchanged"):"")+
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
const PL={country:"",sector:"Basic health care",donor:"",prov:"",need:null,budget:null,dur:null,target:null,link:false,base:null,source:null};
function setVal(id,v){ const el=document.getElementById(id); if(el) el.value=(v==null?"":v); }
/* num, quantile, statsOf, pctRank — see js/lib.js */
function planCohort(){
  let base=PROGRAMS.filter(p=>p.sn===PL.sector);
  if(PL.donor) base=base.filter(p=>p.d===PL.donor);
  if(PL.prov) base=base.filter(p=>p.pn===PL.prov);
  const tail=(PL.prov?PL.prov+" · ":"")+(PL.donor?PL.donor+" · ":"");
  if(PL.country){ const c=base.filter(p=>p.co===PL.country);
    if(c.length>=8) return {rows:c,scope:tail+"in "+PL.country};
    const rg=COUNTRY_REGION[PL.country]; const r=base.filter(p=>p.rg===rg);
    if(rg&&r.length>=8) return {rows:r,scope:tail+"in "+rg+" (few comparators in "+PL.country+")"};
    return {rows:base,scope:tail+"across developing countries (few comparators in "+PL.country+")"}; }
  return {rows:base,scope:tail+"across all developing countries"};
}
function burnStats(rows){ return statsOf(rows.map(function(r){ return { b:(r._usd!=null&&r._dur)?r._usd/r._dur:null }; }), "b"); }
function cohortAch(rows){
  var v=[]; rows.forEach(function(r){ (OUT_BY_NAME[r.n]||[]).forEach(function(o){ if(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number") v.push(o.ac/o.tg); }); });
  if(!v.length) return null;
  return { n:v.length, med:median(v), hit75:v.filter(function(x){return x>=0.75;}).length/v.length, hit100:v.filter(function(x){return x>=1;}).length/v.length };
}
function concentration(rows){
  if(rows.length<8) return null;
  function topShare(key,onlyWith){ var m={},tot=0; rows.forEach(function(r){ var k=r[key]; if(onlyWith&&!r[onlyWith])return; if(k){m[k]=(m[k]||0)+1;tot++;} }); var e=Object.entries(m).sort(function(a,b){return b[1]-a[1];})[0]; return e&&tot?{v:e[0],share:e[1]/rows.length}:null; }
  var checks=[];                                  // skip dimensions the user explicitly pinned
  if(!PL.donor) checks.push(["donor type","d",null]);
  if(!PL.prov) checks.push(["providing country","pn","pcc"]);
  if(!PL.country) checks.push(["region","rg",null]);
  for(var i=0;i<checks.length;i++){ var t=topShare(checks[i][1],checks[i][2]); if(t&&t.share>=0.6) return { msg:"Narrow benchmark: "+Math.round(t.share*100)+"% of these comparators share the same "+checks[i][0]+" ("+t.v+"). Treat the medians as indicative of that group, not the sector at large." }; }
  return null;
}
function recStat(k,v,s){ return "<div class='rs1'><div class='rs1-k'>"+esc(k)+"</div><div class='rs1-v'>"+v+"</div><div class='rs1-s'>"+esc(s)+"</div></div>"; }
function renderPlanRec(){
  const el=document.getElementById("pl-rec"); if(!el) return;
  if(!PL.sector){ el.innerHTML="<div class='pcard-h'><span class='pstep'>2</span><h2>Typical for comparable programmes</h2></div><p class='pscope'>Choose an intervention / sector above to see what comparable programmes look like.</p>"; return; }
  const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur");
  const resPct=rows.length?rows.filter(r=>r.re).length/rows.length:null;
  const mix={}; rows.forEach(r=>mix[r.d]=(mix[r.d]||0)+1);
  const mixTop=Object.entries(mix).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>esc(k)+" "+Math.round(100*v/rows.length)+"%").join(" · ");
  const provM={}; rows.forEach(r=>{ if(r.pcc) provM[r.pn]=(provM[r.pn]||0)+1; });
  const provTopStr=Object.entries(provM).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>esc(k)+" "+Math.round(100*v/rows.length)+"%").join(" · ");
  const conc=concentration(rows), ach=cohortAch(rows);
  const med=b.med||0; const comp=rows.slice().sort((x,y)=>Math.abs((x._usd||0)-med)-Math.abs((y._usd||0)-med)).slice(0,5);
  let h="<div class='pcard-h'><span class='pstep'>2</span><h2>Typical for comparable programmes</h2></div>";
  h+="<p class='pscope'>What <b>"+rows.length+"</b> comparable programmes look like — "+esc(scope)+". <span class='pbasis'>figures in "+esc(usdBasisLabel())+"</span></p>";
  h+="<p class='pnote-soft'>These are what similar programmes <b>cost</b>, not what yours <b>should</b>. Use them as context, then design to your own scope.</p>";
  if(rows.length<8) h+="<p class='pflag'>Thin sample — treat as indicative, or widen the need.</p>";
  if(conc) h+="<p class='pflag'>"+esc(conc.msg)+"</p>";
  h+="<div class='prec'>"+
    recStat("Median budget",fmtUSD(b.med),"middle 50%: "+fmtUSD(b.p25)+"–"+fmtUSD(b.p75))+
    recStat("Typical duration",(d.med==null?"—":Math.round(d.med)+" mo"),"middle 50%: "+(d.p25==null?"—":Math.round(d.p25))+"–"+(d.p75==null?"—":Math.round(d.p75))+" mo")+
    recStat("Report results",fmtPct(resPct),rows.length+" programmes")+
    recStat("Common funders",mixTop||"—","by share of cohort")+
  "</div>";
  if(provTopStr) h+="<p class='pmix'>Typical providing countries: <b>"+provTopStr+"</b></p>";
  if(ach) h+="<p class='pach'>Reality check: across <b>"+ach.n+"</b> comparable indicators with a target and an actual, the median actual was <b>"+Math.round(ach.med*100)+"%</b> of target; "+Math.round(ach.hit75*100)+"% reached ≥75%. <span class='muted'>IATI target/actual data is noisy — design to expected actuals, not nominal targets.</span></p>";
  h+="<div class='pcomp'><div class='pcomp-h'>Comparable programmes — pick one to start from, or use the cohort median</div>"+comp.map(p=>
    "<div class='pcomp-row' data-i='"+p._i+"'><div class='pcomp-info crow-click' data-i='"+p._i+"'><span class='pcn'>"+esc(pName(p))+"</span><span class='pcm'>"+esc(p.co)+" · "+chip(p.d)+" · "+fmtUSD(p._usd)+" · "+(p._dur==null?"—":p._dur+" mo")+" · <span class='rowmore'>open ›</span></span></div><button class='pl-use-proj' data-i='"+p._i+"' title='Start your plan from this programme'>Use →</button></div>").join("")+"</div>";
  h+="<button id='pl-use' class='btn'>Use cohort median as a starting point →</button>";
  el.innerHTML=h;
  const u=document.getElementById("pl-use"); if(u) u.addEventListener("click",()=>seedPlan(b.med,d.med,"cohort median"));
}
function scrollToPlan(){ const pw=document.getElementById("pl-planwrap"); if(pw&&pw.scrollIntoView) pw.scrollIntoView({behavior:"smooth",block:"start"}); }
function seedPlan(medBudget,medDur,source){
  PL.budget=medBudget?Math.round(medBudget):null; PL.dur=medDur?Math.round(medDur):null;
  if(PL.need) PL.target=PL.need; PL.base={budget:PL.budget,target:PL.target}; PL.source=source||"cohort median";
  setVal("pl-budget",PL.budget); setVal("pl-dur",PL.dur); setVal("pl-target",PL.target);
  renderPlanCalc(); scrollToPlan();
}
function seedFromProject(p){
  if(!p) return;
  PL.budget=p._usd!=null?Math.round(p._usd):null; PL.dur=p._dur!=null?p._dur:null;
  PL.target=(typeof p.rc==="number")?p.rc:(PL.need||null);
  PL.base={budget:PL.budget,target:PL.target}; PL.source="project: "+pName(p);
  setVal("pl-budget",PL.budget); setVal("pl-dur",PL.dur); setVal("pl-target",PL.target);
  renderPlanCalc(); scrollToPlan();
}
function calcStat(k,v,s){ return "<div class='cs1'><div class='cs1-k'>"+esc(k)+"</div><div class='cs1-v'>"+v+"</div><div class='cs1-s'>"+esc(s)+"</div></div>"; }
function stripValueFromFrac(f,lo,hi,log){ f=Math.max(0,Math.min(1,f));
  if(log){ const a=Math.log(Math.max(1,lo)),bb=Math.log(Math.max(2,hi)); return Math.exp(a+f*(bb-a)); }
  return lo+f*(hi-lo); }
function strip(label,st,val,log,fmt,metric){
  if(!st.n) return "";
  fmt=fmt||fmtCompact; const lo=st.min,hi=st.max;
  function pos(v){ if(v==null) return null; if(log){ const a=Math.log(Math.max(1,lo)),bb=Math.log(Math.max(2,hi)),x=Math.log(Math.max(1,v)); return Math.max(0,Math.min(100,100*(x-a)/((bb-a)||1))); } return Math.max(0,Math.min(100,100*(v-lo)/((hi-lo)||1))); }
  const a=pos(st.p25),c=pos(st.p75),m=pos(st.med),mk=pos(val);
  const dragAttr=metric?(" strip-drag' data-metric='"+metric+"' data-lo='"+lo+"' data-hi='"+hi+"' data-log='"+(log?1:0)+"'"):"'";
  return "<div class='strip'><div class='strip-l'>"+esc(label)+(metric?" <span class='strip-drag-hint'>drag</span>":"")+"</div>"+
    "<div class='strip-bar"+dragAttr+">"+
      "<span class='strip-band' style='left:"+a+"%;width:"+Math.max(1,c-a)+"%'></span>"+
      "<span class='strip-med' style='left:"+m+"%'></span>"+
      (mk==null?"":"<span class='strip-mk' style='left:"+mk+"%'></span>")+
    "</div>"+
    "<div class='strip-ax'><span>"+fmt(lo)+"</span><span class='strip-axm'>median "+fmt(st.med)+"</span><span>"+fmt(hi)+"</span></div>"+
  "</div>";
}
function renderPlanCalc(){
  const el=document.getElementById("pl-calc"); if(!el) return;
  const {rows}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur"),bn=burnStats(rows);
  const budget=PL.budget,dur=PL.dur,target=PL.target;
  const burn=(budget&&dur)?budget/dur:null, cpp=(budget&&target)?budget/target:null;
  const bp=pctRank(b.arr,budget), dp=pctRank(d.arr,dur), burnp=(burn!=null)?pctRank(bn.arr,burn):null;
  const durFmt=v=>Math.round(v)+" mo", burnFmt=v=>fmtUSD(v)+"/mo";
  let h=PL.source?"<p class='pl-srcline'>Seeded from <b>"+esc(PL.source)+"</b> — a starting point; adjust below.</p>":"";
  h+="<div class='pcalc'>"+
    calcStat("Monthly burn",burn==null?"—":fmtUSD(burn)+"/mo","budget ÷ duration")+
    calcStat("Cost / person",cpp==null?"—":"$"+nf.format(Math.round(cpp)),target?"your budget ÷ your target":"set a target")+
    calcStat("Budget vs peers",bp==null?"—":ord(Math.round(bp*100))+" pct","of "+b.n+" comparables")+
    calcStat("Burn vs peers",burnp==null?"—":ord(Math.round(burnp*100))+" pct","of "+bn.n+" comparables")+
  "</div>";
  h+="<div class='pstrip-wrap'>"+strip("Budget",b,budget,true,fmtUSD,"budget")+strip("Duration",d,dur,false,durFmt,"dur")+strip("Monthly burn",bn,burn,true,burnFmt)+"</div>";
  const reads=[];
  if(budget!=null&&b.n) reads.push("Your budget of <b>"+fmtUSD(budget)+"</b> sits at the <b>"+ord(Math.round(bp*100))+" percentile</b> of "+b.n+" comparable programmes (their median is "+fmtUSD(b.med)+").");
  if(dur!=null&&d.n) reads.push("Your <b>"+dur+"-month</b> duration is around the <b>"+ord(Math.round(dp*100))+" percentile</b> (middle 50% run "+Math.round(d.p25)+"–"+Math.round(d.p75)+" months).");
  if(burn!=null&&bn.n) reads.push("Your spend rate of <b>"+fmtUSD(burn)+"/mo</b> is at the <b>"+ord(Math.round(burnp*100))+" percentile</b> of comparable programmes.");
  if(reads.length) h+="<div class='preads'>"+reads.map(r=>"<p>"+r+"</p>").join("")+"</div>";
  const f=[];
  if(budget!=null&&b.n>=8){ if(budget<b.p25) f.push("Budget is below the middle 50% ("+fmtUSD(b.p25)+"–"+fmtUSD(b.p75)+") of comparable programmes — trim scope/duration, or check you're not under-resourcing."); else if(budget>b.p75) f.push("Budget is above the middle 50% ("+fmtUSD(b.p25)+"–"+fmtUSD(b.p75)+") — make sure scope justifies it."); }
  if(dur!=null&&d.n>=8){ if(dur<d.p25) f.push("Duration is shorter than most comparable programmes ("+Math.round(d.p25)+"–"+Math.round(d.p75)+" mo) — outcomes may need more time to land."); else if(dur>d.p75) f.push("Duration is longer than most comparable programmes ("+Math.round(d.p25)+"–"+Math.round(d.p75)+" mo) — long programmes can drift; check the case for the extra time."); }
  if(burn!=null&&bn.n>=8){ if(burn>bn.p75) f.push("Monthly burn is high vs peers ("+fmtUSD(bn.p25)+"–"+fmtUSD(bn.p75)+"/mo) — an ambitious delivery pace; check absorption capacity."); else if(burn<bn.p25) f.push("Monthly burn is low vs peers ("+fmtUSD(bn.p25)+"–"+fmtUSD(bn.p75)+"/mo) — a long, thinly-resourced programme."); }
  if(target!=null){ const ach=cohortAch(rows); if(ach) f.push("Comparable programmes reported a median actual of "+Math.round(ach.med*100)+"% of target ("+ach.n+" indicators); only "+Math.round(ach.hit100*100)+"% met target in full. Plan to expected actuals, not the nominal target."); }
  if(cpp!=null) f.push("Cost per person is your own figure (budget ÷ target). Comparable programmes rarely report reach, so there's no external benchmark — sense-check against sector unit-cost studies.");
  if(f.length) h+="<ul class='pflags'>"+f.map(x=>"<li>"+esc(x)+"</li>").join("")+"</ul>";
  h+="<p class='pbasis2'>Budget &amp; burn figures in "+esc(usdBasisLabel())+" — switch nominal ↔ real in the sidebar.</p>";
  el.innerHTML=h; syncURL();
}
function exportPlan(){ const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur"),bn=burnStats(rows);
  const ach=cohortAch(rows), conc=concentration(rows);
  const L=[["field","value"].join(",")]; const add=(k,v)=>L.push([cc(k),cc(v)].join(","));
  add("USD basis",usdBasisLabel());
  add("Country",PL.country||"Any"); add("Intervention / sector",PL.sector); add("Donor type",PL.donor||"Any"); add("Donor country",PL.prov||"Any");
  add("Cohort",scope); add("Comparable programmes (n)",rows.length);
  if(conc) add("Concentration warning",conc.msg);
  add("Typical median budget USD",b.med?Math.round(b.med):""); add("Typical p25 USD",b.p25?Math.round(b.p25):""); add("Typical p75 USD",b.p75?Math.round(b.p75):"");
  add("Typical median duration (mo)",d.med?Math.round(d.med):"");
  add("Typical median monthly burn USD",bn.med?Math.round(bn.med):"");
  if(ach){ add("Comparators median actual % of target",Math.round(ach.med*100)); add("Comparators % meeting target",Math.round(ach.hit100*100)); add("Comparator indicators (n)",ach.n); }
  add("PLAN budget USD",PL.budget||""); add("PLAN duration (mo)",PL.dur||""); add("PLAN target reach",PL.target||"");
  add("PLAN monthly burn USD",(PL.budget&&PL.dur)?Math.round(PL.budget/PL.dur):""); add("PLAN cost per person USD",(PL.budget&&PL.target)?Math.round(PL.budget/PL.target):"");
  if(PL.budget!=null) add("PLAN budget percentile",Math.round(pctRank(b.arr,PL.budget)*100));
  dl("programme_plan.csv",L.join("\n")); }

/* ---------- plan basket ---------- */
let BASKET=[];
function loadBasket(){ try{ BASKET=JSON.parse(localStorage.getItem("bdb_basket")||"[]")||[]; }catch(e){ BASKET=[]; } }
function saveBasket(){ try{ localStorage.setItem("bdb_basket",JSON.stringify(BASKET)); }catch(e){} }
function snapshotPlan(){
  const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd");
  const burn=(PL.budget&&PL.dur)?PL.budget/PL.dur:null, cpp=(PL.budget&&PL.target)?PL.budget/PL.target:null;
  return { sector:PL.sector||"", country:PL.country||"Any", donor:PL.donor||"Any", prov:PL.prov||"Any",
    scope:scope, n:rows.length, source:PL.source||"cohort median", basis:usdBasisLabel(),
    budget:PL.budget==null?null:Math.round(PL.budget), dur:PL.dur==null?null:PL.dur, target:PL.target==null?null:PL.target,
    burn:burn==null?null:Math.round(burn), cpp:cpp==null?null:Math.round(cpp),
    bpct:(PL.budget!=null&&b.arr.length)?Math.round(pctRank(b.arr,PL.budget)*100):null };
}
function addToBasket(){ BASKET.push(snapshotPlan()); saveBasket(); renderBasket();
  const el=document.getElementById("pl-basket"); if(el&&el.scrollIntoView) el.scrollIntoView({behavior:"smooth",block:"nearest"}); }
function renderBasket(){
  const el=document.getElementById("pl-basket"); if(!el) return;
  if(!BASKET.length){ el.innerHTML="<div class='pcard-h'><span class='pstep'>4</span><h2>Saved plans</h2></div><p class='pscope'>Build a plan above and <b>Add to basket</b> to collect several, then export them together.</p>"; return; }
  let h="<div class='pcard-h'><span class='pstep'>4</span><h2>Saved plans <span class='bk-n'>"+BASKET.length+"</span></h2><div class='tb-actions'><button id='bk-clear' class='btn ghost'>Clear</button><button id='bk-export' class='btn'>⤓ Export all ("+BASKET.length+")</button></div></div>";
  h+="<div class='bk-list'>"+BASKET.map((p,i)=>"<div class='bk-row'><div class='bk-main'><span class='bk-title'>"+esc(p.sector)+(p.country&&p.country!=="Any"?" · "+esc(p.country):"")+(p.prov&&p.prov!=="Any"?" · "+esc(p.prov):"")+"</span><span class='bk-sub'>"+(p.budget!=null?fmtUSD(p.budget):"—")+" · "+(p.dur!=null?p.dur+" mo":"—")+(p.target!=null?" · "+fmtNum(p.target)+" reach":"")+" · seeded from "+esc(p.source)+"</span></div><button class='bk-x' data-i='"+i+"' aria-label='Remove plan'>×</button></div>").join("")+"</div>";
  el.innerHTML=h;
}
function exportBasket(){
  if(!BASKET.length) return;
  const cols=[["Sector","sector"],["Country","country"],["Donor type","donor"],["Donor country","prov"],["Cohort","scope"],["Comparables (n)","n"],["Seeded from","source"],["USD basis","basis"],["Budget USD","budget"],["Duration (mo)","dur"],["Target reach","target"],["Monthly burn USD","burn"],["Cost per person USD","cpp"],["Budget percentile","bpct"]];
  const L=[cols.map(c=>cc(c[0])).join(",")];
  BASKET.forEach(p=>L.push(cols.map(c=>cc(p[c[1]]==null?"":p[c[1]])).join(",")));
  dl("programme_plans.csv",L.join("\n"));
}
function briefRow(k,v){ return "<tr><th>"+esc(k)+"</th><td>"+v+"</td></tr>"; }
function briefCmp(k,med,iqr,you){ return "<tr><th>"+esc(k)+"</th><td>"+med+"</td><td>"+iqr+"</td><td>"+you+"</td></tr>"; }
function buildPlanBrief(){
  const el=document.getElementById("pl-brief"); if(!el) return;
  const {rows,scope}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur"),bn=burnStats(rows);
  const budget=PL.budget,dur=PL.dur,target=PL.target;
  const burn=(budget&&dur)?budget/dur:null, cpp=(budget&&target)?budget/target:null;
  const bp=pctRank(b.arr,budget), dp=pctRank(d.arr,dur), burnp=(burn!=null)?pctRank(bn.arr,burn):null;
  const ach=cohortAch(rows), conc=concentration(rows);
  let dt=""; try{ dt=new Date().toISOString().slice(0,10); }catch(e){ dt=(typeof META!=="undefined"?META.date:""); }
  let h="<div class='brief'>";
  h+="<header class='brief-h'><h1>Programme design brief</h1><div class='brief-meta'>"+esc(PL.sector)+(PL.country?" · "+esc(PL.country):"")+(PL.prov?" · funder "+esc(PL.prov):"")+(PL.donor?" · "+esc(PL.donor):"")+" · "+esc(dt)+"</div></header>";
  h+="<h2>Your plan</h2><table class='brief-t'><tbody>"+
    briefRow("Budget", budget!=null?fmtUSD(budget)+" <span class='brief-dim'>("+esc(usdBasisLabel())+")</span>":"—")+
    briefRow("Duration", dur!=null?dur+" months":"—")+
    briefRow("Target reach", target!=null?fmtNum(target)+" people":"—")+
    briefRow("Monthly burn", burn!=null?fmtUSD(burn)+"/mo":"—")+
    briefRow("Cost / person", cpp!=null?"$"+nf.format(Math.round(cpp)):"—")+
  "</tbody></table>";
  h+="<h2>How it compares</h2><p>Based on <b>"+rows.length+"</b> comparable programmes — "+esc(scope)+". These are what similar programmes <b>cost</b>, not what yours should — context, not a target.</p>";
  h+="<table class='brief-t brief-cmp'><thead><tr><th></th><th>Typical (median)</th><th>Middle 50%</th><th>Your plan</th></tr></thead><tbody>"+
    briefCmp("Budget", fmtUSD(b.med), fmtUSD(b.p25)+"–"+fmtUSD(b.p75), budget!=null?fmtUSD(budget)+" · "+ord(Math.round(bp*100))+" pct":"—")+
    briefCmp("Duration", d.med==null?"—":Math.round(d.med)+" mo", (d.p25==null?"—":Math.round(d.p25)+"–"+Math.round(d.p75)+" mo"), dur!=null?dur+" mo · "+ord(Math.round(dp*100))+" pct":"—")+
    briefCmp("Monthly burn", fmtUSD(bn.med)+"/mo", fmtUSD(bn.p25)+"–"+fmtUSD(bn.p75)+"/mo", burn!=null?fmtUSD(burn)+"/mo · "+ord(Math.round(burnp*100))+" pct":"—")+
  "</tbody></table>";
  if(conc) h+="<p class='brief-warn'>⚠ "+esc(conc.msg)+"</p>";
  if(ach) h+="<p>Reality check: comparable programmes reported a median actual of <b>"+Math.round(ach.med*100)+"%</b> of target ("+ach.n+" indicators); "+Math.round(ach.hit100*100)+"% met target in full. Design to expected actuals.</p>";
  h+="<footer class='brief-f'>Benchmark DB · IATI Standard via the IATI Datastore · medians over an embedded sample in "+esc(usdBasisLabel())+" · indicative, not a census.</footer></div>";
  el.innerHTML=h;
}
function wirePlan(){
  fillSelect("pl-country",ALL_COUNTRIES,"Any country");
  fillSelect("pl-sector",uniq(PROGRAMS,"sn"),"Select sector");
  fillSelect("pl-donor",DONORS.filter(d=>PROGRAMS.some(p=>p.d===d)),"Any donor type");
  fillSelect("pl-prov",uniq(PROGRAMS.filter(p=>p.pcc),"pn"),"Any donor country");
  setVal("pl-sector",PL.sector);
  const on=(id,ev,fn)=>{const el=document.getElementById(id); if(el) el.addEventListener(ev,fn);};
  on("pl-country","change",e=>{PL.country=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-sector","change",e=>{PL.sector=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-donor","change",e=>{PL.donor=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-prov","change",e=>{PL.prov=e.target.value;renderPlanRec();renderPlanCalc();});
  on("pl-print","click",()=>{ buildPlanBrief(); setTimeout(()=>{ try{ window.print(); }catch(e){} },30); });
  on("pl-need","input",e=>{PL.need=num(e.target.value);});
  on("pl-budget","input",e=>{const nb=num(e.target.value); if(PL.link&&PL.base&&PL.base.budget&&PL.base.target&&nb){PL.target=Math.round(PL.base.target*nb/PL.base.budget); setVal("pl-target",PL.target);} PL.budget=nb; renderPlanCalc();});
  on("pl-dur","input",e=>{PL.dur=num(e.target.value);renderPlanCalc();});
  on("pl-target","input",e=>{PL.target=num(e.target.value); PL.base={budget:PL.budget,target:PL.target}; renderPlanCalc();});
  on("pl-link","change",e=>{PL.link=e.target.checked; PL.base={budget:PL.budget,target:PL.target};});
  let _drag=null;
  const stripMove=ev=>{ if(!_drag) return; const r=_drag.bar.getBoundingClientRect(); const f=(ev.clientX-r.left)/(r.width||1);
    let v=Math.max(0,Math.round(stripValueFromFrac(f,_drag.lo,_drag.hi,_drag.log)));
    if(_drag.metric==="budget"){ if(PL.link&&PL.base&&PL.base.budget&&PL.base.target&&v){PL.target=Math.round(PL.base.target*v/PL.base.budget);setVal("pl-target",PL.target);} PL.budget=v; setVal("pl-budget",v); }
    else { PL.dur=v; setVal("pl-dur",v); }
    let mk=_drag.bar.querySelector(".strip-mk"); if(!mk){ mk=document.createElement("span"); mk.className="strip-mk"; _drag.bar.appendChild(mk); }
    mk.style.left=(Math.max(0,Math.min(1,f))*100)+"%"; };
  const stripUp=()=>{ if(_drag){ _drag=null; document.removeEventListener("pointermove",stripMove); document.removeEventListener("pointerup",stripUp); renderPlanCalc(); } };
  on("pl-calc","pointerdown",ev=>{ const bar=ev.target.closest&&ev.target.closest(".strip-bar.strip-drag"); if(!bar) return; ev.preventDefault();
    _drag={bar:bar,metric:bar.getAttribute("data-metric"),lo:+bar.getAttribute("data-lo"),hi:+bar.getAttribute("data-hi"),log:bar.getAttribute("data-log")==="1"};
    document.addEventListener("pointermove",stripMove); document.addEventListener("pointerup",stripUp); stripMove(ev); });
  on("pl-reset","click",()=>{const {rows}=planCohort(); const b=statsOf(rows,"_usd"),d=statsOf(rows,"_dur"); seedPlan(b.med,d.med,"cohort median");});
  on("pl-add","click",addToBasket);
  const _bk=document.getElementById("pl-basket"); if(_bk) _bk.addEventListener("click",e=>{
    if(e.target.closest("#bk-export")){ exportBasket(); return; }
    if(e.target.closest("#bk-clear")){ BASKET=[]; saveBasket(); renderBasket(); return; }
    const x=e.target.closest(".bk-x"); if(x){ BASKET.splice(+x.getAttribute("data-i"),1); saveBasket(); renderBasket(); }
  });
  loadBasket(); renderBasket();
  renderPlanRec(); renderPlanCalc();
}
function initPlanFromURL(){
  if(typeof location==="undefined") return;
  const qp=new URLSearchParams(location.search); if(![...qp.keys()].length) return;
  const c=qp.get("country"); if(c){ const bn=PROGRAMS.find(p=>(p.co||"").toLowerCase()===c.toLowerCase()); const bi=PROGRAMS.find(p=>(p.cc||"").toLowerCase()===c.toLowerCase()); PL.country=bn?bn.co:(bi?bi.co:""); }
  const sc=qp.get("sector"); if(sc){ const bn=SECTORS.find(s=>s.toLowerCase()===sc.toLowerCase()); const bc=PROGRAMS.find(p=>p.sc===sc); PL.sector=bn||(bc?bc.sn:PL.sector); }
  const dn=qp.get("donor"); if(dn){ const m=DONORS.find(x=>x.toLowerCase()===dn.toLowerCase()); if(m) PL.donor=m; }
  const pr=qp.get("provider"); if(pr){ const m=uniq(PROGRAMS.filter(p=>p.pcc),"pn").find(x=>x.toLowerCase()===pr.toLowerCase()); if(m) PL.prov=m; }
  const need=num(qp.get("target")||qp.get("people")); if(need) PL.need=need;
  setVal("pl-country",PL.country); setVal("pl-sector",PL.sector); setVal("pl-donor",PL.donor); setVal("pl-prov",PL.prov); if(PL.need) setVal("pl-need",PL.need);
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
  for(const o of os){ let t=(i18n(o.i)||"").replace(/\s+/g," ").trim(); if(!t) continue; if(t.length>90) t=t.slice(0,88)+"…";
    const k=t.toLowerCase(); if(seen.has(k)) continue; seen.add(k); items.push(t); if(items.length>=3) break; }
  return items;
}
function progDesc(p){
  if(p.summary) return p.summary;                            // LLM one-line core-activities summary (enrich_llm.py)
  if(p.desc) return p.desc;                                   // real IATI description (enriched)
  let s=SECTOR_DESC[p.sn]||((p.sn||"Development")+" programme.");
  const outs=descOutputs(p);
  if(outs.length) s+=" Reported outputs include "+outs.join("; ")+".";
  else if(p.rb) s+=" Activity tracked: "+i18n(p.rb)+".";
  return s;
}
function progDescIsReal(p){ return !!(p.summary||p.desc); }
function progDescFull(p){ return p.desc||null; }             // full IATI text, if any (behind "Show more")
function eatt(s){ return esc(s); }
function cf(k,v){ return "<div class='cfield'><span class='ck'>"+k+"</span><span class='cv'>"+v+"</span></div>"; }
function cfBig(k,v){ return "<div class='cfield'><span class='ck'>"+k+"</span><span class='cv big'>"+v+"</span></div>"; }
function fnum(v){ return (v==null||v==="")?"—":fmtNum(v); }
let _cardLastFocus=null;
function closeCard(){ const m=document.getElementById("cardModal"); if(!m||m.hidden) return; m.hidden=true;
  if(_cardLastFocus&&_cardLastFocus.focus){ try{ _cardLastFocus.focus(); }catch(e){} } _cardLastFocus=null; }
function trapCardTab(e){ const m=document.getElementById("cardModal"); if(!m||m.hidden||e.key!=="Tab") return;
  const f=[...m.querySelectorAll('a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!f.length) return; const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); } }
function fallbackCopy(txt,done){ try{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); done&&done(); }catch(e){} }
function copyText(txt,btn){ const done=()=>{ if(btn){ const o=btn.textContent; btn.textContent="Copied ✓"; setTimeout(()=>{btn.textContent=o;},1200);} };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done)); } else fallbackCopy(txt,done); }catch(e){ fallbackCopy(txt,done); } }
function openCard(p){ if(!p) return;
  const dpAct="https://d-portal.org/ctrack.html#view=act&aid="+encodeURIComponent(p.id);
  const dpRaw="https://d-portal.org/q.html?aid="+encodeURIComponent(p.id);
  const os=OUTCOMES.filter(o=>o.n===p.n);
  let h="<div class='cardh'><h2>"+esc(pName(p))+"</h2><div class='sub'>"+statusPill(p.sta)+chip(p.d)+"<span>"+esc(p.sn)+"</span><span class='muted'>· "+esc(p.s)+"</span>"+((p.d==="Bilateral"&&p.pcc)?"<span class='flow'>"+esc(p.pcc)+" → "+esc(p.cc)+"</span>":"")+"</div></div>";
  const _ad=progDesc(p), _full=progDescFull(p);
  const _hasFull=!!(_full&&_full!==_ad&&_full.length>_ad.length+10);   // a longer IATI description sits behind the summary
  const _along=!_hasFull&&_ad.length>200;
  h+="<div class='cardsec cabout-sec'><p class='cabout"+(_along?" clamp":"")+"'>"+esc(_ad)+"</p>"+
     (_hasFull?"<p class='cabout-full' hidden>"+esc(_full)+"</p>":"")+
     ((_hasFull||_along)?"<button class='cmore' type='button'>Show more</button>":"")+
     "<span class='tagmini"+(progDescIsReal(p)?" rep":"")+"'>"+(progDescIsReal(p)?"reported — IATI activity description":"derived — inferred from sector &amp; reported indicators")+"</span></div>";
  h+="<div class='cardsec'><div class='cardgrid'>"+cf("Receiving country",esc(p.co)+(p.multi?" <span class='muted'>(+ others)</span>":""))+((p.d==="Bilateral")?cf("Providing country",(p.pn?esc(p.pn)+" <span class='muted'>("+esc(p.pcc)+", inferred)</span>":"—")):"")+cf("Funder",esc(i18n(p.fn||p.r)||"—"))+cf("Region",esc(p.rg))+cf("Reporting org",esc(i18n(p.r))+" <span class='muted'>("+esc(p.rt||"—")+")</span>")+cf("Sector code",esc(p.sc))+"</div></div>";
  h+="<div class='cardsec'><h3>Finance &amp; timeline</h3><div class='cardgrid'>"+cfBig("Budget",esc(p.c)+" "+nf.format(Math.round(p.a)))+cfBig(BASIS==="real"?"≈ real 2024 USD":"≈ nominal USD",fmtUSD(p._usd))+cf("FX applied",esc(fxNote(p)))+cf("Reported as",esc(p.b||"—"))+cf("Start",esc(p.st||"—"))+cf("End",esc(p.en||"—"))+cf("Duration",(p._dur==null?"—":p._dur+" months"))+"</div>"+(p._agg?"<p class='cnote'>This budget exceeds $2bn — it appears to be a <b>facility or portfolio total</b> (e.g. a multi-donor trust fund), not a single programme. Shown for reference, but excluded from the charts so it doesn't distort the scale.</p>":"")+"</div>";
  let rr=cf("Reach (reported)",(p.rc===""||p.rc==null)?"—":fmtNum(p.rc));
  if(p.rc&&p.rb) rr+=cf("Reach indicator",esc(i18n(p.rb)));
  let resVal;
  if(os.length) resVal="Yes — <button class='olink o-open' type='button' data-name=\""+eatt(p.n)+"\">view "+os.length+" indicator"+(os.length>1?"s":"")+" →</button>";
  else if(p.re) resVal="Yes <span class='muted'>(no indicator-level rows in this sample)</span>";
  else resVal="No";
  rr+=cf("Reports results?",resVal);
  h+="<div class='cardsec'><h3>Reach &amp; results</h3><div class='cardgrid'>"+rr+"</div>";
  if(os.length){ h+="<table class='cotable'><thead><tr><th>Indicator</th><th>Base</th><th>Target</th><th>Actual</th></tr></thead><tbody>"+os.slice(0,12).map(o=>"<tr><td class='ind'>"+esc(i18n(o.i)||o.t||"—")+"</td><td>"+fnum(o.bl)+"</td><td>"+fnum(o.tg)+"</td><td>"+fnum(o.ac)+"</td></tr>").join("")+"</tbody></table>";
    h+="<button class='cbtn o-open' data-name=\""+eatt(p.n)+"\">Open all "+os.length+" in Reported outcomes →</button>"; }
  h+="</div>";
  h+="<div class='cardsec'><h3>Source</h3><div class='csrc'>"+
     "<div class='csrc-row'><a class='cbtn prim' href=\""+eatt(dpAct)+"\" target='_blank' rel='noopener'>Open in d-portal ↗</a>"+
     "<a class='cbtn' href=\""+eatt(dpRaw)+"\" target='_blank' rel='noopener'>Raw IATI data ↗</a>"+
     "<button class='cbtn' data-copy=\""+eatt(dpAct)+"\">Copy link</button></div>"+
     "<div class='csrc-row'><span class='ck'>IATI ID</span> <code>"+esc(p.id)+"</code> <button class='cbtn' data-copy=\""+eatt(p.id)+"\">Copy ID</button></div>"+
     "<div class='cnote'>If a link doesn't open in this preview, copy it into your browser. Every figure here is REPORTED or DERIVED from this activity's own IATI record.</div>"+
     "</div></div>";
  document.getElementById("cardBody").innerHTML=h;
  const m=document.getElementById("cardModal");
  _cardLastFocus=document.activeElement;            // restore focus here on close
  m.hidden=false;
  const _x=m.querySelector(".cmodal-x"); if(_x) try{ _x.focus(); }catch(e){}
  m.querySelectorAll("[data-copy]").forEach(btn=>btn.addEventListener("click",()=>copyText(btn.getAttribute("data-copy"),btn)));
  m.querySelectorAll(".o-open").forEach(b=>b.addEventListener("click",()=>openOutcomesFor(b.getAttribute("data-name"))));
  const _more=m.querySelector(".cmore"); if(_more) _more.addEventListener("click",()=>{ const pEl=m.querySelector(".cabout"); const full=m.querySelector(".cabout-full");
    if(full){ const show=full.hasAttribute("hidden"); if(show){ full.removeAttribute("hidden"); pEl.setAttribute("hidden",""); _more.textContent="Show less"; } else { full.setAttribute("hidden",""); pEl.removeAttribute("hidden"); _more.textContent="Show more"; } }
    else { const ex=pEl.classList.toggle("expanded"); pEl.classList.toggle("clamp",!ex); _more.textContent=ex?"Show less":"Show more"; } });
}

function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function openOutcomesFor(name){
  Object.assign(OS,{prog:name,q:"",s:"",sn:"",t:"",page:1});   // isolate this programme's indicators
  closeCard();
  showView("outcomes");           // toggles view + syncURL
  reflectControls(); renderOutcomes();
}
function showView(name){
  CURRENT_VIEW=name;
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("show",v.id==="view-"+name));
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  if(name==="charts") renderCharts();
  syncURL();
}
function setTheme(t){ document.documentElement.setAttribute("data-theme",t);
  document.querySelectorAll(".theme-btn").forEach(b=>b.classList.toggle("on",b.dataset.theme===t)); }
function setBasis(x){ BASIS=x; document.querySelectorAll(".basis-btn").forEach(b=>b.classList.toggle("on",b.dataset.basis===x)); recomputeUSD(); renderPrograms(); renderBenchmarks(); renderCharts(); renderCountry(); if(typeof renderPlanRec==="function"){renderPlanRec();renderPlanCalc();} }

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
    if(OS.prog)qp.set("prog",OS.prog);
    if(OS.sort!=="_ach")qp.set("sort",OS.sort); if(OS.dir!==-1)qp.set("dir",OS.dir);
    if(OS.page>1)qp.set("page",OS.page); if(OS.size!==50)qp.set("size",OS.size>=1e9?"all":OS.size);
  } else if(CURRENT_VIEW==="countries"){
    if(CY.country)qp.set("country",CY.country);
  } else if(CURRENT_VIEW==="charts"){
    if(CS.sc)qp.set("sector",CS.sc); if(CS.rg)qp.set("region",CS.rg); if(CS.d)qp.set("donor",CS.d);
  } else if(CURRENT_VIEW==="plan"){
    if(PL.country)qp.set("country",PL.country); if(PL.sector)qp.set("sector",PL.sector); if(PL.donor)qp.set("donor",PL.donor); if(PL.prov)qp.set("provider",PL.prov);
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
    OS.q=qp.get("q")||""; OS.s=qp.get("stream")||""; OS.sn=qp.get("sector")||""; OS.t=qp.get("type")||""; OS.prog=qp.get("prog")||"";
    if(qp.get("sort"))OS.sort=qp.get("sort"); if(qp.get("dir"))OS.dir=+qp.get("dir");
    if(qp.get("page"))OS.page=+qp.get("page"); const z=qp.get("size"); if(z)OS.size=(z==="all"?1e9:+z);
  } else if(view==="countries"){
    CY.country=qp.get("country")||"";
  } else if(view==="charts"){
    CS.sc=qp.get("sector")||""; CS.rg=qp.get("region")||""; CS.d=qp.get("donor")||"";
  } else if(!view||view==="programmes"){
    PS.q=qp.get("q")||""; PS.d=qp.get("donor")||""; PS.rg=qp.get("region")||""; PS.co=qp.get("country")||"";
    PS.sc=qp.get("sector")||""; PS.sta=qp.get("status")||""; PS.re=qp.get("results")||""; PS.prov=qp.get("provider")||"";
    if(qp.get("sort"))PS.sort=qp.get("sort"); if(qp.get("dir"))PS.dir=+qp.get("dir");
    if(qp.get("page"))PS.page=+qp.get("page"); const z=qp.get("size"); if(z)PS.size=(z==="all"?1e9:+z);
  }
  reflectControls();
  renderPrograms(); renderOutcomes(); renderCountry();
  showView((view&&document.getElementById("view-"+view))?view:"programmes");
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
function chartCard(t,s,svg,note){ return "<div class='chartcard'><h3>"+esc(t)+"</h3><p class='csub'>"+esc(s)+"</p>"+svg+(note?"<p class='cnote-chart'>"+esc(note)+"</p>":"")+"</div>"; }
const CS={sc:"",rg:"",d:""};
function chartRows(){ return PROGRAMS.filter(p=> !p._agg && (!CS.sc||p.sn===CS.sc) && (!CS.rg||p.rg===CS.rg) && (!CS.d||p.d===CS.d)); }
function renderCharts(){
  const el=document.getElementById("charts"); if(!el) return;
  const rows=chartRows(), usdLab=BASIS==="real"?"real 2024 USD":"nominal USD";
  const filtered=!!(CS.sc||CS.rg||CS.d);
  const nagg=PROGRAMS.filter(p=>p._agg).length;
  setText("ch-count",fmtNum(rows.length)+(filtered?" of "+fmtNum(PROGRAMS.length):"")+" programmes"+(nagg?" · "+nagg+" facility total"+(nagg>1?"s":"")+" excluded":""));
  const edges=[1e4,1e5,1e6,1e7,1e8,1e9],blab=["<10k","10k–100k","100k–1M","1M–10M","10M–100M","100M–1B",">1B"],bc=new Array(7).fill(0);
  rows.forEach(p=>{ if(p._usd==null)return; let bi=0; while(bi<edges.length&&p._usd>=edges[bi])bi++; bc[bi]++; });
  const c1=svgBars(blab.map((l,i)=>({l,v:bc[i]})),{});
  const yc={}; rows.forEach(p=>{ if(p.year&&p.year>=2012) yc[p.year]=(yc[p.year]||0)+1; });
  const years=Object.keys(yc).map(Number).sort((a,b)=>a-b);
  const c2=svgBars(years.map(y=>({l:String(y),v:yc[y]})),{rot:years.length>10});
  const pts=rows.filter(p=>p._usd!=null&&p._dur!=null&&p._dur>0).map(p=>({x:p._usd,y:p._dur,t:pName(p)+" · "+fmtCompact(p._usd)+" · "+p._dur+"mo"}));
  const c3=svgScatter(pts,{});
  // 4th chart: by region normally, but by sector when a single region is selected
  let c4,c4t,c4s;
  if(CS.rg){ const bs=SECTORS.map(s=>{const r=rows.filter(p=>p.sn===s);return {l:s,v:r.length,s:"med "+fmtCompact(median(r.map(x=>x._usd))),disp:fmtNum(r.length)};}).filter(d=>d.v).sort((a,b)=>b.v-a.v);
    c4=svgHBars(bs,{}); c4t="By sector"; c4s="Within "+CS.rg+"; median budget on hover"; }
  else { const rc=REGIONS.map(rg=>{const r=rows.filter(p=>p.rg===rg);return {l:rg,v:r.length,s:"med "+fmtCompact(median(r.map(x=>x._usd))),disp:fmtNum(r.length)};}).filter(d=>d.v).sort((a,b)=>b.v-a.v);
    c4=svgHBars(rc,{}); c4t="By region"; c4s="Programme count; median budget on hover"; }
  const npriced=rows.filter(p=>p._usd!=null).length, nexcl=rows.length-npriced;
  el.innerHTML=
    chartCard("Budget distribution","Programmes by ≈USD band ("+usdLab+") — "+fmtNum(npriced)+" priced",c1,
      "Shows: how programme budgets are spread across orders of magnitude. Not: total spend — bars are counts of programmes, and "+fmtNum(nexcl)+" with no currency are excluded.")+
    chartCard("Programmes by start year","Count by reported start year",c2,
      "Shows: when sampled programmes started (≥2012). Not: funding over time, and recent years are partial — this is an IATI sample, not a census.")+
    chartCard("Budget vs duration","Each point a programme — log budget ("+usdLab+") × months",c3,
      "Shows: whether bigger budgets run longer (each dot a programme). Not: cost-effectiveness — no beneficiary or outcome dimension is implied.")+
    chartCard(c4t,c4s,c4,
      "Shows: programme counts by group (median budget on hover). Not: a ranking of need or aid volume — counts reflect what is published to IATI.");
}

/* ---------- Country profiles ---------- */
const CY={country:""};
function cyTop(rows,key,n){ const m={}; rows.forEach(r=>{const k=r[key]; if(k) m[k]=(m[k]||0)+1;}); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n); }
function cyBars(items,linkType){ const max=Math.max(1,...items.map(d=>d.v));
  return items.map(d=>{ const inner="<span class='cp-bl'>"+esc(d.l)+"</span><span class='cp-bar'><span style='width:"+Math.round(100*d.v/max)+"%'></span></span><span class='cp-bv'>"+esc(d.disp||String(d.v))+"</span>";
    return linkType
      ? "<button type='button' class='cp-bar-row cp-bar-link' data-link='"+linkType+"' data-val=\""+eatt(d.l)+"\" title='Plan in "+esc(CY.country)+" scoped to "+esc(d.l)+"'>"+inner+"<span class='cp-go'>plan ›</span></button>"
      : "<div class='cp-bar-row'>"+inner+"</div>"; }).join("")||"<p class='muted'>—</p>"; }
/* Self-contained SVG locator: simplified world land + an accurate marker from the
 * country centroid (or its region centre), zoomed to the country's region. */
function countryMapSVG(cc,rg){
  const C=(typeof GEO_CENTROIDS!=="undefined"&&GEO_CENTROIDS[cc])||(typeof GEO_REGION_CENTER!=="undefined"&&GEO_REGION_CENTER[rg])||[0,0];
  const cx=180+C[0], cy=90-C[1], W=116, H=74;
  const x0=Math.max(0,Math.min(360-W,cx-W/2)), y0=Math.max(0,Math.min(180-H,cy-H/2));
  const land=((typeof GEO_LAND!=="undefined")?GEO_LAND:[]).map(poly=>
    "<path d='M"+poly.map(pt=>(180+pt[0]).toFixed(1)+","+(90-pt[1]).toFixed(1)).join("L")+"Z'/>").join("");
  return "<svg viewBox='"+x0+" "+y0+" "+W+" "+H+"' class='cmap' preserveAspectRatio='xMidYMid slice' role='img' aria-label='Location of "+esc(CY.country)+"'>"+
    "<rect x='0' y='0' width='360' height='180' class='cmap-sea'/>"+
    "<g class='cmap-land'>"+land+"</g>"+
    "<g transform='translate("+cx.toFixed(1)+","+cy.toFixed(1)+")'><circle r='7' class='cmap-halo'/><circle r='4.4' class='cmap-ring'/><circle r='2' class='cmap-dot'/></g>"+
  "</svg>";
}
/* Indicators overview for one sector's programmes in this country — drawn inside
 * the expanded sector group. Uses the embedded outcome rows (target/actual). */
function cySectorIndicators(list){
  const inds=[]; list.forEach(p=>{ (OUT_BY_NAME[p.n]||[]).forEach(o=>inds.push(o)); });
  if(!inds.length) return "";
  const ach=[]; inds.forEach(o=>{ if(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number") ach.push(o.ac/o.tg); });
  const seen=new Set(), top=[];
  inds.forEach(o=>{ if(!(typeof o.tg==="number"&&o.tg>0&&typeof o.ac==="number")) return;
    const t=(i18n(o.i)||o.i||"").replace(/\s+/g," ").trim(); if(!t||seen.has(t.toLowerCase())) return; seen.add(t.toLowerCase());
    top.push({t:t,r:o.ac/o.tg}); });
  top.sort((a,b)=>b.r-a.r);
  const summ=ach.length
    ? fmtNum(inds.length)+" indicator"+(inds.length>1?"s":"")+" · median achieved <b>"+Math.round(median(ach)*100)+"%</b> <span class='muted'>("+ach.length+" with target+actual)</span>"
    : fmtNum(inds.length)+" indicator"+(inds.length>1?"s":"")+" <span class='muted'>(no comparable target/actual)</span>";
  const bars=top.slice(0,6).map(x=>{ const pct=Math.max(0,Math.min(100,Math.round(x.r*100)));
    return "<div class='cp-ind-row'><span class='cp-ind-t' title='"+esc(x.t)+"'>"+esc(x.t.length>62?x.t.slice(0,60)+"…":x.t)+"</span>"+
      "<span class='cp-ind-bar'><span class='"+achClass(x.r)+"' style='width:"+pct+"%'></span></span><span class='cp-ind-v'>"+pct+"%</span></div>"; }).join("");
  return "<div class='cp-indicators'><div class='cp-ind-h'>"+summ+"</div>"+bars+
    "<p class='cp-ind-note'>Achieved = actual ÷ target (derived); IATI target/actual is noisy — read as indicative.</p></div>";
}
function renderCountry(){
  const el=document.getElementById("country"); if(!el) return;
  if(!CY.country){ el.innerHTML="<div class='cprompt'>Select a country above to see its profile.</div>"; syncURL(); return; }
  const rows=PROGRAMS.filter(p=>p.co===CY.country);
  if(!rows.length){ el.innerHTML="<div class='cprompt'>No programmes for "+esc(CY.country)+".</div>"; syncURL(); return; }
  const cc=rows[0].cc, rg=rows[0].rg;
  const medB=median(rows.map(r=>r._usd)),medD=median(rows.map(r=>r._dur)),resPct=rows.filter(r=>r.re).length/rows.length;
  const secMap={}; rows.forEach(r=>{(secMap[r.sn]=secMap[r.sn]||[]).push(r);});
  const secs=Object.entries(secMap).map(([k,v])=>({l:k,v:v.length,disp:v.length+" · "+fmtCompact(median(v.map(x=>x._usd)))})).sort((a,b)=>b.v-a.v);
  const donors=cyTop(rows,"d",6).map(([l,v])=>({l,v,disp:String(v)}));
  const provs=cyTop(rows.filter(r=>r.pcc),"pn",5).map(([l,v])=>({l,v,disp:String(v)}));
  const recent=rows.slice().sort((a,b)=>(b.st||"").localeCompare(a.st||"")).slice(0,6);
  const nDon=new Set(rows.map(r=>r.d)).size, wr=rows.filter(r=>r.re).length;
  let h="<div class='cprofile'>";
  // ── hero: locator map + identity + actions ──
  h+="<div class='cp-hero'>"+
     "<div class='cp-map'>"+countryMapSVG(cc,rg)+"</div>"+
     "<div class='cp-id'>"+
       "<div class='cp-id-region'>"+esc(rg||"")+"</div>"+
       "<h2 class='cp-id-name'>"+esc(CY.country)+"</h2>"+
       "<div class='cp-id-meta'>"+fmtNum(rows.length)+" programmes · "+secs.length+" sectors · "+nDon+" donor type"+(nDon>1?"s":"")+"</div>"+
       "<div class='cp-actions'><button id='cy-grid' class='btn ghost'>View in Programmes →</button><button id='cy-plan' class='btn'>Plan in "+esc(CY.country)+" →</button></div>"+
     "</div></div>";
  // ── key stats ──
  h+="<div class='cp-stats'>"+
    "<div class='cp-card'><div class='cp-k'>Programmes</div><div class='cp-v'>"+fmtNum(rows.length)+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Median budget</div><div class='cp-v'>"+fmtCompact(medB)+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Median duration</div><div class='cp-v'>"+(medD==null?"—":Math.round(medD)+" mo")+"</div></div>"+
    "<div class='cp-card'><div class='cp-k'>Report results</div><div class='cp-v'>"+fmtPct(resPct)+"</div><div class='cp-cs'>"+fmtNum(wr)+" of "+fmtNum(rows.length)+"</div></div></div>";
  // ── who funds, on what ──
  h+="<div class='cp-grid2'>"+
    "<div class='cp-panel'><h3>By sector <span class='cp-hint'>click to plan</span></h3>"+cyBars(secs,"sector")+"</div>"+
    "<div class='cp-panel'><h3>By donor type <span class='cp-hint'>click to plan</span></h3>"+cyBars(donors,"donor")+(provs.length?"<h3 class='cp-h2'>Top providing countries <span class='cp-inf'>(inferred)</span></h3>"+cyBars(provs,"prov"):"")+"</div></div>";
  // ── programmes by sector, each expandable to its indicators + programmes ──
  h+="<div class='cp-panel cp-bysector'><h3>Programmes by sector <span class='cp-hint'>open a sector for its indicators &amp; programmes</span></h3>"+secs.map(function(sec){
      const list=secMap[sec.l].slice().sort((a,b)=>(b._usd||0)-(a._usd||0));
      const mb=fmtCompact(median(secMap[sec.l].map(x=>x._usd)));
      return "<details class='cp-secgroup'><summary><span class='cp-sg-name'>"+esc(sec.l)+"</span><span class='cp-sg-meta'>"+sec.v+" programme"+(sec.v>1?"s":"")+" · median "+mb+"</span></summary>"+
        cySectorIndicators(list)+
        "<div class='cp-sg-list'>"+list.map(p=>"<div class='cp-prog crow-click' data-i='"+p._i+"' tabindex='0' role='button' aria-label='Open programme details'><span class='pcn'>"+esc(pName(p))+"</span><span class='pcm'>"+chip(p.d)+" · "+fmtCompact(p._usd)+" · "+(p._dur==null?"—":p._dur+" mo")+" · "+esc(p.st||"—")+" · <span class='rowmore'>open ›</span></span></div>").join("")+"</div>"+
      "</details>";
    }).join("")+"</div>";
  // ── recent activity ──
  h+="<div class='cp-panel'><h3>Recent programmes</h3>"+recent.map(p=>"<div class='cp-prog crow-click' data-i='"+p._i+"' tabindex='0' role='button' aria-label='Open programme details'><span class='pcn'>"+esc(pName(p))+"</span><span class='pcm'>"+esc(p.sn)+" · "+chip(p.d)+" · "+fmtCompact(p._usd)+" · "+esc(p.st||"—")+" · <span class='rowmore'>open ›</span></span></div>").join("")+"</div>";
  h+="</div>";
  el.innerHTML=h;
  const g=document.getElementById("cy-grid"); if(g) g.addEventListener("click",()=>{ Object.assign(PS,{q:"",d:"",rg:"",co:CY.country,sc:"",sta:"",re:"",prov:"",page:1}); reflectControls(); showView("programmes"); renderPrograms(); });
  const pl=document.getElementById("cy-plan"); if(pl) pl.addEventListener("click",()=>{ PL.country=CY.country; setVal("pl-country",PL.country); showView("plan"); renderPlanRec(); renderPlanCalc(); });
  el.querySelectorAll(".cp-prog[data-i]").forEach(r=>r.addEventListener("click",()=>openCard(PROGRAMS[+r.getAttribute("data-i")])));
  // deep-link the sector/donor/provider bars into the planner, scoped to this country
  el.querySelectorAll(".cp-bar-link").forEach(b=>b.addEventListener("click",()=>{
    const lt=b.getAttribute("data-link"), val=b.getAttribute("data-val");
    PL.country=CY.country;
    if(lt==="donor") PL.donor=val; else if(lt==="prov") PL.prov=val; else if(lt==="sector") PL.sector=val;
    setVal("pl-country",PL.country); setVal("pl-donor",PL.donor); setVal("pl-prov",PL.prov); setVal("pl-sector",PL.sector);
    showView("plan"); renderPlanRec(); renderPlanCalc();
  }));
  syncURL();
}


function init(){ try {
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
  const _pf=document.getElementById("o-progfilter"); if(_pf) _pf.addEventListener("click",e=>{ if(e.target.closest("#o-progclear")){ OS.prog="";OS.page=1;renderOutcomes();syncURL(); } });
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

  const phEl=document.getElementById("ph"); if(phEl) phEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th||th.classList.contains("nosort"))return;const k=th.dataset.key;if(!k)return;if(PS.sort===k)PS.dir*=-1;else{PS.sort=k;PS.dir=PSTR.split(" ").includes(k)?1:-1;}renderPrograms();});
  const ohEl=document.getElementById("oh"); if(ohEl) ohEl.addEventListener("click",e=>{const th=e.target.closest("th");if(!th)return;const k=th.dataset.key;if(!k)return;if(OS.sort===k)OS.dir*=-1;else{OS.sort=k;OS.dir=("n i s sn t".split(" ").includes(k))?1:-1;}renderOutcomes();});
  [phEl,ohEl].forEach(elx=>{ if(elx) elx.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const th=e.target.closest&&e.target.closest("th[data-key]"); if(th){ e.preventDefault(); th.click(); } } }); });

  const _fp=document.getElementById("filters-panel"),_sm=document.getElementById("sort-menu");
  on("filters-btn","click",e=>{ e.stopPropagation(); if(_sm)_sm.hidden=true; if(_fp){_fp.hidden=!_fp.hidden; const fb=document.getElementById("filters-btn"); if(fb)fb.setAttribute("aria-expanded",String(!_fp.hidden));} });
  on("sort-btn","click",e=>{ e.stopPropagation(); if(_fp)_fp.hidden=true; if(_sm){ buildSortMenu(); _sm.hidden=!_sm.hidden; } });
  const _chips=document.getElementById("chips"); if(_chips) _chips.addEventListener("click",e=>{
    if(e.target.closest(".chip-reset")){ const r=document.getElementById("reset"); if(r)r.click(); return; }
    const x=e.target.closest(".chip-x"); if(!x)return; const f=x.getAttribute("data-f"),sel=x.getAttribute("data-sel");
    PS[f]=""; const s=document.getElementById(sel); if(s)s.value=""; PS.page=1; renderPrograms(); });
  if(_sm) _sm.addEventListener("click",e=>{ const it=e.target.closest(".sort-item"); if(!it)return; const k=it.getAttribute("data-k"); if(PS.sort===k)PS.dir*=-1; else{PS.sort=k;PS.dir=PSTR.split(" ").includes(k)?1:-1;} renderPrograms(); buildSortMenu(); });
  document.addEventListener("click",e=>{ if(_fp&&!_fp.hidden&&!e.target.closest("#filters-panel,#filters-btn"))_fp.hidden=true; if(_sm&&!_sm.hidden&&!e.target.closest("#sort-menu,#sort-btn"))_sm.hidden=true; });
  const _mt=document.getElementById("menu-toggle"),_scrim=document.getElementById("navScrim");
  const setNav=open=>{ document.body.classList.toggle("nav-open",open); if(_mt) _mt.setAttribute("aria-expanded",open?"true":"false"); };
  if(_mt) _mt.addEventListener("click",()=>setNav(!document.body.classList.contains("nav-open")));
  if(_scrim) _scrim.addEventListener("click",()=>setNav(false));
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>{showView(b.dataset.view);setNav(false);}));
  document.querySelectorAll(".theme-btn").forEach(b=>b.addEventListener("click",()=>setTheme(b.dataset.theme)));
  document.querySelectorAll(".basis-btn").forEach(b=>b.addEventListener("click",()=>setBasis(b.dataset.basis)));
  const _m=document.getElementById("cardModal"); if(_m){ _m.querySelectorAll("[data-close]").forEach(el=>el.addEventListener("click",closeCard)); _m.addEventListener("keydown",trapCardTab); }
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ closeCard(); setNav(false); if(_fp)_fp.hidden=true; if(_sm)_sm.hidden=true; } });
  // keyboard activation for focusable rows (role=button): Enter/Space opens the card
  document.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ const el=document.activeElement;
    if(el&&el.classList&&el.classList.contains("crow-click")){ e.preventDefault(); el.click(); } } });
  const _pb=document.getElementById("pb"); if(_pb) _pb.addEventListener("click",e=>{ const tr=e.target.closest&&e.target.closest("tr.crow-click"); if(tr) openCard(PROGRAMS[+tr.getAttribute("data-i")]); });
  const _ob=document.getElementById("ob"); if(_ob) _ob.addEventListener("click",e=>{ const tr=e.target.closest&&e.target.closest("tr.crow-click"); if(tr) openCard(PROGRAMS[+tr.getAttribute("data-i")]); });
  const _rec=document.getElementById("pl-rec"); if(_rec) _rec.addEventListener("click",e=>{
    const use=e.target.closest&&e.target.closest(".pl-use-proj"); if(use){ seedFromProject(PROGRAMS[+use.getAttribute("data-i")]); return; }
    const info=e.target.closest&&e.target.closest(".pcomp-info[data-i]"); if(info) openCard(PROGRAMS[+info.getAttribute("data-i")]); });

  setTheme("light"); renderMeta(); buildFX(); renderUniverse(); renderDQ(); renderBenchmarks(); renderCharts(); renderCountry(); renderPrograms(); renderOutcomes(); wirePlan();
  route(); URL_READY=true; syncURL();
  } catch(err){
    if(typeof console!=="undefined"&&console.error) console.error("Benchmark DB init failed:",err);
    var mn=document.querySelector(".main")||document.body;
    mn.insertAdjacentHTML("afterbegin","<div role='alert' style='font-family:system-ui,sans-serif;max-width:620px;margin:8vh auto;padding:24px;border:1px solid #e2d8c4;border-radius:12px;background:#fff;color:#33424f;text-align:center'>"+
      "<h1 style='font-weight:600;font-size:21px;margin:0 0 8px'>Something went wrong loading the dashboard</h1>"+
      "<p style='line-height:1.6;margin:0'>The page hit an unexpected error while rendering and couldn’t finish. Try reloading; if it persists, the dataset file may be corrupted — see the README to rebuild it.</p></div>");
  }
}
document.addEventListener("DOMContentLoaded",init);

