/* Bloc WD (R432–R438) — cœur PUR du pipeline WorkflowIR de la démo O-Live.
 * SOURCE DE VÉRITÉ : ce fichier. Le même code est INLINÉ dans olive-demo.html entre
 * les marqueurs OLIVE-WIR (test WD-SYNC = no-drift). Aucune dépendance, aucun DOM :
 * tout est testable (apps/web/src/test/wd-wir-core.test.ts, specs spec/wd/WD-*.feature).
 * Doctrine : l'IA extrait et PROPOSE (DRAFT_AI, jamais activable — R433) ; l'humain
 * édite (DRAFT_HUMAN) puis un AUTRE humain ratifie (R435/R13) ; la publication passe
 * UNIQUEMENT par le circuit gouvernance (R436) ; anomalies LISTÉES, jamais corrigées. */

export const ROLES_TENANT = ["ARM", "RM", "CO", "CO_SR", "CF", "DIR", "ADMIN", "HPB", "CEO", "SECU",
  "AML", "BRM", "ESG", "LEGAL", "ESG/LEGAL", "HPB/CEO", "Système"];   // référentiel du tenant démo (gabarits livrés)

export const STATUTS_WIR = ["DRAFT_AI", "DRAFT_HUMAN", "PUBLISHED"];

/* R432 — toute source (texte, image, dessin, canvas) → WorkflowIR normalisé.
 * `extraction` = sortie brute {label, nodes[{id,type,label,role,confidence?}], edges[{from,to,label?}]}.
 * R438 : une confidence < 0.5 marque le nœud « à vérifier » — RIEN n'est corrigé. */
export function creerWir(extraction, meta) {
  var nodes = (extraction.nodes || []).map(function (n) {
    var confidence = typeof n.confidence === "number" ? n.confidence : 1;
    return {
      id: n.id, label: n.label || n.id,
      ownerRole: n.role || null,
      slaHours: typeof n.slaHours === "number" ? n.slaHours : null,
      visaRequired: n.type === "end" || n.visaRequired === true,
      approvalType: n.approvalType || (n.type === "end" ? "QUATRE_YEUX" : "SIMPLE"),
      type: n.type || "step",
      confidence: confidence,
      aVerifier: confidence < 0.5,
      x: typeof n.x === "number" ? n.x : undefined,        // layout canvas préservé à l'aller-retour
      y: typeof n.y === "number" ? n.y : undefined,
    };
  });
  var edges = (extraction.edges || []).map(function (e) {
    return { from: e.from, to: e.to, condition: e.condition || e.label || null };
  });
  return {
    label: extraction.label || "Workflow importé",
    nodes: nodes, edges: edges,
    meta: {
      source: meta.source, importePar: meta.importePar,
      hashFichier: meta.hashFichier || null,
      modele: meta.modele || null,
      status: "DRAFT_AI",                                  // R433 : naît proposition, jamais activable
      ratifiePar: null,
      creeLe: meta.creeLe || null,
    },
  };
}

/* R434 — validation STRUCTURELLE à l'ingestion. Retourne la liste des anomalies
 * (code, noeud?, role?, bloquant, detail) — AUCUNE correction silencieuse. */
export function validerWir(wir, rolesTenant) {
  var roles = rolesTenant || ROLES_TENANT;
  var anomalies = [];
  var ids = wir.nodes.map(function (n) { return n.id; });
  var entrantes = {}, sortantes = {};
  wir.edges.forEach(function (e) {
    sortantes[e.from] = (sortantes[e.from] || 0) + 1;
    entrantes[e.to] = (entrantes[e.to] || 0) + 1;
  });
  // connexité faible : chaque nœud touche au moins une arête (si le graphe a des arêtes)
  if (wir.nodes.length > 1) wir.nodes.forEach(function (n) {
    if (!entrantes[n.id] && !sortantes[n.id])
      anomalies.push({ code: "NON_CONNEXE", noeud: n.id, bloquant: true,
        detail: "Nœud « " + n.label + " » isolé : aucune arête entrante ni sortante." });
  });
  // état initial unique
  var initiaux = wir.nodes.filter(function (n) { return !entrantes[n.id] && (sortantes[n.id] || wir.nodes.length === 1); });
  if (initiaux.length === 0)
    anomalies.push({ code: "INITIAL_ABSENT", bloquant: true,
      detail: "Aucun état initial : tous les nœuds ont une arête entrante." });
  if (initiaux.length > 1)
    anomalies.push({ code: "INITIAL_MULTIPLE", bloquant: true,
      detail: "Plusieurs états initiaux : " + initiaux.map(function (n) { return n.id; }).join(", ") + "." });
  // au moins un terminal
  var terminaux = wir.nodes.filter(function (n) { return !sortantes[n.id]; });
  if (wir.nodes.length > 0 && terminaux.length === 0)
    anomalies.push({ code: "TERMINAL_ABSENT", bloquant: true,
      detail: "Aucun état terminal : chaque nœud a une arête sortante." });
  // arêtes vers des nœuds inconnus
  wir.edges.forEach(function (e) {
    if (ids.indexOf(e.from) < 0 || ids.indexOf(e.to) < 0)
      anomalies.push({ code: "ARETE_ORPHELINE", bloquant: true,
        detail: "Arête " + e.from + "→" + e.to + " référence un nœud inconnu." });
  });
  // rôles mappés sur les rôles tenant (NON_MAPPÉ = bloquant, R434)
  wir.nodes.forEach(function (n) {
    if (n.ownerRole && roles.indexOf(n.ownerRole) < 0)
      anomalies.push({ code: "ROLE_NON_MAPPE", noeud: n.id, role: n.ownerRole, bloquant: true,
        detail: "Rôle « " + n.ownerRole + " » du nœud « " + n.label + " » absent des rôles tenant." });
  });
  return anomalies;
}

