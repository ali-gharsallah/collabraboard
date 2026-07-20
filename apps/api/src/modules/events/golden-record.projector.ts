import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * R104 — Propagation contrôlée au golden record (GR-01..04).
 * Consomme `kyc.validated` (outbox) et applique le mapping explicite KYC → fiche client.
 *
 * Invariants tenus :
 * - jamais d'effet de bord à la validation : seule la consommation de l'événement écrit (GR-01) ;
 * - un KYC non VALIDATED ne propage rien (GR-02) ;
 * - idempotent par construction : pas de diff → pas d'écriture, pas d'audit (GR-03, R48/R49) ;
 * - liste fermée de champs — aucune synchro silencieuse hors mapping (GR-04) ;
 * - scope tenant sur chaque lecture/écriture ;
 * - ne lève jamais pour un événement inapplicable : rend { applied:false } et laisse le drain vivre.
 */

// GR-04 / R-Q : la composition du mapping est un paramètre tenant candidat.
// Socle MVP : le niveau de risque calculé par le KYC devient celui de la fiche.
export const GOLDEN_RECORD_MAPPING: ReadonlyArray<{ from: string; to: string }> = [
  { from: "riskLevel", to: "riskLevel" },
];

export interface OutboxEventRow {
  tenant_id: string; type: string; aggregate_id: string; payload: unknown;
}

@Injectable()
export class GoldenRecordProjector {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** `db` permet au worker de passer sa transaction (application + published_at atomiques). */
  async handle(ev: OutboxEventRow, db: any = this.prisma):
    Promise<{ applied: boolean; reason?: string; fields?: string[] }> {
    if (ev.type !== "kyc.validated") return { applied: false, reason: "type" };

    const kyc = await db.kycFile.findFirst({ where: { id: ev.aggregate_id, tenantId: ev.tenant_id } });
    if (!kyc) return { applied: false, reason: "kyc-introuvable" };
    if (kyc.status !== "VALIDATED") return { applied: false, reason: "non-valide" };      // GR-02

    const client = await db.client.findFirst({ where: { id: kyc.clientId, tenantId: ev.tenant_id } });
    if (!client) return { applied: false, reason: "client-introuvable" };

    const data: Record<string, unknown> = {};
    for (const m of GOLDEN_RECORD_MAPPING) {                                             // GR-04
      const v = (kyc as any)[m.from];
      if (v != null && (client as any)[m.to] !== v) data[m.to] = v;
    }
    const fields = Object.keys(data);
    if (fields.length === 0) return { applied: false, reason: "aucun-diff" };            // GR-03

    await db.client.update({ where: { id: client.id }, data });                          // GR-01
    await this.audit.log(ev.tenant_id, kyc.validatedBy ?? "system",
      "CLIENT_UPDATED_FROM_KYC", `${kyc.code}:${fields.join(",")}`);
    return { applied: true, fields };
  }
}
