# Tests d'Acceptation Fonctionnelle — Vague 1

**Exécutés le 2026-07-22 contre le backend réel** (`apps/api/test/e2e/fat-vague1.e2e-spec.ts`).
Preuve brute : `docs/tests/PREUVES/fat-vague1-run.txt`. Statut global : **8/8 PASS**.

Légende criticité : **C** = critique (bloquant recette) · **M** = majeur · **m** = mineur.

| ID FAT | Persona | Objectif métier | Préconditions | Étapes (langage humain) | Résultat attendu (métier) | Règle / exigence | Criticité | Statut |
|---|---|---|---|---|---|---|---|---|
| **FAT-CLIENT-01** | Relationship Manager | Créer un client et le retrouver dans **ma** liste, sans qu'un autre établissement le voie | Tenant + RM authentifié | 1. Je crée « Fondation Helvetia » (FOUNDATION, CH). 2. J'ouvre ma liste clients. 3. Un RM d'un **autre** tenant ouvre la sienne. | Le client apparaît chez moi ; **invisible** de l'autre tenant. | Isolation multi-tenant (RLS) | **C** | ✅ PASS |
| **FAT-KYC-01** | Compliance Officer | La validation d'un dossier KYC est protégée par le **four-eyes** ; elle seule autorise le golden record | Dossier KYC créé par le RM, visa IDENTITY signé par un CO | 1. Le **créateur** (RM) tente de valider. 2. Un **tiers** habilité (CO) valide. | Créateur **refusé** (four-eyes, 409) ; tiers → dossier **VALIDATED** + événement `kyc.validated` émis (déclencheur golden record). | Four-eyes / R52 · golden record | **C** | ✅ PASS |
| **FAT-KYC-02** | Compliance Officer | Un contributeur d'une section ne peut pas viser **cette même** section | Le CO a répondu à une question d'IDENTITY | 1. Ce même CO tente de signer le visa IDENTITY. | **Refusé** (409, R13) — séparation contribution/contrôle. | R13 | **C** | ✅ PASS |
| **FAT-AML-01** | Compliance Officer / MLRO | Une contrepartie sanctionnée **bloque** l'opération et exige une décision humaine | Client existant | 1. J'évalue une opération dont le bénéficiaire est sur liste réglementaire. | **Blocage automatique** (`bloque=true`) ; signal **R192** persisté, signé par mon jeton. | R192 (sanctions) | **C** | ✅ PASS |
| **FAT-AML-02** | Compliance Officer | Un fractionnement sous le seuil lève une **alerte** (sans bloquer) | Client existant | 1. J'évalue 5 virements sortants à 19 999 CHF, même bénéficiaire, en 48 h. | Signal **STRUCTURING** niveau 2, `bloque=false` (alerte, pas blocage). | R189 (structuring) | **M** | ✅ PASS |
| **FAT-ALERTE-01** | MLRO | Consulter les alertes d'un client ; elles sont **cloisonnées** | Alertes déjà levées sur le client | 1. Je liste les signaux du client. 2. Je liste ceux d'un client inconnu. | Les alertes du client s'affichent ; **0** pour un autre (tenant-scope). | Consultation · isolation | **M** | ✅ PASS |
| **FAT-ALERTE-02** | Compliance Officer | La spéculation (maysir) **bloque** ; une entité **caritative** sanctionnée part en **revue humaine**, jamais en auto-blocage | Client existant | 1. J'évalue un transfert vers une plateforme spéculative. 2. J'évalue un don à une entité caritative islamique figurant sur une liste. | Maysir → `bloque=true` (R209) ; caritative → `bloque=false`, **`revueManuelle=true`** (R216). | R209 · R216 | **C** | ✅ PASS |
| **FAT-REJEU-01** | Auditeur | Voir la valeur d'une règle/paramètre **telle qu'elle était à une date passée** | Paramètre `slaKycJours` (défaut 30) | 1. Je constate la valeur (30). 2. Le CO la change en 45 aujourd'hui (motivé). 3. Je consulte la valeur **d'hier**. | Aujourd'hui = **45** ; hier = **30** (la valeur d'alors, pas la courante). | R127 (rejeu à date) | **C** | ✅ PASS |

**Preuve rejeu à date (FAT-REJEU-01)** : `aujourd'hui=45, à la date 2026-07-21 (hier)=30` — reconstruction point-in-time depuis le journal append-only `tenant_param_changes` (R127).
