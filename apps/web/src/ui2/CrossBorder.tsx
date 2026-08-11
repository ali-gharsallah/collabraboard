import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { StatusChip, ChipMode } from "./StatusChip";
import { EntityList } from "./Listes";
import { MODULES_METIERS_DEMO } from "./modules-metiers";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — V2-M29 : CROSS-BORDER, écran de plein droit (étape 2 de `docs/AUDIT-COUVERTURE-V1-V2.md`).
 *
 * Pourquoi un écran entier : le moteur porte DIX-SEPT routes cross-border (`modules/crossborder`,
 * R293-R295 + R453-R462) et la v2 n'en exposait qu'une — la matrice, repliée dans un onglet du
 * dossier KYC. C'était le plus gros écart fonctionnel du produit (E-V2-1).
 *
 * CE QUE L'ÉCRAN DIT DE SES SOURCES (V2-M30) — les SIX onglets lisent le moteur. Aux quatre
 * routes de lecture d'origine (exposition R460, matrice à date R453, reporting des ordres
 * XB-04/R39, conformité d'un voyage XB-03) s'ajoutent les trois qui manquaient : dérogations,
 * actes & pré-actes, sollicitation inversée & localisations. Elles sont des PROJECTIONS des
 * événements, calculées à chaque appel — aucune table nouvelle, donc aucune seconde vérité à
 * désynchroniser du journal (R49). L'écart E-V2-5 est soldé.
 *
 * R44 : aucun bouton ci-dessous n'exécute une décision. Chaque acte NOMME sa garde et sa route ;
 * la dérogation se motive et se vise par un second regard, la preuve de reverse solicitation se
 * vise, le verdict d'un acte se REJOUE tel qu'il fut consigné (R48) — jamais recalculé.
 */

type Acte = { cle: string; libelle: string; route: string; garde: string };

const ACTES: Record<string, Acte[]> = {
  matrice: [
    { cle: "sync", libelle: "Synchroniser le country manual", route: "POST /v1/crossborder/matrice/sync",
      garde: "R453 — la synchronisation crée une VERSION datée immuable. Une dégradation crée des tâches nominatives et notifie (R459) ; elle n'annule aucun voyage ni aucun acte déjà consigné (R29/R44)." },
    { cle: "asof", libelle: "Lire la matrice à une date", route: "GET /v1/crossborder/matrice?asOf=…",
      garde: "R453/R29 — un acte garde la version en vigueur au moment où il a été posé. La matrice « courante » ne répond jamais pour un acte passé." },
  ],
  derogations: [
    { cle: "demander", libelle: "Demander une dérogation", route: "POST /v1/crossborder/derogations",
      garde: "R7 — une dérogation cross-border exige un MOTIF écrit, et un objet : un voyage ou un dossier KYC." },
    { cle: "viser", libelle: "Viser une dérogation", route: "POST /v1/crossborder/derogations/:id/visa",
      garde: "R294 + R13 — le visa relève d'un rôle habilité (visa_derogation_xb) et exige un SECOND regard : l'initiateur ne vise pas sa propre demande." },
    { cle: "conformite", libelle: "Vérifier la conformité d'un voyage", route: "GET /v1/crossborder/voyages/:id/conformite",
      garde: "XB-03 — l'état de conformité est DÉRIVÉ des événements du voyage, jamais saisi à la main." },
  ],
  actes: [
    { cle: "distant", libelle: "Consigner un entretien à distance", route: "POST /v1/crossborder/actes-distants",
      garde: "R454 — un entretien distant subit le même check qu'un déplacement, et le verdict est CONSIGNÉ dans le compte rendu. Verdict NON : la création exige une qualification Compliance préalable." },
    { cle: "preacte", libelle: "Vérifier avant un acte", route: "POST /v1/crossborder/pre-acte",
      garde: "R455 — le check s'exécute AVANT l'acte et son verdict, avec la version de matrice, reste attaché à l'objet. Une sévérité BLOQUANT refuse l'acte ; elle ne l'« avertit » pas." },
    { cle: "rejeu", libelle: "Rejouer un verdict à date", route: "GET /v1/crossborder/actes/:id/rejeu?asOf=…",
      garde: "R48/R49 — le rejeu rend le verdict d'époque tel qu'il fut consigné. Il n'est jamais recalculé avec la matrice d'aujourd'hui." },
  ],
  rs: [
    { cle: "preuve", libelle: "Enregistrer une preuve de sollicitation inversée", route: "POST /v1/crossborder/reverse-solicitation",
      garde: "R456 — la preuve est un OBJET : nature, document GED, date, périmètre. Les rôles habilités à l'enregistrer sont gouvernés (registre §CrossBorder, R462)." },
    { cle: "rsvisa", libelle: "Viser une preuve", route: "POST /v1/crossborder/reverse-solicitation/:id/visa",
      garde: "R456 + R13 — une preuve non visée ne couvre rien : le second regard est la condition de son opposabilité." },
    { cle: "localisation", libelle: "Déclarer une localisation temporaire", route: "POST /v1/crossborder/localisations",
      garde: "R457 — la localisation est un événement DATÉ qui expire de lui-même ; au-delà de la durée gouvernée, une revue de résidence est requise. Le rejeu résout la juridiction applicable à la date de l'acte." },
  ],
  ordres: [
    { cle: "ordre", libelle: "Enregistrer un ordre reçu", route: "POST /v1/crossborder/ordres",
      garde: "XB-04/R295 — la réception d'un ordre depuis une juridiction sous contrainte est DOCUMENTÉE ou REFUSÉE ; en EDD, la preuve GED est exigée." },
  ],
  parametres: [
    { cle: "param", libelle: "Modifier un paramètre §CrossBorder", route: "POST /v1/crossborder/params/modifier",
      garde: "R462 + R445 — pop-up d'engagement de responsabilité : la diffusion transfrontière et les exemptions engagent la banque vis-à-vis des régulateurs étrangers. La portée est « actes futurs » — grandfathering R29 sur les checks déjà consignés." },
  ],
};

