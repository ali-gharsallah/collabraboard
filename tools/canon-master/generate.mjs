// GÉNÉRATEUR CANON-MASTER (GC-01..) — fonctions PURES d'assemblage du document faisant foi.
// Doctrine (héritée du registrar R331) : AUCUNE I/O ici (run.mjs fournit fichiers, date, hash) ;
// on ne DÉDUIT jamais un mapping (seed ratifié seul) ; on ne CORRIGE jamais une anomalie en
// silence (elle est rapportée en tête) ; le REPO FAIT FOI. Déterministe de bout en bout.
import { extraireMeta } from "../registrar/registrar.mjs";

export { extraireMeta };

// Comparateur STABLE par point de code (jamais localeCompare : dépend de l'ICU/locale de la
// machine → ordre différent en CI vs local → dérive du doc généré). Déterministe partout.
const cmpStable = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── Domaine lisible dérivé du chemin d'un artefact (déterministe, jamais deviné au-delà du nom).
export function domaineDepuisChemin(chemin) {
  const base = String(chemin).split("/").pop().replace(/\.(md|feature)$/i, "");
  return base
    .replace(/^canon-/, "").replace(/^catalogue-(amendement|patch)-/, "").replace(/^spec-/, "")
    .replace(/^R\d+[-_]R?\d*[-_]?/i, "").replace(/-/g, " ").trim() || base;
}

// ── Extrait les numéros de règle EN EXPANDANT les plages (« R331–R334 » = 4 règles, convention
//    O-Live). Le registrar (gelé) ne les expanse pas ; le générateur si, pour un inventaire exact.
//    Borne à 80 pour éviter d'absorber une coïncidence numérique en plage géante.
export function reglesAvecPlages(contenu) {
  const nums = new Set();
  for (const m of contenu.matchAll(/\bR(\d{1,4})\s*[–—-]\s*R?(\d{1,4})\b/g)) {
    const a = Number(m[1]), b = Number(m[2]);
    if (b >= a && b - a <= 80) for (let i = a; i <= b; i++) nums.add(i);
  }
  for (const m of contenu.matchAll(/\bR(\d{1,4})\b/g)) nums.add(Number(m[1]));
  return [...nums].sort((x, y) => x - y);
}

// ── Numéros POSSÉDÉS par un artefact = ceux encodés dans son NOM de fichier (le nom encode le
//    propriétaire canonique, ex. « catalogue-amendement-R117-R120-onboarding.md » possède R117–R120).
//    Sert la détection de collision : une CITATION (R48 dans le corps) n'est pas une possession.
export function plageDuNom(chemin) {
  const base = String(chemin).split("/").pop();
  return reglesAvecPlages(base);
}

// ── Un artefact « porte des scénarios » s'il a des familles XX-NN OU des scénarios Gherkin
//    (fichier .feature, ou lignes « Scenario/Scénario/Example/Exemple »). Évite de flaguer à tort
//    un .feature (qui EST une suite de scénarios) comme « règle sans scénario ».
export function porteScenarios(chemin, contenu, familles) {
  if (familles.length) return true;
  if (/\.feature$/i.test(chemin)) return true;
  return /(^|\n)\s*(Scenario|Scénario|Example|Exemple)\b/i.test(contenu);
}

// ── Indexe chaque artefact : titre, statut, familles (registrar) + règles avec plages expansées
//    (contenu, pour l'inventaire) + numéros possédés (nom de fichier, pour la collision).
export function indexerArtefacts(fichiers) {
  return fichiers
    .map(({ chemin, contenu }) => {
      const meta = extraireMeta(contenu);
      return { chemin, domaine: domaineDepuisChemin(chemin), ...meta,
        regles: reglesAvecPlages(contenu), possede: plageDuNom(chemin),
        porteScenarios: porteScenarios(chemin, contenu, meta.familles) };
    })
    .sort((a, b) => (a.regles[0] ?? 9999) - (b.regles[0] ?? 9999) || cmpStable(a.chemin, b.chemin));
}

// ── Lie chaque famille de scénarios (ex. « LK ») aux suites de test qui la contiennent.
export function lierFamillesSuites(familles, testFichiers) {
  const liens = {};
  for (const fam of familles) {
    const rx = new RegExp(`\\b${fam}-\\d{2}\\b`);
    liens[fam] = testFichiers.filter((t) => rx.test(t.contenu)).map((t) => t.chemin).sort();
  }
  return liens;
}

