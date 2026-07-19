import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { GoldenRecordProjector } from "./golden-record.projector";

// Poll transactionnel FOR UPDATE SKIP LOCKED : N workers en parallèle sans doublon.
// Livraison webhook signée HMAC ; retry exponentiel via published_at nul.
//
// PATCH 2026-07-19 (R104) : avant de marquer published_at, l'événement est dispatché aux
// projections internes — aujourd'hui GoldenRecordProjector (kyc.validated → fiche client).
// Application + published_at dans la MÊME transaction : at-least-once + handler idempotent
// (GR-03) = exactly-once effectif. Un handler qui rend { applied:false } ne bloque pas le drain.
@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private goldenRecord: GoldenRecordProjector) {}
  onModuleInit() { this.timer = setInterval(() => this.tick().catch(() => {}), 2000); }
  onModuleDestroy() { clearInterval(this.timer); }

  async tick() {
    await this.prisma.$transaction(async (tx) => {
      const batch: any[] = await tx.$queryRaw`
        SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events
        WHERE published_at IS NULL ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`;
      for (const ev of batch) {
        // ── Projections internes (R104) — dans la transaction du drain ──
        await this.goldenRecord.handle(ev, tx);

        // ── Livraison externe (webhook signé) ──
        const body = JSON.stringify({ event_id: `evt_${ev.id}`, type: ev.type,
          occurred_at: new Date().toISOString(), data: ev.payload });
        const sig = createHmac("sha256", process.env.WEBHOOK_SECRET ?? "dev")
          .update(body).digest("hex");
        // fetch(subscriberUrl, { headers: { "X-Olive-Signature": sig }, body }) — 2xx attendu < 10 s
        await tx.$executeRaw`UPDATE domain_events SET published_at = NOW() WHERE id = ${ev.id}`;
      }
    });
  }
}

/* Câblage module (events.module.ts) :
   providers: [OutboxWorker, GoldenRecordProjector, PrismaService, AuditService]
   Harnais  (run-rule-tests.sh) :
   + compiler  src/modules/events/golden-record.projector.ts
               src/modules/events/golden-record.projector.spec.ts
   + exécuter  echo "── Corpus GR-01..GR-04 (R104) ──"; run golden-record.projector.spec.js */