// ── Exposition consolidée (R460) — PROJECTION recalculée à chaque appel, jamais stockée. ──
type LigneExposition = { juridiction: string; clients: number; aum: number | null; voyages: number;
  actesDistants: number; derogations: number; preuvesActives: number; certifications: number };
const SEED_EXPO: { parJuridiction: LigneExposition[]; calculeLe: string } = {
  calculeLe: "2026-08-11T09:12:00.000Z",
  parJuridiction: [
    { juridiction: "FR", clients: 34, aum: null, voyages: 6, actesDistants: 11, derogations: 2, preuvesActives: 5, certifications: 3 },
    { juridiction: "DE", clients: 21, aum: null, voyages: 4, actesDistants: 7, derogations: 1, preuvesActives: 2, certifications: 2 },
    { juridiction: "GB", clients: 18, aum: null, voyages: 5, actesDistants: 9, derogations: 0, preuvesActives: 4, certifications: 2 },
    { juridiction: "AE", clients: 9, aum: null, voyages: 3, actesDistants: 4, derogations: 3, preuvesActives: 1, certifications: 0 },
    { juridiction: "SG", clients: 7, aum: null, voyages: 2, actesDistants: 3, derogations: 0, preuvesActives: 2, certifications: 1 },
    { juridiction: "US", clients: 4, aum: null, voyages: 1, actesDistants: 2, derogations: 1, preuvesActives: 0, certifications: 0 },
  ],
};

// ── Matrice pays (R453) — version datée, source déclarée, entrées juridiction × activité. ──
type EntreeMatrice = { juridiction: string; activite: string; severite: string; base?: string };
type Matrice = { versionId: string; at: string; source: string; entrees: EntreeMatrice[];
  syncEnEchec: boolean; noteSync?: string };
