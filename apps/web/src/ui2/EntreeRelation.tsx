import React, { useState } from "react";
import { Check } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip, ChipMode } from "./StatusChip";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { listeDeplacements, listeProspects } from "./moteur-formes";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 9 : écran 04 « Entrée en relation » (pattern Stepper + Record). Le parcours
 * affiche EN PERMANENCE la seule question qui compte : que manque-t-il pour ouvrir — visible
 * à chaque étape, jamais découvert à la fin. L'aiguillage SDD/CDD/EDD est montré AVEC sa
 * raison (décidé par le moteur de règles, trois critères cités, lien vers la règle et sa
 * version — R29) ; la barrière « ouverture bloquée tant que KYC ≠ validé » est annoncée dès
 * le premier écran et la règle est dite NON paramétrable. Personne unique : Henrik Vallon
 * est réutilisé, pas ressaisi — tout changement futur se propage aux deux dossiers.
 */

const ETAPES = [
  { n: 1, label: "Qualification", sous: "terminée le 04.08", fait: true },
  { n: 2, label: "Screening initial", sous: "aucun hit", fait: true },
  { n: 3, label: "Dossier KYC", sous: "en cours · 6 / 9 sections", courante: true },
  { n: 4, label: "Décision", sous: "visa Compliance requis" },
  { n: 5, label: "Ouverture", sous: "bloquée tant que KYC ≠ validé" },
] as const;

const carte: React.CSSProperties = { background: "var(--bg-surface)", border: "1px solid var(--border)",
  borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 14 };

// ── V2-M4 : le pipeline prospects (/v1/onboarding — les 3 écrans « Prospect à contacter /
// en contact / à onboarder » et la pré-prospection FUSIONNENT ici, cartographie ratifiée) et
// les déplacements (/v1/trips — Business Trip R446+, quotas R449, certificat de liens CR,
// prospects R465). Seeds au format des réponses API.
type Prospect = { id: string; nom?: string; etape?: string; apporteur?: string; depuis?: string };
const SEED_PIPELINE: Prospect[] = [
  { id: "pro-1", nom: "Sablier Investments SA", etape: "A_ONBOARDER", apporteur: "M. Leconte", depuis: "04.08.2026" },
  { id: "pro-2", nom: "Famille Okonkwo", etape: "EN_CONTACT", apporteur: "C. Morel", depuis: "28.07.2026" },
  { id: "pro-3", nom: "Baltic Ventures OÜ", etape: "A_CONTACTER", apporteur: "sourcing — salon Genève", depuis: "22.07.2026" },
  { id: "pro-4", nom: "Dr. Lena Vogel", etape: "EN_CONTACT", apporteur: "recommandation client", depuis: "15.07.2026" },
];
type Trip = { id: string; reference?: string; pays?: string; status?: string; depart?: string; visaChain?: string };
const SEED_TRIPS: Trip[] = [
  { id: "trip-1", reference: "BT-2026-0044", pays: "Émirats arabes unis", status: "EN_APPROBATION", depart: "22.08.2026", visaChain: "CO → MLRO" },
  { id: "trip-2", reference: "BT-2026-0041", pays: "Luxembourg", status: "APPROUVE", depart: "18.08.2026", visaChain: "CO" },
  { id: "trip-3", reference: "BT-2026-0037", pays: "Royaume-Uni", status: "CLOTURE", depart: "07.07.2026", visaChain: "CO" },
];

