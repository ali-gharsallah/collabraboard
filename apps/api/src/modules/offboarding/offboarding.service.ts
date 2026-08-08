import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { etatCloture } from "./cloture.util";
import { Tx } from "../../common/tx";

/**
 * Bloc OFFBOARDING — R267→R271 (OF-01..12), canon `spec/canon-vague-ecrans-pilote.md` partie 5
 * (ratifié 2026-07-27). Écrit APRÈS le canon, APRÈS les tests.
 * R267 : la fin de relation est une MACHINE À ÉTATS tracée — jamais un DELETE. CLOTUREE =
 * lecture seule intégrale pour `retentionPostClotureAns` (défaut 10 — LBA art. 7) ; AUCUNE
 * donnée supprimée ; la purge de fin de rétention est un processus distinct (R170), jamais ici.
 * L'annulation (OF-12) est tracée avec motif obligatoire (R7) — le dossier redevient ACTIVE,
 * la demande et son annulation restent au trail.
 * Paramètres R-Q : retentionPostClotureAns (10) · visasParTypeCloture · documentsParTypeCloture ·
 * rolesMotifSensible (CO_SR,MLRO,SO — R284) · exExitComplianceForceEdd (true).
 */

type Ctx = { tenantId: string; userId: string; role: string };
export type CoreBankingPort = { systeme: string; version: string; perimetre: string[];
  lire(type: string, depuis?: string): Promise<any[]> };

export const TYPES_CLOTURE = ["DEMANDE_CLIENT", "DECISION_BANQUE", "EXIT_COMPLIANCE",
  "DECES_SUCCESSION", "TRANSFERT_ETABLISSEMENT"] as const;
const TRANSITIONS: Record<string, string[]> = {
  CLOTURE_DEMANDEE: ["EN_CLOTURE", "CLOTURE_ANNULEE"],
  EN_CLOTURE: ["CLOTUREE", "CLOTURE_ANNULEE"],
  CLOTUREE: [], CLOTURE_ANNULEE: [],
};
const ACTIFS = ["CLOTURE_DEMANDEE", "EN_CLOTURE"];
export const MOTIF_GENERIQUE = "Décision de l'établissement";

