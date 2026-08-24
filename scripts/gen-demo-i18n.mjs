#!/usr/bin/env node
/**
 * GÉNÉRATEUR i18n de la MAQUETTE (SPEC-I18N §1) — injecte un runtime de traduction DOM dans
 * demo/olive-demo.html. SOURCE UNIQUE : les dictionnaires du front React (apps/web/src/lib/i18n.ts
 * EN/DE/IT + apps/web/src/lib/i18n-ar.ts AR + data/i18n-aml-gap.json chrome) — AUCUNE traduction
 * n'est réinventée ici, la maquette REUTILISE le travail déjà fait/relu du produit.
 *
 * Périmètre : CHROME (nav base + sous-nav éditeur + écrans + familles/UI AML gap). Sélecteur
 * FR/EN/DE/AR (l'AR remplace l'IT dans le sélecteur d'INTERFACE de la démo, cf. §1 ; les données
 * métier restent intouchées). RTL auto en AR (dir=rtl), restauration FR sans perte (__frSrc),
 * repli FR pour toute chaîne non couverte (« jamais un trou »). Injection IDEMPOTENTE (marqueurs).
 *
 * L'AR du chrome est une PASSE MACHINE (MSA, SPEC-I18N §2) en attente de relecture pro avant BAT.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const I18N_TS = path.join(ROOT, "apps/web/src/lib/i18n.ts");
const I18N_AR = path.join(ROOT, "apps/web/src/lib/i18n-ar.ts");
const AMLGAP_JSON = path.join(ROOT, "data/i18n-aml-gap.json");
const DEMO = path.join(ROOT, "demo/olive-demo.html");
const START = "<!-- OLIVE-I18N:START (généré par scripts/gen-demo-i18n.mjs — NE PAS ÉDITER À LA MAIN) -->";
const END = "<!-- OLIVE-I18N:END -->";

// Extrait un littéral d'objet JS `const NAME ... = { ... }` (comptage d'accolades, chaînes ignorées).
function extractObject(src, name) {
  const decl = new RegExp(`const\\s+${name}\\b[^=]*=\\s*`).exec(src);
  if (!decl) throw new Error(`const ${name} introuvable`);
  let i = src.indexOf("{", decl.index + decl[0].length);
  const start = i;
  let depth = 0, q = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (esc) { esc = false; continue; }
    if (q) { if (c === "\\") esc = true; else if (c === q) q = null; continue; }
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); if (i < 0) break; continue; }   // commentaire ligne
    if (c === "/" && n === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }              // commentaire bloc
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
  }
  const body = src.slice(start, i);   // JS valide (commentaires inclus) — Function les tolère nativement
  // eslint-disable-next-line no-new-func
  return Function(`"use strict";return (${body});`)();
}

const tsSrc = fs.readFileSync(I18N_TS, "utf8");
const arSrc = fs.readFileSync(I18N_AR, "utf8");
const amlgap = JSON.parse(fs.readFileSync(AMLGAP_JSON, "utf8"));

// EN/DE/IT : DICT(base nav) ⊕ EXT(sous-nav éditeur) ⊕ ECRANS(contenus) ⊕ AML gap (familles+UI).
const DICT = extractObject(tsSrc, "DICT");
const EXT = extractObject(tsSrc, "EXT");
const ECRANS = extractObject(tsSrc, "ECRANS");
// AR : pack de langue paresseux (nav ⊕ éditeur ⊕ écrans) ⊕ AML gap AR.
const NAV_AR = extractObject(arSrc, "NAV_AR");
const EXT_AR = extractObject(arSrc, "EXT_AR");
const ECRANS_AR = extractObject(arSrc, "ECRANS_AR");

const amlFam = (lg) => Object.fromEntries(Object.entries(amlgap.familles).filter(([, v]) => v[lg]).map(([k, v]) => [k, v[lg]]));
const amlUi = (lg) => Object.fromEntries(Object.entries(amlgap.ui).filter(([, v]) => v[lg]).map(([k, v]) => [k, v[lg]]));

const dict = {
  EN: { ...DICT.EN, ...EXT.EN, ...ECRANS.EN, ...amlFam("en"), ...amlUi("en") },
  DE: { ...DICT.DE, ...EXT.DE, ...ECRANS.DE, ...amlFam("de"), ...amlUi("de") },
  AR: { ...NAV_AR, ...EXT_AR, ...ECRANS_AR, ...amlFam("ar"), ...amlUi("ar") },
};
const counts = Object.fromEntries(Object.entries(dict).map(([l, d]) => [l, Object.keys(d).length]));
console.log("dictionnaire démo :", JSON.stringify(counts), "clés FR-source réutilisées du front");

// ── Runtime injecté (vanilla, IIFE) ── traducteur DOM par dictionnaire + RTL + sélecteur FR/EN/DE/AR.
const runtime = `${START}
<script>
(function () {
  "use strict";
  var DICT = ${JSON.stringify(dict)};
  var LANGS = ["FR", "EN", "DE", "AR"];               // AR remplace l'IT dans le sélecteur d'UI (SPEC-I18N §1)
  var KEY = "OLIVE_LANG_DEMO";
  function tr(s, lang) { if (lang === "FR") return s; var d = DICT[lang] || {}; return Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s; }
  function walkText(root, lang) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.nodeName; if (t === "SCRIPT" || t === "STYLE" || t === "TEXTAREA") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("#olive-lang-bar")) return NodeFilter.FILTER_REJECT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var n; while ((n = w.nextNode())) {
      if (n.__frSrc === undefined) n.__frSrc = n.nodeValue;       // mémorise le FR une fois (restauration sans perte)
      var key = n.__frSrc.trim(), lead = n.__frSrc.match(/^\\s*/)[0], tail = n.__frSrc.match(/\\s*$/)[0];
      n.nodeValue = lead + tr(key, lang) + tail;
    }
  }
  function walkAttrs(root, lang) {
    var els = root.querySelectorAll ? root.querySelectorAll("[placeholder],[title]") : [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i]; if (el.closest && el.closest("#olive-lang-bar")) continue;
      ["placeholder", "title"].forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        var store = "__fr_" + a; if (el[store] === undefined) el[store] = el.getAttribute(a);
        el.setAttribute(a, tr(el[store].trim(), lang));
      });
    }
  }
  function apply(lang) {
    walkText(document.body, lang); walkAttrs(document.body, lang);
    try { document.documentElement.dir = (lang === "AR") ? "rtl" : "ltr"; document.documentElement.lang = lang.toLowerCase(); } catch (e) {}
  }
  var current = "FR";
  function setLang(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "FR";
    current = lang; try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(lang);
    var bar = document.getElementById("olive-lang-bar");
    if (bar) for (var i = 0; i < bar.children.length; i++) { var b = bar.children[i]; b.setAttribute("aria-pressed", String(b.textContent === lang)); }
  }
  function buildBar() {
    if (document.getElementById("olive-lang-bar")) return;
    var bar = document.createElement("div"); bar.id = "olive-lang-bar";
    bar.setAttribute("dir", "ltr");
    bar.style.cssText = "position:fixed;top:8px;right:8px;z-index:99999;display:flex;gap:3px;background:#fff;border:1px solid #E7EBDD;border-radius:8px;padding:3px;box-shadow:0 1px 4px rgba(0,0,0,.08);font-family:system-ui,sans-serif";
    LANGS.forEach(function (l) {
      var b = document.createElement("button"); b.textContent = l; b.setAttribute("aria-label", "langue " + l);
      b.style.cssText = "font-size:11px;padding:3px 8px;border:0;border-radius:5px;cursor:pointer;background:transparent;color:#5b6650;font-weight:600";
      b.onclick = function () { setLang(l); };
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
  }
  // Réapplique la langue courante au contenu injecté dynamiquement (MutationObserver).
  function observe() {
    var mo = new MutationObserver(function (muts) {
      if (current === "FR") return;
      for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
        var node = muts[i].addedNodes[j];
        if (node.nodeType === 1) { walkText(node, current); walkAttrs(node, current); }
        else if (node.nodeType === 3 && node.parentNode && !(node.parentNode.closest && node.parentNode.closest("#olive-lang-bar"))) walkText(node.parentNode, current);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function boot() {
    buildBar(); observe();
    var saved = "FR"; try { saved = localStorage.getItem(KEY) || "FR"; } catch (e) {}
    setLang(saved);
  }
  window.__oliveI18n = { tr: tr, setLang: setLang, dict: DICT, langs: LANGS };  // exposé pour les tests
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
</script>
${END}`;

let html = fs.readFileSync(DEMO, "utf8");
const s = html.indexOf(START), e = html.indexOf(END);
if (s >= 0 && e > s) {
  html = html.slice(0, s) + runtime + html.slice(e + END.length);   // idempotent : remplace le bloc
} else {
  const bodyClose = html.lastIndexOf("</body>");
  if (bodyClose < 0) throw new Error("</body> introuvable dans la maquette");
  html = html.slice(0, bodyClose) + runtime + "\n" + html.slice(bodyClose);
}
fs.writeFileSync(DEMO, html);
console.log("runtime i18n injecté dans demo/olive-demo.html (sélecteur FR/EN/DE/AR, RTL en AR)");
