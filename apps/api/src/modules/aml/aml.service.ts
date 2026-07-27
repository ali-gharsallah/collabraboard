import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { ContexteAml, SignalAml, evaluer, paramsDepuisSettings, REFERENTIEL_AML } from "./aml-scoring.engine";
import { REGISTRE_RQ } from "../parametres/parametres.service";
import { Tx } from "../../common/tx";

/**
 * AmlService — câblage de la surveillance AML (R189→R206, A-69..A-86). Écrit depuis le
 * Gherkin (Bloc 48, exception ratifiée). Le service ORCHESTRE, il ne détecte pas :
 * il charge les seuils tenant (registre R-Q, `paramsDepuisSettings`), passe le contexte au
 * moteur pur, PERSISTE chaque signal (append-only, tenant-scopé, RLS) et rend l'état de
 * blocage. L'auteur du signal est TOUJOURS le jeton (ctx.userId), jamais le corps de requête.
 * Un signal bloquant (R192/R197/R203) suspend l'opération — la levée reste un acte humain
 * hors de ce bloc (aucune auto-clôture, R39).
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class AmlService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }

  // ── Évaluation : moteur → signaux persistés → état de blocage ──
  async evaluer(ctx: Ctx, dto: ContexteAml & { clientId: string }) {
    if (!dto || !dto.clientId) throw new NotFoundException("clientId requis");
    return this.prisma.$transaction(async (tx: Tx) => {
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      if (!t) throw new NotFoundException("Tenant introuvable");
      const params = paramsDepuisSettings(t.settings);
      const signaux = evaluer({ ...dto }, params);
      const persistes: any[] = [];
      for (const s of signaux) {
        const row = await tx.amlSignal.create({ data: {
          tenantId: ctx.tenantId, clientId: dto.clientId,
          type: s.type, regle: s.regle, niveau: s.niveau, note: s.note, motif: s.motif,
          bloquant: s.bloquant, emisPar: ctx.userId, at: new Date().toISOString() } });
        await this.emit(tx, ctx.tenantId, "aml.signal.leve", row.id,
          { clientId: dto.clientId, type: s.type, regle: s.regle, niveau: s.niveau, bloquant: s.bloquant });
        persistes.push(row);
      }
      const bloque = signaux.some((s) => s.bloquant);
      if (bloque) await this.emit(tx, ctx.tenantId, "aml.operation.bloquee", dto.clientId,
        { regles: signaux.filter((s) => s.bloquant).map((s) => s.regle) });
      await this.audit.log(ctx.tenantId, ctx.userId, "AML_EVALUATED", `${dto.clientId}:${signaux.length}`);
      return { clientId: dto.clientId, bloque, signaux: persistes };
    });
  }

  // ── Lecture des signaux d'un client (tenant-scopé, ordre chronologique) ──
  async signaux(ctx: Ctx, clientId: string) {
    const rows = await this.prisma.amlSignal.findMany({ where: { tenantId: ctx.tenantId, clientId } });
    return rows.slice().sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }

  // ── Vague 8 : le RÉFÉRENTIEL — les 18 scénarios R189→R206 + les seuils EFFECTIFS du tenant ──
  // Projection lisible du canon (aucune règle nouvelle) ; les seuils sont pilotés par le registre R-Q.
  async referentiel(ctx: Ctx) {
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");
    return { scenarios: REFERENTIEL_AML, seuils: paramsDepuisSettings(t.settings) };
  }

  // ── Vague 9 : le BAC À SABLE AML — dry-run d'un seuil (R94, scénario B-02) ──
  // « Voir avant d'écrire » : on rejoue le moteur PUR sur des contextes réels, avec les seuils
  // ACTUELS puis les seuils SIMULÉS, et l'on rend l'impact NOMINATIF (alertes avant/après,
  // nouvelles/disparues, chaque nouvelle NOMMÉE : client, fait, seuil franchi). AUCUNE écriture :
  // ni signal, ni tâche, ni case (R70/R94) — la lecture seule prouve le dry-run. L'application
  // reste un acte GOUVERNÉ au registre R-Q (POST /v1/parametres/valeur, motivé/daté R126/R29) :
  // proposer n'est pas appliquer.
  async sandbox(
    ctx: Ctx,
    dto: { override?: { cle?: string; valeur?: any }; contextes?: Array<ContexteAml & { clientId: string }> },
  ) {
    const cle = dto?.override?.cle;
    if (!cle) throw new BadRequestException("override.cle requis");
    const entree = REGISTRE_RQ.find((e) => e.cle === cle);
    if (!entree || !cle.startsWith("aml"))
      throw new BadRequestException(`R125 : «${cle}» n'est pas un paramètre AML gouverné du registre`);
    const contextes = dto.contextes ?? [];
    const t = await this.prisma.tenant.findFirst({ where: { id: ctx.tenantId } });
    if (!t) throw new NotFoundException("Tenant introuvable");

    const actuels = paramsDepuisSettings(t.settings);                                   // seuils en vigueur
    const simules = paramsDepuisSettings({ ...(t.settings as any), [cle]: dto.override!.valeur }); // seuils simulés
    const nomme = (clientId: string, s: SignalAml) =>
      ({ clientId, regle: s.regle, type: s.type, niveau: s.niveau, note: s.note, motif: s.motif, bloquant: s.bloquant });

    const parClient = contextes.map((c) => {
      const avant = evaluer(c, actuels);
      const apres = evaluer(c, simules);
      const clesAvant = new Set(avant.map((s) => s.regle));
      const clesApres = new Set(apres.map((s) => s.regle));
      return {
        clientId: c.clientId,
        avant: avant.map((s) => s.regle),
        apres: apres.map((s) => s.regle),
        nouvelles: apres.filter((s) => !clesAvant.has(s.regle)).map((s) => nomme(c.clientId, s)),
        disparues: avant.filter((s) => !clesApres.has(s.regle)).map((s) => nomme(c.clientId, s)),
      };
    });
    const nouvelles = parClient.flatMap((p) => p.nouvelles);
    const disparues = parClient.flatMap((p) => p.disparues);
    return {
      override: { cle, valeurActuelle: (t.settings as any)?.[cle] ?? entree.defaut, valeurSimulee: dto.override!.valeur },
      ecriture: false,                                                                  // R70/R94 — aucune écriture
      totaux: {
        avant: parClient.reduce((n, p) => n + p.avant.length, 0),
        apres: parClient.reduce((n, p) => n + p.apres.length, 0),
        nouvelles: nouvelles.length,
        disparues: disparues.length,
      },
      parClient, nouvelles, disparues,
    };
  }
}