const SEED_MATRICE: Matrice = {
  versionId: "XBM-2026-07", at: "2026-07-28T04:00:00.000Z", source: "country-manual-interne",
  syncEnEchec: true, noteSync: "matrice du 2026-07-28 — synchronisation en échec depuis 14 j",
  entrees: [
    { juridiction: "FR", activite: "Démarchage actif", severite: "BLOQUANT", base: "Country manual §FR-2" },
    { juridiction: "FR", activite: "Entretien à distance", severite: "AVERTISSEMENT", base: "Country manual §FR-5" },
    { juridiction: "DE", activite: "Démarchage actif", severite: "BLOQUANT", base: "Country manual §DE-1" },
    { juridiction: "GB", activite: "Réception d'ordre", severite: "AUTORISE", base: "Country manual §GB-3" },
    { juridiction: "AE", activite: "Démarchage actif", severite: "BLOQUANT", base: "Country manual §AE-1" },
    { juridiction: "AE", activite: "Réception d'ordre", severite: "AVERTISSEMENT", base: "Country manual §AE-4" },
    { juridiction: "US", activite: "Démarchage actif", severite: "BLOQUANT", base: "Country manual §US-1" },
    { juridiction: "SG", activite: "Entretien à distance", severite: "AUTORISE", base: "Country manual §SG-2" },
  ],
};

// ── Reporting des ordres (XB-04/R39) — mesuré et notifié, jamais un blocage. ──
type Reporting = { parPays: Record<string, { total: number; reverseSolicitation: number }> };
const SEED_REPORTING: Reporting = { parPays: {
  FR: { total: 41, reverseSolicitation: 12 }, GB: { total: 27, reverseSolicitation: 3 },
  AE: { total: 14, reverseSolicitation: 9 }, DE: { total: 11, reverseSolicitation: 1 },
  SG: { total: 6, reverseSolicitation: 2 } } };

// ── Les trois familles, DÉSORMAIS LUES (V2-M30) — mêmes formes que les projections du moteur
//    (`GET /derogations`, `/actes`, `/reverse-solicitation`). Les seeds miment ces formes : quand
//    l'API répond, rien ne change à l'écran. L'état d'une dérogation ne connaît que deux valeurs,
//    parce que le moteur n'émet pas d'événement de refus — l'écran n'en invente pas un troisième.
type Derogation = { id: string; objet: string | null; typeObjet: string | null;
  juridiction: string | null; motif: string | null; demandePar: string | null;
  etat: "VISEE" | "EN_ATTENTE_VISA"; visePar: string | null };
const SEED_DEROGATIONS: { lignes: Derogation[] } = { lignes: [
  { id: "XBD-2026-0031", objet: "TRP-2026-0114 · Dubaï", typeObjet: "voyage", juridiction: "AE",
    motif: "Client existant, réunion de gouvernance du family office — aucun démarchage",
    demandePar: "c.morel", etat: "VISEE", visePar: "m.bregy" },
  { id: "XBD-2026-0034", objet: "KYC-2026-00447", typeObjet: "dossier", juridiction: "FR",
    motif: "Signature de documents chez le notaire du client, à sa demande écrite",
    demandePar: "s.berger", etat: "EN_ATTENTE_VISA", visePar: null },
  { id: "XBD-2026-0036", objet: "TRP-2026-0121 · Paris", typeObjet: "voyage", juridiction: "FR",
    motif: "Conférence sectorielle — présence sans rendez-vous client",
    demandePar: "c.morel", etat: "EN_ATTENTE_VISA", visePar: null },
] };

type ActeXb = { id: string; famille: string; type: string | null; client: string | null;
  juridiction: string | null; verdict: string | null; passe: boolean;
  versionMatrice: string | null; at: string | null; canal?: string | null; rejouable: boolean };
