import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Onboarding — l'entrée en relation. R117→R120 (OB-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * Invariants tenus : machine à états fermée, transitions tracées, terminaux motivés (R117/R7) ;
 * le KYC est créé PAR LE MOTEUR KYC injecté, un seul actif par onboarding (R118) ;
 * pas d'ouverture sans KYC VALIDATED — blocage réglementaire type R13 (R119, erratum : VALIDATED = statut terminal réel de l'enum) ;
 * le SLA alerte une fois et n'abandonne jamais, le funnel se restitue des événements (R120, R39/R48).
 * Paramètre tenant (R-Q) : onboardingSlaJours { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 }.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const TRANSITIONS: Record<string, string[]> = {
  PROSPECT: ["COLLECTE", "REFUSE", "ABANDONNE"],
  COLLECTE: ["KYC_EN_COURS", "REFUSE", "ABANDONNE"],
  KYC_EN_COURS: ["DECISION", "REFUSE", "ABANDONNE"],
  DECISION: ["OUVERT", "REFUSE", "ABANDONNE"],
  OUVERT: [], REFUSE: [], ABANDONNE: [],
};
const TERMINAUX_MOTIVES = ["REFUSE", "ABANDONNE"];
const SLA_DEFAUT: Record<string, number> = { COLLECTE: 30, KYC_EN_COURS: 45, DECISION: 10 };
const FORM_4 = ["clientName", "legalStructure", "rmId", "accountType"] as const;

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService, private audit: AuditService,
              private kycSvc: { create: (ctx: Ctx, dto: any) => Promise<any> }) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload,
      at: new Date().toISOString() } });
  }
  private async ob(tx: any, ctx: Ctx, id: string) {
    const o = await tx.onboarding.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!o) throw new NotFoundException("Onboarding introuvable");
    return o;
  }

  // ── R117 : création — l'entrée du funnel ──
  async creer(ctx: Ctx, dto: { prospectNom: string }) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await tx.onboarding.create({ data: { tenantId: ctx.tenantId,
        prospectNom: dto.prospectNom, etape: "PROSPECT",
        etapeDepuis: new Date().toISOString(), slaSignale: false } });
      await this.emit(tx, ctx.tenantId, "onboarding.cree", o.id, { prospect: dto.prospectNom, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "ONBOARDING_CREATED", o.id);
      return o;
    });
  }

  // ── R117/R118/R119 : LA transition — garde des états, délégations, blocages ──
  async transitionner(ctx: Ctx, onboardingId: string, vers: string,
                      opts: { motif?: string; form?: any } = {}) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await this.ob(tx, ctx, onboardingId);
      if (!(TRANSITIONS[o.etape] ?? []).includes(vers))
        throw new BadRequestException(`Transition illégale : ${o.etape} → ${vers}`);
      if (TERMINAUX_MOTIVES.includes(vers) && !(opts.motif && opts.motif.trim()))
        throw new BadRequestException(`R7 : la transition vers ${vers} exige un motif`);

      // R118 — l'entrée en collecte crée LE KYC, par le moteur, une seule fois
      if (vers === "COLLECTE") {
        const f = opts.form ?? {};
        const manquants = FORM_4.filter((k) => !f[k]);
        if (manquants.length)
          throw new BadRequestException(`Mini-formulaire 4 infos incomplet — manquants : ${manquants.join(", ")}`);
        const kyc = await this.kycSvc.create(ctx, f);           // délégation — jamais un KYC à la main
        await tx.onboarding.update({ where: { id: o.id }, data: { kycFileId: kyc.id } });
        await this.emit(tx, ctx.tenantId, "onboarding.kyc.cree", o.id, { kycFileId: kyc.id });
      }

      // R119 — pas d'ouverture sans KYC VALIDATED (blocage réglementaire, type R13).
      // Erratum (ratifié par Ali) : le statut terminal est VALIDATED — la valeur réelle de
      // l'enum KycStatus ; « APPROVED » de MOD-01 était historique. Cf. spec/erratum-R119-validated.md.
      if (vers === "OUVERT") {
        const kyc = o.kycFileId
          ? await tx.kycFile.findFirst({ where: { id: o.kycFileId, tenantId: ctx.tenantId } }) : null;
        if (!kyc || kyc.status !== "VALIDATED")
          throw new ForbiddenException(
            `R119 : ouverture refusée — KYC lié ${kyc ? kyc.status : "absent"}, VALIDATED requis`);
      }

      await tx.onboarding.update({ where: { id: o.id }, data: { etape: vers,
        etapeDepuis: new Date().toISOString(), slaSignale: false,
        ...(TERMINAUX_MOTIVES.includes(vers)
          ? { motifTerminal: opts.motif!.trim(), terminePar: ctx.userId } : {}) } });
      await this.emit(tx, ctx.tenantId, "onboarding.transition", o.id,
        { de: o.etape, vers, par: ctx.userId, ...(opts.motif ? { motif: opts.motif.trim() } : {}) });
      if (vers === "OUVERT")
        await this.emit(tx, ctx.tenantId, "onboarding.ouvert", o.id, { kycFileId: o.kycFileId });
        // Les effets aval (compte, tâches de bienvenue) CONSOMMENT cet événement — jamais d'effet de bord ici.
      await this.audit.log(ctx.tenantId, ctx.userId, "ONBOARDING_TRANSITION", `${o.id}:${o.etape}->${vers}`);
      return { etape: vers };
    });
  }

  // ── R120 : le SLA alerte une fois — l'abandon reste une décision humaine ──
  async tickSla(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: any) => {
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const sla = { ...SLA_DEFAUT, ...((t?.settings as any)?.onboardingSlaJours ?? {}) };
      const actifs = await tx.onboarding.findMany({ where: { tenantId: ctx.tenantId,
        etape: { in: Object.keys(SLA_DEFAUT) }, slaSignale: false } });
      for (const o of actifs) {
        const jours = (now.getTime() - new Date(o.etapeDepuis).getTime()) / 86400000;
        if (jours < (sla[o.etape] ?? Infinity)) continue;
        await tx.onboarding.update({ where: { id: o.id }, data: { slaSignale: true } });
        await this.emit(tx, ctx.tenantId, "onboarding.sla.alerte", o.id,
          { etape: o.etape, jours: Math.floor(jours), sla: sla[o.etape] });
        await this.emit(tx, ctx.tenantId, "tache.onboarding.relance", o.id,
          { etape: o.etape, rm: o.rmId ?? null });
        // L'état ne bouge pas : le système mesure et notifie (R39).
      }
    });
  }

  // ── R120 : le funnel se restitue des ÉVÉNEMENTS (R48) ──
  async funnel(ctx: Ctx, onboardingId: string) {
    const o = await this.ob(this.prisma, ctx, onboardingId);
    const siens = (await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, aggregateId: onboardingId,
               type: { in: ["onboarding.cree", "onboarding.transition"] } } })) as any[];
    const etapes: { etape: string; entree: string | null; sortie: string | null; jours: number | null }[] = [];
    let courante = "PROSPECT"; let depuis: string | null = null;
    for (const e of siens) {
      const ts = e.at ?? new Date().toISOString();
      if (e.type === "onboarding.cree") { courante = "PROSPECT"; depuis = ts; continue; }
      etapes.push({ etape: courante, entree: depuis, sortie: ts,
        jours: depuis ? Math.round((new Date(ts).getTime() - new Date(depuis).getTime()) / 86400000) : null });
      courante = e.payload.vers; depuis = ts;
    }
    etapes.push({ etape: courante, entree: depuis, sortie: null, jours: null });   // étape courante ouverte
    return { onboardingId, etat: o.etape, etapes };
  }
}
