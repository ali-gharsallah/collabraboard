// ═══ Bloc E robustesse (R339/EV) — VERSIONING & UPCASTING des événements ═════════════════════
// Un événement stocké en 2026 (v1) doit rester lisible quand le schéma de payload aura évolué.
// L'événement stocké n'est JAMAIS réécrit (append-only, R48) : l'upcast se fait À LA LECTURE.
// Registre de fonctions PURES `payload → payload`, chaînables (v1→v2→v3), par (type, fromVersion).
// Désérialisation CENTRALISÉE : un seul chemin (deserialiser) — aucun autre dans le code.

export type Payload = Record<string, unknown>;
export type Upcaster = (p: Payload) => Payload;

// Clé « type@fromVersion » → upcaster qui produit la version fromVersion+1.
const REGISTRE: Record<string, Upcaster> = {};

export function enregistrerUpcaster(type: string, fromVersion: number, fn: Upcaster, registre = REGISTRE): void {
  const cle = `${type}@${fromVersion}`;
  if (registre[cle]) throw new Error(`upcaster déjà enregistré : ${cle} (les upcasters sont immuables)`);
  registre[cle] = fn;
}

// Version cible = plus haute version atteignable par chaînage depuis v1 (1 s'il n'y a aucun upcaster).
export function versionCible(type: string, registre = REGISTRE): number {
  let v = 1;
  while (registre[`${type}@${v}`]) v++;
  return v;
}

// LECTURE unique : applique la chaîne d'upcasters de eventVersion jusqu'à la version cible.
export function deserialiser(
  evt: { type: string; payload: Payload; eventVersion?: number }, registre = REGISTRE,
): { type: string; version: number; payload: Payload } {
  const cible = versionCible(evt.type, registre);
  let v = evt.eventVersion ?? 1;
  let payload = evt.payload;
  while (v < cible) {
    const up = registre[`${evt.type}@${v}`];
    if (!up) throw new Error(`chaîne d'upcast rompue : ${evt.type}@${v} manquant`);
    payload = up(payload); v++;
  }
  return { type: evt.type, version: cible, payload };
}

// Réservé aux tests : vide le registre (déterminisme d'un cas à l'autre).
export function _reinitRegistre(): void { for (const k of Object.keys(REGISTRE)) delete REGISTRE[k]; }
