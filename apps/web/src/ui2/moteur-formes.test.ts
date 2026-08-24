import { describe, it, expect } from "vitest";
import fixtures from "./fixtures-moteur.json";
import {
  tableau, listeClients, listeProspects, listeSorties, sortieClose,
  listeVuesBi, listeReglesAml, matriceDocumentaire,
  listeDeplacements, listeHabilitations, listeHitsScreening, listeSignauxAml, listeCasRisque,
} from "./moteur-formes";

/**
 * FORME DES RÉPONSES DU MOTEUR (V2-M41) — la garde qui manquait.
 *
 * Les fixtures ne sont pas écrites à la main : elles sont CAPTURÉES sur une API vivante par
 * `scripts/verifier-formes-api.mjs --capturer`, contre le tenant de démonstration GWB semé par
 * les vraies routes (`OLIVE_SEED_DEMO=1 npm run seed:demo`). Une fixture recopiée à la main
 * dérive du moteur sans que personne ne le voie ; celle-ci vient du moteur.
 *
 * CE QUE CETTE GARDE PROUVE : que les adaptateurs transforment le payload RÉEL en ce que
 * l'écran affiche. CE QU'ELLE NE PROUVE PAS : que le moteur ne changera pas de forme demain —
 * c'est le script, relancé contre une API vivante, qui le dirait. La fixture fige un CONSTAT
 * daté, pas une promesse.
 */

const f = fixtures as Record<string, unknown>;

