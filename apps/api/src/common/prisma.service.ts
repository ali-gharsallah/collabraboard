import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  // Libère les connexions au shutdown du module (app.close()). Sans ce hook, chaque boot
  // (18 clients — un par module câblant sa PrismaService) laisse ses connexions ouvertes ;
  // en e2e, elles s'accumulent de suite en suite jusqu'à saturer Postgres (« too many clients »).
  async onModuleDestroy() { await this.$disconnect(); }
  // À utiliser dans chaque handler : fixe le tenant pour la RLS de la transaction.
  forTenant(_tenantId: string) {
    return this.$extends({
      query: { async $allOperations({ args, query }) {
        return query(args);   // le SET app.tenant_id se fait via $executeRaw en tx
      } },
    });
  }
}
