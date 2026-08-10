import React, { useState } from "react";
import { LayoutGrid, ArrowLeftRight } from "lucide-react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip } from "./StatusChip";
import { FieldCard } from "./FieldCard";
import { SectionChecklist, SectionEtat } from "./SectionChecklist";
import { EventTimeline } from "./EventTimeline";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";
import kycSeed from "../seed/kyc.json";

/**
 * UI v2 — écran 02 « Dossier KYC » (handoff, maquette screenshots/02-dossier-kyc.png).
 * Le dossier S'OUVRE SUR LA PREMIÈRE SECTION INCOMPLÈTE et sur ses champs manquants — jamais
 * sur le premier onglet (bandeau ambre qui l'explique). Colonne des sections 262px, champs au
 * centre (FieldCard : provenance OBLIGATOIRE quand renseigné, bordure ambre permanente quand
 * manquant, Olivia PROPOSE — reprendre est un acte), colonne latérale 320px : « Qui doit agir »,
 * « Ce qui bloque la transmission », journal du dossier. Le bouton « Transmettre pour visa »
 * RESTE ACTIF : au clic il énonce précisément ce qui manque — jamais grisé sans explication.
 */

const SECTIONS: SectionEtat[] = [
  { code: "ident", label: "Identification", etat: "visee" },
  { code: "structure", label: "Structure & ayants droit", etat: "visee" },
  { code: "activite", label: "Activité économique", etat: "visee" },
  { code: "fonds", label: "Origine des fonds", etat: "encours", manquants: 2 },
  { code: "patrimoine", label: "Origine du patrimoine", etat: "encours", manquants: 1 },
  { code: "fiscalite", label: "Fiscalité", etat: "vide" },
  { code: "crossborder", label: "Cross-border", etat: "vide" },
  { code: "risque", label: "Profil de risque", etat: "vide" },
];
const MANQUES = [
  "2 champs obligatoires en origine des fonds",
  "1 champ en origine du patrimoine",
];

// ── V2-M1 : les VRAIES données du parcours Connaissance client, sources signalées ──────────
// Détail du dossier (/v1/kyc/:code) : sections COPIÉES du gabarit à la création (R29),
// visas R15 par section. Les seeds miment ces formes pour l'aperçu hors API.
type KycDetail = { code: string; status?: string; clientId?: string;
  sections?: { code: string; label?: string; questions?: { code: string; label?: string;
    answer?: string | null; required?: boolean }[] }[];
  visas?: { sectionCode: string; status?: string; signedBy?: string | null }[] } | null;

type Piece = { id: string; typeCode?: string; statut?: string; version?: number; empreinte?: string; nom?: string };
const SEED_PIECES: Piece[] = [
  { id: "doc-1", nom: "Acte de trust", typeCode: "ACTE_NOTARIE", statut: "CLASSE", version: 2, empreinte: "ancrée le 14.11.2023" },
  { id: "doc-2", nom: "Passeport UBO", typeCode: "PIECE_IDENTITE", statut: "CLASSE", version: 1, empreinte: "ancrée le 02.02.2024" },
  { id: "doc-3", nom: "Attestation d'origine des fonds", typeCode: "ATTESTATION", statut: "A_CLASSER", version: 1, empreinte: "ancrée le 02.02.2024" },
];

// Matrice documentaire en vigueur (/v1/doc-matrix/en-vigueur, R26/R27/R29) — le dossier garde
// la version de sa création ; l'écran affiche l'évaluation de complétude, pas le contenu (R145).
const SEED_MATRICE = { version: "v7 — en vigueur du 01.06.2026", exigences: [
  { code: "SOF-DOC", libelle: "Justificatif d'origine des fonds", attendu: "Acte notarié ou contrat de cession", etat: "OK" },
  { code: "ID-UBO", libelle: "Pièce d'identité de chaque UBO", attendu: "Passeport en cours de validité", etat: "OK" },
  { code: "SOW-EDD", libelle: "Corroboration du patrimoine (EDD)", attendu: "États financiers ou attestation fiduciaire", etat: "MANQUANT" },
] };

// Matrice cross-border (/v1/crossborder/matrice, R453 — synchronisée par le port, versionnée).
const SEED_XB = { version: "2026-07-15 · synchronisée", entrees: [
  { jurisdiction: "Luxembourg", regime: "Démarchage conforme — enregistrement CSSF", etat: "ok" },
  { jurisdiction: "Émirats arabes unis", regime: "Restrictions — reverse solicitation uniquement", etat: "warn" },
  { jurisdiction: "Suède", regime: "Libre prestation (UE) — notification faite", etat: "ok" },
] };

