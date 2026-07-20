# Matrice de traçabilité — Addendum 19.07.2026 (à fusionner au §2)

| Règle | Domaine | Câblage | Tests | Verts |
|---|---|---|---|---|
| **R104** (PROPOSÉE) — propagation contrôlée golden record | `events/golden-record.projector.ts` | OutboxWorker (tx du drain), mapping fermé, idempotent | GR-01..04 (+5 gardes) | 9/9 |
| **R100→R103** — screening persistant | `screening/screening.service.ts` + Prisma (3 tables) | endpoints run/qualify/hits/runs ; auteur = jeton ; VP → escalade proposée | SC wiring | 10/10 |
| **R89→R92** (complément) — vérif JWKS IdP | `auth/jwks-verifier.ts` | `verifyIdToken` réel (RS256 strict, rollover, cache) | JV-01..07 | 9/9 |
| **IAM prod** — mfa_secret chiffré au repos | `common/secret-box.ts` + `mfa.service` | AES-256-GCM, `enc:v1:`, legacy passthrough | SB-01..06 + intégration | 9/9 |
| **R30→R36** — personnes (port du moteur bloc 4) | `personnes/personnes.service.ts` + 3 tables + `Tenant.settings` | événements tracés, aucun effet de bord, tick R33 | P-01..08 wiring | 13/13 |

Total corpus backend après fusion : 103 (existants) + **50** = **153**. Harnais : `run-rule-tests.sh` patché.
Démo : onglet « Preuves moteur » (16 scénarios rejouables en direct) — Screening, 5ᵉ onglet.

| **R105→R108** (PROPOSÉES) — PMS mandats & adéquation | `pms/pms.service.ts` + Mandate/Position/PmsBreach | drift constaté (R105), pre-trade bloquant (R106), adéquation LSFin liée R104 (R107), registre breaches (R108) | PF-01..06 wiring | 9/9 |

Total corpus backend après fusion : 153 + **9** = **162**. Catalogue UI : 89 règles (bloc 17 ajouté).

| **R109→R112** (PROPOSÉES) — GED documents & preuve | `ged/ged.service.ts` + DocumentVersion | versions append-only + archivage motivé (R109), péremption/complétude par passage (R110), intégrité à la restitution (R111), accès default-deny tracé (R112) | GD-01..06 wiring | 9/9 |

Total corpus backend après fusion : 162 + **9** = **171**. Catalogue UI : 93 règles (bloc 18 ajouté).

| **R113→R116** (RATIFIÉES 19.07) — GED preuve avancée | `ged/ged-avance.service.ts` + AnchorBatch | ancrage Merkle+TSA (R113), QES=version (R114), rétention/hold/destruction certifiée (R115), classification R44 (R116) | GD-07..14 wiring | 9/9 |

**RATIFICATION GLOBALE 19.07.2026 : R104→R116.** Total corpus backend : 171 + **9** = **180**. Catalogue UI : 97 règles, 0 proposée.
