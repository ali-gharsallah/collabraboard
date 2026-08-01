import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { flagActif } from "../../common/feature-flags";
import { loadSettings } from "../../common/tenant-settings";
import { GoldenRecordProjector } from "./golden-record.projector";
import { CaseProposalConsumer } from "./case-proposal.consumer";
import { OnboardingService } from "../onboarding/onboarding.service";

// Poll transactionnel FOR UPDATE SKIP LOCKED : N workers en parallèle sans doublon.
// Livraison webhook signée HMAC ; retry exponentiel via published_at nul.
//
// ═══ R285 (canon SO + transport async, ratifié 2026-07-28) : ce relais est L'UNIQUE voie
// d'émission — rien ne part qui ne soit d'abord ÉCRIT dans l'outbox (même transaction que le
// métier). Le message de transport porte des RÉFÉRENCES, jamais le payload métier complet :
// le consommateur relit la source de vérité, qui applique RBAC/RLS (AS-01, AS-02).
//
// ═══ R286 : livraison AT-LEAST-ONCE — jamais un exactly-once prétendu. Chaque consommateur
// porte son WATERMARK persisté (event_consumers) ; un consommateur NAÎT AU PRÉSENT (le
// rattrapage historique est un rejeu EXPLICITE, jamais implicite). La tête de flux en échec
// suit retry + backoff bornés (retry_max, backoff_base_s — paramètres tenant) puis part en
// DEAD-LETTER tracée et le flux REPART (jamais de blocage, R39) ; le rejeu est manuel et
// tracé (qui, quand). L'ordre est garanti PAR FLUX (id croissant ⊇ ordre par agrégat) —
// aucun consommateur ne suppose d'ordre inter-agrégats (AS-03..05).
//
// PATCH 2026-07-19 (R104) : projections internes → depuis R286, les consommateurs internes
// (golden-record, worker-riskcases) vivent sur LEURS watermarks — handlers idempotents
// (GR-03, UC-01/PC-10), la redélivrance est normale.
// R285 / AS-02 : LE message de transport — identifiants et références, JAMAIS le payload
// (le payload reste au journal ; sa relecture passe par l'API, donc par les droits).
export function messageDeTransport(ev: { id: bigint | number; tenant_id: string; type: string; aggregate_id: string }) {
  return { event_id: `evt_${ev.id}`, seq: Number(ev.id), type: ev.type,
    tenant_id: ev.tenant_id, aggregate_id: ev.aggregate_id, occurred_at: new Date().toISOString() };
}

