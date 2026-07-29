import { Global, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";
import { ConcurrencyConflictFilter } from "./optimistic-lock";
import { IdempotencyReuseFilter } from "./idempotency";

/**
 * CoreModule (@Global) — AUDIT A1. Un SEUL `PrismaService` (donc un seul pool de connexions) et un
 * seul `AuditService` pour toute l'application, au lieu d'une instance par module (~29 `PrismaClient`
 * auparavant — cause racine de l'épuisement de connexions « too many clients »). Refactor
 * BEHAVIOR-PRESERVING : l'isolation reste RLS + applicative (indépendante du nombre de clients) ;
 * prouvé par e2e 84/84 + recette RLS. Les modules n'ont plus à déclarer ces providers localement.
 */
@Global()
@Module({
  // Bloc A robustesse (R336/LK) : filtre GLOBAL mappant ConcurrencyConflictError → HTTP 409 typé.
  // Rien ne lève cette erreur tant que FF_OPTIMISTIC_LOCKING est off + qu'aucun handler n'adopte
  // majVersionnee : comportement inchangé (e2e verts), mais le contrat 409 est prêt et testé.
  providers: [PrismaService, AuditService,
    { provide: APP_FILTER, useClass: ConcurrencyConflictFilter },     // R336/LK → 409
    { provide: APP_FILTER, useClass: IdempotencyReuseFilter }],       // R337/IDM → 422
  exports: [PrismaService, AuditService],
})
export class CoreModule {}
