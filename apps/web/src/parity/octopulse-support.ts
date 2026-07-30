// Source : docs/reference/olive-demo.html 31470–31476 — porté verbatim.
// Connecteur Octopulse (OpRisk) + incidents opérationnels synchronisés.
import CLIENTS from "../fixtures/CLIENTS.json";

const C = CLIENTS as any[];
export const OCTOPULSE_CFG: any = { connected: true, url: "https://octopulse.banque-olive.ch", apiKey: "opk_live_••••7f2a", lastSync: "2026-07-11 06:00" };
export const OCTOPULSE_INCIDENTS: any[] = [
  { id: "OP-2214", sev: "HIGH", at: "2026-07-08", cat: "Exécution & process", what: "Double saisie d'un ordre SWIFT — annulé avant règlement", clientId: C[7] ? C[7].id : null, ameliore: "Contrôle pré-exécution Olive activé sur le desk" },
  { id: "OP-2209", sev: "MEDIUM", at: "2026-07-05", cat: "Fraude externe", what: "Tentative d'ingénierie sociale sur ligne RM — bloquée, numéro signalé", clientId: C[12] ? C[12].id : null, ameliore: "Rappel procédure call-back" },
  { id: "OP-2201", sev: "MEDIUM", at: "2026-06-28", cat: "Conformité process", what: "Visa apposé hors délai sur une revue périodique", clientId: C[3] ? C[3].id : null, ameliore: "Alerte J-5 ajoutée au workflow AR" },
  { id: "OP-2188", sev: "LOW", at: "2026-06-15", cat: "IT", what: "Indisponibilité e-banking 22 min (fenêtre nocturne dépassée)", clientId: null, ameliore: "Runbook mis à jour" },
];
