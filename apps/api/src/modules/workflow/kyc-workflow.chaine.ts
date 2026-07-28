import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { WorkflowDefService } from "./workflow-def.service";
import { emitEvent } from "../../common/domain-event";

/**
 * KYC ↔ Workflow gouverné — le composeur. KW-01..05. AUCUNE RÈGLE NOUVELLE : ce service
 * applique la clause R172 (« le dossier emporte sa version ») au dossier KYC réel, sans
 * modifier un seul service ratifié. Le KYC entre par un PORT (KycPort — le vrai KycService
 * y est structurellement compatible : create/get ; injection au module, note de câblage).
 * Le TIMBRE est un ÉVÉNEMENT append-only (kyc.dossier.workflow) : l'état par l'événement,
 * pas de colonne ajoutée — et il ne se rejoue pas.
 * Repli : sans définition publiée applicable, le dossier naît sur les templates historiques
 * — comportement inchangé, mais TRACÉ (source TEMPLATE). Rien ne casse, tout se sait.
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type KycPort = {
  create(ctx: Ctx, dto: any): Promise<{ code: string; workflow: string; sections?: any[] }>;
  get(ctx: Ctx, code: string): Promise<{ code: string; workflow: string; sections?: any[] } | null>;
};

@Injectable()
export class KycWorkflowChaine {
  constructor(private kyc: KycPort, private wfDefs: WorkflowDefService, private prisma: any) {}

  private emit(tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(this.prisma, tenantId, type, aggregateId, payload);
  }
  private async timbre(ctx: Ctx, dossierCode: string) {
    const evs = await this.prisma.domainEvent.findMany({ where: { tenantId: ctx.tenantId, type: "kyc.dossier.workflow", aggregateId: dossierCode } });
    return evs.length ? evs[evs.length - 1].payload : null;
  }

  /** Le timbre — une fois, jamais rejoué. */
  async timbrer(ctx: Ctx, dossierCode: string, workflowCode: string) {
    const deja = await this.timbre(ctx, dossierCode);
    if (deja) throw new BadRequestException("Le dossier emporte sa version — le timbre est déjà posé, il ne se rejoue pas");
    const now = new Date().toISOString();
    let payload: any;
    try {
      const def = await this.wfDefs.resoudre(ctx, workflowCode, now);
      payload = { source: "GOUVERNE", workflowCode, version: def.version, depuisLe: def.depuisLe };
    } catch {
      payload = { source: "TEMPLATE", workflowCode, version: null, depuisLe: null };   // repli tracé
    }
    await this.emit(ctx.tenantId, "kyc.dossier.workflow", dossierCode, payload);
    return payload;
  }

  // ── L'ouverture gouvernée : créer PUIS timbrer (clause R172) ──
  async ouvrirGouverne(ctx: Ctx, dto: any) {
    const d = await this.kyc.create(ctx, dto);
    const t = await this.timbrer(ctx, d.code, d.workflow);
    return { dossierCode: d.code, workflowCode: d.workflow, workflowVersion: t.version, source: t.source };
  }

  async versionDuDossier(ctx: Ctx, dossierCode: string) {
    const t = await this.timbre(ctx, dossierCode);
    if (!t) throw new NotFoundException("Dossier sans timbre — introuvable dans le monde gouverné");
    return { version: t.version, source: t.source, workflowCode: t.workflowCode };
  }

  // ── La lecture sert la version DU DOSSIER — jamais l'état courant ──
  async etapesDuDossier(ctx: Ctx, dossierCode: string) {
    const t = await this.timbre(ctx, dossierCode);
    if (!t) throw new NotFoundException("Dossier sans timbre — introuvable dans le monde gouverné");
    if (t.source === "GOUVERNE") {
      const defs = await this.prisma.workflowDef.findMany({ where: { tenantId: ctx.tenantId, code: t.workflowCode, version: t.version } });
      if (!defs.length) throw new NotFoundException("Définition du timbre introuvable — fait d'audit");
      return { source: "GOUVERNE", version: t.version, etapes: defs[0].contenu.etapes };
    }
    const d = await this.kyc.get(ctx, dossierCode);
    if (!d) throw new NotFoundException("Dossier introuvable");
    return { source: "TEMPLATE", version: null, etapes: (d.sections ?? []).map((s: any) => s.code) };
  }
}
