import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatTile } from "./StatTile";
import { StatusChip, ChipMode } from "./StatusChip";
import { EntityList } from "./Listes";
import { MODULES_METIERS_DEMO } from "./modules-metiers";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — V2-M29 : CROSS-BORDER, écran de plein droit (étape 2 de `docs/AUDIT-COUVERTURE-V1-V2.md`).
 *
 * Pourquoi un écran entier : le moteur porte DIX-SEPT routes cross-border (`modules/crossborder`,
 * R293-R295 + R453-R462) et la v2 n'en exposait qu'une — la matrice, repliée dans un onglet du
 * dossier KYC. C'était le plus gros écart fonctionnel du produit (E-V2-1).
 *
 * CE QUE L'ÉCRAN DIT DE SES SOURCES. Quatre routes se LISENT et sont branchées :
 * exposition (R460), matrice à date (R453), reporting des ordres (XB-04/R39) et conformité d'un
 * voyage (XB-03). Les trois autres familles — dérogations, actes distants / pré-acte, reverse
 * solicitation et localisations — n'ont au moteur que des routes d'ÉCRITURE : aucune liste ne
 * s'en lit aujourd'hui. Ces onglets tournent donc sur des données de maquette et le disent en
 * toutes lettres ; l'écart est consigné (E-V2-5), il n'est pas maquillé.
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

// ── Les trois familles SANS route de lecture au moteur (écart E-V2-5) : maquette assumée. ──
type Derogation = { id: string; reference: string; objet: string; juridiction: string; motif: string; etat: string };
const SEED_DEROGATIONS: Derogation[] = [
  { id: "d1", reference: "XBD-2026-0031", objet: "Voyage TRP-2026-0114 · Dubaï", juridiction: "AE",
    motif: "Client existant, réunion de gouvernance du family office — aucun démarchage", etat: "VISEE" },
  { id: "d2", reference: "XBD-2026-0034", objet: "Dossier KYC-2026-00447", juridiction: "FR",
    motif: "Signature de documents chez le notaire du client, à sa demande écrite", etat: "EN_ATTENTE_VISA" },
  { id: "d3", reference: "XBD-2026-0036", objet: "Voyage TRP-2026-0121 · Paris", juridiction: "FR",
    motif: "Conférence sectorielle — présence sans rendez-vous client", etat: "REFUSEE" },
];
type ActeXb = { id: string; type: string; objet: string; juridiction: string; verdict: string;
  version: string; at: string };
const SEED_ACTES: ActeXb[] = [
  { id: "a1", type: "Entretien à distance", objet: "CR-2026-0912 · Zhang Wei Family Office", juridiction: "SG",
    verdict: "OUI", version: "XBM-2026-07", at: "08.08.2026" },
  { id: "a2", type: "Pré-acte · ouverture", objet: "KYC-2026-00512 · Nordwind Energie GmbH", juridiction: "DE",
    verdict: "NON", version: "XBM-2026-07", at: "07.08.2026" },
  { id: "a3", type: "Pré-acte · proposition", objet: "OPP-2026-0233 · Levant Shipping Co.", juridiction: "AE",
    verdict: "SOUS_CONDITION", version: "XBM-2026-06", at: "22.07.2026" },
  { id: "a4", type: "Entretien à distance", objet: "CR-2026-0888 · Helvetia Kids", juridiction: "FR",
    verdict: "OUI", version: "XBM-2026-06", at: "18.07.2026" },
];
type PreuveRs = { id: string; client: string; perimetre: string; nature: string; doc: string;
  date: string; visee: boolean };
const SEED_RS: PreuveRs[] = [
  { id: "p1", client: "Zhang Wei Family Office", perimetre: "Mandat de gestion discrétionnaire",
    nature: "Courriel entrant du client", doc: "GED-2026-4412", date: "12.03.2026", visee: true },
  { id: "p2", client: "Levant Shipping Co.", perimetre: "Ouverture de compte courant",
    nature: "Formulaire signé sur le portail", doc: "GED-2026-4790", date: "02.08.2026", visee: false },
  { id: "p3", client: "Nordic Wealth AB", perimetre: "Crédit lombard",
    nature: "Demande écrite du client", doc: "GED-2026-4501", date: "19.05.2026", visee: true },
];
type Localisation = { id: string; client: string; juridiction: string; du: string; au: string; jours: number };
const SEED_LOCALISATIONS: Localisation[] = [
  { id: "l1", client: "Henrik Vallon", juridiction: "AE", du: "01.07.2026", au: "30.09.2026", jours: 91 },
  { id: "l2", client: "Pierre Delacroix", juridiction: "FR", du: "05.08.2026", au: "20.08.2026", jours: 15 },
];

