import React, { useMemo, useState } from "react";
import { apiPost, isDemoMode } from "../../lib/api";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { FilterBar } from "../../components/FilterBar";
import { dedupeKeys } from "../../lib/dedupeKeys";
import { useConfirmGate } from "../../components/ConfirmValidation";
import { AML_GAP_SCENARIOS, AML_GAP_GT_SEED, AmlGapScenarioSeed, AmlGapGtSeed } from "./aml-gap.seed.gen";

// Écran AML Gap Wave 1 (R340–R377, blocs 50–56) — onglet du Compliance Center. Trois vues :
//  • Règles : le référentiel des 38 scénarios (familles = thèmes FilterBar) + cas GT enrichis (R-FB) ;
//  • Signaux : l'inbox /v1/aml/signals filtrable, qualification TP/FP via la modale (motif obligatoire, R7) ;
//  • Gouvernance : BTL / backtesting / DQ / calibrage annuel — DIFFÉRÉ (worker aml-eval), affiché honnêtement.
// Le référentiel et le corpus GT sont GÉNÉRÉS (aml-gap.seed.gen.ts, source tools/aml-gap/gen_aml_gap.py) ;
// useApiOrSeed relit le backend quand il est présent, retombe sur ce seed sinon (source jamais masquée).

const FAM_LABEL: Record<string, string> = {
  // Wave 1 (R340–R377)
  SF: "Screening en flux", QO: "Indices OBA-FINMA", GU: "Vision groupe UBO", IP: "Instruments PB",
  CR: "Crypto / VASP", FT: "CFT", GV: "Gouvernance",
  // Wave 2 (R378–R403) — Analytique 2G : détecteurs statistiques exécutés dans le service Python CPSI
  TB: "TBML", CB: "Correspondent Banking", PF: "Prolifération", IA: "Immobilier & Art", AN: "Analytique 2G",
};
const GREEN = "#4A6B28", AMBER = "#C9A227", RED = "#B5483C", INK = "#1A2410", MUTE = "#8A8F82", LINE = "#E6E9DF";

type Signal = {
  id: string; scenarioCode: string; ruleRef: string; famille: string; clientId: string | null;
  niveau: number | null; blocking: boolean; status: string; outcome?: string | null; createdAt: string;
};

// Seed de l'inbox : quelques signaux NEW dérivés des cas GT TP clientés (démo — le backend, présent,
// sert les vrais signaux append-only).
const SEED_SIGNALS: Signal[] = AML_GAP_GT_SEED
  .filter((c) => c.label === "TP" && c.clientId && c.clientId !== "—")
  .slice(0, 10)
  .map((c, i) => {
    const sc = AML_GAP_SCENARIOS.find((s) => s.code === c.scenarioId)!;
    return {
      id: "sig-seed-" + (i + 1), scenarioCode: c.scenarioId, ruleRef: c.ruleRef, famille: c.famille,
      clientId: c.clientId, niveau: sc?.niveau ?? null, blocking: !!sc?.blocking, status: "NEW",
      outcome: null, createdAt: "2026-08-0" + ((i % 8) + 1) + "T09:00:00.000Z",
    };
  });

const badge = (txt: string, bg: string, fg = "#fff") => (
  <span style={{ padding: "2px 8px", borderRadius: 10, background: bg, color: fg, fontSize: 10.5, fontWeight: 800 }}>{txt}</span>
);