describe("Formes du moteur → écran (V2-M41)", () => {
  // Les routes que les adaptateurs consomment réellement. La capture en contient davantage
  // (dont des projections que le tenant de démonstration laisse vides, comme
  // `/v1/crossborder/reporting` → `{ parPays: {} }`) : sur celles-là il n'y a RIEN à conclure,
  // et prétendre le contraire serait le défaut que ces gardes existent pour empêcher.
  const ROUTES_TESTEES = ["/v1/clients", "/v1/onboarding", "/v1/offboarding", "/v1/bi/annuaire",
    "/v1/aml/referentiel", "/v1/doc-matrix/en-vigueur"];

  it("FM-00 garde de la garde : les fixtures testées viennent d'une capture NON VIDE", () => {
    // Sans ceci, une fixture vidée par erreur ferait passer tous les tests suivants à vide.
    expect(Object.keys(f).length).toBeGreaterThanOrEqual(10);
    for (const route of ROUTES_TESTEES) {
      expect(f[route], `fixture absente : ${route}`).toBeDefined();
      expect(JSON.stringify(f[route]).length, `fixture vide : ${route}`).toBeGreaterThan(40);
    }
  });

  it("FM-01 /v1/clients — l'enveloppe { data } est déballée (l'écran affichait une liste vide)", () => {
    const brut = f["/v1/clients"] as Record<string, unknown>;
    expect(Array.isArray(brut)).toBe(false);            // le moteur N'EST PAS un tableau nu
    expect(Array.isArray(brut.data)).toBe(true);
    const lignes = listeClients(brut);
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes[0]).toHaveProperty("id");
    expect(lignes[0]).toHaveProperty("name");
    // tolérance au seed : une liste déjà nue traverse inchangée
    expect(listeClients([{ id: "c1", name: "X" }])).toHaveLength(1);
    // et une réponse inattendue ne casse pas le rendu — elle rend une liste vide, pas undefined
    expect(tableau(null)).toEqual([]);
    expect(tableau({ nimporte: 1 })).toEqual([]);
  });

  it("FM-02 /v1/onboarding — prospectNom/etapeDepuis traduits, apporteur NON inventé", () => {
    const lignes = listeProspects(f["/v1/onboarding"]);
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes[0].nom).toBeTruthy();                 // venait de `prospectNom`
    expect(lignes[0].etape).toBeTruthy();
    expect(lignes[0].depuis).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    // le moteur ne détient pas l'apporteur d'affaires : le champ reste vide, l'écran dira « — »
    expect(lignes[0].apporteur).toBeUndefined();
  });

  it("FM-03 /v1/offboarding — statut réel, et une clôture DEMANDÉE n'est pas une clôture FAITE", () => {
    const lignes = listeSorties(f["/v1/offboarding"]);
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes[0].reference).toBeTruthy();
    expect(lignes[0].statut).toBeTruthy();
    // le défaut trouvé sur API vivante : l'écran affichait « CLOS » pour CLOTURE_DEMANDEE
    expect(sortieClose("CLOTURE_DEMANDEE")).toBe(false);
    expect(sortieClose("EN_COURS")).toBe(false);
    expect(sortieClose("CLOS")).toBe(true);
  });

  it("FM-04 /v1/bi/annuaire — code/source/dimensions traduits, colonnes COMPTÉES", () => {
    const brut = f["/v1/bi/annuaire"] as Record<string, unknown>[];
    const lignes = listeVuesBi(brut);
    expect(lignes.length).toBe(brut.length);
    expect(lignes[0].vue).toBe(brut[0].code);
    expect(lignes[0].domaine).toBe(brut[0].source);
    const attendu = (brut[0].dimensions as unknown[]).length + (brut[0].mesures as unknown[]).length;
    expect(lignes[0].colonnes).toBe(attendu);           // un chiffre réel, pas décoratif
  });

  it("FM-05 /v1/aml/referentiel — { scenarios, seuils } aplati, aucun seuil inventé", () => {
    const lignes = listeReglesAml(f["/v1/aml/referentiel"]);
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes[0].code).toMatch(/^R\d+/);
    expect(lignes[0].libelle).toBeTruthy();
    // alertes12m n'est pas dans cette réponse : la colonne reste vide plutôt que fausse
    expect(lignes[0].alertes12m).toBeUndefined();
    // un scénario dont aucun seuil n'a de valeur connue n'affiche PAS un seuil vide trompeur
    const sansValeurs = listeReglesAml({ scenarios: [{ regle: "R999", seuils: ["amlInconnu"] }], seuils: {} });
    expect(sansValeurs[0].seuils).toBeUndefined();
  });

  it("FM-06 /v1/doc-matrix/en-vigueur — l'axe RÉEL du moteur est affiché, l'état n'est pas fabriqué", () => {
    const m = matriceDocumentaire(f["/v1/doc-matrix/en-vigueur"]);
    expect(m.version).toMatch(/^v\d/);
    expect(m.exigences.length).toBeGreaterThan(0);
    // chaque ligne porte l'axe du moteur : structure · porteur
    for (const e of m.exigences) {
      expect(e.code).toBeTruthy();
      expect(e.axe).toMatch(/ · /);
      // l'état de complétude n'appartient pas à la matrice : il reste vide (voir ECARTS-FRONT)
      expect(e.etat).toBeUndefined();
    }
    // « parRole » n'est PAS un porteur : sans dépliage on afficherait une ligne « SA · parRole »
    expect(m.exigences.some((e) => e.axe === "SA · parRole")).toBe(false);
    // tolérance au seed : la forme plate de la maquette traverse inchangée
    const seed = { version: "v7", exigences: [{ code: "SOF-DOC", etat: "OK" }] };
    expect(matriceDocumentaire(seed).exigences[0].etat).toBe("OK");
  });

  it("FM-07 l'AXE RÔLE du contrat enrichi arrive à l'écran (arbitrage PO 12.08.2026)", () => {
    // Le contrat `docmatrix` porte désormais `parRole` : une exigence peut viser un UBO sans
    // viser un simple signataire — la distinction que la v1 faisait en colonnes et que le
    // moteur ignorait. Cette garde vérifie qu'elle SURVIT jusqu'à l'écran ; si l'adaptateur
    // reperdait le rôle, la matrice se relirait comme si tout intervenant devait tout fournir.
    const brut = f["/v1/doc-matrix/en-vigueur"] as any;
    const roles = brut?.contenu?.exigences?.SA?.parRole;
    expect(roles, "la fixture capturée doit porter l'axe rôle").toBeTruthy();

    const m = matriceDocumentaire(brut);
    const parAxe = (axe: string) => m.exigences.filter((e) => e.axe === axe).map((e) => e.code).sort();
    // chaque rôle du moteur produit ses propres lignes, sous son propre axe
    for (const [role, exigences] of Object.entries(roles as Record<string, string[]>))
      expect(parAxe(`SA · rôle ${role}`)).toEqual([...exigences].sort());
    // et le socle reste distinct du rôle : le passeport est exigé de TOUT intervenant,
    // le formulaire A du seul UBO — les deux ne se confondent pas dans la même ligne.
    expect(parAxe("SA · personne_liee")).toEqual(["PASSEPORT"]);
    expect(parAxe("SA · rôle UBO")).toContain("FORMULAIRE_A");
    expect(parAxe("SA · personne_liee")).not.toContain("FORMULAIRE_A");
  });

  // ── V2-M51 — les cinq adaptateurs de E-V2-17, chacun contre sa fixture CAPTURÉE (jamais
  // écrite à la main). La règle des six premiers tient : traduit, déplié, jamais inventé.

  it("FM-08 /v1/trips : pays ← destinations, depart ← dateStart ; reference et visaChain restent VIDES", () => {
    const rows = listeDeplacements(f["/v1/trips"]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].pays).toBe("AE");                       // destinations[] déplié, codes du moteur
    expect(rows[0].depart).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    // le moteur ne détient NI référence métier NI chaîne de visa dans la projection : vides,
    // pas brodés — l'écran affiche « — », c'est le contrat.
    expect(rows[0].reference).toBeUndefined();
    expect(rows[0].visaChain).toBeUndefined();
  });

  it("FM-09 /v1/formations/assignments : formation ← formationCode, collaborateur ← userId (un ID, pas un nom)", () => {
    const rows = listeHabilitations(f["/v1/formations/assignments"]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].formation).toBe("LBA-2026");
    // la projection ne joint pas l'annuaire : fabriquer un nom serait inventer — l'id s'affiche
    expect(rows[0].collaborateur).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0].echeance).toBe("31.12.2026");
  });

  it("FM-10 /v1/screening/hits : nom ← detail.via, liste ← listeVersion — la file de qualification a un NOM à lire", () => {
    // Le plus grave des cinq écarts : l'écran de qualification affichait des colonnes vides.
    const rows = listeHitsScreening(f["/v1/screening/hits"]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].nom).toBe("Nordwind Handel SA");        // le nom QUI A MATCHÉ (R411)
    expect(rows[0].liste).toBe("2026-08-01");
    expect(rows[0].score).toBe(100);
    expect(rows[0].statut).toBe("BRUT");
  });

  it("FM-11 /v1/aml/signals : statut ← outcome ?? status (qualifié d'abord), at ← createdAt", () => {
    const rows = listeSignauxAml(f["/v1/aml/signals"]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].statut).toBe("NEW");                    // outcome null → status
    expect(listeSignauxAml([{ id: "x", status: "NEW", outcome: "TP" }])[0].statut).toBe("TP");
    expect(rows[0].at).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it("FM-12 /v1/riskcases : origine ← COMPTE des signaux réconciliés (R280) — une donnée, pas une prose", () => {
    const rows = listeCasRisque(f["/v1/riskcases"]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].origine).toBe("1 signal (R280)");
    expect(listeCasRisque([{ id: "x", signalIds: ["a", "b"] }])[0].origine).toBe("2 signaux (R280)");
    // reference n'existe pas au moteur : vide — l'écran retombe déjà sur l'id
    expect(rows[0].reference).toBeUndefined();
    // et le format ÉCRAN (seed) traverse inchangé : l'adaptateur est idempotent
    expect(listeCasRisque([{ id: "s", reference: "RC-1", origine: "Alerte X" }])[0])
      .toMatchObject({ reference: "RC-1", origine: "Alerte X" });
  });
});
