import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Le core banking est un port — R167→R169 (SY-01..05). Écrit APRÈS l'amendement, APRÈS les
 * tests. Le sine qua non suisse : Avaloq, Temenos, Finnova, ERI deviennent des
 * implémentations d'UN contrat que nous définissons (pattern coffre R144 / IA R163).
 * R167 : port DÉCLARÉ (système, version, périmètre) — pas de port = refus (R114) ; hors
 * périmètre = refus explicite tracé, jamais un silence.
 * R168 : chaque import est un LOT signé (source, nb, empreinte — rejouable, pattern R161) ;
 * les données importées sont des dérivés, la vérité reste le core ; PHASE 1 LECTURE SEULE —
 * ni le port ni le service n'ont de voie d'écriture, par construction.
 * R169 : le mapping compteCore↔client est un paramètre tenant VERSIONNÉ à date de mise en
 * vigueur (pattern R29) ; l'inconnu va en QUARANTAINE (tracé + tâche — R39 : rien n'est
 * bloqué) ; la résolution est un acte humain (jeton) qui enrichit le mapping, daté.
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type CoreBankingPort = { systeme: string; version: string; perimetre: string[];
  lire(type: string, depuis?: string): Promise<any[]> };
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

@Injectable()
export class CoreSyncService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { core?: CoreBankingPort } = {}) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── R167/R168/R169 : importer un lot ──
  async importerLot(ctx: Ctx, type: string) {
    return this.prisma.$transaction(async (tx: any) => {
      if (!this.ports.core)
        throw new BadRequestException("R167 : aucun connecteur core banking configuré — pas de données simulées");
      const port = this.ports.core;
      if (!port.perimetre.includes(type)) {
        await this.emit(tx, ctx.tenantId, "core.acces.refuse", type,
          { motif: "périmètre", demande: type, declare: port.perimetre, par: ctx.userId });
        throw new BadRequestException(
          `R167 : « ${type} » hors périmètre déclaré du port (${port.perimetre.join(", ")}) — refus, pas un silence`);
      }
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      if (!t) throw new NotFoundException("Tenant introuvable");
      const mapping: any[] = ((t.settings as any) ?? {}).coreMapping ?? [];
      const now = new Date().toISOString();
      const actifs = mapping.filter((m) => m.depuisLe <= now);   // R169/R29 — la date fait foi
      const lignes = await port.lire(type);
      const source = `${port.systeme} ${port.version}`;
      const lot = await tx.coreSyncLot.create({ data: { tenantId: ctx.tenantId, source, type,
        nbLignes: lignes.length, shaLot: sha256(JSON.stringify(lignes)), at: now, par: ctx.userId } });
      let rattaches = 0, enQuarantaine = 0;
      for (const ligne of lignes) {
        const m = actifs.find((x) => x.compteCore === ligne.compteCore);
        if (m) { rattaches++; continue; }                        // le dérivé est rattaché — la vérité reste le core
        enQuarantaine++;
        const q = await tx.coreQuarantaine.create({ data: { tenantId: ctx.tenantId, lotId: lot.id,
          ligne, motif: "correspondance inconnue — jamais de rattachement deviné (R169)",
          statut: "EN_ATTENTE", resoluPar: null, resoluAt: null } });
        await this.emit(tx, ctx.tenantId, "core.sync.quarantaine", q.id,
          { compteCore: ligne.compteCore ?? null, lotId: lot.id });
        await this.emit(tx, ctx.tenantId, "tache.core.resolution", q.id, { compteCore: ligne.compteCore ?? null });
      }
      await this.emit(tx, ctx.tenantId, "core.sync.lot", lot.id,
        { source, type, nbLignes: lignes.length, shaLot: lot.shaLot, rattaches, enQuarantaine });
      await this.audit.log(ctx.tenantId, ctx.userId, "CORE_SYNC", `${type}:${lignes.length}`);
      return { lotId: lot.id, rattaches, enQuarantaine };
    });
  }

  // ── R169 : résoudre — l'acte humain qui enrichit le mapping ──
  async resoudreQuarantaine(ctx: Ctx, quarantaineId: string, clientId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      if (!clientId || !clientId.trim())
        throw new BadRequestException("R169 : la résolution nomme le clientId — jamais de devinette");
      const q = await tx.coreQuarantaine.findFirst({ where: { id: quarantaineId, tenantId: ctx.tenantId } });
      if (!q) throw new NotFoundException("Quarantaine introuvable");
      if (q.statut !== "EN_ATTENTE") throw new BadRequestException("Ligne déjà résolue — la résolution ne se rejoue pas");
      const at = new Date().toISOString();
      await tx.coreQuarantaine.update({ where: { id: q.id },
        data: { statut: "RESOLUE", resoluPar: ctx.userId, resoluAt: at } });
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const settings = (t.settings as any) ?? {};
      settings.coreMapping = [...(settings.coreMapping ?? []),
        { compteCore: q.ligne.compteCore, clientId: clientId.trim(), depuisLe: at }];   // daté (R29)
      await tx.tenant.update({ where: { id: t.id }, data: { settings } });
      await this.emit(tx, ctx.tenantId, "core.sync.resolution", q.id,
        { compteCore: q.ligne.compteCore ?? null, clientId: clientId.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "CORE_RESOLVE", `${q.id}:${clientId.trim()}`);
    });
  }

  async etatSync(ctx: Ctx) {
    const lots = await this.prisma.coreSyncLot.findMany({ where: { tenantId: ctx.tenantId } });
    const attente = await this.prisma.coreQuarantaine.findMany({ where: { tenantId: ctx.tenantId, statut: "EN_ATTENTE" } });
    return { lots: lots.length, enQuarantaine: attente.length };
  }
}
