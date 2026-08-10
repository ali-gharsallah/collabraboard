// ETL & intégration core banking — R480→R489 (spec/ETL-CORE-BANKING-R480-R489-PROPOSITION.md,
// ARBITRÉE PO 10.08.2026 : Q1 générique CSV/SFTP · Q2 clients+comptes+transactions · Q3 EOD ·
// Q4 tout-ou-rien par défaut · Q5 numérotation ratifiée).
// SQUELETTE de la phase ROUGE (ET-01..08) : la surface d'API est contractuelle, chaque méthode
// refuse « non implémenté » — l'implémentation verte suit, tests d'abord.
type Ctx = { tenantId: string; userId: string; role: string };

export type LigneImport = { externalRef: string; data: Record<string, unknown> };
export type FamilleImport = "CLIENTS" | "COMPTES" | "TRANSACTIONS";           // périmètre v1 (Q2)

// Le port fournit l'accès au connecteur (R284/R286) : pas de secret = refus gracieux (R486).
export type PortEtl = { secretPresent(connecteur: string): boolean };

export class EtlService {
  constructor(private prisma: any, private audit: any, private ports: PortEtl) {}

  // R480/R487 — contrat d'import versionné par date d'effet (R29), mapping DÉCLARATIF
  // (AST restreint, rejeté au chargement) ; publication append-only (etl.contrat.publie).
  async publierContrat(_ctx: Ctx, _c: { connecteur: string; famille: FamilleImport;
    mapping: unknown; enVigueurLe?: string; mode?: "TOUT_OU_RIEN" | "PARTIEL" }): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }
  async contratEnVigueur(_ctx: Ctx, _connecteur: string, _famille: FamilleImport, _at?: string): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R486 — réception par le port ; sans secret : refus gracieux typé, jamais une stack brute.
  async recevoirLot(_ctx: Ctx, _l: { connecteur: string; famille: FamilleImport;
    recuLe?: string; lignes: LigneImport[] }): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R483 — validation typée contre le contrat en vigueur À LA DATE DE RÉCEPTION (R480/R29) ;
  // rejets ligne à ligne motivés, jamais silencieux.
  async validerLot(_ctx: Ctx, _lotId: string): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R484 — dry-run obligatoire (première version de contrat et toute montée de version).
  async dryRun(_ctx: Ctx, _lotId: string): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R481/R482/R489 — application idempotente par externalRef, EXCLUSIVEMENT par événements
  // etl.* (aucune écriture directe d'état, R49 intact) ; l'ETL ne pose AUCUN verdict.
  async appliquerLot(_ctx: Ctx, _lotId: string): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R485 — réconciliation chiffrée : source = appliqué + rejeté + no-op ; divergence = INCIDENT.
  async reconcilier(_ctx: Ctx, _lotId: string): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }

  // R488 — fraîcheur par connecteur × famille (modèle R409), seuil d'alerte tenant.
  async fraicheur(_ctx: Ctx): Promise<unknown> {
    throw new Error("[ROUGE] non implémenté (ET-01..08 — spec arbitrée, implémentation au lot suivant)");
  }
}