export function DossierKyc({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"dossier" | "pieces" | "corroboration" | "crossborder">("dossier");
  // V2-M1 : le dossier RÉEL si l'API répond (premier de /v1/kyc puis /v1/kyc/:code) — sinon
  // la maquette, source signalée. Les invariants (1re section incomplète, bouton jamais
  // grisé) valent pour les DEUX sources.
  const liste = useApiOrSeed<{ code: string; clientId?: string }[]>("/v1/kyc", kycSeed as never);
  const code = Array.isArray(liste.data) && liste.data[0]?.code ? liste.data[0].code : "";
  const detail = useApiOrSeed<KycDetail>(code ? `/v1/kyc/${code}` : "/v1/kyc/__hors-api__", null);
  const reel = !detail.isDemo && detail.data?.sections?.length ? detail.data : null;
  const sections: SectionEtat[] = reel
    ? reel.sections!.map((s) => {
        const qs = s.questions ?? [];
        const manquants = qs.filter((q) => q.answer == null).length;
        const visee = (reel.visas ?? []).some((v) => v.sectionCode === s.code && (v.signedBy || v.status === "SIGNED"));
        return { code: s.code, label: s.label ?? s.code,
          etat: visee ? "visee" : qs.some((q) => q.answer != null) ? "encours" : "vide",
          manquants: manquants || undefined };
      })
    : SECTIONS;
  const manquesAffiches = reel
    ? sections.filter((s) => s.etat !== "visee" && s.manquants)
        .map((s) => `${s.manquants} ${t("champ(s) en")} ${s.label}`)
    : MANQUES;
  const pieces = useApiOrSeed<Piece[]>(
    reel?.clientId ? `/v1/ged/documents?clientId=${reel.clientId}` : "/v1/ged/documents", SEED_PIECES);
  const matrice = useApiOrSeed<typeof SEED_MATRICE>("/v1/doc-matrix/en-vigueur", SEED_MATRICE);
  const xb = useApiOrSeed<typeof SEED_XB>("/v1/crossborder/matrice", SEED_XB);
  // Ouverture : PREMIÈRE section incomplète (celle qui porte des manquants) — le principe n°1.
  const premiereIncomplete = sections.find((s) => s.etat !== "visee")?.code ?? sections[0].code;
  const [section, setSection] = useState(premiereIncomplete);
  const [manques, setManques] = useState(false);               // panneau « ce qui manque » au clic
  const [montant, setMontant] = useState("");
  const sectionActive = sections.some((s) => s.code === section) ? section : premiereIncomplete;
  const sectionCourante = reel?.sections?.find((s) => s.code === sectionActive);
  const pilule = (id: typeof onglet, label: string) => (
    <button key={id} onClick={() => setOnglet(id)} aria-pressed={onglet === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: onglet === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: onglet === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: onglet === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  const champStyle: React.CSSProperties = { padding: "8px 11px", borderRadius: "var(--r-input)",
    border: "1px solid var(--border-input)", fontFamily: "inherit", fontSize: 12.5,
    color: "var(--text)", background: "var(--bg-surface)" };
  return (
    <Ui2Shell
      nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager" onNavigate={onNavigate} t={t}
        badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
          kyc: { n: 3, sobre: true }, surveillance: { n: 5, alert: true } }}
        modulesLicencies={[{ id: "pms", label: "PMS", icon: <LayoutGrid size={16} strokeWidth={1.75} /> },
          { id: "fx", label: "Multi-devise & FX", icon: <ArrowLeftRight size={16} strokeWidth={1.75} /> }]} />}
      header={<Ui2HeaderDossier nom={reel ? reel.clientId ?? reel.code : "Nordwind Holding AG"}
        initiales={reel ? (reel.clientId ?? reel.code).slice(0, 2).toUpperCase() : "NH"}
        identifiants={reel
          ? `${reel.code} · ${reel.status ?? ""} · ${t("source : /v1/kyc (API)")}`
          : `CLI-04812 · ${t("Personne morale · Zoug · relation depuis 2019")} · ${t("données maquette")}`}
        puces={<><StatusChip mode="alert">{t("RISQUE ÉLEVÉ")}</StatusChip><StatusChip mode="neutral">EDD</StatusChip></>}
        actions={<><Ui2Bouton>{t("Chronologie")}</Ui2Bouton>
          <Ui2Bouton onClick={() => setOnglet("pieces")}>{t("Documents")}</Ui2Bouton>
          <Ui2Bouton primaire onClick={() => { setOnglet("dossier"); setManques(true); }}>{t("Transmettre pour visa")}</Ui2Bouton></>} t={t} />}
      sideWidth={320}
      side={<div>
        <div className="microlabel" style={{ marginBottom: 10 }}>{t("Qui doit agir")}</div>
        <EventTimeline events={[
          { id: "q1", titre: t("Saisie gestionnaire") + " — C. Morel", meta: t("en cours"), mode: "ok" },
          { id: "q2", titre: t("Visa Compliance"), meta: t("en attente") + " · SLA 3 j", ici: true },
          { id: "q3", titre: t("Décision MLRO"), meta: t("requis en EDD"), mode: "info" },
        ]} />
        <div style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
          borderRadius: 11, padding: 12, margin: "6px 0 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--warn-text)", marginBottom: 6 }}>
            {t("Ce qui bloque la transmission")}</div>
          {manquesAffiches.map((m, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--warn-text)", padding: "2px 0" }}>◐ {t(m)}</div>))}
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 7 }}>
            {t("Le bouton reste actif : il indiquera précisément ce qui manque plutôt que d'être grisé sans explication.")}</div>
        </div>
        <div className="microlabel" style={{ marginBottom: 8 }}>{t("Journal du dossier")}</div>
        <EventTimeline events={[
          { id: "j1", titre: t("Section « activité économique » visée"), meta: "08.08 · M. Bregy", mode: "ok" },
          { id: "j2", titre: t("Screening relancé — aucun hit"), meta: "07.08 · système", mode: "ok" },
          { id: "j3", titre: t("Passage CDD → EDD (pays de l'ayant droit)"), meta: "02.08 · moteur de règles", mode: "warn" },
        ]} />
      </div>}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {pilule("dossier", t("Dossier"))}
        {pilule("pieces", `${t("Pièces (GED)")} · ${Array.isArray(pieces.data) ? pieces.data.length : 0}`)}
        {pilule("corroboration", t("Corroboration"))}
        {pilule("crossborder", t("Cross-border"))}
      </div>
      {onglet === "pieces" && (<>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          {pieces.isDemo ? t("données maquette") : t("source : /v1/ged/documents (métadonnées et empreintes — jamais le contenu, R145)")}</div>
        <EntityList grid="1.4fr 130px 110px 1fr" onOpen={() => undefined}
          entetes={[t("Pièce"), t("Type"), t("Statut"), t("Version · empreinte")]}
          lignes={(Array.isArray(pieces.data) ? pieces.data : []).slice(0, 30).map((p) => ({
            id: p.id, cells: [
              <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{p.nom ?? p.id}</span>,
              <span key="t" className="mono">{p.typeCode ?? "—"}</span>,
              <StatusChip key="s" mode={p.statut === "A_CLASSER" ? "warn" : "ok"}>{t(p.statut ?? "CLASSE")}</StatusChip>,
              <span key="e" className="mono">{`v${p.version ?? 1} · ${p.empreinte ?? t("empreinte au coffre")}`}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("La seule voie vers le contenu est la relecture vérifiée du coffre, par empreinte (R145). Les pièces sont aussi trouvables via ⌘K.")}</div>
      </>)}
      {onglet === "corroboration" && (<>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t("Corroboration documentaire")}</span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            {t("exigence CDB 20 · art. 27 — corroboration requise en EDD")}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          {(matrice.isDemo ? t("données maquette") : t("source : /v1/doc-matrix/en-vigueur")) +
            " · " + t("matrice") + " " + (matrice.data?.version ?? "")}</div>
        <EntityList grid="1.2fr 1.4fr 130px" onOpen={() => undefined}
          entetes={[t("Exigence"), t("Pièce attendue"), t("État")]}
          lignes={(matrice.data?.exigences ?? []).map((e) => ({ id: e.code, cells: [
            <span key="l" style={{ fontWeight: 600, color: "var(--text)" }}>{t(e.libelle)}</span>,
            t(e.attendu),
            <StatusChip key="c" mode={e.etat === "OK" ? "ok" : "warn"}>{t(e.etat === "OK" ? "COUVERTE" : "MANQUANTE")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("La matrice est versionnée (R26/R27) et le dossier garde la version de sa création (R29) — jamais la « courante ».")}</div>
      </>)}
      {onglet === "crossborder" && (<>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{t("Cross-border — juridictions du dossier")}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          {(xb.isDemo ? t("données maquette") : t("source : /v1/crossborder/matrice (R453)")) +
            " · " + t("version") + " " + (xb.data?.version ?? "")}</div>
        <EntityList grid="180px 1fr 110px" onOpen={() => undefined}
          entetes={[t("Juridiction"), t("Régime applicable"), t("État")]}
          lignes={(xb.data?.entrees ?? []).map((e) => ({ id: e.jurisdiction, cells: [
            <span key="j" style={{ fontWeight: 600, color: "var(--text)" }}>{e.jurisdiction}</span>,
            t(e.regime ?? ""),
            <StatusChip key="c" mode={(e.etat ?? "ok") === "ok" ? "ok" : "warn"}>{t((e.etat ?? "ok") === "ok" ? "CONFORME" : "RESTREINT")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("La matrice cross-border est synchronisée par le port et versionnée (R453) ; tout acte est évalué contre la version en vigueur à sa date (R48).")}</div>
      </>)}
      {onglet === "dossier" && (
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <SectionChecklist sections={sections} courante={sectionActive} onOuvrir={setSection} t={t}
          pied={<div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("Prochaine échéance")}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>
              {t("Revue périodique")} — <span className="mono">14.09.2026</span></div>
          </div>} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              {reel && sectionCourante ? t(sectionCourante.label ?? sectionCourante.code) : t("Origine des fonds")}</h2>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {t("exigence CDB 20 · art. 27 — corroboration requise en EDD")}</span>
          </div>
          <div style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
            borderRadius: 9, padding: "8px 12px", fontSize: 11.5, color: "var(--warn-text)", marginBottom: 12 }}>
            ◐ {t("Ouvert directement sur les 2 champs manquants. Les sections déjà visées ne sont pas rouvertes.")}</div>
          {manques && (
            <div role="alert" style={{ background: "var(--alert-card)", border: "1px solid var(--alert-line)",
              borderRadius: 9, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--alert-text)", marginBottom: 5 }}>
                {t("Transmission impossible — il manque :")}</div>
              {manquesAffiches.map((m, i) => (
                <div key={i} style={{ fontSize: 11.5, color: "var(--alert-text)", padding: "1px 0" }}>→ {t(m)}</div>))}
              <button onClick={() => setManques(false)} style={{ marginTop: 7, padding: "4px 10px",
                borderRadius: 7, border: "1px solid var(--border-input)", background: "var(--bg-surface)",
                fontFamily: "inherit", fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>{t("Compris")}</button>
            </div>)}
          {reel && sectionCourante ? (
            (sectionCourante.questions ?? []).map((q) => q.answer != null ? (
              <FieldCard key={q.code} label={t(q.label ?? q.code)} etat="RENSEIGNE" t={t}
                valeur={<>{String(q.answer)}</>}
                provenance={`${t("réponse au dossier")} ${reel.code} · ${t("gabarit versionné à la création (R29)")}`} />
            ) : (
              <FieldCard key={q.code} label={t(q.label ?? q.code)} etat="MANQUANT" t={t}
                saisie={<input disabled value="" aria-label={t(q.label ?? q.code)}
                  placeholder={t("à compléter — saisie via l'écran KYC (aperçu v2 en lecture)")}
                  style={{ ...champStyle, width: "100%", boxSizing: "border-box", opacity: 0.75 }} />} />
            ))
          ) : (<>
          <FieldCard label={t("Source principale des apports")} etat="RENSEIGNE" t={t}
            valeur={<>Cession de participation — Nordwind Energie GmbH, 2019</>}
            provenance={t("Source : acte notarié du 12.03.2019 · empreinte vérifiée · saisi par M. Bregy")} />
          <FieldCard label={t("Montant et devise de l'apport initial")} etat="MANQUANT" t={t}
            saisie={<span style={{ display: "flex", gap: 8 }}>
              <input value={montant} onChange={(e) => setMontant(e.target.value)}
                placeholder={t("Montant")} aria-label={t("Montant")} style={{ ...champStyle, flex: 1 }} />
              <select aria-label={t("Devise")} style={champStyle}>
                <option>CHF</option><option>EUR</option><option>USD</option></select>
            </span>}
            olivia={{ texte: t("Olivia lit 14 200 000 CHF dans l'acte notarié — reprendre ?"),
              onReprendre: () => setMontant("14 200 000") }} />
          <FieldCard label={t("Flux récurrents attendus")} etat="MANQUANT" t={t}
            saisie={<input placeholder={t("Nature, fréquence et ordre de grandeur des flux")}
              aria-label={t("Flux récurrents attendus")} style={{ ...champStyle, width: "100%", boxSizing: "border-box" }} />}
            note={t("Sert de référence au monitoring transactionnel : un écart déclenchera une alerte.")} />
          </>)}
          <section style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: 11, padding: "13px 15px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
                {t("Corroboration documentaire")}</span>
              <span style={{ marginLeft: "auto" }}><StatusChip mode="neutral">3 {t("PIÈCES")}</StatusChip></span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>
              {t("Acte notarié · états financiers 2018-2019 · attestation fiduciaire")}</div>
          </section>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Ui2Bouton primaire>{t("Enregistrer et continuer")}</Ui2Bouton>
            <Ui2Bouton>{t("Demander au client")}</Ui2Bouton>
            <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
              {t("Brouillon enregistré")} · 14:02</span>
          </div>
        </div>
      </div>)}
    </Ui2Shell>);
}
