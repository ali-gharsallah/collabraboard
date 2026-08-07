import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { EsEventStore } from "./es-event-store.service";
import { SCHEMAS_ES } from "./contracts";

/**
 * ES-1 (docs/SURVEILLANCE-ES.md §2) — SOUSCRIPTEUR outbox → faits d'entrée.
 * Même mécanique de drainage que les consommateurs R286 du monolithe (watermark persisté,
 * at-least-once, naissance AU PRÉSENT) — SANS modifier events/outbox.worker.ts : le curseur
 * vit dans es.subscription_cursor, côté ES. Chaque événement consommé du monolithe passe la
 * garde anti-corruption (contracts/) puis est appendé comme FAIT D'ENTRÉE horodaté avec son
 * source_event_id (idempotence : re-livrer le même id = no-op). Un payload non conforme part
 * dans le stream `quarantine` avec le détail des erreurs + compteur — JAMAIS de crash, JAMAIS
 * de skip silencieux. Les faits d'entrée ne sont PAS la source d'un état ES (ce sont des
 * entrées) — les événements NATIFS des agrégats arrivent en ES-2.
 * Le drainage périodique est DORMANT par défaut (§1 : pas actif avant ES-4) : timer seulement
 * si ES_SOUSCRIPTEUR=on ; les tests et le shadow (ES-4) appellent drainer() explicitement.
 */

export const CONSOMMATEUR_ES = "surveillance-es";
export const STREAM_FAITS = "fait-entree";       // un stream par (tenant, type source) — cf. cleFlux
export const STREAM_QUARANTAINE = "quarantine";
/** L'unicité es.events est (stream_type, stream_id, seq) SANS tenant : le stream physique est
 *  donc scopé tenant dans son id — deux tenants ne partagent jamais une séquence. */
export const cleFlux = (tenantId: string, type: string) => `${tenantId}:${type}`;

type Bilan = { traites: number; faits: number; quarantaine: number; ignores: number; dernierSeq: number };

@Injectable()
export class EsSubscriber implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private store: EsEventStore) {}

  onModuleInit() {
    if (process.env.ES_SOUSCRIPTEUR === "on")
      this.timer = setInterval(() => this.drainer().catch((e) =>
        console.error("[surveillance-es] drainer:", e?.message ?? e)), 2000);
  }
  onModuleDestroy() { clearInterval(this.timer); }

  /** R286 : le souscripteur NAÎT AU PRÉSENT — curseur initialisé à MAX(id) s'il n'existe pas. */
  async assurerCurseur(): Promise<{ lastSeq: bigint }> {
    await this.prisma.$executeRaw`
      INSERT INTO "es"."subscription_cursor" ("consumer", "last_seq")
      VALUES (${CONSOMMATEUR_ES}, (SELECT COALESCE(MAX(id), 0) FROM domain_events))
      ON CONFLICT ("consumer") DO NOTHING`;
    const r = await this.prisma.$queryRaw<{ last_seq: bigint }[]>`
      SELECT "last_seq" FROM "es"."subscription_cursor" WHERE "consumer" = ${CONSOMMATEUR_ES}`;
    return { lastSeq: BigInt(r[0].last_seq) };
  }

  /**
   * Draine l'outbox depuis le curseur : validation anti-corruption → fait d'entrée (ou
   * quarantaine), curseur avancé APRÈS chaque événement (une coupure re-livre au plus
   * l'événement en cours — l'idempotence par source_event_id rend la reprise sans doublon).
   */
  async drainer(maxParBatch = 200): Promise<Bilan> {
    const bilan: Bilan = { traites: 0, faits: 0, quarantaine: 0, ignores: 0, dernierSeq: 0 };
    let { lastSeq } = await this.assurerCurseur();
    for (;;) {
      const batch = await this.prisma.$queryRaw<any[]>`
        SELECT id, tenant_id, type, aggregate_id, payload, event_version, at
        FROM domain_events WHERE id > ${lastSeq} ORDER BY id LIMIT ${maxParBatch}`;
      if (!batch.length) break;
      for (const ev of batch) {
        await this.traiter(ev, bilan);
        lastSeq = BigInt(ev.id);
        await this.prisma.$executeRaw`
          UPDATE "es"."subscription_cursor"
          SET "last_seq" = ${lastSeq}, "updated_at" = now() WHERE "consumer" = ${CONSOMMATEUR_ES}`;
        bilan.traites++; bilan.dernierSeq = Number(lastSeq);
      }
      if (batch.length < maxParBatch) break;
    }
    return bilan;
  }

  private async traiter(ev: any, bilan: Bilan) {
    const garde = SCHEMAS_ES[ev.type];
    if (!garde) { bilan.ignores++; return; }                      // type hors périmètre ES : non consommé
    const sourceEventId = String(ev.id);
    // Idempotence (invariant 5) : re-livraison du même événement outbox = no-op prouvé.
    const deja = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "es"."events" WHERE "source_event_id" = ${sourceEventId}`;
    if (deja[0].n > 0) return;

    const ctx = { tenantId: ev.tenant_id };
    const source = { eventId: sourceEventId, type: ev.type, aggregateId: ev.aggregate_id,
      eventVersion: ev.event_version ?? 1, at: ev.at instanceof Date ? ev.at.toISOString() : String(ev.at) };
    const verdict = garde.schema.safeParse(ev.payload);
    if (verdict.success) {
      // Le fait stocke le payload ORIGINAL (la garde est une porte, pas une transformation).
      const streamId = cleFlux(ev.tenant_id, ev.type);
      await this.store.append(ctx, STREAM_FAITS, streamId,
        [{ type: `fait.${ev.type}`, version: garde.version, sourceEventId,
           payload: { source, donnees: ev.payload } }],
        await this.store.derniereSeq(ctx, STREAM_FAITS, streamId));
      await this.prisma.$executeRaw`
        UPDATE "es"."subscription_cursor" SET "nb_faits" = "nb_faits" + 1 WHERE "consumer" = ${CONSOMMATEUR_ES}`;
      bilan.faits++;
    } else {
      const streamId = cleFlux(ev.tenant_id, ev.type);
      await this.store.append(ctx, STREAM_QUARANTAINE, streamId,
        [{ type: "fait.quarantaine", version: 1, sourceEventId,
           payload: { source, donnees: ev.payload,
             erreurs: verdict.error.issues.map((i) => ({ chemin: i.path.join("."), code: i.code, message: i.message })) } }],
        await this.store.derniereSeq(ctx, STREAM_QUARANTAINE, streamId));
      await this.prisma.$executeRaw`
        UPDATE "es"."subscription_cursor" SET "nb_quarantaine" = "nb_quarantaine" + 1 WHERE "consumer" = ${CONSOMMATEUR_ES}`;
      bilan.quarantaine++;
    }
  }

  /** Observabilité : curseur + compteurs (le bandeau/rapport ES-4 les consommera). */
  async etat() {
    const r = await this.prisma.$queryRaw<any[]>`
      SELECT "consumer", "last_seq"::text AS "lastSeq", "nb_faits"::int AS "nbFaits",
             "nb_quarantaine"::int AS "nbQuarantaine", "updated_at" AS "updatedAt"
      FROM "es"."subscription_cursor" WHERE "consumer" = ${CONSOMMATEUR_ES}`;
    return r[0] ?? null;
  }
}
