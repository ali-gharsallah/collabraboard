# Catalogue O-Live — Amendement PROPOSÉ (R177 → R179) · Bloc 37 « Le module est une licence »

**Statut : RATIFIÉ le 21.07.2026 par Ali Gharsallah.**
Numérotation continue après R176. Famille : **LC** (vérifiée libre). **Le catalogue précède
le code.** Existant mesuré : `license/license.service.ts` (licence signée par tenant,
garde `ModuleLicensed`) — embryon SANS instance/version, SANS acte vendor tracé, SANS test.
Exigence d'Ali : chaque module activable depuis l'écran paramètres DU VENDOR, par version
ou instance on-premise d'O-Live.

## R177 — Le catalogue des modules est DÉCLARÉ ; la licence d'une instance est SIGNÉE

Les modules sont un **registre fixe du produit** (GED, OCR, KYC, AML, COC, ACCREV,
WORKFLOWS, ONBOARDING, SCREENING, PMS, IA) — on ne licencie pas un module qui n'existe pas.
Une licence est un document **signé par le vendor** : `{instanceId, version, modules[],
effetAt, expiry}` — la signature se **vérifie à chaque lecture** ; une licence altérée est
un refus explicite (« licence invalide »), jamais un module de plus.

> **LC-01** émission signée → vérification OK, périmètre lisible · **LC-02** licence
> altérée (module ajouté à la main) → refus explicite

## R178 — Défaut-refus par module — pas de fonctionnalité fantôme

Sans module licencié pour l'instance : **refus explicite uniforme** (`assertModule`) — aux
services, à l'API, aux écrans. La banque **voit son périmètre** (la liste de ce qu'elle a,
avec version et échéance) ; elle ne voit jamais un module qu'elle n'a pas comme s'il était
en panne. Un module inconnu du registre : refus aussi — dans les deux sens.

> **LC-03** module licencié → passe ; non licencié → refus « non licencié » ; inconnu du
> registre → refus « inconnu »

## R179 — Activer ou désactiver est un ACTE VENDOR — daté, motivé, jamais rétroactif

Changer le périmètre d'une instance = **émettre une NOUVELLE licence signée** (jeton
vendor, motif, date d'effet ≥ aujourd'hui — pattern R126). L'historique des licences
successives est **append-only** : chaque licence passée reste lisible (qui avait quoi,
quand — R48). L'émission est un événement + audit. Un profil non-vendor qui tente : refus
tracé.

> **LC-04** retrait d'un module = nouvelle licence motivée datée ; l'historique garde les
> deux ; effet rétroactif → refus · **LC-05** profil banque qui émet → refus tracé

## Implications techniques
| Point | Conséquence |
|---|---|
| Modèle | `VendorLicense` (instanceId, version, modules Json, effetAt, expiry, signature, motif, emisPar, at) — **append-only** (pas d'update) — RLS non applicable (table VENDOR, hors tenant) → accès service uniquement |
| Service | `license/vendor-license.service.ts` : `emettre` (R177/R179), `verifier`, `perimetre`, `assertModule` (R178), `historique` — signature HMAC clé vendor (env), registre `MODULES_PRODUIT` exporté |
| Convergence | la garde existante `ModuleLicensed` branchera `assertModule` du nouveau service (déploiement — note) |
| Écran | console VENDOR « Licences — Modules par instance » : sélecteur d'instance, grille modules, motif, émission ; profil banque = lecture seule de SON périmètre |
| Événements | `vendor.licence.emise` · `vendor.licence.acces.refuse` |

Tests : LC-01..05 (`vendor-license.wiring.spec.ts`), écrits **avant** l'implémentation.

`RATIFIÉ le 21.07.2026 par Ali Gharsallah`
