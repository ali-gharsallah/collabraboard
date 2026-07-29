import { T } from "./tokens";
import KYCS_DATA from "../fixtures/KYCS_DATA.json";

// Helpers KYC — PORT VERBATIM (wfNomenclature 14663, wfNomColor/Bg 14670, kycTypeOf 16520,
// WF_RULE_PARAMS/wfTier/wfTriage 15625, latestKycFor/nextRevisionFor 16618–16625).

export function wfNomenclature(k: any) {
  const pep = (k.tags || []).indexOf("PEP-Hit") >= 0 || ((k.screening || {}).pep === "HIT");
  const fam = (k.revision || 1) > 1 ? ["SKW", "HKW", "PKW"] : ["SOW", "HOW", "POW"];
  const code = pep ? fam[2] : (k.risk === "HIGH" ? fam[1] : fam[0]);
  return { code, label: code, tier: k.workflow || "" };
}
export const wfNomColor = (code: string) => code[0] === "P" ? T.violet : code[0] === "H" ? T.red : T.green;
export const wfNomBg = (code: string) => code[0] === "P" ? T.violetSoft : code[0] === "H" ? T.redSoft : T.greenSoft;
export const kycTypeOf = (k: any) => (k && k.kycType) || (k && k.revision === 1 ? "ONBOARDING" : "REVIEW");

export const WF_RULE_PARAMS = { WR0: { sdd: 33, cdd: 66 }, WR3: { aumM: 100 } };
export function wfTier(score: number | null) {
  const s = score == null ? 50 : score; const p = WF_RULE_PARAMS.WR0;
  return s <= p.sdd ? "SDD" : s <= p.cdd ? "CDD" : "EDD";
}
export function wfTriage(ctx: any) {
  ctx = ctx || {};
  const score = ctx.score != null ? ctx.score : (ctx.risk === "LOW" ? 20 : ctx.risk === "MEDIUM" ? 50 : 80);
  const tier = wfTier(score);
  const isOnboarding = (ctx.revision == null || ctx.revision <= 1) && !ctx.previousKycId;
  const defLabel = isOnboarding ? "KYC — Entrée en relation (onboarding)" : "Account Review — revue périodique / 2e KYC";
  return { score, tier, wfType: isOnboarding ? "ONBOARDING" : "REVIEW", defId: isOnboarding ? "KYC_STD" : "ACCOUNT_REVIEW", defLabel };
}

const kycs = KYCS_DATA as any[];
export const latestKycFor = (cid: string) => { const mine = kycs.filter(k => k.clientId === cid); return mine.length ? mine[mine.length - 1] : null; };
export const nextRevisionFor = (cid: string) => { const lk = latestKycFor(cid); return lk ? (lk.revision || 1) + 1 : 1; };
