import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { flagActif } from "./feature-flags";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  // Libère les connexions au shutdown du module (app.close()). Sans ce hook, chaque boot
  // (18 clients — un par module câblant sa PrismaService) laisse ses connexions ouvertes ;
  // en e2e, elles s'accumulent de suite en suite jusqu'à saturer Postgres (« too many clients »).
  async onModuleDestroy() { await this.$disconnect(); }

  // ═══ Bloc D-runtime (R335/RB, robustesse) — transaction SCOPÉE tenant ════════════════════
  // Ouvre une transaction et, SOUS FF_RLS_ENFORCED, pose `app.tenant_id` en SET LOCAL
  // (set_config is_local=true, portée transaction) → la RLS FORCE s'applique DANS la transaction :
  // défense en profondeur, EN PLUS du filtrage applicatif (`WHERE tenant_id = ctx.tenantId`).
  // DÉFAUT (flag off) = transaction ordinaire, comportement LEGACY inchangé (l'isolation runtime
  // tient par le filtrage applicatif ; la RLS reste prouvée en base par la recette 4b).
  // NB : l'enforcement RÉEL exige aussi la bascule DATABASE_URL vers le rôle non-owner `olive_app`
  // (déploiement en 2 temps — voir docs/multi-tenancy.md). En superuser/owner la RLS est contournée.
  // tenantId provient du jeton (UUID) et passe en PARAMÈTRE lié (jamais d'interpolation SQL).
  withTenant<T>(tenantId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      if (flagActif("FF_RLS_ENFORCED"))
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
