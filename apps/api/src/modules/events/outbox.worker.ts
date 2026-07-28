import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { GoldenRecordProjector } from "./golden-record.projector";
import { OnboardingService } from "../onboarding/onboarding.service";

// Poll transactionnel FOR UPDATE SKIP LOCKED : N workers en parallèle sans doublon.
// Livraison webhook signée HMAC ; retry exponentiel via published_at nul.
//
// ═══ R285 (canon SO + transport async, ratifié 2026-07-28) : ce relais est L'UNIQUE voie
// d'émission — rien ne part qui ne soit d'abord ÉCRIT dans l'outbox (même transaction que le
// métier). Le message de transport porte des RÉFÉRENCES, jamais le payload métier complet :
// le consommateur relit la source de vérité, qui applique RBAC/RLS (AS-01, AS-02).
//
// PATCH 2026-07-19 (R104) : avant de marquer published_at, l'événement est dispatché aux
// projections internes — aujourd'hui GoldenRecordProjector (kyc.validated → fiche client).
// Application + published_at dans la MÊME transaction : at-least-once + handler idempotent
// (GR-03) = exactly-once effectif. Un handler qui rend { applied:false } ne bloque pas le drain.
// R285 / AS-02 : LE message de transport — identifiants et références, JAMAIS le payload
// (le payload reste au journal ; sa relecture passe par l'API, donc par les droits).
export function messageDeTransport(ev: { id: bigint | number; tenant_id: string; type: string; aggregate_id: string }) {
  return { event_id: `evt_${ev.id}`, seq: Number(ev.id), type: ev.type,
    tenant_id: ev.tenant_id, aggregate_id: ev.aggregate_id, occurred_at: new Date().toISOString() };
}

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private slaTimer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private goldenRecord: GoldenRecordProjector,
              private onboarding: OnboardingService) {}
  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch(() => {}), 2000);
    // R120 : sweep SLA onboarding — alerte une fois, n'abandonne jamais. Cadence jour → 60 s suffit.
    this.slaTimer = setInterval(() => this.slaSweep().catch(() => {}), 60000);
  }
  onModuleDestroy() { clearInterval(this.timer); clearInterval(this.slaTimer); }

  // Le scheduler existant porte aussi le tick SLA (R120) : itère les tenants et délègue à
  // OnboardingService.tickSla. Best-effort, hors de la transaction du drain outbox.
  async slaSweep() {
    const tenants: any[] = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants)
      await this.onboarding.tickSla({ tenantId: t.id, userId: "system", role: "SYSTEM" }, new Date())
        .catch(() => {});
  }

  async tick() {
    await this.prisma.$transaction(async (tx) => {
      const batch: any[] = await tx.$queryRaw`
        SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events
        WHERE published_at IS NULL ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`;
      for (const ev of batch) {
        // ── Projections internes (R104) — dans la transaction du drain ──
        await this.goldenRecord.handle(ev, tx);

        // ── Livraison externe (webhook signé) — R285 : références SEULES ──
        const body = JSON.stringify(messageDeTransport(ev));
        const _sig = createHmac("sha256", process.env.WEBHOOK_SECRET ?? "dev")
          .update(body).digest("hex");
        // fetch(subscriberUrl, { headers: { "X-Olive-Signature": _sig }, body }) — 2xx attendu < 10 s (livraison Phase 2)
        await tx.$executeRaw`UPDATE domain_events SET published_at = NOW() WHERE id = ${ev.id}`;
      }
    });
  }
}

/* Câblage module (events.module.ts) :
   providers: [OutboxWorker, GoldenRecordProjector]
   Harnais  (run-rule-tests.sh) :
   + compiler  src/modules/events/golden-record.projector.ts
               src/modules/events/golden-record.projector.spec.ts
   + exécuter  echo "── Corpus GR-01..GR-04 (R104) ──"; run golden-record.projector.spec.js */
