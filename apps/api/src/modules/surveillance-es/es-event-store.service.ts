import { ConflictException, Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

/**
 * ES-0 (docs/SURVEILLANCE-ES.md §2-§3) — EVENT STORE du contexte surveillance-es.
 * Le store vit dans le schéma Postgres DÉDIÉ `es` (hors datamodel Prisma → accès SQL brut) :
 * ICI, et ici seulement, « event-sourcé » est vrai — l'état des agrégats ES se reconstruit par
 * rejeu de leurs streams (invariant 2). Append-only garanti PAR LA BASE (trigger, invariant 1) ;
 * ce service n'expose d'ailleurs AUCUNE primitive de mutation. Verrou OPTIMISTE par séquence
 * attendue : l'unicité (stream_type, stream_id, seq) arbitre les écritures concurrentes — un
 * append sur une séquence dépassée est un CONFLIT franc, jamais un écrasement.
 * S'instancie sans état module-global (leçon C8) : tout passe par la connexion Prisma injectée.
 */

export type EvenementEs = {
  type: string;                 // ex. AlerteLevee, EvidenceFigee (ES-2) ; fait.* (ES-1)
  payload: unknown;
  version?: number;             // version de schéma de l'événement (défaut 1)
  sourceEventId?: string | null; // id d'événement monolithe pour les FAITS D'ENTRÉE (idempotence ES-1)
  at?: string;                  // horodatage MÉTIER (ISO) — les faits d'entrée portent le `at` SOURCE
                                // (le backtest ES-3 filtre par période) ; défaut : now()
};

export type EvenementEsLu = {
  id: string; tenantId: string; streamType: string; streamId: string; seq: number;
  type: string; version: number; payload: unknown; sourceEventId: string | null; at: Date;
};

type Ctx = { tenantId: string };

@Injectable()
export class EsEventStore {
  constructor(private prisma: PrismaService) {}

  /**
   * Append avec verrou optimiste : `expectedSeq` = dernière séquence CONNUE de l'appelant
   * (0 pour un stream neuf). Les événements prennent expectedSeq+1..expectedSeq+n ; si le
   * stream a avancé entre-temps, la contrainte d'unicité rejette → ConflictException.
   */
  async append(ctx: Ctx, streamType: string, streamId: string, events: EvenementEs[], expectedSeq: number) {
    if (!events?.length) throw new BadRequestException("ES : append exige au moins un événement");
    if (!Number.isInteger(expectedSeq) || expectedSeq < 0)
      throw new BadRequestException("ES : expectedSeq doit être un entier >= 0");
    try {
      await this.prisma.$transaction(async (tx) => {
        for (let i = 0; i < events.length; i++) {
          const e = events[i];
          await tx.$executeRaw`
            INSERT INTO "es"."events"
              ("tenant_id", "stream_type", "stream_id", "seq", "type", "version", "payload", "source_event_id", "at")
            VALUES (${ctx.tenantId}::uuid, ${streamType}, ${streamId}, ${expectedSeq + 1 + i},
                    ${e.type}, ${e.version ?? 1}, ${JSON.stringify(e.payload)}::jsonb, ${e.sourceEventId ?? null},
                    COALESCE(${e.at ?? null}::timestamptz, now()))`;
        }
      });
    } catch (err: any) {
      // 23505 = unique_violation sur (stream_type, stream_id, seq) : le stream a avancé.
      if (String(err?.message ?? "").includes("23505") || err?.meta?.code === "23505")
        throw new ConflictException(
          `ES : conflit de séquence sur ${streamType}/${streamId} — attendu ${expectedSeq}, le stream a avancé (relire puis rejouer)`);
      throw err;
    }
    return { streamType, streamId, premierSeq: expectedSeq + 1, dernierSeq: expectedSeq + events.length };
  }

  /** Lecture d'un stream, ordonnée par séquence — la SOURCE de tout état d'agrégat ES (invariant 2). */
  async read(ctx: Ctx, streamType: string, streamId: string): Promise<EvenementEsLu[]> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT "id"::text AS id, "tenant_id"::text AS "tenantId", "stream_type" AS "streamType",
             "stream_id" AS "streamId", "seq", "type", "version", "payload",
             "source_event_id" AS "sourceEventId", "at"
      FROM "es"."events"
      WHERE "tenant_id" = ${ctx.tenantId}::uuid
        AND "stream_type" = ${streamType} AND "stream_id" = ${streamId}
      ORDER BY "seq" ASC`;
    return rows as EvenementEsLu[];
  }

  /** Tous les événements d'un TYPE de stream pour le tenant (projections ES-3) — ordonnés par
   *  (stream_id, seq) : chaque stream se rejoue dans l'ordre, les streams entre eux sont groupés. */
  async readTousParType(ctx: Ctx, streamType: string): Promise<EvenementEsLu[]> {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT "id"::text AS id, "tenant_id"::text AS "tenantId", "stream_type" AS "streamType",
             "stream_id" AS "streamId", "seq", "type", "version", "payload",
             "source_event_id" AS "sourceEventId", "at"
      FROM "es"."events"
      WHERE "tenant_id" = ${ctx.tenantId}::uuid AND "stream_type" = ${streamType}
      ORDER BY "stream_id" ASC, "seq" ASC`;
    return rows as EvenementEsLu[];
  }

  /** Dernière séquence d'un stream (0 si vide) — pour ouvrir un append optimiste. */
  async derniereSeq(ctx: Ctx, streamType: string, streamId: string): Promise<number> {
    const r = await this.prisma.$queryRaw<{ max: number | null }[]>`
      SELECT max("seq")::int AS max FROM "es"."events"
      WHERE "tenant_id" = ${ctx.tenantId}::uuid
        AND "stream_type" = ${streamType} AND "stream_id" = ${streamId}`;
    return r[0]?.max ?? 0;
  }
}
