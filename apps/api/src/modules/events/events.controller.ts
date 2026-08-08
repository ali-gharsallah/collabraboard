import { Controller, Get, Param, Post, Req, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { OutboxWorker } from "./outbox.worker";
import { Tx } from "../../common/tx";

/**
 * R286 — l'échec du transport est VISIBLE (extension T9) et le rejeu est un ACTE MANUEL tracé.
 * Lecture : « N événements en souffrance, le plus ancien : X » + watermarks des consommateurs.
 * Écriture : POST rejouer — le consommateur étant idempotent, rejouer est toujours sûr.
 * Rôles : ADMIN (T9 — santé technique, aucune donnée client ; SO rejoint en R284).
 */
@Controller("events")
export class EventsController {
  constructor(private prisma: PrismaService, private audit: AuditService, private worker: OutboxWorker) {}

  // R291/DC-07 : matrice T9 ÉTENDUE en LECTURE — la Direction PILOTE (elle lit la santé),
  // elle n'OPÈRE pas (le rejeu reste ADMIN/SO).
  private gardeLecture(ctx: { role: string }) {
    if (!["ADMIN", "SO", "DIR"].includes(ctx.role))
      throw new ForbiddenException("T9 : la santé du transport se consulte en ADMIN/SO (R284) ou DIRECTION (R291, lecture)");
  }
  private gardeEcriture(ctx: { role: string }) {
    if (!["ADMIN", "SO"].includes(ctx.role))
      throw new ForbiddenException("R291 : le REJEU d'une dead-letter est un acte d'exploitation — ADMIN/SO seulement (piloter n'est pas opérer)");
  }

  @Get("sante")
  async sante(@Req() r: any) {
    this.gardeLecture(r.ctx);
    const enSouffrance = await this.prisma.eventDeadLetter.findMany({
      where: { tenantId: r.ctx.tenantId, rejoueAt: null }, orderBy: { createdAt: "asc" } });
    const consommateurs = await this.prisma.eventConsumer.findMany();
    return {
      enSouffrance: enSouffrance.length,
      plusAncien: enSouffrance[0]?.createdAt ?? null,                        // « le plus ancien : X »
      deadLetters: enSouffrance.map((d) => ({ id: Number(d.id), consumer: d.consumer,
        seq: Number(d.eventId), erreur: d.erreur, tentatives: d.tentatives, depuis: d.createdAt })),
      consommateurs: consommateurs.map((c) => ({ consumer: c.consumer, stream: c.stream,
        lastSeq: Number(c.lastSeq), enRetry: c.blocageSeq != null, tentatives: c.tentatives })),
    };
  }

  @Post("dead-letters/:id/rejouer")
  async rejouer(@Req() r: any, @Param("id") id: string) {
    this.gardeEcriture(r.ctx);
    const dl = await this.prisma.eventDeadLetter.findFirst({
      where: { id: BigInt(id), tenantId: r.ctx.tenantId } });
    if (!dl) throw new NotFoundException("Dead-letter introuvable");
    if (dl.rejoueAt) throw new ConflictException("Dead-letter déjà rejouée (tracée)");
    const evs: any[] = await this.prisma.$queryRaw`
      SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events WHERE id = ${dl.eventId}`;
    if (!evs.length) throw new NotFoundException("Événement source introuvable au journal");
    const c = this.worker.consommateurs().find((x) => x.nom === dl.consumer);
    if (!c) throw new BadRequestException(`Consommateur inconnu du registre : ${dl.consumer}`);
    // Idempotence R286 : rejouer est TOUJOURS sûr — un échec ici reste visible (l'entrée demeure).
    await c.handle(evs[0], this.prisma);
    await this.prisma.$transaction(async (tx: Tx) => {
      await tx.eventDeadLetter.update({ where: { id: dl.id },
        data: { rejouePar: r.ctx.userId, rejoueAt: new Date() } });          // QUI (jeton), QUAND
      await emitEvent(tx, r.ctx.tenantId, "transport.deadletter.rejouee",
        String(dl.eventId), { consumer: dl.consumer, par: r.ctx.userId });
    });
    await this.audit.log(r.ctx.tenantId, r.ctx.userId, "TRANSPORT_DEADLETTER_REJOUEE", `${dl.consumer}:${dl.eventId}`);
    return { rejoue: true, consumer: dl.consumer, seq: Number(dl.eventId) };
  }
}
