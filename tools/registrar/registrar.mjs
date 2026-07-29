// REGISTRAR (R331/IX-01..05) — fonctions PURES d'indexation de spec/inbox/. Aucune I/O ici
// (le workflow CI fournit fichiers et dates) : testable de bout en bout, déterministe.
// Doctrine : détecter les collisions, JAMAIS renumériser ; append-only ; la ratification
// (merge) reste humaine.
import { createHash } from "node:crypto";

// Extrait les métadonnées d'un artefact : numéros de règles, familles, statut, titre.
export function extraireMeta(contenu) {
  const regles = [...new Set([...contenu.matchAll(/\bR(\d{1,4})\b/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  const familles = [...new Set([...contenu.matchAll(/\b([A-Z]{2})-\d{2}\b/g)].map((m) => m[1]))].sort();
  const statut = /statut\s*[:=]?\s*RATIFI[ÉE]/i.test(contenu) ? "RATIFIÉ"
    : /statut\s*[:=]?\s*PROPOS[ÉE]/i.test(contenu) ? "PROPOSÉ" : "PROPOSÉ";  // défaut prudent
  const titre = (contenu.match(/^#\s+(.+)$/m)?.[1] ?? "sans-titre").trim();
  return { regles, familles, statut, titre };
}

// Normalise le nom : YYYY-MM-DD-slug.md (le préfixe date vient du dépôt, jamais inventé).
export function normaliserNom(dateISO, titre) {
  const jour = String(dateISO).slice(0, 10);
  const slug = titre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${jour}-${slug}.md`;
}

// Détecte les collisions de numérotation contre l'ensemble DÉJÀ pris — RAPPORTE, ne
// renumérise JAMAIS (IX-02). Retourne les numéros en conflit.
export function detecterCollisions(regles, prisEnCharge) {
  const pris = prisEnCharge instanceof Set ? prisEnCharge : new Set(prisEnCharge);
  return regles.filter((r) => pris.has(r));
}

// Empreinte de contenu (append-only : un ratifié qui change est refusé — IX-05).
export function empreinte(contenu) { return createHash("sha256").update(contenu).digest("hex"); }

// IX-05 : refuse la modification d'un artefact déjà RATIFIÉ (nouvelle version = nouveau
// fichier chaîné, jamais une réécriture).
export function verifierAppendOnly({ statutAnterieur, empreinteAnterieure, empreinteNouvelle }) {
  if (statutAnterieur === "RATIFIÉ" && empreinteAnterieure !== empreinteNouvelle)
    throw new Error("IX-05 : artefact RATIFIÉ modifié — append-only ; déposez une NOUVELLE version chaînée");
  return true;
}

// IX-03 : le merge propage PROPOSÉ → RATIFIÉ dans l'index (l'événement = le merge, daté).
export function promouvoir(indexMd, artefactId, mergeISO) {
  const ligne = new RegExp(`(^\\|\\s*${artefactId}\\s*\\|[^\\n]*?)PROPOSÉ`, "m");
  if (!ligne.test(indexMd)) throw new Error(`artefact absent de l'index : ${artefactId}`);
  return indexMd.replace(ligne, `$1RATIFIÉ (${String(mergeISO).slice(0, 10)})`);
}

// IX-04 : un artefact PROPOSÉ non mergé depuis N jours est « en attente » (l'oubli est
// impossible, pas seulement improbable). Retourne les jours écoulés.
export function enAttenteDepuis(depotISO, nowISO) {
  return Math.floor((Date.parse(nowISO) - Date.parse(depotISO)) / 86400000);
}

// IX-01 : produit l'entrée d'index « PROPOSÉ » d'un artefact fraîchement déposé.
export function ligneIndex({ id, titre, regles, familles, statut, depotISO }) {
  return `| ${id} | ${titre} | ${regles.map((r) => "R" + r).join(", ") || "—"} | `
    + `${familles.join(", ") || "—"} | ${statut} | ${String(depotISO).slice(0, 10)} |`;
}