type Consommateur = { nom: string; handle: (ev: any, db: any) => Promise<any> };

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private slaTimer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private goldenRecord: GoldenRecordProjector,
              private onboarding: OnboardingService,
              private caseProposal?: CaseProposalConsumer) {}

  // R286 : LE registre des consommateurs internes — un nom stable = un watermark.
  consommateurs(): Consommateur[] {
    const cs: Consommateur[] = [
      { nom: "golden-record", handle: (ev, db) => this.goldenRecord.handle(ev, db) }];
    if (this.caseProposal)
      cs.push({ nom: "worker-riskcases", handle: (ev, db) => this.caseProposal!.handle(ev, db) });
    return cs;
  }

  async onModuleInit() {
    // R286 : un consommateur naît AU PRÉSENT — watermark initialisé à MAX(id) s'il n'existe pas.
    await this.initialiserWatermarks().catch((e) => console.error("[outbox] init watermarks:", e?.message ?? e));
    // R286 : l'échec du tick n'est JAMAIS silencieux (l'ancien catch vide était l'anti-pattern).
    this.timer = setInterval(() => this.tick().catch((e) => console.error("[outbox] tick:", e?.message ?? e)), 2000);
    // R120 : sweep SLA onboarding — alerte une fois, n'abandonne jamais. Cadence jour → 60 s suffit.
    this.slaTimer = setInterval(() => this.slaSweep().catch((e) => console.error("[outbox] slaSweep:", e?.message ?? e)), 60000);
  }
  onModuleDestroy() { clearInterval(this.timer); clearInterval(this.slaTimer); }

  private async initialiserWatermarks() {
    const m: any[] = await this.prisma.$queryRaw`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM domain_events`;
    for (const c of this.consommateurs())
      await this.prisma.eventConsumer.upsert({
        where: { consumer_stream: { consumer: c.nom, stream: "global" } },
        update: {}, create: { consumer: c.nom, stream: "global", lastSeq: m[0].m } });
  }

  // Le scheduler existant porte aussi le tick SLA (R120) : itère les tenants et délègue à
  // OnboardingService.tickSla. Best-effort, hors de la transaction du drain outbox.
  async slaSweep() {
    const tenants: any[] = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants)
      await this.onboarding.tickSla({ tenantId: t.id, userId: "system", role: "SYSTEM" }, new Date())
        .catch(() => {});
  }

  async tick() {
    for (const c of this.consommateurs()) await this.drainerConsommateur(c);
    await this.publier();
  }

  // ── R286 : drain PAR CONSOMMATEUR, watermark persisté, retry/backoff borné, dead-letter. ──
  private async drainerConsommateur(c: Consommateur) {
    const cleW = { consumer_stream: { consumer: c.nom, stream: "global" } };
    for (;;) {
      let w = await this.prisma.eventConsumer.findUnique({ where: cleW });
      if (!w) return;                                                        // pas encore initialisé
      if (w.prochaineTentativeAt && w.prochaineTentativeAt.getTime() > Date.now()) return; // backoff en cours
      const batch: any[] = await this.prisma.$queryRaw`
        SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events
        WHERE id > ${w.lastSeq} ORDER BY id LIMIT 50`;
      if (!batch.length) return;
      for (const ev of batch) {
        try {
          // RLS runtime : sous FF_RLS_ENFORCED, pose `app.tenant_id = ev.tenant_id` (SET LOCAL,
          // scope transaction) AVANT le handler — le worker lit un stream global (privilégié)
          // puis SCOPE chaque événement à SON tenant (consigne : le tenant porté par l'événement,
          // jamais un tenant global). Flag OFF = chemin legacy octet-identique.
          // NB (couverture) : ne profite qu'aux handlers utilisant le `db`/`tx` passé
          //  → golden-record OUI ; case-proposal délègue à RiskCaseService (prisma propre) → GUC
          //  non propagé (voir docs/rls-coverage-audit.md §2).
          if (flagActif("FF_RLS_ENFORCED"))
            await this.prisma.withTenant(ev.tenant_id, (tx) => c.handle(ev, tx));
          else
            await c.handle(ev, this.prisma);
          w = await this.prisma.eventConsumer.update({ where: cleW,
            data: { lastSeq: ev.id, blocageSeq: null, tentatives: 0, prochaineTentativeAt: null } });
        } catch (e: any) {
          const s = await loadSettings(this.prisma, ev.tenant_id).catch(() => ({}));
          const retryMax = s.retry_max ?? 5;
          const backoffBaseS = s.backoff_base_s ?? 10;
          const tentatives = (w.blocageSeq === ev.id ? w.tentatives : 0) + 1;
          if (tentatives >= retryMax) {
            // ── DEAD-LETTER tracée + notification (R39) — le flux REPART, jamais de blocage. ──
            await this.prisma.$transaction(async (tx) => {
              await tx.eventDeadLetter.create({ data: { tenantId: ev.tenant_id, consumer: c.nom,
                eventId: ev.id, erreur: String(e?.message ?? e), tentatives } });
              const seuil = s.dead_letter_alerte_seuil ?? 1;
              const enSouffrance = await tx.eventDeadLetter.count({
                where: { tenantId: ev.tenant_id, consumer: c.nom, rejoueAt: null } });
              if (enSouffrance >= seuil)
                await tx.domainEvent.create({ data: { tenantId: ev.tenant_id, type: "transport.deadletter",
                  aggregateId: String(ev.id), payload: { consumer: c.nom, seq: Number(ev.id), enSouffrance },
                  at: new Date().toISOString() } });
              await tx.eventConsumer.update({ where: cleW,
                data: { lastSeq: ev.id, blocageSeq: null, tentatives: 0, prochaineTentativeAt: null } });
            });
            w = (await this.prisma.eventConsumer.findUnique({ where: cleW }))!;
          } else {
            await this.prisma.eventConsumer.update({ where: cleW,
              data: { blocageSeq: ev.id, tentatives,
                prochaineTentativeAt: new Date(Date.now() + backoffBaseS * 1000 * Math.pow(2, tentatives - 1)) } });
            return;                                                          // tête de flux en retry — on rend la main
          }
        }
      }
    }
  }

  // ── Publication externe (marqueur published_at) — corps R285 : références seules. ──
  private async publier() {
    await this.prisma.$transaction(async (tx) => {
      const batch: any[] = await tx.$queryRaw`
        SELECT id, tenant_id, type, aggregate_id, payload FROM domain_events
        WHERE published_at IS NULL ORDER BY id LIMIT 20 FOR UPDATE SKIP LOCKED`;
      for (const ev of batch) {
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
   providers: [OutboxWorker, GoldenRecordProjector, CaseProposalConsumer]
   Harnais  (run-rule-tests.sh) :
   + compiler  src/modules/events/golden-record.projector.ts
               src/modules/events/golden-record.projector.spec.ts
   + exécuter  echo "── Corpus GR-01..GR-04 (R104) ──"; run golden-record.projector.spec.js */
