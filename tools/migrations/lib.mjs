// Cadre migrations expand/contract (R334/MG) — fonctions PURES, Node natif. Le principe :
// une migration en phase N n'AJOUTE que (expand-only) ; la suppression/rétrécissement
// (contract) vient en N+1, après que plus aucun code ne lit l'ancien. Aucune donnée détruite
// en N ; aucun UPDATE sur une table append-only, même en migration. Ces fonctions sont
// verrouillées par le harnais MG-01..05 et le runner CI.

// ── MG-01 : détection expand-only. Ordres INTERDITS en phase N (destructifs / rétrécissants). ──
const MOTIFS_DESTRUCTIFS = [
  { cle: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { cle: "DROP COLUMN", re: /\bDROP\s+COLUMN\b/i },
  { cle: "TRUNCATE", re: /\bTRUNCATE\b/i },
  { cle: "RENAME", re: /\bRENAME\s+(COLUMN|TO)\b/i },     // renommer casse le lecteur en vol
  { cle: "DROP CONSTRAINT", re: /\bDROP\s+CONSTRAINT\b/i },
  { cle: "DROP NOT NULL absent", re: /\bALTER\s+COLUMN\b[\s\S]*?\bDROP\s+DEFAULT\b/i },
  // ADD COLUMN NOT NULL SANS DEFAULT = réécriture bloquante + rejet des lignes existantes.
  { cle: "ADD COLUMN NOT NULL sans DEFAULT", re: /\bADD\s+COLUMN\b[^;]*\bNOT\s+NULL\b(?![^;]*\bDEFAULT\b)/i },
  { cle: "SET NOT NULL", re: /\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i },  // contrainte a posteriori = contract
];

// Découpe grossière en instructions (sur ';'), en ignorant les lignes de commentaire SQL.
function instructions(sql) {
  return sql
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
    .split(";").map((s) => s.trim()).filter(Boolean);
}

export function analyserExpandOnly(sql) {
  const violations = [];
  for (const inst of instructions(sql))
    for (const m of MOTIFS_DESTRUCTIFS)
      if (m.re.test(inst)) violations.push({ motif: m.cle, extrait: inst.slice(0, 80) });
  return violations;
}

// ── MG-04 : liste des tables append-only, LUE de post-deploy-v2.sql (source unique). ──
export function tablesAppendOnly(sqlPostDeploy) {
  const set = new Set(["domain_events"]);   // gardée par un trigger dédié (outbox_guard)
  const debut = sqlPostDeploy.indexOf("Immuabilité append-only");
  const fin = sqlPostDeploy.indexOf("EXECUTE format('DROP TRIGGER");
  if (debut !== -1 && fin !== -1 && fin > debut) {
    for (const m of sqlPostDeploy.slice(debut, fin).matchAll(/'([a-z][a-z_]+)'/g)) set.add(m[1]);
  }
  return set;
}

// Une migration ne doit JAMAIS muter une table append-only (UPDATE/DELETE/TRUNCATE dessus).
export function analyserMutationAppendOnly(sql, tablesAO) {
  const violations = [];
  for (const inst of instructions(sql)) {
    const mut = inst.match(/\b(UPDATE|DELETE\s+FROM|TRUNCATE)\s+(?:ONLY\s+)?"?([a-z_]+)"?/i);
    if (mut && tablesAO.has(mut[2].toLowerCase()))
      violations.push({ table: mut[2], op: mut[1].toUpperCase(), extrait: inst.slice(0, 80) });
  }
  return violations;
}

// ── MG-02 : un plan de migration DOIT porter ses requêtes de vérification (pré/post) + contract différé. ──
const SECTIONS_PLAN = ["## Pré-vérification", "## Post-vérification", "## Contract différé (N+1)"];
export function verifierPlan(planText) {
  return SECTIONS_PLAN.filter((s) => !planText.includes(s));   // sections MANQUANTES
}

// ── MG-03 : backfill idempotent à FILIGRANE (watermark). Rejouable, jamais de doublon, reprend. ──
// Renvoie les ids > filigrane (à traiter) et le nouveau filigrane. Rejouer avec le nouveau
// filigrane ne retraite RIEN (idempotence prouvée par le harnais).
export function backfillIdempotent(filigrane, ids) {
  const aTraiter = ids.filter((id) => id > filigrane).sort((a, b) => a - b);
  const nouveauFiligrane = aTraiter.length ? aTraiter[aTraiter.length - 1] : filigrane;
  return { aTraiter, nouveauFiligrane };
}

// ── Exceptions DOCUMENTÉES par migration (partagées harnais MG-05 + runner CI run-analyse) :
// clé = dossier de migration, valeur = motifs MG-01 tolérés DANS CETTE MIGRATION SEULE. Toute
// nouvelle entrée exige une justification ici — le contrôle reste intact pour toutes les autres.
// · 20260805000002_reconcile_db_push_drift : `ALTER COLUMN "id" DROP DEFAULT` (kyc_processes).
//   Résidu d'un `db push` historique — le client Prisma fournit TOUJOURS l'id (aucun writer ne
//   dépend du DEFAULT côté base), et la gate no-drift (`prisma migrate diff --exit-code`) EXIGE
//   cette ligne : la retirer recréerait la dérive que cette migration réconcilie.
export const EXCEPTIONS_MIGRATIONS = new Map([
  ["20260805000002_reconcile_db_push_drift", new Set(["DROP NOT NULL absent"])],
]);

/** Filtre les violations MG-01 couvertes par une exception documentée pour ce dossier. */
export function filtrerExceptions(dossier, violations) {
  const toleres = EXCEPTIONS_MIGRATIONS.get(dossier);
  return toleres ? violations.filter((v) => !toleres.has(v.motif)) : violations;
}
