import { Module } from "@nestjs/common";
import { EsEventStore } from "./es-event-store.service";

/**
 * ES-0 (docs/SURVEILLANCE-ES.md) — module SIDECAR du contexte « surveillance-es ».
 * Sens unique (§2) : ce module consommera le monolithe via l'outbox (ES-1) et ne lui parlera
 * qu'en PROPOSITIONS par ses API publiques (R44) — jamais d'écriture directe, jamais de FK
 * vers les tables du monolithe. Aucun controller en ES-0 : le socle expose le store aux
 * futurs souscripteur (ES-1) et agrégats (ES-2).
 */
@Module({ providers: [EsEventStore], exports: [EsEventStore] })
export class SurveillanceEsModule {}
