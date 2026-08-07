import { CaseFacts, PersonneLiee } from "./case-facts";

/**
 * P-L7-2 — DSL D'ACTIVATION SÛR des activation_rules (champ `when`).
 * AST RESTREINT compilé par descente récursive — AUCUN eval/exec/Function (invariant 8 de
 * CLAUDE.md), aucune résolution dynamique de propriété : chaque chemin est vérifié contre la
 * WHITELIST du Protocol CaseFacts À LA COMPILATION, et une expression invalide est rejetée AU
 * CHARGEMENT du profil (jamais au premier dossier qui passe).
 *
 * Grammaire (tout le reste est REFUSÉ) :
 *   expr    := ou ; ou := et ("or" et)* ; et := non ("and" non)* ; non := "not" non | cmp
 *   cmp     := val (("=="|"!=") val)? | val "in" liste | val "in" collection
 *   val     := "(" expr ")" | littéral | attribut | var | var "." prop | quantif
 *   quantif := ("any"|"all") "(" collection "," var "=>" expr ")"
 *   littéral := 'chaîne' | true | false ; liste := "(" littéral ("," littéral)* ")"
 * Attributs scalaires : entityType, jurisdiction, riskLevel.
 * Collections : relatedPersons (props de var : role, pep, sanctioned), documents, checks
 * (var = la valeur elle-même). Sémantique des quantificateurs sur liste VIDE : any → false,
 * all → true (vérité vide) — documentée et testée.
 */

export class ExpressionInvalide extends Error {
  constructor(public raison: string, public position: number, public expression: string) {
    super(`P-L7-2 : expression d'activation INVALIDE (col ${position}) — ${raison} · « ${expression} »`);
  }
}

const SCALAIRES = new Set(["entityType", "jurisdiction", "riskLevel"]);
const COLLECTIONS: Record<string, ReadonlySet<string> | null> = {
  relatedPersons: new Set(["role", "pep", "sanctioned"]),   // props whitelistées de la variable
  documents: null,                                          // null = la variable EST la valeur
  checks: null,
};

// ── AST (types fermés — le compilateur ne produit RIEN d'autre) ──
type Noeud =
  | { t: "et" | "ou"; g: Noeud; d: Noeud }
  | { t: "non"; e: Noeud }
  | { t: "cmp"; op: "==" | "!="; g: Valeur; d: Valeur }
  | { t: "in"; v: Valeur; liste: (string | boolean)[] }
  | { t: "inColl"; v: Valeur; coll: string }
  | { t: "quantif"; q: "any" | "all"; coll: string; variable: string; corps: Noeud }
  | { t: "val"; v: Valeur };                                // valeur booléenne utilisée nue (ex. p.pep)
type Valeur =
  | { t: "lit"; valeur: string | boolean }
  | { t: "attr"; nom: string }
  | { t: "var"; nom: string }
  | { t: "prop"; variable: string; prop: string };

type Token = { k: string; v: string; pos: number };
const MOTS = new Set(["and", "or", "not", "in", "any", "all", "true", "false"]);

function lexer(src: string): Token[] {
  const ts: Token[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "(" || c === ")" || c === "," || c === ".") { ts.push({ k: c, v: c, pos: i }); i++; continue; }
    if (src.startsWith("==", i) || src.startsWith("!=", i)) { ts.push({ k: "op", v: src.slice(i, i + 2), pos: i }); i += 2; continue; }
    if (src.startsWith("=>", i)) { ts.push({ k: "=>", v: "=>", pos: i }); i += 2; continue; }
    if (c === "'") {
      const fin = src.indexOf("'", i + 1);
      if (fin < 0) throw new ExpressionInvalide("chaîne non fermée", i, src);
      ts.push({ k: "str", v: src.slice(i + 1, fin), pos: i }); i = fin + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const mot = src.slice(i, j);
      ts.push({ k: MOTS.has(mot) ? mot : "ident", v: mot, pos: i }); i = j; continue;
    }
    throw new ExpressionInvalide(`caractère interdit « ${c} »`, i, src);   // ; ` $ { } [ ] + … : REFUSÉS
  }
  return ts;
}

