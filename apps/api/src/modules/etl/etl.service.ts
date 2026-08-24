// ETL & intégration core banking — R480→R489 (spec/ETL-CORE-BANKING-R480-R489-PROPOSITION.md,
// ARBITRÉE PO 10.08.2026 : Q1 générique CSV/SFTP · Q2 clients+comptes+transactions · Q3 EOD ·
// Q4 tout-ou-rien par défaut · Q5 numérotation ratifiée). Implémentation VERTE d'ET-01..08 —
// tests inchangés depuis la phase rouge.
// Doctrine : réception par PORT (R284/R286, pas de secret = refus gracieux R486) → validation
// contre le CONTRAT en vigueur à la date de réception (R480/R29) → staging → application
// idempotente par externalRef (R481) EXCLUSIVEMENT par emitEvent (R482, R49 intact) ;
// réconciliation chiffrée (R485) ; l'ETL ne pose AUCUN verdict (R489/R44).
import { emitEvent } from "../../common/domain-event";

type Ctx = { tenantId: string; userId: string; role: string };

export type LigneImport = { externalRef: string; data: Record<string, unknown> };
export type FamilleImport = "CLIENTS" | "COMPTES" | "TRANSACTIONS";           // périmètre v1 (Q2)

// Le port fournit l'accès au connecteur (R284/R286) : pas de secret = refus gracieux (R486).
export type PortEtl = { secretPresent(connecteur: string): boolean };

// R487 — mapping DÉCLARATIF : cible → champ source (identifiants simples), requis ⊆ cibles.
// Aucune expression, aucun code : tout littéral hors de cette forme est rejeté au chargement.
const IDENT = /^[A-Za-z_][A-Za-z0-9_.]*$/;
type Mapping = { champs: Record<string, string>; requis: string[] };
function validerMapping(m: unknown): Mapping {
  const mm = m as Mapping;
  if (!mm || typeof mm !== "object" || !mm.champs || !Array.isArray(mm.requis))
    throw new Error("[R487] mapping invalide — forme attendue { champs: {cible: source}, requis: [cibles] }");
  for (const [cible, source] of Object.entries(mm.champs))
    if (!IDENT.test(cible) || typeof source !== "string" || !IDENT.test(source))
      throw new Error(`[R487] mapping déclaratif uniquement — « ${cible} » : identifiants simples, aucune expression`);
  for (const r of mm.requis)
    if (!(r in mm.champs) && !Object.values(mm.champs).includes(r))
      throw new Error(`[R487] requis « ${r} » absent des champs mappés (ni cible, ni source)`);
  return mm;
}

// Un requis se déclare par sa CIBLE ou par son champ SOURCE — dans les deux cas la
// vérification porte sur le champ source de la ligne.
function sourceDe(m: Mapping, requis: string): string {
  return requis in m.champs ? m.champs[requis] : requis;
}

export class EtlService {
  constructor(private prisma: any, private audit: any, private ports: PortEtl) {}

  private emit(client: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(client, tenantId, type, aggregateId, payload);
  }

  // R480/R487 — contrat versionné par date d'effet (R29) ; publication append-only.
  async publierContrat(ctx: Ctx, c: { connecteur: string; famille: FamilleImport;
    mapping: unknown; enVigueurLe?: string; mode?: "TOUT_OU_RIEN" | "PARTIEL" }) {
    const mapping = validerMapping(c.mapping);
    const anciens = await this.prisma.etlContrat.findMany({
      where: { tenantId: ctx.tenantId, connecteur: c.connecteur, famille: c.famille } });
    const version = anciens.length + 1;
    const contrat = await this.prisma.etlContrat.create({ data: {
      tenantId: ctx.tenantId, connecteur: c.connecteur, famille: c.famille, version,
      mapping, mode: c.mode ?? "TOUT_OU_RIEN",                     // Q4 : tout-ou-rien par défaut
      enVigueurLe: c.enVigueurLe ?? new Date().toISOString(), dryRunFait: false } });
    await this.emit(this.prisma, ctx.tenantId, "etl.contrat.publie", contrat.id,
      { connecteur: c.connecteur, famille: c.famille, version, mode: contrat.mode, par: ctx.userId });
    return contrat;
  }

  // R480/R29 — la version en vigueur À LA DATE demandée, jamais la « courante » implicite.
  async contratEnVigueur(ctx: Ctx, connecteur: string, famille: FamilleImport, at?: string) {
    const date = at ?? new Date().toISOString();
    const tous = await this.prisma.etlContrat.findMany({
      where: { tenantId: ctx.tenantId, connecteur, famille, enVigueurLe: { lte: date } } });
    if (!tous.length) throw new Error(`[R480] aucun contrat en vigueur au ${date} pour ${connecteur}/${famille}`);
    return tous.slice().sort((a: any, b: any) => b.version - a.version)[0];
  }

