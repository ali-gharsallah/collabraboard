/**
 * UI v2 — LES ACTES ORDINAIRES (V2-M33).
 *
 * Doctrine de ce lot : un bouton qui ne fait rien ment. Il promet une capacité, occupe la
 * place où l'utilisateur la cherchera, et fait passer l'écran pour plus avancé qu'il n'est.
 * Tout contrôle de l'UI v2 mène donc à quelque chose — naviguer, ouvrir, filtrer, exporter —
 * et la garde U2-55 rougit si un `onOpen={() => undefined}` ou un `<Ui2Bouton>` sans `onClick`
 * réapparaît dans `src/ui2`.
 *
 * Ce que ces actes ne font PAS : décider. Exporter ce qui est déjà à l'écran est une lecture,
 * pas un acte métier (R44) — les actes métier restent portés par les barres d'actes, qui
 * nomment leur garde et leur route.
 */

/** Échappement CSV : guillemets doublés, champ cité dès qu'il contient un séparateur. */
function champCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export CSV de ce qui est DÉJÀ affiché — aucune requête, aucune donnée nouvelle. Le
 * séparateur est le point-virgule (Excel en locale francophone) et un BOM UTF-8 précède le
 * contenu, sans quoi les accents ressortent cassés à l'ouverture.
 */
export function exporterCsv(nomFichier: string, entetes: string[], lignes: unknown[][]): void {
  const corps = [entetes, ...lignes].map((l) => l.map(champCsv).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + corps], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier.endsWith(".csv") ? nomFichier : `${nomFichier}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Horodatage de nom de fichier — stable, lisible, triable. */
export function jourFichier(d: Date = new Date()): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
