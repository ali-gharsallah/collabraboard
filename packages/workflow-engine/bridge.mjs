// Pont JSON-lines sur le moteur JS (workflow actuel) — protocole canonique
// partagé avec l'adaptateur Python. stdin: 1 commande JSON/ligne ; stdout: 1 réponse.
import { WorkflowEngine } from "./src/engine.mjs";
import * as readline from "node:readline";

const FINAL = "__FINAL__";
let e = null;
const norm = v => v == null ? null : String(v);
function snapshot(id) {
  const d = e.d(id);
  const sections = {};
  const FINAL_ETAT = { AUCUN: "EN_PREPARATION", EN_ATTENTE: "SOUMISE", ACCORDE: "VISEE" };
  for (const [nom, s] of d.sections) {
    const visa = s.visa ? norm(s.visa.status) : "AUCUN";
    sections[nom] = { etat: nom === FINAL
      ? (FINAL_ETAT[visa] ?? "EN_PREPARATION") : norm(s.state), visa };
  }
  return { sections };
}
function regleDe(msg) {
  const m = /R(\d+)/.exec(msg); if (m) return "R" + m[1];
  if (/4-yeux/.test(msg)) return "R13";
  if (/motivation/i.test(msg)) return "R7";
  if (/révocation/.test(msg)) return "R9";
  if (/conjointe/.test(msg)) return "R14";
  return null;
}
function exec(c) {
  switch (c.cmd) {
    case "init": e = new WorkflowEngine({ tenantConfig: c.config ?? {
      suspensionRestrictions: { inflows: true, outflows: false, notifyClient: false } } });
      return {};
    case "creer": e.createDossier(c.id, { sections: c.sections.map(s => ({
        id: s.id, label: s.label, validator: s.validator, relay: s.relay })),
      finalValidator: c.final, personId: c.personId ?? null }); return {};
    case "modifier": e.editField(c.acteur, c.id, c.section, c.champ); return {};
    case "soumettre": e.submitForVisa(c.id, c.section); return {};
    case "accorder": e.grantVisa(c.acteur, c.id, c.section === "FINAL" ? FINAL : c.section,
      "", { engagement: c.engagement === true }); return {};
    case "accorder_derogation": e.grantVisaByDerogation(c.acteur, c.id, c.section,
      { decideur: c.decideur, fichePoste: c.fichePoste }); return {};
    case "refuser": e.refuseVisa(c.acteur, c.id, c.section, c.motivation); return {};
    case "absent": e.declareAbsent(c.validateur); return {};
    case "revoquer": e.revokeVisa(c.acteur, c.id, c.section); return {};
    case "annuler_vice": e.annulForProcessVice({ by: c.decideurs }, c.id, c.section, c.motif); return {};
    case "alerte": e.attachScreeningAlert(c.id, c.alerte); return {};
    case "mros": e.suspendForMros(c.id); return {};
    case "op": return { valeur: e.operationAllowed(c.id, c.sens === "entree" ? "IN" : "OUT") };
    case "rejeter": e.reject(c.id, c.motif); return {};
    default: throw new Error("commande inconnue " + c.cmd);
  }
}
const rl = readline.createInterface({ input: process.stdin });
rl.on("line", line => {
  if (!line.trim()) return;
  const c = JSON.parse(line);
  if (c.cmd === "fin") process.exit(0);
  let out;
  try { const extra = exec(c) ?? {};
    out = { ok: true, regle: null, ...extra,
      ...(c.id && c.cmd !== "init" ? { snapshot: snapshot(c.id) } : {}) };
  } catch (err) {
    out = { ok: false, regle: regleDe(String(err.message)), msg: String(err.message).slice(0, 120),
      ...(c.id ? (() => { try { return { snapshot: snapshot(c.id) }; } catch { return {}; } })() : {}) };
  }
  process.stdout.write(JSON.stringify(out) + "\n");
});
