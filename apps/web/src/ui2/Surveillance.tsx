import React, { useState } from "react";
import { LayoutGrid, ArrowLeftRight } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { DecisionPanel } from "./DecisionPanel";
import { DiffTable } from "./DiffRow";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 6 : Surveillance — écrans 03 « AML Investigation » et 05 « Screening ».
 * Deux dossiers du même bloc de nav, bascule par l'action d'en-tête. Le DecisionPanel est le
 * visage de la décision unifiée (motif obligatoire repris tel quel, effets annoncés AVANT,
 * second regard rappelé) ; sur une alerte CRITIQUE, Olivia fournit du CONTEXTE et ne propose
 * AUCUNE décision (principe n°4 du handoff, R44). La DiffTable rend la divergence à la ligne.
 */

const nombre = (s: string) => <span className="mono">{s}</span>;

// ── V2-M2 : les listes RÉELLES de la Surveillance, sources signalées ───────────────────────
// File screening (/v1/screening/hits, R411 — sujet × temps, config du run référencée) ;
// règles AML en CONSULTATION (/v1/aml/referentiel — la modification passe par le bac à
// sable de l'écran 10) ; transactions (/v1/txflux). Les seeds miment ces formes.
type Hit = { id: string; sujet?: string; nom?: string; liste?: string; score?: number;
  statut?: string; at?: string };
const SEED_HITS: Hit[] = [
  { id: "hit-1", nom: "Andrei Volkov", liste: "UE consolidée 2026-07-31", score: 0.92, statut: "OPEN", at: "10.08.2026" },
  { id: "hit-2", nom: "Cedar Maritime Ltd", liste: "OFAC SDN 2026-07-28", score: 0.71, statut: "FAUX_POSITIF", at: "06.08.2026" },
  { id: "hit-3", nom: "Farid El-Masri", liste: "SECO 2026-07-30", score: 0.64, statut: "FAUX_POSITIF", at: "03.08.2026" },
];
type Regle = { code: string; libelle?: string; seuils?: string; version?: string; alertes12m?: number };
const SEED_REGLES: Regle[] = [
  { code: "AML-R17", libelle: "Écart au profil de flux déclaré", seuils: "× 2,0 · fenêtre 30 j", version: "v11 · 12.09.2024", alertes12m: 1244 },
  { code: "AML-R04", libelle: "Structuration sous les seuils", seuils: "9 500 CHF · 5 op. / 7 j", version: "v6 · 03.02.2025", alertes12m: 312 },
  { code: "AML-R22", libelle: "Corridor à risque sans justificatif", seuils: "pays liste GAFI · > 50 k", version: "v3 · 18.04.2026", alertes12m: 87 },
  { code: "AML-R09", libelle: "Cash intensif hors profil", seuils: "> 15 k / mois espèces", version: "v9 · 12.09.2024", alertes12m: 158 },
];
type Tx = { id: string; date?: string; contrepartie?: string; montant?: string; canal?: string; statut?: string };
const SEED_TX: Tx[] = [
  { id: "tx-1", date: "08.08.2026", contrepartie: "Levant Shipping Co.", montant: "800 000 CHF", canal: "SWIFT MT103", statut: "EN_REVUE" },
  { id: "tx-2", date: "07.08.2026", contrepartie: "Nordwind Energie GmbH", montant: "120 000 CHF", canal: "SEPA", statut: "REGLEE" },
  { id: "tx-3", date: "05.08.2026", contrepartie: "Helvetia Kids (don)", montant: "25 000 CHF", canal: "Virement interne", statut: "REGLEE" },
  { id: "tx-4", date: "04.08.2026", contrepartie: "Levant Shipping Co.", montant: "760 000 CHF", canal: "SWIFT MT103", statut: "EN_REVUE" },
];

function Chiffre({ label, valeur, mode }: { label: string; valeur: string; mode?: "alert" | "warn" }) {
  return (
    <span style={{ minWidth: 0 }}>
      <span className="microlabel" style={{ display: "block", marginBottom: 3 }}>{label}</span>
      <span className="mono" style={{ fontSize: 13.5, fontWeight: 600,
        color: mode ? `var(--${mode}-text)` : "var(--text)" }}>{valeur}</span>
    </span>);
}

