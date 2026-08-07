// P-L7-5 — la checklist AFFICHE le ledger, ne fabrique rien (leçon L6-3).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { grouperStatuts } from "./RequirementChecklist";

describe("RequirementChecklist (P-L7-5)", () => {
  it("groupe Données/Documents/Contrôles/Visas, bloquants d'abord dans chaque groupe", () => {
    const statuts = [
      { id: "REQ-DATA-JUR", satisfied: true, satisfiedBy: "facts.jurisdiction=CH" },
      { id: "REQ-DOC-T", satisfied: false, derivedBy: "document absent" },
      { id: "REQ-EDD-PEP", satisfied: false, derivedBy: "document absent" },
      { id: "REQ-CHECK-SCREEN", satisfied: true, satisfiedBy: "hits:0/0" },
      { id: "REQ-VISA-CO", satisfied: false, derivedBy: "visa absent" },
    ];
    const gap = [
      { id: "REQ-DOC-T", satisfied: false, severity: "bloquant", basis: "CDB 20 art. 41 · R26" },
      { id: "REQ-EDD-PEP", satisfied: false, severity: "bloquant", basis: "OBA-FINMA EDD · R32" },
      { id: "REQ-VISA-CO", satisfied: false, severity: "bloquant", basis: "OBA-FINMA · R14/R86" },
    ] as any;
    const groupes = grouperStatuts(statuts as any, gap);
    expect(groupes.map((g) => g.titre)).toEqual(["Données", "Documents", "Contrôles", "Visas"]);
    expect(groupes[1].lignes.map((l: any) => l.id)).toEqual(["REQ-DOC-T", "REQ-EDD-PEP"]);
    expect(groupes[1].lignes[0].basis).toContain("CDB 20");
  });
  it("sincérité : le composant n'importe pas le moteur et ne calcule aucun statut localement", () => {
    const src = readFileSync(join(__dirname, "RequirementChecklist.tsx"), "utf8");
    expect(src).not.toContain("@olive/screening-engine");
    expect(src).toContain("/v1/inference/");                 // tout vient de l'API réelle du ledger
    expect(src).not.toMatch(/satisfied\s*[:=]\s*(true|false)/); // jamais un verdict fabriqué au front
  });
});
