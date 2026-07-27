import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ForbiddenException, ServiceUnavailableException, BadGatewayException, UnprocessableEntityException, ConflictException } from "@nestjs/common";
import { createHash, createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycModule } from "../kyc/kyc.module";
import { CpsiModule, CpsiService } from "../cpsi/cpsi.module";
import { KycService } from "../kyc/kyc.service";
import * as GABARITS_LIVRES from "./olivia-gabarits.default.json"; // B.11.6 — gabarits C1..C4 livrés, versionnés
import { Tx } from "../../common/tx";

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
export type PortOlivia = { repondre(prompt: string): Promise<{ texte: string; modelVersion: string; citations?: Citation[]; interrompu?: boolean }> };
// R256 : « REGLE doit exister au catalogue » — borne haute du catalogue ratifié (à incrémenter
// avec chaque amendement ; R259-R266 = Olivia v2 ratifiée).
const CATALOGUE_MAX_REGLE = 271;   // R256 — borne du catalogue : R267-R271 (offboarding) ratifiés 2026-07-27

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
// ═══ R258 — le comportement est un CONTRAT : détecteurs DÉTERMINISTES sur lexiques LIVRÉS ═══
const G: any = GABARITS_LIVRES;
function detecterLangue(texte: string): string {
  const t = ` ${texte.toLowerCase()} `;
  const marque = (mots: string[]) => mots.reduce((n, m) => n + (t.includes(` ${m} `) ? 1 : 0), 0);
  const scores: [string, number][] = [
    ["DE", marque(["der", "die", "das", "und", "ist", "nicht", "welche", "bitte", "für", "wie"])],
    ["EN", marque(["the", "is", "what", "which", "please", "and", "not", "for", "does"])],
    ["IT", marque(["che", "di", "il", "per", "sono", "quale", "non", "come", "della"])],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : "FR";
}
const estHorsPerimetre = (texte: string) =>
  (G.horsPerimetre as string[]).some((m) => texte.toLowerCase().includes(m));
const detecterInjection = (contenu: string) =>
  (G.injectionMarqueurs as string[]).find((m) => contenu.toLowerCase().includes(m)) ?? null;
const detecterRecoProse = (texte: string) =>
  (G.recoProse.prescriptifs as string[]).some((m) => texte.toLowerCase().includes(m));
const CONVERSER_C1 = ["RM", "ARM", "CO", "CO_SR", "BRM", "DIR"];          // matrice B.3 (Direction→DIR)
const CONVERSER_C2 = ["RM", "ARM", "CO", "CO_SR"];                        // matrice B.3
const CONVERSER_C3 = ["CO", "CO_SR"];                                     // matrice B.3 — pré-analyse alerte/risk case
const CONVERSER_C4 = ["CO_SR", "ADMIN"];                                  // matrice B.3 — paramétrage (lecture BRM : v1.1)
// R254 — décideurs par type de proposition (B.3, default-deny : même ADMIN ne décide pas hors liste).
// AIGUILLAGE_EDD « selon workflow existant » : CO_SR (le circuit R66 est CPSI/compliance).
const DECIDEURS = (type: string): string[] =>
  type.startsWith("QUALIF_ALERTE") ? ["CO_SR"]
  : type === "AIGUILLAGE_EDD" || type === "ALLEGEMENT_EDD" ? ["CO_SR"]
  : type === "AJUSTEMENT_PARAM" ? ["ADMIN", "CO_SR"] : [];
const TYPES_PROPOSITION = /^(QUALIF_ALERTE_[A-Z_]+|AIGUILLAGE_EDD|ALLEGEMENT_EDD|AJUSTEMENT_PARAM)$/;
const CIBLES_PROPOSITION = ["ALERTE", "KYC_FILE", "PARAM"];

// Port de TEST déterministe (critère B.11.1 : « le mock est un port de test, jamais utilisé en
// prod ») — actif uniquement via OLIVIA_FAKE_PORT=1 (e2e/CI). Le marqueur TIMEOUT_TEST permet
// OL-04 sans horloge réelle côté fournisseur.
function fakePort(): PortOlivia {
  return {
    async repondre(prompt: string) {
      (globalThis as any).__oliviaFakeCalls = ((globalThis as any).__oliviaFakeCalls ?? 0) + 1;   // compteur de test (OL-08/OL-32)
      (globalThis as any).__oliviaLastPrompt = prompt;                                            // inspection de la fenêtre (OL-27)
      // Les marqueurs de test ne valent que pour la QUESTION COURANTE — la fenêtre multi-tour
      // (v1.1/A.4) rejoue les tours passés dans le prompt, leurs marqueurs ne doivent pas re-agir.
      const question = prompt.split(/Question:|Demande:/).pop() ?? prompt;
      if (question.includes("TIMEOUT_TEST")) await new Promise((r) => setTimeout(r, 60_000).unref());
      if (question.includes("STREAM_INTERROMPU_TEST"))                                            // OL-31 : coupure simulée à 40 %
        return { texte: "Début de réponse coupée à 40 % —", modelVersion: "fake-1.0", interrompu: true };
      if (question.includes("RECO_PROSE_TEST"))                                                   // OL-24 : prescriptif, même après correctif
        return { texte: "Vous devriez classer cette alerte comme non fondée immédiatement.", modelVersion: "fake-1.0",
          citations: [{ type: "REGLE", ref: "R80", assertion: "seuil" }] };
      // Citations déterministes pilotées par le test : marqueurs CITE_TEST:<type>:<ref> dans la question.
      const citations = [...question.matchAll(/CITE_TEST:([A-Z_]+):([\w-]+)/g)]
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
  constructor(private prisma: PrismaService, private audit: AuditService, private kyc: KycService,
    private cpsi?: { score(ctx: Ctx, clientId: string, asOf?: string): Promise<any>; regles(ctx: Ctx, asOf?: string): Promise<any>; proposer(ctx: Ctx, dto: { chemin: string; valeur: any; justification?: string }): Promise<any> }) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
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
  private async dernierHash(tx: Tx, conversationId: string): Promise<{ seq: number; hash: string | null }> {
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

  // PUBLIC depuis v2 (R261) : le swarm importe LE MÊME ContextBuilder — même code, pas une copie.
  async construireContexte(ctx: Ctx, conv: { capacite: string; ancrageId: string | null }, s: any,
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
    // 2) C3 (B.5-2) : risk case ancré (vérifié) → signaux + score CPSI/drivers en PÉRIPHÉRIQUE —
    // porte CPSI indisponible ou client non enregistré = objet EXCLU, tracé, « contexte partiel »
    // (OL-07 re-prouvé sur C3, comme consigné en ECARTS — jamais un échec silencieux).
    if (conv.capacite === "C3" && conv.ancrageId) {
      const rc = await this.prisma.riskCase.findFirst({ where: { id: conv.ancrageId, tenantId: ctx.tenantId } });
      if (!rc) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: vous n'avez pas accès ou cet objet n'existe pas");
      objets.push({ type: "RISK_CASE", id: rc.id, v: rc.statut });
      contenu.riskCase = { id: rc.id, statut: rc.statut, clientId: rc.clientId, signaux: rc.signalIds };
      try {
        const score = await this.cpsi!.score(ctx, rc.clientId);
        objets.push({ type: "CPSI_SCORE", id: rc.clientId, v: sha(JSON.stringify(score)).slice(0, 12) });
        contenu.scoreCpsi = score;                                        // score + drivers (R67)
      } catch {
        exclus++;
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", rc.clientId, { qui: ctx.userId, quoi: "CPSI_SCORE", pourquoi: "porte CPSI indisponible ou client non enregistré" }));
      }
    }
    // 2) C4 (B.5-2) : paramètre visé → règles en vigueur via la porte CPSI (périphérique, même règle).
    if (conv.capacite === "C4" && conv.ancrageId) {
      objets.push({ type: "PARAM", id: conv.ancrageId, v: "en_vigueur" });
      contenu.parametre = { chemin: conv.ancrageId };
      try {
        const r = await this.cpsi!.regles(ctx);
        objets.push({ type: "CPSI_RULES", id: "rules", v: sha(JSON.stringify(r)).slice(0, 12) });
        contenu.reglesEnVigueur = r;
      } catch {
        exclus++;
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", conv.ancrageId!, { qui: ctx.userId, quoi: "CPSI_RULES", pourquoi: "porte CPSI indisponible" }));
      }
    }
    // 2-3) C1 : objets EXPLICITEMENT référencés — chacun re-vérifié individuellement (§3).
    for (const ref of refs) {
      // R270/OF-08 : dossier de clôture référencé — le cloisonnement art. 10a s'applique AUSSI ici :
      // motif_sensible/mros_ref n'entrent dans le contexte QUE pour les rôles habilités.
      if (ref.type === "OFFBOARDING") {
        const off = await this.prisma.offboardingFile.findFirst({ where: { id: ref.code, tenantId: ctx.tenantId } });
        let refuseOff = !off;
        if (off && (ctx.role === "RM" || ctx.role === "ARM")) {
          const c = await this.prisma.client.findFirst({ where: { id: off.clientId, tenantId: ctx.tenantId } });
          refuseOff = !c || c.rmUserId !== ctx.userId;
        }
        if (refuseOff) {
          exclus++;
          await this.prisma.$transaction(async (tx: Tx) =>
            this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", ref.code, { qui: ctx.userId, quoi: ref.type, pourquoi: "hors périmètre ou inexistant" }));
          continue;
        }
        objets.push({ type: "OFFBOARDING", id: off!.id, v: off!.statut });
        const objetOff: any = { id: off!.id, type: off!.type, statut: off!.statut, motif: off!.motif };
        const habilites: string[] = s.rolesMotifSensible ?? ["CO_SR", "MLRO"];
        if (habilites.includes(ctx.role)) {
          const sens = await this.prisma.offboardingSensible.findFirst({ where: { offboardingId: off!.id, tenantId: ctx.tenantId } });
          if (sens) { objetOff.motifSensible = sens.motifSensible; objetOff.mrosRef = sens.mrosRef; }
        }
        (contenu.clotures ??= []).push(objetOff);
        continue;
      }
      if (ref.type !== "KYC_FILE") { exclus++; continue; }                 // type non pris en charge = exclu, tracé
      const file = await this.prisma.kycFile.findFirst({ where: { code: ref.code, tenantId: ctx.tenantId } });
      let refuse = !file;
      if (file && (ctx.role === "RM" || ctx.role === "ARM")) {
        const c = await this.prisma.client.findFirst({ where: { id: file.clientId, tenantId: ctx.tenantId } });
        refuse = !c || c.rmUserId !== ctx.userId;
      }
      if (refuse) {                                                        // refus périphérique : PAS silencieux (OL-07)
        exclus++;
        await this.prisma.$transaction(async (tx: Tx) =>
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
    if (cap !== "C1" && cap !== "C2" && cap !== "C3" && cap !== "C4")
      throw new BadRequestException("OLIVIA_CAPACITE_NON_OUVERTE: capacité inconnue");
    // B.9 : activation FINE par tenant (oliviaCapacitesActives, défaut : toutes)
    const actives: string[] = (await this.settings(ctx.tenantId)).oliviaCapacitesActives ?? ["C1", "C2", "C3", "C4"];
    if (!actives.includes(cap))
      throw new BadRequestException(`OLIVIA_CAPACITE_NON_OUVERTE: ${cap} désactivée pour ce tenant`);
    const roles = cap === "C1" ? CONVERSER_C1 : cap === "C2" ? CONVERSER_C2 : cap === "C3" ? CONVERSER_C3 : CONVERSER_C4;
    if (!roles.includes(ctx.role)) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: rôle non autorisé à converser (matrice B.3)");
    if (cap === "C2" && (dto?.ancrageType !== "KYC_FILE" || !dto?.ancrageId))
      throw new BadRequestException("C2 exige un ancrage KYC_FILE");
    // C3 : ancrage RISK_CASE requis (écart signalé : « alerte scorée » n'est pas un objet en base —
    // projection du journal CPSI — l'ancrage v1 est le risk case ; l'alerte reste une CIBLE de
    // proposition, cf. OL-19). C4 : ancrage PARAM (chemin du paramètre visé).
    if (cap === "C3" && (dto?.ancrageType !== "RISK_CASE" || !dto?.ancrageId))
      throw new BadRequestException("C3 exige un ancrage RISK_CASE");
    if (cap === "C4" && (dto?.ancrageType !== "PARAM" || !dto?.ancrageId))
      throw new BadRequestException("C4 exige un ancrage PARAM (chemin du paramètre)");
    if (dto?.ancrageId && cap === "C1" && dto?.ancrageType !== "KYC_FILE")
      throw new BadRequestException("Ancrage non pris en charge (C1 : KYC_FILE)");
    if (dto?.ancrageId && dto?.ancrageType === "KYC_FILE") {
      try { await this.verifierAncrageKyc(ctx, dto.ancrageId); }
      catch (e) {                                                          // OL-05 : événement, AUCUNE conversation
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", dto.ancrageId!, { qui: ctx.userId, quoi: "KYC_FILE", pourquoi: "ancrage hors périmètre ou inexistant" }));
        throw e;
      }
    }
    if (dto?.ancrageType === "RISK_CASE") {                                // C3 : vérifié AVANT création (OL-05)
      const rc = await this.prisma.riskCase.findFirst({ where: { id: dto.ancrageId!, tenantId: ctx.tenantId } });
      if (!rc) {
        await this.prisma.$transaction(async (tx: Tx) =>
          this.emit(tx, ctx.tenantId, "OLIVIA_CONTEXT_DENIED", dto.ancrageId!, { qui: ctx.userId, quoi: "RISK_CASE", pourquoi: "ancrage hors périmètre ou inexistant" }));
        throw new ForbiddenException("OLIVIA_SCOPE_DENIED: vous n'avez pas accès ou cet objet n'existe pas");
      }
    }
    const conv = await this.prisma.oliviaConversation.create({ data: {
      tenantId: ctx.tenantId, userId: ctx.userId, roleCode: ctx.role, capacite: cap,
      ancrageType: dto?.ancrageId ? dto!.ancrageType! : null, ancrageId: dto?.ancrageId ?? null } });
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
    // OL-30 (R258/A.4) : le rôle est FIGÉ à la création — s'il a changé, la conversation FERME
    // automatiquement (motif tracé) : pas de conversation qui survit à son périmètre.
    if (conv.statut === "OUVERTE" && conv.roleCode !== ctx.role) {
      await this.prisma.$transaction(async (tx: Tx) => {
        await tx.oliviaConversation.update({ where: { id: conv.id }, data: { statut: "FERMEE" } });
        await this.emit(tx, ctx.tenantId, "OLIVIA_CONVERSATION_FERMEE", conv.id,
          { motif: "rôle modifié", roleFige: conv.roleCode, roleCourant: ctx.role });
      });
      throw new ConflictException("OLIVIA_CONVERSATION_FERMEE: rôle modifié — la conversation ne survit pas à son périmètre");
    }
    if (conv.statut !== "OUVERTE") throw new ConflictException("OLIVIA_CONVERSATION_FERMEE: conversation fermée");

    // IN journalisé d'abord (append-only chaîné)
    const msgIn = await this.prisma.$transaction(async (tx: Tx) => {
      const { seq, hash } = await this.dernierHash(tx, conv.id);
      const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
        seq, direction: "IN", texte: dto.texte!, prevHash: hash,
        recordHash: this.chain(hash, { seq, direction: "IN", texte: dto.texte }) } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_IN", conv.id, { messageId: m.id, seq });
      return m;
    });

    // R258/A.3 : la langue SUIT le message si active ; sinon défaut + excuse contractuelle (OL-25/26)
    const languesActives: string[] = s.oliviaLanguesActives ?? ["FR", "DE", "EN"];
    const langueDefaut: string = s.oliviaLangueDefaut ?? "FR";
    const langueDemandee = detecterLangue(dto.texte);
    const langue = languesActives.includes(langueDemandee) ? langueDemandee : langueDefaut;
    const personaVersion: string = s.oliviaPersona?.version ?? (G.version as string);
    // OL-32 (A.6) : hors périmètre = refus CONTRACTUEL en 1 phrase — ZÉRO expansion de contexte,
    // ZÉRO appel fournisseur ; l'échange est journalisé normalement.
    if (estHorsPerimetre(dto.texte)) {
      const refus = (G.refusHorsPerimetre[langue] ?? G.refusHorsPerimetre.FR) as string;
      const msgRefus = await this.prisma.$transaction(async (tx: Tx) => {
        const { seq, hash } = await this.dernierHash(tx, conv.id);
        const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
          seq, direction: "OUT", texte: refus, provider, model, personaVersion, langue,
          estSource: false, citations: [], contexteObjets: [], statutStream: "COMPLET",
          prevHash: hash, recordHash: this.chain(hash, { seq, direction: "OUT", texte: refus }) } });
        await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_OUT", conv.id, { messageId: m.id, seq, horsPerimetre: true });
        return m;
      });
      return { conversationId: conv.id, seq: msgRefus.seq, messageId: msgRefus.id, texte: refus,
        provider, model, langue, personaVersion, estSource: false, citations: [] as Citation[],
        contexteObjets: [], contexteEmpreinte: null, contextePartiel: null, horsPerimetre: true };
    }

    // R255 : le contexte objet est re-résolu à CHAQUE tour (B.5) — borne AVANT l'appel fournisseur.
    const cx = await this.construireContexte(ctx, { capacite: conv.capacite, ancrageId: conv.ancrageId }, s, (dto as any).refs ?? []);
    // OL-33 (A.6) : le contenu du contexte est une DONNÉE, jamais une instruction — une injection
    // détectée est TRACÉE (info SO), jamais bloquante pour le dossier (R39).
    const marqueurInjection = detecterInjection(JSON.stringify(cx.contenu));
    if (marqueurInjection) await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "OLIVIA_INJECTION_SUSPECTEE", conv.id, { marqueur: marqueurInjection, seq: msgIn.seq }));
    // Gabarit versionné PAR CAPACITÉ (paramètre tenant R68). Le défaut est l'artefact LIVRÉ
    // `olivia-gabarits.default.json` (B.11.6 : zéro texte de persona en dur dans le code — grep CI).
    const gabarit: string = s.oliviaPromptTemplate?.[conv.capacite]
      ?? (G as Record<string, any>)[conv.capacite] ?? (G as any).C1;
    // R258/A.4 (OL-27) : fenêtre de tours GLISSANTE — seuls les N derniers couples IN/OUT entrent
    // dans le prompt ; le JOURNAL, lui, garde tout (rien n'est perdu, tout se rejoue).
    const fenetre = (s.oliviaFenetreTours ?? 10) * 2;
    const anciens = await this.prisma.oliviaMessage.findMany({
      where: { conversationId: conv.id, seq: { lt: msgIn.seq } }, orderBy: { seq: "desc" }, take: fenetre });
    const historique = anciens.reverse().map((m: any) => `${m.direction}: ${m.texte}`).join("\n");
    const persona: string = s.oliviaPersona?.texte ?? (G.persona as string);   // A.2 — gabarit LIVRÉ, versionné
    const maxMots = s.oliviaReponseMaxMots ?? 300;                          // A.2 : longueur contractuelle
    const prompt = [persona, `Réponds en ${langue}, en ${maxMots} mots au plus ; si la réponse complète dépasse, termine par « Souhaitez-vous le détail sur … ? ».`,
      historique ? `Historique (fenêtre glissante):\n${historique}` : "",
      gabarit.replace("{contexte}", JSON.stringify(cx.contenu)).replace("{question}", dto.texte)]
      .filter(Boolean).join("\n\n");

    const t0 = Date.now();
    const avecTimeout = (pr: Promise<any>) => Promise.race([pr,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs).unref())]);
    let sortie: { texte: string; modelVersion: string; citations?: Citation[]; interrompu?: boolean } | null = null;
    let echec: string | null = null; let conforme = true;
    try { sortie = await avecTimeout(port.repondre(prompt)); }
    catch (e) { echec = (e as Error).message; }
    // OL-24 (R258/A.2) : une recommandation EN PROSE (C3/C4) est renvoyée AU GABARIT une fois
    // avec le correctif contractuel ; si elle persiste, la sortie est marquée NON CONFORME
    // (et ne sera jamais proposable).
    if (sortie && !sortie.interrompu && (conv.capacite === "C3" || conv.capacite === "C4")
        && detecterRecoProse(sortie.texte)) {
      try {
        const reprise = await avecTimeout(port.repondre(`${prompt}\n\n${G.recoProse.correctif}`));
        if (reprise && !detecterRecoProse(reprise.texte)) sortie = reprise; else conforme = false;
      } catch { conforme = false; }
    }
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

    // OUT journalisé dans TOUS les cas (OL-04 : « un OUT d'erreur est aussi un événement », seq
    // consommé). Le journal ne contient JAMAIS de fragments : un stream interrompu est journalisé
    // COMPLET-avec-drapeau (statut_stream=INTERROMPU, OL-31) — « régénérer » = nouveau tour/seq.
    const excuse = sortie && langueDemandee !== langue
      ? `${(G.excuseLangueInactive[langueDemandee] ?? G.excuseLangueInactive.FR) as string}\n\n` : "";   // OL-26
    const statutStream = sortie ? (sortie.interrompu ? "INTERROMPU" : "COMPLET") : null;
    const msgOut = await this.prisma.$transaction(async (tx: Tx) => {
      const { seq, hash } = await this.dernierHash(tx, conv.id);
      const texte = sortie ? excuse + sortie.texte : `ÉCHEC FOURNISSEUR: ${echec}`;
      const m = await tx.oliviaMessage.create({ data: { tenantId: ctx.tenantId, conversationId: conv.id,
        seq, direction: "OUT", texte, provider, model,
        modelVersion: sortie?.modelVersion ?? null, latenceMs: latence,
        personaVersion, langue, statutStream, conforme,                    // R258 : le CONTRAT journalisé (OL-23/25/31/24)
        estSource, citations: citations as any,                            // R256 : vérifiées, stockées avec leur verdict
        contexteEmpreinte: cx.empreinte, contexteObjets: cx.objets,        // R255 : la LISTE, prouvable + HMAC
        prevHash: hash, recordHash: this.chain(hash, { seq, direction: "OUT", texte, provider, model, empreinte: cx.empreinte }) } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_MESSAGE_OUT", conv.id, { messageId: m.id, seq, provider, model, latenceMs: latence, echec, empreinte: cx.empreinte });
      return m;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_MESSAGE", `${conv.id}:${msgIn.seq}/${msgOut.seq}`);
    if (echec) throw new BadGatewayException(`OLIVIA_PROVIDER_DOWN: ${echec}`);
    return { conversationId: conv.id, seq: msgOut.seq, messageId: msgOut.id, texte: msgOut.texte,
      provider, model, modelVersion: msgOut.modelVersion, latenceMs: latence,
      personaVersion, langue, statutStream, conforme,
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
    // R257/OL-21 : le rejeu porte AUSSI les décisions — les propositions issues des messages
    // de la conversation (≤ as_of), avec leur sort (PENDING/ADOPTEE/REJETEE/CADUQUE, qui, quand).
    const propositions = (await this.prisma.oliviaProposal.findMany({
      where: { tenantId: ctx.tenantId, messageId: { in: messages.map((m: any) => m.id) } } }))
      .filter((p: any) => !asOf || p.createdAt <= new Date(asOf))
      .map((p: any) => ({ id: p.id, messageId: p.messageId, type: p.type, cibleType: p.cibleType,
        cibleId: p.cibleId, statut: p.statut, decidePar: p.decidePar, decideAt: p.decideAt, motifRejet: p.motifRejet }));
    return { conversationId: id, asOf: asOf ?? null, chaineVerifiee: true,
      messages: messages.map((m: any) => ({ seq: m.seq, direction: m.direction, texte: m.texte,
        provider: m.provider, model: m.model, modelVersion: m.modelVersion,
        personaVersion: m.personaVersion, langue: m.langue, statutStream: m.statutStream, conforme: m.conforme,   // R258 : le contrat d'époque
        contexteEmpreinte: m.contexteEmpreinte, contexteObjets: m.contexteObjets, citations: m.citations, at: m.createdAt })),
      propositions };
  }

  // ── R257/OL-22 : le retour utilisateur est un ÉVÉNEMENT — jamais un auto-ajustement.
  //    Aucun paramètre, aucun gabarit, aucun poids ne change ; la seule voie d'évolution
  //    d'un paramètre reste une proposition R254 décidée par un humain (R44). ──
  async noterMessage(ctx: Ctx, conversationId: string, dto: { seq?: number; note?: string }) {
    await this.port(ctx.tenantId);
    const conv = await this.prisma.oliviaConversation.findFirst({ where: { id: conversationId, tenantId: ctx.tenantId } });
    if (!conv) throw new NotFoundException("Conversation introuvable");
    if (conv.userId !== ctx.userId) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: seul le propriétaire note");
    if (!dto?.note || !["UTILE", "INUTILE"].includes(dto.note))
      throw new BadRequestException("note requise : UTILE | INUTILE");
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "OLIVIA_FEEDBACK", conversationId, { seq: dto.seq ?? null, note: dto.note, par: ctx.userId }));
    return { note: dto.note, consigne: true };
  }

  // ── Lecture des propositions (B.2) — socle T10 Home ; la décision (adopt/reject) arrive à l'étape 6. ──
  async listerProposals(ctx: Ctx, statut?: string) {
    await this.port(ctx.tenantId);                                        // contrat OL-01 : porte fermée = 503 partout
    if (ctx.role === "ADMIN") throw new ForbiddenException("OLIVIA_SCOPE_DENIED: ADMIN ne lit pas les propositions métier");
    const where: any = { tenantId: ctx.tenantId };
    if (statut) where.statut = statut;
    return this.prisma.oliviaProposal.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  }

  // ═══ R254 — Propositions : Olivia PROPOSE, l'humain DÉCIDE (R44). La proposition n'agit
  // JAMAIS sur sa cible (OL-15) ; l'adoption ne fait que créer l'événement/la tâche du circuit
  // existant (OL-16) ; la caducité se juge contre l'état de cible FIGÉ à la création (B.7). ═══

  // État courant de la cible — même calcul à la création (figé) et à la décision (caducité).
  private async etatCible(ctx: Ctx, cibleType: string, cibleId: string, depuis?: Date): Promise<{ etat: string; refHumaine?: any }> {
    if (cibleType === "KYC_FILE") {
      const k = await this.prisma.kycFile.findFirst({ where: { id: cibleId, tenantId: ctx.tenantId } });
      if (!k) throw new NotFoundException("Cible KYC introuvable");
      return { etat: `${k.status}:${k.workflow}` };
    }
    if (cibleType === "ALERTE") {                                          // cibleId = "client|scenario" (clé R252)
      const [client, scenario] = cibleId.split("|");
      const evs = await this.prisma.cpsiEvent.findMany({ where: { tenantId: ctx.tenantId, clientId: client, type: "cpsi.fp.declared", ...(depuis ? { createdAt: { gt: depuis } } : {}) } });
      const q = evs.find((e: any) => (e.payload as any)?.scenario === scenario);
      return q ? { etat: `QUALIFIEE_FP:${(q.payload as any)?.acteur}`, refHumaine: { evenement: q.id, par: (q.payload as any)?.acteur, le: q.at } } : { etat: "NON_QUALIFIEE" };
    }
    if (cibleType === "PARAM") {                                           // décision humaine sur le même chemin = caducité
      const evs = await this.prisma.cpsiEvent.findMany({ where: { tenantId: ctx.tenantId, type: { in: ["cpsi.param.adopted", "cpsi.param.rejected"] }, ...(depuis ? { createdAt: { gt: depuis } } : {}) } });
      const q = evs.find((e: any) => (e.payload as any)?.chemin === cibleId);
      return q ? { etat: `DECIDE:${q.type}`, refHumaine: { evenement: q.id, le: q.at } } : { etat: "EN_VIGUEUR" };
    }
    throw new BadRequestException(`Cible inconnue : ${cibleType}`);
  }

  // ── R254/OL-12 : créer — UNIQUEMENT depuis une sortie SOURCÉE d'une conversation C3/C4. ──
  async creerProposition(ctx: Ctx, dto: { messageId?: string; type?: string; cibleType?: string;
    cibleId?: string; justification?: string; impactEstime?: any }) {
    await this.port(ctx.tenantId);
    if (!dto?.type || !TYPES_PROPOSITION.test(dto.type))
      throw new BadRequestException(`Type de proposition inconnu : ${dto?.type}`);
    if (!dto?.cibleType || !CIBLES_PROPOSITION.includes(dto.cibleType) || !dto?.cibleId)
      throw new BadRequestException("cibleType/cibleId requis (ALERTE | KYC_FILE | PARAM)");
    if (!dto?.justification?.trim())
      throw new BadRequestException("R7 : la justification est obligatoire à la création");
    const m = await this.prisma.oliviaMessage.findFirst({ where: { id: dto.messageId ?? "", tenantId: ctx.tenantId, direction: "OUT" } });
    if (!m) throw new NotFoundException("Message OUT fondateur introuvable");
    const conv = await this.prisma.oliviaConversation.findFirst({ where: { id: m.conversationId, tenantId: ctx.tenantId } });
    if (!conv || conv.userId !== ctx.userId) throw new ForbiddenException("OLIVIA_SCOPE_DENIED: seul le propriétaire propose depuis sa conversation");
    if (conv.capacite !== "C3" && conv.capacite !== "C4")
      throw new BadRequestException("Seules les sorties C3/C4 sont proposables (B.7)");
    if (!m.estSource)                                                      // OL-12 — contrainte SERVEUR, pas UI
      throw new UnprocessableEntityException("OLIVIA_UNSOURCED_PROPOSAL: sortie non sourcée — aucune proposition (R256)");
    if (m.conforme === false)                                              // OL-24 — recommandation en prose non corrigée
      throw new UnprocessableEntityException("OLIVIA_NON_CONFORME: recommandation en prose non corrigée — sortie non proposable (R258/A.2)");
    const { etat } = await this.etatCible(ctx, dto.cibleType, dto.cibleId);
    const p = await this.prisma.$transaction(async (tx: Tx) => {
      const cree = await tx.oliviaProposal.create({ data: { tenantId: ctx.tenantId, messageId: m.id,
        type: dto.type!, cibleType: dto.cibleType!, cibleId: dto.cibleId!, cibleEtat: etat,
        justification: dto.justification!.trim(), impactEstime: dto.impactEstime ?? null } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_PROPOSAL_CREATED", cree.id,
        { type: dto.type, cibleType: dto.cibleType, cibleId: dto.cibleId, messageId: m.id }); // payload minimal (B.1)
      return cree;
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_PROPOSAL_CREATED", p.id);
    return { id: p.id, statut: p.statut, type: p.type, cibleType: p.cibleType, cibleId: p.cibleId };
    // OL-15 : AUCUN effet sur la cible — seule une ligne PENDING existe.
  }

  // ── R254/OL-16..19 : décider — rôle décideur du type (default-deny), caducité automatique tracée. ──
  async deciderProposition(ctx: Ctx, id: string, decision: "adopt" | "reject", motif?: string) {
    await this.port(ctx.tenantId);
    const p = await this.prisma.oliviaProposal.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!p) throw new NotFoundException("Proposition introuvable");
    if (p.statut !== "PENDING") throw new ConflictException(`OLIVIA_PROPOSAL_DECIDEE: proposition déjà ${p.statut}`);
    // B.7 : la cible a changé d'état avant décision → CADUQUE automatique, TRACÉE (jamais silencieuse),
    // avec la référence de la décision humaine (OL-19) — puis 409 pour l'appelant.
    const courant = await this.etatCible(ctx, p.cibleType, p.cibleId, p.createdAt);
    if (courant.etat !== p.cibleEtat) {
      await this.prisma.$transaction(async (tx: Tx) => {
        await tx.oliviaProposal.update({ where: { id: p.id }, data: { statut: "CADUQUE", decideAt: new Date() } });
        await this.emit(tx, ctx.tenantId, "OLIVIA_PROPOSAL_CADUQUE", p.id,
          { etatFige: p.cibleEtat, etatCourant: courant.etat, decisionHumaine: courant.refHumaine ?? null });
      });
      throw new ConflictException(`OLIVIA_PROPOSAL_DECIDEE: caduque — la cible a déjà été décidée par un humain (${courant.etat})`);
    }
    if (!DECIDEURS(p.type).includes(ctx.role))                             // OL-18 : la proposition RESTE PENDING
      throw new ForbiddenException(`OLIVIA_SCOPE_DENIED: le rôle ${ctx.role} ne décide pas ${p.type} (matrice B.3)`);
    if (decision === "reject") {
      if (!motif?.trim()) throw new UnprocessableEntityException("OLIVIA_MOTIF_REQUIS: le rejet exige un motif (R7)");
      await this.prisma.$transaction(async (tx: Tx) => {
        await tx.oliviaProposal.update({ where: { id: p.id }, data: { statut: "REJETEE", decidePar: ctx.userId, decideAt: new Date(), motifRejet: motif!.trim() } });
        await this.emit(tx, ctx.tenantId, "OLIVIA_PROPOSAL_REJECTED", p.id, { par: ctx.userId, motif: motif!.trim() });
      });
      await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_PROPOSAL_REJECTED", p.id);
      return { id: p.id, statut: "REJETEE" };
    }
    // ADOPTION (OL-16) : l'adoption N'EXÉCUTE RIEN — elle crée l'événement/la tâche du circuit
    // existant. AJUSTEMENT_PARAM (OL-20) : entrée de bac à sable R70 pré-remplie via la porte CPSI
    // (proposition EN_ATTENTE — le paramètre en vigueur est INCHANGÉ tant que la voie R68 n'a pas statué).
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.oliviaProposal.update({ where: { id: p.id }, data: { statut: "ADOPTEE", decidePar: ctx.userId, decideAt: new Date() } });
      await this.emit(tx, ctx.tenantId, "OLIVIA_PROPOSAL_ADOPTED", p.id, { par: ctx.userId, type: p.type });
      const tache = p.type === "AIGUILLAGE_EDD" ? "tache.aiguillage.edd"
        : p.type === "ALLEGEMENT_EDD" ? "tache.allegement.edd"
        : p.type.startsWith("QUALIF_ALERTE") ? "tache.qualification.alerte" : null;
      if (tache) await this.emit(tx, ctx.tenantId, tache, p.cibleId,       // la VOIE NORMALE (circuit R66)
        { proposalId: p.id, cibleType: p.cibleType, par: ctx.userId });
    });
    if (p.type === "AJUSTEMENT_PARAM")
      await this.cpsi!.proposer(ctx, { chemin: p.cibleId, valeur: (p.impactEstime as any)?.valeur,
        justification: `Olivia — proposition ${p.id} adoptée par ${ctx.userId} : ${p.justification}` });
    await this.audit.log(ctx.tenantId, ctx.userId, "OLIVIA_PROPOSAL_ADOPTED", p.id);
    return { id: p.id, statut: "ADOPTEE" };
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
  @Post("conversations/:id/feedback")       noter(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.noterMessage(r.ctx, id, b ?? {}); } // R257/OL-22
  @Get("proposals")                         proposals(@Req() r: any, @Query("statut") statut?: string) { return this.svc.listerProposals(r.ctx, statut); }
  @Post("proposals")                        proposer(@Req() r: any, @Body() b: any) { return this.svc.creerProposition(r.ctx, b ?? {}); }               // R254/OL-12
  @Post("proposals/:id/adopt")              adopter(@Req() r: any, @Param("id") id: string) { return this.svc.deciderProposition(r.ctx, id, "adopt"); } // OL-16
  @Post("proposals/:id/reject")             rejeter(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.deciderProposition(r.ctx, id, "reject", b?.motif); } // OL-17
  @Get("health")                            health(@Req() r: any) { return this.svc.health(r.ctx); }
}

@Module({
  imports: [KycModule, CpsiModule],                                        // R255 : l'ancrage se résout VIA les services existants (C3/C4 : porte CPSI)
  controllers: [OliviaController],
  providers: [
    PrismaService, AuditService,
    { provide: OliviaService, useFactory: (p: PrismaService, a: AuditService, k: KycService, c: CpsiService) => new OliviaService(p, a, k, c), inject: [PrismaService, AuditService, KycService, CpsiService] }],
  exports: [OliviaService],
})
export class OliviaModule {}
