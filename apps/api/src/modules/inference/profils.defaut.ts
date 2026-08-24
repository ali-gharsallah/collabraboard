/**
 * P-L7-5 — profils PAR DÉFAUT du ledger (YAML gouverné, chargé PAR REQUÊTE — C8, jamais mis en
 * cache module). Contenu : le parcours démo G4 (Trust + settlor PEP) sur capacités réelles ;
 * les basis citent le miroir P-L7-4. Un tenant fournira à terme SES profils versionnés (R29).
 */
export const PROFILS_DEFAUT_YAML = `
profils:
  - profil: trust-defaut
    entityType: TRUST
    jurisdiction: "*"
    requirements:
      - id: REQ-DOC-T
        kind: document
        basis: "CDB 20 art. 41 · R26 (miroir REQ-R26)"
        severity: bloquant
        params: { document: FORMULAIRE_T }
      - id: REQ-EDD-PEP
        kind: document
        basis: "OBA-FINMA EDD · R32 (miroir REQ-R32)"
        severity: bloquant
        params: { document: RAPPORT_EDD }
        when: "any(relatedPersons, p => p.pep)"
      - id: REQ-CHECK-SCREEN
        kind: check
        basis: "LBA art. 6 · R46/R101 (miroir REQ-R46)"
        severity: bloquant
        params: { source: screening }
      - id: REQ-VISA-CO
        kind: approval
        basis: "OBA-FINMA · R14/R86 (miroir REQ-R14)"
        severity: bloquant
        params: { role: CO, section: IDENTITY }
      - id: REQ-DATA-JUR
        kind: data
        basis: "LBA (identification) · R20 (miroir REQ-R20)"
        severity: non_bloquant
        params: { attribut: jurisdiction }

  # Profil PP — ARBITRAGE PO (Q-INF-1, ratifié dans la conversation de campagne) : le PO a
  # demandé le déblocage de la checklist d'exigences pour les dossiers (PP, *) de la démo.
  # CONTENU EN MIROIR STRICT des REQ- déjà ratifiées ci-dessus (P-L7-4) — aucune base légale
  # nouvelle n'est inventée ici : pièce d'identité (R26), screening (R46/R101), visa CO
  # (R14/R86), juridiction (R20). L'EDD PEP reprend REQ-EDD-PEP à l'identique, conditionné.
  # Jurisdiction « * » : repli toutes juridictions, un tenant précisera les siennes (R29).
  - profil: pp-defaut
    entityType: PP
    jurisdiction: "*"
    requirements:
      - id: REQ-DOC-ID
        kind: document
        basis: "CDB 20 art. 9 (vérification d'identité PP) · R26 (miroir REQ-R26)"
        severity: bloquant
        params: { document: PASSEPORT }
      - id: REQ-EDD-PEP
        kind: document
        basis: "OBA-FINMA EDD · R32 (miroir REQ-R32)"
        severity: bloquant
        params: { document: RAPPORT_EDD }
        when: "any(relatedPersons, p => p.pep)"
      - id: REQ-CHECK-SCREEN
        kind: check
        basis: "LBA art. 6 · R46/R101 (miroir REQ-R46)"
        severity: bloquant
        params: { source: screening }
      - id: REQ-VISA-CO
        kind: approval
        basis: "OBA-FINMA · R14/R86 (miroir REQ-R14)"
        severity: bloquant
        params: { role: CO, section: IDENTITY }
      - id: REQ-DATA-JUR
        kind: data
        basis: "LBA (identification) · R20 (miroir REQ-R20)"
        severity: non_bloquant
        params: { attribut: jurisdiction }
`;