/* Transitions de statut — R433 (DRAFT_AI jamais publiable), R435 (importeur ≠ ratifieur),
 * R436 (publication UNIQUEMENT via le circuit gouvernance — pas de circuit parallèle).
 * Pur : retourne {ok, wir?, evenement?, motif?} sans muter l'entrée. */
export function transitionStatut(wir, action) {
  var copie = JSON.parse(JSON.stringify(wir));
  if (action.type === "editer") {
    if (copie.meta.status === "PUBLISHED")
      return { ok: false, motif: "Version publiée immuable — préparez un nouveau brouillon (R48/R49)." };
    copie.meta.status = "DRAFT_HUMAN";
    copie.meta.ratifiePar = null;                          // toute édition invalide le visa
    return { ok: true, wir: copie, evenement: "WF_IR_EDITED" };
  }
  if (action.type === "ratifier") {
    if (copie.meta.status !== "DRAFT_HUMAN")
      return { ok: false, motif: "R433 : un brouillon IA doit être pris en main par un humain avant ratification." };
    if (action.par === copie.meta.importePar)
      return { ok: false, motif: "R435/R13 : l'importeur ne ratifie pas son propre import (4-yeux)." };
    var bloquantes = (action.anomalies || []).filter(function (a) { return a.bloquant; });
    if (bloquantes.length)
      return { ok: false, motif: "R434 : " + bloquantes.length + " anomalie(s) bloquante(s) — " +
        bloquantes.map(function (a) { return a.code; }).join(", ") + "." };
    copie.meta.ratifiePar = action.par;
    return { ok: true, wir: copie, evenement: "WF_RATIFIED" };
  }
  if (action.type === "publier") {
    if (copie.meta.status === "DRAFT_AI")
      return { ok: false, motif: "R433 : un DRAFT_AI n'est JAMAIS activable — édition humaine puis visa requis." };
    if (!copie.meta.ratifiePar)
      return { ok: false, motif: "R435 : visa 4-yeux requis avant publication." };
    if (action.via !== "gouvernance")
      return { ok: false, motif: "R436 : publication UNIQUEMENT via Gouvernance → Workflows — Versions & publication." };
    copie.meta.status = "PUBLISHED";
    return { ok: true, wir: copie, evenement: "DEFINITION_UPDATED" };
  }
  return { ok: false, motif: "Action inconnue : " + action.type };
}

/* E-WD-3 — customNodes/customEdges = PROJECTION du WIR (l'écriture directe est supprimée).
 * R437 : la projection est REFUSÉE tant qu'un rôle n'est pas mappé (canvas contraint). */
export function projeterWir(wir, rolesTenant) {
  var nonMappes = validerWir(wir, rolesTenant || ROLES_TENANT)
    .filter(function (a) { return a.code === "ROLE_NON_MAPPE"; });
  if (nonMappes.length)
    throw new Error("ROLE_NON_MAPPE : " + nonMappes.map(function (a) { return a.role; }).join(", ") +
      " — mappez les rôles tenant avant projection (R437).");
  var nodes = wir.nodes.map(function (n, i) {
    return { id: n.id, type: n.type || "step", label: n.label, role: n.ownerRole,
      x: typeof n.x === "number" ? n.x : 400,
      y: typeof n.y === "number" ? n.y : 40 + i * 100 };
  });
  var edges = wir.edges.map(function (e) {
    return { from: e.from, to: e.to, label: e.condition || undefined };
  });
  return { nodes: nodes, edges: edges };
}

/* Aller-retour canvas : le Builder ne PRODUIT plus customNodes — il commet des nœuds/arêtes
 * qui RECONSTRUISENT un WIR (statut DRAFT_HUMAN : c'est une édition humaine). */
export function wirDepuisCanvas(nodes, edges, meta) {
  var wir = creerWir({ label: (meta && meta.label) || "Workflow personnalisé",
    nodes: nodes, edges: edges }, { source: "canvas", importePar: (meta && meta.importePar) || null });
  wir.meta.status = "DRAFT_HUMAN";
  return wir;
}
