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
  "COC_CONFIG_DEFAULT", "DS_STATS", "NAV_MODULE_MAP", "USERS",
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
  console.log("\n  CLIENTS = " + scope.CLIENTS.length + " (attendu 60)  ·  types CDB 20 = [" + types.join(", ") + "]");
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
