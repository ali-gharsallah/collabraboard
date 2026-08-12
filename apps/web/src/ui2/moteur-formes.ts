/**
 * ADAPTATEURS DE FORME — ce que le MOTEUR renvoie → ce que l'ÉCRAN affiche (V2-M41).
 *
 * POURQUOI CE FICHIER EXISTE. Les gardes V2-M39/M40 vérifiaient le contrat d'APPEL (la route
 * existe, le verbe est bon, les champs envoyés sont lus). Elles se terminaient sur un aveu :
 * « la FORME des réponses […] seule une API vivante le dirait ». L'API a été démarrée, semée
 * du tenant de démonstration GWB, et interrogée avec un vrai jeton. Verdict : SIX lectures sur
 * vingt-cinq ne rendaient pas ce que l'écran lisait. Le détail, par route, est dans
 * `docs/AUDIT-CABLAGE-V2.md` ; les payloads observés sont figés dans `fixtures-moteur.json`.
 *
 * LA RÈGLE QUI GOUVERNE CES FONCTIONS : **le moteur nomme, l'écran suit.** Un adaptateur
 * TRADUIT, il n'INVENTE jamais. Quand le moteur n'a pas l'information (l'apporteur d'affaires
 * d'un prospect, le motif d'une sortie), le champ reste `undefined` et l'écran affiche « — ».
 * Fabriquer une valeur plausible ferait exactement ce que la maquette faisait : montrer une
 * donnée que personne ne détient.
 *
 * TOLÉRANCE AU SEED. Chaque adaptateur accepte AUSSI la forme déjà normalisée : en mode
 * démonstration, `useApiOrSeed` rend le seed, qui est écrit dans le vocabulaire de l'écran.
 * Les deux chemins traversent donc la même fonction — un seul rendu à raisonner.
 */

/**
 * Registre des routes dont l'écart de forme est ASSUMÉ par un adaptateur. Le vérificateur
 * (`scripts/verifier-formes-api.mjs`) le lit : un écart couvert ici n'est plus un échec, c'est
 * une traduction déclarée. Retirer un adaptateur sans retirer sa ligne, ou l'inverse, se voit
 * — c'est le seul endroit où la liste existe.
 */
export const ROUTES_ADAPTEES: Record<string, string> = {
  "/v1/clients": "listeClients",
  "/v1/onboarding": "listeProspects",
  "/v1/offboarding": "listeSorties",
  "/v1/bi/annuaire": "listeVuesBi",
  "/v1/aml/referentiel": "listeReglesAml",
  "/v1/doc-matrix/en-vigueur": "matriceDocumentaire",
};

// ── Outils communs ──────────────────────────────────────────────────────────────────────────

const estObjet = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Déballe une réponse paginée. R281 : plusieurs lectures du moteur rendent `{ data, next_cursor }`
 * — l'écran qui attendait un tableau nu affichait alors une liste VIDE sans rien signaler,
 * puisque `Array.isArray(objet)` est faux et que la garde de repli ne se déclenche pas (la
 * requête, elle, a réussi). C'est le défaut le plus silencieux de la série.
 */
export function tableau<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (estObjet(v) && Array.isArray(v.data)) return v.data as T[];
  return [];
}