export function AmlGap() {
  const [tab, setTab] = useState<"regles" | "signaux" | "gouv">("regles");
  const tabBtn = (id: typeof tab, label: string) => (
    <button key={id} onClick={() => setTab(id)} style={{
      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      background: tab === id ? GREEN : "transparent", color: tab === id ? "#fff" : "#555",
      fontSize: 13, fontWeight: tab === id ? 700 : 500,
    }}>{label}</button>
  );
  return (
    <div>
      {isDemoMode() && <DemoModeBanner />}
      <h3 style={{ marginBottom: 4 }}>AML Gap Waves 1+2 — flux, UBO, crypto, CFT, TBML, correspondent banking, prolifération (R340→R403)</h3>
      <p style={{ fontSize: 12, color: MUTE, marginTop: 0 }}>
        64 scénarios en 12 familles. Le moteur SIGNALE, il ne décide jamais seul ; un scénario bloquant émet
        une demande de blocage (décision humaine requise, R44/R39). Seuils pilotés par le registre R-Q.
        L'Analytique 2G (z-score robuste, changepoint) s'exécute dans le service Python CPSI — jamais en Nest.</p>
      <div style={{ display: "flex", gap: 4, margin: "12px 0 16px", background: "#F7F9F3", padding: 5, borderRadius: 12, border: `1px solid ${LINE}`, width: "fit-content" }}>
        {tabBtn("regles", "▤ Règles & cas GT")}
        {tabBtn("signaux", "🔔 Signaux")}
        {tabBtn("gouv", "🎚 Gouvernance du tuning")}
      </div>
      {tab === "regles" && <ReglesTab />}
      {tab === "signaux" && <SignauxTab />}
      {tab === "gouv" && <GouvTab />}
    </div>
  );
}

