import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * L'extraction comprend le document — R174→R176 (OC-01..06). Écrit APRÈS l'amendement,
 * APRÈS les tests. Le moteur OCR est un PORT (R138 : déclaré, jamais simulé) ; le
 * FORMULAIRE est un PORT (l'écriture réelle KYC/GED = injection au module).
 * R174 : le gabarit vit au type (gedDocTypes[].extraction, versionné) — extraction typée
 * sur document CLASSÉ, champs candidats {nom, valeur, confiance} en dérivé signé ; le
 * dérivé garde À VIE la version du gabarit. Sans gabarit : brut, tracé.
 * R175 : les contrôles rapportent (PASSE/ECHEC/INAPPLICABLE), l'échec SIGNALE (événement),
 * rien ne bloque, l'humain qualifie. Idempotence (version, gabarit) — le scalable commence
 * par ne jamais refaire le même travail.
 * R176 : la digitalisation PROPOSE ; accepter est un acte (jeton, tracé) qui écrit par le
 * port avec provenance complète ; refuser se motive et se trace.
 */

type Ctx = { tenantId: string; userId: string; role: string };
type OcrPort = { moteur: string; lire(contenu: string): Promise<{ texte: string }> };
export type FormPort = { ecrireChamp(ctx: Ctx, cible: any, valeur: string): Promise<void> };
type Ports = { ocr?: OcrPort; form?: FormPort };

@Injectable()
export class OcrExtractionService {
  constructor(private prisma: PrismaService, private audit: AuditService, private ports: Ports = {}) {}

  private emit(tx: any, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private sha(x: string) { return createHash("sha256").update(x).digest("hex"); }

  // ── Le cœur : lire le texte, chercher chaque champ LÀ où le gabarit le dit ──
  private chercher(texte: string, champ: any): { valeur: string | null; confiance: number } {
    const indice = String(champ.indice ?? "");
    if (indice.startsWith("ligne:")) {
      const prefixe = indice.slice(6).toUpperCase();
      for (const ligne of texte.split("\n")) {
        const l = ligne.trim();
        if (l.toUpperCase().startsWith(prefixe)) {
          const valeur = l.slice(l.indexOf(":") + 1).trim();
          if (valeur) return { valeur, confiance: 0.92 };
        }
      }
    }
    return { valeur: null, confiance: 0 };
  }

  private controler(code: string, champs: any[], gabarit: any): string {
    if (code === "CHAMPS_OBLIGATOIRES") {
      const manquant = gabarit.champs.filter((c: any) => c.obligatoire)
        .some((c: any) => !champs.find((x) => x.nom === c.nom && x.valeur));
      return manquant ? "ECHEC" : "PASSE";
    }
    if (code === "EXPIRATION_FUTURE") {
      const exp = champs.find((x) => x.nom === "expiration");
      if (!exp || !exp.valeur) return "INAPPLICABLE";
      return new Date(exp.valeur).getTime() > Date.now() ? "PASSE" : "ECHEC";
    }
    return "INAPPLICABLE";
  }

  // ── R174/R175 : extraction typée — contrat, contrôles, dérivé signé, idempotente ──
  async extraireTypee(ctx: Ctx, documentId: string, versionId: string, contenu: string) {
    if (!this.ports.ocr) throw new BadRequestException("R138 : aucun moteur OCR configuré — pas d'extraction simulée");
    return this.prisma.$transaction(async (tx: any) => {
      const doc = await tx.document.findFirst({ where: { id: documentId, tenantId: ctx.tenantId } });
      if (!doc) throw new NotFoundException("Document introuvable");
      if (!doc.typeCode) throw new BadRequestException("R174 : l'extraction typée exige un document classé — le type dit le gabarit");
      const version = await tx.documentVersion.findFirst({ where: { id: versionId, tenantId: ctx.tenantId } });
      if (!version) throw new NotFoundException("Version introuvable");
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const type = (((t?.settings as any)?.gedDocTypes) ?? []).find((x: any) => x.code === doc.typeCode);
      const gabarit = type?.extraction ?? null;
      const gabaritVersion = gabarit ? gabarit.version : null;
      const deja = await tx.ocrExtraction.findFirst({ where: { tenantId: ctx.tenantId, versionId, gabaritVersion } });
      if (deja) throw new BadRequestException("Extraction déjà produite pour cette version et ce gabarit — le dérivé est immuable, on ne refait pas le même travail");
      const { texte } = await this.ports.ocr!.lire(contenu);
      let champs: any[] = [], controles: any[] = [], mode = "BRUT";
      if (gabarit) {
        mode = "TYPE";
        champs = gabarit.champs.map((c: any) => { const r = this.chercher(texte, c); return { nom: c.nom, valeur: r.valeur, confiance: r.confiance }; })
          .filter((c: any) => c.valeur !== null);
        controles = (gabarit.controles ?? []).map((code: string) => ({ controle: code, resultat: this.controler(code, champs, gabarit) }));
      }
      const x = await tx.ocrExtraction.create({ data: { tenantId: ctx.tenantId, documentId, versionId,
        gabaritVersion, moteur: this.ports.ocr!.moteur, champs, controles,
        shaSource: version.sha256, shaDerive: this.sha(JSON.stringify({ champs, controles, texte })),
        at: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ocr.extraction.produite", x.id,
        { documentId, versionId, gabaritVersion, mode, nbChamps: champs.length });
      for (const c of controles.filter((k: any) => k.resultat === "ECHEC"))
        await this.emit(tx, ctx.tenantId, "ocr.controle.echec", x.id, { documentId, controle: c.controle });
      await this.audit.log(ctx.tenantId, ctx.userId, "OCR_EXTRACTION", documentId);
      return { extractionId: x.id, mode, champs, controles, texte };
    });
  }

  // ── R176 : proposer — le mapping du gabarit, rien d'écrit ──
  async proposer(ctx: Ctx, extractionId: string, cible: { form: string; dossierCode: string }) {
    return this.prisma.$transaction(async (tx: any) => {
      const x = await tx.ocrExtraction.findFirst({ where: { id: extractionId, tenantId: ctx.tenantId } });
      if (!x) throw new NotFoundException("Extraction introuvable");
      const doc = await tx.document.findFirst({ where: { id: x.documentId, tenantId: ctx.tenantId } });
      const t = await tx.tenant.findFirst({ where: { id: ctx.tenantId } });
      const type = (((t?.settings as any)?.gedDocTypes) ?? []).find((k: any) => k.code === doc.typeCode);
      const mapping = type?.extraction?.mapping ?? [];
      const out: any[] = [];
      for (const mp of mapping) {
        const champ = (x.champs as any[]).find((c) => c.nom === mp.champ);
        if (!champ) continue;
        const pr = await tx.ocrProposition.create({ data: { tenantId: ctx.tenantId, extractionId,
          cible: { ...mp.cible, dossierCode: cible.dossierCode }, champ: mp.champ,
          valeur: champ.valeur, confiance: champ.confiance, statut: "EN_ATTENTE",
          decidePar: null, decideAt: null, motifRefus: null } });
        await this.emit(tx, ctx.tenantId, "ocr.proposition.creee", pr.id, { champ: mp.champ, cible: mp.cible });
        out.push({ propositionId: pr.id, champ: mp.champ, valeur: champ.valeur, confiance: champ.confiance, statut: "EN_ATTENTE" });
      }
      return out;
    });
  }

  // ── R176 : l'acte humain — accepter écrit PAR LE PORT, avec provenance ──
  async accepter(ctx: Ctx, propositionId: string) {
    if (!this.ports.form) throw new BadRequestException("Aucun port de formulaire configuré — rien ne s'écrit dans le vide");
    return this.prisma.$transaction(async (tx: any) => {
      const pr = await tx.ocrProposition.findFirst({ where: { id: propositionId, tenantId: ctx.tenantId } });
      if (!pr) throw new NotFoundException("Proposition introuvable");
      if (pr.statut !== "EN_ATTENTE") throw new BadRequestException("La décision ne se rejoue pas");
      await this.ports.form!.ecrireChamp(ctx, pr.cible, pr.valeur);
      await tx.ocrProposition.update({ where: { id: pr.id },
        data: { statut: "ACCEPTEE", decidePar: ctx.userId, decideAt: new Date().toISOString() } });
      await this.emit(tx, ctx.tenantId, "ocr.proposition.acceptee", pr.id,
        { champ: pr.champ, cible: pr.cible, extractionId: pr.extractionId, confiance: pr.confiance, par: ctx.userId });
      await this.audit.log(ctx.tenantId, ctx.userId, "OCR_ACCEPT", pr.id);
    });
  }

  async refuser(ctx: Ctx, propositionId: string, motif: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const pr = await tx.ocrProposition.findFirst({ where: { id: propositionId, tenantId: ctx.tenantId } });
      if (!pr) throw new NotFoundException("Proposition introuvable");
      if (pr.statut !== "EN_ATTENTE") throw new BadRequestException("La décision ne se rejoue pas");
      if (!motif || !motif.trim()) throw new BadRequestException("R7 : refuser se motive");
      await tx.ocrProposition.update({ where: { id: pr.id },
        data: { statut: "REFUSEE", decidePar: ctx.userId, decideAt: new Date().toISOString(), motifRefus: motif.trim() } });
      await this.emit(tx, ctx.tenantId, "ocr.proposition.refusee", pr.id, { motif: motif.trim(), par: ctx.userId });
    });
  }
}
