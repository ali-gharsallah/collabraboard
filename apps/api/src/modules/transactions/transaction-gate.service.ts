import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { PortGelMros } from "../surveillance/ports";
import { Tx as PrismaTx } from "../../common/tx";

/**
 * Portail transactionnel — R140→R143 (TX-01..06). Écrit APRÈS l'amendement, APRÈS les tests.
 * FATF 7e Update : prévenir, pas constater. FINMA 02/2026 : le KYC nourrit la transaction,
 * seuils PAR PROFIL — jamais fixes.
 * R140 : toute transaction passe par LE portail avant exécution ; verdict PASSE|BLOQUE|SUSPEND,
 * tracé garde par garde, append-only (R48/R49 — le verdict se rejoue).
 * R141 : les gardes sont un REGISTRE ; sévérité paramétrable tenant (txGardes) ; le pire
 * l'emporte ; garde en ERREUR → SUSPEND (fail-secure : jamais vers le passage).
 * R142 : la garde comportement confronte le profil onboardé au constaté — vélocité et montant
 * relatifs au PROFIL (golden record), motifs crypto ; déclenchement → SUSPEND + signal AML +
 * tâche de requalification (R44 : l'humain reclasse).
 * R143 : la file de revue est habilitée (txRevueRoles, refus tracés — R112), la décision
 * motivée (R7) LIBERER|BLOQUER, le SLA alerte une fois (R39), la vue client ne porte JAMAIS
 * de motif AML (cohérence art. 10a / R132).
 * Paramètres R-Q (au registre — R125) : txGardes {} · txRevueRoles ["CO","MLRO"] ·
 * txRevueSlaHeures 24 · txComportement { fenetreHeures: 48, maxTxFenetre: 3,
 * multiplicateurVolumetrie: 3, typesSensibles: ["CONVERSION_CRYPTO"] }.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type Tx = { clientId: string; txRef: string; type: string; montantChf: number; devise?: string };
type GardeResultat = "OK" | "INFORMATIF" | "SUSPENSIF" | "BLOQUANT" | "ERREUR";
export type Garde = { code: string; regle: string;
  run(ctx: Ctx, tx: Tx, deps: { prisma: any; emit: any }): Promise<{ resultat: GardeResultat; detail: string }> };

const RANG: Record<string, number> = { OK: 0, INFORMATIF: 1, SUSPENSIF: 2, ERREUR: 2, BLOQUANT: 3 };
const COMPORTEMENT_DEFAUT = { fenetreHeures: 48, maxTxFenetre: 3, multiplicateurVolumetrie: 3,
  typesSensibles: ["CONVERSION_CRYPTO"] };

// ── Garde livrée : gel art. 10 — R131 a enfin son appelant. P-L3-2 : dépend du PORT du contexte
//    Surveillance (PortGelMros), jamais du service concret (frontière ADR-TM-001). ──
export function gardeGelMros(mros: PortGelMros): Garde {
  return { code: "gel-mros", regle: "R131",
    async run(ctx, tx) {
      const v: any = await mros.verifierTransaction(ctx, tx.clientId);
      return v.bloquant
        ? { resultat: "BLOQUANT", detail: v.motif }
        : { resultat: "OK", detail: "aucun gel actif" };
    } };
}

// ── Garde livrée : écart de comportement (R142) — le KYC nourrit la transaction ──
export function gardeComportement(): Garde {
  return { code: "comportement", regle: "R142",
    async run(ctx, tx, { prisma, emit }) {
      const t = await prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
      const cfg = { ...COMPORTEMENT_DEFAUT, ...((t?.settings as any)?.txComportement ?? {}) };
      const client = await prisma.client.findFirst({ where: { id: tx.clientId, tenantId: ctx.tenantId } });
      const volumetrie = client?.volumetrieMensuelleChf ?? 50000;
      const raisons: string[] = [];
      if (tx.montantChf > volumetrie * cfg.multiplicateurVolumetrie)
        raisons.push(`montant ${tx.montantChf} CHF > ${cfg.multiplicateurVolumetrie}× la volumétrie du PROFIL (${volumetrie})`);
      if (cfg.typesSensibles.includes(tx.type)) {
        const depuis = new Date(Date.now() - cfg.fenetreHeures * 3600000).toISOString();
        const recents = await prisma.txVerdict.findMany({ where: { tenantId: ctx.tenantId,
          clientId: tx.clientId, type: tx.type, at: { gte: depuis } } });
        if (recents.length >= cfg.maxTxFenetre)
          raisons.push(`vélocité : ${recents.length + 1} ${tx.type} / ${cfg.fenetreHeures} h (max profil ${cfg.maxTxFenetre}) — profil ${client?.riskLevel ?? "?"}`);
      }
      if (raisons.length === 0) return { resultat: "OK", detail: "comportement conforme au profil" };
      await emit("signal.aml.comportement", tx.txRef, { clientId: tx.clientId, raisons });
      await emit("tache.kyc.requalification", tx.clientId, { origine: "portail-tx", raisons });
      return { resultat: "SUSPENSIF", detail: raisons.join(" · ") };
    } };
}

@Injectable()
export class TransactionGateService {
  constructor(private prisma: PrismaService, private audit: AuditService, private gardes: Garde[] = []) {}

  private emitter(tx: PrismaTx, tenantId: string) {
    return (type: string, aggregateId: string, payload: any) =>
      emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async cfg(tx: PrismaTx, tenantId: string) {
    const t = await tx.tenant.findFirst({ where: { id: tenantId } });
    const s = (t?.settings as any) ?? {};
    return { severites: s.txGardes ?? {}, revueRoles: s.txRevueRoles ?? ["CO", "MLRO"],
      slaHeures: s.txRevueSlaHeures ?? 24 };
  }

  // ── R140/R141 : LE point de passage — pire verdict, fail-secure, tracé garde par garde ──
  async evaluer(ctx: Ctx, dto: Tx) {
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const emit = this.emitter(tx, ctx.tenantId);
      const { severites } = await this.cfg(tx, ctx.tenantId);
      const traces: any[] = []; let pire: GardeResultat = "OK"; let motif = "";
      for (const g of this.gardes) {
        let res: { resultat: GardeResultat; detail: string };
        try { res = await g.run(ctx, dto, { prisma: tx, emit }); }
        catch (e) { res = { resultat: "ERREUR", detail: `garde en panne : ${(e as Error).message}` }; }
        // La sévérité TENANT reclasse (R-Q) — sauf l'ERREUR, qui suspend toujours (fail-secure).
        if (res.resultat !== "ERREUR" && res.resultat !== "OK" && severites[g.code])
          res = { ...res, resultat: severites[g.code] as GardeResultat };
        traces.push({ code: g.code, regle: g.regle, resultat: res.resultat, detail: res.detail });
        if (RANG[res.resultat] > RANG[pire]) { pire = res.resultat; motif = res.detail; }
      }
      const verdict = pire === "BLOQUANT" ? "BLOQUE"
        : (pire === "SUSPENSIF" || pire === "ERREUR") ? "SUSPEND" : "PASSE";
      const v = await tx.txVerdict.create({ data: { tenantId: ctx.tenantId, clientId: dto.clientId,
        txRef: dto.txRef, type: dto.type, montantChf: dto.montantChf, verdict, motif,
        gardes: traces, at: new Date().toISOString(), slaSignale: false,
        decidePar: null, revueMotif: null } });
      await this.emitter(tx, ctx.tenantId)(verdict === "SUSPEND" ? "tx.suspend" : "tx.verdict",
        v.id, { txRef: dto.txRef, verdict, gardes: traces.map((t2) => t2.code) });
      await this.audit.log(ctx.tenantId, ctx.userId, "TX_GATE", `${dto.txRef}:${verdict}`);
      return { verdictId: v.id, verdict, motif };
    });
  }

  // ── R143 : la file de revue — habilitée, motivée, sans fuite, jamais automatique ──
  private async habiliteRevue(tx: PrismaTx, ctx: Ctx, ref: string) {
    const { revueRoles } = await this.cfg(tx, ctx.tenantId);
    if (!revueRoles.includes(ctx.role)) {
      await this.emitter(tx, ctx.tenantId)("tx.revue.acces.refuse", ref, { par: ctx.userId, role: ctx.role });
      throw new ForbiddenException(`R143 : rôle ${ctx.role} non habilité sur la file de revue`);
    }
  }
  async listerRevue(ctx: Ctx) {
    await this.habiliteRevue(this.prisma, ctx, "file");
    return this.prisma.txVerdict.findMany({ where: { tenantId: ctx.tenantId, verdict: "SUSPEND" } });
  }
  async decider(ctx: Ctx, verdictId: string, decision: "LIBERER" | "BLOQUER", motif: string) {
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const v = await tx.txVerdict.findFirst({ where: { id: verdictId, tenantId: ctx.tenantId } });
      if (!v) throw new NotFoundException("Verdict introuvable");
      await this.habiliteRevue(tx, ctx, v.id);
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : la décision de revue exige un motif");
      if (v.verdict !== "SUSPEND") throw new BadRequestException("Seule une transaction SUSPENDue se décide");
      await tx.txVerdict.update({ where: { id: v.id },
        data: { verdict: decision === "LIBERER" ? "LIBEREE" : "BLOQUEE_REVUE",
          decidePar: ctx.userId, revueMotif: motif.trim() } });
      await this.emitter(tx, ctx.tenantId)("tx.revue.decision", v.id,
        { decision, motif: motif.trim(), par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "TX_REVIEW", `${v.id}:${decision}`);
    });
  }
  /** Vue CLIENT : jamais un motif AML — cohérence art. 10a (R132). */
  async vueClient(ctx: Ctx, verdictId: string) {
    const v = await this.prisma.txVerdict.findFirst({ where: { id: verdictId, tenantId: ctx.tenantId } });
    if (!v) throw new NotFoundException("Verdict introuvable");
    const statut = v.verdict === "PASSE" || v.verdict === "LIBEREE" ? "EXECUTEE"
      : v.verdict === "SUSPEND" ? "EN_TRAITEMENT" : "REFUSEE";
    return { txRef: v.txRef, statut };   // rien d'autre — pas de motif, pas de gardes
  }
  async tickRevue(ctx: Ctx, now: Date) {
    return this.prisma.$transaction(async (tx: PrismaTx) => {
      const { slaHeures } = await this.cfg(tx, ctx.tenantId);
      const attente = await tx.txVerdict.findMany({ where: { tenantId: ctx.tenantId,
        verdict: "SUSPEND", slaSignale: false,
        at: { lte: new Date(now.getTime() - slaHeures * 3600000).toISOString() } } });
      for (const v of attente) {
        await tx.txVerdict.update({ where: { id: v.id }, data: { slaSignale: true } });
        await this.emitter(tx, ctx.tenantId)("tx.revue.sla", v.id, { txRef: v.txRef, slaHeures });
        // La transaction RESTE suspendue : jamais de libération automatique (R39/R143).
      }
    });
  }
}
