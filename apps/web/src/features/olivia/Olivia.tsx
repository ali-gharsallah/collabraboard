import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, apiGetSourced, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran OLIVIA v1 (étape 8, spec B.8) — panneau ANCRÉ : la conversation naît sur un objet
// (KYC, risk case, paramètre) vérifié PAR LE SERVEUR avant création. Chaque réponse porte son
// badge « Sourcé / Non sourcé — à vérifier » (R256) ; une sortie NON sourcée n'offre AUCUN
// bouton « Proposer » (contrainte aussi serveur : OLIVIA_UNSOURCED_PROPOSAL). Les cartes
// proposition se décident (adopt / reject motivé — R254, matrice B.3 appliquée serveur).
// Mode audit : rejeu à date (R257) — chaînage vérifié, décisions incluses. TOUT appel IA passe
// par /v1/olivia/* côté serveur — le navigateur ne parle JAMAIS au fournisseur (B.11.4, grep CI).

type Reponse = { conversationId: string; messageId: string; seq: number; texte: string; estSource: boolean;
  citations: { type: string; ref: string; assertion: string; valide?: boolean }[];
  contexteEmpreinte: string; contextePartiel: string | null; model: string };
type Proposition = { id: string; type: string; cibleType: string; cibleId: string; statut: string;
  justification: string; motifRejet?: string | null };

const CAPACITES = [
  { id: "C1", label: "C1 — Question (ancrage KYC optionnel)", ancrage: "KYC_FILE", requis: false },
  { id: "C2", label: "C2 — Synthèse de dossier KYC", ancrage: "KYC_FILE", requis: true },
  { id: "C3", label: "C3 — Pré-analyse alerte / risk case", ancrage: "RISK_CASE", requis: true },
  { id: "C4", label: "C4 — Paramétrage (chemin)", ancrage: "PARAM", requis: true },
];

