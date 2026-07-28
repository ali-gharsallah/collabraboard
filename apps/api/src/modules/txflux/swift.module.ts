import { BadRequestException, Body, Controller, Get, Module, Post, Req, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { Tx } from "../../common/tx";

/**
 * R300 [canon R297] — SWIFT EST UN LABORATOIRE D'ANALYSE (dégel V1, TF-09..12).
 * Parsing ENTRANT seulement : la bibliothèque de types vit au registre (`swift_types_actifs`,
 * défaut MT103/MT202/pacs.008). Extraction structurée + rattachement aux transactions R297
 * par référence (:20 ↔ ref_externe). Les champs sensibles (donneur d'ordre, bénéficiaire)
 * sont SURLIGNÉS et alimentent les attributs R79 (third-party payer → wires_third_party,
 * via l'agrégation txrisk R298). Message hors bibliothèque ou non parsable = QUARANTAINE
 * listée avec motif (pattern R169) — jamais deviné. AUCUNE ÉMISSION : structurellement,
 * aucune route sortante n'existe dans ce module (TF-11 le vérifie sur le routeur vivant).
 * État dérivé des ÉVÉNEMENTS (swift.message.parse / swift.quarantaine) — aucune table.
 */

type Ctx = { tenantId: string; userId: string; role: string };

// ── Parsing MT « lite » : blocs {n:...} + champs :nn(X): — déterministe, jamais deviné. ──
export function parserSwift(texte: string): { type: string | null; extraction?: any; motif?: string } {
  const t = String(texte ?? "");
  if (/<Document[^>]*pacs\.008/.test(t)) {
    const ref = /<MsgId>([^<]+)<\/MsgId>/.exec(t)?.[1] ?? null;
    if (!ref) return { type: "pacs.008", motif: "pacs.008 sans MsgId — non parsable, quarantaine" };
    return { type: "pacs.008", extraction: { type: "pacs.008", reference: ref } };
  }
  const bloc2 = /\{2:[IO](\d{3})/.exec(t);
  if (!bloc2) return { type: null, motif: "en-tête SWIFT absent (bloc {2:}) — non parsable, quarantaine" };
  const type = `MT${bloc2[1]}`;
  const champ = (code: string) => {
    const m = new RegExp(`:${code}:([\\s\\S]*?)(?=\\n:|\\n-\\}|$)`).exec(t);
    return m ? m[1].trim() : null;
  };
  const ref = champ("20");
  if (!ref) return { type, motif: `${type} sans référence :20: — non parsable, quarantaine` };
  const a32 = champ("32A");                                   // AAMMJJ + devise + montant
  const m32 = a32 ? /^(\d{6})([A-Z]{3})([\d,.]+)$/.exec(a32.replace(/\s/g, "")) : null;
  return { type, extraction: {
    type, reference: ref,
    dateValeur: m32 ? `20${m32[1].slice(0, 2)}-${m32[1].slice(2, 4)}-${m32[1].slice(4, 6)}` : null,
    devise: m32 ? m32[2] : null,
    montant: m32 ? Number(m32[3].replace(",", ".").replace(/\.$/, "")) : null,
    donneurOrdre: champ("50K") ?? champ("50A") ?? champ("50F"),               // champ SENSIBLE (R79)
    beneficiaire: champ("59") ?? champ("59A"),                                // champ SENSIBLE (R79)
    banqueBeneficiaire: champ("57A"),
  } };
}

@Injectable()
export class SwiftService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // ── TF-09/10 : analyser UN message — extraction ou quarantaine motivée, jamais deviné. ──
  async analyser(ctx: Ctx, dto: { texte?: string }) {
    if (!dto?.texte?.trim()) throw new BadRequestException("texte du message requis");
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const actifs: string[] = s.swift_types_actifs ?? ["MT103", "MT202", "pacs.008"];
    const p = parserSwift(dto.texte);
    const id = randomUUID();
    const horsBibliotheque = p.type !== null && !actifs.includes(p.type);
    if (!p.extraction || horsBibliotheque) {
      const motif = horsBibliotheque
        ? `type ${p.type} hors bibliothèque déclarée (${actifs.join(", ")}) — swift_types_actifs`
        : p.motif!;
      await this.prisma.$transaction((tx: Tx) => tx.domainEvent.create({ data: {
        tenantId: ctx.tenantId, type: "swift.quarantaine", aggregateId: id,
        payload: { motif, apercu: dto.texte!.slice(0, 120), par: ctx.userId }, at: new Date().toISOString() } }));
      await this.audit.log(ctx.tenantId, ctx.userId, "SWIFT_QUARANTAINE", motif.slice(0, 100));
      return { quarantaine: true, motif };
    }
    const txn = await this.prisma.transaction.findFirst({                     // rattachement PAR RÉFÉRENCE
      where: { tenantId: ctx.tenantId, refExterne: p.extraction.reference } });
    await this.prisma.$transaction((tx: Tx) => tx.domainEvent.create({ data: {
      tenantId: ctx.tenantId, type: "swift.message.parse", aggregateId: id,
      payload: { extraction: p.extraction, transactionId: txn?.id ?? null, clientId: txn?.clientId ?? null,
        par: ctx.userId }, at: new Date().toISOString() } }));
    await this.audit.log(ctx.tenantId, ctx.userId, "SWIFT_PARSE", `${p.extraction.type}:${p.extraction.reference}`);
    return { quarantaine: false, extraction: p.extraction, transactionId: txn?.id ?? null };
  }

  // État DÉRIVÉ des événements — aucune table nouvelle.
  async messages(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "swift.message.parse" }, orderBy: { id: "desc" }, take: 100 });
    return evs.map((e) => ({ ...(e.payload as any).extraction,
      transactionId: (e.payload as any).transactionId, at: e.at }));
  }

  async quarantaine(ctx: Ctx) {
    const evs = await this.prisma.domainEvent.findMany({
      where: { tenantId: ctx.tenantId, type: "swift.quarantaine" }, orderBy: { id: "desc" }, take: 100 });
    return evs.map((e) => ({ motif: (e.payload as any).motif, apercu: (e.payload as any).apercu, at: e.at }));
  }
}

// TF-11 : le contrôleur ne porte QUE l'analyse et la lecture — l'émission n'existe pas.
@Controller("swift")
export class SwiftController {
  constructor(private svc: SwiftService) {}
  @Post("analyser")   analyser(@Req() r: any, @Body() b: any) { return this.svc.analyser(r.ctx, b ?? {}); }  // TF-09/10
  @Get("messages")    messages(@Req() r: any) { return this.svc.messages(r.ctx); }
  @Get("quarantaine") quarantaine(@Req() r: any) { return this.svc.quarantaine(r.ctx); }
}

@Module({ controllers: [SwiftController], providers: [SwiftService] })
export class SwiftModule {}
