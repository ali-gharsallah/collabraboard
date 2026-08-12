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
 * V2-M50 — CUSTODY & TRANSFER AGENT (†CUSTODY), le PREMIER vertical bâti dans le compartiment
 * paresseux ouvert au lot V2-M49. Il n'entre pas dans le paquet du socle : un tenant qui
 * n'achète pas ce module ne le voit pas (R320) et ne le télécharge pas.
 *
 * POURQUOI CELUI-CI D'ABORD. Neuf verticaux restaient à bâtir ; celui-ci est le seul dont le
 * moteur sert AUJOURD'HUI des données réelles et des actes gouvernés — vérifié route par route
 * sur l'API vivante avant d'écrire une ligne d'écran. Bâtir sur des routes vides aurait répété
 * la faiblesse consignée au lot V2-M47 (une forme lue dans le code, jamais observée).
 *
 * CE QUE L'ÉCRAN DOIT MONTRER, parce que c'est la doctrine du moteur (R302) :
 *   · l'état du registre à toute date est un REJEU du journal (R48) — d'où le rejeu à date ;
 *   · un mouvement EN ATTENTE DE VISA n'est PAS au registre, et l'initiateur ne vise jamais
 *     lui-même (R13) : la liste des positions ne doit donc pas être lue comme « tout ce qui
 *     a été saisi » ;
 *   · une correction est une CONTRE-PASSATION MOTIVÉE (R7), jamais une réécriture — le
 *     journal est inviolable (R49) ;
 *   · une position à ZÉRO ou NÉGATIVE reste VISIBLE. C'est délibéré côté moteur et l'écran ne
 *     la masque pas : une ligne qui disparaît est une ligne qu'on cesse de surveiller.
 */

type Position = { titre?: string; titulaire?: string; quantite?: number };
type Mouvement = { reference?: string; type?: string; titre?: string; quantite?: number; at?: string };
type Registre = { asOf?: string; positions?: Position[]; mouvements?: Mouvement[];
  contrepassations?: string[] };

// Seed au format EXACT du moteur, relevé sur l'API vivante (GET /v1/ta/registre) — pas recopié
// d'une maquette. Il porte la souscription semée par la démonstration (DM/V2-M48).
// Aux DEUX positions ajoutées à la souscription réelle : une SOLDÉE et une NÉGATIVE. Elles ne
// sont pas décoratives — le moteur produit ces états (une radiation qui solde, une
// contre-passation qui passe une position sous zéro) et les CONSERVE. Un seed qui n'en montre
// jamais laisse croire que le registre n'affiche que des lignes saines, et la garde U2-73
// s'exécutait alors sans rien vérifier : c'est le compteur qui me l'a appris, pas la relecture.
const SEED: Registre = {
  asOf: "2026-08-12T22:13:38.350Z",
  positions: [
    { titre: "GWB Global Equity Fund", titulaire: "Nordwind Handel SA", quantite: 1500 },
    { titre: "GWB Swiss Bond Fund", titulaire: "Al-Maktoum Holdings SA", quantite: 0 },
    { titre: "GWB Emerging Markets", titulaire: "Cèdre Maritime SARL", quantite: -250 },
  ],
  mouvements: [{ reference: "TA-DEMO-001", type: "SOUSCRIPTION", titre: "GWB Global Equity Fund",
    quantite: 1500, at: "2026-08-12T20:25:44.214Z" }],
  contrepassations: [],
};

// Les quatre types du moteur (`TYPES` dans ta.module.ts) — l'écran ne peut pas en inventer un
// cinquième : le moteur refuserait, et le refus s'afficherait tel quel.
const TYPES_MOUVEMENT = "SOUSCRIPTION | TRANSFERT | NANTISSEMENT | RADIATION";

const ACTES: ActeMoteur[] = [
  { cle: "ta.enregistrer", libelle: "Enregistrer un mouvement", route: "POST /v1/ta/mouvements",
    methode: "POST",
    champs: [{ cle: "type", libelle: "Type de mouvement", exemple: TYPES_MOUVEMENT },
      { cle: "titre", libelle: "Titre", exemple: "GWB Global Equity Fund" },
      { cle: "titulaire", libelle: "Titulaire" },
      { cle: "versTitulaire", libelle: "Vers titulaire (TRANSFERT uniquement)" },
      { cle: "quantite", libelle: "Quantité (> 0)" },
      { cle: "reference", libelle: "Référence — unique, un mouvement ne se rejoue pas" }],
    garde: "R302 — le mouvement est un ÉVÉNEMENT, pas une ligne de table : la référence est unique et le moteur refuse un rejeu. Si le type exige un visa (paramètre tenant ta_visas_par_type), le mouvement N'ENTRE PAS au registre tant qu'un SECOND regard ne l'a pas signé (R13)." },
  { cle: "ta.viser", libelle: "Viser un mouvement", route: "POST /v1/ta/mouvements/:id/visa",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Référence du mouvement", exemple: "TA-DEMO-001" }],
    garde: "R13 — l'initiateur ne vise JAMAIS son propre mouvement, et seul le rôle déclaré pour ce type peut signer. Un visa ne se rejoue pas. Un mouvement dont le type n'exige aucun visa est refusé ici : le moteur le dit plutôt que d'accepter un visa décoratif." },
  { cle: "ta.contrepasser", libelle: "Contre-passer un mouvement",
    route: "POST /v1/ta/mouvements/:id/contrepasser", methode: "POST",
    champs: [{ cle: ":id", libelle: "Référence du mouvement", exemple: "TA-DEMO-001" },
      { cle: "motif", libelle: "Motif (R7 — obligatoire)" }],
    garde: "R7/R49 — corriger le registre exige un MOTIF écrit : la contre-passation ne s'improvise pas. Elle applique l'inverse EXACT du mouvement et laisse les deux au journal — jamais une réécriture, le journal est inviolable." },
  { cle: "ta.rejeu", libelle: "Rejouer le registre à une date", route: "GET /v1/ta/registre",
    methode: "GET",
    champs: [{ cle: "asOf", libelle: "Date du rejeu", exemple: "2026-08-01T00:00:00Z" }],
    garde: "R48 — l'état du registre à une date est un REJEU du journal, jamais une photo stockée. C'est la démonstration de l'architecture : avant le premier mouvement, le registre est vide, et il le prouve." },
];

