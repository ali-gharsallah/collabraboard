import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException, BadGatewayException, UnprocessableEntityException } from "@nestjs/common";
import { createHash, createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycModule } from "../kyc/kyc.module";
import { KycService } from "../kyc/kyc.service";

/**
 * Module OLIVIA v1 — étape 3 du plan (spec `spec-fonctionnelle-home-olivia.md`) : R253 (port IA)
 * + modèle B.1 + OL-01..04. Doctrine : IA propose / humain décide (R44) ; le journal de conversation
 * est APPEND-ONLY chaîné (R257, trigger + record_hash) ; chaque appel sortant DÉCLARE provider,
 * modèle, version renvoyée par le fournisseur et latence (R253) ; sans configuration tenant, TOUTES
 * les routes répondent OLIVIA_PORT_OFF 503 (refus gracieux, pattern R163/R167 — jamais de simulé).
 *
 * ÉTAPE 4 : ContextBuilder (R255, OL-05..10) — le CŒUR. L'ancrage se résout VIA les services
 * existants (KycService, projection HIDDEN par rôle réutilisée — même code, pas une copie) ;
 * chaque objet est vérifié UNITAIREMENT ; un refus périphérique n'est jamais silencieux
 * (événement OLIVIA_CONTEXT_DENIED + « contexte partiel ») ; la borne olivia_scope_max_objets
 * ferme AVANT tout appel fournisseur ; l'empreinte HMAC du contexte est REPRODUCTIBLE.
 * Capacités ouvertes : C1 (ancrage optionnel + refs explicites re-vérifiées) et C2 (synthèse
 * dossier). C3/C4 restent fermées (étape 6) → OLIVIA_CAPACITE_NON_OUVERTE.
 *
 * ⚠ Écart signalé (ECARTS, étape 0) : le rôle SO n'existe pas dans l'enum ratifiée — les accès
 * « ADMIN, SO » de la spec se codent ADMIN seul tant que SO n'est pas ratifié.
 */

type Ctx = { tenantId: string; userId: string; role: string };
// Port fournisseur (R253) : l'unique voie vers l'extérieur. La version du modèle est celle
// RENVOYÉE par le fournisseur, jamais supposée.
export type Citation = { type: string; ref: string; assertion: string; valide?: boolean };
export type PortOlivia = { repondre(prompt: string): Promise<{ texte: string; modelVersion: string; citations?: Citation[] }> };
// R256 : « REGLE doit exister au catalogue » — borne haute du catalogue ratifié (à incrémenter
// avec chaque amendement ; R259-R266 = Olivia v2 ratifiée).
const CATALOGUE_MAX_REGLE = 271;   // R256 — borne du catalogue : R267-R271 (offboarding) ratifiés 2026-07-27

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const CONVERSER_C1 = ["RM", "ARM", "CO", "CO_SR", "BRM", "DIR"];          // matrice B.3 (Direction→DIR)
const CONVERSER_C2 = ["RM", "ARM", "CO", "CO_SR"];                        // matrice B.3

