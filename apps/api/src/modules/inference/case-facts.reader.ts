import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CaseFacts } from "./case-facts";

/**
 * P-L7-3 (AUDIT §6, les 5 résistances) — CaseFactsReader : le ledger est un SERVICE DE LECTURE,
 * pas une projection rejouée. Les faits viennent des TABLES D'ÉTAT sous RLS (kycFile, client,
 * personne_liens + persons.statutPep, documents, kyc_visas, screening_hits) — le journal ne
 * serait consulté que là où la donnée n'existe QU'EN ÉVÉNEMENT : pour les faits couverts ici,
 * il n'y en a AUCUN aujourd'hui (statutPep, statuts de hits et visas sont des états ; constat
 * consigné, pas une omission). ZÉRO écriture. Le service est sans état — la LECTURE (facts +
 * sources) est un objet PAR REQUÊTE (leçon C8), consommé par un RequirementLedger éphémère.
 * Choix documenté : `sanctioned` = flag R31 « SANCTIONNE » de la personne (les flags sont la
 * surface exposée aux scénarios) — jamais déduit d'un hit non qualifié (R44 : l'humain qualifie).
 */

export type SourcesDossier = {
  kyc: any; client: any;
  documents: any[];                    // rows Document (ACTIF ou non, expirés ou non — le ledger tranche)
  visas: any[];                        // rows KycVisa
  hits: any[];                         // rows ScreeningHit du client
  personnes: { personne: any; role: string }[];   // liées au dossier (personne_liens, cible KYC)
};

export type LectureDossier = { facts: CaseFacts; sources: SourcesDossier };

@Injectable()
export class CaseFactsReader {
  constructor(private prisma: PrismaService) {}

  async lire(ctx: { tenantId: string }, kycFileId: string, now: Date = new Date()): Promise<LectureDossier> {
    const kyc = await this.prisma.kycFile.findFirst({ where: { tenantId: ctx.tenantId, id: kycFileId } });
    if (!kyc) throw new NotFoundException("P-L7-3 : dossier introuvable");
    const client = await this.prisma.client.findFirst({ where: { tenantId: ctx.tenantId, id: kyc.clientId } });
    const liens = await this.prisma.personneLien.findMany({
      where: { tenantId: ctx.tenantId, cibleType: "KYC", cibleId: kyc.id } });
    const persons = liens.length ? await this.prisma.person.findMany({
      where: { tenantId: ctx.tenantId, id: { in: liens.map((l: any) => l.personneId) } } }) : [];
    const parId = new Map(persons.map((p: any) => [p.id, p]));
    const personnes = liens.map((l: any) => ({ personne: parId.get(l.personneId), role: l.typeCode }))
      .filter((x: any) => x.personne);
    const documents = [
      ...(await this.prisma.document.findMany({ where: { tenantId: ctx.tenantId, kycFileId: kyc.id } })),
      ...(kyc.clientId ? await this.prisma.document.findMany({
        where: { tenantId: ctx.tenantId, clientId: kyc.clientId } }) : []),
    ].filter((d: any, i: number, tous: any[]) => tous.findIndex((x) => x.id === d.id) === i);
    const visas = await this.prisma.kycVisa.findMany({ where: { kycFileId: kyc.id } });
    const hits = await this.prisma.screeningHit.findMany({
      where: { tenantId: ctx.tenantId, clientId: kyc.clientId } });

    const facts: CaseFacts = {
      entityType: client?.structure ?? "INCONNU",
      jurisdiction: client?.country ?? kyc.countryCode,
      riskLevel: kyc.riskLevel ?? client?.riskLevel ?? "MEDIUM",
      relatedPersons: personnes.map((x: any) => ({ role: x.role,
        pep: !!x.personne.statutPep,
        sanctioned: Array.isArray(x.personne.flags) && x.personne.flags.includes("SANCTIONNE") })),
      // Faits « documents » : les pièces UTILISABLES (ACTIF, non expirées) — le ledger, lui,
      // distingue « absent » d'« expiré » pour l'explication.
      documents: documents.filter((d: any) => d.statut === "ACTIF" &&
        (!d.expireAt || new Date(d.expireAt).getTime() > now.getTime())).map((d: any) => d.nom),
      checks: hits.length > 0 && hits.every((h: any) => h.statut === "QUALIFIE") ? ["SCREENING_QUALIFIE"]
        : hits.length === 0 ? ["SCREENING_QUALIFIE"] : [],   // 0 hit = rien à qualifier (vacuité, documentée)
    };
    return { facts, sources: { kyc, client, documents, visas, hits, personnes } };
  }
}
