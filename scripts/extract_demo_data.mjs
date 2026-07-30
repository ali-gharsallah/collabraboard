#!/usr/bin/env node
// Extraction FIDÈLE des données de démonstration depuis la source de vérité
// docs/reference/olive-demo.html vers apps/web/src/fixtures/*.json — jamais retapées
// à la main (spec de parité §5). Le HTML est du React lisible ; les `const X = [...]`
// sont des littéraux : on les isole par équilibrage de crochets (en ignorant ceux
// dans les chaînes) puis on les évalue dans un bac à sable fournissant la palette T
// et les consts déjà extraites. Un échec est signalé, jamais contourné en inventant.
import fs from "node:fs";
import path from "node:path";

const SRC = "docs/reference/olive-demo.html";
const OUT = "apps/web/src/fixtures";
const html = fs.readFileSync(SRC, "utf8");

// Palette T — VERBATIM de la spec §1.1 (charte « Encre & Olive »).
const T = {
  olive900: "#3A4D22", olive700: "#4A6B28", olive600: "#5A7D3A", olive500: "#6B8E3D",
  leaf: "#7BA042", leafLight: "#A4C56B", sage: "#C9D6B0",
  gold: "#C9A227", goldLight: "#E3C75A",
  ink: "#1A2410", inkMid: "#4A5740", inkSoft: "#8A9578", line: "#E8EDE0", lineSoft: "#F2F5EC",
  cream: "#FAFBF7", surface: "#FFFFFF", oliveSoft: "#EEF3E4",
  green: "#3D9970", greenSoft: "#E8F3ED", amber: "#D99A2B", amberSoft: "#FBF2E0",
  red: "#C44536", redSoft: "#FBEAE7", blue: "#3E6B8A", blueSoft: "#E9F0F5",
  violet: "#7E57C2", violetSoft: "#EFE9F7",
};

// Isole le littéral d'un `const NAME = <literal>` par équilibrage {}/[] en ignorant
// les crochets à l'intérieur des chaînes "…" '…' `…`.
function extractLiteral(src, name) {
  const re = new RegExp("\\bconst\\s+" + name + "\\s*=", "g");
  const m = re.exec(src);
  if (!m) throw new Error("introuvable");
  let i = re.lastIndex;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) throw new Error("début inattendu « " + open + " » (littéral non object/array)");
  let depth = 0, inStr = null, esc = false;
  const start = i;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("crochets non équilibrés");
}

// Cibles dans l'ordre de dépendance (une const peut en référencer une extraite avant).
const TARGETS = [
  "I18N", "NAV", "SCREEN_LABEL", "CLIENTS", "KYCS_DATA", "PERSONS_DATA",
  "ACCOUNT_REVIEWS_DATA", "PROSPECTS_DATA", "COC_TYPE_LABELS", "COC_ROLES",
  "COC_CONFIG_DEFAULT", "COC_DATA", "TASK_TYPE_LABELS", "TASK_ASSIGNEES", "TASKS_DATA",
  "DS_STATS", "NAV_MODULE_MAP", "USERS",
];
// NB : OFFBOARDING_CASES / promoted sont calculés au runtime par la coquille (non littéraux)
// → non extractibles ici ; ils seront disponibles au portage de la coquille (§2).

fs.mkdirSync(OUT, { recursive: true });
const scope = { T };
const report = [];
for (const name of TARGETS) {
  try {
    const text = extractLiteral(html, name);
    const args = Object.keys(scope);
    const value = Function(...args, '"use strict"; return (' + text + ");")(...args.map(k => scope[k]));
    scope[name] = value;
    fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify(value, null, 2) + "\n");
    const count = Array.isArray(value) ? value.length : Object.keys(value).length;
    report.push({ name, kind: Array.isArray(value) ? "array" : "object", count, ok: true });
  } catch (e) {
    report.push({ name, kind: "—", count: 0, ok: false, err: String(e.message || e) });
  }
}

