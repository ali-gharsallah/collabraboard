// Source : docs/reference/olive-demo.html 31419–31469 — porté verbatim.
// Exécution & Settlement : tout ordre (paiement/titres) tokenisé en ordre de règlement —
// jeton unique, hachage chaîné, cycle CREATED→VALIDATED→SENT→SETTLED, jambes cash/titres (DVP).
import CLIENTS from "../fixtures/CLIENTS.json";
import { amlHash } from "./preonboarding-support";
import { PMS_UNIVERSE } from "./pms-support";
import { TRANSFER_ORDERS } from "./transfers-support";

export function settleHash(x: string): string { const h = amlHash("STLH|" + x, 4294967296); return ("00000000" + h.toString(16)).slice(-8) + ("00000000" + amlHash("STLH2|" + x, 4294967296).toString(16)).slice(-8); }
export const STL_STATUS: any = { CREATED: ["Créé", "inkSoft"], VALIDATED: ["Validé", "blue"], SENT: ["Envoyé", "amber"], SETTLED: ["Réglé", "green"], FAILED: ["Échec", "red"] };
export const STL_NEXT: any = { CREATED: "VALIDATED", VALIDATED: "SENT", SENT: "SETTLED" };
export function settleTokenize(src: any): any {
  const base = src.kind === "SEC" ? (src.id + src.isin + src.qty) : (src.id + src.beneficiary + src.amt);
  const prev = settleHash("GENESIS|" + base);
  const tok = "STL-2026-" + settleHash(base).slice(0, 10).toUpperCase();
  const legs = src.kind === "SEC"
    ? [{ type: "TITRES", detail: (src.side === "BUY" ? "Achat " : "Vente ") + src.qty.toLocaleString("fr-CH") + " × " + src.name + " (" + src.isin + ")", via: "SIX SIS · T+2" },
      { type: "CASH", detail: "Contre-valeur " + src.ccy + " " + src.cash.toLocaleString("fr-CH") + " — DVP", via: "SIC" }]
    : [{ type: "CASH", detail: src.cur + " " + (src.amt * 1000000).toLocaleString("fr-CH") + " → " + src.beneficiary, via: src.type || "SWIFT", cutoff: src.type === "SIC" ? "15:00 CET" : "16:00 CET" }];
  return { token: tok, hash: settleHash(base), prevHash: prev, legs: legs };
}
let SETTLEMENT_ORDERS: any[] | null = null;
export function settleOrders(): any[] {
  if (SETTLEMENT_ORDERS)
    return SETTLEMENT_ORDERS;
  SETTLEMENT_ORDERS = (function () {
    const out: any[] = [];
    // Titres — dérivés des mandats (ordres du jour)
    ([["BUY", 2], ["SELL", 7], ["BUY", 11], ["SELL", 15]] as [string, number][]).forEach(function (x, i) {
      const ins = (PMS_UNIVERSE as any[])[x[1]];
      const c = (CLIENTS as any[])[5 + i * 7];
      if (!ins || !c)
        return;
      const qty = 100 + amlHash(c.id + "SQ", 4000);
      const px = 20 + amlHash(ins.isin + "SP", 480);
      const src: any = { kind: "SEC", id: "ORD-S-" + (300 + i), side: x[0], isin: ins.isin, name: ins.name, qty: qty, ccy: ins.ccy || "CHF", cash: qty * px, clientId: c.id };
      const t = settleTokenize(src);
      out.push(Object.assign({}, src, t, { status: ["SETTLED", "SENT", "VALIDATED", "CREATED"][i], at: "2026-07-" + (8 + i) }));
    });
    // Paiements — chaque ordre de transfert exécuté ou en cours devient un ordre de règlement
    (TRANSFER_ORDERS as any[]).forEach(function (o, i) {
      if (o.status === "BLOCKED" || o.status === "REJECTED")
        return;
      const src = Object.assign({ kind: "PAY" }, o);
      const t = settleTokenize(src);
      out.push(Object.assign({ kind: "PAY", id: o.id, beneficiary: o.beneficiary, amt: o.amt, cur: o.cur, type: o.type, clientId: o.clientId, clientName: o.clientName }, t, { status: o.status === "EXECUTED" ? (i % 2 ? "SETTLED" : "SENT") : "CREATED", at: "2026-07-1" + (i % 2) }));
    });
    return out;
  })();
  return SETTLEMENT_ORDERS;
}
