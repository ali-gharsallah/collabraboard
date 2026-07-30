// Source : docs/reference/olive-demo.html 31179–31256 — porté verbatim.
// Référentiel API Olive v1 (endpoints par domaine) + export OpenAPI 3.1.
export const API_SPEC: any[] = [
  ["Authentification", "auth", [
    { m: "POST", p: "/api/v1/auth/token", d: "Émission JWT RS256 (client_credentials pour systèmes, PKCE pour utilisateurs).", scopes: "—", rl: "20/min",
      req: '{ "grant_type":"client_credentials", "client_id":"core-banking", "client_secret":"•••" }',
      res: '{ "access_token":"eyJhbGciOiJSUzI1NiIs…", "token_type":"Bearer", "expires_in":900, "scope":"clients:read kyc:write" }',
      err: [["401", "invalid_client — identifiants inconnus"], ["429", "rate_limited — Retry-After en secondes"]] },
  ]],
  ["Clients", "clients", [
    { m: "GET", p: "/api/v1/clients?desk=GE&risk=HIGH&cursor=…", d: "Liste paginée (cursor). Le cloisonnement du token s'applique côté serveur.", scopes: "clients:read", rl: "600/min",
      req: "—",
      res: '{ "data":[{ "id":"CLI-00016","name":"Suzuki Ltd","risk":"HIGH","desk":"Genève","rm":"S. Marchand","corrLang":"EN" }], "next_cursor":"eyJvZmZzZXQiOjUwfQ" }',
      err: [["403", "forbidden_scope — scope clients:read requis"]] },
    { m: "POST", p: "/api/v1/clients/{id}/events", d: "Change of Circumstances entrant (core banking → Olive) : déclenche revue si matériel.", scopes: "clients:write", rl: "120/min",
      req: '{ "type":"ADDRESS_CHANGE", "payload":{ "country":"AE" }, "occurred_at":"2026-07-10T14:02:00Z", "source":"AVALOQ" }',
      res: '{ "event_id":"EVT-88112", "material":true, "review_created":"AR-2026-0441" }',
      err: [["409", "duplicate_event — même Idempotency-Key déjà traité"], ["422", "unknown_type"]] },
  ]],
  ["KYC", "kyc", [
    { m: "PATCH", p: "/api/v1/kyc/{code}/questions/{qid}", d: "Réponse à une question — droits par rôle, change tracker alimenté.", scopes: "kyc:write", rl: "300/min",
      req: '{ "answer":"Ex-PEP — Ministre adjoint des finances (TR), 2014-2019", "by":"i.vernet" }',
      res: '{ "code":"KYC-2026-0102", "qid":"IDE-QP1", "changed":true, "section_status":"En cours" }',
      err: [["403", "role_forbidden — droit EDIT requis sur la section"], ["423", "locked — dossier verrouillé par un autre intervenant"]] },
    { m: "POST", p: "/api/v1/kyc/{code}/validate", d: "Validation finale four-eyes → événement kyc.approved (outbox).", scopes: "kyc:approve", rl: "60/min",
      req: '{ "decision":"APPROVE", "second_signer":"n.keller" }',
      res: '{ "status":"APPROVED", "visas":[{"role":"CO","who":"I. Vernet"},{"role":"MLRO","who":"N. Keller"}] }',
      err: [["409", "same_signer — four-eyes : signataires identiques"]] },
  ]],
  ["Screening", "screening", [
    { m: "POST", p: "/api/v1/screening/match", d: "Nom → candidats (moteur interne : normalisation, alias, Levenshtein, tokens).", scopes: "screening:run", rl: "1200/min",
      req: '{ "name":"Novatek Energia O.O.O.", "min_score":70 }',
      res: '{ "candidates":[{ "score":93, "entry":{ "name":"NOVATEK PAO","list":"seco","program":"Directive sectorielle 2","ref":"SESAM 43377" }, "via":"Novatek" }] }',
      err: [["422", "empty_name"]] },
    { m: "POST", p: "/api/v1/screening/hits/{key}/decision", d: "Qualification TP/FP — FP à confiance ≥ 80 exige une 2e signature (endpoint /confirm).", scopes: "screening:decide", rl: "120/min",
      req: '{ "decision":"FP", "note":"Homonymie — DOB divergente" }',
      res: '{ "status":"FP_PENDING", "requires_second_signature":true }',
      err: [["403", "role_forbidden"], ["409", "already_decided"]] },
  ]],
  ["Transferts & settlement", "transfers", [
    { m: "POST", p: "/api/v1/transfers", d: "Ordre → 7 contrôles synchrones (sanctions, KYC, MROS, plausibilité, cross-border).", scopes: "transfers:create", rl: "300/min",
      req: '{ "clientId":"CLI-00031", "beneficiary":"Sberbank Rossii PAO", "iban":"AE07…", "destCC":"AE", "amount":250000, "ccy":"CHF", "rail":"SWIFT" }',
      res: '{ "id":"TRF-88291", "verdict":"BLOCK", "checks":[{ "label":"Screening bénéficiaire","level":"KO","note":"100% SBERBANK OF RUSSIA [RUSSIA-EO14024 · OFAC SDN 35213]" }], "settlement_token":null }',
      err: [["402", "insufficient_funds"], ["422", "invalid_iban"]] },
    { m: "POST", p: "/api/v1/settlement/{token}/advance", d: "Avance le cycle CREATED → VALIDATED → SENT → SETTLED (rôle opérations).", scopes: "settlement:ops", rl: "120/min",
      req: '{ "to":"SENT" }', res: '{ "token":"STL-2026-4F09A2C1B7", "status":"SENT", "hash":"0x7c21…", "prev_hash":"0x3aa8…" }',
      err: [["409", "invalid_transition"]] },
  ]],
  ["GED", "ged", [
    { m: "POST", p: "/api/v1/ged/documents", d: "Dépôt multipart — métadonnées obligatoires ; SHA-256 calculé côté serveur ; OCR asynchrone.", scopes: "ged:write", rl: "120/min",
      req: 'multipart/form-data: file=@passeport.pdf; meta={ "clientId":"CLI-00016","code":"01-IDENT","lang":"EN" }',
      res: '{ "id":"DOC-7181", "sha256":"9f2ab8…", "status":"A_VALIDER", "retention_until":"2036-12-31", "ocr":"QUEUED" }',
      err: [["413", "file_too_large — 50 MB max"], ["422", "lang_mismatch — ≠ langue de correspondance (warning bloquant si politique stricte)"]] },
    { m: "POST", p: "/api/v1/ged/documents/{id}/transitions", d: "Workflow documentaire, audité.", scopes: "ged:validate", rl: "120/min",
      req: '{ "action":"VALIDER" }', res: '{ "id":"DOC-7181", "status":"VALIDE", "by":"cf.zuger", "at":"2026-07-11T09:14:22Z" }',
      err: [["409", "invalid_transition — ARCHIVE → VALIDE impossible"]] },
  ]],
  ["Webhooks sortants", "webhooks", [
    { m: "POST", p: "(URL abonnée)", d: "kyc.approved · alert.created · transfer.blocked · document.validated. Signature HMAC-SHA256 dans X-Olive-Signature ; retry exponentiel 1m→24h ; idempotence par event_id.", scopes: "—", rl: "—",
      req: '{ "event_id":"evt_9f21","type":"transfer.blocked","occurred_at":"2026-07-11T08:00:12Z","data":{ "id":"TRF-88291","reason":"sanctions" } }',
      res: 'HTTP 2xx attendu sous 10 s — sinon retry. Vérification : hmac_sha256(secret, raw_body) === header.',
      err: [["—", "au 8e échec : événement parké, alerte intégration"]] },
  ]],
];
export function apiOpenapiYaml(): string {
  const L = ["openapi: 3.1.0", "info:", "  title: Olive Client Lifecycle Intelligence API", "  version: 1.0.0", "servers:", "  - url: https://olive.banque.ch/api/v1", "paths:"];
  API_SPEC.forEach(function (g) {
    g[2].forEach(function (e: any) {
      if (e.p[0] !== "/" && e.p[0] !== "(")
        return;
      const path = e.p.split("?")[0];
      L.push("  " + path + ":");
      L.push("    " + e.m.toLowerCase() + ":");
      L.push("      summary: " + e.d.split("—")[0].split(".")[0].trim());
      L.push("      security: [{ bearerAuth: [] }]");
    });
  });
  L.push("components:", "  securitySchemes:", "    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }");
  return L.join("\n");
}
