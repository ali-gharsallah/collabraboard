# language: fr
Fonctionnalité: Vague 5 — Rattrapage maquette : CRM & Workflow (spec-first)
  Statut: Vague 5
  Écrans: CRM Banque · Contact Reports · Workflow (Designer/Rules) · Corroboration KYC
  Doctrine: on rattrape la maquette là où le CANON est ratifié. Zéro invention.
  CRM (R186→R188) et Workflow (R171→R173) et Corroboration (R36) sont déjà ratifiés.

  # ── Écran 1 : CRM Banque — timeline & gestes ──
  Scénario: V5-CRM — la relation client se relit et le prochain geste se propose
    Étant donné un client
    Quand le RM ouvre la relation
    Alors la timeline projette les événements (R186)
    Et les prochains gestes sont proposés (R187), jamais exécutés

  # ── Écran 2 : Contact Reports — compte rendu d'entretien ──
  Scénario: V5-CR — un compte rendu se trace ; le pré-remplissage IA refuse sans port
    Étant donné un client
    Quand le RM crée un compte rendu d'entretien
    Alors il est tracé (R188)
    Quand il demande un pré-remplissage sans port IA configuré
    Alors O-Live refuse explicitement (R138) — jamais un simulacre

  # ── Écran 3 : Workflow Designer/Rules — définition gouvernée & versionnée ──
  Scénario: V5-WF — une définition se publie datée et devient immuable
    Étant donné un brouillon de définition de workflow
    Quand un rôle habilité le publie avec une date de mise en vigueur et un motif (R7)
    Alors la version est PUBLIEE et IMMUABLE (R171) — on ne la modifie plus
    Et une modification d'une version publiée est refusée (on publie une nouvelle version datée)
    Et un rôle non habilité ne publie pas (R173)
    Et la résolution à une date rend la version applicable la plus récente (R172, grandfathering)

  # ── Écran 4 : Corroboration KYC — divergence d'identité ──
  Scénario: V5-CORROB — une divergence ouvre un dossier Central File, sans rien modifier
    Étant donné une personne dont un champ d'identité diverge entre dossiers
    Quand le CO signale la divergence
    Alors un dossier Central File est ouvert et une tâche de corroboration émise (R36)
    Et AUCUNE donnée n'est modifiée avant décision humaine
