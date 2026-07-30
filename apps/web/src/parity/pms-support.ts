// Source : docs/reference/olive-demo.html 33190–33500 — porté verbatim.
// Moteur PMS (Portfolio Management System) : univers, profils, construction déterministe des
// portefeuilles (amlHash), breaches de conformité investissement, enrichissement, rééquilibrage,
// pre-trade check, adéquation LSFin, métriques de risque.
import { amlHash } from "./preonboarding-support";

// CONSIGNÉ — module Settlement non encore porté : le bouton « Générer les ordres → Settlement »
// (PmsMandateExtras) appelle settleOrders()/settleTokenize(). Stubs locaux : la file d'ordres est
// tenue en mémoire du module et le tokenizer renvoie une empreinte déterministe minimale.
// À rebrancher sur le vrai Settlement au portage de l'écran « Exécution & Settlement ».
const __settleQueue: any[] = [];
export function settleOrders() { return __settleQueue; }
export function settleTokenize(src: any) { return { token: "TOK-" + (src.id || src.isin || "x"), tokenizedAt: "2026-07-11" }; }

export const PMS_UNIVERSE: any[] = [
  { isin: "CH0012032048", name: "Roche Holding AG", cls: "ACT", ccy: "CHF", riskLvl: 3, sector: "Santé", esg: true, shariah: true },
  { isin: "CH0038863350", name: "Nestlé SA", cls: "ACT", ccy: "CHF", riskLvl: 2, sector: "Consommation", esg: true, shariah: true },
  { isin: "US0378331005", name: "Apple Inc.", cls: "ACT", ccy: "USD", riskLvl: 3, sector: "Technologie", esg: true, shariah: true },
  { isin: "US88160R1014", name: "Tesla Inc.", cls: "ACT", ccy: "USD", riskLvl: 5, sector: "Automobile", esg: true, shariah: true },
  { isin: "CH0244767585", name: "UBS Group AG", cls: "ACT", ccy: "CHF", riskLvl: 3, sector: "Banques", esg: true, shariah: false },
  { isin: "GB0009895292", name: "AstraZeneca PLC", cls: "ACT", ccy: "GBP", riskLvl: 3, sector: "Santé", esg: true, shariah: true },
  { isin: "US7134481081", name: "Philip Morris Intl", cls: "ACT", ccy: "USD", riskLvl: 3, sector: "Tabac", esg: false, shariah: false },
  { isin: "FR0000121329", name: "Thales SA", cls: "ACT", ccy: "EUR", riskLvl: 3, sector: "Défense", esg: false, shariah: false },
  { isin: "US0231351067", name: "Amazon.com Inc.", cls: "ACT", ccy: "USD", riskLvl: 4, sector: "Technologie", esg: true, shariah: true },
  { isin: "DE0007164600", name: "SAP SE", cls: "ACT", ccy: "EUR", riskLvl: 3, sector: "Technologie", esg: true, shariah: true },
  { isin: "CH0224397213", name: "Conf. suisse 1.5% 2042", cls: "OBL", ccy: "CHF", riskLvl: 1, sector: "Souverain", esg: true, shariah: false },
  { isin: "XS2021086135", name: "Nestlé 0.875% 2031", cls: "OBL", ccy: "EUR", riskLvl: 1, sector: "Corporate IG", esg: true, shariah: false },
  { isin: "US912828YV67", name: "US Treasury 2.375% 2029", cls: "OBL", ccy: "USD", riskLvl: 1, sector: "Souverain", esg: true, shariah: false },
  { isin: "XS1843437549", name: "EM High Yield 5.75% 2028", cls: "OBL", ccy: "USD", riskLvl: 4, sector: "High Yield", esg: false, shariah: false },
  { isin: "XS2343822842", name: "Sukuk IsDB 1.62% 2030", cls: "OBL", ccy: "USD", riskLvl: 2, sector: "Sukuk", esg: true, shariah: true },
  { isin: "LU0908500753", name: "MSCI World ESG Leaders ETF", cls: "FND", ccy: "USD", riskLvl: 3, sector: "Global", esg: true, shariah: false },
  { isin: "IE00B4L5Y983", name: "Core MSCI World ETF", cls: "FND", ccy: "USD", riskLvl: 3, sector: "Global", esg: true, shariah: false },
  { isin: "LU1437018838", name: "HSBC Islamic Global Equity", cls: "FND", ccy: "USD", riskLvl: 3, sector: "Global", esg: true, shariah: true },
  { isin: "CH0454664027", name: "Produit structuré BRC 12%", cls: "ALT", ccy: "CHF", riskLvl: 5, sector: "Structuré", esg: false, shariah: false },
  { isin: "LU2572257124", name: "Private Equity Feeder VII", cls: "ALT", ccy: "USD", riskLvl: 4, sector: "Private mkts", esg: true, shariah: false },
  { isin: "XC0009655157", name: "Or physique (once)", cls: "OR", ccy: "USD", riskLvl: 2, sector: "Métal", esg: true, shariah: true },
  { isin: "CH-CASH-CHF", name: "Liquidités CHF", cls: "LIQ", ccy: "CHF", riskLvl: 1, sector: "Cash", esg: true, shariah: true },
];
export const PMS_CLS_LABEL: Record<string, string> = { ACT: "Actions", OBL: "Obligations", FND: "Fonds", ALT: "Alternatifs", OR: "Or", LIQ: "Liquidités" };
export const PMS_PROFILES: Record<string, any> = {
  "Conservateur": { target: { ACT: 15, OBL: 55, FND: 10, ALT: 0, OR: 5, LIQ: 15 }, maxInstrRisk: 3, maxPosPct: 15, bench: 2.4 },
  "Équilibré": { target: { ACT: 35, OBL: 35, FND: 15, ALT: 5, OR: 5, LIQ: 5 }, maxInstrRisk: 4, maxPosPct: 18, bench: 4.8 },
  "Dynamique": { target: { ACT: 55, OBL: 15, FND: 15, ALT: 10, OR: 3, LIQ: 2 }, maxInstrRisk: 5, maxPosPct: 22, bench: 7.5 },
  "Agressif": { target: { ACT: 65, OBL: 5, FND: 10, ALT: 15, OR: 3, LIQ: 2 }, maxInstrRisk: 5, maxPosPct: 25, bench: 9.6 },
};
export function pmsParseM(a: any) { const m = String(a || "").match(/([\d.]+)\s*M/i); return m ? parseFloat(m[1]) : 1; }
export function pmsProfileFor(c: any) {
  const names = Object.keys(PMS_PROFILES);
  const base = c.risk === "HIGH" ? 3 : c.risk === "MEDIUM" ? 2 : 1;
  const idx = Math.max(0, Math.min(3, base - (amlHash(c.id + "PMSP", 3) === 0 ? 1 : 0)));
  return names[idx];
}
const __pmsPfCache = new Map();
const __pmsEnCache = new Map();
export function pmsPortfolio(c: any): any {
  if (c && c.id && __pmsPfCache.has(c.id)) return __pmsPfCache.get(c.id);
  const r = __pmsPortfolioRaw(c);
  if (c && c.id) __pmsPfCache.set(c.id, r);
  return r;
}
function __pmsPortfolioRaw(c: any) {
  const profName = pmsProfileFor(c);
  const prof = PMS_PROFILES[profName];
  const mandate = ["Discrétionnaire", "Conseil (Advisory)", "Execution-only"][amlHash(c.id + "MND", 3)];
  const refCcy = ["CHF", "USD", "EUR"][amlHash(c.id + "CCY", 3)];
  const totalM = pmsParseM(c.aum);
  const esgExcl = amlHash(c.id + "ESGX", 10) < 2;
  const islamic = amlHash(c.id + "ISL", 20) < 2;
  const neglected = amlHash(c.id + "NEG", 10) < 2;
  const classW: any = {};
  let totW = 0;
  Object.keys(prof.target).forEach(function (k) {
    const jit = (amlHash(c.id + "J" + k, neglected ? 25 : 9)) - (neglected ? 12 : 4);
    classW[k] = Math.max(0, prof.target[k] + jit);
    totW += classW[k];
  });
  Object.keys(classW).forEach(function (k) { classW[k] = classW[k] / totW * 100; });
  classW.LIQ = Math.max(classW.LIQ || 0, 1.5);
  let positions: any[] = [];
  let violBudget = amlHash(c.id + "AV", 10) < 3 ? 1 : 0;
  Object.keys(classW).forEach(function (k) {
    if (classW[k] < 1) return;
    if (k === "LIQ") { positions.push({ ins: PMS_UNIVERSE.find(function (x) { return x.cls === "LIQ"; }), weight: classW[k] }); return; }
    const pool = PMS_UNIVERSE.filter(function (x) { return x.cls === k; });
    let mandPool = pool.filter(function (x) { return (!islamic || x.shariah) && (!esgExcl || x.esg); });
    if (mandPool.length === 0) mandPool = pool;
    const okPool = mandPool.filter(function (x) { return x.riskLvl <= prof.maxInstrRisk; });
    if (okPool.length === 0 && violBudget === 0) { classW.LIQ = (classW.LIQ || 0) + classW[k]; return; }
    const nIn = Math.min(pool.length, 1 + amlHash(c.id + "NI" + k, classW[k] >= 30 ? 4 : classW[k] >= 15 ? 3 : 2));
    const chosen: any[] = [];
    let t = 0;
    while (chosen.length < nIn && t < 20) {
      const wantViol = violBudget > 0 && amlHash(c.id + "VIO" + k + t, 25) < 3;
      const src = wantViol ? pool : (okPool.length ? okPool : mandPool);
      const ins = src[amlHash(c.id + "PK" + k + t, src.length)];
      t++;
      if (chosen.indexOf(ins) < 0) {
        chosen.push(ins);
        if (wantViol && (ins.riskLvl > prof.maxInstrRisk || (islamic && !ins.shariah) || (esgExcl && !ins.esg))) violBudget--;
      }
    }
    const shares = chosen.map(function (_ins, i) { return 3 + amlHash(c.id + "SH" + k + i, 10); });
    const ssum = shares.reduce(function (a, x) { return a + x; }, 0);
    chosen.forEach(function (ins, i) { positions.push({ ins, weight: classW[k] * shares[i] / ssum }); });
  });
  let concBudget = amlHash(c.id + "CV", 10) < 2 ? 1 : 0;
  const liqPos = positions.find(function (p) { return p.ins.cls === "LIQ"; });
  positions.forEach(function (p) {
    if (p === liqPos) return;
    const exempt = p.ins.cls === "FND" || (p.ins.cls === "OBL" && p.ins.sector === "Souverain");
    if (!exempt && p.weight > prof.maxPosPct) {
      if (concBudget > 0) { concBudget--; return; }
      const excess = p.weight - prof.maxPosPct;
      p.weight = prof.maxPosPct;
      if (liqPos) liqPos.weight += excess;
    }
  });
  const wsum = positions.reduce(function (a, p) { return a + p.weight; }, 0);
  positions = positions.map(function (p) {
    const w = Math.round(p.weight / wsum * 1000) / 10;
    const perf = (amlHash(c.id + p.ins.isin, 300) - 120) / 10;
    return { ins: p.ins, weight: w, valM: Math.round(totalM * w) / 100, perf: Math.round(perf * 10) / 10 };
  });
  const alloc: any = { ACT: 0, OBL: 0, FND: 0, ALT: 0, OR: 0, LIQ: 0 };
  positions.forEach(function (p) { alloc[p.ins.cls] = Math.round((alloc[p.ins.cls] + p.weight) * 10) / 10; });
  let drift = 0;
  Object.keys(prof.target).forEach(function (k) { drift += Math.abs((alloc[k] || 0) - prof.target[k]); });
  drift = Math.round(drift / 2 * 10) / 10;
  const perfYtd = Math.round(positions.reduce(function (a, p) { return a + p.perf * p.weight / 100; }, 0) * 10) / 10;
  const breaches: any[] = [];
  positions.forEach(function (p) {
    if (p.ins.cls === "LIQ") return;
    if (p.ins.riskLvl > prof.maxInstrRisk) breaches.push({ type: "SUITABILITY", ins: p.ins, msg: p.ins.name + " — niveau de risque " + p.ins.riskLvl + " > max " + prof.maxInstrRisk + " du profil " + profName + " (LSFin art. 11-12)" });
    const concExempt = p.ins.cls === "FND" || (p.ins.cls === "OBL" && p.ins.sector === "Souverain");
    if (!concExempt && p.weight > prof.maxPosPct) breaches.push({ type: "CONCENTRATION", ins: p.ins, msg: p.ins.name + " — position " + p.weight + "% > limite " + prof.maxPosPct + "% (émetteur unique)" });
    if (esgExcl && !p.ins.esg) breaches.push({ type: "RESTRICTION ESG", ins: p.ins, msg: p.ins.name + " (" + p.ins.sector + ") — exclu par la politique ESG du mandat" });
    if (islamic && !p.ins.shariah) breaches.push({ type: "SHARIAH", ins: p.ins, msg: p.ins.name + " — non conforme au mandat islamique (revue Sharia Board)" });
  });
  return { c, profile: profName, prof, mandate, refCcy, totalM, esgExcl, islamic, positions, alloc, drift, perfYtd, bench: prof.bench, breaches };
}
export function pmsRebalanceProposal(pf: any) {
  const moves: any[] = [];
  Object.keys(pf.prof.target).forEach(function (k) {
    const d = Math.round(((pf.alloc[k] || 0) - pf.prof.target[k]) * 10) / 10;
    if (Math.abs(d) >= 4) moves.push({ cls: k, delta: d, amtM: Math.round(Math.abs(d) * pf.totalM) / 100 });
  });
  moves.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  return moves;
}
export function pmsPreTradeCheck(pf: any, ins: any, pct: number, _user: any) {
  const checks: any[] = [];
  const ok = function (l: string, n: string) { checks.push({ ok: true, label: l, note: n }); };
  const ko = function (l: string, n: string) { checks.push({ ok: false, label: l, note: n }); };
  if (ins.riskLvl > pf.prof.maxInstrRisk) ko("Suitability LSFin (art. 11-12)", "Niveau de risque " + ins.riskLvl + " > max " + pf.prof.maxInstrRisk + " du profil " + pf.profile);
  else ok("Suitability LSFin (art. 11-12)", "Niveau " + ins.riskLvl + " compatible avec le profil " + pf.profile);
  const exist = pf.positions.find(function (p: any) { return p.ins.isin === ins.isin; });
  const newW = Math.round(((exist ? exist.weight : 0) + pct) * 10) / 10;
  const cExempt = ins.cls === "FND" || (ins.cls === "OBL" && ins.sector === "Souverain");
  if (cExempt) ok("Concentration", "Fonds diversifié / souverain — exempté de la limite émetteur");
  else if (newW > pf.prof.maxPosPct) ko("Concentration", "Position résultante " + newW + "% > limite " + pf.prof.maxPosPct + "% (émetteur unique)");
  else ok("Concentration", "Position résultante " + newW + "% ≤ " + pf.prof.maxPosPct + "%");
  if (pf.esgExcl && !ins.esg) ko("Restriction ESG du mandat", ins.sector + " — secteur exclu par la politique ESG");
  else ok("Restriction ESG du mandat", pf.esgExcl ? "Instrument compatible avec la politique ESG" : "Pas de politique ESG sur ce mandat");
  if (pf.islamic && !ins.shariah) ko("Conformité Shariah", ins.name + " — non conforme ; alternative : Sukuk / fonds islamique");
  else ok("Conformité Shariah", pf.islamic ? "Instrument conforme au mandat islamique" : "Mandat non soumis au filtre Shariah");
  const liq = (pf.alloc.LIQ || 0) - pct;
  if (liq < 2) ko("Plancher de liquidités", "Liquidités après ordre " + Math.round(liq * 10) / 10 + "% < plancher 2%");
  else ok("Plancher de liquidités", "Liquidités après ordre " + Math.round(liq * 10) / 10 + "%");
  const fails = checks.filter(function (x) { return !x.ok; }).length;
  const verdict = fails === 0 ? "PASS" : checks.some(function (x) { return !x.ok && /Suitability|Shariah|ESG/.test(x.label); }) ? "BLOCK" : "WARN";
  return { verdict, checks, fails };
}
export function pmsEnrich(c: any): any {
  if (c && c.id && __pmsEnCache.has(c.id)) return __pmsEnCache.get(c.id);
  const r = __pmsEnrichRaw(c);
  if (c && c.id) __pmsEnCache.set(c.id, r);
  return r;
}
function __pmsEnrichRaw(c: any) {
  const pf = pmsPortfolio(c);
  const aumM = (function () { const m = String(c.aum || "10M").match(/([\d.]+)/); return m ? parseFloat(m[1]) : 10; })();
  let totalChf = aumM * 1000000;
  const pos = pf.positions.map(function (p0: any) {
    const ins = p0.ins || p0;
    let w = parseFloat(p0.weight !== undefined ? p0.weight : p0.pct) || 0;
    if (p0.valM && !w) w = Math.round(p0.valM * 1000000 / totalChf * 1000) / 10;
    const p: any = { isin: ins.isin, name: ins.name, ccy: ins.ccy, pct: w, valM: p0.valM };
    const h = amlHash(c.id + (p.isin || p.name || "x") + "PX", 1000);
    const priceNow = Math.round((20 + (h % 480)) * 100) / 100;
    const pnlPct = Math.round(((h % 36) - 12) * 10) / 10;
    const valueChf = p.valM ? Math.round(p.valM * 1000000) : Math.round(totalChf * (w / 100));
    return Object.assign({}, p, { pct: w, qty: Math.max(1, Math.round(valueChf / priceNow)), priceBuy: Math.round(priceNow / (1 + pnlPct / 100) * 100) / 100, priceNow, valueChf, pnlPct, pnlChf: Math.round(valueChf - valueChf / (1 + pnlPct / 100)) });
  }).filter(function (p: any) { return p.valueChf > 0; });
  const invested = pos.reduce(function (a: number, p: any) { return a + p.valueChf; }, 0);
  const cash = Math.max(0, totalChf - invested);
  totalChf = invested + cash;
  const wSum = pos.reduce(function (a: number, p: any) { return a + p.pct; }, 0) || 1;
  const ytd = Math.round(pos.reduce(function (a: number, p: any) { return a + p.pnlPct * (p.pct / wSum); }, 0) * 10) / 10;
  let perf: number[] = [], v = 100; const bench: number[] = []; let bv = 100;
  for (let m = 0; m < 12; m++) {
    const hm = amlHash(c.id + "PERF" + m, 100);
    v = v * (1 + ((hm % 9) - 3.6) / 100);
    perf.push(v);
    const hb = amlHash("BENCH" + pf.profile + m, 100);
    bv = bv * (1 + ((hb % 7) - 2.6) / 100);
    bench.push(Math.round(bv * 10) / 10);
  }
  const scale = (100 + ytd) / perf[11];
  perf = perf.map(function (x) { return Math.round(x * scale * 10) / 10; });
  const mgmtFee = pf.profile === "Dynamique" ? 1.2 : pf.profile === "Croissance" ? 1.1 : 0.95;
  return { pf, totalChf, cash, ytd, positions: pos, perf, bench, mgmtFee, ter: Math.round((mgmtFee + 0.22) * 100) / 100 };
}
export function pmsReportMd(c: any, e: any) {
  const L = ["# Rapport de gestion — " + c.name, "Profil " + e.pf.profile + " · valorisation CHF " + e.totalChf.toLocaleString("fr-CH") + " · perf YTD " + e.ytd + "% · TER " + e.ter + "%", "", "| Instrument | Qté | Prix | Valeur CHF | Poids | P&L |", "|---|---|---|---|---|---|"];
  e.positions.forEach(function (p: any) { L.push("| " + (p.name || p.isin) + " | " + p.qty.toLocaleString("fr-CH") + " | " + p.priceNow + " | " + p.valueChf.toLocaleString("fr-CH") + " | " + p.pct + "% | " + (p.pnlPct > 0 ? "+" : "") + p.pnlPct + "% |"); });
  L.push("", "Liquidités : CHF " + e.cash.toLocaleString("fr-CH") + " · Frais de gestion " + e.mgmtFee + "% p.a.", "Banque Olive Suisse — 2026-07-11");
  return L.join("\n");
}
export function pmsRebalanceFor(c: any) {
  const pf = pmsPortfolio(c);
  const e = pmsEnrich(c);
  const out: any[] = [];
  pf.positions.forEach(function (p: any) {
    const dev = (amlHash(c.id + p.ins.isin + "RBL", 11) - 5) / 2;
    if (Math.abs(dev) < 1) return;
    const chf = Math.round(Math.abs(dev) / 100 * e.totalChf);
    out.push({ isin: p.ins.isin, name: p.ins.name, ccy: p.ins.ccy || "CHF", cls: p.ins.cls, side: dev > 0 ? "SELL" : "BUY", devPts: Math.round(dev * 10) / 10, target: Math.round((p.weight - dev) * 10) / 10, current: p.weight, chf });
  });
  return out;
}
export function pmsSuitability(c: any) {
  const pf = pmsPortfolio(c);
  const e = pmsEnrich(c);
  let eq = 0, alt = 0, mx = 0;
  pf.positions.forEach(function (p: any) {
    if (/action/i.test(p.ins.cls)) eq += p.weight;
    if (/altern|structur|hedge|private/i.test(p.ins.cls)) alt += p.weight;
    if (p.weight > mx) mx = p.weight;
  });
  const cashPct = Math.round(e.cash / Math.max(1, e.totalChf) * 100);
  const maxEq = ({ "Conservateur": 30, "Équilibré": 60, "Dynamique": 85 } as any)[pf.profile] || 60;
  const checks = [
    { id: "EQ", label: "Exposition actions vs profil " + pf.profile, val: Math.round(eq) + "% (max " + maxEq + "%)", st: eq <= maxEq ? "OK" : (eq <= maxEq + 8 ? "ATTENTION" : "KO") },
    { id: "CONC", label: "Concentration par émetteur (limite 10%)", val: "position max " + Math.round(mx) + "%", st: mx <= 10 ? "OK" : (mx <= 15 ? "ATTENTION" : "KO") },
    { id: "CPLX", label: "Instruments complexes vs profil", val: Math.round(alt) + "% alternatifs/structurés", st: (pf.profile === "Conservateur" && alt > 5) ? "KO" : (alt > 20 ? "ATTENTION" : "OK") },
    { id: "CASH", label: "Liquidités (cash drag)", val: cashPct + "% du mandat", st: cashPct > 15 ? "ATTENTION" : "OK" },
    { id: "KYC", label: "Connaissance & expérience (LSFin art. 11-13)", val: "questionnaire au dossier KYC", st: "OK" },
  ];
  return { checks, worst: checks.some(function (x) { return x.st === "KO"; }) ? "KO" : (checks.some(function (x) { return x.st === "ATTENTION"; }) ? "ATTENTION" : "OK") };
}
export function pmsRiskMetrics(c: any) {
  const e = pmsEnrich(c);
  const rets: number[] = [];
  for (let i = 1; i < e.perf.length; i++) { rets.push(e.perf[i] / e.perf[i - 1] - 1); }
  const mean = rets.reduce(function (a, x) { return a + x; }, 0) / rets.length;
  const vs = rets.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / Math.max(1, rets.length - 1);
  const volM = Math.sqrt(vs);
  const volA = volM * Math.sqrt(12);
  let peak = e.perf[0], mdd = 0;
  e.perf.forEach(function (v: number) { if (v > peak) peak = v; const dd = (peak - v) / peak; if (dd > mdd) mdd = dd; });
  const var95 = 1.65 * volM * e.totalChf;
  const srri = volA < 0.005 ? 1 : volA < 0.02 ? 2 : volA < 0.05 ? 3 : volA < 0.10 ? 4 : volA < 0.15 ? 5 : volA < 0.25 ? 6 : 7;
  return { volA: Math.round(volA * 1000) / 10, mdd: Math.round(mdd * 1000) / 10, var95: Math.round(var95 / 1000) * 1000, srri };
}
