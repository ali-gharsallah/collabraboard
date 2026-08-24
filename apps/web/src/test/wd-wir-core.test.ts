import { describe, it, expect } from "vitest";
// Bloc WD (R432–R438) — les fonctions PURES de la démo, extraites dans demo/wir-core.mjs
// (source de vérité ; le même code est INLINÉ dans olive-demo.html entre les marqueurs
// OLIVE-WIR — le test WD-SYNC prouve le no-drift). Specs : spec/wd/WD-01..12.feature.
// @ts-expect-error module JS de la démo, hors rootDir web — importé par chemin relatif
import { creerWir, validerWir, transitionStatut, projeterWir, wirDepuisCanvas, ROLES_TENANT }
  from "../../../../demo/wir-core.mjs";
import { readFileSync } from "fs";
import { resolve } from "path";

const extraction = () => ({
  label: "EDD Trust", nodes: [
    { id: "n0", type: "start", label: "Entrée", role: null },
    { id: "n1", type: "step", label: "Collecte", role: "ARM" },
    { id: "n2", type: "end", label: "Décision", role: "CO" }],
  edges: [{ from: "n0", to: "n1" }, { from: "n1", to: "n2" }],
});
const wirValide = () => creerWir(extraction(), { source: "texte", importePar: "i.vernet" });

describe("WD-01 — toute source produit un WorkflowIR normalisé (R432)", () => {
  it("shape complet : nodes/edges/meta avec les champs du contrat", () => {
    const w = wirValide();
    expect(w.nodes[1]).toMatchObject({ id: "n1", label: "Collecte", ownerRole: "ARM" });
    expect(w.nodes[1]).toHaveProperty("slaHours");
    expect(w.nodes[1]).toHaveProperty("visaRequired");
    expect(w.nodes[1]).toHaveProperty("approvalType");
    expect(w.nodes[1]).toHaveProperty("confidence");
    expect(w.edges[0]).toMatchObject({ from: "n0", to: "n1" });
    expect(w.edges[0]).toHaveProperty("condition");
    expect(w.meta).toMatchObject({ source: "texte", importePar: "i.vernet" });
  });
});

describe("WD-02 — DRAFT_AI initial, jamais activable (R433)", () => {
  it("naît DRAFT_AI et refuse la publication directe", () => {
    const w = wirValide();
    expect(w.meta.status).toBe("DRAFT_AI");
    const r = transitionStatut(w, { type: "publier", par: "x", via: "gouvernance" });
    expect(r.ok).toBe(false);
    expect(r.motif).toMatch(/R433/);
  });
});

describe("WD-03/04/05 — validation structurelle (R434)", () => {
  it("nœud isolé → NON_CONNEXE, listée, pas corrigée", () => {
    const e = extraction();
    e.nodes.push({ id: "n9", type: "step", label: "Perdu", role: "CO" });
    const a = validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES_TENANT);
    expect(a.map((x) => x.code)).toContain("NON_CONNEXE");
    expect(a.find((x) => x.code === "NON_CONNEXE")!.noeud).toBe("n9");
  });
  it("deux initiaux → INITIAL_MULTIPLE ; zéro initial → INITIAL_ABSENT", () => {
    const e = extraction();
    e.nodes.push({ id: "n8", type: "step", label: "Bis", role: "CO" });
    e.edges.push({ from: "n8", to: "n2" });
    const a = validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES_TENANT);
    expect(a.map((x) => x.code)).toContain("INITIAL_MULTIPLE");
    const e2 = extraction();
    e2.edges.push({ from: "n2", to: "n0" });                     // cycle complet
    const a2 = validerWir(creerWir(e2, { source: "t", importePar: "u" }), ROLES_TENANT);
    expect(a2.map((x) => x.code)).toContain("INITIAL_ABSENT");
  });
  it("aucun terminal → TERMINAL_ABSENT", () => {
    const e = extraction();
    e.edges.push({ from: "n2", to: "n0" });
    const a = validerWir(creerWir(e, { source: "t", importePar: "u" }), ROLES_TENANT);
    expect(a.map((x) => x.code)).toContain("TERMINAL_ABSENT");
  });
});

describe("WD-06 — rôles mappés tenant, NON_MAPPÉ bloquant (R434)", () => {
  it("rôle inconnu → ROLE_NON_MAPPE bloquant, ratification refusée", () => {
    const e = extraction();
    e.nodes[1].role = "SORCIER";
    const w = creerWir(e, { source: "t", importePar: "i.vernet" });
    const a = validerWir(w, ROLES_TENANT);
    const anomalie = a.find((x) => x.code === "ROLE_NON_MAPPE")!;
    expect(anomalie).toMatchObject({ noeud: "n1", role: "SORCIER", bloquant: true });
    const w2 = transitionStatut(w, { type: "editer", par: "u" }).wir!;
    const r = transitionStatut(w2, { type: "ratifier", par: "autre", anomalies: a });
    expect(r.ok).toBe(false);
  });
});

