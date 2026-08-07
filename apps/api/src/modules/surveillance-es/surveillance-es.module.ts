import { Module } from "@nestjs/common";
import { EsEventStore } from "./es-event-store.service";
import { EsSubscriber } from "./es-subscriber.service";
import { EsAlertes } from "./alertes.service";
import { EsProjections } from "./es-projections.service";
import { EsBacktest } from "./es-backtest.service";
import { EsShadow } from "./es-shadow.service";
import { EsHits } from "./es-hits.service";
import { TasksModule } from "../tasks/tasks.module";

/**
 * ES-0 (docs/SURVEILLANCE-ES.md) — module SIDECAR du contexte « surveillance-es ».
 * Sens unique (§2) : ce module consommera le monolithe via l'outbox (ES-1) et ne lui parlera
 * qu'en PROPOSITIONS par ses API publiques (R44) — jamais d'écriture directe, jamais de FK
 * vers les tables du monolithe. Aucun controller en ES-0 : le socle expose le store aux
 * futurs agrégats (ES-2). Le souscripteur outbox (ES-1) est DORMANT par défaut : son timer ne
 * s'arme que sous ES_SOUSCRIPTEUR=on (§1 : le module n'est pas actif avant la réconciliation
 * ES-4) — les tests et le shadow appellent drainer() explicitement.
 */
// TasksModule = le canal de PROPOSITION (R239/R44) : la seule dépendance sortante vers le
// monolithe, hors du contexte Surveillance gardé (frontière L3) — jamais d'écriture directe.
@Module({ imports: [TasksModule],
  providers: [EsEventStore, EsSubscriber, EsAlertes, EsProjections, EsBacktest, EsShadow, EsHits],
  exports: [EsEventStore, EsSubscriber, EsAlertes, EsProjections, EsBacktest, EsShadow, EsHits] })
export class SurveillanceEsModule {}