// ── Parse les paramètres R-Q (table pandoc de questionnaire-R-Q.md) : réf, domaine, question 1-ligne.
export function extraireRQ(contenu) {
  const out = [];
  const rx = /\*\*(R[\dA-Za-z/]+)\*\*\s+([\s\S]*?)(?=\n\s*\*\*R[\dA-Za-z/]+\*\*|\n\s*-{5,}|$)/g;
  let m;
  while ((m = rx.exec(contenu))) {
    const bloc = m[2].replace(/\s+/g, " ").trim();
    // Le domaine = dernier segment en fin de bloc (colonne « Domaine » de la table) ; heuristique bornée.
    const question = bloc.replace(/\s{2,}.*$/, "").slice(0, 200).trim();
    out.push({ ref: m[1], question });
  }
  return out;
}

// ── Lit le SEED de mapping ratifié : SEULE la section 1 (« CONFIRMÉS ») est consommée. Zéro déduction.
export function lireSeed(contenuSeed) {
  const sec1 = contenuSeed.split(/^##\s+2\./m)[0]; // tout ce qui précède la section 2
  const lignes = [...sec1.matchAll(/^\|\s*(R\d+)\s*\|\s*(R\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/gm)];
  return lignes.map((l) => ({ session: l[1], repo: l[2], objet: l[3].trim(), familles: l[4].trim() }));
}

// ── Lit le registre d'exceptions documentées (spec/canon-master-exceptions.md) : motifs de
//    fichiers errata / historiques, numéros réservés, placeholders de test. JUSTIFIE, ne masque pas.
export function lireExceptions(contenu = "") {
  const sect = (kw) => (contenu.match(new RegExp(`^##[^\\n]*${kw}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, "mi"))?.[1] ?? "");
  const motifs = (txt) => [...txt.matchAll(/^-\s*`?([^`\n]+?)`?\s*$/gm)].map((m) => m[1].trim()).filter(Boolean);
  const lignes = (txt) => [...txt.matchAll(/^\|\s*R(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/gm)]
    .map((m) => ({ numero: Number(m[1]), motif: m[2].trim(), ref: m[3].trim() }));
  return { errata: motifs(sect("ERRATA")), historique: motifs(sect("HISTORIQUE")),
    reserves: lignes(sect("RÉSERV")), placeholders: lignes(sect("PLACEHOLDER")) };
}

const _match = (chemin, motifs) => (motifs ?? []).some((p) => String(chemin).includes(p));

// ── Détecte les anomalies (JAMAIS corrigées) : doublons de n° à titres divergents, règle sans
//    scénario, famille sans suite, numéros absents. Les exceptions DOCUMENTÉES sont RECLASSÉES en
//    « connues & justifiées » (errata, docs historiques, réserves, placeholders), jamais masquées.
export function detecterAnomalies(artefacts, liens, exceptions = { errata: [], historique: [], reserves: [], placeholders: [] }) {
  const parNum = {};
  for (const a of artefacts) for (const r of a.regles) (parNum[r] ??= []).push(a);

  // Collision = un numéro POSSÉDÉ (nom de fichier) par ≥2 artefacts à titres divergents. Les
  // citations de corps (R48 partout) ne comptent pas ; un ERRATUM corrige, il ne collisionne pas.
  const parProprio = {};
  for (const a of artefacts) {
    if (_match(a.chemin, exceptions.errata) || _match(a.chemin, exceptions.historique)) continue;
    for (const r of a.possede ?? []) (parProprio[r] ??= []).push(a);
  }
  const doublons = Object.entries(parProprio)
    .filter(([, arts]) => arts.length > 1 && new Set(arts.map((x) => x.titre)).size > 1)
    .map(([n, arts]) => ({ numero: Number(n), sources: arts.map((x) => x.chemin) }))
    .sort((x, y) => x.numero - y.numero);

  const famillesSansSuite = Object.entries(liens).filter(([, s]) => s.length === 0).map(([f]) => f).sort();

  // Règle sans preuve exécutable in-situ — SAUF docs de référence/historiques (inventaires, ADR).
  const reglesSansScenario = artefacts
    .filter((a) => a.regles.length > 0 && !a.porteScenarios && !_match(a.chemin, exceptions.historique))
    .map((a) => ({ chemin: a.chemin, regles: a.regles }));

  // Plafond RÉEL = sommet du plus haut AMAS contigu, robuste aux citations aberrantes isolées
  // (ex. « REGLE:R999 » d'un test négatif) : on redescend tant que le trou vers le n° inférieur
  // est grand (> 8). Plancher = plus haut numéro possédé (nom de fichier ratifié).
  const owned = artefacts.flatMap((a) => a.possede ?? []);
  const nums = Object.keys(parNum).map(Number);
  const presents = new Set(nums);
  const tri = [...nums].sort((a, b) => a - b);
  let i = tri.length - 1;
  while (i > 0 && tri[i] - tri[i - 1] > 8) i--;      // écarte les outliers isolés (gros trou en tête)
  const maxOwned = owned.length ? Math.max(...owned) : 0;
  const plafond = Math.max(tri[i] ?? 0, maxOwned);
  const reserves = new Set((exceptions.reserves ?? []).map((r) => r.numero));
  const placeholders = new Set((exceptions.placeholders ?? []).map((r) => r.numero));
  const numerosAbsents = [];        // trous RÉELS = absents ET non réservés-documentés
  for (let n = 1; n <= plafond; n++) if (!presents.has(n) && !reserves.has(n)) numerosAbsents.push(n);
  // Hors plafond ET non déclaré placeholder de test = vraie coquille ; sinon reclassé « connu ».
  const numerosHorsPlage = [...new Set(nums.filter((n) => n > plafond && !placeholders.has(n)))].sort((a, b) => a - b);

  return { doublons, famillesSansSuite, reglesSansScenario, numerosAbsents, numerosHorsPlage,
    maxRegle: plafond, exceptions };
}

// ── Compare la RÉFÉRENCE DE SESSION au repo via le seed : divergences à SIGNALER (jamais absorber).
export function comparerSession(refContenu, seed, reglesRepo) {
  const reglesSession = [...new Set([...refContenu.matchAll(/\bR(\d{1,4})\b/g)].map((m) => Number(m[1])))];
  const mappe = new Map(seed.map((s) => [Number(s.session.slice(1)), Number(s.repo.slice(1))]));
  const repoSet = new Set(reglesRepo);
  const divergences = [];
  for (const rs of reglesSession) {
    const cible = mappe.has(rs) ? mappe.get(rs) : rs; // hors seed : on teste l'identité, sans l'affirmer
    if (!repoSet.has(cible))
      divergences.push({ session: rs, cible, mappe: mappe.has(rs), motif: mappe.has(rs)
        ? "mappé mais absent du repo" : "ni mappé (seed) ni présent au repo (identité) — mapping non annoté" });
  }
  return { divergences, nSession: reglesSession.length };
}

// ── Extrait une section « # N. TITRE … » d'un contenu markdown (pour reprise VERBATIM, ex. invariants).
export function extraireSection(contenu, numeroSection) {
  // NB : lookahead de fin = « prochain titre # N. » OU vraie fin de chaîne (?![\s\S]) — surtout
  //      PAS « $ », qui sous le flag m matche la fin de CHAQUE ligne et tronquerait à l'en-tête.
  const rx = new RegExp(`^#\\s+${numeroSection}\\.[\\s\\S]*?(?=^#\\s+\\d+\\.|(?![\\s\\S]))`, "m");
  return (contenu.match(rx)?.[0] ?? "").trim();
}

// ═══ ASSEMBLAGE DU DOCUMENT FAISANT FOI ═══════════════════════════════════════════════════════
export function assembler({ dateISO, commit, artefacts, liens, rq, seed, anomalies, comparaison,
  invariantsVerbatim, gelsVerbatim, ecransResume }) {
  const L = [];
  const p = (s = "") => L.push(s);

  p(`<!-- GÉNÉRÉ — NE PAS ÉDITER À LA MAIN. Produit par tools/canon-master/ depuis le repo.`);
  p(`     Toute édition manuelle rend le build CI ROUGE (le généré fait foi). -->`);
  p(`# CANON-MASTER — O-Live (document unique faisant foi, GÉNÉRÉ)`);
  p("");
  p(`> **Généré le ${dateISO} · commit \`${commit}\`.** Ce document se périme visiblement :`);
  p(`> régénéré à chaque merge de PR de ratification (registrar). Le REPO FAIT FOI.`);
  p("");

  // ── RAPPORT D'ANOMALIES (EN TÊTE, jamais corrigé en silence) ──
  const total = anomalies.doublons.length + anomalies.famillesSansSuite.length
    + anomalies.reglesSansScenario.length + anomalies.numerosAbsents.length + (anomalies.numerosHorsPlage ?? []).length;
  p(`## ⚠️ Rapport d'anomalies (à traiter, jamais absorbé)`);
  p("");
  p(total === 0 ? `**Aucune anomalie à traiter.** Les cas connus sont classés & justifiés ci-dessous.` : `**${total} anomalie(s) à traiter.**`);
  p("");
  p(`- **Doublons de numéro à titres divergents** : ${anomalies.doublons.length}`);
  for (const d of anomalies.doublons.slice(0, 40)) p(`  - R${d.numero} — ${d.sources.join(" · ")}`);
  p(`- **Familles de scénarios sans suite de test** : ${anomalies.famillesSansSuite.length}`
    + (anomalies.famillesSansSuite.length ? ` — ${anomalies.famillesSansSuite.join(", ")}` : ""));
  p(`- **Artefacts porteurs de règles sans aucune famille de scénario** : ${anomalies.reglesSansScenario.length}`);
  for (const r of anomalies.reglesSansScenario.slice(0, 30))
    p(`  - ${r.chemin} (R${r.regles.join(", R")})`);
  p(`- **Numéros R absents dans [1..${anomalies.maxRegle}]** (plafond = sommet de l'amas contigu, hors réserves) : ${anomalies.numerosAbsents.length}`
    + (anomalies.numerosAbsents.length ? ` — ${resumerPlages(anomalies.numerosAbsents)}` : ""));
  p(`- **Numéros cités hors plage ratifiée** (coquilles, hors placeholders déclarés) : ${(anomalies.numerosHorsPlage ?? []).length}`
    + ((anomalies.numerosHorsPlage ?? []).length ? ` — ${resumerPlages(anomalies.numerosHorsPlage)}` : ""));
  p("");

  // ── CAS CONNUS & JUSTIFIÉS (registre spec/canon-master-exceptions.md) — tracés, pas masqués ──
  const ex = anomalies.exceptions ?? {};
  p(`### Cas connus & justifiés (\`spec/canon-master-exceptions.md\`)`);
  p("");
  p(`- **Errata** (corrections datées, pas des collisions) : ${(ex.errata ?? []).length ? "motifs `" + ex.errata.join("`, `") + "`" : "—"} — ex. R119 (\`APPROVED\`→\`VALIDATED\`, décision Ali).`);
  p(`- **Docs historiques / référence** (hors couverture familles) : ${(ex.historique ?? []).length ? "motifs `" + ex.historique.join("`, `") + "`" : "—"} — écarte les jetons XX-NN incidents (DB-, MO-).`);
  p(`- **Numéros réservés / non applicables** : ${(ex.reserves ?? []).length}`);
  for (const r of ex.reserves ?? []) p(`  - R${r.numero} — ${r.motif} (réf. ${r.ref})`);
  p(`- **Placeholders de test** : ${(ex.placeholders ?? []).length}`);
  for (const r of ex.placeholders ?? []) p(`  - R${r.numero} — ${r.motif} (réf. ${r.ref})`);
  p("");

  // ── RAPPORT DE DIVERGENCES session ↔ repo ──
  p(`## 🔀 Divergences référence-de-session ↔ repo`);
  p("");
  p(`Comparé : \`spec/REFERENTIEL-SESSION-2026-07-29.md\` (${comparaison.nSession} numéros) via seed`);
  p(`\`spec/mapping-session-repo.md\`. Numéros de session sans contrepartie repo : **${comparaison.divergences.length}**.`);
  p("");
  if (comparaison.divergences.length) {
    p(`| Session | Cible testée | Mappé (seed) ? | Motif |`);
    p(`|---------|--------------|----------------|-------|`);
    for (const d of comparaison.divergences.slice(0, 60))
      p(`| R${d.session} | R${d.cible} | ${d.mappe ? "oui" : "non"} | ${d.motif} |`);
    p("");
  }
  p(`> Cette table ne capte que la présence NUMÉRIQUE. Les divergences **structurelles/sémantiques**`);
  p(`> (ex. On-premise session R332–R334 absent du repo — créneau R335–R339 pris par la robustesse,`);
  p(`> PK réservé **R340+** par décision Ali) sont énumérées dans \`spec/mapping-session-repo.md\` §2/§3.`);
  p("");

  // ── (a) TABLE DE MAPPING session → repo (depuis le seed ratifié) ──
  p(`## a) Mapping session → repo (seed ratifié — \`spec/mapping-session-repo.md\`)`);
  p("");
  p(`| Session | Repo | Objet | Familles |`);
  p(`|---------|------|-------|----------|`);
  for (const s of seed) p(`| ${s.session} | ${s.repo} | ${s.objet} | ${s.familles || "—"} |`);
  p("");

  // ── (b) INVENTAIRE INTÉGRAL par artefact (n° repo, titre, statut, familles, suites) ──
  p(`## b) Inventaire intégral (par artefact ratifié — le repo fait foi)`);
  p("");
  p(`${artefacts.length} artefacts indexés. Colonne « Règles » = numéros POSSÉDÉS (nom de fichier)`);
  p(`quand ils existent, sinon numéros CITÉS dans le corps (⚠ inclut alors les renvois, ex. « gel`);
  p(`R1–R51 »). Statut · familles · suites de test dérivés du contenu et des suites réelles.`);
  p("");
  p(`| Règles (repo) | Domaine / titre | Statut | Familles | Suites de test |`);
  p(`|---------------|-----------------|--------|----------|----------------|`);
  for (const a of artefacts) {
    const suites = [...new Set(a.familles.flatMap((f) => liens[f] ?? []))]
      .map((s) => s.split("/").pop()).slice(0, 4).join(", ") || "—";
    const numeros = (a.possede && a.possede.length) ? a.possede : a.regles;   // possédés d'abord
    p(`| ${resumerPlages(numeros) || "—"} | ${nettoyerCell(a.titre || a.domaine)} | ${a.statut} `
      + `| ${a.familles.join(", ") || "—"} | ${suites} |`);
  }
  p("");

  // ── (c) PARAMÈTRES R-Q ──
  p(`## c) Paramètres tenant R-Q (\`spec/questionnaire-R-Q.md\`)`);
  p("");
  p(`${rq.length} points de variabilité. (Défaut : voir le canon de chaque règle ; le questionnaire`);
  p(`porte la question, pas toujours le défaut — signalé comme tel.)`);
  p("");
  p(`| Réf. | Question (résumée) |`);
  p(`|------|--------------------|`);
  for (const q of rq) p(`| ${q.ref} | ${nettoyerCell(q.question)} |`);
  p("");

  // ── (d) ÉCRANS ──
  p(`## d) Écrans (72/72)`);
  p("");
  p(ecransResume);
  p("");

  // ── (e) GELS & OPTIONS restants (déclencheurs chiffrés) ──
  p(`## e) Gels & options restants (déclencheurs chiffrés)`);
  p("");
  p(gelsVerbatim);
  p("");

  // ── (f) INVARIANTS (repris VERBATIM de la référence de session) ──
  p(`## f) Invariants (repris verbatim — s'appliquent à tout bloc)`);
  p("");
  p(invariantsVerbatim);
  p("");

  return L.join("\n") + "\n";
}

// ── Résume une liste d'entiers en plages « R1–R51, R63, R70 ».
export function resumerPlages(nums) {
  const a = [...new Set(nums)].sort((x, y) => x - y);
  const out = []; let i = 0;
  while (i < a.length) {
    let j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(i === j ? `R${a[i]}` : `R${a[i]}–R${a[j]}`); i = j + 1;
  }
  return out.join(", ");
}

function nettoyerCell(s) { return String(s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim().slice(0, 120); }

// ── Normalise pour la comparaison CI (--check) : retire l'en-tête volatil (date + hash).
export function normaliserPourCheck(md) {
  return md.replace(/^> \*\*Généré le .*?\n/m, "").replace(/commit `[^`]*`/g, "commit `…`");
}
