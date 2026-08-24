import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { BarreActes, ActeMoteur } from "./acte-moteur";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { jour } from "./moteur-formes";
import { exporterCsv, jourFichier } from "./actions";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M54 — LEGAL (†LEGAL), troisième vertical du compartiment paresseux.
 *
 * « Semer d'abord, bâtir ensuite » : /v1/legal/* répondait `[]` — le lot a d'abord donné un
 * corps au registre PAR LES VRAIES ROUTES (chapitre 8i du seed : la pièce GED, puis deux
 * objets aux statuts calculés différents), et l'écran est câblé sur ces formes OBSERVÉES.
 * Au passage, le chapitre de seed a reproduit puis corrigé la famille de défaut que cette
 * campagne traque : la route GED renvoie `documentId`, pas `id` — lu sous le mauvais nom, les
 * objets sautaient EN SILENCE. Le chapitre consigne désormais un ✗ explicite dans ce cas.
 *
 * CE QUE L'ÉCRAN TIENT, parce que c'est la doctrine du moteur (R312-R313) :
 *   · le registre vit SUR LA GED : un contrat sans sa pièce n'existe pas (R312) — le moteur
 *     refuse la création sans documentId, et refuse un documentId inconnu du tenant
 *     (« un identifiant ne prouve rien ») ;
 *   · les échéances sont CALCULÉES des dates (R313) — COURANT, PREAVIS_OUVERT, EN_RETARD,
 *     SANS_ECHEANCE sont des FAITS, jamais une colonne saisie ; rien n'est jamais bloqué (R39) ;
 *   · modifier les dates est un ÉVÉNEMENT MOTIVÉ (R7), jamais une réécriture ;
 *   · la version de la pièce se résout À DATE (R48) : « par référence » rend l'objet ET la
 *     version en vigueur au moment demandé, avec son empreinte.
 */

type ObjetLegal = { id: string; type?: string; reference?: string; parties?: string[];
  documentId?: string; dateEffet?: string | null; dateFin?: string | null;
  preavisJours?: number | null; tacite?: boolean; fournisseur?: string | null;
  rattachements?: { clientId?: string; juridiction?: string } };
type Echeance = { id: string; reference?: string; type?: string; dateFin?: string | null;
  preavisJours?: number | null; tacite?: boolean; statut?: string };

// Seeds au format EXACT du moteur — relevés sur l'API vivante après le semis 8i. Les DEUX
// statuts calculés y figurent : un préavis OUVERT et un sans échéance — une liste où tout est
// « courant » ne montrerait pas ce que R313 calcule (leçon U2-73).
const SEED_OBJETS: ObjetLegal[] = [
  { id: "016e5fb7-1744-4e2a-9c62-c15a1bcb3f9a", type: "CONTRAT", reference: "LEG-2026-0001",
    parties: ["Gharsallah Wealth Bank", "Nordwind Handel SA"],
    documentId: "5e8251f6-f8aa-4698-a750-cacbc400a314", dateEffet: "2025-09-01",
    dateFin: "2026-09-15", preavisJours: 90, tacite: true, fournisseur: null,
    rattachements: { juridiction: "CH" } },
  { id: "58b7d86d-37e2-42e5-b1af-618a74f0893b", type: "MEMO", reference: "LEG-2026-0002",
    parties: ["Gharsallah Wealth Bank"], documentId: "5e8251f6-f8aa-4698-a750-cacbc400a314",
    dateEffet: null, dateFin: null, preavisJours: null, tacite: false, fournisseur: null,
    rattachements: { juridiction: "AE" } },
];
const SEED_ECHEANCES: Echeance[] = [
  { id: "016e5fb7-1744-4e2a-9c62-c15a1bcb3f9a", reference: "LEG-2026-0001", type: "CONTRAT",
    dateFin: "2026-09-15", preavisJours: 90, tacite: true, statut: "PREAVIS_OUVERT" },
  { id: "58b7d86d-37e2-42e5-b1af-618a74f0893b", reference: "LEG-2026-0002", type: "MEMO",
    dateFin: null, preavisJours: null, tacite: false, statut: "SANS_ECHEANCE" },
];

const ACTES: ActeMoteur[] = [
  { cle: "legal.creer", libelle: "Enregistrer un contrat ou un mémo", route: "POST /v1/legal/objets",
    methode: "POST",
    champs: [{ cle: "type", libelle: "Type", exemple: "CONTRAT | MEMO" },
      { cle: "reference", libelle: "Référence" },
      { cle: "documentId", libelle: "Pièce GED (documentId) — la preuve d'abord" },
      { cle: "dateEffet", libelle: "Date d'effet", exemple: "2025-09-01" },
      { cle: "dateFin", libelle: "Date de fin (vide = sans échéance)" },
      { cle: "preavisJours", libelle: "Préavis (jours)" }],
    garde: "R312 — le registre vit SUR LA GED : sans documentId le moteur refuse (« le registre sans PREUVE n'existe pas »), et un documentId inconnu du tenant est refusé aussi (« un identifiant ne prouve rien »). La pièce s'ingère d'abord, l'objet se crée ensuite." },
  { cle: "legal.dates", libelle: "Modifier les dates", route: "POST /v1/legal/objets/:id/dates",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Objet legal" },
      { cle: "dateFin", libelle: "Nouvelle date de fin" },
      { cle: "preavisJours", libelle: "Nouveau préavis (jours)" },
      { cle: "motif", libelle: "Motif (R7 — obligatoire)" }],
    garde: "R7 — modifier les dates d'un contrat se MOTIVE : c'est un événement au journal, jamais une réécriture. Les statuts d'échéance se recalculent d'eux-mêmes — ils ne sont la propriété de personne." },
  { cle: "legal.reference", libelle: "Lire par référence, à date", route: "GET /v1/legal/par-reference",
    methode: "GET",
    champs: [{ cle: "ref", libelle: "Référence", exemple: "LEG-2026-0001" },
      { cle: "asOf", libelle: "Date de lecture (vide = maintenant)" }],
    garde: "R48 — la lecture rend l'objet ET la version de sa pièce EN VIGUEUR à la date demandée, avec son empreinte sha256. C'est cette référence que la position cross-border cite (R293) — la boucle se ferme dans les deux sens." },
];

