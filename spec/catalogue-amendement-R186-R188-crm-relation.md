# Catalogue O-Live — Amendement PROPOSÉ (R186 → R188) · Bloc 40 « La relation se lit, le geste se motive, le conseil se trace »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R185. Famille : **CR** (vérifiée libre — RC est pris).
**Le catalogue précède le code.** Amélioration du module CRM selon les cinq axes validés :
timeline unifiée, prochain geste réel, comptes rendus conformes au conseil (LSFin),
pipeline sans ressaisie, partage par rôles — condensés en trois règles.

## R186 — La relation se lit en TIMELINE — une projection, jamais une copie

La chronologie d'un client **dérive du journal d'événements** de tous les modules (KYC,
documents, surveillance, tâches, contacts) : le CRM ne stocke pas sa propre vérité, il
**projette** celle du moteur — chaque entrée dit sa source et sa date. La lecture est
filtrée aux droits du lecteur : le RM lit SES clients, les rôles à visibilité étendue
(Compliance, Central File) lisent tout, un tiers est refusé et tracé. Le pipeline
prospection→onboarding est le même principe : la timeline commence au premier contact,
rien ne se ressaisit.

> **CR-01** timeline multi-modules ordonnée, chaque entrée dit sa source — zéro table
> propre · **CR-02** RM = ses clients ; visibilité étendue = tout ; tiers = refus tracé

## R187 — Le prochain geste DÉRIVE d'un signal réel — daté, motivé, jamais exécuté seul

Les suggestions (« pièce expire dans N jours », « revue due », « tâche en retard »)
se **recalculent** depuis l'état vivant — chaque suggestion **nomme son signal source**
et son échéance. Le signal disparu, la suggestion disparaît. Rien ne s'exécute tout seul :
le moteur propose le geste, le conseiller le fait (R39/R44).

> **CR-03** signaux réels → suggestions motivées ; signal résolu → suggestion disparue ;
> rien d'exécuté

## R188 — Le contact client est un ACTE tracé — le conseil se documente, l'IA propose, l'humain signe

Un compte rendu d'entretien est structuré par **type** (visite, appel, conseil en
placement…) ; chaque type déclare ses **champs obligatoires** (paramètre `crmEntretiens`) —
c'est la trace du conseil exigée par la LSFin : un champ obligatoire manquant est un refus
explicite. Le pré-remplissage par l'IA passe par un **port déclaré** (pas de moteur = pas
de brouillon fantôme) et produit une **proposition marquée** de son origine — seule la
validation humaine crée le compte rendu, append-only, événement à la clé.

> **CR-04** champ obligatoire du type manquant → refus explicite ; créé = append-only +
> événement · **CR-05** pré-remplissage = port déclaré, proposition marquée IA, validation
> humaine ; sans port : refus explicite, la saisie manuelle vit toujours

## Implications techniques
| Point | Conséquence |
|---|---|
| Service | `crm/crm.service.ts` : `timeline` (R186), `prochainsGestes` (R187), `preRemplir` + `creerCompteRendu` (R188) — le module `clients/` existant reste INTACT |
| Modèle | `CrmContact` (tenantId, clientId, type, contenu Json, origine MANUEL\|IA_VALIDEE, par, at) — append-only — RLS |
| Paramètres | +`crmEntretiens` (types + champs obligatoires par type — trace du conseil LSFin) — questionnaire R-Q |
| Ports | `ia.preRemplir(contexteClient)` — déclaré, jamais simulé (pattern R138) |
| Événements | `crm.contact.cree` · `crm.acces.refuse` |
| Écran | « Relation client — timeline & entretiens » (espace Clients & dossiers) : sélecteur client, timeline unifiée, gestes suggérés, compte rendu avec obligatoires visibles + pré-remplissage IA marqué |

Tests : CR-01..05 (`crm.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
