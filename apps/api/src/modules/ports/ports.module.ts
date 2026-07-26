import { Controller, Get, Param, Post, Req, Module, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

/**
 * Porte HTTP « Ports » (SPEC-FRONT-CÂBLAGE v2, FE-PORT) — projection LISIBLE, en lecture seule,
 * des ports RÉELLEMENT RATIFIÉS de la plateforme. Aucune règle nouvelle : le statut d'un port
 * est déduit de la PRÉSENCE de sa configuration au registre R-Q du tenant (les clés `*Ref`/
 * `docStorage`), jamais de son secret. « Pas de secret = refus gracieux » : le port répond
 * NOT_CONFIGURED, et JAMAIS le secret ne transite (le navigateur n'en voit que l'état).
 *
 * ⚠ Écart signalé (docs/ECARTS-FRONT.md) : la spec cite des ports fx/custody/mobile — NON
 * ratifiés à ce jour. Ce registre n'expose que les ports existants du canon : core banking
 * (R167→R169), prestataire IA (R163), coffre/stockage documentaire (R180/R144→R146). Les
 * ajouter serait inventer du canon — refusé.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type PortStatus = "CONFIGURED" | "NOT_CONFIGURED";
type PortDef = { portId: string; label: string; cle: string; regle: string };

// Ports ratifiés (clé au registre R-Q → présence = configuré). Ordre = valeur plateforme.
const PORTS: PortDef[] = [
  { portId: "core-banking", label: "Core banking (Avaloq / Temenos / Olympic-ERI)", cle: "coreSystemeRef", regle: "R167" },
  { portId: "ia",           label: "Prestataire IA",                                cle: "iaProviderRef",  regle: "R163" },
  { portId: "storage",      label: "Coffre / stockage documentaire",                cle: "docStorage",     regle: "R180" },
];

const estConfigure = (settings: any, cle: string): PortStatus => {
  const v = (settings ?? {})[cle];
  if (v === null || v === undefined) return "NOT_CONFIGURED";
  if (typeof v === "string") return v.trim() ? "CONFIGURED" : "NOT_CONFIGURED";
  if (typeof v === "object") return Object.keys(v).length ? "CONFIGURED" : "NOT_CONFIGURED";
  return "CONFIGURED";
};

@Injectable()
export class PortsService {
  constructor(private prisma: PrismaService) {}

  private async settings(ctx: Ctx) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return (t.settings as any) ?? {};
  }

  // Registre des ports : [{ portId, label, status, regle, lastCheckAt }] — lecture pure.
  async registre(ctx: Ctx) {
    const settings = await this.settings(ctx);
    const at = new Date().toISOString();
    return PORTS.map((p) => ({
      portId: p.portId, label: p.label, regle: p.regle,
      status: estConfigure(settings, p.cle), lastCheckAt: at,
    }));
  }

  // Santé d'un port : { status, detail, checkedAt } — jamais le secret, seulement l'état.
  async health(ctx: Ctx, portId: string) {
    const def = PORTS.find((p) => p.portId === portId);
    if (!def) throw new NotFoundException(`Port inconnu — «${portId}» n'est pas un port ratifié`);
    const settings = await this.settings(ctx);
    const status = estConfigure(settings, def.cle);
    const detail = status === "CONFIGURED"
      ? `Port configuré (référence tenant présente pour ${def.cle}, ${def.regle})`
      : `Port non configuré — renseigner la référence côté tenant (${def.cle}, ${def.regle}). Aucun secret côté navigateur.`;
    return { portId, status, detail, checkedAt: new Date().toISOString() };
  }
}

@Controller("ports")
export class PortsController {
  constructor(private svc: PortsService) {}
  @Get()                registre(@Req() r: any) { return this.svc.registre(r.ctx); }                            // GET /v1/ports
  @Get(":portId/health") health(@Req() r: any, @Param("portId") portId: string) { return this.svc.health(r.ctx, portId); } // GET /v1/ports/:portId/health
  @Post(":portId/health") retest(@Req() r: any, @Param("portId") portId: string) { return this.svc.health(r.ctx, portId); } // POST re-test (pas d'effet de bord — relit l'état)
}

@Module({
  controllers: [PortsController],
  providers: [
    PrismaService,
    { provide: PortsService, useFactory: (p: PrismaService) => new PortsService(p), inject: [PrismaService] },
  ],
  exports: [PortsService],
})
export class PortsModule {}