  // R486 — réception par le port ; sans secret : refus GRACIEUX typé, rien n'est reçu.
  async recevoirLot(ctx: Ctx, l: { connecteur: string; famille: FamilleImport;
    recuLe?: string; lignes: LigneImport[] }) {
    if (!this.ports.secretPresent(l.connecteur))
      throw new Error(`[R486] pas de secret configuré pour « ${l.connecteur} » — refus gracieux : `
        + "configurez le port (R284/R286) ; rien n'a été reçu ni consigné côté données");
    const recuLe = l.recuLe ?? new Date().toISOString();
    const contrat = await this.contratEnVigueur(ctx, l.connecteur, l.famille, recuLe);
    const lot = await this.prisma.etlLot.create({ data: {
      tenantId: ctx.tenantId, connecteur: l.connecteur, famille: l.famille, recuLe,
      contratId: contrat.id, contratVersion: contrat.version, statut: "RECU",
      nbSource: l.lignes.length, nbValides: 0, nbRejets: 0, nbAppliques: 0, nbNoop: 0 } });
    for (const ligne of l.lignes)
      await this.prisma.etlLigne.create({ data: { tenantId: ctx.tenantId, lotId: lot.id,
        famille: l.famille, externalRef: ligne.externalRef, data: ligne.data, statut: "STAGED" } });
    await this.emit(this.prisma, ctx.tenantId, "etl.lot.recu", lot.id,
      { connecteur: l.connecteur, famille: l.famille, version: contrat.version,
        nb: l.lignes.length, par: ctx.userId });
    return lot;
  }

  // R483 — validation typée contre le contrat DU LOT ; rejets motivés ligne à ligne.
  async validerLot(ctx: Ctx, lotId: string) {
    const lot = await this.prisma.etlLot.findFirst({ where: { tenantId: ctx.tenantId, id: lotId } });
    if (!lot) throw new Error("[R483] lot inconnu");
    const contrat = await this.prisma.etlContrat.findFirst({ where: { tenantId: ctx.tenantId, id: lot.contratId } });
    const mapping: Mapping = contrat.mapping;
    const lignes = await this.prisma.etlLigne.findMany({ where: { tenantId: ctx.tenantId, lotId } });
    const rejets: { externalRef: string; motif: string }[] = [];
    let valides = 0;
    for (const ligne of lignes) {
      const manquants = mapping.requis.filter((r) => (ligne.data as any)?.[sourceDe(mapping, r)] == null);
      if (manquants.length) {
        const motif = manquants.map((r) => `champ requis « ${r} » manquant (source ${sourceDe(mapping, r)})`).join(" ; ");
        rejets.push({ externalRef: ligne.externalRef, motif });
        await this.prisma.etlLigne.update({ where: { id: ligne.id }, data: { statut: "REJETEE", motif } });
        await this.emit(this.prisma, ctx.tenantId, "etl.ligne.rejetee", ligne.id,
          { externalRef: ligne.externalRef, motif });
      } else {
        valides++;
        await this.prisma.etlLigne.update({ where: { id: ligne.id }, data: { statut: "VALIDE" } });
      }
    }
    await this.prisma.etlLot.update({ where: { id: lot.id },
      data: { statut: "VALIDE", nbValides: valides, nbRejets: rejets.length } });
    await this.emit(this.prisma, ctx.tenantId, "etl.lot.valide", lot.id,
      { valides, rejets: rejets.length });
    return { valides, rejets };
  }

  // R484 — dry-run : simulation montrée, et la VERSION de contrat est marquée simulée.
  async dryRun(ctx: Ctx, lotId: string) {
    const lot = await this.prisma.etlLot.findFirst({ where: { tenantId: ctx.tenantId, id: lotId } });
    if (!lot) throw new Error("[R484] lot inconnu");
    const lignes = await this.prisma.etlLigne.findMany({ where: { tenantId: ctx.tenantId, lotId, statut: "VALIDE" } });
    let creations = 0, noop = 0;
    for (const ligne of lignes) {
      if (await this.dejaAppliquee(ctx, lot.famille, ligne.externalRef)) noop++;
      else creations++;
    }
    const rejets = lot.nbRejets ?? 0;
    await this.prisma.etlContrat.update({ where: { id: lot.contratId }, data: { dryRunFait: true } });
    return { creations, majs: 0, noop, rejets };
  }

