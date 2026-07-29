import { Controller, ForbiddenException, Get, Headers, Query, Req, Res } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { messageDeTransport } from "./outbox.worker";

/**
 * R287 — LE hub SSE : une PROJECTION éphémère du journal, jamais un canal de vérité.
 * - Le flux DESCEND seul : GET unique, aucune donnée entrante au-delà du handshake
 *   (Last-Event-ID = watermark client) — toute commande reste un POST HTTP audité (AS-07).
 * - La reconnexion se rattrape PAR LE JOURNAL : le serveur resert depuis Last-Event-ID —
 *   une coupure ne perd rien, l'idempotence côté client (référence d'événement) ne double
 *   rien à l'écran (AS-06).
 * - Les messages sont des RÉFÉRENCES (forme R285 : messageDeTransport) — le consommateur
 *   relit la source, qui applique RBAC/RLS.
 * - Le SCOPE s'applique à l'abonnement (user, role, tenant) : la référence d'un objet
 *   interdit ne part JAMAIS — même l'existence est une donnée (pattern OL-34, AS-08).
 *   RM/ARM : seuls les événements de LEURS clients (default-deny) ; ADMIN : refus (A.3).
 * - `?attente=0` : mode rattrapage borné (sert le backlog puis clôt) — testable et utilisable
 *   en polling dégradé ; sinon la connexion reste ouverte (poll journal + heartbeat).
 */
@Controller("events")
export class SseController {
  constructor(private prisma: PrismaService) {}

  @Get("stream")
  async stream(@Req() req: any, @Res() res: any,
    @Headers("last-event-id") lastEventId?: string, @Query("attente") attente?: string) {
    const ctx = req.ctx as { tenantId: string; userId: string; role: string };
    if (ctx.role === "ADMIN")
      throw new ForbiddenException("HOME_SCOPE: ADMIN ne voit aucune donnée client (matrice A.3)");
    // Scope FIGÉ à l'abonnement : RM/ARM = leurs clients (default-deny), voit-tout = tenant.
    let clientsAutorises: Set<string> | null = null;
    if (ctx.role === "RM" || ctx.role === "ARM") {
      const miens = await this.prisma.client.findMany({
        where: { tenantId: ctx.tenantId, rmUserId: ctx.userId }, select: { id: true } });
      clientsAutorises = new Set(miens.map((c) => c.id));
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let depuis: bigint;
    if (lastEventId != null && /^\d+$/.test(lastEventId)) depuis = BigInt(lastEventId);
    else {                                                                   // sans watermark : on s'abonne AU PRÉSENT
      const m: any[] = await this.prisma.$queryRaw`SELECT COALESCE(MAX(id),0)::bigint AS m FROM domain_events`;
      depuis = BigInt(m[0].m);
    }

    const servir = async (): Promise<bigint> => {
      const evs: any[] = await this.prisma.$queryRaw`
        SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events
        WHERE tenant_id = ${ctx.tenantId}::uuid AND id > ${depuis} ORDER BY id LIMIT 500`;
      for (const ev of evs) {
        depuis = BigInt(ev.id);
        if (clientsAutorises) {                                              // AS-08 : default-deny — la référence d'un
          const cid = ev.payload?.clientId ?? ev.payload?.client ?? null;    // objet hors scope ne part JAMAIS
          if (!cid || !clientsAutorises.has(cid)) continue;
        }
        res.write(`id: ${ev.id}\nevent: reference\ndata: ${JSON.stringify(messageDeTransport(ev))}\n\n`);
      }
      return depuis;
    };

    await servir();                                                          // rattrapage depuis le journal (AS-06)
    if (attente === "0") { res.end(); return; }                              // mode borné (tests / polling dégradé)

    const timer = setInterval(async () => {
      try { await servir(); res.write(`: heartbeat ${Date.now()}\n\n`); }    // le flux notifie, jamais ne bloque
      catch (e: any) { console.error("[sse] servir:", e?.message ?? e); }    // R286 : jamais silencieux
    }, 1000);
    req.on("close", () => clearInterval(timer));
  }
}
