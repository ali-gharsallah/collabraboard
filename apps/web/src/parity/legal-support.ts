// Source : docs/reference/olive-demo.html 31340–31404 — porté verbatim.
// Legal — contrathèque & génération (type Legisway), relié au golden record et à la GED.
import CLIENTS from "../fixtures/CLIENTS.json";
import { amlHash } from "./preonboarding-support";
import { pmsPortfolio, pmsEnrich } from "./pms-support";

// CONSIGNÉ — GED_DOCS (documents GED, source 30297) non porté → tableau local vide.
// L'onglet « Générer » alimente cette file locale au lieu de la vraie GED ; la contrathèque
// et l'échéancier fonctionnent pleinement. À rebrancher au portage de l'écran GED vivante.
export const GED_DOCS: any[] = [];

export const LEGAL_TYPES: [string, string][] = [["MANDAT", "Mandat de gestion discrétionnaire"], ["CONSEIL", "Contrat de conseil en placement"], ["LOMBARD", "Contrat-cadre crédit Lombard"], ["EBANK", "Convention e-banking"], ["NDA", "Accord de confidentialité"], ["APPORTEUR", "Convention d'apporteur d'affaires"]];
export const LEGAL_STATUS: any = { DRAFT: ["Brouillon", "inkSoft"], NEGO: ["En négociation", "amber"], SIGNED: ["Signé", "blue"], ACTIVE: ["Actif", "green"], EXPIRING: ["Échéance proche", "amber"], TERMINATED: ["Résilié", "red"] };
export const LEGAL_CONTRACTS: any[] = (function () {
  const out: any[] = [];
  (CLIENTS as any[]).slice(0, 45).forEach(function (c) {
    const n = 1 + amlHash(c.id + "LGN", 3);
    for (let i = 0; i < n; i++) {
      const t = LEGAL_TYPES[amlHash(c.id + "LGT" + i, LEGAL_TYPES.length)];
      const h = amlHash(c.id + "LGS" + i, 100);
      const st = h < 8 ? "DRAFT" : h < 16 ? "NEGO" : h < 26 ? "EXPIRING" : h < 90 ? "ACTIVE" : "TERMINATED";
      const expM = 1 + amlHash(c.id + "LGE" + i, 24);
      out.push({ id: "CTR-" + (4000 + out.length), clientId: c.id, type: t[0], label: t[1], status: st,
        signedAt: "202" + (3 + amlHash(c.id + "LGY" + i, 3)) + "-0" + (1 + amlHash(c.id + "LGM" + i, 9)) + "-1" + (amlHash(c.id + "LGD" + i, 9)),
        expiresAt: st === "EXPIRING" ? ("2026-0" + (8 + amlHash(c.id + "LGX" + i, 2)) + "-0" + (1 + amlHash(c.id + "LGZ" + i, 9))) : ("202" + (6 + Math.floor(expM / 12)) + "-" + String(1 + (expM % 12)).padStart(2, "0") + "-15"),
        autoRenew: amlHash(c.id + "LGR" + i, 10) < 6, lang: c.corrLang || "FR", version: 1 + amlHash(c.id + "LGV" + i, 3) });
    }
  });
  return out;
})();
export function legalGenerate(c: any, typeId: string, user: any): string {
  const t = LEGAL_TYPES.find(function (x) { return x[0] === typeId; }) || LEGAL_TYPES[0];
  const L = ["# " + t[1], "", "Entre **Banque Olive Suisse SA**, Genève, et **" + c.name + "** (" + c.id + "), " + (c.country || "—") + ", ci-après « le Client ».", "",
    "**Art. 1 — Objet.** " + (typeId === "MANDAT" ? "Le Client confie à la Banque la gestion discrétionnaire de ses avoirs, profil " + pmsPortfolio(c).profile + ", dans le respect des restrictions convenues." : typeId === "LOMBARD" ? "La Banque met à disposition une ligne de crédit garantie par nantissement du portefeuille (LTV selon annexe risques)." : "Prestations définies aux conditions particulières."),
    "**Art. 2 — Rémunération.** Selon la brochure tarifaire en vigueur ; frais de gestion " + (typeId === "MANDAT" ? pmsEnrich(c).mgmtFee + "% p.a." : "selon barème") + ".",
    "**Art. 3 — Langue & correspondance.** Le présent contrat est établi en " + (({ FR: "français", EN: "anglais", DE: "allemand", IT: "italien" } as any)[c.corrLang || "FR"]) + " ; les communications suivent la langue de correspondance du dossier.",
    "**Art. 4 — Droit applicable & for.** Droit suisse ; for exclusif : Genève. LSFin/LEFin, CDB 20 et LBA demeurent réservées.",
    "", "Relationship Manager : " + (c.rm || "—") + " · Généré par " + ((user && user.name) || "—") + " le 2026-07-11 · v1 (données du golden record)"];
  return L.join("\n");
}