export function Olivia() {
  const [cap, setCap] = useState("C1");
  const [ancrageId, setAncrageId] = useState("");
  const [convId, setConvId] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [reponses, setReponses] = useState<Reponse[]>([]);
  const [msg, setMsg] = useState("");
  const [horsService, setHorsService] = useState(false);
  const [justif, setJustif] = useState("");
  const [typeProp, setTypeProp] = useState("QUALIF_ALERTE_FP");
  const [cible, setCible] = useState("");
  const [audit, setAudit] = useState<any>(null);
  const [asOf, setAsOf] = useState("");
  const { data: props, reload: reloadProps } = useApiOrSeed<Proposition[]>("/v1/olivia/proposals?statut=PENDING", []);
  const capDef = CAPACITES.find((c) => c.id === cap)!;

  const agir = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setMsg("");
    try { return await fn(); }
    catch (e) {
      const err = e as OliveError;
      if (err.status === 503) setHorsService(true);                     // B.4 : visible, honnête, inactive
      else setMsg(err.message ?? "Erreur");                             // FE-04 : message serveur tel quel
      return null;
    }
  };

  const ouvrir = () => agir(async () => {
    const c = await apiPost<{ id: string }>("/v1/olivia/conversations",
      { capacite: cap, ...(ancrageId.trim() ? { ancrageType: capDef.ancrage, ancrageId: ancrageId.trim() } : {}) });
    setConvId(c.id); setReponses([]);
  });
  const envoyer = () => agir(async () => {
    const r = await apiPost<Reponse>(`/v1/olivia/conversations/${convId}/messages`, { texte });
    setReponses((xs) => [...xs, r]); setTexte("");
  });
  const proposer = (messageId: string) => agir(async () => {
    await apiPost("/v1/olivia/proposals", { messageId, type: typeProp,
      cibleType: typeProp === "AJUSTEMENT_PARAM" ? "PARAM" : typeProp.startsWith("QUALIF") ? "ALERTE" : "KYC_FILE",
      cibleId: cible, justification: justif });
    setJustif(""); reloadProps();
  });
  const decider = (id: string, adopt: boolean) => agir(async () => {
    const motif = adopt ? undefined : (window.prompt("Motif du rejet (obligatoire, R7)") ?? "");
    await apiPost(`/v1/olivia/proposals/${id}/${adopt ? "adopt" : "reject"}`, motif !== undefined ? { motif } : {});
    reloadProps();
  });
  const rejouer = () => agir(async () => {
    const r = await apiGetSourced<any>(`/v1/olivia/conversations/${convId}/replay${asOf ? `?as_of=${asOf}` : ""}`, null);
    if (!r.isDemo) setAudit(r.data);
  });

  if (horsService) return <div style={{ padding: 20, borderRadius: tokens.radius.lg, background: tokens.color.surface,
    border: `1px solid ${tokens.color.border}`, color: tokens.color.muted }}>
    <h3 style={{ color: tokens.color.muted }}>Olivia (non activée)</h3>
    <p>Olivia n&apos;est pas activée pour ce tenant — aucun fournisseur IA configuré (R253).
      Le reste de la plateforme fonctionne normalement.</p></div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Olivia — elle propose, vous décidez (R44)</h3>
    {msg && <p style={{ color: tokens.color.danger, fontSize: 13 }}>{msg}</p>}

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select value={cap} onChange={(e) => { setCap(e.target.value); setConvId(null); }}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
        {CAPACITES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <input placeholder={`ancrage ${capDef.ancrage}${capDef.requis ? " (requis)" : " (optionnel)"}`}
        value={ancrageId} onChange={(e) => setAncrageId(e.target.value)}
        style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 280 }}/>
      <button onClick={ouvrir} disabled={isDemoMode() || (capDef.requis && !ancrageId.trim())}
        style={{ padding: "7px 14px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer" }}>
        Ouvrir la conversation ancrée</button>
    </div>

    {convId && <div style={{ marginTop: 12, padding: 12, borderRadius: tokens.radius.lg,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
      <div style={{ fontSize: 12, color: tokens.color.muted }}>Conversation {convId.slice(0, 8)} · {cap}
        {ancrageId && <> · ancrée sur <strong>{ancrageId.slice(0, 12)}</strong></>}</div>
      {reponses.map((r) => <div key={r.seq} style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#fff",
        border: `1px solid ${tokens.color.border}` }}>
        <div style={{ fontSize: 13 }}>{r.texte}</div>
        {/* R256 : le badge dit la vérité du serveur — jamais recalculé au front */}
        <div style={{ marginTop: 6 }}>
          {r.estSource
            ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#E8F0DC", color: tokens.color.olive700, fontWeight: 700 }}>Sourcé</span>
            : <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#FDF3F2", color: tokens.color.danger, fontWeight: 700 }}>Non sourcé — à vérifier</span>}
          {r.contextePartiel && <span style={{ marginLeft: 8, fontSize: 11, color: "#C9A227" }}>{r.contextePartiel}</span>}
        </div>
        {(r.citations ?? []).length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: tokens.color.muted }}>
          {r.citations.map((c, i) => <div key={i}>{c.valide ? "✓" : "✗"} {c.type}:{c.ref} — {c.assertion}</div>)}</div>}
        {/* B.6 : le bouton « Proposer » N'EXISTE PAS sur une sortie non sourcée */}
        {(cap === "C3" || cap === "C4") && r.estSource && <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select value={typeProp} onChange={(e) => setTypeProp(e.target.value)} style={{ fontSize: 11 }}>
            {["QUALIF_ALERTE_FP", "AIGUILLAGE_EDD", "ALLEGEMENT_EDD", "AJUSTEMENT_PARAM"].map((t) => <option key={t}>{t}</option>)}</select>
          <input placeholder="cible (id / client|scenario / chemin)" value={cible} onChange={(e) => setCible(e.target.value)} style={{ fontSize: 11, width: 220 }}/>
          <input placeholder="justification (obligatoire)" value={justif} onChange={(e) => setJustif(e.target.value)} style={{ fontSize: 11, width: 220 }}/>
          <button onClick={() => proposer(r.messageId)} disabled={!justif.trim() || !cible.trim()} style={{ fontSize: 11 }}>Proposer</button>
        </div>}
      </div>)}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <input placeholder="votre question" value={texte} onChange={(e) => setTexte(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 13 }}/>
        <button onClick={envoyer} disabled={!texte.trim()}
          style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: tokens.color.olive700, color: "#fff", cursor: "pointer" }}>Envoyer</button>
      </div>
    </div>}

    <h4 style={{ marginTop: 18 }}>Propositions en attente — décision humaine (R254)</h4>
    {props.length === 0 ? <p style={{ fontSize: 13, color: tokens.color.muted }}>Aucune proposition en attente</p>
      : props.map((p) => <div key={p.id} style={{ padding: 10, marginBottom: 6, borderRadius: 8,
        background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, fontSize: 13 }}>
        <strong>{p.type}</strong> → {p.cibleType} {String(p.cibleId).slice(0, 24)} · <em>{p.justification}</em>
        <button onClick={() => decider(p.id, true)} style={{ marginLeft: 10, fontSize: 11 }}>Adopter</button>
        <button onClick={() => decider(p.id, false)} style={{ marginLeft: 4, fontSize: 11 }}>Rejeter (motivé)</button>
      </div>)}

    {convId && <div style={{ marginTop: 18 }}>
      <h4>Mode audit — rejeu à date (R257)</h4>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="as_of ISO (vide = tout)" value={asOf} onChange={(e) => setAsOf(e.target.value)}
          style={{ padding: 6, borderRadius: 6, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 260 }}/>
        <button onClick={rejouer} style={{ fontSize: 12 }}>Rejouer</button>
      </div>
      {audit && <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#fff", border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
        <div>Chaînage : {audit.chaineVerifiee ? <strong style={{ color: tokens.color.olive700 }}>vérifié de bout en bout</strong> : <strong style={{ color: tokens.color.danger }}>ROMPU</strong>}</div>
        {audit.messages.map((m: any) => <div key={m.seq} style={{ color: tokens.color.muted }}>
          #{m.seq} {m.direction} · {String(m.texte).slice(0, 80)}{m.contexteEmpreinte ? ` · empreinte ${String(m.contexteEmpreinte).slice(0, 10)}` : ""}</div>)}
        {(audit.propositions ?? []).map((p: any) => <div key={p.id}>proposition {p.type} → <strong>{p.statut}</strong>{p.motifRejet ? ` (${p.motifRejet})` : ""}</div>)}
      </div>}
    </div>}
  </div>;
}
