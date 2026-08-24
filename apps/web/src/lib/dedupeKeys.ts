// R-FB.4 — invariant clés uniques (spec/SPEC-FILTERBAR.md, R404).
// Garde-fou défensif : toute liste rendue doit avoir des clés React uniques. Quand une source
// contient des doublons (ex. bug E-FB-1 : codes AML-10/11/12 dupliqués), on déduplique par un
// suffixe déterministe `#n` ET on émet un `console.warn` pointant la source — le système NOTIFIE,
// il ne masque pas (esprit R39). Le warn est un ÉCART à corriger à la source, pas le correctif :
// en parcours nominal (source saine), aucun warn n'est émis.

export interface DedupeResult<T> {
  /** Items dans l'ordre d'origine, chacun doté d'une clé unique stable. */
  items: Array<{ item: T; key: string }>;
  /** Clés brutes en collision (avant suffixe), triées — vide si la source est saine. */
  collisions: string[];
}

/**
 * Rend chaque item une clé unique à partir de `keyOf`. Les collisions reçoivent un suffixe
 * déterministe `#n` (n = rang d'apparition, 1-based à partir de la 2e occurrence) et déclenchent
 * un `console.warn` unique par clé, préfixé par `label` (la source à corriger).
 */
export function dedupeKeys<T>(
  items: readonly T[],
  keyOf: (item: T, index: number) => string,
  label = "liste",
): DedupeResult<T> {
  const seen = new Map<string, number>();
  const collisionSet = new Set<string>();
  const out: Array<{ item: T; key: string }> = [];

  items.forEach((item, i) => {
    const raw = String(keyOf(item, i));
    const n = seen.get(raw) || 0;
    seen.set(raw, n + 1);
    if (n === 0) {
      out.push({ item, key: raw });
    } else {
      collisionSet.add(raw);
      out.push({ item, key: raw + "#" + n });
    }
  });

  const collisions = Array.from(collisionSet).sort();
  if (collisions.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[R-FB.4] clés dupliquées dans « ${label} » : ${collisions.join(", ")} — ` +
        "corriger la source (codes uniques), la déduplication #n n'est qu'un filet.",
    );
  }
  return { items: out, collisions };
}

/** Vrai ssi `keyOf` produit des clés toutes uniques (sans émettre de warn) — pour les tests corpus. */
export function keysAreUnique<T>(items: readonly T[], keyOf: (item: T, index: number) => string): boolean {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const k = String(keyOf(items[i], i));
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}
