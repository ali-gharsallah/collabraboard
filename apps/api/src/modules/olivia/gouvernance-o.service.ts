import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";

/**
 * P-L8-3 (packaging O, v1.1 §13) — GOUVERNANCE ET VISIBILITÉ du module O. AUCUNE capacité
 * nouvelle : le curseur ne déclenche rien — il DIT le niveau d'autonomie consenti par tenant
 * et par capacité (défaut : observe), et son changement est un événement CATALOGUÉ (C6).
 * Chaque action du module O reste actor: olivia@version via les chemins API existants (R44).
 * Rapport de valeur MENSUEL : compté DEPUIS LE JOURNAL et les tables réelles (oliviaProposal,
 * domain_events olivia.*, tasks d'origine olivia) — définitions affichées avec les chiffres.
 */

type Ctx = { tenantId: string; userId: string; role: string };
export const CAPACITES_O = ["PREREVUE_DOSSIER", "ANALYSE_CORRELATION", "RECOMMANDATION_PROSE"] as const;
export const NIVEAUX_O = ["observe", "suggere", "copilote_gouverne"] as const;   // O1 · O2 · O3
const DEFAUT = "observe";

@Injectable()
export class GouvernanceOService {
  constructor(private prisma: PrismaService) {}

  /** Le curseur par capacité — lu de tenant.settings.oliviaAutonomie, défaut observe (O1). */
  async curseur(ctx: Ctx) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const cfg = ((t?.settings as any)?.oliviaAutonomie ?? {}) as Record<string, string>;
    return { niveaux: [...NIVEAUX_O],
      capacites: CAPACITES_O.map((c) => ({ capacite: c, niveau: cfg[c] ?? DEFAUT })) };
  }

  /** Changer le curseur = décision de GOUVERNANCE tracée (événement catalogué) — rien d'exécuté. */
  async changerCurseur(ctx: Ctx, dto: { capacite: string; niveau: string }) {
    if (!(CAPACITES_O as readonly string[]).includes(dto?.capacite))
      throw new BadRequestException(`capacité inconnue (${CAPACITES_O.join(" | ")})`);
    if (!(NIVEAUX_O as readonly string[]).includes(dto?.niveau))
      throw new BadRequestException(`niveau inconnu (${NIVEAUX_O.join(" | ")})`);
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const settings = (t?.settings as any) ?? {};
    const precedent = settings.oliviaAutonomie?.[dto.capacite] ?? DEFAUT;
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.tenant.update({ where: { id: ctx.tenantId }, data: { settings: {
        ...settings, oliviaAutonomie: { ...(settings.oliviaAutonomie ?? {}), [dto.capacite]: dto.niveau } } } });
      await emitEvent(tx, ctx.tenantId, "olivia.curseur.change", dto.capacite,
        { capacite: dto.capacite, niveau: dto.niveau, precedent, par: ctx.userId });
    });
    return { capacite: dto.capacite, niveau: dto.niveau, precedent };
  }

  /** Rapport de valeur MENSUEL — compté du journal et des tables réelles, définitions incluses. */
  async rapportValeur(ctx: Ctx, annee: number, mois: number) {
    if (!(mois >= 1 && mois <= 12)) throw new BadRequestException("mois ∈ 1..12");
    const du = new Date(Date.UTC(annee, mois - 1, 1)), au = new Date(Date.UTC(annee, mois, 1));
    const dans = (at: any) => new Date(at) >= du && new Date(at) < au;
    const compter = (rows: any[], cle: (r: any) => string) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[cle(r)] = (m[cle(r)] ?? 0) + 1;
      return m;
    };
    const props = (await this.prisma.oliviaProposal.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((p: any) => dans(p.createdAt ?? p.at));
    const evs = (await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId,
      type: { in: ["olivia.run.porte", "olivia.run.porte.expiree", "olivia.runs.saturation", "olivia.curseur.change"] } } }))
      .filter((e: any) => dans(e.at));
    const taches = (await this.prisma.task.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((k: any) => dans(k.createdAt) && String(k.origine ?? "").toLowerCase().includes("olivia"));
    return {
      mois: `${annee}-${String(mois).padStart(2, "0")}`,
      definitions: {
        suggestions: "oliviaProposal créées sur le mois (statut = décision HUMAINE, R254)",
        portesHumaines: "olivia.run.porte au journal (validations demandées / expirées)",
        derives: "olivia.runs.saturation au journal",
        relances: "tasks nées d'une origine olivia (repriorisations/relances proposées)",
      },
      suggestions: { emises: props.length, parStatut: compter(props, (p) => p.statut ?? "PENDING"),
        parType: compter(props, (p) => p.type ?? "?") },
      portesHumaines: compter(evs.filter((e: any) => e.type.startsWith("olivia.run.porte")), (e: any) => e.type),
      derivesDetectees: evs.filter((e: any) => e.type === "olivia.runs.saturation").length,
      changementsCurseur: evs.filter((e: any) => e.type === "olivia.curseur.change").length,
      relancesEtRepriorisations: taches.length,
      acteur: "olivia@version — via les chemins API existants, décisions humaines (R44)",
    };
  }
}
