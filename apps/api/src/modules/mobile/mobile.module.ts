import { BadRequestException, Body, Controller, ForbiddenException, Get, Module, NotFoundException,
  Param, Post, Query, Req, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { sign } from "jsonwebtoken";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KeyStore } from "../auth/key-store";
import { LoginRateLimiter, LIMITES } from "../auth/login-rate";
import { ParametresService } from "../parametres/parametres.service";
import { ParametresModule } from "../parametres/parametres.module";
import { CocService } from "../coc/coc.module";
import { CocModule } from "../coc/coc.module";

/**
 * MOBILE BANKING — dégel V7 (canon ratifié 2026-07-28, GO Ali), R316-R318, MB-01..05.
 * R316 : clients finaux = POPULATION IAM DISTINCTE (table sans colonne de rôle — structurel) ;
 * auth dédiée, MFA OBLIGATOIRE (TOTP) ; activation par le RM du client + code hors bande,
 * tracée — le code n'est JAMAIS stocké ni journalisé en clair.
 * R317 : v1 = LECTURE + MESSAGERIE. Les exclusions v1 (liste fermée du canon) n'ont PAS de
 * route — le 404 est structurel, jamais un garde (MB-04). La modification de données
 * personnelles passe par un MESSAGE que le RM traite en ouvrant un CoC (la voie R276
 * réelle — jamais un second circuit, MB-05).
 * R318 : le client ne voit QUE le partagé (marquage EXPLICITE par pièce/compte, tracé ;
 * `mobile_partage_defaut` = rien par défaut) ; l'absence est dans la RÉPONSE réseau, pas un
 * masquage ; AUCUNE donnée compliance, pas même l'existence (pattern OL-34/R270).
 * Clé `mobile_actif` OFF par défaut : toute la surface répond 404 — existence cachée.
 */

type Ctx = { tenantId: string; userId: string; role: string };