export function EntreeRelation({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"dossier" | "pipeline" | "trips">("dossier");
  const pipeline = useApiOrSeed<Prospect[]>("/v1/onboarding", SEED_PIPELINE);
  const trips0 = useApiOrSeed<unknown>("/v1/trips", SEED_TRIPS);
  const trips = { ...trips0, data: listeDeplacements(trips0.data) };
  const pilule = (id: typeof onglet, label: string) => (
    <button key={id} onClick={() => setOnglet(id)} aria-pressed={onglet === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: onglet === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: onglet === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: onglet === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const ETAPE_PIPELINE: Record<string, { label: string; mode: ChipMode }> = {
    A_CONTACTER: { label: "À CONTACTER", mode: "neutral" }, EN_CONTACT: { label: "EN CONTACT", mode: "info" },
    A_ONBOARDER: { label: "À ONBOARDER", mode: "warn" } };
  const nav = (<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager"
    onNavigate={onNavigate} t={t}
    badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
      entree: { n: 6 } }} />);

  if (onglet === "pipeline" || onglet === "trips") {
    return (
      <Ui2Shell nav={nav}
        header={<Ui2HeaderDossier nom={t("Entrée en relation")} initiales="ER"
          identifiants={onglet === "pipeline"
            ? (pipeline.isDemo ? t("données maquette") : t("source : /v1/onboarding"))
            : (trips.isDemo ? t("données maquette") : t("source : /v1/trips (R446+)"))}
          puces={<StatusChip mode="neutral">{onglet === "pipeline" ? t("PIPELINE") : t("DÉPLACEMENTS")}</StatusChip>}
          actions={<Ui2Bouton primaire onClick={() => setOnglet("dossier")}>{t("Ouvrir le dossier Sablier →")}</Ui2Bouton>} t={t} />}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {pilule("dossier", t("Dossier (écran 04)"))}
          {pilule("pipeline", `${t("Pipeline prospects")} · ${listeProspects(pipeline.data).length}`)}
          {pilule("trips", `${t("Déplacements (BT)")} · ${Array.isArray(trips.data) ? trips.data.length : 0}`)}
        </div>
        {onglet === "pipeline" && (<>
          <EntityList grid="1.4fr 140px 1.1fr 110px" onOpen={() => setOnglet("dossier")}
            entetes={[t("Prospect"), t("Étape"), t("Apporteur / source"), t("Depuis")]}
            lignes={listeProspects(pipeline.data).slice(0, 30).map((p) => {
              const e = ETAPE_PIPELINE[p.etape ?? ""] ?? { label: p.etape ?? "—", mode: "neutral" as ChipMode };
              return { id: p.id, cells: [
                <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{p.nom ?? p.id}</span>,
                <StatusChip key="e" mode={e.mode}>{t(e.label)}</StatusChip>,
                t(p.apporteur ?? "—"),
                <span key="d" className="mono">{p.depuis ?? "—"}</span>] };
            })} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Les trois écrans « Prospect à contacter / en contact / à onboarder » et la pré-prospection fusionnent ici (cartographie ratifiée). Un prospect À ONBOARDER s'ouvre sur son dossier (écran 04) — la barrière « KYC validé » s'y annonce dès la première étape.")}</div>
        </>)}
        {onglet === "trips" && (<>
          <EntityList grid="140px 1.2fr 150px 130px 110px" onOpen={() => setOnglet("dossier")}
            entetes={[t("Référence"), t("Pays"), t("Statut"), t("Chaîne de visa"), t("Départ")]}
            lignes={(Array.isArray(trips.data) ? trips.data : []).slice(0, 30).map((v) => ({
              id: v.id, cells: [
                <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{v.reference ?? v.id}</span>,
                t(v.pays ?? "—"),
                <StatusChip key="s" mode={v.status === "EN_APPROBATION" ? "warn" : v.status === "APPROUVE" ? "ok" : "neutral"}>
                  {t(v.status === "EN_APPROBATION" ? "EN APPROBATION" : v.status === "APPROUVE" ? "APPROUVÉ" : "CLÔTURÉ")}</StatusChip>,
                <span key="c" className="mono">{v.visaChain ?? "—"}</span>,
                <span key="d" className="mono">{v.depart ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Business Trip : quotas de jours par pays (R449), certificat de liens pour les contact reports, prospects rencontrés en déplacement (R465) — le voyage se rejoue à date (R448/R48). La chaîne de visa suit le risque du pays.")}</div>
        </>)}
      </Ui2Shell>);
  }

  return (
    <Ui2Shell nav={nav} sideWidth={320}
      header={<Ui2HeaderDossier nom="Sablier Investments SA" initiales="SI"
        identifiants={t("PRO-0231 · Personne morale · Luxembourg · apporté par M. Leconte")}
        puces={<StatusChip mode="neutral">{t("PROSPECT")}</StatusChip>}
        actions={<><Ui2Bouton onClick={() => onNavigate("journee")}>{t("Abandonner")}</Ui2Bouton>
          <Ui2Bouton onClick={() => onNavigate("dossiers")}>{t("Enregistrer")}</Ui2Bouton>
          <Ui2Bouton primaire onClick={() => onNavigate("kyc")}>{t("Étape suivante")}</Ui2Bouton></>} t={t} />}
      stepper={<div style={{ display: "flex", alignItems: "center", gap: 0, width: "100%" }}>
        {ETAPES.map((e, i) => (
          <React.Fragment key={e.n}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, boxSizing: "border-box",
                background: e.fait ? "var(--ok-chip)" : "courante" in e && e.courante ? "var(--brand)" : "var(--bg-subtle)",
                border: e.fait ? "1px solid var(--ok-line)" : "courante" in e && e.courante ? "none" : "1px solid var(--border)",
                color: e.fait ? "var(--ok-text)" : "courante" in e && e.courante ? "#fff" : "var(--text-muted)" }}>
                {e.fait ? <Check size={13} strokeWidth={2.5} /> : e.n}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5, whiteSpace: "nowrap",
                  fontWeight: "courante" in e && e.courante ? 700 : 500,
                  color: e.fait || ("courante" in e && e.courante) ? "var(--text)" : "var(--text-muted)" }}>{t(e.label)}</span>
                <span className="mono" style={{ display: "block", fontSize: 9.5, whiteSpace: "nowrap",
                  color: e.n === 5 ? "var(--warn-text)" : "var(--text-muted)" }}>{t(e.sous)}</span>
              </span>
            </div>
            {i < ETAPES.length - 1 && <span aria-hidden style={{ flex: 1, height: 2, minWidth: 14,
              margin: "0 12px", background: e.fait ? "var(--ok-line)" : "var(--border-soft)" }} />}
          </React.Fragment>))}
      </div>}
      side={<div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Ce qui manque pour ouvrir")}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 10px" }}>
          {t("Visible à chaque étape, jamais découvert à la fin.")}</div>
        {[{ label: t("Pièce d'identité — Nadia Farah"), sous: t("demandée le 06.08 · relance auto le 13.08"), fait: false },
          { label: t("Origine du patrimoine — 3 champs"), sous: t("section KYC en cours"), fait: false },
          { label: t("Visa Compliance"), sous: t("après complétude du dossier"), fait: false },
          { label: t("Screening sanctions et PEP"), sous: t("aucun hit · 04.08"), fait: true },
          { label: t("Contrôle cross-border Luxembourg"), sous: t("démarchage conforme"), fait: true }].map((l) => (
          <div key={l.label} style={{ display: "flex", gap: 9, padding: "7px 0",
            borderBottom: "1px solid var(--border-row)" }}>
            <span aria-hidden style={{ width: 13, height: 13, borderRadius: "50%", flexShrink: 0, marginTop: 2,
              boxSizing: "border-box",
              border: l.fait ? "none" : "3.5px solid var(--warn-line)",
              background: l.fait ? "var(--ok-line)" : "var(--bg-surface)",
              display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {l.fait && <Check size={9} strokeWidth={3.5} color="#fff" />}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600,
                color: l.fait ? "var(--text-muted)" : "var(--text)" }}>{l.label}</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>{l.sous}</span>
            </span>
          </div>))}
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "12px 14px",
          margin: "14px 0" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
            {t("Délai estimé jusqu'à l'ouverture")}</div>
          <div className="mono" style={{ fontSize: 27, fontWeight: 600, color: "var(--text)", lineHeight: 1.1 }}>
            9 <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>{t("jours ouvrés")}</span></div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>
            {t("Calculé sur les délais réels des dossiers EDD comparables, pas sur le SLA théorique.")}</div>
        </section>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
          {t("L'ouverture du compte reste refusée tant que le KYC n'est pas au statut validé. Cette règle n'est pas paramétrable.")}</div>
      </div>}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {pilule("dossier", t("Dossier (écran 04)"))}
        {pilule("pipeline", `${t("Pipeline prospects")} · ${listeProspects(pipeline.data).length}`)}
        {pilule("trips", `${t("Déplacements (BT)")} · ${Array.isArray(trips.data) ? trips.data.length : 0}`)}
      </div>
      <section style={carte}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Aiguillage du dossier")}</span>
          <StatusChip mode="warn">{t("DILIGENCE RENFORCÉE — EDD")}</StatusChip>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.55, marginBottom: 9 }}>
          {t("Décidé par le moteur de règles, pas par une saisie manuelle. Trois critères ont porté le dossier au-delà du seuil CDD :")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 9 }}>
          {[t("Ayant droit résidant dans un pays à risque élevé"), t("Structure à deux niveaux de détention"),
            t("Apport initial > 5 M CHF")].map((c) => (
            <span key={c} style={{ fontSize: 11.5, color: "var(--text-secondary)", padding: "6px 11px",
              borderRadius: 8, border: "1px solid var(--warn-card-border)", background: "var(--warn-card)" }}>{c}</span>))}
        </div>
        <button onClick={() => onNavigate("param")} style={{ border: "none", background: "transparent",
          padding: 0, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--brand)",
          cursor: "pointer" }}>{t("Voir la règle appliquée et sa version →")}</button>
      </section>
      <section style={{ ...carte, marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Structure de détention")}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("2 ayants droit identifiés · 1 à confirmer")}</span>
        </div>
        {[{ ini: "SI", nom: "Sablier Investments SA", sous: t("Luxembourg · société de participation"),
            chip: t("TITULAIRE"), mode: "neutral" as ChipMode, niveau: 0 },
          { ini: "HV", nom: "Henrik Vallon", sous: t("Suède · 62 % · déjà client de la banque"),
            chip: t("UBO CONFIRMÉ"), mode: "ok" as ChipMode, niveau: 1 },
          { ini: "NF", nom: "Nadia Farah", sous: t("Liban · 38 % · pièce d'identité à recevoir"),
            chip: t("À CONFIRMER"), mode: "warn" as ChipMode, niveau: 1, attention: true }].map((p) => (
          <div key={p.ini} style={{ display: "flex", alignItems: "center", gap: 11,
            marginLeft: p.niveau * 28, padding: "10px 12px", marginBottom: 8, borderRadius: 10,
            border: p.attention ? "1.5px solid var(--warn-card-border)" : "1px solid var(--border)",
            background: p.attention ? "var(--warn-card)" : "var(--bg-surface)" }}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: p.niveau === 0 ? 8 : "50%",
              flexShrink: 0, background: "var(--bg-subtle)", border: "1px solid var(--border)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10,
              fontWeight: 600, color: "var(--text-secondary)" }}>{p.ini}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{p.nom}</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{p.sous}</span>
            </span>
            <span style={{ marginLeft: "auto" }}><StatusChip mode={p.mode}>{p.chip}</StatusChip></span>
          </div>))}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.55 }}>
          {t("Henrik Vallon existe déjà comme personne dans le système. Ses documents d'identité et son screening sont réutilisés — pas de nouvelle saisie, et tout changement futur se propagera aux deux dossiers.")}</div>
      </section>
    </Ui2Shell>);
}
