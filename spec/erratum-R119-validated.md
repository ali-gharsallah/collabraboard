# Erratum R119 — statut terminal du KYC = `VALIDATED`

- **Statut** : RATIFIÉ
- **Auteur de la décision** : Ali (jeton — ratification du 19.07.2026)
- **Portée** : R119 (bloc 19, Onboarding) · amendement `catalogue-amendement-R117-R120-onboarding.md`

## Écart constaté

`onboarding.service.ts` (R119) refusait la transition `DECISION → OUVERT` tant que le KYC lié
n'était pas `"APPROVED"`. Or `"APPROVED"` **n'existe pas** dans l'enum ratifié `KycStatus` du
schéma :

```
enum KycStatus { IN_PROGRESS  UNDER_REVIEW  VALIDATED  REJECTED }
```

Le corpus OB-04 passait uniquement parce que son **faux** moteur KYC posait `status = "APPROVED"`.
En exécution réelle, aucun KYC n'atteint `APPROVED` → l'ouverture serait restée **définitivement
bloquée**. Écart faux-KYC / enum réelle (relevé à l'intégration du bloc 19).

## Décision (option B)

Le statut terminal requis par R119 est **`VALIDATED`**, valeur réelle de l'enum. La mention
« KYC APPROVED avant ouverture de compte » de MOD-01 (Spécifications Produit §3.1) est
**historique** sur ce point et ne fait pas foi contre l'enum du moteur.

## Application

- `apps/api/src/modules/onboarding/onboarding.service.ts` : comparaison `kyc.status !== "VALIDATED"`.
- `onboarding.wiring.spec.ts` (OB-04) : le faux KYC répond `"VALIDATED"` ; l'assertion de refus
  reste sur le statut réel (`IN_PROGRESS`) — le test est **renforcé**, pas affaibli.
- `catalogue-amendement-R117-R120-onboarding.md` : R119 et scénario OB-04 alignés sur `VALIDATED`.

Corpus `test:rules` : 193/193 conservés.

> Note d'intégration : le zip « re-fourni » n'était pas joint à la demande de correction ; ce
> fichier et la version corrigée de l'amendement ont donc été **rédigés d'après la ratification
> d'Ali** (message du 19.07.2026), non copiés. À remplacer par la version canonique si elle diffère.