// ── TOTP (RFC 6238, HMAC-SHA1, pas de 30 s, 6 chiffres) — le MFA de la population mobile. ──
export function totp(secretHex: string, at = Date.now()): string {
  const pas = Math.floor(at / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(pas));
  const h = createHmac("sha1", Buffer.from(secretHex, "hex")).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class MobileService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private keys: KeyStore, private parametres: ParametresService, private coc: CocService,
    private limiteur: LoginRateLimiter) {}

  private emit(type: string, tenantId: string, aggregateId: string, payload: any) {
    return this.prisma.domainEvent.create({ data: { tenantId, type, aggregateId, payload,
      at: new Date().toISOString() } });
  }

  // `mobile_actif` OFF → la surface N'EXISTE pas : 404 neutre (jamais 403 — rien n'est avoué).
  private async actifOu404(tenantId: string) {
    const v = await this.parametres.valeurEffective(
      { tenantId, userId: "mobile", role: "SYSTEM" }, "mobile_actif", new Date());
    if (v !== true) throw new NotFoundException("Ressource introuvable");
  }

  // Le RM du client — la seule main qui active ou partage (R316/R318).
  private async clientDuRm(ctx: Ctx, clientId: string) {
    if (ctx.role !== "RM") throw new ForbiddenException("R316 : seul le RM du client agit sur son canal mobile");
    const c = await this.prisma.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId, rmUserId: ctx.userId } });
    if (!c) throw new ForbiddenException("R316 : ce client n'est pas dans le périmètre du RM");
    return c;
  }

  // ── MB-01/02 : activation par le RM — identité + code hors bande (remis UNE fois, jamais stocké). ──
  async activer(ctx: Ctx, dto: { clientId?: string }) {
    await this.actifOu404(ctx.tenantId);
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    await this.clientDuRm(ctx, dto.clientId);
    const code = randomBytes(4).toString("hex").toUpperCase();              // le canal hors bande le porte
    const identite = await this.prisma.mobileIdentite.upsert({
      where: { tenantId_clientId: { tenantId: ctx.tenantId, clientId: dto.clientId } },
      create: { tenantId: ctx.tenantId, clientId: dto.clientId, codeHash: sha256(code), activeePar: ctx.userId },
      update: { codeHash: sha256(code), statut: "EN_ATTENTE", mfaSecret: null, activeePar: ctx.userId } });
    await this.emit("mobile.identite.creee", ctx.tenantId, identite.id,
      { identite: identite.id, clientId: dto.clientId, par: ctx.userId });  // JAMAIS le code
    await this.audit.log(ctx.tenantId, ctx.userId, "MOBILE_IDENTITE_CREEE", identite.id);
    return { identite: identite.id, code };                                 // remis UNE fois au RM → canal hors bande
  }

  // ── MB-03/R318 : le partage est un ACTE tracé — jamais un défaut. ──
  async partager(ctx: Ctx, dto: { cible?: string; id?: string; clientId?: string; partage?: boolean }) {
    await this.actifOu404(ctx.tenantId);
    if (!["document", "compte"].includes(dto?.cible ?? "")) throw new BadRequestException("cible requise : document | compte");
    if (!dto?.id) throw new BadRequestException("id requis");
    let clientId = dto.clientId;
    if (dto.cible === "document") {
      const doc = await this.prisma.document.findFirst({ where: { id: dto.id, tenantId: ctx.tenantId } });
      if (!doc?.clientId) throw new BadRequestException("R318 : pièce inconnue ou sans client — rien à partager");
      clientId = doc.clientId;
    }
    if (!clientId) throw new BadRequestException("clientId requis pour un compte");
    await this.clientDuRm(ctx, clientId);
    await this.emit("mobile.partage.marque", ctx.tenantId, dto.id,
      { cible: dto.cible, id: dto.id, clientId, partage: dto.partage !== false, par: ctx.userId });
    await this.audit.log(ctx.tenantId, ctx.userId, "MOBILE_PARTAGE_MARQUE", `${dto.cible}:${dto.id}`);
    return { cible: dto.cible, id: dto.id, partage: dto.partage !== false };
  }

  // L'état du partage, DÉRIVÉ des événements (dernier marquage par cible+id).
  private async partages(tenantId: string, clientId: string, cible: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId, type: "mobile.partage.marque" }, orderBy: { id: "asc" } });
    const etat = new Map<string, boolean>();
    for (const e of evs) {
      const p: any = e.payload;
      if (p.clientId === clientId && p.cible === cible) etat.set(p.id, !!p.partage);
    }
    return [...etat.entries()].filter(([, v]) => v).map(([id]) => id);
  }

  // ── Messagerie côté BANQUE (R317) : le RM lit, répond, TRAITE — le CoC est la voie réelle. ──
  async messagesBanque(ctx: Ctx, clientId: string) {
    await this.actifOu404(ctx.tenantId);
    if (!clientId) throw new BadRequestException("clientId requis");
    await this.clientDuRm(ctx, clientId);
    return { messages: await this.fil(ctx.tenantId, clientId) };
  }

  async repondre(ctx: Ctx, clientId: string, dto: { texte?: string }) {
    await this.actifOu404(ctx.tenantId);
    if (!dto?.texte?.trim()) throw new BadRequestException("texte requis");
    await this.clientDuRm(ctx, clientId);
    const id = randomUUID();
    await this.emit("mobile.message", ctx.tenantId, id,
      { id, clientId, de: "BANQUE", texte: dto.texte.trim(), par: ctx.userId });
    await this.audit.log(ctx.tenantId, ctx.userId, "MOBILE_MESSAGE_BANQUE", id);
    return { id };
  }

  // MB-05 : « changer mon adresse » n'a PAS de route mobile — le message EST la demande,
  // le RM la traite en ouvrant le dossier CoC (CC-01 rejoué : valeurs figées, signal rattaché).
  async ouvrirCoc(ctx: Ctx, messageId: string, dto: { typeCode?: string; description?: string }) {
    await this.actifOu404(ctx.tenantId);
    const ev = await this.prisma.domainEvent.findFirst({
      where: { tenantId: ctx.tenantId, type: "mobile.message", aggregateId: messageId } });
    if (!ev) throw new NotFoundException("Message mobile introuvable");
    const clientId = (ev.payload as any).clientId as string;
    await this.clientDuRm(ctx, clientId);
    const dossier = await this.coc.ouvrir(ctx, { clientId, typeCode: dto?.typeCode,
      description: dto?.description });                                     // la voie R276 — jamais un second circuit
    await this.emit("mobile.message.traite", ctx.tenantId, messageId,
      { messageId, clientId, cocId: dossier.id, par: ctx.userId });
    return dossier;
  }

  // ═══ Surface CLIENT (population mobile — req.mobileCtx, jamais un rôle) ═══

  // ── MB-02 : activation avec le code hors bande — puis le MFA est OBLIGATOIRE. ──
  async authActiver(dto: { identite?: string; code?: string }) {
    if (!dto?.identite || !dto?.code) throw new UnauthorizedException("identite et code requis");
    await this.limiteur.garder(`mobile-activer|${dto.identite}`, LIMITES.login);  // R296 (§7) — même garde que le login
    const idt = await this.prisma.mobileIdentite.findUnique({ where: { id: dto.identite } });
    if (!idt) throw new UnauthorizedException("Activation refusée");        // rien n'est révélé
    await this.actifOu404(idt.tenantId);
    if (idt.statut !== "EN_ATTENTE" || sha256(dto.code) !== idt.codeHash)
      throw new ForbiddenException("MB-02 : activation refusée — le code hors bande ne correspond pas");
    const mfaSecret = randomBytes(20).toString("hex");
    await this.prisma.mobileIdentite.update({ where: { id: idt.id },
      data: { statut: "ACTIVE", mfaSecret, activeAt: new Date() } });
    await this.emit("mobile.identite.activee", idt.tenantId, idt.id,
      { identite: idt.id, clientId: idt.clientId, activeePar: idt.activeePar });  // tracée — JAMAIS le secret
    return { mfaSecret };                                                   // remis UNE fois — MFA obligatoire ensuite
  }

  async authLogin(dto: { identite?: string; mfa?: string }) {
    if (!dto?.identite) throw new UnauthorizedException("identite requise");
    // R296 (§7) : la porte mobile se protège comme la porte interne — 429 typé par identité,
    // identique que l'identité existe ou non (jamais un oracle, pattern OL-34).
    await this.limiteur.garder(`mobile-login|${dto.identite}`, LIMITES.login);
    const idt = await this.prisma.mobileIdentite.findUnique({ where: { id: dto.identite } });
    if (!idt || idt.statut !== "ACTIVE" || !idt.mfaSecret) throw new UnauthorizedException("Connexion refusée");
    await this.actifOu404(idt.tenantId);
    // MFA OBLIGATOIRE (R316) — pas de mot de passe seul dans cette population. ±1 pas d'horloge.
    const now = Date.now();
    if (!dto.mfa || ![totp(idt.mfaSecret, now), totp(idt.mfaSecret, now - 30000)].includes(dto.mfa))
      throw new UnauthorizedException("R316 : MFA obligatoire — code TOTP absent ou invalide");
    const { kid, privatePem } = this.keys.signingKey();
    const token = sign({ tid: idt.tenantId, mid: idt.id, cid: idt.clientId, pop: "MOBILE" },
      privatePem, { algorithm: "RS256", expiresIn: "30m", keyid: kid });    // JAMAIS de rôle — population distincte
    await this.emit("mobile.session.ouverte", idt.tenantId, idt.id, { identite: idt.id, clientId: idt.clientId });
    return { token };
  }

  // ── R318 : QUE le partagé — l'absence est dans la réponse réseau, aucune donnée compliance. ──
  async clientDocuments(m: { tenantId: string; clientId: string }) {
    await this.actifOu404(m.tenantId);
    const ids = await this.partages(m.tenantId, m.clientId, "document");
    // `mobile_partage_defaut` : catégories (typeCode) partagées par défaut — VIDE par défaut (rien).
    const categories = (await this.parametres.valeurEffective(
      { tenantId: m.tenantId, userId: "mobile", role: "SYSTEM" }, "mobile_partage_defaut", new Date())) as string[] ?? [];
    const docs = await this.prisma.document.findMany({
      where: { tenantId: m.tenantId, clientId: m.clientId, statut: "ACTIF",
        OR: [{ id: { in: ids } }, ...(categories.length ? [{ typeCode: { in: categories } }] : [])] },
      orderBy: { createdAt: "desc" } });
    // Projection MINIMALE : id, nom, date — rien d'autre ne sort (OL-34/R270).
    return { documents: docs.map((d) => ({ id: d.id, nom: d.nom, depuisLe: d.createdAt })) };
  }

  async clientComptes(m: { tenantId: string; clientId: string }) {
    await this.actifOu404(m.tenantId);
    return { comptes: (await this.partages(m.tenantId, m.clientId, "compte")).map((compte) => ({ compte })) };
  }

  private async fil(tenantId: string, clientId: string) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId, type: "mobile.message" }, orderBy: { id: "asc" } });
    return evs.map((e) => e.payload as any).filter((p) => p.clientId === clientId)
      .map((p) => ({ id: p.id, de: p.de, texte: p.texte, at: undefined }));
  }

  async clientMessages(m: { tenantId: string; clientId: string }) {
    await this.actifOu404(m.tenantId);
    return { messages: await this.fil(m.tenantId, m.clientId) };
  }

  async clientEcrire(m: { tenantId: string; clientId: string }, dto: { texte?: string }) {
    await this.actifOu404(m.tenantId);
    if (!dto?.texte?.trim()) throw new BadRequestException("texte requis");
    const id = randomUUID();
    await this.emit("mobile.message", m.tenantId, id,
      { id, clientId: m.clientId, de: "CLIENT", texte: dto.texte.trim() });
    return { id };
  }
}