// ── Enrichissement du jeu de démonstration (+24 clients, +24 KYC, +12 reviews) ──
// PORT VERBATIM de la boucle déterministe olive-demo.html (13771–13795). Ce n'est PAS de
// l'état runtime : c'est de la donnée de démo générée à l'identique → intégrée aux fixtures
// pour la parité des compteurs (CLIENTS 60→84, KYCS_DATA 81→105, ACCOUNT_REVIEWS +12).
if (scope.CLIENTS && scope.KYCS_DATA && scope.ACCOUNT_REVIEWS_DATA) {
  const segDeAum = (m) => m >= 100 ? "UHNWI" : m >= 10 ? "HNWI" : m >= 1 ? "Affluent" : "Mass Affluent";
  const CCs = [["CH", "Suisse", "🇨🇭"], ["FR", "France", "🇫🇷"], ["DE", "Allemagne", "🇩🇪"], ["AE", "EAU", "🇦🇪"], ["SG", "Singapour", "🇸🇬"], ["GB", "Royaume-Uni", "🇬🇧"]];
  const TPs = [["PP", "Personne physique", "A"], ["SA", "Société opérationnelle (SA)", "K"], ["TRUST", "Trust", "T"], ["HOLD", "Holding", "K"], ["FOND", "Fondation", "S"], ["FO", "Family Office", "K"]];
  const NMs = ["Keller", "Nguyen", "Rossi", "Al-Sabah", "Meunier", "Okafor", "Lindberg", "Costa", "Haddad", "Brunner", "Sato", "Van Dijk"];
  const PRs = ["Anna", "Marc", "Lena", "Omar"];
  const RMs = ["Sophie Marchand", "Ralf Kessler", "Valentina Rossi", "Ali Gharsallah", "Patrick Durand", "Lucie Morel"];
  for (let i = 0; i < 24; i++) {
    const cc = CCs[i % 6], tp = TPs[i % 6];
    const nm = tp[0] === "PP" ? (PRs[i % 4] + " " + NMs[i % 12]) : (NMs[i % 12] + " " + (tp[0] === "SA" ? "SA" : tp[0] === "HOLD" ? "Holding" : tp[0] === "TRUST" ? "Trust" : tp[0] === "FOND" ? "Foundation" : "Family Office"));
    const score = (i * 37 + 11) % 100;
    const risk = score <= 33 ? "LOW" : score <= 66 ? "MEDIUM" : "HIGH";
    const ddl = risk === "LOW" ? "SDD" : risk === "MEDIUM" ? "CDD" : "EDD";
    const cid = "CLI-9" + String(100 + i);
    const rev = (i % 3 === 0) ? 2 : 1;
    const prevCode = "KYC-2024-" + cc[0] + "-" + String(1000 + i) + "-R1";
    const code = "KYC-2026-" + cc[0] + "-" + String(7000 + i) + "-R" + rev;
    const st = ["IN_PROGRESS", "APPROVED", "UNDER_REVIEW", "DRAFT"][i % 4];
    scope.CLIENTS.push({ id: cid, name: nm, initials: nm.slice(0, 2).toUpperCase(), type: tp[0], typeLabel: tp[1], country: cc[1], countryCode: cc[0], countryFlag: cc[2], segment: segDeAum((i % 40) + 1 + (i % 9) / 10), aum: "CHF " + ((i % 40) + 1) + "." + (i % 9) + "M", sector: ["Technologie", "Immobilier", "Santé", "Energie"][i % 4], rm: RMs[i % 6], score, risk, ddl, uboId: "PER-9" + i, uboName: NMs[(i + 3) % 12] + " Holding", cdbForm: tp[2], onboardingDate: "2024-0" + ((i % 9) + 1) + "-15", kycCodes: (rev === 2 ? [prevCode, code] : [code]), currentKycStatus: st, tags: (risk === "HIGH" ? ["EDD"] : []).concat(i % 7 === 0 ? ["PEP-Hit"] : []).concat(rev === 2 ? ["R2"] : []), pep: i % 7 === 0 });
    scope.KYCS_DATA.push({ id: "KYCF-9" + i, code, clientId: cid, clientName: nm, structCode: tp[0], revision: rev, previousKycId: (rev === 2 ? prevCode : null), workflow: ddl, riskScore: score, risk, status: st, wfPhase: ["SAISIE", "COMPLIANCE", "AML", "COMITE"][i % 4], rm: RMs[i % 6], co: "Marc Dubois", screening: { ofac: "CLEAR", seco: (i % 11 === 0 ? "HIT" : "CLEAR"), pep: (i % 7 === 0 ? "HIT" : "CLEAR"), adverse: "CLEAR" }, createdAt: "2026-0" + ((i % 6) + 1) + "-10" });
    if (i % 2 === 0)
      scope.ACCOUNT_REVIEWS_DATA.push({ id: "AR-" + cid + "-01", clientId: cid, kycRef: code, trigger: ["Révision annuelle programmée", "Alerte AML déclenchée", "Hit PEP détecté", "Expiration des documents"][i % 4], status: ["PENDING", "IN_PROGRESS", "OVERDUE"][i % 3], reviewDate: "2026-0" + ((i % 6) + 1) + "-2" + (i % 8), nextReviewDate: null, reviewer: ["Marc Dubois (CO)", "Isabelle Vernet (CO Senior)", "Sarah Zimmermann (CO)"][i % 3], rm: RMs[i % 6], outcome: null });
  }
  for (const n of ["CLIENTS", "KYCS_DATA", "ACCOUNT_REVIEWS_DATA"]) {
    fs.writeFileSync(path.join(OUT, n + ".json"), JSON.stringify(scope[n], null, 2) + "\n");
    const r = report.find(x => x.name === n); if (r) r.count = scope[n].length;
  }
}

// ── Rapport de comptages (le test de socle compare ces nombres à la référence) ──
const w = (s, n) => String(s).padEnd(n);
console.log("\n  FIXTURE            TYPE     COMPTE");
console.log("  " + "-".repeat(42));
for (const r of report) {
  console.log("  " + w(r.name, 20) + w(r.kind, 8) + (r.ok ? r.count : "ÉCHEC : " + r.err));
}

// Vérifications de socle (spec §5 : 60 clients ; types CDB 20 complets).
if (scope.CLIENTS) {
  const types = [...new Set(scope.CLIENTS.map(c => c.type))].sort();
  console.log("\n  CLIENTS = " + scope.CLIENTS.length + " (attendu 84 = 60 littéral + 24 générés)  ·  types CDB 20 = [" + types.join(", ") + "]");
  const byRisk = scope.CLIENTS.reduce((a, c) => (a[c.risk] = (a[c.risk] || 0) + 1, a), {});
  console.log("  répartition risque : " + JSON.stringify(byRisk));
}
if (scope.USERS) {
  const roles = [...new Set(scope.USERS.map(u => u.role))].sort();
  console.log("  USERS = " + scope.USERS.length + "  ·  rôles = [" + roles.join(", ") + "]");
}
if (scope.NAV) {
  const groups = scope.NAV.filter(n => n.children).length;
  const items = scope.NAV.reduce((a, n) => a + (n.children ? n.children.length : 1), 0);
  console.log("  NAV = " + scope.NAV.length + " entrées de 1er niveau · " + groups + " groupes · ~" + items + " items");
}
console.log("");
const fail = report.filter(r => !r.ok);
process.exit(fail.length ? 1 : 0);