export function Custody({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"positions" | "mouvements">("positions");
  const registre = useApiOrSeed<Registre>("/v1/ta/registre", SEED);
  const d = registre.data ?? {};
  const positions = Array.isArray(d.positions) ? d.positions : [];
  const mouvements = Array.isArray(d.mouvements) ? d.mouvements : [];
  const contrepassees = new Set(Array.isArray(d.contrepassations) ? d.contrepassations : []);

  const pilule = (id: "positions" | "mouvements", label: string) => (
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
      header={<Ui2HeaderListe titre={t("Custody & Transfer Agent")}
        sousTitre={registre.isDemo ? t("données maquette")
          : `${t("source : /v1/ta/registre — état à date par REJEU du journal (R48)")} · ${jour(d.asOf) ?? "—"}`}
        action={<Ui2Bouton onClick={() => exporterCsv(`olive-registre-ta-${jourFichier()}`,
          [t("Titre"), t("Titulaire"), t("Quantité")],
          positions.map((p) => [p.titre ?? "", p.titulaire ?? "", String(p.quantite ?? 0)]))}>
          {t("Exporter le registre")}</Ui2Bouton>} t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("positions", `${t("Positions")} · ${positions.length}`)}
        {pilule("mouvements", `${t("Mouvements")} · ${mouvements.length}`)}
        {contrepassees.size > 0 && (
          <span style={{ alignSelf: "center" }}>
            <StatusChip mode="warn">{`${contrepassees.size} ${t("contre-passé(s)")}`}</StatusChip></span>)}
      </div>

      {vue === "positions" && (!positions.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-surface)",
          border: "1px solid var(--border)", borderRadius: "var(--r-card)", padding: "14px 16px" }}>
          {t("Registre vide à cette date. Ce n'est pas une absence de données : c'est l'état RÉEL du journal rejoué à date (R48) — un mouvement en attente de visa n'y figure pas non plus.")}
        </div>
      ) : (<>
        <EntityList grid="1.4fr 1.2fr 140px 130px" onOpen={() => setVue("mouvements")}
          entetes={[t("Titre"), t("Titulaire"), t("Quantité"), t("État")]}
          lignes={positions.map((p, i) => ({ id: `${p.titre}-${p.titulaire}-${i}`, cells: [
            <span key="t" style={{ fontWeight: 600, color: "var(--text)" }}>{p.titre ?? "—"}</span>,
            <span key="h" style={{ fontSize: 12 }}>{p.titulaire ?? "—"}</span>,
            <span key="q" className="mono" style={{ fontWeight: 600,
              color: (p.quantite ?? 0) < 0 ? "var(--alert-text)" : "var(--text)" }}>
              {(p.quantite ?? 0).toLocaleString("fr-CH")}</span>,
            (p.quantite ?? 0) === 0
              ? <StatusChip key="e" mode="neutral">{t("SOLDÉE")}</StatusChip>
              : (p.quantite ?? 0) < 0
                ? <StatusChip key="e" mode="alert">{t("NÉGATIVE")}</StatusChip>
                : <StatusChip key="e" mode="ok">{t("OUVERTE")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Une position SOLDÉE ou NÉGATIVE reste affichée — le moteur ne la supprime pas et l'écran ne la masque pas. Une ligne qui disparaît est une ligne qu'on cesse de surveiller ; une position négative est justement l'anomalie qu'il faut voir.")}</div>
      </>))}

      {vue === "mouvements" && (!mouvements.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("Aucun mouvement au registre à cette date.")}</div>
      ) : (<>
        <EntityList grid="150px 140px 1.4fr 130px 120px 130px" onOpen={() => setVue("positions")}
          entetes={[t("Référence"), t("Type"), t("Titre"), t("Quantité"), t("Enregistré le"), t("État")]}
          lignes={mouvements.map((m, i) => ({ id: `${m.reference ?? i}`, cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{m.reference ?? "—"}</span>,
            <span key="t" className="mono" style={{ fontSize: 11 }}>{m.type ?? "—"}</span>,
            <span key="i" style={{ fontSize: 12 }}>{m.titre ?? "—"}</span>,
            <span key="q" className="mono">{(m.quantite ?? 0).toLocaleString("fr-CH")}</span>,
            <span key="d" className="mono" style={{ fontSize: 11 }}>{jour(m.at) ?? "—"}</span>,
            contrepassees.has(m.reference ?? "")
              ? <StatusChip key="e" mode="warn">{t("CONTRE-PASSÉ")}</StatusChip>
              : <StatusChip key="e" mode="ok">{t("AU REGISTRE")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Cette liste est l'état REJOUÉ, pas la saisie : un mouvement en attente de visa n'y figure pas (R13 — l'initiateur ne vise jamais lui-même). Un mouvement contre-passé RESTE affiché avec sa contre-partie — corriger n'est pas effacer (R7/R49).")}</div>
      </>))}
    </Ui2Shell>);
}
