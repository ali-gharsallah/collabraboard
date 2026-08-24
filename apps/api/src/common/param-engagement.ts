import { BadRequestException, ConflictException } from "@nestjs/common";
import { emitEvent } from "./domain-event";
import { Tx } from "./tx";

/**
 * Mécanisme COMMUN du pop-up d'engagement de responsabilité (repo R445, né au Bloc 62 ;
 * généralisé aux §BusinessTrip (R452) et §CrossBorder (R462) par les Blocs 63/64 —
 * doctrine du drop : « RÉUTILISER le mécanisme, ne pas le dupliquer, l'étendre »).
 *
 * Contrat : un registre de paramètres gouverné par date = DÉFAUTS (+ base tenant) + REJEU
 * des PARAM_CHANGED de son agrégat (append-only R49, résolution R48/R29). Toute
 * modification SANS confirmation → 409 portant le payload exact du pop-up ; AVEC →
 * PARAM_CHANGED complet (ancien/nouveau, auteur, engagement, portée), jamais d'écriture
 * partielle. La création d'une clé est autorisée UNIQUEMENT sous un parent existant
 * (ex. un override par RM sous `quotasOverridesRM`) — ancien = null, tracé tel quel.
 */

export const poserCle = (obj: any, cle: string, valeur: any) => {
  const parts = cle.split(".");
  let c = obj;
  for (const p of parts.slice(0, -1)) c = c[p] ?? (c[p] = {});
  c[parts[parts.length - 1]] = valeur;
};
export const lireCle = (obj: any, cle: string) => cle.split(".").reduce((a, p) => a?.[p], obj);

/** Fusion profonde SANS mutation — les objets simples fusionnent, tout le reste remplace. */
export const fusionProfonde = (base: any, sur: any): any => {
  if (!sur || typeof sur !== "object" || Array.isArray(sur)) return sur ?? base;
  const out: any = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const k of Object.keys(sur)) out[k] = fusionProfonde(out[k], sur[k]);
  return out;
};

/** Résolution à date : base (défauts ∪ config tenant) + rejeu PARAM_CHANGED ≤ aDate. */
export async function resoudreParametresGouvernes(prisma: any, tenantId: string,
  aggregate: string, base: any, aDate?: Date) {
  const ref = aDate ?? new Date();
  const p = JSON.parse(JSON.stringify(base));
  const evs: any[] = await prisma.domainEvent.findMany({
    where: { tenantId, aggregateId: aggregate, type: "PARAM_CHANGED" },
    orderBy: { id: "asc" } });
  for (const e of evs) {
    const d: any = e.payload;
    if (new Date(d.enVigueurLe) <= ref) poserCle(p, d.cle, d.nouveau);
  }
  return p;
}

/** Le pop-up d'engagement (R445 généralisé) — throw 409 sans confirmation, PARAM_CHANGED avec. */
export async function modifierParametreGouverne(prisma: any, ctx: { tenantId: string; userId: string },
  opts: {
    aggregate: string;
    cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string; auteur: string };
    base: any;                                            // défauts (∪ config tenant) du registre
    portee?: string;
    extraPopup?: (cle: string) => Record<string, any>;    // ex. rappelLBA / rappel réglementaire
    apresEmission?: (tx: Tx) => Promise<void>;            // audit spécifique du module
  }) {
  // V2-M44 : sans clé, `lireCle` faisait `undefined.split(".")` — un TypeError remonté en 500.
  // Un paramètre gouverné qu'on modifie sans dire lequel est une erreur d'appel, pas un incident
  // serveur : elle se refuse, et le refus le dit.
  if (!opts?.cle || typeof opts.cle !== "string")
    throw new BadRequestException(`Paramètre à modifier non précisé (cle attendue) — registre ${opts?.aggregate ?? "?"}`);
  const enVigueur = new Date(opts.enVigueurLe);
  const actuel = await resoudreParametresGouvernes(prisma, ctx.tenantId, opts.aggregate, opts.base, enVigueur);
  let ancien = lireCle(actuel, opts.cle);
  if (ancien === undefined) {
    const parent = opts.cle.includes(".") ? lireCle(actuel, opts.cle.split(".").slice(0, -1).join(".")) : undefined;
    const parentRacine = lireCle(actuel, opts.cle.split(".")[0]);
    if ((parent && typeof parent === "object") || (parentRacine && typeof parentRacine === "object"))
      ancien = null;                                      // création sous un parent existant (override, rattachement…)
    else throw new BadRequestException(`Paramètre inconnu du registre ${opts.aggregate} : ${opts.cle}`);
  }
  const portee = opts.portee ?? "dossiers futurs — grandfathering R29 sur les dossiers en cours";
  const popup = { cle: opts.cle, ancien, nouveau: opts.valeur, portee,
    ...(opts.extraPopup ? opts.extraPopup(opts.cle) : {}) };
  if (!opts.confirmation?.engagementTexte || !opts.confirmation?.auteur)
    throw new ConflictException({ code: "R445_CONFIRMATION_REQUISE", popup });
  await prisma.$transaction(async (tx: Tx) => {
    await emitEvent(tx, ctx.tenantId, "PARAM_CHANGED", opts.aggregate, {
      cle: opts.cle, ancien, nouveau: opts.valeur, enVigueurLe: enVigueur.toISOString(),
      auteur: opts.confirmation!.auteur, engagementTexte: opts.confirmation!.engagementTexte,
      portee });
    if (opts.apresEmission) await opts.apresEmission(tx);
  });
  return { cle: opts.cle, ancien, nouveau: opts.valeur, enVigueurLe: enVigueur.toISOString(), applique: true };
}
