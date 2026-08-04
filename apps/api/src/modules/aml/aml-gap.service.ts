import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { emitEvent } from "../../common/domain-event";
import { Tx } from "../../common/tx";
import { AML_GAP_REFERENTIEL, AmlGapRule } from "./aml-gap.referentiel.gen";

/**
 * AmlGapService — orchestration de la vague AML Gap Wave 1 (R340–R377, blocs 50–56). Même
 * doctrine que AmlService : le service ORCHESTRE, il ne détecte pas. Le worker `aml-eval`
 * (différé — BullMQ/outbox) décide qu'un scénario s'est déclenché ; ce service PERSISTE le
 * signal (append-only, tenant-scopé, RLS), émet l'événement, et — pour les 6 règles BLOQUANTES
 * — émet `aml.block.requested` SANS aucun effet de bord (la suspension et la levée restent des
 * actes humains via le module transferts, R44/R39). L'auteur est TOUJOURS le jeton, jamais le corps.
 *
 * Le référentiel des 38 scénarios (familles, niveau, blocking, paramètres R-Q) est GÉNÉRÉ
 * (aml-gap.referentiel.gen.ts, source de vérité tools/aml-gap/gen_aml_gap.py). La version en
 * vigueur d'un scénario est résolue à la date de l'événement (R29, grandfathering).
 */

type Ctx = { tenantId: string; userId: string; role: string };

// Rôles habilités à qualifier / versionner (4-yeux, R13/R15 — objet visa uniforme).
const ROLES_QUALIF = new Set(["CO", "CO_SR", "MLRO", "ADMIN"]);

function defOf(code: string): AmlGapRule | undefined {
  return AML_GAP_REFERENTIEL.find((r) => r.id === code);
}

// Paramètres par défaut du scénario (registre R-Q) → objet {clé: défaut}.
function defautsParams(def: AmlGapRule): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const p of def.params) o[p.key] = p.default;
  return o;
}

