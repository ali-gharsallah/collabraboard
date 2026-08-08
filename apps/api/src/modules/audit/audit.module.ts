import { Body, Controller, ForbiddenException, Get, Module, Post, Query, Req } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { Tx } from "../../common/tx";

/**
 * R284 — la surface d'AUDIT dédiée (canon SO + transport async, ratifié 2026-07-28).
 * « L'auditeur est audité » : chaque consultation SO d'une surface sensible est ELLE-MÊME un
 * événement append-only AUDIT_ACCESS (émis par la garde structurelle, tenant.middleware) —
 * ce journal-là est consultable par la DIRECTION et par SO lui-même : personne ne lit dans
 * l'ombre, pas même l'auditeur. (Argument FINMA : la banque prouve QUI a consulté les
 * données MROS.) L'export d'audit est l'UNE des deux seules écritures de SO — une génération
 * de document, TRACÉE (l'autre : le STOP d'un run, R267, chez Olivia).
 */
type Ctx = { tenantId: string; userId: string; role: string };

@Controller("audit")
export class AuditController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private garde(ctx: Ctx) {
    if (!["SO", "DIR"].includes(ctx.role))
      throw new ForbiddenException("Le journal des accès d'audit se consulte en SO ou DIRECTION (R284)");
  }

  // ── SO-04 : le journal des accès — qui a consulté quoi, quand (append-only, jamais supprimable). ──
  @Get("acces")
  async acces(@Req() r: any, @Query("limite") limite?: string) {
    this.garde(r.ctx);
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: r.ctx.tenantId, type: "AUDIT_ACCESS" },
      orderBy: { id: "desc" }, take: Math.min(Number(limite ?? 200), 500) });
    return evs.map((e: any) => ({ at: e.at, ...(e.payload as object) }));
  }

  // ═══ Extension R284 (canon triage final, ratifié 2026-07-28) — écran `auditit`. ═══
  // SO-07 : la vérification d'INTÉGRITÉ des journaux est une LECTURE tracée (AUDIT_ACCESS) —
  // chaîne HMAC kyc_question_history recomputée, chaîne record_hash des runs vérifiée par
  // LIAISON (seq contigus + prevHash = recordHash précédent — la recomputation de contenu vit
  // au replay R265), seq monotones olivia_messages, unicité des versions en vigueur R282.
  // Premier maillon rompu LOCALISÉ. Accès SO + DIRECTION.
  @Get("integrite")
  async integrite(@Req() r: any) {
    this.garde(r.ctx);
    const journaux: any[] = [];
    // 1. kyc_question_history — chaîne HMAC par question (recompute intégral, secret serveur)
    {
      const rows = await this.prisma.kycQuestionHistory.findMany({
        where: { question: { section: { kycFile: { tenantId: r.ctx.tenantId } } } },
        orderBy: { changedAt: "asc" } });
      const parQuestion = new Map<string, any[]>();
      for (const h of rows) { const l = parQuestion.get(h.questionId) ?? []; l.push(h); parQuestion.set(h.questionId, l); }
      let rompu: { ref: string; detail: string } | null = null; let controles = 0;
      for (const [qid, chaine] of parQuestion) {
        let prev = "";
        for (const h of chaine) {
          controles++;
          const attendu = createHmac("sha256", process.env.AUDIT_HMAC_SECRET!)
            .update([prev, qid, h.previousValue ?? "", h.newValue, h.changedBy, h.changedAt.toISOString()].join("|")).digest("hex");
          if (h.hash !== attendu) { rompu = { ref: h.id, detail: `question ${qid} — maillon ${h.id} (hash attendu ≠ stocké)` }; break; }
          prev = h.hash;
        }
        if (rompu) break;
      }
      journaux.push({ journal: "kyc_question_history", controles, statut: rompu ? "ROMPU" : "OK", ...(rompu ? { rompu } : {}) });
    }
    // 2. olivia_run_events — seq contigus + liaison prevHash par run (R260)
    {
      const evs = await this.prisma.oliviaRunEvent.findMany({ where: { tenantId: r.ctx.tenantId },
        orderBy: [{ runId: "asc" }, { seq: "asc" }] });
      let rompu: { ref: string; detail: string } | null = null;
      let runId = ""; let attenduSeq = 1; let prevHash: string | null = null;
      for (const e of evs as any[]) {
        if (e.runId !== runId) { runId = e.runId; attenduSeq = 1; prevHash = null; }
        if (e.seq !== attenduSeq || (e.prevHash ?? null) !== prevHash) {
          rompu = { ref: e.id, detail: `run ${e.runId} — seq ${e.seq} (attendu ${attenduSeq}, liaison prevHash ${e.prevHash === prevHash ? "ok" : "rompue"})` };
          break;
        }
        attenduSeq++; prevHash = e.recordHash;
      }
      journaux.push({ journal: "olivia_run_events", controles: evs.length, statut: rompu ? "ROMPU" : "OK", ...(rompu ? { rompu } : {}) });
    }
    // 3. olivia_messages — seq strictement croissants par conversation
    {
      const ms = await this.prisma.oliviaMessage.findMany({ where: { tenantId: r.ctx.tenantId },
        orderBy: [{ conversationId: "asc" }, { seq: "asc" }], select: { id: true, conversationId: true, seq: true } });
      let rompu: { ref: string; detail: string } | null = null; let conv: string | null = "___"; let prev = 0;
      for (const m of ms as any[]) {
        if (m.conversationId !== conv) { conv = m.conversationId; prev = 0; }
        if (m.seq <= prev) { rompu = { ref: m.id, detail: `conversation ${conv} — seq ${m.seq} non croissant` }; break; }
        prev = m.seq;
      }
      journaux.push({ journal: "olivia_messages", controles: ms.length, statut: rompu ? "ROMPU" : "OK", ...(rompu ? { rompu } : {}) });
    }
    // 4. kyc_access_rules (R282) — AU PLUS une version EN VIGUEUR par question×rôle
    {
      const doublons: any[] = await this.prisma.$queryRaw`
        SELECT r.question_id, r.role, COUNT(*) n FROM kyc_access_rules r
        JOIN kyc_questions q ON q.id = r.question_id
        JOIN kyc_sections s ON s.id = q.section_id
        JOIN kyc_files f ON f.id = s.kyc_file_id AND f.tenant_id = ${r.ctx.tenantId}::uuid
        WHERE r.effective_to IS NULL GROUP BY r.question_id, r.role HAVING COUNT(*) > 1`;
      journaux.push({ journal: "kyc_access_rules", controles: doublons.length === 0 ? 1 : doublons.length,
        statut: doublons.length ? "ROMPU" : "OK",
        ...(doublons.length ? { rompu: { ref: String(doublons[0].question_id), detail: `question ${doublons[0].question_id} × ${doublons[0].role} : ${doublons[0].n} versions en vigueur` } } : {}) });
    }
    // L'auditeur est audité : la vérification est ELLE-MÊME un AUDIT_ACCESS (SO-07)
    await emitEvent(this.prisma, r.ctx.tenantId, "AUDIT_ACCESS",
      "verification-integrite", { par: r.ctx.userId, role: r.ctx.role,
        chemin: "/v1/audit/integrite", methode: "GET" });
    return { verifieAt: new Date().toISOString(), journaux };
  }

  // SO-08 : le journal des PARAMÉTRAGES transversal — les événements de config R68 de TOUS les
  // modules, servis d'UNE source (domain_events, liste fermée de types) — aucun agrégat parallèle.
  @Get("parametrages")
  async parametrages(@Req() r: any, @Query("limite") limite?: string) {
    this.garde(r.ctx);
    const TYPES = ["param.change", "param.effet.applique", "kyc.access.modifie", "cpsi.param.applied",
      "sso.mode.bascule_demandee", "sso.mode.bascule_visee", "sso.jwks.rotation",
      "iam.cumul_so_admin.autorise", "tenant.active"];
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: r.ctx.tenantId, type: { in: TYPES } },
      orderBy: { id: "desc" }, take: Math.min(Number(limite ?? 200), 500) });
    return evs.map((e: any) => ({ at: e.at, type: e.type, cle: e.aggregateId, payload: e.payload }));
  }

  // ── SO-02 : l'export d'audit — génération de document, TRACÉE (qui, quand, périmètre). ──
  @Post("export")
  async exporter(@Req() r: any, @Body() b: any) {
    this.garde(r.ctx);
    const where: any = { tenantId: r.ctx.tenantId };
    if (b?.aggregateId) where.aggregateId = String(b.aggregateId);
    if (b?.type) where.type = String(b.type);
    const evs = await this.prisma.domainEvent.findMany({ where, orderBy: { id: "asc" }, take: 1000 });
    const genereAt = new Date().toISOString();
    await this.prisma.$transaction(async (tx: Tx) =>
      emitEvent(tx, r.ctx.tenantId, "AUDIT_EXPORT",
        b?.aggregateId ?? "tenant", { par: r.ctx.userId, role: r.ctx.role,
          perimetre: { aggregateId: b?.aggregateId ?? null, type: b?.type ?? null }, n: evs.length },
        genereAt));   // `at` = horodatage de génération de l'export (corrélé au contenu servi)
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "AUDIT_EXPORT", `${b?.aggregateId ?? "tenant"}:${evs.length}`);
    return { genereAt, n: evs.length,
      evenements: evs.map((e: any) => ({ seq: Number(e.id), type: e.type, aggregateId: e.aggregateId, at: e.at, payload: e.payload })) };
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
