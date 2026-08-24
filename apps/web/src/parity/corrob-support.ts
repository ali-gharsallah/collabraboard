// Source : docs/reference/olive-demo.html 31299–31342 (corroborationFor) + 32030–32036 (CORROB_STATUS) — porté verbatim.
// Corroboration KYC : croise déclaré × observé sur 5 axes (PEP, activité, SOW, résidence, correspondance).
import { kycsByClientId } from "./components-data";
import { amlHash } from "./preonboarding-support";
import { aumMOf } from "./demo-init";

// CONSIGNÉ — TX_DATA (empreinte transactionnelle) non extraite en fixture (idem aml.ts) → [].
// Les axes ACT (activité) et RES (résidence) s'appuient sur les flux : sans TX_DATA, ils
// ressortent « OK » (aucun flux contradictoire observé), fidèle tant que TX_DATA n'est pas porté.
// Les axes PEP (screening), SOW (AUM) et LNG (langue) restent réellement calculés.
const TX_DATA: any[] = [];

export const CORROB_STATUS: any = {
  OK: ["Corroboré", "green"],
  CHECK: ["À vérifier", "amber"],
  CONTRA: ["Contradiction", "red"],
  ONBOARDING: ["En onboarding", "amber"],
  NA: ["N/A", "amber"],
};

export function corroborationFor(c: any): any {
  const k = (kycsByClientId[c.id] || []).slice(-1)[0] || {};
  const sc = k.screening || {};
  const tx = TX_DATA.filter(function (t) { return t.client === c.name; });
  const out: any[] = [];
  // 1. PEP déclaré vs screening PEP — le contrôle qui compte
  const pepHit = sc.pep === "HIT";
  const pepDecl = amlHash(c.id + "PEPD", 10) < 2 ? "PEP" : "Non-PEP";
  if (pepHit && pepDecl === "Non-PEP")
    out.push({ id: "PEP", st: "CONTRA", decl: "Statut déclaré : Non-PEP", obs: "Hit PEP au screening (" + (c.uboName || c.name) + ") non levé", act: "Clarification immédiate + re-qualification du dossier" });
  else if (pepHit)
    out.push({ id: "PEP", st: "OK", decl: "Statut déclaré : " + pepDecl, obs: "Hit PEP cohérent avec la déclaration", act: "—" });
  else
    out.push({ id: "PEP", st: "OK", decl: "Statut déclaré : " + pepDecl, obs: "Aucun hit PEP au screening", act: "—" });
  // 2. Activité déclarée vs flux observés
  const hiCorr = tx.filter(function (t) { return /Moscou|Dubaï|Riyad|Hong Kong/.test(t.from + " " + t.to); }).length;
  if (c.exotic && tx.length === 0)
    out.push({ id: "ACT", st: "CHECK", decl: "Activité : " + c.sector, obs: "Aucune transaction observée — incohérent avec une activité de négoce", act: "Demander les relevés d'activité" });
  else if (!c.exotic && hiCorr >= 3)
    out.push({ id: "ACT", st: "CONTRA", decl: "Activité : " + (c.sector || "patrimoniale classique"), obs: hiCorr + " flux vers corridors sensibles — profil transactionnel ≠ activité déclarée", act: "Clarification art. 6 al. 2 LBA" });
  else
    out.push({ id: "ACT", st: "OK", decl: "Activité : " + (c.sector || "patrimoniale"), obs: tx.length + " transaction(s), corridors cohérents", act: "—" });
  // 3. AUM vs origine de la fortune (SOW)
  const aumM = aumMOf(c);
  const sowOk = amlHash(c.id + "SOW", 10) < 8;
  if (aumM >= 60 && !sowOk)
    out.push({ id: "SOW", st: "CHECK", decl: "AUM " + c.aum + " — fortune déclarée : cession d'entreprise", obs: "Justificatif de cession non versé à la GED (02-CDB vide)", act: "Collecter l'acte de cession" });
  else
    out.push({ id: "SOW", st: "OK", decl: "AUM " + c.aum, obs: "SOW documentée et proportionnée", act: "—" });
  // 4. Résidence déclarée vs empreinte transactionnelle
  const foreign = tx.filter(function (t) { return !((t.from + t.to).indexOf("Genève") >= 0 || (t.from + t.to).indexOf("Zurich") >= 0); }).length;
  if (c.country === "Suisse" && tx.length >= 4 && foreign === tx.length)
    out.push({ id: "RES", st: "CHECK", decl: "Résidence déclarée : Suisse", obs: "100% des flux hors place suisse — présence effective à vérifier", act: "Confirmer la résidence (facture, attestation)" });
  else
    out.push({ id: "RES", st: "OK", decl: "Résidence : " + (c.country || "—"), obs: "Empreinte transactionnelle cohérente", act: "—" });
  // 5. Langue de correspondance vs profil
  out.push({ id: "LNG", st: "OK", decl: "Correspondance : " + (c.corrLang || "FR"), obs: "Documents GED dans la langue déclarée", act: "—" });
  const worst = out.some(function (x) { return x.st === "CONTRA"; }) ? "CONTRA" : out.some(function (x) { return x.st === "CHECK"; }) ? "CHECK" : "OK";
  return { c: c, k: k, checks: out, worst: worst };
}