  private async dejaAppliquee(ctx: Ctx, famille: string, externalRef: string) {
    return !!(await this.prisma.etlLigne.findFirst({
      where: { tenantId: ctx.tenantId, famille, externalRef, statut: "APPLIQUEE" } }));
  }

  // R481/R482/R489 — application idempotente, par événements uniquement, sans verdict.
  async appliquerLot(ctx: Ctx, lotId: string) {
    const lot = await this.prisma.etlLot.findFirst({ where: { tenantId: ctx.tenantId, id: lotId } });
    if (!lot) throw new Error("[R481] lot inconnu");
    if ((lot.nbRejets ?? 0) > 0) {
      const contratR = await this.prisma.etlContrat.findFirst({ where: { tenantId: ctx.tenantId, id: lot.contratId } });
      if ((contratR?.mode ?? "TOUT_OU_RIEN") === "TOUT_OU_RIEN")
        throw new Error(`[R483] lot avec ${lot.nbRejets} rejet(s) — mode tout-ou-rien (Q4) : rien n'est appliqué ; `
          + "corrigez la source ou passez le contrat en mode PARTIEL (paramètre tenant gouverné)");
    }
    const contrat = await this.prisma.etlContrat.findFirst({ where: { tenantId: ctx.tenantId, id: lot.contratId } });
    if (!contrat?.dryRunFait)
      throw new Error(`[R484] contrat v${lot.contratVersion} jamais simulé — dry-run obligatoire avant application`);
    return this.prisma.$transaction(async (tx: any) => {
      const lignes = await tx.etlLigne.findMany({ where: { tenantId: ctx.tenantId, lotId, statut: "VALIDE" } });
      let appliques = 0, noop = 0;
      for (const ligne of lignes) {
        if (await this.dejaAppliquee(ctx, lot.famille, ligne.externalRef)) {
          noop++;
          await tx.etlLigne.update({ where: { id: ligne.id }, data: { statut: "NOOP" } });
        } else {
          appliques++;
          await tx.etlLigne.update({ where: { id: ligne.id }, data: { statut: "APPLIQUEE" } });
        }
      }
      await tx.etlLot.update({ where: { id: lot.id },
        data: { statut: "APPLIQUE", nbAppliques: appliques, nbNoop: noop } });
      await this.emit(tx, ctx.tenantId, "etl.lot.applique", lot.id,
        { connecteur: lot.connecteur, famille: lot.famille, appliques, noop,
          rejetes: lot.nbRejets ?? 0, par: ctx.userId });                  // aucun verdict (R489)
      return { appliques, noop, rejetes: lot.nbRejets ?? 0 };
    });
  }

  // R485 — source = appliqué + rejeté + no-op ; divergence = INCIDENT consigné.
  async reconcilier(ctx: Ctx, lotId: string) {
    const lot = await this.prisma.etlLot.findFirst({ where: { tenantId: ctx.tenantId, id: lotId } });
    if (!lot) throw new Error("[R485] lot inconnu");
    const source = lot.nbSource ?? 0;
    const appliques = lot.nbAppliques ?? 0, rejetes = lot.nbRejets ?? 0, noop = lot.nbNoop ?? 0;
    const ok = source === appliques + rejetes + noop;
    await this.emit(this.prisma, ctx.tenantId, "etl.lot.reconcilie", lot.id,
      { source, appliques, rejetes, noop, ok });
    await this.prisma.etlLot.update({ where: { id: lot.id },
      data: { statut: ok ? "RECONCILIE" : "INCIDENT" } });                 // jamais de correction silencieuse
    return { source, appliques, rejetes, noop, ok };
  }

  // R488 — fraîcheur par connecteur × famille (modèle R409 : l'âge s'affiche, ne se devine pas).
  async fraicheur(ctx: Ctx) {
    const lots = await this.prisma.etlLot.findMany({ where: { tenantId: ctx.tenantId } });
    const parCle = new Map<string, any>();
    for (const lot of lots) {
      const cle = `${lot.connecteur}/${lot.famille}`;
      const connu = parCle.get(cle);
      if (!connu || new Date(lot.recuLe) > new Date(connu.recuLe)) parCle.set(cle, lot);
    }
    return [...parCle.entries()].map(([cle, lot]) => ({
      cle, connecteur: lot.connecteur, famille: lot.famille, dernierLot: lot.id,
      recuLe: lot.recuLe, statut: lot.statut }));
  }
}
