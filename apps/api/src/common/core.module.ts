import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuditService } from "./audit.service";

/**
 * CoreModule (@Global) — AUDIT A1. Un SEUL `PrismaService` (donc un seul pool de connexions) et un
 * seul `AuditService` pour toute l'application, au lieu d'une instance par module (~29 `PrismaClient`
 * auparavant — cause racine de l'épuisement de connexions « too many clients »). Refactor
 * BEHAVIOR-PRESERVING : l'isolation reste RLS + applicative (indépendante du nombre de clients) ;
 * prouvé par e2e 84/84 + recette RLS. Les modules n'ont plus à déclarer ces providers localement.
 */
@Global()
@Module({
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class CoreModule {}