// Hash stable (djb2) — clé d'idempotence (scenario, client, faits). Pas de crypto : dédoublonnage,
// pas de sécurité.
function hashFaits(faits: unknown): string {
  const s = JSON.stringify(faits ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

@Injectable()
export class AmlGapService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }

  /** Référentiel (projection lisible) — GET /v1/aml/scenarios. Aucune règle nouvelle. */
  referentiel() {
    return AML_GAP_REFERENTIEL.map((r) => ({
      code: r.id, ruleRef: r.ruleRef, bloc: r.bloc, blocTitre: r.blocTitre, famille: r.famille,
      titre: r.titre, niveau: r.niveau, kind: r.kind, blocking: r.blocking, signal: r.signal,
      params: r.params,
    }));
  }

  /**
   * Version en vigueur d'un scénario à une date (R29). Si le tenant a versionné (table
   * aml_scenarios), on prend la plus haute version active dont effectiveFrom ≤ date ; sinon on
   * retombe sur le défaut du référentiel (version 1, paramètres par défaut) — neutre, jamais inventé.
   */
  async versionEnVigueur(ctx: Ctx, code: string, date: Date = new Date()) {
    const def = defOf(code);
    if (!def) throw new NotFoundException(`[R340] scénario inconnu : ${code}`);
    const rows: any[] = await this.prisma.amlScenario.findMany({
      where: { tenantId: ctx.tenantId, code, active: true, effectiveFrom: { lte: date.toISOString() } },
    });
    const enVigueur = rows.sort((a, b) => b.version - a.version)[0];
    if (enVigueur) {
      return { code, version: enVigueur.version, params: enVigueur.params ?? defautsParams(def),
        niveau: def.niveau, blocking: def.blocking, ruleRef: def.ruleRef };
    }
    return { code, version: 1, params: defautsParams(def), niveau: def.niveau,
      blocking: def.blocking, ruleRef: def.ruleRef };
  }

  /**
   * Enregistre un signal (append-only). Idempotent par (scénario, client, hash des faits) : un
   * même déclenchement rejoué ne crée pas de doublon. Un scénario BLOQUANT émet en plus
   * `aml.block.requested` — événement consommé par le module transferts, ZÉRO effet de bord ici.
   */
  async enregistrerSignal(
    ctx: Ctx,
    dto: { scenarioCode: string; clientId?: string | null; faits?: any; uboGroupId?: string | null; date?: string },
  ) {
    if (!dto?.scenarioCode) throw new BadRequestException("scenarioCode requis");
    const date = dto.date ? new Date(dto.date) : new Date();
    const v = await this.versionEnVigueur(ctx, dto.scenarioCode, date);
    const idemKey = `${dto.scenarioCode}:${dto.clientId ?? "-"}:${hashFaits(dto.faits)}`;

    return this.prisma.$transaction(async (tx: Tx) => {
      const existant = await tx.amlGapSignal.findFirst({ where: { tenantId: ctx.tenantId, idemKey } });
      if (existant) return existant; // R48 : rejeu idempotent, aucun doublon

      const row = await tx.amlGapSignal.create({
        data: {
          tenantId: ctx.tenantId, scenarioCode: dto.scenarioCode, scenarioVer: v.version, ruleRef: v.ruleRef,
          clientId: dto.clientId ?? null, uboGroupId: dto.uboGroupId ?? null, payload: dto.faits ?? {},
          niveau: v.niveau, blocking: v.blocking, status: "NEW", idemKey, emisPar: ctx.userId,
        },
      });
      await this.emit(tx, ctx.tenantId, "aml.signal.raised", row.id, {
        scenarioCode: dto.scenarioCode, scenarioVer: v.version, ruleRef: v.ruleRef,
        clientId: dto.clientId ?? null, niveau: v.niveau, blocking: v.blocking,
      });
      if (v.blocking) {
        // Contrainte type R13, BLOQUANT : on DEMANDE le blocage, on ne l'exécute pas (R44/R39).
        await this.emit(tx, ctx.tenantId, "aml.block.requested", row.id, {
          scenarioCode: dto.scenarioCode, ruleRef: v.ruleRef, clientId: dto.clientId ?? null,
          motif: "scénario bloquant déclenché — décision humaine requise",
        });
      }
      await this.audit.log(ctx.tenantId, ctx.userId, "AML_GAP_SIGNAL", `${dto.scenarioCode}:${row.id}`);
      return row;
    });
  }

  /**
   * Qualifie un signal (TP/FP) — rôles CO/CO_SR/MLRO, MOTIF OBLIGATOIRE (R7). Append-only : le
   * statut est une projection ; la transition est journalisée par `aml.signal.qualified`.
   */
  async qualifier(ctx: Ctx, signalId: string, dto: { outcome: string; motif?: string }) {
    if (!ROLES_QUALIF.has(ctx.role))
      throw new ForbiddenException(`[R13] rôle « ${ctx.role} » non habilité à qualifier un signal AML`);
    const outcome = String(dto?.outcome || "").toUpperCase();
    if (outcome !== "TP" && outcome !== "FP")
      throw new BadRequestException("[R44] outcome doit être TP ou FP");
    if (!dto?.motif || !String(dto.motif).trim())
      throw new BadRequestException("[R7] motif de qualification obligatoire");

    return this.prisma.$transaction(async (tx: Tx) => {
      const sig = await tx.amlGapSignal.findFirst({ where: { tenantId: ctx.tenantId, id: signalId } });
      if (!sig) throw new NotFoundException("signal introuvable");
      const updated = await tx.amlGapSignal.update({
        where: { id: signalId },
        data: { status: outcome, outcome, motif: dto.motif },
      });
      await this.emit(tx, ctx.tenantId, "aml.signal.qualified", signalId, {
        scenarioCode: sig.scenarioCode, outcome, motif: dto.motif, par: ctx.userId,
      });
      await this.audit.log(ctx.tenantId, ctx.userId, "AML_GAP_QUALIFY", `${signalId}:${outcome}`);
      return updated;
    });
  }

  /** Inbox des signaux (tenant-scopé), filtrable par statut / famille / client. */
  async signaux(ctx: Ctx, filtre: { status?: string; fam?: string; clientId?: string } = {}) {
    const where: any = { tenantId: ctx.tenantId };
    if (filtre.status) where.status = filtre.status;
    if (filtre.clientId) where.clientId = filtre.clientId;
    const rows: any[] = await this.prisma.amlGapSignal.findMany({ where });
    const view = filtre.fam
      ? rows.filter((r) => (defOf(r.scenarioCode)?.famille ?? "") === filtre.fam)
      : rows;
    return view.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}