// ── Côté BANQUE (porte interne — rôles du jeton) ──
@Controller("mobile")
export class MobileAdminController {
  constructor(private svc: MobileService) {}
  @Post("activer")                  activer(@Req() r: any, @Body() b: any) { return this.svc.activer(r.ctx, b ?? {}); }          // MB-01/02
  @Post("partager")                 partager(@Req() r: any, @Body() b: any) { return this.svc.partager(r.ctx, b ?? {}); }        // MB-03
  @Get("messages")                  messages(@Req() r: any, @Query("clientId") c: string) { return this.svc.messagesBanque(r.ctx, c); }
  @Post("messages/:clientId/repondre") repondre(@Req() r: any, @Param("clientId") c: string, @Body() b: any) { return this.svc.repondre(r.ctx, c, b ?? {}); }
  @Post("messages/:id/ouvrir-coc")  coc(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.ouvrirCoc(r.ctx, id, b ?? {}); } // MB-05
}

// ── Côté CLIENT (porte mobile — req.mobileCtx ; v1 = LECTURE + MESSAGERIE, rien d'autre
//    n'est déclaré : les exclusions du canon R317 sont des routes INEXISTANTES → 404). ──
@Controller("mobile")
export class MobileClientController {
  constructor(private svc: MobileService) {}
  @Post("auth/activer")     authActiver(@Body() b: any) { return this.svc.authActiver(b ?? {}); }                                // MB-02
  @Post("auth/login")       authLogin(@Body() b: any) { return this.svc.authLogin(b ?? {}); }                                    // MFA obligatoire
  @Get("client/documents")  documents(@Req() r: any) { return this.svc.clientDocuments(r.mobileCtx); }                           // MB-03
  @Get("client/comptes")    comptes(@Req() r: any) { return this.svc.clientComptes(r.mobileCtx); }
  @Get("client/messages")   lire(@Req() r: any) { return this.svc.clientMessages(r.mobileCtx); }
  @Post("client/messages")  ecrire(@Req() r: any, @Body() b: any) { return this.svc.clientEcrire(r.mobileCtx, b ?? {}); }        // MB-05 (la demande)
}

@Module({ imports: [ParametresModule, CocModule],
  controllers: [MobileAdminController, MobileClientController], providers: [MobileService] })
export class MobileModule {}
