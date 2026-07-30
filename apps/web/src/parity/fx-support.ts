// Source : docs/reference/olive-demo.html 31680–31691 — porté verbatim.
// Moteur FX déterministe : fixings vs CHF + historisation 12 mois (amlHash).
import { amlHash } from "./preonboarding-support";

export const FX_CCYS = ["CHF", "EUR", "USD", "GBP", "JPY", "SGD", "AED"];
export const FX_BASE: Record<string, number> = { EUR: 0.93, USD: 0.87, GBP: 1.10, JPY: 0.0055, SGD: 0.645, AED: 0.237, CHF: 1 };
export function fxRate(ccy: string, monthIdx?: number) {
  const b = FX_BASE[ccy] || 1;
  if (ccy === "CHF") return 1;
  const m = (monthIdx === undefined) ? 11 : monthIdx;
  const wob = Math.sin((amlHash(ccy + "FX", 628) / 100) + m * 0.7) * 0.03 + (amlHash(ccy + "FD" + m, 100) - 50) / 2500;
  return Math.round(b * (1 + wob) * 10000) / 10000;
}
export function fxHistory(ccy: string) { const out: number[] = []; for (let i = 0; i < 12; i++) out.push(fxRate(ccy, i)); return out; }
