/**
 * Pagination keyset (A4, audit-architecture). Les portes de LISTE récentes (tasks, trips, nba,
 * workflow-instances) renvoyaient TOUT le tenant : scan + payload non bornés au volume. On borne
 * par défaut et on expose un curseur keyset stable sur (createdAt DESC, id DESC).
 *
 * ⚠ Comportement PRÉSERVÉ : le défaut (`DEFAULT_PAGE`) est au-dessus de toute fixture e2e, donc
 * aucune liste testée n'est tronquée (mêmes lignes, même ordre). L'ajout des paramètres `limit`/
 * `cursor` est ADDITIF — sans eux, le contrat est identique (tableau brut, ordre createdAt desc).
 * Le client construit le curseur suivant depuis la dernière ligne rendue : `${createdAt}|${id}`.
 *
 * ⚠ Écart signalé (ECARTS-FRONT) : pour les colonnes `createdAt` de type DateTime (trips, kycFile),
 * l'ORM ne restitue que la milliseconde (le µs Postgres est perdu au passage en Date JS), donc le
 * curseur est à granularité MS. Ces agrégats sont créés à cadence HUMAINE (jamais deux dans la même
 * ms d'un même tenant), le keyset est donc exact en pratique ; pour tasks/nba (`createdAt` String) il
 * est exact par construction. La borne par défaut (`limit`), elle, est toujours exacte.
 */

export const DEFAULT_PAGE = 200; // borne de sécurité, > toute liste de test ; protège au volume
export const MAX_PAGE = 500;

export type PageParams = { limit?: string; cursor?: string };

const clampLimit = (limit?: string): number => {
  const n = limit != null ? Number(limit) : DEFAULT_PAGE;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE;
  return Math.min(Math.floor(n), MAX_PAGE);
};

const decodeCursor = (cursor: string): [string, string] => {
  const i = cursor.lastIndexOf("|");
  return i < 0 ? [cursor, ""] : [cursor.slice(0, i), cursor.slice(i + 1)];
};

/**
 * Mute `where` avec le fragment keyset (page suivante en ordre createdAt desc, id desc) et retourne
 * le `take` à appliquer. Sans `cursor`, seul `take` borne (première page). Le keyset s'AND avec les
 * filtres existants au niveau supérieur de `where` (tenantId, statut, …), sans les écraser.
 */
export function applyKeyset(where: any, p: PageParams): number {
  const take = clampLimit(p.limit);
  if (p.cursor) {
    const [cAt, cId] = decodeCursor(p.cursor);
    const keyset = { OR: [{ createdAt: { lt: cAt } }, { createdAt: cAt, id: { lt: cId } }] };
    const prev = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
    where.AND = [...prev, keyset];
  }
  return take;
}