// Port de TEST déterministe (critère B.11.1 : « le mock est un port de test, jamais utilisé en
// prod ») — actif uniquement via OLIVIA_FAKE_PORT=1 (e2e/CI). Le marqueur TIMEOUT_TEST permet
// OL-04 sans horloge réelle côté fournisseur.
function fakePort(): PortOlivia {
  return {
    async repondre(prompt: string) {
      (globalThis as any).__oliviaFakeCalls = ((globalThis as any).__oliviaFakeCalls ?? 0) + 1;   // compteur de test (OL-08)
      if (prompt.includes("TIMEOUT_TEST")) await new Promise((r) => setTimeout(r, 60_000).unref());
      // Citations déterministes pilotées par le test : marqueurs CITE_TEST:<type>:<ref> dans la question.
      const citations = [...prompt.matchAll(/CITE_TEST:([A-Z_]+):([\w-]+)/g)]
        .map((m) => ({ type: m[1], ref: m[2], assertion: "assertion de test" }));
      return { texte: `Réponse déterministe de test (${sha(prompt).slice(0, 8)})`, modelVersion: "fake-1.0",
        ...(citations.length ? { citations } : {}) };
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
  constructor(private prisma: PrismaService, private audit: AuditService, private kyc: KycService) {}

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

  // ═══ R255 — ContextBuilder : algorithme normatif B.5 ═══
  // Retourne { objets [{type,id,v}], contenu (pour le prompt), exclus (périphériques refusés),
  // empreinte HMAC } — ou lève OLIVIA_SCOPE_DENIED (ancrage) / OLIVIA_CONTEXT_OVERFLOW (borne).
  // La vérification d'accès passe par les SERVICES existants (KycService.get = projection HIDDEN
  // par rôle) — la porte ne « rattrape » rien. Écart RM appliqué : périmètre matrice A.3
  // (Client.rmUserId) pour RM/ARM, comme les portes Home.
  private async verifierAncrageKyc(ctx: Ctx, kycFileId: string): Promise<any> {
    const file = await this.prisma.kycFile.findFirst({ where: { id: kycFileId, tenantId: ctx.tenantId } });
    if (!file) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: vous n'avez pas accès ou cet objet n'existe pas");   // OL-34 : ne révèle rien
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const c = await this.prisma.client.findFirst({ where: { id: file.clientId, tenantId: ctx.tenantId } });
      if (!c || c.rmUserId !== ctx.userId)
        throw new ForbiddenException("OLIVIA_SCOPE_DENIED: vous n'avez pas accès ou cet objet n'existe pas");
    }
    return file;
  }

  private async construireContexte(ctx: Ctx, conv: { capacite: string; ancrageId: string | null }, s: any,
    refs: { type: string; code: string }[] = []) {
    const objets: { type: string; id: string; v: string }[] = [];
    const contenu: any = {};
    let exclus = 0;
    // 1-2) Résolution de l'ancrage + expansion bornée par capacité
    if (conv.capacite === "C2" || (conv.capacite === "C1" && conv.ancrageId)) {
      const file = await this.verifierAncrageKyc(ctx, conv.ancrageId!);
      // VIA le service existant : projection par rôle — les questions HIDDEN n'atteignent JAMAIS le contexte (OL-06)
      const vue = await this.kyc.get(ctx, file.code);
      objets.push({ type: "KYC_FILE", id: file.id, v: `${vue.status}:${file.revision ?? 1}` });
      for (const sec of (vue.sections ?? []) as any[]) {
        objets.push({ type: "KYC_SECTION", id: sec.id, v: sec.code });
        for (const q of (sec.questions ?? []) as any[])
          objets.push({ type: "KYC_QUESTION", id: q.id, v: sha(JSON.stringify(q.answer ?? null)).slice(0, 12) });
      }
      for (const v of (vue.visas ?? []) as any[]) objets.push({ type: "KYC_VISA", id: v.id, v: v.status });
      if (conv.capacite === "C2") contenu.dossier = { code: vue.code, statut: vue.status,
        sections: (vue.sections ?? []).map((x: any) => ({ code: x.code,
          questions: (x.questions ?? []).map((q: any) => ({ code: q.code, valeur: q.answer ?? null })) })),
        visas: (vue.visas ?? []).map((x: any) => ({ section: x.sectionCode, statut: x.status })) };
      else contenu.ancrage = { code: vue.code, statut: vue.status };
    }
    // 2-3) C1 : objets EXPLICITEMENT référencés — chacun re-vérifié individuellement (§3).
    for (const ref of refs) {
      if (ref.type !== "KYC_FILE") { exclus++; continue; }                 // type non pris en charge = exclu, tracé
      const file = await this.prisma.kycFile.findFirst({ where: { code: ref.code, tenantId: ctx.tenantId } });
      let refuse = !file;
      if (file && (ctx.role === "RM" || ctx.role === "ARM")) {
        const c = await this.prisma.client.findFirst({ where: { id: file.clientId, tenantId: ctx.tenantId } });
        refuse = !c || c.rmUserId !== ctx.userId;
      }
      if (refuse) {                                                        // refus périphérique : PAS silencieux (OL-07)
        exclus++;
        await this.prisma.$transaction(async (tx: any) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", ref.code, { qui: ctx.userId, quoi: ref.type, pourquoi: "hors périmètre ou inexistant" }));
        continue;
      }
      objets.push({ type: "KYC_FILE", id: file!.id, v: `${file!.status}` });
      (contenu.references ??= []).push({ code: file!.code, statut: file!.status });
    }
    // 4) Borne — AVANT tout appel fournisseur (OL-08)
    const max = s.oliviaScopeMaxObjets ?? 50;
    if (objets.length > max)
      throw new UnprocessableEntityException(`OLIVIA_CONTEXT_OVERFLOW: ${objets.length} objets > ${max} — restreignez le périmètre`);
    // 5) Empreinte HMAC reproductible (OL-09) : canonical_json trié de (liste + versions)
    const canonical = JSON.stringify([...objets].sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id)));
    const empreinte = createHmac("sha256", process.env.OLIVIA_AUDIT_SECRET ?? "olive-audit-dev").update(canonical).digest("hex");
    return { objets: objets.map(({ type, id }) => ({ type, id })), contenu, exclus, empreinte };
  }

  // ── Création de conversation — étape 4 : C1 (ancrage optionnel) et C2 (ancrage KYC_FILE requis).
  // L'accès à l'ancrage est vérifié AVANT toute création (OL-05) : refus = 403 + événement
  // OLIVIA_CONTEXT_DENIED + AUCUNE conversation. C3/C4 restent fermées (étape 6). ──
  async creerConversation(ctx: Ctx, dto: { capacite?: string; ancrageType?: string; ancrageId?: string }) {
    await this.port(ctx.tenantId);                                        // OL-01 : porte fermée = 503 partout
    const cap = dto?.capacite;
    if (cap !== "C1" && cap !== "C2")
      throw new BadRequestException("OLIVIA_CAPACITE_NON_OUVERTE: C3/C4 ouvrent à l'étape 6 (propositions)");
    const roles = cap === "C1" ? CONVERSER_C1 : CONVERSER_C2;
    if (!roles.includes(ctx.role)) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: rôle non autorisé à converser (matrice B.3)");
    if (cap === "C2" && (dto?.ancrageType !== "KYC_FILE" || !dto?.ancrageId))
      throw new BadRequestException("C2 exige un ancrage KYC_FILE");
    if (dto?.ancrageId && dto?.ancrageType !== "KYC_FILE")
      throw new BadRequestException("Ancrage non pris en charge (v1 : KYC_FILE)");
    if (dto?.ancrageId) {
      try { await this.verifierAncrageKyc(ctx, dto.ancrageId); }
      catch (e) {                                                          // OL-05 : événement, AUCUNE conversation
        await this.prisma.$transaction(async (tx: any) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", dto.ancrageId!, { qui: ctx.userId, quoi: "KYC_FILE", pourquoi: "ancrage hors périmètre ou inexistant" }));
        throw e;
      }
    }
    const conv = await this.prisma.oliviaConversation.create({ data: {
      tenantId: ctx.tenantId, userId: ctx.userId, roleCode: ctx.role, capacite: cap,
      ancrageType: dto?.ancrageId ? "KYC_FILE" : null, ancrageId: dto?.ancrageId ?? null } });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_CONVERSATION_CREATED", conv.id);
    return { id: conv.id, capacite: conv.capacite, ancrageType: conv.ancrageType, ancrageId: conv.ancrageId, statut: conv.statut };
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

    // R255 : le contexte objet est re-résolu à CHAQUE tour (B.5) — borne AVANT l'appel fournisseur.
    const cx = await this.construireContexte(ctx, { capacite: conv.capacite, ancrageId: conv.ancrageId }, s, (dto as any).refs ?? []);
    // Gabarit versionné PAR CAPACITÉ (paramètre tenant R68 ; défaut livré — jamais de persona en dur ailleurs).
    const defauts: Record<string, string> = {
      C1: "Tu es Olivia, assistante compliance d'O-Live. Réponds sobrement, sans agir. Contexte: {contexte}. Question: {question}",
      C2: "Tu es Olivia, assistante compliance d'O-Live. Synthèse structurée et sourcée du dossier, sans agir. Dossier: {contexte}. Demande: {question}",
    };
    const gabarit = s.oliviaPromptTemplate?.[conv.capacite] ?? defauts[conv.capacite] ?? defauts.C1;
    const prompt = gabarit.replace("{contexte}", JSON.stringify(cx.contenu)).replace("{question}", dto.texte);

    const t0 = Date.now();
    let sortie: { texte: string; modelVersion: string; citations?: Citation[] } | null = null; let echec: string | null = null;
    try {
      sortie = await Promise.race([
        port.repondre(prompt),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs).unref()),
      ]);
    } catch (e) { echec = (e as Error).message; }
    const latence = Date.now() - t0;

    // R256 : vérification des citations sur la sortie COMPLÈTE — chaque ref doit exister DANS le
    // contexte transmis (on ne cite pas ce qu'on n'a pas montré) ; REGLE doit exister au catalogue.
    // ≥1 citation valide ⇒ est_source=true ; sinon « Non sourcé » (et jamais proposable, étape 6).
    const idsContexte = new Set(cx.objets.map((o: any) => o.id));
    const citations: Citation[] = (sortie?.citations ?? []).map((c) => ({ ...c,
      valide: c.type === "REGLE"
        ? /^R[1-9][0-9]{0,2}$/.test(c.ref) && Number(c.ref.slice(1)) <= CATALOGUE_MAX_REGLE
        : idsContexte.has(c.ref) }));
    const estSource = citations.some((c) => c.valide);

    // OUT journalisé dans TOUS les cas (OL-04 : « un OUT d'erreur est aussi un événement », seq consommé).
    const msgOut = await this.prisma.$transaction(async (tx: any) => {
      const { seq, hash } = await this.dernierHash(tx, conv.id);
      const texte = sortie ? sortie.texte : `ÉCHEC FOURNISSEUR: ${echec}`;
      const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
        seq, direction: "OUT", texte, provider, model,
        modelVersion: sortie?.modelVersion ?? null, latenceMs: latence,
        estSource, citations: citations as any,                            // R256 : vérifiées, stockées avec leur verdict
        contexteEmpreinte: cx.empreinte, contexteObjets: cx.objets,        // R255 : la LISTE, prouvable + HMAC
        prevHash: hash, recordHash: this.chain(hash, { seq, direction: "OUT", texte, provider, model, empreinte: cx.empreinte }) } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_OUT", conv.id, { messageId: m.id, seq, provider, model, latenceMs: latence, echec, empreinte: cx.empreinte });
      return m;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_MESSAGE", `${conv.id}:${msgIn.seq}/${msgOut.seq}`);
    if (echec) throw new BadGatewayException(`OLIVIA_PROVIDER_DOWN: ${echec}`);
    return { conversationId: conv.id, seq: msgOut.seq, texte: msgOut.texte,
      provider, model, modelVersion: msgOut.modelVersion, latenceMs: latence,
      estSource, citations,
      contexteEmpreinte: cx.empreinte, contexteObjets: cx.objets,
      contextePartiel: cx.exclus > 0 ? `Réponse fondée sur un contexte partiel : ${cx.exclus} objet(s) exclu(s)` : null };
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

  // ── Lecture des propositions (B.2) — socle T10 Home ; la décision (adopt/reject) arrive à l'étape 6. ──
  async listerProposals(ctx: Ctx, statut?: string) {
    await this.port(ctx.tenantId);                                        // contrat OL-01 : porte fermée = 503 partout
    if (ctx.role === "ADMIN") throw new ForbiddenException("OLIVIA_SCOPE_DENIED: ADMIN ne lit pas les propositions métier");
    const where: any = { tenantId: ctx.tenantId };
    if (statut) where.statut = statut;
    return this.prisma.oliviaProposal.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
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
  @Get("proposals")                         proposals(@Req() r: any, @Query("statut") statut?: string) { return this.svc.listerProposals(r.ctx, statut); }
  @Get("health")                            health(@Req() r: any) { return this.svc.health(r.ctx); }
}

@Module({
  imports: [KycModule],                                                    // R255 : l'ancrage se résout VIA les services existants
  controllers: [OliviaController],
  providers: [
    PrismaService, AuditService,
    { provide: OliviaService, useFactory: (p: PrismaService, a: AuditService, k: KycService) => new OliviaService(p, a, k), inject: [PrismaService, AuditService, KycService] }],
  exports: [OliviaService],
})
export class OliviaModule {}
