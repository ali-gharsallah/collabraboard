import { Injectable, BadRequestException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { StoragePort } from "./coffre.service";
import { TiersIndisponibleError } from "./ged-externe.adapter";

/**
 * Résolveur d'hébergeur documentaire — R180/R182 (GX-01, GX-02, GX-04). Le choix vit au
 * registre des paramètres (docStorage), se lit PAR TENANT À CHAQUE OPÉRATION (la bascule
 * gouvernée prend effet sans redéploiement), et le défaut est le coffre interne — on ne
 * devine jamais un tiers. Le CoffreService ratifié reste intact : l'appelant lui donne le
 * port résolu. R182 : une TiersIndisponibleError remontée est doublée d'un événement
 * ged.externe.indisponible via signal() — le refus reste explicite, rien ne l'avale.
 */

@Injectable()
export class StorageResolverService {
  constructor(private prisma: PrismaService, private adaptateurs: Record<string, StoragePort> = {}) {}

  async resolve(ctx: { tenantId: string }): Promise<StoragePort> {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    const choix = ((t?.settings as any)?.docStorage?.adaptateur) ?? "COFFRE_INTERNE";
    const brut = this.adaptateurs[choix];
    if (!brut)
      throw new BadRequestException(`R180 : adaptateur documentaire « ${choix} » non déployé — le registre déclare, le déploiement fournit`);
    return this.instrumenter(ctx.tenantId, choix, brut);
  }

  // R182 : la panne devient un SIGNAL en plus du refus — sans rien avaler.
  private instrumenter(tenantId: string, choix: string, port: StoragePort): StoragePort {
    const signal = async (operation: string, message: string) => {
      try {
        // ÉCART SIGNALÉ (lot 38) : le fichier livré écrivait `at: ...` sur DomainEvent, champ
        // INEXISTANT au schéma ratifié (la colonne d'horodatage est `createdAt @default(now())`).
        // Toléré ailleurs car les services écrivent via `tx: any` (non typé) ; ici l'accès
        // `this.prisma.domainEvent` EST typé → `at` retiré, createdAt fait foi. Cf. rapport lot 38.
        await emitEvent(this.prisma, tenantId, "ged.externe.indisponible",
          choix, { operation, message });
      } catch { /* le signal n'étouffe jamais le refus d'origine */ }
    };
    const garde = <A extends any[], R>(operation: string, fn: (...a: A) => Promise<R>) =>
      async (...a: A): Promise<R> => {
        try { return await fn(...a); }
        catch (e) {
          if (e instanceof TiersIndisponibleError) await signal(operation, e.message);
          throw e;
        }
      };
    return {
      ecrire: garde("dépôt", port.ecrire.bind(port)),
      lire: garde("lecture", port.lire.bind(port)),
      supprimer: garde("retrait", port.supprimer.bind(port)),
      lister: garde("inventaire", port.lister.bind(port)),
    };
  }
}
