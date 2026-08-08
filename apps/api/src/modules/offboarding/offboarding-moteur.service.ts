import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Bloc 62 — Offboarding AU MOTEUR (repo R439–R445 · session R432–R438,
 * spec/BLOC-62-OFFBOARDING-R432-R438.md, RATIFIÉ 08.08.2026).
 *
 * SQUELETTE D'API POSÉ EN A2 (tests rouges d'abord) : AUCUNE logique moteur ici tant que la
 * suite OF-01..OF-14 n'est pas ROUGE mesurée — chaque méthode lève BLOC62_NON_IMPLEMENTE.
 * L'implémentation arrive en A3 (WF_DEF + guards) et A4 (registre R-Q + pop-up R445).
 *
 * Contrat (dérivé des scénarios, rien de plus) :
 *  - R439 : l'état d'une instance est un REJEU du journal append-only
 *    (WORKFLOW_STARTED → TRANSITION_FIRED* → WORKFLOW_COMPLETED) — aucun champ d'index.
 *  - États : Création → Collecte → Review → Validation → Clôturé (R16).
 *    Les maillons de la chaîne R441 gouvernent les transitions à visa dans l'ordre
 *    [Collecte→Review, Review→Validation, Validation→Clôturé] ; maillons excédentaires =
 *    visas MULTIPLES sur la transition de clôture (R1) — la clôture exige la chaîne complète.
 *  - R440 : guards évalués à CHAQUE tentative (données live), sévérités du SNAPSHOT
 *    d'initiation (R29) ; BLOQUANT → GUARD_BLOCKED + refus ; AVERTISSEMENT → GUARD_WARNING
 *    + passe ; DÉSACTIVÉ → non évalué.
 *  - R441/R442/R443 : paramètres résolus PAR DATE D'INITIATION (défauts §2 du spec +
 *    PARAM_CHANGED en vigueur ≤ date) et FIGÉS dans WORKFLOW_STARTED.
 *  - R445 : modifierParametre SANS confirmation → 409 avec le payload du pop-up ;
 *    AVEC → PARAM_CHANGED {auteur, ancien, nouveau, engagementTexte, enVigueurLe}.
 */

export type Ctx = { tenantId: string; userId: string; role: string };
export const ETATS_OFFBOARDING = ["Création", "Collecte", "Review", "Validation", "Clôturé"] as const;

const NON_IMPLEMENTE = () => {
  throw new Error("BLOC62_NON_IMPLEMENTE — squelette A2 : l'implémentation arrive en A3/A4 (tests rouges d'abord)");
};

@Injectable()
export class OffboardingMoteurService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Paramètres §Offboarding résolus À DATE (défauts + PARAM_CHANGED en vigueur ≤ aDate). */
  async parametres(_ctx: Ctx, _aDate?: Date): Promise<any> { return NON_IMPLEMENTE(); }

  /** R445 — sans confirmation : ConflictException(payload pop-up) ; avec : PARAM_CHANGED. */
  async modifierParametre(_ctx: Ctx, _dto: { cle: string; valeur: any; enVigueurLe: string;
    confirmation?: { engagementTexte: string; auteur: string } }): Promise<any> { return NON_IMPLEMENTE(); }

  /** R442/R441 — initiation : rôle habilité par motif, niveau (calculé|forçage), snapshot figé. */
  async initier(_ctx: Ctx, _dto: { clientId: string; motif: string; dateInitiation?: string }): Promise<any> { return NON_IMPLEMENTE(); }

  /** R439 — projection PURE du journal (aucun champ d'index) ; aDate = rejeu partiel (R48). */
  async etat(_ctx: Ctx, _instanceId: string, _aDate?: Date): Promise<any> { return NON_IMPLEMENTE(); }

  /** R440/OF-12 — health check du dossier, motifs filtrés PAR RÔLE (art. 10a LBA). */
  async healthCheck(_ctx: Ctx, _instanceId: string): Promise<any> { return NON_IMPLEMENTE(); }

  /** R441/R13 — appose le visa du maillon courant et tente la transition (guards évalués). */
  async viser(_ctx: Ctx, _instanceId: string): Promise<any> { return NON_IMPLEMENTE(); }

  /** R443 — coche un item de checklist (événement append-only, jamais un UPDATE). */
  async cocherItem(_ctx: Ctx, _instanceId: string, _label: string): Promise<any> { return NON_IMPLEMENTE(); }

  /** R444/R51 — audit trail extractible par ID (requête, pas reconstruction). */
  async auditTrail(_ctx: Ctx, _instanceId: string): Promise<any> { return NON_IMPLEMENTE(); }
}
