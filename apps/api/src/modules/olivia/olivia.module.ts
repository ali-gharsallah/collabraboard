import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException, BadGatewayException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Module OLIVIA v1 — étape 3 du plan (spec `spec-fonctionnelle-home-olivia.md`) : R253 (port IA)
 * + modèle B.1 + OL-01..04. Doctrine : IA propose / humain décide (R44) ; le journal de conversation
 * est APPEND-ONLY chaîné (R257, trigger + record_hash) ; chaque appel sortant DÉCLARE provider,
 * modèle, version renvoyée par le fournisseur et latence (R253) ; sans configuration tenant, TOUTES
 * les routes répondent OLIVIA_PORT_OFF 503 (refus gracieux, pattern R163/R167 — jamais de simulé).
 *
 * ÉTAPE 3 SEULEMENT : capacité C1 SANS ancrage. Les ancrages et l'expansion de contexte arrivent
 * avec le ContextBuilder (R255, étape 4) — « aucune capacité ouverte avant qu'il soit vert »
 * (ordre de bataille) : C2/C3/C4 et tout ancrage → refus typé OLIVIA_CAPACITE_NON_OUVERTE.
 *
 * ⚠ Écart signalé (ECARTS, étape 0) : le rôle SO n'existe pas dans l'enum ratifiée — les accès
 * « ADMIN, SO » de la spec se codent ADMIN seul tant que SO n'est pas ratifié.
 */

type Ctx = { tenantId: string; userId: string; role: string };
// Port fournisseur (R253) : l'unique voie vers l'extérieur. La version du modèle est celle
// RENVOYÉE par le fournisseur, jamais supposée.
export type PortOlivia = { repondre(prompt: string): Promise<{ texte: string; modelVersion: string }> };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const CONVERSER_C1 = ["RM", "ARM", "CO", "CO_SR", "BRM", "DIR"];          // matrice B.3 (Direction→DIR)

// Port de TEST déterministe (critère B.11.1 : « le mock est un port de test, jamais utilisé en
// prod ») — actif uniquement via OLIVIA_FAKE_PORT=1 (e2e/CI). Le marqueur TIMEOUT_TEST permet
// OL-04 sans horloge réelle côté fournisseur.
function fakePort(): PortOlivia {
  return {
    async repondre(prompt: string) {
      if (prompt.includes("TIMEOUT_TEST")) await new Promise((r) => setTimeout(r, 60_000).unref());
      return { texte: `Réponse déterministe de test (${sha(prompt).slice(0, 8)})`, modelVersion: "fake-1.0" };
    },
  };
}

// Port réel Anthropic (serveur uniquement — la clé ne transite jamais vers le front, B.11.4).
function anthropicPort(model: string): PortOlivia {
  return {
    async repondre(prompt: string) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`fournisseur ${res.status}`);
      const j: any = await res.json();
      return { texte: (j.content ?? []).map((c: any) => c.text ?? "").join(""), modelVersion: j.model ?? model };
    },
  };
}

