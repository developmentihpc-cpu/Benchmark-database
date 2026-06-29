/* Sector design guidance — cited reference layer (provenance: REFERENCE — external
 * standards/evidence). Organised by ~13 themes because authoritative design guidance
 * is published by theme, not by 5-digit DAC code; every DAC purpose code maps to a
 * theme via guideTheme(). Each bullet reflects an established position of a named,
 * linked source — indicative, validate locally; not targets. Sources verified 2026-06.
 */
const GUIDE_THEME = {
  education: {
    name: "Education",
    activities: [
      "Focus on learning, not just enrolment — children can be in school yet not learning (“learning poverty”).",
      "Prioritise the rated cost-effective “smart buys”: structured pedagogy, teaching at the right level, teacher coaching, and parent/early-childhood interventions."],
    drivers: [
      "Teacher salaries dominate recurrent cost; per-student unit cost, pupil–teacher ratio and coaching intensity are the main levers."],
    pitfalls: [
      "Inputs-only spending (buildings, materials, computers) shows weak learning impact — flagged as poor value.",
      "Class-size reduction alone is expensive for modest learning gains.",
      "Measuring outputs (enrolment/attendance) instead of actual learning."],
    sources: [
      {n:"GEEAP “Smart Buys” (2023)", u:"https://geeap.org/"},
      {n:"World Bank — Learning Poverty", u:"https://www.worldbank.org/en/topic/education/brief/learning-poverty"},
      {n:"UNESCO GEM Report", u:"https://www.unesco.org/gem-report/en"}]
  },
  health: {
    name: "Health",
    activities: [
      "Strengthen primary health care: essential service packages (maternal & child health, immunisation, essential medicines), workforce and supply chain, prioritised by local disease burden.",
      "Lead with cost-effective interventions — DCP3’s essential UHC packages and WHO “best buys”."],
    drivers: [
      "Workforce (salaries) and commodities/supply chain dominate recurrent cost; community-vs-facility delivery and coverage/last-mile reach drive unit cost."],
    pitfalls: [
      "Vertical, disease-specific projects that bypass and weaken the broader primary-care system.",
      "Designing to targets beyond absorptive capacity (workforce, supply chain) → low actual delivery.",
      "Ignoring demand-side barriers (cost, distance, trust) — supply alone underperforms."],
    sources: [
      {n:"Disease Control Priorities (DCP3)", u:"https://www.dcp-3.org/"},
      {n:"WHO — UHC & “best buys”", u:"https://www.who.int/health-topics/universal-health-coverage"},
      {n:"J-PAL Policy Insights (Health)", u:"https://www.povertyactionlab.org/policy-insights"}]
  },
  nutrition: {
    name: "Nutrition & food assistance",
    activities: [
      "Use the proven nutrition-specific interventions (breastfeeding & complementary feeding, micronutrient supplementation, management of acute malnutrition) alongside nutrition-sensitive measures.",
      "Target the first 1,000 days (pregnancy to age 2), where impact on stunting is greatest."],
    drivers: [
      "Supplement/therapeutic-food commodities and community delivery; reaching the poorest and most remote raises unit cost."],
    pitfalls: [
      "Treating nutrition as a health add-on rather than multi-sector (food, WASH, social protection).",
      "Expecting full coverage to end stunting — even the proven package averts roughly a fifth of stunting."],
    sources: [
      {n:"Lancet Maternal & Child Nutrition Series", u:"https://www.thelancet.com/series/maternal-and-child-undernutrition-progress"},
      {n:"Scaling Up Nutrition (SUN)", u:"https://scalingupnutrition.org/"}]
  },
  wash: {
    name: "Water, sanitation & hygiene",
    activities: [
      "Combine water-supply and sanitation hardware with hygiene behaviour change and a funded operation & maintenance / management model — hardware alone is incomplete.",
      "Plan against the JMP service ladder (basic → safely managed): water on premises, available when needed, free from contamination."],
    drivers: [
      "Life-cycle costs, not just capex — sustaining sanitation services for 20 years can cost 5–20× building the latrine.",
      "Hydrogeology/technology, remoteness/logistics, and service level (handpump vs piped)."],
    pitfalls: [
      "Building infrastructure with no funded O&M — the well-documented “functionality” problem (water points fail within a few years).",
      "Counting “access” as construction rather than sustained service."],
    sources: [
      {n:"Sphere Handbook (2018) — WASH", u:"https://spherestandards.org/handbook/"},
      {n:"WHO/UNICEF JMP service ladders", u:"https://washdata.org/monitoring/drinking-water"},
      {n:"IRC WASHCost (life-cycle costs)", u:"https://www.ircwash.org/washcost"}]
  },
  governance: {
    name: "Governance, PFM & peacebuilding",
    activities: [
      "Anchor public financial management work in a diagnostic — the PEFA framework (7 pillars / 31 indicators) — and sequence reforms to real problems.",
      "Use problem-driven, iterative approaches (PDIA) rather than importing “best-practice” blueprints."],
    drivers: [
      "Mostly technical assistance and capacity-building (people and time); long horizons; political economy determines what sticks."],
    pitfalls: [
      "Isomorphic mimicry — reforms that change what institutions look like, not what they do (“schools get built but children don’t learn”).",
      "Premature load-bearing — expecting new capacity to deliver before it actually exists."],
    sources: [
      {n:"PEFA framework", u:"https://www.pefa.org/"},
      {n:"Building State Capability (Andrews, Pritchett & Woolcock, 2018)", u:"https://bsc.hks.harvard.edu/"},
      {n:"OECD-DAC evaluation criteria", u:"https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness.html"}]
  },
  social: {
    name: "Social protection & services",
    activities: [
      "Invest in delivery systems (registration, payment, grievance redress) — the “how” matters as much as the transfer.",
      "Match the instrument to the objective: cash transfers (conditional/unconditional), public works, social pensions, fee waivers."],
    drivers: [
      "Transfer value × caseload dominates; delivery-system set-up is a large up-front cost that lowers long-run cost-per-beneficiary."],
    pitfalls: [
      "Targeting errors (exclusion/inclusion) and fragmented, parallel programmes; weak delivery systems undermine sound designs.",
      "Designing transfers without a scalability/exit plan (e.g. adaptive social protection for shocks)."],
    sources: [
      {n:"World Bank — Sourcebook on Social Protection Delivery Systems", u:"https://www.worldbank.org/en/topic/socialprotectionandjobs/publication/sourcebook-on-the-foundations-of-social-protection-delivery-systems"},
      {n:"World Bank ASPIRE", u:"https://www.worldbank.org/en/data/datatopics/aspire"}]
  },
  agriculture: {
    name: "Agriculture, forestry & fisheries",
    activities: [
      "Take a market-systems / value-chain approach — link smallholders to inputs, finance, processing and markets, not production alone.",
      "Combine productivity, post-harvest/processing and the inclusion of women and the poorest."],
    drivers: [
      "Extension reach, inputs, and enabling infrastructure (irrigation, roads, storage); access to finance and markets."],
    pitfalls: [
      "Production-focused projects that ignore markets and post-harvest losses.",
      "Subsidy/handout models that don’t build a self-sustaining market system."],
    sources: [
      {n:"FAO — Sustainable Food Value Chains", u:"https://www.fao.org/sustainable-food-value-chains/en/"},
      {n:"IFAD — value-chain development", u:"https://www.ifad.org/"},
      {n:"DCED Standard (results measurement)", u:"https://www.enterprise-development.org/measuring-results-the-dced-standard/"}]
  },
  economic: {
    name: "Private sector & economic development",
    activities: [
      "Use a market-systems (M4P) approach — change how markets work for the poor rather than substituting for the market.",
      "Measure results with a credible results chain (the DCED Standard) and track private co-investment."],
    drivers: [
      "Mostly technical assistance, facilitation and matching grants; results hinge on private co-investment and the business environment."],
    pitfalls: [
      "Displacing private actors or subsidising what markets would do anyway; weak attribution of results."],
    sources: [
      {n:"DCED Standard", u:"https://www.enterprise-development.org/measuring-results-the-dced-standard/"},
      {n:"World Bank — Finance, Competitiveness & Innovation", u:"https://www.worldbank.org/en/topic/financialsector"}]
  },
  energy: {
    name: "Energy",
    activities: [
      "Plan against the Multi-Tier Framework (MTF): energy access is multi-dimensional (capacity, reliability, affordability), not a binary connected/not.",
      "Combine grid, mini-grid and off-grid solar to least-cost geospatial plans."],
    drivers: [
      "Capital-intensive; technology and population density (urban vs remote) drive cost-per-connection; affordability and O&M determine sustained use."],
    pitfalls: [
      "Counting connections rather than actual usable, affordable, reliable service."],
    sources: [
      {n:"ESMAP/SEforALL — Multi-Tier Framework (Beyond Connections)", u:"https://www.esmap.org/mtf_multi-tier_framework_for_energy_access"}]
  },
  infrastructure: {
    name: "Transport & communications",
    activities: [
      "Prioritise by economic and access return; plan whole-life asset management (maintenance), not just construction."],
    drivers: [
      "Capital-intensive; terrain, standards and the maintenance backlog drive whole-life cost — under-funded maintenance is the classic failure."],
    pitfalls: [
      "Building assets with no funded maintenance regime; weak safeguards (resettlement, environment, road safety)."],
    sources: [
      {n:"World Bank — Transport", u:"https://www.worldbank.org/en/topic/transport"},
      {n:"OECD-DAC evaluation criteria", u:"https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness.html"}]
  },
  environment: {
    name: "Environment & climate",
    activities: [
      "For climate, distinguish adaptation from mitigation and ground adaptation in a local climate-risk and vulnerability assessment.",
      "Build in measurable environmental/biodiversity outcomes and safeguards, with local livelihoods and incentives in mind."],
    drivers: [
      "Long time-horizons; monitoring and enforcement costs; co-benefits that are hard to value."],
    pitfalls: [
      "Vague “environmental” objectives without measurable outcomes; ignoring local livelihoods and incentives."],
    sources: [
      {n:"IPCC", u:"https://www.ipcc.ch/"},
      {n:"Green Climate Fund", u:"https://www.greenclimate.fund/"},
      {n:"UNEP", u:"https://www.unep.org/"}]
  },
  humanitarian: {
    name: "Humanitarian response & DRR",
    activities: [
      "Meet Sphere minimum standards across WASH, food security & nutrition, shelter and health; use the sector companions (INEE, LEGS, CPMS, MERS).",
      "Default to cash & voucher assistance where markets function and it is appropriate."],
    drivers: [
      "Logistics/access, speed and security dominate cost; caseload and duration; in-kind vs cash changes the whole cost structure."],
    pitfalls: [
      "Recurring structural lessons go unlearned — coordination, localisation, and accountability to affected people.",
      "Supply-driven in-kind responses where cash would be faster, cheaper and more dignified."],
    sources: [
      {n:"Sphere Handbook (2018)", u:"https://spherestandards.org/handbook/"},
      {n:"CALP Network — cash & voucher assistance", u:"https://www.calpnetwork.org/"},
      {n:"ALNAP — State of the Humanitarian System", u:"https://alnap.org/sohs/"}]
  },
  multisector: {
    name: "Multisector / other",
    activities: [
      "Define a clear theory of change and apply the OECD-DAC criteria (relevance, coherence, effectiveness, efficiency, impact, sustainability) — thoughtfully, not mechanically."],
    drivers: [
      "Coordination and management overheads across multiple components."],
    pitfalls: [
      "Over-broad designs with no clear primary outcome; mechanical use of frameworks."],
    sources: [
      {n:"OECD-DAC evaluation criteria", u:"https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness.html"},
      {n:"J-PAL Policy Insights", u:"https://www.povertyactionlab.org/policy-insights"}]
  }
};
/* Map a 5-digit DAC purpose code to a guidance theme. Uses the robust 2-digit DAC
 * group prefix (e.g. 23xxx = energy across all its subgroups), with a few 5-digit
 * overrides where a code belongs to a different theme than its group. */
function guideTheme(sc){
  sc = String(sc || "");
  const SPEC = { "12240":"nutrition", "72040":"nutrition", "52010":"nutrition", "51010":"governance" };
  if (SPEC[sc]) return SPEC[sc];
  const G2 = {
    "11":"education","12":"health","13":"health","14":"wash","15":"governance","16":"social",
    "21":"infrastructure","22":"infrastructure","23":"energy","24":"economic","25":"economic",
    "31":"agriculture","32":"economic","33":"economic","41":"environment","43":"multisector",
    "51":"governance","52":"nutrition","53":"economic",
    "72":"humanitarian","73":"humanitarian","74":"humanitarian"
  };
  return G2[sc.slice(0,2)] || "multisector";
}
