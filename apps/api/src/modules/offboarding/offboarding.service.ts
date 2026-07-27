import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { etatCloture } from "./cloture.util";

/**
 * Bloc OFFBOARDING — R267→R271 (OF-01..12), canon `spec/canon-vague-ecrans-pilote.md` partie 5
 * (ratifié 2026-07-27). Écrit APRÈS le canon, APRÈS les tests.
 * R267 : la fin de relation est une MACHINE À ÉTATS tracée — jamais un DELETE. CLOTUREE =
 * lecture seule intégrale pour `retentionPostClotureAns` (défaut 10 — LBA art. 7) ; AUCUNE
 * donnée supprimée ; la purge de fin de rétention est un processus distinct (R170), jamais ici.
 * L'annulation (OF-12) est tracée avec motif obligatoire (R7) — le dossier redevient ACTIVE,
 * la demande et son annulation restent au trail.
 * Paramètres R-Q : retentionPostClotureAns (10) · visasParTypeCloture · documentsParTypeCloture ·
 * rolesMotifSensible (CO_SR,MLRO) · exExitComplianceForceEdd (true).
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type CoreBankingPort = { systeme: string; version: string; perimetre: string[];
  lire(type: string, depuis?: string): Promise<any[]> };

export const TYPES_CLOTURE = ["DEMANDE_CLIENT", "DECISION_BANQUE", "EXIT_COMPLIANCE",
  "DECES_SUCCESSION", "TRANSFERT_ETABLISSEMENT"] as const;
const TRANSITIONS: Record<string, string[]> = {
  CLOTURE_DEMANDEE: ["EN_CLOTURE", "CLOTURE_ANNULEE"],
  EN_CLOTURE: ["CLOTUREE", "CLOTURE_ANNULEE"],
  CLOTUREE: [], CLOTURE_ANNULEE: [],
};
const ACTIFS = ["CLOTURE_DEMANDEE", "EN_CLOTURE"];
export const MOTIF_GENERIQUE = "Décision de l'établissement";

@Injectable()
export class OffboardingService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { core?: CoreBankingPort } = {}) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(db: any, tenantId: string) {
    const t = await db.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private async dossier(db: any, ctx: Ctx, id: string) {
    const o = await db.offboardingFile.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!o) throw new NotFoundException("Clôture introuvable");
    return o;
  }

  // ── R267 : ouvrir une clôture — type + motif obligatoires, une seule clôture active ──
  async creer(ctx: Ctx, dto: { clientId: string; type: string; motif: string;
    motifSensible?: string; mrosRef?: string; documents?: { type: string; ref: string }[] }) {
    if (!TYPES_CLOTURE.includes(dto.type as any))
      throw new BadRequestException(`R268 : type de clôture inconnu — ${dto.type}`);
    if (!dto.motif || !dto.motif.trim())
      throw new BadRequestException("R7 : le motif de clôture est obligatoire");
    return this.prisma.$transaction(async (tx: any) => {
      const client = await tx.client.findFirst({ where: { id: dto.clientId, tenantId: ctx.tenantId } });
      if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
      const active = await tx.offboardingFile.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId, statut: { in: ACTIFS } } });
      if (active) throw new ConflictException(`R267 : une clôture est déjà en cours (${active.id})`);
      const deja = await etatCloture(tx, ctx.tenantId, dto.clientId);
      if (deja.cloture) throw new ConflictException(
        "OFFBOARDING_LECTURE_SEULE : dossier clôturé — le retour passe par un nouvel onboarding (R271)");

      // R270 : pour EXIT_COMPLIANCE, la table principale ne porte JAMAIS le motif compliance —
      // le motif servi aux non-habilités est générique ; le détail vit dans la table cloisonnée.
      const exit = dto.type === "EXIT_COMPLIANCE";
      const s = await this.settings(tx, ctx.tenantId);
      const visasRequis: string[] = (s.visasParTypeCloture ?? {})[dto.type]
        ?? (exit ? ["CO_SR", "DIR"] : dto.type === "DECES_SUCCESSION" ? ["CO"] : ["CO"]);
      const o = await tx.offboardingFile.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId, type: dto.type,
        motif: exit ? MOTIF_GENERIQUE : dto.motif.trim(),
        initiateur: ctx.userId, documents: dto.documents ?? [],
        visas: visasRequis.map((role) => ({ role, statut: "PENDING", par: null, at: null })) } });
      if (exit) await tx.offboardingSensible.create({ data: {
        offboardingId: o.id, tenantId: ctx.tenantId,
        motifSensible: dto.motif.trim(), mrosRef: dto.mrosRef ?? null } });
      await this.emit(tx, ctx.tenantId, "offboarding.demande", o.id,
        { clientId: dto.clientId, type: dto.type, par: ctx.userId });   // payload SANS motif sensible (R270)
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_DEMANDE", o.id);
      return { id: o.id, statut: o.statut, visas: o.visas };
    });
  }

  async liste(ctx: Ctx, statut?: string) {
    const os = await this.prisma.offboardingFile.findMany({
      where: { tenantId: ctx.tenantId, ...(statut ? { statut } : {}) } });
    return os.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o: any) => ({ id: o.id, clientId: o.clientId, type: o.type, statut: o.statut,
        createdAt: o.createdAt, clotureEffectiveAt: o.clotureEffectiveAt, retentionJusqua: o.retentionJusqua }));
  }

  // ── R268/R269 (complétés aux commits suivants) : le détail — checklist vivante ──
  async detail(ctx: Ctx, id: string) {
    const o = await this.dossier(this.prisma, ctx, id);
    return { id: o.id, clientId: o.clientId, type: o.type, motif: o.motif, statut: o.statut,
      initiateur: o.initiateur, documents: o.documents, visas: o.visas,
      attestationAvoirs: o.attestationAvoirs, motifAnnulation: o.motifAnnulation,
      clotureEffectiveAt: o.clotureEffectiveAt, retentionJusqua: o.retentionJusqua, createdAt: o.createdAt };
  }

  // ── R267 : transitions fermées ; CLOTUREE pose la rétention ; annulation motivée (OF-12) ──
  async transitionner(ctx: Ctx, id: string, vers: string, motif?: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const o = await this.dossier(tx, ctx, id);
      if (!(TRANSITIONS[o.statut] ?? []).includes(vers))
        throw new BadRequestException(`R267 : transition illégale — ${o.statut} → ${vers}`);
      if (vers === "CLOTURE_ANNULEE" && !(motif && motif.trim()))
        throw new BadRequestException("R7 : annuler une clôture exige un motif");
      const data: any = { statut: vers };
      if (vers === "CLOTURE_ANNULEE") data.motifAnnulation = motif!.trim();
      if (vers === "CLOTUREE") {
        const s = await this.settings(tx, ctx.tenantId);
        const now = new Date();
        const retention = new Date(now);
        retention.setFullYear(retention.getFullYear() + (s.retentionPostClotureAns ?? 10)); // LBA art. 7
        data.clotureEffectiveAt = now; data.retentionJusqua = retention;
      }
      await tx.offboardingFile.update({ where: { id: o.id }, data });
      await this.emit(tx, ctx.tenantId, "offboarding.transition", o.id,
        { de: o.statut, vers, par: ctx.userId, ...(motif ? { motif: motif.trim() } : {}) });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_TRANSITION", `${o.id}:${o.statut}->${vers}`);
      return { statut: vers };
    });
  }

  // ── R267/OF-10 : le fait « clôturé » servi aux écrans (bannière) — calculé, jamais stocké ──
  async statutClient(ctx: Ctx, clientId: string) {
    return etatCloture(this.prisma, ctx.tenantId, clientId);
  }
}
