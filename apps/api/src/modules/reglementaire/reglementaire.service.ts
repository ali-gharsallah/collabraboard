import { Injectable, BadRequestException, ConflictException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";

/**
 * CALENDRIER RÉGLEMENTAIRE — R490→R492 (spec/CALENDRIER-REGLEMENTAIRE-R490-R492.md, CR-01..10).
 *
 * Origine : écart E-V2-7, trouvé contre une API vivante (V2-M41). L'onglet « Réglementaire »
 * lisait `/v1/rapports/kpi`, qui rend des indicateurs de conformité et non un calendrier
 * d'obligations ; aucune route ne portait ce calendrier, il n'existait pas.
 *
 * CE MODULE EST UN MÉCANISME, PAS UN CONTENU. Quelles obligations, quelles bases légales,
 * quelles échéances : c'est l'arbitrage de l'établissement, publié au registre R-Q sous la clé
 * `calendrierReglementaire` — donc motivé (R7), daté, append-only, jamais rétroactif (R126),
 * rejouable à date (R127/R29). Aucune obligation n'est codée ici, aucune base légale n'est
 * décidée ici. Le seul calendrier écrit dans le code est celui des TESTS, et il est fictif.
 *
 * Trois invariants qui ne se négocient pas :
 *   · R491 — le statut se CALCULE à la lecture (config à date ⊕ journal). Rien n'est stocké :
 *     deux lectures à la même date rendent le même verdict, c'est ce qui rend l'écran opposable.
 *   · R490 — `echeance: null` est un CAS DE DROIT, pas un oubli. La communication au MROS est
 *     due « sans délai » (LBA art. 9) : aucune date n'existe. Un moteur qui en fabriquerait une
 *     pour afficher un retard porterait un jugement juridique que personne ne lui a demandé.
 *   · R492/R44/R39 — le dépôt est un acte HUMAIN motivé. Aucun chemin de code ne dépose, ne
 *     déclare ni ne régularise. Le retard est mesuré et signalé, jamais corrigé par le système.
 */

type Ctx = { tenantId: string; userId: string; role: string };

export type Obligation = {
  code: string; obligation: string; periode: string;
  echeance: string | null;                 // ISO, ou null quand la loi ne fixe pas de date
  base: string; responsable?: string;
};

export type Statut = "DEPOSEE" | "SANS_ECHEANCE" | "EN_RETARD" | "DUE" | "A_VENIR";

/** Le service de paramètres, réduit à ce dont ce module a besoin (R125 : une seule source). */
type PortParametres = { valeurEffective(ctx: Ctx, cle: string, date: Date): Promise<any> };

const JOUR_MS = 86_400_000;

@Injectable()
export class ReglementaireService {
  constructor(private prisma: any, private parametres: PortParametres, private audit: any) {}

  /** La clé `(code, periode)` — un dépôt vaut pour un exercice, pas pour l'obligation en général. */
  private static cle(code: string, periode: string) { return `${code}|${periode}`; }

  private async depots(tenantId: string): Promise<Map<string, any>> {
    const evts = await this.prisma.domainEvent.findMany({
      where: { tenantId, type: "reglementaire.depot.consigne" }, orderBy: { id: "asc" } });
    const parCle = new Map<string, any>();
    for (const e of evts) {
      const p = e.payload as any;
      const k = ReglementaireService.cle(p.code, p.periode);
      if (!parCle.has(k)) parCle.set(k, p);           // le PREMIER dépôt fait foi (R49, cf. CR-09)
    }
    return parCle;
  }

  private async config(ctx: Ctx, at: Date) {
    const obligations: Obligation[] = (await this.parametres.valeurEffective(ctx, "calendrierReglementaire", at)) ?? [];
    const preavis = await this.parametres.valeurEffective(ctx, "reglementairePreavisJours", at);
    return { obligations: Array.isArray(obligations) ? obligations : [],
      preavisJours: typeof preavis === "number" ? preavis : 30 };
  }

  /**
   * R491 — le statut d'UNE obligation à UNE date. Pure : mêmes entrées, même sortie, toujours.
   * L'ordre des tests est contractuel : le dépôt prime sur tout (une obligation déposée n'est
   * pas « en retard » même déposée tard — le retard se lit dans la date du dépôt, pas dans un
   * statut qui l'effacerait) ; l'absence d'échéance prime sur le calcul de retard.
   */
  static statut(o: Obligation, at: Date, preavisJours: number, depot?: any): Statut {
    if (depot) return "DEPOSEE";
    if (!o.echeance) return "SANS_ECHEANCE";
    const echeance = new Date(o.echeance);
    if (Number.isNaN(echeance.getTime())) return "SANS_ECHEANCE";   // date illisible : jamais un retard
    if (at.getTime() > echeance.getTime()) return "EN_RETARD";
    return (echeance.getTime() - at.getTime()) <= preavisJours * JOUR_MS ? "DUE" : "A_VENIR";
  }

  /** R490/R491 — le calendrier en vigueur à `at`, chaque obligation avec son statut calculé. */
  async calendrier(ctx: Ctx, at: Date) {
    const { obligations, preavisJours } = await this.config(ctx, at);
    const depots = await this.depots(ctx.tenantId);
    return {
      at: at.toISOString(), preavisJours,
      obligations: obligations.map((o) => {
        const depot = depots.get(ReglementaireService.cle(o.code, o.periode));
        return { ...o, statut: ReglementaireService.statut(o, at, preavisJours, depot), depot: depot ?? null };
      }),
    };
  }

  /**
   * R492 — consigner un dépôt. Acte humain, motivé (R7), référencé (l'accusé de dépôt EST la
   * preuve : sans lui on consignerait une affirmation, pas un fait). Deux refus explicites, et
   * le second NOMME la première référence — un doublon de déclaration est un incident.
   */
  async consignerDepot(ctx: Ctx, code: string, dto: { periode: string; reference: string; motif: string; deposeLe?: string }) {
    if (!dto?.motif) throw new BadRequestException("[R7] motif requis pour consigner un dépôt réglementaire");
    if (!dto?.reference) throw new BadRequestException("[R492] reference requise (accusé de dépôt) — un dépôt sans accusé n'est pas une preuve");
    if (!dto?.periode) throw new BadRequestException("[R492] periode requise — un dépôt vaut pour un exercice");

    const at = new Date();
    const { obligations } = await this.config(ctx, at);
    const o = obligations.find((x) => x.code === code && x.periode === dto.periode)
      ?? obligations.find((x) => x.code === code);
    if (!o) throw new BadRequestException(
      `[R490] obligation « ${code} » absente du calendrier en vigueur — on ne consigne pas le dépôt d'une obligation non déclarée`);

    const depots = await this.depots(ctx.tenantId);
    const deja = depots.get(ReglementaireService.cle(code, dto.periode));
    if (deja) throw new ConflictException(
      `[R492] dépôt déjà consigné pour ${code} / ${dto.periode} — référence ${deja.reference} (${deja.deposeLe}). Un second dépôt est un incident, pas une opération neutre.`);

    const payload = { code, periode: dto.periode, reference: dto.reference, motif: dto.motif,
      base: o.base, deposeLe: dto.deposeLe ?? at.toISOString(), par: ctx.userId };
    await this.prisma.$transaction(async (tx: any) =>
      emitEvent(tx, ctx.tenantId, "reglementaire.depot.consigne", code, payload));
    await this.audit.log(ctx.tenantId, ctx.userId, "REGLEMENTAIRE_DEPOT", `${code}/${dto.periode}`);
    return payload;
  }

  /**
   * R39/R44 — SIGNALER. Le moteur compte et notifie ; il ne dépose rien, ne régularise rien,
   * ne relance personne de sa propre autorité. La sortie autorisée d'un moteur qui constate un
   * manquement est un événement — jamais une action à la place de l'humain qui en répond.
   */
  async signaler(ctx: Ctx, at: Date) {
    const { obligations } = await this.calendrier(ctx, at);
    const parStatut: Record<string, number> = {};
    for (const o of obligations) parStatut[o.statut] = (parStatut[o.statut] ?? 0) + 1;
    const enRetard = obligations.filter((o: any) => o.statut === "EN_RETARD")
      .map((o: any) => ({ code: o.code, echeance: o.echeance, base: o.base, responsable: o.responsable ?? null }));
    await this.prisma.$transaction(async (tx: any) =>
      emitEvent(tx, ctx.tenantId, "reglementaire.retard.signale", at.toISOString().slice(0, 10),
        { parStatut, enRetard, par: ctx.userId }));
    return { at: at.toISOString(), parStatut, enRetard };
  }
}