const SEED_ACTES: { lignes: ActeXb[] } = { lignes: [
  { id: "CR-2026-0912", famille: "acte-distant", type: "Conseil", client: "Zhang Wei Family Office",
    juridiction: "SG", verdict: "OUI", passe: true, versionMatrice: "XBM-2026-07",
    at: "2026-08-08", canal: "Visioconférence", rejouable: false },
  { id: "KYC-2026-00512", famille: "pre-acte", type: "PROSP", client: "Nordwind Energie GmbH",
    juridiction: "DE", verdict: "NON", passe: false, versionMatrice: "XBM-2026-07",
    at: "2026-08-07", rejouable: true },
  { id: "OPP-2026-0233", famille: "pre-acte", type: "MKT", client: "Levant Shipping Co.",
    juridiction: "AE", verdict: "SOUS_CONDITION", passe: true, versionMatrice: "XBM-2026-06",
    at: "2026-07-22", rejouable: true },
  { id: "CR-2026-0888", famille: "acte-distant", type: "Courtoisie", client: "Helvetia Kids",
    juridiction: "FR", verdict: "OUI", passe: true, versionMatrice: "XBM-2026-06",
    at: "2026-07-18", canal: "Email", rejouable: false },
] };

type PreuveRs = { id: string; client: string | null; perimetre: string | null; nature: string | null;
  docId: string | null; date: string | null; visee: boolean };
type Localisation = { clientId: string; client: string | null; juridiction: string | null;
  du: string | null; au: string | null; jours: number | null; active: boolean };
const SEED_RS: { preuves: PreuveRs[]; localisations: Localisation[] } = {
  preuves: [
    { id: "p1", client: "Zhang Wei Family Office", perimetre: "Mandat de gestion discrétionnaire",
      nature: "Courriel entrant du client", docId: "GED-2026-4412", date: "2026-03-12", visee: true },
    { id: "p2", client: "Levant Shipping Co.", perimetre: "Ouverture de compte courant",
      nature: "Formulaire signé sur le portail", docId: "GED-2026-4790", date: "2026-08-02", visee: false },
    { id: "p3", client: "Nordic Wealth AB", perimetre: "Crédit lombard",
      nature: "Demande écrite du client", docId: "GED-2026-4501", date: "2026-05-19", visee: true },
  ],
  localisations: [
    { clientId: "l1", client: "Henrik Vallon", juridiction: "AE", du: "2026-07-01", au: "2026-09-30", jours: 91, active: true },
    { clientId: "l2", client: "Pierre Delacroix", juridiction: "FR", du: "2026-08-05", au: "2026-08-20", jours: 15, active: true },
  ],
};

const MODE_VERDICT: Record<string, ChipMode> = { OUI: "ok", NON: "alert", SOUS_CONDITION: "warn" };
const MODE_SEVERITE: Record<string, ChipMode> = { BLOQUANT: "alert", AVERTISSEMENT: "warn", AUTORISE: "ok" };
const MODE_ETAT: Record<string, ChipMode> = { VISEE: "ok", EN_ATTENTE_VISA: "warn" };
const LIBELLE_ETAT: Record<string, string> = { VISEE: "VISÉE", EN_ATTENTE_VISA: "EN ATTENTE DE VISA" };

type Onglet = "exposition" | "matrice" | "derogations" | "actes" | "rs" | "ordres";

