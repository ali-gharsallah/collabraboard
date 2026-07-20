# Catalogue O-Live — Patch v4.11 → v4.12 (RATIFICATION du 20.07.2026)

**Décision d'Ali Gharsallah, 20.07.2026 :** ratification des règles **R152 → R155**
(Bloc 28 · Les personnes liées — le lien est un acte). Page de garde Word : v4.12.

| Bloc | Règles | Corpus | Verts |
|---|---|---|---|
| 28 · Les personnes liées — le lien est un acte | **R152 R153 R154 R155** | PL-01..04 (+2 gardes) | 6/6 |

- **Scénarios catalogue** : 229 (v4.11) + PL 4 = **233 IDs**.
- **Corpus backend** : 250 + 6 = **256** — confirmé sur la branche GitHub (rapport lot 27 :
  250/250, CI verte) ; le lot 28 portera à 256.
- **Le geste** (demande d'Ali, spec produit §6 prise au mot) : bouton → popup → chercher-ou-
  créer → boutons de rôles CUMULABLES. Habilitation paramétrable par catégorie (R152),
  référentiel semé §6.2/6.3 extensible tenant, doublon exact refusé (R153), relation non
  officielle BIJECTIVE — le miroir se pose et se retire atomiquement (R154), création
  minimale + tâche de complétion + homonymie SIGNALÉE sans empêcher (R155, esprit R39).
- **Paramètres R-Q** (registre R125) : `lienRolesOfficiels` · `lienRolesNonOfficiels` ·
  `lienTypes` (null = référentiel semé, avec inverses).
- **UI livrée en démo** : `LierPersonnePopup`, monté sur l'écran Personnes, réutilisable
  au KYC/onboarding — le VRAI service compilé tourne derrière les boutons.
- Gouvernance : l'invariant MO-03 reste à « ≤ 2 blocs proposés simultanés » — règle de
  fonctionnement documentée (une demande peut s'intercaler pendant une attente de
  ratification), pas un affaiblissement ponctuel.
- Catalogue : **R1 → R155, aucune règle proposée.**