/** Compile (et VALIDE) une expression `when`. Toute erreur = ExpressionInvalide, au chargement. */
export function compilerExpression(src: string): Noeud {
  if (!src?.trim()) throw new ExpressionInvalide("expression vide", 0, src ?? "");
  const ts = lexer(src); let i = 0;
  const courant = () => ts[i];
  const erreur = (raison: string): never => {
    throw new ExpressionInvalide(raison, courant()?.pos ?? src.length, src); };
  const manger = (k: string): Token => (courant()?.k === k ? ts[i++] : erreur(`« ${k} » attendu`));

  // portées des variables de quantificateur : nom → collection
  const portees: Map<string, string> = new Map();

  function pExpr(): Noeud { return pOu(); }
  function pOu(): Noeud { let g = pEt();
    while (courant()?.k === "or") { i++; g = { t: "ou", g, d: pEt() }; } return g; }
  function pEt(): Noeud { let g = pNon();
    while (courant()?.k === "and") { i++; g = { t: "et", g, d: pNon() }; } return g; }
  function pNon(): Noeud {
    if (courant()?.k === "not") { i++; return { t: "non", e: pNon() }; }
    return pCmp(); }

  function pCmp(): Noeud {
    if (courant()?.k === "any" || courant()?.k === "all") return pQuantif();
    if (courant()?.k === "(") {                               // parenthèse : sous-expression booléenne
      const sauvegarde = i; i++;
      const e = pExpr(); manger(")");
      // une parenthèse peut aussi être une valeur ? Non : les littéraux/attrs nus passent par pVal ci-dessous.
      void sauvegarde; return e;
    }
    const g = pVal();
    const t = courant();
    if (t?.k === "op") { i++; return { t: "cmp", op: t.v as "==" | "!=", g, d: pVal() }; }
    if (t?.k === "in") {
      i++;
      if (courant()?.k === "(") {                             // in (littéraux…)
        i++; const liste: (string | boolean)[] = [pLit()];
        while (courant()?.k === ",") { i++; liste.push(pLit()); }
        manger(")"); return { t: "in", v: g, liste };
      }
      if (courant()?.k === "ident") {                         // in collection
        const c = ts[i++];
        if (!(c.v in COLLECTIONS)) erreur(`« ${c.v} » n'est pas une collection whitelistée`);
        if (COLLECTIONS[c.v] !== null) erreur(`« in ${c.v} » : réservé aux collections de valeurs (documents, checks)`);
        return { t: "inColl", v: g, coll: c.v };
      }
      return erreur("liste (…) ou collection attendue après « in »");
    }
    // valeur booléenne nue : autorisée SEULEMENT pour une prop booléenne de variable (ex. p.pep)
    if (g.t === "prop" && (g.prop === "pep" || g.prop === "sanctioned")) return { t: "val", v: g };
    return erreur("comparaison attendue (==, !=, in) — une valeur nue n'est pas un booléen");
  }

  function pQuantif(): Noeud {
    const q = ts[i++].v as "any" | "all";
    manger("(");
    const coll = courant()?.k === "ident" ? ts[i++].v : erreur("collection attendue") as never;
    if (!(coll in COLLECTIONS)) erreur(`« ${coll} » n'est pas une collection whitelistée`);
    manger(",");
    const variable = courant()?.k === "ident" ? ts[i++].v : erreur("variable attendue") as never;
    if (SCALAIRES.has(variable) || variable in COLLECTIONS || MOTS.has(variable))
      erreur(`« ${variable} » masque un attribut/mot réservé`);
    if (portees.has(variable)) erreur(`variable « ${variable} » déjà liée`);
    manger("=>");
    portees.set(variable, coll);
    const corps = pExpr();
    portees.delete(variable);
    manger(")");
    return { t: "quantif", q, coll, variable, corps };
  }

  function pLit(): string | boolean {
    const t = courant();
    if (t?.k === "str") { i++; return t.v; }
    if (t?.k === "true" || t?.k === "false") { i++; return t.k === "true"; }
    return erreur("littéral attendu ('chaîne', true, false)");
  }

  function pVal(): Valeur {
    const t = courant();
    if (t?.k === "str" || t?.k === "true" || t?.k === "false") return { t: "lit", valeur: pLit() };
    if (t?.k === "ident") {
      i++;
      if (courant()?.k === ".") {                             // var.prop — whitelist de la collection
        i++;
        const coll = portees.get(t.v);
        if (!coll) return erreur(`« ${t.v} » n'est pas une variable liée (any/all)`);
        const props = COLLECTIONS[coll];
        if (!props) return erreur(`« ${t.v} » est une valeur simple (${coll}) — pas de propriété`);
        const p = courant()?.k === "ident" ? ts[i++].v : erreur("propriété attendue") as never;
        if (!props.has(p)) return erreur(`propriété « ${p} » hors whitelist de ${coll} (${[...props].join(", ")})`);
        return { t: "prop", variable: t.v, prop: p };
      }
      if (portees.has(t.v)) return { t: "var", nom: t.v };    // la variable elle-même (documents/checks)
      if (SCALAIRES.has(t.v)) return { t: "attr", nom: t.v };
      return erreur(`attribut « ${t.v} » hors whitelist CaseFacts (${[...SCALAIRES].join(", ")}, collections)`);
    }
    return erreur("valeur attendue");
  }

  const ast = pExpr();
  if (i < ts.length) erreur(`séquence inattendue « ${courant().v} » après la fin de l'expression`);
  return ast;
}