@Injectable()
export class OliviaService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async settings(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return (t.settings as any) ?? {};
  }
  // R253 : la porte n'est ouverte que si le TENANT est configuré (référence, jamais le secret —
  // pattern R163) ET qu'un port serveur existe (clé env ou port de test).
  private async port(tenantId: string): Promise<{ port: PortOlivia; provider: string; model: string; timeoutMs: number; s: any }> {
    const s = await this.settings(tenantId);
    const provider = s.oliviaProviderRef; const model = s.oliviaModel;
    const fake = process.env.OLIVIA_FAKE_PORT === "1";
    if (!provider || !model || (!fake && !process.env.ANTHROPIC_API_KEY))
      throw new ServiceUnavailableException("OLIVIA_PORT_OFF: Olivia n'est pas activée pour ce tenant");
    return { port: fake ? fakePort() : anthropicPort(model), provider, model, timeoutMs: s.oliviaTimeoutMs ?? 30000, s };
  }
  // Chaînage append-only (R257) : record_hash = sha256(prev_hash + champs saillants).
  private chain(prev: string | null, fields: any) {
    return sha((prev ?? "") + JSON.stringify(fields));
  }
  private async dernierHash(tx: any, conversationId: string): Promise<{ seq: number; hash: string | null }> {
    const last = await tx.oliviaMessage.findFirst({ where: { conversationId }, orderBy: { seq: "desc" } });
    return { seq: (last?.seq ?? 0) + 1, hash: last?.recordHash ?? null };
  }

  // ── Création de conversation — étape 3 : C1 sans ancrage uniquement. ──
  async creerConversation(ctx: Ctx, dto: { capacite?: string; ancrageType?: string; ancrageId?: string }) {
    await this.port(ctx.tenantId);                                        // OL-01 : porte fermée = 503 partout
    const cap = dto?.capacite;
    if (cap !== "C1" || dto?.ancrageType || dto?.ancrageId)
      throw new BadRequestException("OLIVIA_CAPACITE_NON_OUVERTE: seule C1 sans ancrage est ouverte avant le ContextBuilder (R255, étape 4)");
    if (!CONVERSER_C1.includes(ctx.role)) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: rôle non autorisé à converser (matrice B.3)");
    const conv = await this.prisma.oliviaConversation.create({ data: {
      tenantId: ctx.tenantId, userId: ctx.userId, roleCode: ctx.role, capacite: "C1" } });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_CONVERSATION_CREATED", conv.id);
    return { id: conv.id, capacite: conv.capacite, statut: conv.statut };
  }

  // ── R253/OL-02/OL-04 : envoyer un message — IN journalisé, appel déclaré, OUT journalisé. ──
  async envoyerMessage(ctx: Ctx, conversationId: string, dto: { texte?: string }) {
    const { port, provider, model, timeoutMs, s } = await this.port(ctx.tenantId);
    if (!dto?.texte?.trim()) throw new BadRequestException("texte requis");
    const conv = await this.prisma.oliviaConversation.findFirst({ where: { id: conversationId, tenantId: ctx.tenantId } });
    if (!conv) throw new NotFoundException("Conversation introuvable");   // OL-10 : cross-tenant = 404
    if (conv.userId !== ctx.userId) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: seul le propriétaire converse");
    if (conv.statut !== "OUVERTE") throw new BadRequestException("Conversation fermée");

    // IN journalisé d'abord (append-only chaîné)
    const msgIn = await this.prisma.$transaction(async (tx: any) => {
      const { seq, hash } = await this.dernierHash(tx, conv.id);
      const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
        seq, direction: "IN", texte: dto.texte!, prevHash: hash,
        recordHash: this.chain(hash, { seq, direction: "IN", texte: dto.texte }) } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_IN", conv.id, { messageId: m.id, seq });
      return m;
    });

    // Gabarit versionné (paramètre tenant R68 ; défaut livré — jamais de persona en dur ailleurs).
    const gabarit = s.oliviaPromptTemplate?.C1 ?? "Tu es Olivia, assistante compliance d'O-Live. Réponds sobrement, sans agir: {question}";
    const prompt = gabarit.replace("{question}", dto.texte);

    const t0 = Date.now();
    let sortie: { texte: string; modelVersion: string } | null = null; let echec: string | null = null;
    try {
      sortie = await Promise.race([
        port.repondre(prompt),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs).unref()),
      ]);
    } catch (e) { echec = (e as Error).message; }
    const latence = Date.now() - t0;

    // OUT journalisé dans TOUS les cas (OL-04 : « un OUT d'erreur est aussi un événement », seq consommé).
    const msgOut = await this.prisma.$transaction(async (tx: any) => {
      const { seq, hash } = await this.dernierHash(tx, conv.id);
      const texte = sortie ? sortie.texte : `ÉCHEC FOURNISSEUR: ${echec}`;
      const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
        seq, direction: "OUT", texte, provider, model,
        modelVersion: sortie?.modelVersion ?? null, latenceMs: latence, estSource: false,   // R256 : citations à l'étape 5
        prevHash: hash, recordHash: this.chain(hash, { seq, direction: "OUT", texte, provider, model }) } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_OUT", conv.id, { messageId: m.id, seq, provider, model, latenceMs: latence, echec });
      return m;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_MESSAGE", `${conv.id}:${msgIn.seq}/${msgOut.seq}`);
    if (echec) throw new BadGatewayException(`OLIVIA_PROVIDER_DOWN: ${echec}`);
    return { conversationId: conv.id, seq: msgOut.seq, texte: msgOut.texte,
      provider, model, modelVersion: msgOut.modelVersion, latenceMs: latence, estSource: msgOut.estSource };
  }

  // ── Historique (propriétaire ; ADMIN en audit — écart SO). ──
  async conversation(ctx: Ctx, id: string) {
    const conv = await this.prisma.oliviaConversation.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!conv) throw new NotFoundException("Conversation introuvable");
    if (conv.userId !== ctx.userId && ctx.role !== "ADMIN") throw new ForbiddenException("OLIVIA_SCOPE_DENIED");
    const messages = await this.prisma.oliviaMessage.findMany({ where: { conversationId: id }, orderBy: { seq: "asc" } });
    return { ...conv, messages };
  }

  // ── R257/OL-03 : rejeu à date — messages ≤ as_of, chaînage vérifié de bout en bout. ──
  async replay(ctx: Ctx, id: string, asOf?: string) {
    if (ctx.role !== "ADMIN" && !["CO", "CO_SR", "MLRO"].includes(ctx.role)) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: rejeu réservé à l'audit");
    const conv = await this.prisma.oliviaConversation.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!conv) throw new NotFoundException("Conversation introuvable");
    let messages = await this.prisma.oliviaMessage.findMany({ where: { conversationId: id }, orderBy: { seq: "asc" } });
    if (asOf) messages = messages.filter((m: any) => m.createdAt <= new Date(asOf));
    // Vérification du chaînage (R257) — toute rupture est une preuve d'altération.
    let prev: string | null = null;
    for (const m of messages) {
      if ((m.prevHash ?? null) !== prev) throw new BadRequestException(`OLIVIA_CHAIN_BROKEN: seq ${m.seq}`);
      prev = m.recordHash;
    }
    return { conversationId: id, asOf: asOf ?? null, chaineVerifiee: true,
      messages: messages.map((m: any) => ({ seq: m.seq, direction: m.direction, texte: m.texte,
        provider: m.provider, model: m.model, modelVersion: m.modelVersion,
        contexteEmpreinte: m.contexteEmpreinte, contexteObjets: m.contexteObjets, citations: m.citations, at: m.createdAt })) };
  }

  // ── Santé (ADMIN — écart SO) : port configuré, provider/model, latence médiane. ──
  async health(ctx: Ctx) {
    if (ctx.role !== "ADMIN") throw new ForbiddenException("OLIVIA_SCOPE_DENIED");
    const { provider, model } = await this.port(ctx.tenantId);            // 503 si porte fermée (contrat OL-01 : TOUTES les routes)
    const outs = await this.prisma.oliviaMessage.findMany({ where: { tenantId: ctx.tenantId, direction: "OUT", latenceMs: { not: null } },
      orderBy: { createdAt: "desc" }, take: 101 });
    const lat = outs.map((o: any) => o.latenceMs).sort((a: number, b: number) => a - b);
    return { configured: true, provider, model, latenceMedianeMs: lat.length ? lat[Math.floor(lat.length / 2)] : null };
  }
}

@Controller("olivia")
export class OliviaController {
  constructor(private svc: OliviaService) {}
  @Post("conversations")                    creer(@Req() r: any, @Body() b: any) { return this.svc.creerConversation(r.ctx, b); }
  @Post("conversations/:id/messages")       envoyer(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.envoyerMessage(r.ctx, id, b); }
  @Get("conversations/:id/replay")          replay(@Req() r: any, @Param("id") id: string, @Query("as_of") asOf?: string) { return this.svc.replay(r.ctx, id, asOf); }
  @Get("conversations/:id")                 lire(@Req() r: any, @Param("id") id: string) { return this.svc.conversation(r.ctx, id); }
  @Get("health")                            health(@Req() r: any) { return this.svc.health(r.ctx); }
}

@Module({
  controllers: [OliviaController],
  providers: [
    PrismaService, AuditService,
    { provide: OliviaService, useFactory: (p: PrismaService, a: AuditService) => new OliviaService(p, a), inject: [PrismaService, AuditService] }],
  exports: [OliviaService],
})
export class OliviaModule {}
