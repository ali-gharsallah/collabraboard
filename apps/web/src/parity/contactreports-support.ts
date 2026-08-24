// Source : docs/reference/olive-demo.html 21336–21438 — porté verbatim.
// CRM Contact Reports : libellés de champs, canaux, génération déterministe des CR (amlHash),
// cas similaires, rédaction assistée.
import CLIENTS from "../fixtures/CLIENTS.json";
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";
import { clientById } from "./components-data";
import { amlHash } from "./preonboarding-support";

export const FIELD_LABELS: Record<string, Record<string, string>> = {
  contactReport: { client: "Client", person: "Personne contactée", channel: "Canal", subject: "Sujet", notes: "Notes brutes (puces)", draft: "Compte-rendu rédigé" },
  nextBestAction: { client: "Client", signal: "Signal détecté", action: "Action proposée", emailSubject: "Objet de l'email", emailBody: "Corps de l'email" },
  ocrImport: { docType: "Type de document", fileName: "Fichier (simulation)", extracted: "Champs extraits" },
  preonboarding: { name: "Nom (optionnel)", countryCode: "Pays / juridiction", type: "Structure", sector: "Secteur d'activité", aum: "AUM estimé (CHF M)", pep: "Client PEP" },
  groupReview: { group: "Groupe (UBO commun)", members: "Membres du groupe", trigger: "Motif de déclenchement" },
};
export function fl(screenId: string, fieldKey: string) {
  return (FIELD_LABELS[screenId] && FIELD_LABELS[screenId][fieldKey]) || fieldKey;
}

export const CONTACT_REPORT_CHANNELS = ["Rendez-vous", "Appel téléphonique", "Business Trip", "Email", "Vidéoconférence"];

export const CONTACT_REPORTS: any[] = (function () {
  const picks = [
    ["CLI-00072", "PER-263", "Risque AML élevé", "Point sur la revue AML en cours, client rassuré sur le délai"],
    ["CLI-00016", "PER-026", "Rendez-vous", "Discussion allocation portefeuille, intérêt pour le private equity"],
    ["CLI-00005", "PER-108", "Business Trip", "Visite à Paris, présentation offre Lombard"],
    ["CLI-00193", "PER-025", "Appel téléphonique", "Confirmation des coordonnées, RAS"],
    ["CLI-00018", "PER-214", "Rendez-vous", "Revue annuelle patrimoniale, souhaite diversifier"],
    ["CLI-00164", "PER-128", "Email", "Envoi documentation crédit lombard suite à sa demande"],
    ["CLI-00034", "PER-134", "Vidéoconférence", "Point sur la structure offshore, EDD en cours"],
    ["CLI-00099", "PER-252", "Appel téléphonique", "Client injoignable à deux reprises — à relancer"],
  ];
  return picks.map(function (p, i) {
    const c = (CLIENTS as any[]).find(function (x) { return x.id === p[0]; });
    const pr = (PERSONS_DATA as any[]).find(function (x) { return x.id === p[1]; });
    if (!c) return null;
    return { id: "CR-" + String(3001 + i), clientId: c.id, personId: pr ? pr.id : null, personName: pr ? pr.name : c.uboName,
      channel: p[2], date: "2026-0" + (3 + (i % 5)) + "-1" + (i % 9), rm: c.rm, subject: p[2] === "Business Trip" ? "Visite client" : p[2],
      notes: p[3], draft: null };
  }).filter(Boolean);
})();
// Expandeur CRM : ~60% des clients reçoivent 1-3 contacts sur 12 mois, avec prochaine action datée
// pour la moitié — certaines déjà échues (relances).
(function expandContactReports() {
  const CHANNELS = ["Rendez-vous", "Appel téléphonique", "Email", "Visioconférence", "Business Trip"];
  const SUBJECTS = ["Revue de portefeuille", "Point compliance / documents", "Prospection produit", "Suivi succession / famille", "Mise à jour KYC", "Revue annuelle"];
  const NEXTS = ["Envoyer proposition d'allocation", "Collecter justificatif SOW", "Planifier revue annuelle", "Faire signer l'auto-certification CRS", "Rappeler après le conseil de famille", "Proposer mandat discrétionnaire"];
  let seq = 4001;
  (CLIENTS as any[]).forEach(function (c) {
    const h = amlHash(c.id + "CRM", 10);
    if (h >= 6) return;
    const n = 1 + amlHash(c.id + "CRN", 3);
    for (let i = 0; i < n; i++) {
      const hh = amlHash(c.id + "CRX" + i, 1000);
      const mo = 1 + (hh % 12), da = 1 + (hh % 27);
      const date = (mo > 7 ? "2025-" : "2026-") + String(mo).padStart(2, "0") + "-" + String(da).padStart(2, "0");
      const hasNext = amlHash(c.id + "CRNX" + i, 10) < 5;
      const nm = 1 + (hh % 11), nd = 1 + (hh % 25);
      const nextDate = hasNext ? ("2026-" + String(Math.min(12, nm)).padStart(2, "0") + "-" + String(nd).padStart(2, "0")) : null;
      CONTACT_REPORTS.push({ id: "CR-" + (seq++), clientId: c.id, personId: null, personName: c.uboName,
        channel: CHANNELS[hh % CHANNELS.length], date, rm: c.rm, subject: SUBJECTS[hh % SUBJECTS.length],
        notes: "Compte-rendu consigné au dossier — " + SUBJECTS[hh % SUBJECTS.length].toLowerCase() + ".",
        nextStep: hasNext ? NEXTS[hh % NEXTS.length] : null, nextDate, nextDone: false, draft: null });
    }
  });
})();

export function similarContactReports(client: any, subject: string) {
  if (!client) return [];
  return CONTACT_REPORTS.filter(function (r) {
    const c2 = (clientById as any)[r.clientId];
    return r.clientId !== client.id && c2 && (c2.sector === client.sector || c2.segment === client.segment || r.subject === subject);
  }).slice(0, 3);
}
export function draftContactReport(rawNotes: string, client: any, _kyc: any, personName: string | null) {
  const lines = (rawNotes || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  const bullets = lines.length ? lines.map(function (l) { return "• " + l; }).join("\n") : "• (aucune note saisie)";
  const sim = similarContactReports(client, "");
  const advice = sim.length
    ? ("Contexte : " + sim.length + " contact(s) similaire(s) sur des clients " + ((client && client.sector) || "du même secteur") + " — pattern observé : " + sim.map(function (r) { return r.subject; }).join(", ") + ".")
    : "Aucun cas similaire récent dans l'historique.";
  const riskNote = (client && client.risk === "HIGH") ? " Client à risque élevé — s'assurer que le contenu de l'échange reste documenté conformément à la diligence EDD." : "";
  return "Compte-rendu — " + ((client && client.name) || "—") + (personName ? (" (interlocuteur : " + personName + ")") : "") + "\n\n" + bullets + "\n\n" + advice + riskNote;
}
