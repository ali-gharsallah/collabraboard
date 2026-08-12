import { BadRequestException } from "@nestjs/common";

/**
 * IDENTIFIANTS — un identifiant malformé produit un refus TYPÉ, jamais un 500 (V2-M44).
 *
 * D'où ça vient : le balayage d'exécution des 24 actes déclarés par les écrans, contre une API
 * vivante, a rendu cinq **500 Internal server error**. Quatre fois sur cinq la cause est la
 * même — un identifiant venu de la requête (`CLI-00001`, `u-marc`) atteint un `where` Prisma
 * sur une colonne UUID et le driver lève une erreur brute, qui remonte en 500.
 *
 * Ce n'est pas cosmétique. L'écran rend le message du moteur VERBATIM (FE-04) : sur un 500 il
 * affiche « Internal server error », c'est-à-dire le contraire d'un refus opposable. Et
 * n'importe quel appelant peut le déclencher — il suffit d'un identifiant recopié à la main.
 *
 * OÙ L'APPELER, et où surtout PAS. Au point où l'identifiant est LU pour interroger la base,
 * jamais en tête de méthode : la précédence des refus est un comportement contractuel (garde
 * métier d'abord — R7 motif, R13 quatre yeux — puis lecture). Poser cette validation trop tôt
 * transformerait « R7 : motif requis » en « identifiant invalide », et ferait mentir la garde.
 */

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const estUuid = (v: unknown): boolean => typeof v === "string" && MOTIF_UUID.test(v);

/**
 * Rend l'identifiant s'il est un UUID, sinon refuse en NOMMANT l'objet attendu ET la valeur
 * reçue. Nommer la valeur n'est pas un luxe : c'est ce qui permet à celui qui lit le refus de
 * comprendre qu'il a collé une référence d'écran là où le moteur attend une clé technique.
 */
export function uuidOuRefus(valeur: unknown, quoi: string): string {
  if (estUuid(valeur)) return valeur as string;
  const vu = valeur === undefined ? "(absent)" : valeur === null ? "(null)"
    : typeof valeur === "string" ? `« ${valeur} »` : `(${typeof valeur})`;
  throw new BadRequestException(
    `identifiant de ${quoi} invalide : ${vu} n'est pas un identifiant technique (UUID attendu)`);
}
