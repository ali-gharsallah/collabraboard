// Gabarit de dossier par workflow. En P2, ceci sort du code vers le Rule Engine
// (Configuration Studio) — l'interface reste identique.
import { AccessRight, Role } from "@prisma/client";

type Q = { code: string; label: string; rights?: Partial<Record<Role, AccessRight>> };
type S = { code: string; label: string; questions: Q[] };

// Default-deny : tout rôle absent des règles = HIDDEN.
const RM_EDIT = { RM: "EDIT", ARM: "EDIT", CO: "VIEW", CO_SR: "VIEW", MLRO: "VIEW", DIR: "VIEW", ADMIN: "EDIT" } as const;
const CO_EDIT = { RM: "VIEW", ARM: "VIEW", CO: "EDIT", CO_SR: "EDIT", MLRO: "EDIT", DIR: "VIEW", ADMIN: "EDIT" } as const;

export const SECTIONS_BY_WORKFLOW: Record<string, S[]> = {
  SDD: [
    { code: "IDENTITY", label: "Identité & relation", questions: [
      { code: "IDE-Q1", label: "Identité du titulaire vérifiée (document officiel)", rights: RM_EDIT },
      { code: "IDE-Q2", label: "Nationalité(s) et résidence(s) fiscale(s)", rights: RM_EDIT },
      { code: "IDE-Q3", label: "Statut PEP (déclaration)", rights: CO_EDIT } ] },
    { code: "SOF", label: "Origine des fonds", questions: [
      { code: "SOF-Q1", label: "Source des fonds documentée", rights: RM_EDIT } ] },
  ],
  CDD: [
    { code: "IDENTITY", label: "Identité & relation", questions: [
      { code: "IDE-Q1", label: "Identité du titulaire vérifiée (document officiel)", rights: RM_EDIT },
      { code: "IDE-Q2", label: "Nationalité(s) et résidence(s) fiscale(s)", rights: RM_EDIT },
      { code: "IDE-Q3", label: "Statut PEP (déclaration + screening)", rights: CO_EDIT } ] },
    { code: "UBO", label: "Ayants droit économiques", questions: [
      { code: "UBO-Q1", label: "Formulaire A/K établi et signé", rights: RM_EDIT },
      { code: "UBO-Q2", label: "Chaîne de détention documentée", rights: CO_EDIT } ] },
    { code: "SOF", label: "Origine des fonds & de la fortune", questions: [
      { code: "SOF-Q1", label: "Source des fonds documentée", rights: RM_EDIT },
      { code: "SOF-Q2", label: "Cohérence SOF/SOW vs profil (plausibilisation)", rights: CO_EDIT } ] },
    { code: "AML", label: "Conformité LBA", questions: [
      { code: "AML-Q1", label: "Screening sanctions/PEP/adverse media exécuté", rights: CO_EDIT } ] },
  ],
  EDD: [
    { code: "IDENTITY", label: "Identité & relation", questions: [
      { code: "IDE-Q1", label: "Identité du titulaire vérifiée (document officiel)", rights: RM_EDIT },
      { code: "IDE-Q2", label: "Nationalité(s) et résidence(s) fiscale(s)", rights: RM_EDIT },
      { code: "IDE-Q3", label: "Statut PEP détaillé (fonction, période, déclassement)", rights: CO_EDIT } ] },
    { code: "UBO", label: "Ayants droit économiques", questions: [
      { code: "UBO-Q1", label: "Formulaire A/K établi et signé", rights: RM_EDIT },
      { code: "UBO-Q2", label: "Chaîne de détention documentée jusqu'aux PP", rights: CO_EDIT } ] },
    { code: "SOF", label: "Origine des fonds & de la fortune", questions: [
      { code: "SOF-Q1", label: "Source des fonds corroborée (pièces)", rights: CO_EDIT },
      { code: "SOF-Q2", label: "Source de la fortune corroborée (pièces)", rights: CO_EDIT } ] },
    { code: "AML", label: "Conformité LBA renforcée", questions: [
      { code: "AML-Q1", label: "Screening approfondi + adverse media", rights: CO_EDIT },
      { code: "AML-Q2", label: "Analyse pays/corridors et justification économique", rights: CO_EDIT } ] },
  ],
};
// Visas requis par workflow (four-eyes minimum ; EDD ajoute le MLRO).
export const VISAS_BY_WORKFLOW: Record<string, Array<{ sectionCode: string; role: Role }>> = {
  SDD: [ { sectionCode: "IDENTITY", role: "CO" } ],
  CDD: [ { sectionCode: "IDENTITY", role: "CO" }, { sectionCode: "AML", role: "CO_SR" } ],
  EDD: [ { sectionCode: "IDENTITY", role: "CO" }, { sectionCode: "AML", role: "CO_SR" },
         { sectionCode: "SOF", role: "MLRO" } ],
};