@Injectable()
export class OffboardingService {
  constructor(private prisma: PrismaService, private audit: AuditService,
    private ports: { core?: CoreBankingPort } = {}) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return emitEvent(tx, tenantId, type, aggregateId, payload);
  }
  private async settings(db: any, tenantId: string) {
    const t = await db.tenant.findFirst({ where: { id: tenantId } });
    return ((t?.settings as any) ?? {});
  }
  private async dossier(db: any, ctx: Ctx, id: string) {
    const o = await db.offboardingFile.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!o) throw new NotFoundException("Clôture introuvable");
    return o;
  }

  // ── R267 : ouvrir une clôture — type + motif obligatoires, une seule clôture active ──
  async creer(ctx: Ctx, dto: { clientId: string; type: string; motif: string;
    motifSensible?: string; mrosRef?: string; documents?: { type: string; ref: string }[] }) {
    if (!TYPES_CLOTURE.includes(dto.type as any))
      throw new BadRequestException(`R268 : type de clôture inconnu — ${dto.type}`);
    if (!dto.motif || !dto.motif.trim())
      throw new BadRequestException("R7 : le motif de clôture est obligatoire");
    return this.prisma.$transaction(async (tx: Tx) => {
      const client = await tx.client.findFirst({ where: { id: dto.clientId, tenantId: ctx.tenantId } });
      if (!client) throw new NotFoundException("Client introuvable dans ce tenant");
      const active = await tx.offboardingFile.findFirst({
        where: { tenantId: ctx.tenantId, clientId: dto.clientId, statut: { in: ACTIFS } } });
      if (active) throw new ConflictException(`R267 : une clôture est déjà en cours (${active.id})`);
      const deja = await etatCloture(tx, ctx.tenantId, dto.clientId);
      if (deja.cloture) throw new ConflictException(
        "OFFBOARDING_LECTURE_SEULE : dossier clôturé — le retour passe par un nouvel onboarding (R271)");

      // R270 : pour EXIT_COMPLIANCE, la table principale ne porte JAMAIS le motif compliance —
      // le motif servi aux non-habilités est générique ; le détail vit dans la table cloisonnée.
      const exit = dto.type === "EXIT_COMPLIANCE";
      const s = await this.settings(tx, ctx.tenantId);
      const visasRequis: string[] = (s.visasParTypeCloture ?? {})[dto.type]
        ?? (exit ? ["CO_SR", "DIR"] : dto.type === "DECES_SUCCESSION" ? ["CO"] : ["CO"]);
      const o = await tx.offboardingFile.create({ data: {
        tenantId: ctx.tenantId, clientId: dto.clientId, type: dto.type,
        motif: exit ? MOTIF_GENERIQUE : dto.motif.trim(),
        initiateur: ctx.userId, documents: dto.documents ?? [],
        visas: visasRequis.map((role) => ({ role, statut: "PENDING", par: null, at: null })) } });
      if (exit) await tx.offboardingSensible.create({ data: {
        offboardingId: o.id, tenantId: ctx.tenantId,
        motifSensible: dto.motif.trim(), mrosRef: dto.mrosRef ?? null } });
      await this.emit(tx, ctx.tenantId, "offboarding.demande", o.id,
        { clientId: dto.clientId, type: dto.type, par: ctx.userId });   // payload SANS motif sensible (R270)
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_DEMANDE", o.id);
      return { id: o.id, statut: o.statut, visas: o.visas };
    });
  }

  async liste(ctx: Ctx, statut?: string) {
    const os = await this.prisma.offboardingFile.findMany({
      where: { tenantId: ctx.tenantId, ...(statut ? { statut } : {}) } });
    return os.slice().sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((o: any) => ({ id: o.id, clientId: o.clientId, type: o.type, statut: o.statut,
        createdAt: o.createdAt, clotureEffectiveAt: o.clotureEffectiveAt, retentionJusqua: o.retentionJusqua }));
  }

  // ── R268/R269 (complétés aux commits suivants) : le détail — checklist vivante ──
  async detail(ctx: Ctx, id: string) {
    const o = await this.dossier(this.prisma, ctx, id);
    const obstacles = ACTIFS.includes(o.statut) ? await this.obstaclesR269(this.prisma, ctx, o) : []; // checklist R269 en direct
    const base: any = { id: o.id, clientId: o.clientId, type: o.type, motif: o.motif, statut: o.statut, obstacles,
      initiateur: o.initiateur, documents: o.documents, visas: o.visas,
      attestationAvoirs: o.attestationAvoirs, motifAnnulation: o.motifAnnulation,
      clotureEffectiveAt: o.clotureEffectiveAt, retentionJusqua: o.retentionJusqua, createdAt: o.createdAt };
    // R270 (LBA art. 10a) : le motif détaillé + la réf MROS ne sont SERVIS qu'aux rôles habilités —
    // pour tout autre rôle, la clé est ABSENTE de la réponse réseau (OF-07), pas masquée à l'écran.
    if (o.type === "EXIT_COMPLIANCE") {
      const s = await this.settings(this.prisma, ctx.tenantId);
      const habilites: string[] = s.rolesMotifSensible ?? ["CO_SR", "MLRO", "SO"];
      if (habilites.includes(ctx.role)) {
        const sens = await this.prisma.offboardingSensible.findFirst({
          where: { offboardingId: o.id, tenantId: ctx.tenantId } });
        if (sens) { base.motifSensible = sens.motifSensible; base.mrosRef = sens.mrosRef; }
      }
    }
    return base;
  }

  // ── R270/OF-09 : le courrier client est PROPRE — jamais une mention compliance/MROS.
  //    Le gabarit ne lit QUE la table principale (le motif y est générique pour EXIT_COMPLIANCE
  //    par construction, dès la création) — le motif sensible ne PEUT pas fuir ici. ──
  async courrier(ctx: Ctx, id: string) {
    const o = await this.dossier(this.prisma, ctx, id);
    // R327/LN-05 (ratifié 2026-07-29) : le document GÉNÉRÉ suit la langue du DESTINATAIRE
    // (`corrLang` du client — jamais la locale de l'opérateur) ; le MOTIF est une DONNÉE :
    // il reste VERBATIM, quelle que soit la langue du gabarit.
    const client = await this.prisma.client.findFirst({ where: { id: o.clientId, tenantId: ctx.tenantId } });
    const langue = (["FR", "DE", "EN", "IT"].includes(client?.corrLang ?? "") ? client!.corrLang : "FR") as
      "FR" | "DE" | "EN" | "IT";
    const dateCloture = o.clotureEffectiveAt ? new Date(o.clotureEffectiveAt).toISOString().slice(0, 10) : null;
    const G: Record<string, string[]> = {
      FR: ["Objet : clôture de votre relation bancaire", "", "Madame, Monsieur,",
        `Nous vous informons de la clôture de votre relation (référence ${o.id.slice(0, 8)}).`,
        `Motif : ${o.motif}.`,
        dateCloture ? `La clôture est effective au ${dateCloture}.` : "La clôture est en cours de traitement.",
        "Vos avoirs seront transférés selon vos instructions.", "Veuillez agréer nos salutations distinguées."],
      DE: ["Betreff: Auflösung Ihrer Bankbeziehung", "", "Sehr geehrte Damen und Herren,",
        `Wir informieren Sie über die Auflösung Ihrer Beziehung (Referenz ${o.id.slice(0, 8)}).`,
        `Grund: ${o.motif}.`,
        dateCloture ? `Die Auflösung ist wirksam per ${dateCloture}.` : "Die Auflösung ist in Bearbeitung.",
        "Ihre Vermögenswerte werden gemäss Ihren Instruktionen übertragen.", "Freundliche Grüsse."],
      EN: ["Subject: closure of your banking relationship", "", "Dear Sir or Madam,",
        `We inform you of the closure of your relationship (reference ${o.id.slice(0, 8)}).`,
        `Reason: ${o.motif}.`,
        dateCloture ? `The closure is effective as of ${dateCloture}.` : "The closure is being processed.",
        "Your assets will be transferred according to your instructions.", "Yours faithfully."],
      IT: ["Oggetto: chiusura della relazione bancaria", "", "Gentili Signore e Signori,",
        `Vi informiamo della chiusura della relazione (riferimento ${o.id.slice(0, 8)}).`,
        `Motivo: ${o.motif}.`,
        dateCloture ? `La chiusura è effettiva al ${dateCloture}.` : "La chiusura è in corso di trattamento.",
        "I vostri averi saranno trasferiti secondo le vostre istruzioni.", "Distinti saluti."],
    };
    const texte = G[langue].join("\n");
    return { texte, langue };
  }

  // ── R268 : le type impose ses visas et ses documents — le refus liste TOUT ce qui manque ──
  private docsRequis(s: any, type: string): string[] {
    return (s.documentsParTypeCloture ?? {})[type]
      ?? (type === "DEMANDE_CLIENT" ? ["INSTRUCTION_TRANSFERT_SIGNEE"]
        : type === "DECES_SUCCESSION" ? ["ACTE_DECES"] : []);
  }
  private manquantsR268(o: any, s: any): string[] {
    const manquants: string[] = [];
    for (const v of (o.visas as any[]) ?? [])
      if (v.statut !== "SIGNED") manquants.push(`visa ${v.role}`);
    const fournis = new Set(((o.documents as any[]) ?? []).map((d) => d.type));
    for (const d of this.docsRequis(s, o.type))
      if (!fournis.has(d)) manquants.push(`document ${d}`);
    return manquants;
  }

  // ── R269 : les BLOCAGES sont vérifiés par le backend — refus LISTÉ, jamais partiel, aucun
  //    contournement (même ADMIN : aucune voie par rôle n'existe). AUCUNE table : vérification
  //    à la transition contre les sources de vérité existantes. ──
  private async obstaclesR269(tx: Tx, ctx: Ctx, o: any): Promise<string[]> {
    const obstacles: string[] = [];
    const cases = await tx.riskCase.findMany({
      where: { tenantId: ctx.tenantId, clientId: o.clientId, statut: { not: "CLOTUREE" } } });
    for (const c of cases) obstacles.push(`risk case ouvert ${c.id} (${c.statut})`);
    const comms = await tx.mrosCommunication.findMany({
      where: { tenantId: ctx.tenantId, clientId: o.clientId } });
    for (const m of comms) {
      if (m.gelActif) obstacles.push(`gel sanctions/SECO actif (communication ${m.id})`);
      if (m.decision === "COMMUNIQUER" && !m.notification)
        obstacles.push(`communication MROS en cours de délai (${m.id})`);
    }
    // Avoirs : port core connecté → soldes réels ; port absent → attestation manuelle VISÉE (R167 :
    // jamais un silence, jamais une donnée simulée).
    if (this.ports.core && this.ports.core.perimetre.includes("soldes")) {
      const soldes = await this.ports.core.lire("soldes");
      for (const s of soldes)
        if (s.clientId === o.clientId && Number(s.solde) !== 0)
          obstacles.push(`avoirs non transférés (compte ${s.compte ?? "?"} : solde ${s.solde})`);
    } else if (!o.attestationAvoirs) {
      obstacles.push("avoirs : attestation manuelle visée requise (port core banking absent)");
    }
    return obstacles;
  }

  // ── R269/OF-06 : attester les avoirs à la main — uniquement SANS port core, motivé, tracé ──
  async attesterAvoirs(ctx: Ctx, id: string, motif?: string) {
    if (!motif || !motif.trim())
      throw new BadRequestException("R7 : l'attestation d'avoirs exige un motif");
    if (this.ports.core && this.ports.core.perimetre.includes("soldes"))
      throw new BadRequestException(
        "R269 : port core banking connecté — l'attestation manuelle ne remplace pas la vérification des soldes");
    return this.prisma.$transaction(async (tx: Tx) => {
      const o = await this.dossier(tx, ctx, id);
      if (!ACTIFS.includes(o.statut)) throw new BadRequestException("R267 : clôture non active");
      const attestation = { par: ctx.userId, at: new Date().toISOString(), motif: motif.trim() };
      await tx.offboardingFile.update({ where: { id: o.id }, data: { attestationAvoirs: attestation } });
      await this.emit(tx, ctx.tenantId, "offboarding.attestation_avoirs", o.id, attestation);
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_ATTESTATION_AVOIRS", o.id);
      return { attestationAvoirs: attestation };
    });
  }

  // ── R268/R13 : viser — mécanisme uniforme (R15) ; l'initiateur n'appose JAMAIS le visa final ──
  async viser(ctx: Ctx, id: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const o = await this.dossier(tx, ctx, id);
      if (!ACTIFS.includes(o.statut)) throw new BadRequestException("R267 : clôture non active");
      const visas = ((o.visas as any[]) ?? []).slice();
      const idx = visas.findIndex((v) => v.role === ctx.role && v.statut === "PENDING");
      if (idx < 0) throw new ForbiddenException(`Aucun visa en attente pour le rôle ${ctx.role}`);
      const pendants = visas.filter((v) => v.statut === "PENDING");
      if (pendants.length === 1 && o.initiateur === ctx.userId)
        throw new ForbiddenException("R13 : l'initiateur de la clôture ne peut pas apposer le visa final");
      visas[idx] = { ...visas[idx], statut: "SIGNED", par: ctx.userId, at: new Date().toISOString() };
      await tx.offboardingFile.update({ where: { id: o.id }, data: { visas } });
      await this.emit(tx, ctx.tenantId, "offboarding.visa", o.id, { role: ctx.role, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_VISA", `${o.id}:${ctx.role}`);
      return { visas };
    });
  }

  // ── R268 : compléter le dossier documentaire — tracé ──
  async ajouterDocument(ctx: Ctx, id: string, doc: { type: string; ref: string }) {
    if (!doc?.type) throw new BadRequestException("Document sans type");
    return this.prisma.$transaction(async (tx: Tx) => {
      const o = await this.dossier(tx, ctx, id);
      if (!ACTIFS.includes(o.statut)) throw new BadRequestException("R267 : clôture non active");
      const documents = [...(((o.documents as any[]) ?? [])), { type: doc.type, ref: doc.ref ?? null }];
      await tx.offboardingFile.update({ where: { id: o.id }, data: { documents } });
      await this.emit(tx, ctx.tenantId, "offboarding.document", o.id, { type: doc.type, par: ctx.userId });
      return { documents };
    });
  }

  // ── R267 : transitions fermées ; CLOTUREE pose la rétention ; annulation motivée (OF-12) ──
  async transitionner(ctx: Ctx, id: string, vers: string, motif?: string) {
    return this.prisma.$transaction(async (tx: Tx) => {
      const o = await this.dossier(tx, ctx, id);
      if (!(TRANSITIONS[o.statut] ?? []).includes(vers))
        throw new BadRequestException(`R267 : transition illégale — ${o.statut} → ${vers}`);
      if (vers === "CLOTURE_ANNULEE" && !(motif && motif.trim()))
        throw new BadRequestException("R7 : annuler une clôture exige un motif");
      const data: any = { statut: vers };
      if (vers === "CLOTURE_ANNULEE") data.motifAnnulation = motif!.trim();
      if (vers === "CLOTUREE") {
        const s = await this.settings(tx, ctx.tenantId);
        const manquants = this.manquantsR268(o, s);                 // OF-02 : visas + documents du type
        if (manquants.length)
          throw new BadRequestException(`R268 : clôture refusée — manquants : ${manquants.join(", ")}`);
        const obstacles = await this.obstaclesR269(tx, ctx, o);     // OF-04/05/06 : TOUS les obstacles
        if (obstacles.length)
          throw new BadRequestException(`R269 : clôture refusée — obstacles : ${obstacles.join(" ; ")}`);
        const now = new Date();
        const retention = new Date(now);
        retention.setFullYear(retention.getFullYear() + (s.retentionPostClotureAns ?? 10)); // LBA art. 7
        data.clotureEffectiveAt = now; data.retentionJusqua = retention;
      }
      await tx.offboardingFile.update({ where: { id: o.id }, data });
      await this.emit(tx, ctx.tenantId, "offboarding.transition", o.id,
        { de: o.statut, vers, par: ctx.userId, ...(motif ? { motif: motif.trim() } : {}) });
      await this.audit.log(ctx.tenantId, ctx.userId, "OFFBOARDING_TRANSITION", `${o.id}:${o.statut}->${vers}`);
      return { statut: vers };
    });
  }

  // ── R267/OF-10 : le fait « clôturé » servi aux écrans (bannière) — calculé, jamais stocké ──
  async statutClient(ctx: Ctx, clientId: string) {
    return etatCloture(this.prisma, ctx.tenantId, clientId);
  }
}
