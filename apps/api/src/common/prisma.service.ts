import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() { await this.$connect(); }
  // À utiliser dans chaque handler : fixe le tenant pour la RLS de la transaction.
  forTenant(tenantId: string) {
    return this.$extends({
      query: { async $allOperations({ args, query }) {
        return query(args);   // le SET app.tenant_id se fait via $executeRaw en tx
      } },
    });
  }
}