export function Surveillance({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [ecran, setEcran] = useState<"alerte" | "hit" | "screening" | "regles" | "transactions">("alerte");
  const hits = useApiOrSeed<Hit[]>("/v1/screening/hits", SEED_HITS);
  const regles = useApiOrSeed<Regle[]>("/v1/aml/referentiel", SEED_REGLES);
  const txs = useApiOrSeed<Tx[]>("/v1/txflux", SEED_TX);
  // DEUX décisions distinctes (l'alerte AML et le hit screening) — l'état est par écran, et le
  // DecisionPanel porte key={ecran} pour que le motif saisi sur l'un ne fuie jamais sur l'autre.
  const [decisions, setDecisions] = useState<Partial<Record<"alerte" | "hit", { option: string; motif: string }>>>({});
  const decision = decisions[ecran] ?? null;
  const setDecision = (d: { option: string; motif: string } | null) =>
    setDecisions((prev) => ({ ...prev, [ecran]: d ?? undefined }));
  const nav = (
    <Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer" onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 9 }, dossiers: { n: 17, sobre: true }, surveillance: { n: 5, alert: true } }}
      modulesLicencies={[{ id: "pms", label: "PMS", icon: <LayoutGrid size={16} strokeWidth={1.75} /> },
        { id: "fx", label: "Multi-devise & FX", icon: <ArrowLeftRight size={16} strokeWidth={1.75} /> }]} />);
  const bandeauDecision = decision && (
    <div role="status" style={{ background: "var(--ok-chip)", border: "1px solid var(--ok-line)",
      borderRadius: 9, padding: "9px 12px", marginBottom: 12, fontSize: 12, color: "var(--ok-text)" }}>
      ✓ {t("Qualification enregistrée")} — <strong>{decision.option}</strong> · {t("motif consigné tel quel au registre.")}
      <button onClick={() => setDecision(null)} style={{ marginLeft: 10, border: "none",
        background: "transparent", color: "var(--ok-text)", fontFamily: "inherit", fontSize: 11.5,
        fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>{t("Annuler")}</button>
    </div>);

  const pilule = (id: typeof ecran, label: string) => (
    <button key={id} onClick={() => setEcran(id)} aria-pressed={ecran === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: ecran === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: ecran === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: ecran === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const pilules = (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      {pilule("alerte", t("Alerte AML"))}
      {pilule("screening", `${t("File screening")} · ${Array.isArray(hits.data) ? hits.data.length : 0}`)}
      {pilule("regles", t("Règles AML"))}
      {pilule("transactions", t("Transactions"))}
    </div>);

  // ── V2-M2 : les trois vues « liste » du bloc Surveillance ──
  if (ecran === "screening" || ecran === "regles" || ecran === "transactions") {
    const sousTitres = {
      screening: hits.isDemo ? t("données maquette") : t("source : /v1/screening/hits (R411 — sujet × temps, config du run référencée)"),
      regles: regles.isDemo ? t("données maquette") : t("source : /v1/aml/referentiel"),
      transactions: txs.isDemo ? t("données maquette") : t("source : /v1/txflux"),
    } as const;
    return (
      <Ui2Shell nav={nav}
        header={<Ui2HeaderListe titre={t("Surveillance")} sousTitre={sousTitres[ecran]}
          action={ecran === "regles"
            ? <Ui2Bouton primaire onClick={() => onNavigate("param")}>{t("Ouvrir le bac à sable →")}</Ui2Bouton>
            : <Ui2Bouton onClick={() => setEcran("alerte")}>{t("Alerte en cours →")}</Ui2Bouton>} t={t} />}>
        {pilules}
        {ecran === "screening" && (<>
          <EntityList grid="1.3fr 1.3fr 90px 130px 110px"
            onOpen={() => setEcran("hit")}
            entetes={[t("Sujet"), t("Liste · version"), t("Score"), t("Statut"), t("Détecté")]}
            lignes={(Array.isArray(hits.data) ? hits.data : []).slice(0, 30).map((h) => ({
              id: h.id, cells: [
                <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{h.nom ?? h.sujet ?? h.id}</span>,
                <span key="l" className="mono">{h.liste ?? "—"}</span>,
                <span key="s" className="mono" style={{ fontWeight: 600 }}>{h.score != null ? `${Math.round(h.score * 100)} %` : "—"}</span>,
                <StatusChip key="c" mode={h.statut === "OPEN" ? "warn" : h.statut === "CONFIRME" ? "alert" : "ok"}>
                  {t(h.statut === "OPEN" ? "À QUALIFIER" : h.statut ?? "QUALIFIÉ")}</StatusChip>,
                <span key="d" className="mono">{h.at ?? "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Scoring : le moteur de screening du produit (Jaro-Winkler + IDF + blocking trigramme + Double Metaphone), golden set 127 cas asserté en CI. Une ligne s'ouvre sur la qualification (écran hit) — motif obligatoire.")}</div>
        </>)}
        {ecran === "regles" && (<>
          <EntityList grid="110px 1.4fr 1fr 150px 110px" onOpen={() => onNavigate("param")}
            entetes={[t("Règle"), t("Scénario"), t("Seuils effectifs"), t("Version"), t("Alertes 12 m")]}
            lignes={(Array.isArray(regles.data) ? regles.data : []).slice(0, 30).map((s) => ({
              id: s.code, cells: [
                <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{s.code}</span>,
                t(s.libelle ?? ""),
                <span key="s" className="mono">{s.seuils ?? "—"}</span>,
                <span key="v" className="mono">{s.version ?? "—"}</span>,
                <span key="a" className="mono">{s.alertes12m != null ? s.alertes12m.toLocaleString("fr-CH") : "—"}</span>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Consultation seule : chaque règle est versionnée et rejouable. La modification passe par le bac à sable du Paramétrage (écran 10) — effet simulé sur l'historique, coût nominatif, version datée et signée.")}</div>
        </>)}
        {ecran === "transactions" && (<>
          <EntityList grid="110px 1.3fr 140px 150px 120px" onOpen={() => setEcran("alerte")}
            entetes={[t("Date"), t("Contrepartie"), t("Montant"), t("Canal"), t("Statut")]}
            lignes={(Array.isArray(txs.data) ? txs.data : []).slice(0, 30).map((x) => ({
              id: x.id, cells: [
                <span key="d" className="mono">{x.date ?? "—"}</span>,
                <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{x.contrepartie ?? x.id}</span>,
                <span key="m" className="mono" style={{ fontWeight: 600 }}>{x.montant ?? "—"}</span>,
                <span key="k" className="mono">{x.canal ?? "—"}</span>,
                <StatusChip key="s" mode={x.statut === "EN_REVUE" ? "warn" : "ok"}>
                  {t(x.statut === "EN_REVUE" ? "EN REVUE" : "RÉGLÉE")}</StatusChip>] }))} />
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Les transactions EN REVUE sont rapprochées des alertes AML — une ligne s'ouvre sur l'alerte liée. L'analyseur SWIFT/SEPA reste un outil contextuel depuis une transaction.")}</div>
        </>)}
      </Ui2Shell>);
  }

  if (ecran === "hit") {
    return (
      <Ui2Shell nav={nav} sideWidth={380}
        header={<Ui2HeaderDossier nom={t("Hit sanctions — Meridian Trust Ltd")} initiales="⚑"
          identifiants="Personne : Andrei Volkov · rôle UBO · liste UE consolidée · détecté il y a 2 h"
          puces={<StatusChip mode="warn">{t("À QUALIFIER")}</StatusChip>}
          actions={<><Ui2Bouton onClick={() => setEcran("alerte")}>{t("← Alerte AML liée")}</Ui2Bouton>
            <Ui2Bouton>{t("Historique des screenings")}</Ui2Bouton></>} t={t} />}
        side={<DecisionPanel key={ecran} titre={t("Qualifier le hit")} t={t}
          sousTitre={t("Deux divergences sur cinq attributs. La décision engage la banque.")}
          options={[
            { id: "HOMONYME", titre: t("Homonyme — écarter"), sous: t("Motif obligatoire") },
            { id: "CONFIRMEE", titre: t("Correspondance confirmée"), sous: t("Gel et communication immédiats") },
            { id: "PIECE", titre: t("Demander une pièce complémentaire"), sous: t("Dossier maintenu bloqué") }]}
          effets={[t("Dossier Meridian Trust maintenu bloqué"), t("Tâche créée pour le gestionnaire"),
            t("Re-screening automatique à réception")]}
          boutonLabel={t("Enregistrer la qualification")}
          mention={t("Second regard MLRO requis sur toute correspondance confirmée.")}
          onDecider={setDecision} />}>
        {bandeauDecision}
        <DiffTable enteteGauche={t("Dossier O-Live")} enteteDroite={t("Liste source")} t={t} lignes={[
          { attribut: t("Nom complet"), gauche: "Andrei Volkov", droite: "Andrey Volkov", concordance: { label: "92 %", mode: "pct" } },
          { attribut: t("Date de naissance"), gauche: nombre("14.06.1971"), droite: nombre("03.11.1967"), concordance: { label: t("DIVERGE"), mode: "diverge" } },
          { attribut: t("Nationalité"), gauche: t("Fédération de Russie"), droite: t("Fédération de Russie"), concordance: { label: t("EXACT"), mode: "exact" } },
          { attribut: t("Lieu de naissance"), gauche: "Saint-Pétersbourg", droite: "Moscou", concordance: { label: t("DIVERGE"), mode: "diverge" } },
          { attribut: t("Pièce d'identité"), gauche: nombre("Passeport 71-xxxx-4402"), droite: t("non renseigné"), concordance: { label: "N/A", mode: "na" } }]} />
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px", margin: "14px 0" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>{t("Mesure listée")}</div>
          <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.55 }}>
            {t("Gel des avoirs et interdiction de mise à disposition de fonds — régime UE relatif aux actions compromettant l'intégrité territoriale de l'Ukraine. Inscription du 08.04.2022, révisée le 15.01.2026.")}</div>
          <div style={{ display: "flex", gap: 26, marginTop: 10 }}>
            <Chiffre label={t("Liste")} valeur="UE consolidée" />
            <Chiffre label={t("Version")} valeur="2026-07-31" />
            <Chiffre label={t("Autres listes")} valeur={t("OFAC : absent · SECO : absent")} />
          </div>
        </section>
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "13px 16px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{t("Où cette personne intervient")}</div>
          {[["Meridian Trust Ltd", "UBO · 55 %", t("DOSSIER BLOQUÉ"), "alert"],
            ["Volkov Family Foundation", t("fondateur"), t("REVUE ANTICIPÉE"), "warn"]].map(([nom, role, chip, mode]) => (
            <div key={nom as string} style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", borderBottom: "1px solid var(--border-row)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{nom}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{role}</span>
              <span style={{ marginLeft: "auto" }}><StatusChip mode={mode as never}>{chip}</StatusChip></span>
            </div>))}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 8 }}>
            {t("Une seule qualification vaut pour la personne : elle se propage aux deux dossiers par événement, sans double saisie.")}</div>
        </section>
      </Ui2Shell>);
  }

  return (
    <Ui2Shell nav={nav} sideWidth={400}
      header={<Ui2HeaderDossier nom={t("Alerte AML-2026-0447")} initiales="⚠"
        identifiants="Cèdre Maritime SARL · corridor Genève → Beyrouth · ouverte il y a 2 h"
        puces={<><StatusChip mode="alert">{t("CRITIQUE")}</StatusChip><StatusChip mode="neutral">{t("EN COURS")}</StatusChip></>}
        actions={<><Ui2Bouton onClick={() => setEcran("hit")}>{t("Hit screening lié →")}</Ui2Bouton>
          <Ui2Bouton>{t("Rejouer l'historique")}</Ui2Bouton><Ui2Bouton>{t("Escalader au MLRO")}</Ui2Bouton></>} t={t} />}
      side={<DecisionPanel key={ecran} titre={t("Qualifier l'alerte")} t={t}
        sousTitre={t("Toute qualification exige un motif. Elle est horodatée, nominative et opposable.")}
        options={[
          { id: "FAUX_POSITIF", titre: t("Faux positif"), sous: t("Le flux est expliqué par le dossier") },
          { id: "INVESTIGATION", titre: t("Investigation approfondie"), sous: t("Demander des justificatifs au client") },
          { id: "MROS", titre: t("Communication MROS"), sous: t("Soupçon fondé — escalade MLRO obligatoire") }]}
        effets={[t("Tâche créée pour le gestionnaire"), t("Dossier KYC repassé en revue anticipée"),
          t("Compte non bloqué — aucun effet automatique")]}
        boutonLabel={t("Enregistrer la qualification")}
        mention={t("Le second regard MLRO reste requis avant clôture.")}
        onDecider={setDecision} />}>
      {pilules}
      {bandeauDecision}
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--alert-line)",
        borderLeft: "3px solid var(--alert-line)", borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 14 }}>
        <div className="microlabel" style={{ marginBottom: 5 }}>{t("Règle déclenchée")}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          AML-R17 — {t("écart au profil de flux déclaré")}</div>
        <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.55, maxWidth: 620 }}>
          {t("Trois virements sortants vers une contrepartie non déclarée, cumulés à 2,4 M CHF sur 9 jours, alors que le dossier annonce des flux commerciaux de 150 à 400 k CHF par trimestre.")}</div>
        <div style={{ display: "flex", gap: 30, marginTop: 12, flexWrap: "wrap" }}>
          <Chiffre label={t("Attendu au dossier")} valeur="≤ 400 000 / trim." />
          <Chiffre label={t("Constaté")} valeur="2 400 000 / 9 j" mode="alert" />
          <Chiffre label={t("Écart")} valeur="× 6,0" mode="alert" />
          <Chiffre label={t("Pays contrepartie")} valeur={t("Liban — risque élevé")} mode="warn" />
        </div>
      </section>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "11px 16px",
          borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("Transactions concernées")}</span>
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text-muted)" }}>
            {t("rapprochées automatiquement · 3 sur 128 du mois")}</span>
        </div>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 150px 110px",
          padding: "0 16px", background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
          {[t("Date"), t("Contrepartie"), t("Montant"), t("Canal"), t("Écart")].map((h) => (
            <span key={h} className="microlabel" style={{ padding: "8px 10px 8px 0" }}>{h}</span>))}
        </div>
        {[["31.07.2026", "840 000", "× 2,1"], ["04.08.2026", "760 000", "× 1,9"], ["08.08.2026", "800 000", "× 2,0"]]
          .map(([date, montant, ecart]) => (
          <div role="row" key={date} style={{ display: "grid", gridTemplateColumns: "110px 1fr 130px 150px 110px",
            alignItems: "center", padding: "0 16px", borderBottom: "1px solid var(--border-row)" }}>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 11.5, color: "var(--text-muted)" }}>{date}</span>
            <span style={{ padding: "11px 10px 11px 0", minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>Levant Shipping Co.</span>
              <span style={{ display: "block", fontSize: 10.5, color: "var(--text-muted)" }}>
                {t("Beyrouth · non déclarée au dossier")}</span></span>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 12, fontWeight: 600 }}>{montant}</span>
            <span className="mono" style={{ padding: "11px 10px 11px 0", fontSize: 11.5, color: "var(--text-muted)" }}>SWIFT MT103</span>
            <span style={{ padding: "9px 0" }}><StatusChip mode="alert">{ecart}</StatusChip></span>
          </div>))}
        <button style={{ display: "block", padding: "11px 16px", border: "none", background: "transparent",
          cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
          {t("Voir les 125 transactions du mois pour contexte →")}</button>
      </section>
      <div style={{ background: "var(--ai-card)", border: "1px solid var(--ai-card-border)",
        borderRadius: 11, padding: 12, fontSize: 12, lineHeight: 1.55, color: "var(--ai-text)" }}>
        <span className="mono" style={{ fontSize: 9.5, background: "var(--ai-chip)", padding: "1px 5px",
          borderRadius: 4, letterSpacing: 1 }}>IA</span>{" "}
        {t("Levant Shipping Co. apparaît dans deux dossiers de la banque comme fournisseur du même groupe. La contrepartie n'est pas sous sanction. Le motif de rejet le plus fréquent sur cette règle est « flux commercial documenté ».")}
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
          {t("Éléments de contexte — aucune décision n'est proposée sur une alerte critique.")}</div>
      </div>
    </Ui2Shell>);
}