describe("WD-07 — transitions DRAFT_AI → DRAFT_HUMAN → PUBLISHED (R432/R436)", () => {
  it("éditer : DRAFT_AI → DRAFT_HUMAN + événement WF_IR_EDITED", () => {
    const r = transitionStatut(wirValide(), { type: "editer", par: "i.vernet" });
    expect(r.ok).toBe(true);
    expect(r.wir!.meta.status).toBe("DRAFT_HUMAN");
    expect(r.evenement).toBe("WF_IR_EDITED");
  });
  it("publication hors circuit gouvernance refusée (pas de circuit parallèle)", () => {
    let w = transitionStatut(wirValide(), { type: "editer", par: "a" }).wir!;
    w = transitionStatut(w, { type: "ratifier", par: "b", anomalies: [] }).wir!;
    const r = transitionStatut(w, { type: "publier", par: "b", via: "bouton-magique" });
    expect(r.ok).toBe(false);
    const ok = transitionStatut(w, { type: "publier", par: "b", via: "gouvernance" });
    expect(ok.ok).toBe(true);
    expect(ok.wir!.meta.status).toBe("PUBLISHED");
  });
});

describe("WD-08 — visa 4-yeux : importeur ≠ ratifieur (R435/R13)", () => {
  it("auto-ratification refusée ; ratification par un autre passe", () => {
    let w = transitionStatut(wirValide(), { type: "editer", par: "i.vernet" }).wir!;
    const refus = transitionStatut(w, { type: "ratifier", par: "i.vernet", anomalies: [] });
    expect(refus.ok).toBe(false);
    expect(refus.motif).toMatch(/R435/);
    const ok = transitionStatut(w, { type: "ratifier", par: "a.gharsallah", anomalies: [] });
    expect(ok.ok).toBe(true);
    expect(ok.wir!.meta.ratifiePar).toBe("a.gharsallah");
    expect(ok.evenement).toBe("WF_RATIFIED");
  });
});

describe("WD-09 — traçabilité source (R436)", () => {
  it("le WIR d'image porte hash + modèle+version dans meta", () => {
    const w = creerWir(extraction(), { source: "image", importePar: "u",
      hashFichier: "sha256:abc", modele: "extraction-locale@1" });
    expect(w.meta).toMatchObject({ source: "image", hashFichier: "sha256:abc", modele: "extraction-locale@1" });
  });
});

describe("WD-10 — customNodes/customEdges = projection du WIR (E-WD-3)", () => {
  it("projection dérive nodes/edges avec positions ; aller-retour canvas reconstruit un WIR", () => {
    const p = projeterWir(wirValide());
    expect(p.nodes).toHaveLength(3);
    expect(p.nodes[0]).toHaveProperty("x");
    expect(p.nodes[0]).toHaveProperty("y");
    expect(p.edges).toHaveLength(2);
    const retour = wirDepuisCanvas(p.nodes, p.edges, { importePar: "u" });
    expect(retour.meta.status).toBe("DRAFT_HUMAN");
    expect(retour.nodes.map((n: any) => n.id)).toEqual(["n0", "n1", "n2"]);
  });
});

describe("WD-11 — projection refusée tant que ROLE_NON_MAPPE (R437)", () => {
  it("canvas contraint par les rôles tenant", () => {
    const e = extraction();
    e.nodes[1].role = "SORCIER";
    expect(() => projeterWir(creerWir(e, { source: "t", importePar: "u" }), ROLES_TENANT))
      .toThrow(/ROLE_NON_MAPPE/);
  });
});

describe("WD-12 — extraction dégradée assumée (R438)", () => {
  it("confidence faible marquée « à vérifier », statut inchangé, rien corrigé", () => {
    const e = extraction();
    (e.nodes[1] as any).confidence = 0.3;
    const w = creerWir(e, { source: "image", importePar: "u" });
    expect(w.nodes[1].confidence).toBe(0.3);
    expect(w.nodes[1].aVerifier).toBe(true);
    expect(w.meta.status).toBe("DRAFT_AI");
  });
});

describe("WD-SYNC — le code inliné dans olive-demo.html EST wir-core.mjs (no-drift)", () => {
  it("le bloc entre les marqueurs OLIVE-WIR égale le fichier source", () => {
    const html = readFileSync(resolve(__dirname, "../../../../demo/olive-demo.html"), "utf8");
    const source = readFileSync(resolve(__dirname, "../../../../demo/wir-core.mjs"), "utf8");
    const m = html.match(/\/\* OLIVE-WIR:START \*\/([\s\S]*?)\/\* OLIVE-WIR:END \*\//);
    expect(m).toBeTruthy();
    const inline = m![1].trim();
    const attendu = source.replace(/export /g, "").trim();
    expect(inline).toBe(attendu);
  });
});