const MODE_VERDICT: Record<string, ChipMode> = { OUI: "ok", NON: "alert", SOUS_CONDITION: "warn" };
const MODE_SEVERITE: Record<string, ChipMode> = { BLOQUANT: "alert", AVERTISSEMENT: "warn", AUTORISE: "ok" };
const MODE_ETAT: Record<string, ChipMode> = { VISEE: "ok", EN_ATTENTE_VISA: "warn", REFUSEE: "alert" };
const LIBELLE_ETAT: Record<string, string> = { VISEE: "VISÉE", EN_ATTENTE_VISA: "EN ATTENTE DE VISA", REFUSEE: "REFUSÉE" };

type Onglet = "exposition" | "matrice" | "derogations" | "actes" | "rs" | "ordres";

export function CrossBorder({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<Onglet>("exposition");
  const [acte, setActe] = useState<Acte | null>(null);

  const expo = useApiOrSeed<typeof SEED_EXPO>("/v1/crossborder/exposition", SEED_EXPO);
  const matrice = useApiOrSeed<Matrice>("/v1/crossborder/matrice", SEED_MATRICE);
  const reporting = useApiOrSeed<Reporting>("/v1/crossborder/reporting", SEED_REPORTING);

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

  // Les onglets sans route de LECTURE au moteur le disent — on ne laisse pas croire à un câblage.
  const bandeauSansLecture = (familles: string) => (
    <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
      borderLeft: "3px solid var(--info-line)", borderRadius: 9, padding: "10px 13px",
      marginBottom: 12, fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.55 }}>
      {t("Le moteur porte les ACTES de cette famille, pas encore sa route de lecture")} — {familles}.{" "}
      {t("La liste ci-dessous est donc une maquette, et le restera tant que la route de lecture n'existe pas (écart E-V2-5). Les gardes annoncées par les boutons, elles, sont celles du moteur.")}
    </div>);

  const sousTitre = {
    exposition: expo.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/exposition (R460) — projection recalculée à chaque appel"),
    matrice: matrice.isDemo ? t("données maquette")
      : t("source : /v1/crossborder/matrice (R453) — version datée immuable"),
    derogations: t("données maquette — le moteur n'expose pas de route de lecture (E-V2-5)"),
    actes: t("données maquette — le moteur n'expose pas de route de lecture (E-V2-5)"),
    rs: t("données maquette — le moteur n'expose pas de route de lecture (E-V2-5)"),
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
        action={<Ui2Bouton onClick={() => onNavigate("kyc")}>{t("Voir la matrice dans un dossier →")}</Ui2Bouton>} t={t} />}>
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
        <EntityList grid="90px 90px 90px 110px 110px 110px 110px" onOpen={() => undefined}
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
        <EntityList grid="90px 1.4fr 150px 1fr" onOpen={() => undefined}
          entetes={[t("Juridiction"), t("Activité"), t("Sévérité"), t("Base déclarée")]}
          lignes={(matrice.data?.entrees ?? []).map((e, i) => ({ id: `${e.juridiction}-${i}`, cells: [
            <span key="j" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{e.juridiction}</span>,
            t(e.activite),
            <StatusChip key="s" mode={MODE_SEVERITE[e.severite] ?? "neutral"}>{t(e.severite)}</StatusChip>,
            <span key="b" style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.base ?? "—"}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le country manual reste LA clé de lecture ; le port ne fait que le VERSIONNER (R453). Il n'y a jamais deux vérités : un acte consigné porte la version qui l'a jugé, et le rejeu la rend telle quelle (R48).")}</div>
      </>)}

      {onglet === "derogations" && (<>
        {bandeauSansLecture(t("demande, visa et conformité d'un voyage s'écrivent"))}
        {barreActes("derogations")}
        <EntityList grid="150px 1.5fr 90px 1.6fr 170px" onOpen={() => undefined}
          entetes={[t("Référence"), t("Objet"), t("Juridiction"), t("Motif"), t("État")]}
          lignes={SEED_DEROGATIONS.map((d) => ({ id: d.id, cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{d.reference}</span>,
            t(d.objet),
            <span key="j" className="mono">{d.juridiction}</span>,
            <span key="m" style={{ fontSize: 11.5, color: "var(--text-body)" }}>{t(d.motif)}</span>,
            <StatusChip key="e" mode={MODE_ETAT[d.etat] ?? "neutral"}>{t(LIBELLE_ETAT[d.etat] ?? d.etat)}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("L'état d'une dérogation est DÉRIVÉ des événements — demande, visa, refus — et non porté par une colonne que l'on corrigerait. Le visa relève d'un rôle habilité (R294) et d'un second regard (R13) : l'initiateur ne vise pas sa propre demande.")}</div>
      </>)}

      {onglet === "actes" && (<>
        {bandeauSansLecture(t("entretien distant, check pré-acte et rejeu s'exécutent"))}
        {barreActes("actes")}
        <EntityList grid="180px 1.6fr 90px 150px 130px 110px" onOpen={() => undefined}
          entetes={[t("Type"), t("Objet"), t("Juridiction"), t("Verdict consigné"),
            t("Version de matrice"), t("Date")]}
          lignes={SEED_ACTES.map((a) => ({ id: a.id, cells: [
            <span key="t" style={{ fontSize: 11.5 }}>{t(a.type)}</span>,
            <span key="o" style={{ fontWeight: 600, color: "var(--text)" }}>{a.objet}</span>,
            <span key="j" className="mono">{a.juridiction}</span>,
            <StatusChip key="v" mode={MODE_VERDICT[a.verdict] ?? "neutral"}>
              {t(a.verdict === "SOUS_CONDITION" ? "SOUS CONDITION" : a.verdict)}</StatusChip>,
            <span key="m" className="mono" style={{ fontSize: 11 }}>{a.version}</span>,
            <span key="d" className="mono">{a.at}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Chaque ligne porte la VERSION de matrice qui l'a jugée. C'est ce qui rend le rejeu possible : le verdict d'époque se relit tel quel (R48), il ne se recalcule pas avec la matrice d'aujourd'hui — sans quoi un acte régulier hier deviendrait irrégulier demain, sans qu'aucun fait n'ait changé.")}</div>
      </>)}

      {onglet === "rs" && (<>
        {bandeauSansLecture(t("enregistrement, visa et déclaration de localisation s'écrivent"))}
        {barreActes("rs")}
        <EntityList grid="1.4fr 1.4fr 1.3fr 130px 110px 110px" onOpen={() => undefined}
          entetes={[t("Client"), t("Périmètre"), t("Nature de la preuve"), t("Document GED"),
            t("Date"), t("Visa")]}
          lignes={SEED_RS.map((p) => ({ id: p.id, cells: [
            <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{p.client}</span>,
            t(p.perimetre),
            t(p.nature),
            <span key="d" className="mono" style={{ fontSize: 11 }}>{p.doc}</span>,
            <span key="t" className="mono">{p.date}</span>,
            <StatusChip key="v" mode={p.visee ? "ok" : "warn"}>
              {t(p.visee ? "VISÉE" : "À VISER")}</StatusChip>] }))} />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", margin: "16px 0 8px" }}>
          {t("Localisations temporaires")} <span style={{ fontWeight: 400, fontSize: 11,
            color: "var(--text-muted)" }}>{t("(R457 — la juridiction applicable à un acte)")}</span></div>
        <EntityList grid="1.4fr 90px 110px 110px 110px" onOpen={() => undefined}
          entetes={[t("Client"), t("Juridiction"), t("Du"), t("Au"), t("Durée")]}
          lignes={SEED_LOCALISATIONS.map((l) => ({ id: l.id, cells: [
            <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{l.client}</span>,
            <span key="j" className="mono">{l.juridiction}</span>,
            <span key="d" className="mono">{l.du}</span>,
            <span key="a" className="mono">{l.au}</span>,
            <StatusChip key="x" mode={l.jours > 90 ? "warn" : "neutral"}>
              {`${l.jours} ${t("j")}`}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Une localisation temporaire EXPIRE d'elle-même : elle n'a pas besoin d'être clôturée à la main, et le rejeu résout la juridiction qui s'appliquait à la date de l'acte. Au-delà de la durée gouvernée, ce n'est plus une localisation temporaire mais une question de résidence — le moteur refuse et demande une revue.")}</div>
      </>)}

      {onglet === "ordres" && (<>
        {barreActes("ordres")}
        <EntityList grid="120px 130px 190px 160px" onOpen={() => undefined}
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