export function CrossBorder({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<Onglet>("exposition");
  const [filtre, setFiltre] = useState<string | null>(null);   // juridiction ouverte depuis l'exposition
  const [acte, setActe] = useState<Acte | null>(null);
  // V2-M33 : ouvrir une ligne mène à l'ACTE qui la concerne — un clic qui ne va nulle part
  // vaut moins qu'une ligne non cliquable.
  const ouvrirActe = (famille: string, cle: string) => {
    const a = (ACTES[famille] ?? []).find((x) => x.cle === cle) ?? null;
    if (a) setActe(a);
  };

  const expo = useApiOrSeed<typeof SEED_EXPO>("/v1/crossborder/exposition", SEED_EXPO);
  const matrice = useApiOrSeed<Matrice>("/v1/crossborder/matrice", SEED_MATRICE);
  const reporting = useApiOrSeed<Reporting>("/v1/crossborder/reporting", SEED_REPORTING);
  // V2-M30 : les trois familles qui n'avaient que des routes d'écriture se LISENT (E-V2-5 soldé).
  const derog = useApiOrSeed<typeof SEED_DEROGATIONS>("/v1/crossborder/derogations", SEED_DEROGATIONS);
  const actes = useApiOrSeed<typeof SEED_ACTES>("/v1/crossborder/actes", SEED_ACTES);
  const rs = useApiOrSeed<typeof SEED_RS>("/v1/crossborder/reverse-solicitation", SEED_RS);

  const lignes = Array.isArray(expo.data?.parJuridiction) ? expo.data.parJuridiction : [];
  const totalClients = lignes.reduce((s, l) => s + (l.clients ?? 0), 0);
  const totalDerogations = lignes.reduce((s, l) => s + (l.derogations ?? 0), 0);
  const totalPreuves = lignes.reduce((s, l) => s + (l.preuvesActives ?? 0), 0);
  const bloquantes = (matrice.data?.entrees ?? []).filter((e) => e.severite === "BLOQUANT").length;

  const pilule = (id: Onglet, label: string) => (
    <button key={id} onClick={() => { setOnglet(id); setActe(null); }} aria-pressed={onglet === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: onglet === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: onglet === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: onglet === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);

  // Barre d'actes : le clic n'exécute rien, il DIT l'acte, sa garde et sa route. Tant que
  // l'écran tourne sur la maquette, c'est la seule chose honnête à faire — et le branchement
  // reste trivial puisque la route est déjà nommée.
  const barreActes = (cle: string) => {
    const actes = ACTES[cle];
    if (!actes) return null;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {actes.map((a) => (
            <Ui2Bouton key={a.cle} onClick={() => setActe(acte?.cle === a.cle ? null : a)}>
              {t(a.libelle)}</Ui2Bouton>))}
        </div>
        {acte && actes.some((a) => a.cle === acte.cle) && (
          <div role="status" style={{ marginTop: 9, background: "var(--warn-card)",
            border: "1px solid var(--warn-card-border)", borderLeft: "3px solid var(--warn-line)",
            borderRadius: 9, padding: "11px 13px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{t(acte.libelle)}</div>
            <div style={{ fontSize: 12, color: "var(--text-body)", marginTop: 4, lineHeight: 1.55 }}>
              {t(acte.garde)}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
              {acte.route}</div>
          </div>)}
      </div>);
  };

  const sousTitre = {
    exposition: expo.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/exposition (R460) — projection recalculée à chaque appel"),
    matrice: matrice.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/matrice (R453) — version datée immuable"),
    derogations: derog.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/derogations (XB-03 — état dérivé du visa, jamais une colonne)"),
    actes: actes.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/actes (R454/R455 — chaque acte porte la version qui l'a jugé)"),
    rs: rs.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/reverse-solicitation (R456/R457 — visa porté, expiration calculée)"),
    ordres: reporting.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/reporting (XB-04/R39) — mesuré et notifié, jamais bloquant"),
  }[onglet];

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Camille Morel" role={t("Relationship Manager")}
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }}
      modulesLicencies={MODULES_METIERS_DEMO} />}
      header={<Ui2HeaderListe titre={t("Cross-Border")} sousTitre={sousTitre}
        filtres={<StatusChip mode="info">{t("MODULE LICENCIÉ")}</StatusChip>}
        action={<><Ui2Bouton onClick={() => exporterCsv(`olive-crossborder-${onglet}-${jourFichier()}`,
          [t("Onglet"), t("Juridiction filtrée"), t("Exporté le")],
          [[onglet, filtre ?? t("toutes"), new Date().toISOString().slice(0, 10)]])}>
          {t("Exporter")}</Ui2Bouton>
          <Ui2Bouton onClick={() => onNavigate("kyc")}>{t("Voir la matrice dans un dossier →")}</Ui2Bouton></>} t={t} />}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {pilule("exposition", t("Exposition"))}
        {pilule("matrice", t("Matrice pays"))}
        {pilule("derogations", t("Dérogations"))}
        {pilule("actes", t("Actes & pré-acte"))}
        {pilule("rs", t("Sollicitation inversée"))}
        {pilule("ordres", t("Ordres & reporting"))}
      </div>

      {onglet === "exposition" && (<>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10,
          marginBottom: 14 }}>
          {/* Règle StatTile : un chiffre sans chemin n'existe pas — chaque tuile ouvre l'onglet
              où son détail se lit. */}
          <StatTile valeur={String(lignes.length)} label={t("juridictions exposées")}
            onOpen={() => setOnglet("matrice")} />
          <StatTile valeur={String(totalClients)} label={t("clients concernés")}
            onOpen={() => setOnglet("matrice")} />
          <StatTile valeur={String(totalDerogations)} label={t("dérogations visées")} accent="warn"
            onOpen={() => setOnglet("derogations")} />
          <StatTile valeur={String(totalPreuves)} label={t("preuves RS actives")}
            onOpen={() => setOnglet("rs")} />
        </div>
        <EntityList grid="90px 90px 90px 110px 110px 110px 110px" onOpen={(j) => { setOnglet("matrice"); setFiltre(j); }}
          entetes={[t("Juridiction"), t("Clients"), t("Voyages"), t("Actes distants"),
            t("Dérogations"), t("Preuves RS"), t("Certifications")]}
          lignes={lignes.map((l) => ({ id: l.juridiction, cells: [
            <span key="j" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{l.juridiction}</span>,
            <span key="c" className="mono">{l.clients}</span>,
            <span key="v" className="mono">{l.voyages}</span>,
            <span key="a" className="mono">{l.actesDistants}</span>,
            <span key="d" className="mono">{l.derogations}</span>,
            <span key="p" className="mono">{l.preuvesActives}</span>,
            <span key="x" className="mono">{l.certifications}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("L'AUM par juridiction n'est PAS affiché : le modèle ne le porte pas. Le moteur renvoie une valeur nulle plutôt qu'un chiffre reconstitué — un indicateur inventé dans un tableau d'exposition transfrontière est une faute, pas une approximation.")}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
          {t("R460 — cette vue est une PROJECTION recalculée à chaque appel à partir des événements ; elle n'est jamais stockée, donc jamais désynchronisée du journal.")}</div>
      </>)}

      {onglet === "matrice" && (<>
        {filtre && (
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <StatusChip mode="info">{`${t("juridiction")} ${filtre}`}</StatusChip>
            <Ui2Bouton onClick={() => setFiltre(null)}>{t("Voir toutes les juridictions")}</Ui2Bouton>
          </div>)}
        {barreActes("matrice")}
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "12px 16px",
          marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
              {matrice.data?.versionId ?? "—"}</span>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {t("source déclarée")} : <span className="mono">{matrice.data?.source ?? "—"}</span></span>
            <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
              {t("en vigueur depuis")} <span className="mono">{String(matrice.data?.at ?? "").slice(0, 10)}</span></span>
            <span style={{ marginLeft: "auto" }}>
              <StatusChip mode={bloquantes > 0 ? "alert" : "ok"}>
                {`${bloquantes} ${t("entrées BLOQUANT")}`}</StatusChip></span>
          </div>
          {matrice.data?.syncEnEchec && (
            <div role="status" style={{ marginTop: 10, background: "var(--warn-card)",
              border: "1px solid var(--warn-card-border)", borderLeft: "3px solid var(--warn-line)",
              borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "var(--warn-text)",
              lineHeight: 1.55 }}>
              {t(matrice.data.noteSync ?? "synchronisation en échec")} — {t("la dernière version connue continue d'être servie, et son ÂGE est porté à l'écran. Une matrice périmée qui se tait est plus dangereuse qu'une matrice absente.")}
            </div>)}
        </section>
        <EntityList grid="90px 1.4fr 150px 1fr" onOpen={() => ouvrirActe("matrice", "asof")}
          entetes={[t("Juridiction"), t("Activité"), t("Sévérité"), t("Base déclarée")]}
          lignes={(matrice.data?.entrees ?? []).filter((e) => !filtre || e.juridiction === filtre)
            .map((e, i) => ({ id: `${e.juridiction}-${i}`, cells: [
            <span key="j" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{e.juridiction}</span>,
            t(e.activite),
            <StatusChip key="s" mode={MODE_SEVERITE[e.severite] ?? "neutral"}>{t(e.severite)}</StatusChip>,
            <span key="b" style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.base ?? "—"}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le country manual reste LA clé de lecture ; le port ne fait que le VERSIONNER (R453). Il n'y a jamais deux vérités : un acte consigné porte la version qui l'a jugé, et le rejeu la rend telle quelle (R48).")}</div>
      </>)}

      {onglet === "derogations" && (<>
        {barreActes("derogations")}
        <EntityList grid="150px 1.5fr 90px 1.6fr 170px" onOpen={() => ouvrirActe("derogations", "viser")}
          entetes={[t("Référence"), t("Objet"), t("Juridiction"), t("Motif"), t("État")]}
          lignes={(derog.data?.lignes ?? []).map((d) => ({ id: d.id, cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
              {String(d.id).slice(0, 14)}</span>,
            <span key="o">{d.objet ?? "—"}
              <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>
                {t(d.typeObjet === "voyage" ? "voyage" : d.typeObjet === "dossier" ? "dossier KYC" : "—")}</span></span>,
            <span key="j" className="mono">{d.juridiction ?? "—"}</span>,
            <span key="m" style={{ fontSize: 11.5, color: "var(--text-body)" }}>{d.motif ?? "—"}</span>,
            <StatusChip key="e" mode={MODE_ETAT[d.etat] ?? "neutral"}>
              {t(LIBELLE_ETAT[d.etat] ?? d.etat)}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("L'état d'une dérogation est DÉRIVÉ des événements : elle est « visée » parce que l'événement de visa existe, pas parce qu'une colonne le dit — donc rien ici ne se corrige à la main. Le moteur n'émet pas d'événement de refus : il n'y a que deux états, et l'écran n'en invente pas un troisième. Le visa relève d'un rôle habilité (R294) et d'un second regard (R13).")}</div>
      </>)}

      {onglet === "actes" && (<>
        {barreActes("actes")}
        <EntityList grid="130px 1.6fr 90px 150px 130px 110px" onOpen={() => ouvrirActe("actes", "rejeu")}
          entetes={[t("Famille"), t("Objet"), t("Juridiction"), t("Verdict consigné"),
            t("Version de matrice"), t("Date")]}
          lignes={(actes.data?.lignes ?? []).map((a) => ({ id: a.id, cells: [
            <span key="f" style={{ fontSize: 11 }}>
              {t(a.famille === "pre-acte" ? "Pré-acte" : "Entretien distant")}
              <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>
                {a.type ?? a.canal ?? "—"}</span></span>,
            <span key="o" style={{ fontWeight: 600, color: "var(--text)" }}>{a.client ?? a.id}</span>,
            <span key="j" className="mono">{a.juridiction ?? "—"}</span>,
            <StatusChip key="v" mode={MODE_VERDICT[a.verdict ?? ""] ?? "neutral"}>
              {t(a.verdict === "SOUS_CONDITION" ? "SOUS CONDITION" : a.verdict ?? "—")}</StatusChip>,
            <span key="m" className="mono" style={{ fontSize: 11 }}>
              {String(a.versionMatrice ?? "—").slice(0, 14)}</span>,
            <span key="d" className="mono">{String(a.at ?? "—").slice(0, 10)}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Chaque ligne porte la VERSION de matrice qui l'a jugée. C'est ce qui rend le rejeu possible : le verdict d'époque se relit tel quel (R48), il ne se recalcule pas avec la matrice d'aujourd'hui — sans quoi un acte régulier hier deviendrait irrégulier demain, sans qu'aucun fait n'ait changé.")}</div>
      </>)}

      {onglet === "rs" && (<>
        {barreActes("rs")}
        <EntityList grid="1.4fr 1.4fr 1.3fr 130px 110px 110px" onOpen={() => ouvrirActe("rs", "rsvisa")}
          entetes={[t("Client"), t("Périmètre"), t("Nature de la preuve"), t("Document GED"),
            t("Date"), t("Visa")]}
          lignes={(rs.data?.preuves ?? []).map((p) => ({ id: p.id, cells: [
            <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{p.client ?? "—"}</span>,
            p.perimetre ?? "—",
            p.nature ?? "—",
            <span key="d" className="mono" style={{ fontSize: 11 }}>{p.docId ?? "—"}</span>,
            <span key="t" className="mono">{String(p.date ?? "—").slice(0, 10)}</span>,
            <StatusChip key="v" mode={p.visee ? "ok" : "warn"}>
              {t(p.visee ? "VISÉE" : "À VISER")}</StatusChip>] }))} />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: "16px 0 8px" }}>
          {t("Localisations temporaires")} <span style={{ fontWeight: 400, fontSize: 11,
            color: "var(--text-muted)" }}>{t("(R457 — la juridiction applicable à un acte)")}</span></div>
        <EntityList grid="1.4fr 90px 110px 110px 110px 110px" onOpen={() => ouvrirActe("rs", "localisation")}
          entetes={[t("Client"), t("Juridiction"), t("Du"), t("Au"), t("Durée"), t("En cours")]}
          lignes={(rs.data?.localisations ?? []).map((l) => ({ id: l.clientId, cells: [
            <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{l.client ?? l.clientId}</span>,
            <span key="j" className="mono">{l.juridiction ?? "—"}</span>,
            <span key="d" className="mono">{String(l.du ?? "—").slice(0, 10)}</span>,
            <span key="a" className="mono">{String(l.au ?? "—").slice(0, 10)}</span>,
            <StatusChip key="x" mode={(l.jours ?? 0) > 90 ? "warn" : "neutral"}>
              {`${l.jours ?? "—"} ${t("j")}`}</StatusChip>,
            <StatusChip key="e" mode={l.active ? "info" : "neutral"}>
              {t(l.active ? "ACTIVE" : "ÉCHUE")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Une localisation temporaire EXPIRE d'elle-même : « en cours » n'est pas un statut stocké, il se CALCULE à la lecture en comparant la période à la date demandée (R48). Elle n'a donc pas besoin d'être clôturée à la main, et le rejeu résout la juridiction qui s'appliquait à la date de l'acte. Au-delà de la durée gouvernée, ce n'est plus une localisation temporaire mais une question de résidence — le moteur refuse et demande une revue.")}</div>
      </>)}

      {onglet === "ordres" && (<>
        {barreActes("ordres")}
        <EntityList grid="120px 130px 190px 160px" onOpen={() => ouvrirActe("ordres", "ordre")}
          entetes={[t("Pays"), t("Ordres reçus"), t("dont sollicitation inversée"), t("Part couverte")]}
          lignes={Object.entries(reporting.data?.parPays ?? {}).map(([pays, v]) => ({ id: pays, cells: [
            <span key="p" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{pays}</span>,
            <span key="t" className="mono">{v.total}</span>,
            <span key="r" className="mono">{v.reverseSolicitation}</span>,
            <StatusChip key="c" mode={v.reverseSolicitation / Math.max(1, v.total) > 0.5 ? "warn" : "neutral"}>
              {`${Math.round((v.reverseSolicitation / Math.max(1, v.total)) * 100)} %`}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Ce reporting MESURE et NOTIFIE (R39) : il ne bloque aucun ordre et ne clôt aucun dossier. Une part de sollicitation inversée qui monte est un signal à instruire — pas une infraction constatée par la machine.")}</div>
      </>)}

      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.5 }}>
        {t("R44 — le moteur cross-border qualifie une activité au regard d'une matrice gouvernée et CONSIGNE son verdict. Il ne sanctionne pas, ne clôt pas un dossier et n'annule pas un déplacement : une dégradation de la matrice crée des tâches nominatives et notifie, l'humain décide. Le registre §CrossBorder (R462) qui gouverne sévérités, entités et exemptions se modifie sous engagement de responsabilité (R445).")}</div>
    </Ui2Shell>);
}

export default CrossBorder;