/** Date ISO du moteur → jour lisible. Une valeur déjà lisible (seed) traverse inchangée. */
export function jour(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;                      // seed « 04.08.2026 » : tel quel
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

// ── Clients (/v1/clients) ───────────────────────────────────────────────────────────────────

export type ClientMoteur = { id: string; name: string; structure?: string; country?: string;
  riskLevel?: string; corrLang?: string };

/** Le moteur rend `{ data: [...], next_cursor }`. L'écran « Mes clients » attendait un tableau. */
export const listeClients = (v: unknown): ClientMoteur[] => tableau<ClientMoteur>(v);

// ── Prospects (/v1/onboarding) ──────────────────────────────────────────────────────────────

export type ProspectEcran = { id: string; nom?: string; etape?: string; apporteur?: string; depuis?: string };

/**
 * Moteur : `{ id, prospectNom, etape, etapeDepuis, slaSignale, kycFileId, … }`.
 * `apporteur` N'EXISTE PAS au moteur (le modèle Onboarding ne porte pas d'apporteur d'affaires) :
 * il reste vide. C'est un écart de MODÈLE, consigné — pas un trou à combler par une jolie chaîne.
 */
export function listeProspects(v: unknown): ProspectEcran[] {
  return tableau<Record<string, unknown>>(v).map((p) => ({
    id: String(p.id ?? ""),
    nom: (p.nom ?? p.prospectNom) as string | undefined,
    etape: p.etape as string | undefined,
    apporteur: p.apporteur as string | undefined,
    depuis: jour(p.depuis ?? p.etapeDepuis ?? p.createdAt),
  }));
}

// ── Sorties (/v1/offboarding, bloc 62) ──────────────────────────────────────────────────────

export type SortieEcran = { id: string; reference?: string; clientId?: string; motif?: string;
  etape?: string; statut?: string };

/**
 * Moteur : `{ id, clientId, type, statut, createdAt, clotureEffectiveAt, retentionJusqua }`.
 * `type` (EXIT_COMPLIANCE, …) est la CATÉGORIE de sortie — c'est ce que le moteur détient de
 * plus proche d'un motif, et l'écran l'affiche sous ce nom. Le motif rédigé, lui, vit dans
 * l'événement de décision, pas dans la projection : ne rien afficher vaut mieux que broder.
 */
export function listeSorties(v: unknown): SortieEcran[] {
  return tableau<Record<string, unknown>>(v).map((s) => ({
    id: String(s.id ?? ""),
    reference: (s.reference ?? s.id) as string | undefined,
    clientId: s.clientId as string | undefined,
    motif: (s.motif ?? s.type) as string | undefined,
    etape: (s.etape ?? s.statut) as string | undefined,
    statut: s.statut as string | undefined,
  }));
}

/**
 * Une sortie est CLOSE quand le moteur le dit — pas quand son statut n'est pas la seule valeur
 * que le seed connaissait. L'écran affichait « CLOS » pour un dossier `CLOTURE_DEMANDEE`,
 * c'est-à-dire l'exact contraire de son état : la clôture est demandée, elle n'est pas faite.
 */
export const sortieClose = (statut?: string): boolean =>
  statut === "CLOS" || statut === "CLOTURE" || statut === "CLOTUREE" || statut === "CLOTURE_EFFECTIVE";

// ── Annuaire BI (/v1/bi/annuaire, R314/R315) ────────────────────────────────────────────────

export type VueBiEcran = { id: string; vue?: string; domaine?: string; colonnes?: number; portee?: string };

/**
 * Moteur : `{ code, source, dimensions[], mesures[], sensibilite }`. La « vue » est le `code`,
 * le « domaine » est la table SOURCE déclarée, et le nombre de colonnes est celui, réel, des
 * dimensions plus les mesures — pas un chiffre décoratif. La sensibilité tient lieu de portée.
 */
export function listeVuesBi(v: unknown): VueBiEcran[] {
  return tableau<Record<string, unknown>>(v).map((b, i) => {
    const dims = Array.isArray(b.dimensions) ? b.dimensions.length : 0;
    const mes = Array.isArray(b.mesures) ? b.mesures.length : 0;
    return {
      id: String(b.id ?? b.code ?? i),
      vue: (b.vue ?? b.code) as string | undefined,
      domaine: (b.domaine ?? b.source) as string | undefined,
      colonnes: typeof b.colonnes === "number" ? b.colonnes : (dims + mes || undefined),
      portee: (b.portee ?? b.sensibilite) as string | undefined,
    };
  });
}

// ── Référentiel AML (/v1/aml/referentiel) ───────────────────────────────────────────────────

export type RegleEcran = { code: string; libelle?: string; seuils?: string; version?: string; alertes12m?: number };

/**
 * Moteur : `{ scenarios: [{ regle, type, niveau, libelle, seuils: [nomsDeParametres] }], seuils: {…} }`.
 * Les `seuils` du scénario sont des NOMS de paramètres (`amlStructuringSeuilChf`) ; leurs
 * valeurs en vigueur sont dans le second bloc. L'adaptateur les rapproche pour rendre une
 * ligne lisible — « seuilChf = 9500 · fenetreH = 168 » — sans jamais inventer un seuil absent.
 * `alertes12m` n'est pas dans cette réponse : c'est un COMPTAGE, il viendra du moteur d'alertes.
 */
export function listeReglesAml(v: unknown): RegleEcran[] {
  if (Array.isArray(v)) return v as RegleEcran[];                    // seed déjà au format écran
  if (!estObjet(v) || !Array.isArray(v.scenarios)) return [];
  const valeurs = estObjet(v.seuils) ? v.seuils : {};
  const lire = (nom: string): string | undefined => {
    // le moteur préfixe les paramètres (`amlStructuringSeuilChf`) et la clé du bloc de valeurs
    // ne l'est pas (`structuringSeuilChf`) : on tente les deux, on n'affiche rien si aucune.
    const court = nom.replace(/^aml/, "");
    const cle = Object.keys(valeurs).find((k) => k === nom || k.toLowerCase() === court.toLowerCase());
    const val = cle ? (valeurs as Record<string, unknown>)[cle] : undefined;
    return val === undefined || val === null ? undefined : `${court} = ${val}`;
  };
  return (v.scenarios as Record<string, unknown>[]).map((s) => ({
    code: String(s.regle ?? s.code ?? ""),
    libelle: s.libelle as string | undefined,
    seuils: (Array.isArray(s.seuils) ? (s.seuils as string[]).map(lire).filter(Boolean).join(" · ") : undefined) || undefined,
    version: s.niveau === undefined ? undefined : `niveau ${s.niveau}`,
    alertes12m: typeof s.alertes12m === "number" ? s.alertes12m : undefined,
  }));
}

// ── Matrice documentaire (/v1/doc-matrix/en-vigueur, R26/R27/R282) ──────────────────────────

export type ExigenceEcran = { code: string; libelle?: string; attendu?: string; etat?: string;
  /** L'axe du moteur — `PP · entite`. Absent du seed plat, présent sur toute réponse vivante. */
  axe?: string };
export type MatriceEcran = { version: string; exigences: ExigenceEcran[] };

/**
 * L'ÉCART LE PLUS PROFOND DE LA SÉRIE, et il n'est pas cosmétique.
 *
 * L'écran affichait une liste plate d'exigences (« justificatif d'origine des fonds », « pièce
 * d'identité de chaque UBO ») avec un ÉTAT — c'est la matrice de la v1, indexée par exigence.
 * Le moteur, lui, détient `contenu.exigences[structure][porteur]` : une matrice indexée par
 * TYPE D'ENTITÉ × PORTEUR × JURIDICTION, sans état — parce que l'état de complétude d'un
 * dossier n'appartient PAS à la matrice : la matrice dit ce qui est EXIGÉ, le dossier dit ce
 * qui est FOURNI. Les deux axes ne sont pas deux versions du même objet.
 *
 * ARBITRAGE PO DU 12.08.2026 : **enrichir le contrat**. Le moteur porte désormais
 * `parRole: { <role>: [exigences] }` (R26 énonçait déjà « type d'entité × juridiction × RÔLE »,
 * et le scénario S-03 nomme les rôles des personnes liées). L'adaptateur aplatit les deux axes :
 * les exigences de socle sortent avec `PP · entite`, celles de rôle avec `SA · rôle UBO`.
 *
 * `etat` reste vide sur une réponse du moteur : rien dans cette réponse ne permet de le remplir.
 * L'écran affiche l'exigence telle qu'elle est gouvernée, jamais un état inventé au rendu.
 */
export function matriceDocumentaire(v: unknown): MatriceEcran {
  if (estObjet(v) && Array.isArray(v.exigences))                     // seed déjà au format écran
    return { version: String(v.version ?? ""), exigences: v.exigences as ExigenceEcran[] };
  if (!estObjet(v) || !estObjet(v.contenu)) return { version: "", exigences: [] };

  const exigences: ExigenceEcran[] = [];
  // Une exigence du moteur : soit un code documentaire nu, soit un groupe d'équivalence R27
  // dont la juridiction choisit le document concret. On montre le groupe ET ses branches.
  const ligne = (item: unknown, axe: string): ExigenceEcran | null => {
    if (typeof item === "string") return { code: item, axe, attendu: "toutes juridictions" };
    if (!estObjet(item)) return null;
    const parJuridiction = estObjet(item.parJuridiction) ? item.parJuridiction : {};
    const attendu = Object.entries(parJuridiction)
      .map(([j, doc]) => `${j === "*" ? "défaut" : j} : ${doc}`).join(" · ");
    return { code: String(item.groupe ?? ""), axe, attendu };
  };

  const parStructure = estObjet(v.contenu.exigences) ? v.contenu.exigences : {};
  for (const [structure, bloc] of Object.entries(parStructure)) {
    if (!estObjet(bloc)) continue;
    for (const [porteur, liste] of Object.entries(bloc)) {
      // `parRole` n'est pas un porteur : c'est le SECOND axe (R26/rôle). Il se déplie d'un cran
      // de plus — sans quoi l'écran afficherait une ligne « SA · parRole » qui ne veut rien dire.
      if (porteur === "parRole") {
        if (!estObjet(liste)) continue;
        for (const [role, exigencesRole] of Object.entries(liste))
          for (const item of Array.isArray(exigencesRole) ? exigencesRole : []) {
            const l = ligne(item, `${structure} · rôle ${role}`);
            if (l) exigences.push(l);
          }
        continue;
      }
      for (const item of Array.isArray(liste) ? liste : []) {
        const l = ligne(item, `${structure} · ${porteur}`);
        if (l) exigences.push(l);
      }
    }
  }
  const version = v.version !== undefined
    ? `v${v.version}${v.enVigueurLe ? ` — en vigueur du ${jour(v.enVigueurLe)}` : ""}` : "";
  return { version, exigences };
}
