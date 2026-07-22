#!/usr/bin/env bash
# Tests des règles moteur (R84/85/86, R13/R52, R2/R4) + câblage service + IAM + corpus.
# Harnais autonome, sans base.
# PATCH 2026-07-19 : + 5 corpus de session (GR R104 · câblage screening R100→R103 ·
# JV vérif JWKS · SB chiffrement mfa_secret · P câblage personnes R30→R36).
# Ordre d'exécution prouvé en une passe : 50/50 verts (voir docs/olive-session-handoff).
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
export MFA_ENC_KEY="${MFA_ENC_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
TSC="${TSC:-npx tsc}"
$TSC src/modules/kyc/rules/*.ts src/modules/kyc/kyc.service.ts \
  src/modules/auth/*.ts src/common/tenant.middleware.ts src/common/tenant.middleware.spec.ts \
  src/common/prisma.service.ts src/common/audit.service.ts src/common/secret-box.ts \
  src/modules/kyc/risk-engine.ts src/modules/kyc/kyc.templates.ts \
  src/modules/screening/rules/*.ts src/modules/screening/*.spec.ts src/modules/screening/screening.service.ts \
  src/modules/events/golden-record.projector.ts src/modules/events/golden-record.projector.spec.ts \
  src/modules/personnes/personnes.service.ts src/modules/personnes/personnes.wiring.spec.ts \
  src/modules/pms/pms.service.ts src/modules/pms/pms.wiring.spec.ts \
  src/modules/ged/ged.service.ts src/modules/ged/ged.controller.ts src/modules/ged/ged.wiring.spec.ts \
  src/modules/ged/ged-consultation.service.ts src/modules/ged/ged-consultation.wiring.spec.ts \
  src/modules/ged/ged-avance.service.ts src/modules/ged/ged-avance.wiring.spec.ts \
  src/modules/onboarding/onboarding.service.ts src/modules/onboarding/onboarding.wiring.spec.ts \
  src/modules/ia/prerevue.service.ts src/modules/ia/prerevue.wiring.spec.ts \
  src/modules/parametres/parametres.service.ts src/modules/parametres/parametres.wiring.spec.ts \
  src/modules/mros/mros.service.ts src/modules/mros/mros.wiring.spec.ts \
  src/modules/riskcases/risk-case.service.ts src/modules/riskcases/risk-case.wiring.spec.ts \
  src/modules/ged/ged-ingestion.service.ts src/modules/ged/ged-ingestion.wiring.spec.ts \
  src/modules/transactions/transaction-gate.service.ts src/modules/transactions/transaction-gate.wiring.spec.ts \
  src/modules/coffre/coffre.service.ts src/modules/coffre/coffre.wiring.spec.ts \
  src/modules/coffre/ged-externe.adapter.ts src/modules/coffre/storage-resolver.service.ts src/modules/coffre/ged-externe.wiring.spec.ts \
  src/modules/coffre/webdav-storage.adapter.ts src/modules/coffre/webdav-storage.wiring.spec.ts \
  src/adapters/claude-ia.adapter.ts src/modules/crm/claude-ia.wiring.spec.ts \
  src/modules/recherche/recherche.service.ts src/modules/recherche/recherche.wiring.spec.ts \
  src/modules/personnes/personne-lien.service.ts src/modules/personnes/personne-lien.wiring.spec.ts \
  src/modules/annotations/annotation.service.ts src/modules/annotations/annotation.wiring.spec.ts \
  src/modules/chaines/chaines.service.ts src/modules/chaines/chaines.wiring.spec.ts \
  src/modules/ia/ia-ged.service.ts src/modules/ia/ia-ged.wiring.spec.ts \
  src/modules/ged/vues.service.ts src/modules/ged/vues.wiring.spec.ts \
  src/modules/corebanking/core-sync.service.ts src/modules/corebanking/core-sync.wiring.spec.ts \
  src/modules/ged/retention.wiring.spec.ts \
  src/modules/workflow/workflow-def.service.ts src/modules/workflow/workflow-def.wiring.spec.ts \
  src/modules/workflow/kyc-workflow.chaine.ts src/modules/workflow/kyc-workflow.chaine.wiring.spec.ts \
  src/modules/ocr/ocr-extraction.service.ts src/modules/ocr/ocr-extraction.wiring.spec.ts \
  src/modules/license/vendor-license.service.ts src/modules/license/vendor-license.wiring.spec.ts \
  src/modules/workload/workload.service.ts src/modules/workload/workload.wiring.spec.ts \
  src/modules/crm/crm.service.ts src/modules/crm/crm.wiring.spec.ts \
  src/modules/aml/aml-scoring.engine.ts src/modules/aml/aml.service.ts src/modules/aml/aml-scoring.wiring.spec.ts \
  src/modules/islamic/islamic-screening.engine.ts src/modules/islamic/islamic.service.ts src/modules/islamic/islamic-screening.wiring.spec.ts \
  --target es2020 --module commonjs --moduleResolution node \
  --experimentalDecorators --emitDecoratorMetadata --skipLibCheck \
  --noEmitOnError false --strict false --baseUrl . --outDir "$OUT" 2>/dev/null || true
  # NB toolchain épinglée TS 5.9.3 : fichiers explicites ⇒ tsconfig.json ignoré silencieusement
  # (pas de TS5112 sur 5.9.x) et l'émission se fait normalement. On a retiré deux flags devenus
  # FATAUX sur cette version : « --ignoreDeprecations 6.0 » (TS5103, valeur invalide) et
  # « --ignoreConfig » (TS5023, option inconnue avant TS 6.0) — tous deux avortaient la compile.
export NODE_PATH=./node_modules
run(){ node "$(find "$OUT" -name "$1" | head -1)"; }
echo "── Domaine ──"; run rules.spec.js; run four-eyes.spec.js; run named-validator.spec.js
echo "── Service (câblage) ──"; run kyc-service.spec.js
echo "── IAM (auth) ──"; run auth.spec.js
echo "── IAM (TOTP + RBAC) ──"; run totp.spec.js; run roles.guard.spec.js
echo "── IAM (SSO/JWKS/MFA/Admin) ──"; run oidc.spec.js; run key-store.spec.js; run mfa.spec.js; run users.spec.js
echo "── IAM (middleware JWT/JWKS) ──"; run tenant.middleware.spec.js
echo "── Corpus I-01..I-05 (R89→R92) ──"; run iam-scenarios.spec.js
echo "── Corpus SC-01..SC-04 (R100→R103) ──"; run screening-scenarios.spec.js
echo "── Corpus GR-01..GR-04 (R104 golden record) ──"; run golden-record.projector.spec.js
echo "── Câblage screening persistant (R100→R103) ──"; run screening.wiring.spec.js
echo "── Vérif JWKS IdP (JV-01..07) ──"; run jwks-verifier.spec.js
echo "── Chiffrement mfa_secret (SB-01..06) ──"; run secret-box.spec.js
echo "── Câblage personnes (P-01..08, R30→R36) ──"; run personnes.wiring.spec.js
echo "── Câblage PMS (PF-01..06, R105→R108) ──"; run pms.wiring.spec.js
echo "── Câblage GED (GD-01..06, R109→R112) ──"; run ged.wiring.spec.js
echo "── Câblage Surface consultation GED (GS-01..05, R110/R112/R125/R145) ──"; run ged-consultation.wiring.spec.js
echo "── Câblage GED avancée (GD-07..14, R113→R116) ──"; run ged-avance.wiring.spec.js
echo "── Câblage Onboarding (OB-01..06, R117→R120) ──"; run onboarding.wiring.spec.js
echo "── Câblage pré-revue IA (AG-01..06, R121→R124) ──"; run prerevue.wiring.spec.js
echo "── Câblage paramètres R-Q (RQ-01..06, R125→R128) ──"; run parametres.wiring.spec.js
echo "── Câblage MROS (MR-01..06, R129→R132) ──"; run mros.wiring.spec.js
echo "── Câblage Risk cases (RK-01..06, R133→R136) ──"; run risk-case.wiring.spec.js
echo "── Câblage Ingestion GED (IG-01..06, R137→R139) ──"; run ged-ingestion.wiring.spec.js
echo "── Câblage Portail TX (TX-01..06, R140→R143) ──"; run transaction-gate.wiring.spec.js
echo "── Câblage Coffre (CV-01..06, R144→R147) ──"; run coffre.wiring.spec.js
echo "── Câblage Capacité d'équipe (WK-01..05, R183→R185) ──"; run workload.wiring.spec.js
echo "── Câblage CRM Relation (CR-01..05, R186→R188) ──"; run crm.wiring.spec.js
echo "── Câblage Port GED externe (GX-01..05, R180→R182) ──"; run ged-externe.wiring.spec.js
echo "── Câblage Adaptateur WebDAV (WD-01..05, R180→R182/R145) ──"; run webdav-storage.wiring.spec.js
echo "── Câblage Adaptateur Claude (CL-01..05, R44/R138/R188) ──"; run claude-ia.wiring.spec.js
echo "── Câblage Recherche (RS-01..06, R148→R151) ──"; run recherche.wiring.spec.js
echo "── Câblage Personnes liées (PL-01..04, R152→R155) ──"; run personne-lien.wiring.spec.js
echo "── Câblage Annotations (AN-01..06, R156→R159) ──"; run annotation.wiring.spec.js
echo "── Câblage Chaînes (CB-01..06, clauses R144/R148/R151) ──"; run chaines.wiring.spec.js
echo "── Câblage IA dossier (AI-01..06, R160→R163) ──"; run ia-ged.wiring.spec.js
echo "── Câblage Dossiers-vues (VU-01..05, R164→R166) ──"; run vues.wiring.spec.js
echo "── Câblage Core banking (SY-01..05, R167→R169) ──"; run core-sync.wiring.spec.js
echo "── Rétention au classement (RN-01..04, R170) ──"; run retention.wiring.spec.js
echo "── Câblage Workflow gouverné (WF-01..05, R171→R173) ──"; run workflow-def.wiring.spec.js
echo "── Câblage KYC↔Workflow (KW-01..05, clause R172) ──"; run kyc-workflow.chaine.wiring.spec.js
echo "── Câblage OCR typé (OC-01..06, R174→R176) ──"; run ocr-extraction.wiring.spec.js
echo "── Câblage Licence vendor (LC-01..05, R177→R179) ──"; run vendor-license.wiring.spec.js
echo "── Câblage Surveillance AML (A-69..A-86, R189→R206) ──"; run aml-scoring.wiring.spec.js
echo "── Câblage Couche Shariah (IS-01..IS-15, R207→R221) ──"; run islamic-screening.wiring.spec.js