/** Évalue un AST compilé contre des CaseFacts. PUR : aucun accès dynamique hors des cas fermés. */
export function evaluerExpression(ast: Noeud, faits: CaseFacts): boolean {
  const collection = (nom: string): (string | PersonneLiee)[] =>
    nom === "relatedPersons" ? faits.relatedPersons : nom === "documents" ? faits.documents : faits.checks;

  const val = (v: Valeur, env: Map<string, string | PersonneLiee>): string | boolean => {
    if (v.t === "lit") return v.valeur;
    if (v.t === "attr") return v.nom === "entityType" ? faits.entityType
      : v.nom === "jurisdiction" ? faits.jurisdiction : faits.riskLevel;
    if (v.t === "var") return env.get(v.nom) as string;
    const objet = env.get(v.variable) as PersonneLiee;
    return v.prop === "role" ? objet.role : v.prop === "pep" ? objet.pep : objet.sanctioned;
  };

  const evalN = (n: Noeud, env: Map<string, string | PersonneLiee>): boolean => {
    switch (n.t) {
      case "et": return evalN(n.g, env) && evalN(n.d, env);
      case "ou": return evalN(n.g, env) || evalN(n.d, env);
      case "non": return !evalN(n.e, env);
      case "cmp": { const a = val(n.g, env), b = val(n.d, env);
        return n.op === "==" ? a === b : a !== b; }
      case "in": return n.liste.includes(val(n.v, env) as string | boolean);
      case "inColl": return (collection(n.coll) as string[]).includes(val(n.v, env) as string);
      case "val": return val(n.v, env) === true;
      case "quantif": {
        const elems = collection(n.coll);
        // Liste vide : any → false, all → true (vérité vide) — sémantique DOCUMENTÉE.
        const test = (e: string | PersonneLiee) => {
          const env2 = new Map(env); env2.set(n.variable, e); return evalN(n.corps, env2); };
        return n.q === "any" ? elems.some(test) : elems.every(test);
      }
    }
  };
  return evalN(ast, new Map());
}
