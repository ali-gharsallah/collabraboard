import { Body, Controller, Get, Param, Post, Query, Req, Module, Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { execFile } from "child_process";
import * as path from "path";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Porte HTTP mince CPSI (spec `spec/cpsi-scenarios/CPSI-PORTE.feature`, CP-01..19). Squelette
 * vertical : chemin SCORE (CP-01/02) + ingestion default-deny (CP-11). Doctrine porte mince :
 *   • Aucune règle réimplémentée. La porte PERSISTE des faits (journal append-only `cpsi_events`,
 *     tenant-scopé, RLS) puis REJOUE le journal du tenant vers le moteur ratifié Python
 *     (`services/cpsi-server-py`, source de vérité R63→R83) pour CALCULER — elle ne décide rien.
 *   • Auteur = jeton (`payload.par = ctx.userId`), jamais le corps.
 *   • Rejeu à date `?asOf=` (R48/R49) : le moteur est une fonction pure des faits ≤ date.
 *   • Default-deny préservé : un type de signal inconnu est refusé AVANT persistance (validation
 *     par rejeu) — la `CpsiError` du moteur devient un 4xx, jamais avalée.
 *   • Transport = shell-out (Q4) : sous-processus `python3 bridge.py`, échangeable sans toucher au contrat.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const CPSI_DIR = process.env.CPSI_DIR ?? path.resolve(process.cwd(), "..", "..", "services", "cpsi-server-py");

// Invoque le pont Python (lecture pure). Retourne {ok} | {error}. Jamais d'état ici.
function runBridge(payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = execFile("python3", ["bridge.py"], { cwd: CPSI_DIR, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
      });
    child.stdin!.end(JSON.stringify(payload));
  });
}

@Injectable()
export class CpsiService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async config(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {}).cpsiConfig ?? {};                 // R68 : config CPSI du tenant
  }
  // Journal ordonné (seq croissant, R49) → format de rejeu du pont.
  private async journal(tenantId: string) {
    const rows = await this.prisma.cpsiEvent.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
    return rows.map((e: any) => ({ type: e.type, at: e.at, ...(e.payload as any) }));
  }

  // ── Enregistrement d'un client CPSI (prérequis au score) — un seul par (tenant, client). ──
  async enregistrerClient(ctx: Ctx, dto: { clientId: string; statique?: any; attributs?: any; at?: string }) {
    if (!dto?.clientId) throw new BadRequestException("clientId requis");
    const deja = await this.prisma.cpsiEvent.findFirst({ where: { tenantId: ctx.tenantId, clientId: dto.clientId, type: "cpsi.client.registered" } });
    if (deja) throw new ConflictException("CPSI_CLIENT_ALREADY_REGISTERED");
    const at = dto.at ?? new Date().toISOString();
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.client.registered",
      clientId: dto.clientId, at, payload: { client: dto.clientId, statique: dto.statique ?? {}, attributs: dto.attributs ?? {}, par: ctx.userId } } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_CLIENT_REGISTERED", dto.clientId);
    return { clientId: dto.clientId, at };
  }

  // ── R63/CP-11 : ingestion d'un signal — default-deny VALIDÉ par rejeu avant persistance. ──
  async ingererSignal(ctx: Ctx, clientId: string, dto: { type: string; severite?: number; at?: string; meta?: any }) {
    if (!dto?.type) throw new BadRequestException("type requis");
    const at = dto.at ?? new Date().toISOString();
    const nouvel = { type: "cpsi.signal.ingested", at, client: clientId, signal: dto.type, severite: dto.severite ?? 1, meta: dto.meta ?? null };
    // Validation par rejeu : on scelle le candidat et on demande un score ; toute CpsiError (type
    // inconnu, client non enregistré) fait échouer AVANT toute écriture (default-deny préservé).
    const journal = [...(await this.journal(ctx.tenantId)), nouvel];
    const res = await runBridge({ config: await this.config(ctx.tenantId), journal, query: { op: "score", client: clientId, at } });
    if (res.error) throw new BadRequestException(res.error.message);
    await this.prisma.cpsiEvent.create({ data: { tenantId: ctx.tenantId, type: "cpsi.signal.ingested",
      clientId, at, payload: { client: clientId, signal: dto.type, severite: dto.severite ?? 1, meta: dto.meta ?? null, par: ctx.userId } } });
    await this.audit.log(ctx.tenantId, ctx.userId, "CPSI_SIGNAL_INGESTED", `${clientId}:${dto.type}`);
    return { clientId, ...res.ok };                                       // renvoie l'état recalculé (score, bande, drivers)
  }

  // ── CP-01/CP-02 : score perpétuel + drivers (R63/R67), rejeu à date (R48/R64/R68). ──
  async score(ctx: Ctx, clientId: string, asOf?: string) {
    const at = asOf ?? new Date().toISOString();
    const res = await runBridge({ config: await this.config(ctx.tenantId), journal: await this.journal(ctx.tenantId), query: { op: "score", client: clientId, at } });
    if (res.error) throw new NotFoundException(res.error.message);        // client inconnu / non enregistré
    return { clientId, asOf: asOf ?? null, ...res.ok };
  }
}

@Controller("cpsi")
export class CpsiController {
  constructor(private svc: CpsiService) {}
  @Post("clients")                 enregistrer(@Req() r: any, @Body() b: any) { return this.svc.enregistrerClient(r.ctx, b); }
  @Post("clients/:cid/signals")    ingerer(@Req() r: any, @Param("cid") cid: string, @Body() b: any) { return this.svc.ingererSignal(r.ctx, cid, b); } // CP-11
  @Get("clients/:cid/score")       score(@Req() r: any, @Param("cid") cid: string, @Query("asOf") asOf?: string) { return this.svc.score(r.ctx, cid, asOf); } // CP-01/02
}

@Module({
  controllers: [CpsiController],
  providers: [
    PrismaService, AuditService,
    { provide: CpsiService, useFactory: (p: PrismaService, a: AuditService) => new CpsiService(p, a), inject: [PrismaService, AuditService] },
  ],
  exports: [CpsiService],
})
export class CpsiModule {}