const MODE_ECHEANCE = (s?: string): "ok" | "warn" | "alert" | "neutral" =>
  s === "EN_RETARD" ? "alert" : s === "PREAVIS_OUVERT" ? "warn"
  : s === "COURANT" ? "ok" : "neutral";

export function Legal({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"objets" | "echeances">("objets");
  const obj = useApiOrSeed<ObjetLegal[]>("/v1/legal/objets", SEED_OBJETS);
  const ech = useApiOrSeed<Echeance[]>("/v1/legal/echeances", SEED_ECHEANCES);
  const objets = Array.isArray(obj.data) ? obj.data : [];
  const echeances = Array.isArray(ech.data) ? ech.data : [];

  const pilule = (id: "objets" | "echeances", label: string) => (
    <button key={id} onClick={() => setVue(id)} aria-pressed={vue === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: vue === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: vue === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: vue === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Legal — Contrats & mémos")}
        sousTitre={obj.isDemo ? t("données maquette")
          : t("source : /v1/legal — registre sur la GED (R312), échéances calculées (R313)")}
        action={<Ui2Bouton onClick={() => exporterCsv(`olive-legal-${jourFichier()}`,
          [t("Référence"), t("Type"), t("Parties"), t("Fin"), t("Préavis")],
          objets.map((o) => [o.reference ?? "", o.type ?? "", (o.parties ?? []).join(" · "),
            o.dateFin ?? "", String(o.preavisJours ?? "")]))}>
          {t("Exporter le registre")}</Ui2Bouton>} t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("objets", `${t("Registre")} · ${objets.length}`)}
        {pilule("echeances", `${t("Échéances")} · ${echeances.length}`)}
      </div>

      {vue === "objets" && (!objets.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("Registre vide — un contrat n'y entre qu'avec sa pièce GED (R312).")}</div>
      ) : (<>
        <EntityList grid="140px 90px 1.5fr 110px 110px 100px" onOpen={() => setVue("echeances")}
          entetes={[t("Référence"), t("Type"), t("Parties"), t("Effet"), t("Fin"), t("Juridiction")]}
          lignes={objets.map((o) => ({ id: o.id, cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{o.reference ?? "—"}</span>,
            <span key="t" className="mono" style={{ fontSize: 11 }}>{o.type ?? "—"}</span>,
            <span key="p" style={{ fontSize: 12 }}>{(o.parties ?? []).join(" · ") || "—"}</span>,
            <span key="e" className="mono" style={{ fontSize: 11 }}>{jour(o.dateEffet ?? undefined) ?? "—"}</span>,
            <span key="f" className="mono" style={{ fontSize: 11 }}>{jour(o.dateFin ?? undefined) ?? "—"}</span>,
            <span key="j" className="mono">{o.rattachements?.juridiction ?? "—"}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Chaque ligne est adossée à une pièce GED réelle — versions et empreintes (R109-R115). La juridiction cite le country manual (R293) : la position cross-border référence le mémo, et le mémo porte la juridiction — la boucle se ferme dans les deux sens.")}</div>
      </>))}

      {vue === "echeances" && (!echeances.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("Aucune échéance.")}</div>
      ) : (<>
        <EntityList grid="140px 90px 120px 110px 100px 150px" onOpen={() => setVue("objets")}
          entetes={[t("Référence"), t("Type"), t("Fin"), t("Préavis"), t("Tacite"), t("Statut calculé")]}
          lignes={echeances.map((e) => ({ id: e.id, cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{e.reference ?? "—"}</span>,
            <span key="t" className="mono" style={{ fontSize: 11 }}>{e.type ?? "—"}</span>,
            <span key="f" className="mono" style={{ fontSize: 11 }}>{jour(e.dateFin ?? undefined) ?? "—"}</span>,
            <span key="p" className="mono">{e.preavisJours != null ? `${e.preavisJours} j` : "—"}</span>,
            <span key="x" className="mono">{e.tacite ? t("oui") : t("non")}</span>,
            <StatusChip key="s" mode={MODE_ECHEANCE(e.statut)}>{t(e.statut ?? "—")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le statut est un FAIT calculé des dates (R313) — COURANT, PREAVIS_OUVERT, EN_RETARD, SANS_ECHEANCE — jamais une colonne saisie. Un préavis ouvert crée une tâche et notifie ; un dépassement escalade ; rien n'est jamais bloqué (R39) — l'écran montre, le tick notifie, l'humain décide.")}</div>
      </>))}
    </Ui2Shell>);
}