// ── Onglet Règles : référentiel + cas GT ──
function ReglesTab() {
  const { data: scenarios } = useApiOrSeed<AmlGapScenarioSeed[]>("/v1/aml/scenarios", AML_GAP_SCENARIOS);
  const { data: gt } = useApiOrSeed<AmlGapGtSeed[]>("/v1/aml/ground-truth", AML_GAP_GT_SEED);
  const [fam, setFam] = useState("ALL");
  const [niveau, setNiveau] = useState("ALL");
  const [bloq, setBloq] = useState("ALL");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const gtByScenario = useMemo(() => {
    const m: Record<string, AmlGapGtSeed[]> = {};
    for (const c of gt) (m[c.scenarioId] = m[c.scenarioId] || []).push(c);
    return m;
  }, [gt]);

  const famCount: Record<string, number> = {};
  for (const s of scenarios) famCount[s.famille] = (famCount[s.famille] || 0) + 1;
  const view = scenarios.filter((s) =>
    (fam === "ALL" || s.famille === fam) &&
    (niveau === "ALL" || String(s.niveau) === niveau) &&
    (bloq === "ALL" || (bloq === "ON" ? s.blocking : true)));

  return (
    <div>
      <FilterBar
        filters={[
          { id: "fam", label: "Famille", value: fam, allValue: "ALL", onChange: setFam,
            options: ([["ALL", "Toutes familles"]] as [string, string][]).concat(
              Object.keys(FAM_LABEL).map((f) => [f, `${FAM_LABEL[f]} · ${famCount[f] || 0}`] as [string, string])) },
          { id: "niveau", label: "Niveau", value: niveau, allValue: "ALL", onChange: setNiveau,
            options: [["ALL", "Tous niveaux"], ["1", "Niveau 1"], ["2", "Niveau 2"]] },
          { id: "bloq", label: "Bloquant", value: bloq, allValue: "ALL", onChange: setBloq,
            options: [["ALL", "Indifférent"], ["ON", "Oui"]] },
        ]}
        shown={view.length}
        total={scenarios.length}
        onReset={() => { setFam("ALL"); setNiveau("ALL"); setBloq("ALL"); }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 12 }}>
        {dedupeKeys(view, (s: AmlGapScenarioSeed) => s.code, "AML Gap — référentiel").items.map(({ item: s, key }) => {
          const cases = gtByScenario[s.code] || [];
          const tp = cases.filter((c) => c.label === "TP").length;
          const fp = cases.filter((c) => c.label === "FP").length;
          const open = openCode === s.code;
          return (
            <div key={key} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 14,
              borderLeft: `4px solid ${s.blocking ? RED : s.niveau === 1 ? AMBER : GREEN}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div onClick={() => setOpenCode(open ? null : s.code)} style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: INK, cursor: "pointer" }}>{s.titre}</div>
                {s.blocking && badge("⛔ BLOQUE", RED)}
                {s.niveau != null && badge("N" + s.niveau, s.niveau === 1 ? AMBER : GREEN)}
              </div>
              <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.5, marginBottom: 8 }}>{s.desc}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 10.5, color: MUTE }}>
                <span style={{ fontFamily: "monospace", color: GREEN, fontWeight: 700 }}>{s.ruleRef}</span>
                <span>· {FAM_LABEL[s.famille]}</span>
                <span style={{ marginLeft: "auto" }}>{badge(`${tp} TP · ${fp} FP`, "#EEF3E6", GREEN)}</span>
              </div>
              {open && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: "#444", lineHeight: 1.6, marginBottom: 8 }}>
                    <b style={{ color: GREEN }}>Given</b> {s.gherkin.given}<br />
                    <b style={{ color: GREEN }}>When</b> {s.gherkin.when}<br />
                    <b style={{ color: GREEN }}>Then</b> {s.gherkin.then}
                  </div>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: .5, color: MUTE, marginBottom: 4 }}>Cas Ground Truth</div>
                  {cases.map((c) => (
                    <div key={c.caseId} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid #F0F0EA`, fontSize: 11 }}>
                      {badge(c.label, c.label === "TP" ? GREEN : AMBER)}
                      <span style={{ flex: 1, color: c.placeholder ? MUTE : "#333", fontStyle: c.placeholder ? "italic" : "normal" }}>
                        {c.placeholder ? "— cas laissé vide par la spec (en attente PO) —" : c.narrative}
                        {c.ecartement && <span style={{ color: MUTE }}> · écartement : {c.ecartement}</span>}
                      </span>
                      <span style={{ fontFamily: "monospace", color: MUTE, fontSize: 10 }}>{c.clientId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Onglet Signaux : inbox filtrable + qualification TP/FP (motif obligatoire, R7) ──
function SignauxTab() {
  const { data, isDemo, reload } = useApiOrSeed<Signal[]>("/v1/aml/signals", SEED_SIGNALS);
  const [local, setLocal] = useState<Signal[] | null>(null);
  const signaux = local ?? data;
  const { ask, modal } = useConfirmGate();
  const [status, setStatus] = useState("ALL");
  const [fam, setFam] = useState("ALL");
  const [niveau, setNiveau] = useState("ALL");
  const [bloq, setBloq] = useState("ALL");

  const view = signaux.filter((s) =>
    (status === "ALL" || s.status === status) &&
    (fam === "ALL" || s.famille === fam) &&
    (niveau === "ALL" || String(s.niveau) === niveau) &&
    (bloq === "ALL" || (bloq === "ON" ? s.blocking : true)));

  function qualifier(sig: Signal, outcome: "TP" | "FP") {
    ask({
      title: `Qualifier le signal ${sig.ruleRef} — ${outcome}`,
      message: `Scénario ${sig.scenarioCode}${sig.clientId ? " · client " + sig.clientId : ""}. La qualification est append-only et tracée.`,
      items: [
        { label: "Signal ouvert (NEW / en revue)", ok: sig.status === "NEW" || sig.status === "UNDER_REVIEW" },
        { label: "Décision humaine (le moteur ne décide pas — R44)", ok: true },
      ],
      input: { label: "Motif de qualification", placeholder: "ex. origine des fonds corroborée", required: true },
      confirmLabel: `Confirmer ${outcome}`,
      danger: outcome === "FP",
      onConfirm: async (motif) => {
        // Backend présent : POST gouverné (append-only). Absent (démo) : mise à jour locale signalée.
        await apiPost(`/v1/aml/signals/${sig.id}/qualify`, { outcome, motif }).catch(() => undefined);
        if (isDemo) setLocal((signaux).map((x) => x.id === sig.id ? { ...x, status: outcome, outcome } : x));
        else reload();
      },
    });
  }

  return (
    <div>
      <FilterBar
        filters={[
          { id: "status", label: "Statut", value: status, allValue: "ALL", onChange: setStatus,
            options: [["ALL", "Tous statuts"], ["NEW", "Nouveau"], ["UNDER_REVIEW", "En revue"], ["TP", "TP"], ["FP", "FP"], ["ESCALATED", "Escaladé"]] },
          { id: "fam", label: "Famille", value: fam, allValue: "ALL", onChange: setFam,
            options: ([["ALL", "Toutes familles"]] as [string, string][]).concat(
              Object.keys(FAM_LABEL).map((f) => [f, FAM_LABEL[f]] as [string, string])) },
          { id: "niveau", label: "Niveau", value: niveau, allValue: "ALL", onChange: setNiveau,
            options: [["ALL", "Tous niveaux"], ["1", "Niveau 1"], ["2", "Niveau 2"]] },
          { id: "bloq", label: "Bloquant", value: bloq, allValue: "ALL", onChange: setBloq,
            options: [["ALL", "Indifférent"], ["ON", "Oui"]] },
        ]}
        shown={view.length}
        total={signaux.length}
        onReset={() => { setStatus("ALL"); setFam("ALL"); setNiveau("ALL"); setBloq("ALL"); }}
      />
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ background: "#F4F6EF", textAlign: "left" }}>
            {["Règle", "Scénario", "Famille", "Client", "Niv.", "Statut", "Action"].map((h) =>
              <th key={h} style={{ padding: "9px 12px", fontSize: 10, color: MUTE, textTransform: "uppercase", letterSpacing: .5 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {view.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid #F0F0EA` }}>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontWeight: 700, color: GREEN }}>{s.ruleRef}{s.blocking && " ⛔"}</td>
                <td style={{ padding: "9px 12px" }}>{s.scenarioCode}</td>
                <td style={{ padding: "9px 12px", color: "#555" }}>{FAM_LABEL[s.famille] || s.famille}</td>
                <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: MUTE }}>{s.clientId || "—"}</td>
                <td style={{ padding: "9px 12px" }}>{s.niveau != null ? "N" + s.niveau : "—"}</td>
                <td style={{ padding: "9px 12px" }}>{
                  s.status === "TP" ? badge("TP", GREEN) : s.status === "FP" ? badge("FP", AMBER)
                    : <span style={{ fontWeight: 700, color: "#555" }}>{s.status}</span>}</td>
                <td style={{ padding: "9px 12px" }}>
                  {(s.status === "NEW" || s.status === "UNDER_REVIEW") ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => qualifier(s, "TP")} style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${GREEN}`, background: "#fff", color: GREEN, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>TP</button>
                      <button onClick={() => qualifier(s, "FP")} style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${AMBER}`, background: "#fff", color: AMBER, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>FP</button>
                    </span>
                  ) : <span style={{ fontSize: 10.5, color: MUTE }}>qualifié</span>}
                </td>
              </tr>
            ))}
            {view.length === 0 && <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: MUTE }}>Aucun signal pour ce filtre.</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>La qualification exige un motif (R7) et se fait par la modale de validation (contrat UX). Le back reste l'autorité (append-only).</p>
      {modal}
    </div>
  );
}

// ── Onglet Gouvernance : BTL / backtest / DQ / calibrage annuel — DIFFÉRÉ (worker aml-eval) ──
function GouvTab() {
  const gv = AML_GAP_SCENARIOS.filter((s) => s.famille === "GV");
  return (
    <div>
      <div style={{ background: "#FBF6E7", border: `1px solid ${AMBER}55`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#6b5a1c" }}>
        Le tuning (below-the-line sampling, backtesting par version, statut data-quality, revue annuelle de calibrage)
        s'exécute dans le worker <b>aml-eval</b> (BullMQ) — <b>différé</b> tant que Postgres/Redis ne sont pas provisionnés.
        Ci-dessous les 4 capacités de gouvernance du dispositif (bloc 56, R374→R377), en attente de câblage.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
        {gv.map((s) => (
          <div key={s.code} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, borderLeft: `4px solid ${MUTE}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: INK }}>{s.titre}</div>
              <span style={{ fontFamily: "monospace", fontSize: 10.5, color: GREEN, fontWeight: 700 }}>{s.ruleRef}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.5 }}>{s.desc}</div>
            <div style={{ marginTop: 8 }}>{badge("différé — worker aml-eval", "#EDEDE7", MUTE)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
