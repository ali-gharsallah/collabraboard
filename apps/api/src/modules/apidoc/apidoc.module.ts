import { Controller, Get, Module, Req } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { CONTRACT_VERSION } from "../cpsi/cpsi.module";

/**
 * `apidoc` — application du canon triage final (ratifié 2026-07-28), AUCUNE règle nouvelle.
 * La documentation d'API est GÉNÉRÉE depuis les contrats RÉELS — jamais rédigée à la main
 * (une doc manuelle diverge ; la générée fait foi) : l'inventaire des routes est extrait du
 * ROUTEUR EXPRESS VIVANT au moment de l'appel (tout endpoint monté y figure par construction —
 * l'écart « endpoint non documenté » est structurellement impossible), et le contrat de la
 * porte CPSI expose sa version d'enveloppe (R248/R281). Lecture seule, tous rôles
 * authentifiés (métadonnées techniques, aucune donnée client).
 */
@Controller("apidoc")
export class ApidocController {
  constructor(private readonly adapter: HttpAdapterHost) {}

  @Get()
  routes(@Req() _r: any) {
    const instance = this.adapter.httpAdapter.getInstance();
    const routes: { methode: string; chemin: string }[] = [];
    const empiler = (stack: any[]) => {
      for (const couche of stack ?? []) {
        if (couche.route?.path) {
          for (const m of Object.keys(couche.route.methods ?? {}))
            routes.push({ methode: m.toUpperCase(), chemin: couche.route.path });
        } else if (couche.name === "router" && couche.handle?.stack) empiler(couche.handle.stack);
      }
    };
    empiler(instance._router?.stack ?? []);
    routes.sort((a, b) => a.chemin.localeCompare(b.chemin) || a.methode.localeCompare(b.methode));
    // Regroupement par module (2e segment : /v1/<module>/...)
    const parModule: Record<string, { methode: string; chemin: string }[]> = {};
    for (const r of routes) {
      const mod = r.chemin.split("/")[2] ?? "racine";
      (parModule[mod] = parModule[mod] ?? []).push(r);
    }
    return {
      genereAt: new Date().toISOString(),
      source: "routeur express vivant (rien de rédigé à la main)",
      total: routes.length,
      porteCpsi: { contractVersion: CONTRACT_VERSION,
        note: "enveloppe versionnée R248/R281 — la 1.0 reste servie, alias 1.1 (timeline_client, reporting_volumetrie, reporting_sla)" },
      parModule,
    };
  }
}

@Module({ controllers: [ApidocController] })
export class ApidocModule {}
