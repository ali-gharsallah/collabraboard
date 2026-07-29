import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, SevPill, OliveNote, KYC_STATUS_LABEL } from "./components";
import { RiskFactorsList, kycsByClientId } from "./components-data";
import { kycTypeOf } from "./kyc-support";
import { evalAmlRules } from "./aml";
import { WF_DEFS, wfAvailable, wfCheckGuards, wfHeadId, KYC_PHASES } from "./wf-engine";
import {
  SECTIONS_STATIC, SECTION_STATUS_STYLE, RIGHT_STYLE, SECTION_VISA, MESSAGES_SEED,
  WF_STEPS, WF_ORDER, kycMatrixRole, sectionVisibleTo, QUESTIONS_TEMPLATE, KYC_SECTION_LIST, Question,
} from "./kyc-detail-data";

// KycDetailScreen — PORT (v1) de docs/reference/olive-demo.html 16626–17656 (Annexe D).
// Couvre : bandeau d'identité, score AML explicable, bascule Consultation/Création, Documents,
// Comparer versions (modale), note MOD-70, bandeau workflow + diagramme (étapes), rail des 14
// sections (visibilité par rôle), contenu de section (questions × droits, consult/édition),
// visas de section (B.5) + modale « Apposer le visa », fil de messages entre intervenants.
// CONSIGNÉ (§ prochaine session) : moteur de transitions WF_DEFS (boutons valider/rejeter),
// visas d'étape, thèmes KYC_THEMES, change tracker, appréciations, matrice, docgen, verrou.

export function KycDetailScreen({ client, kyc, onBack, user }: { client: any; kyc?: any; onBack: () => void; user?: any }) {
  const [sec, setSec] = useState("identity");
  const [mode, setMode] = useState<"consult" | "create">("consult");
  const [secNavCollapsed, setSecNavCollapsed] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [wfDiagramOpen, setWfDiagramOpen] = useState(false);
  const [comments, setComments] = useState(MESSAGES_SEED);
  const [commentDraft, setCommentDraft] = useState("");
  const [visaModal, setVisaModal] = useState<any>(null);
  const [visaVerdict, setVisaVerdict] = useState("OK");
  const [visaMsg, setVisaMsg] = useState("");
  const [wfPanelOpen, setWfPanelOpen] = useState(false);
  const [wfLog, setWfLog] = useState<any[]>([]);
  const [wfModal, setWfModal] = useState<any>(null);   // { trans, action }
  const [wfComment, setWfComment] = useState("");
  const [wfIdx, setWfIdx] = useState(Math.max(0, WF_ORDER.indexOf(kyc?.wfPhase || "COMPLIANCE")));
  const [wfStatus, setWfStatus] = useState(kyc?.status === "APPROVED" ? "approved" : kyc?.status === "REJECTED" ? "rejected" : "in_progress");

  const KYC_CODE = kyc?.code || "KYC-2026-CH-0044-R2";
  const KYC_VERSION = kyc?.revision || 2;
  const kyc_ddl = kyc?.workflow || client?.ddl || "EDD";
  const kyc_status = kyc ? (KYC_STATUS_LABEL[kyc.status] || kyc.status) : (client?.currentKycStatus || "En revue");
  const kyc_wfPhase = kyc?.wfPhase || "COMPLIANCE";
  const kyc_rm = kyc?.rm || client?.rm || "—";
  const kyc_aum = kyc?.aum || client?.aum || "—";
  const myRole = kycMatrixRole(user);

  const sectionStatusOf = (s: any) => {
    if (kyc && kyc.status === "APPROVED") return "Approuvée";
    if (s.filled === 0) return "Vide";
    if (s.filled < s.total) return "En cours";
    return "Complète";
  };
  const visibleSections = SECTIONS_STATIC.filter(s => sectionVisibleTo(s.id, myRole));
  const section = visibleSections.find(s => s.id === sec) || visibleSections[0];
  const secLabel = (id: string) => (KYC_SECTION_LIST.find(x => x.id === id)?.label) || id;

  const ev = evalAmlRules(client, kyc);
  const amlCol = ev.score >= 60 ? T.red : ev.score >= 30 ? T.amber : T.green;
  const amlBande = ev.score >= 60 ? "HIGH" : ev.score >= 30 ? "MEDIUM" : "LOW";
  const amlHits = ev.rules.filter(r => r.hit).length;
  const revs = (kycsByClientId[client?.id] || []).slice().sort((a, b) => (a.revision || 0) - (b.revision || 0));

  const curIdx = Math.max(0, WF_ORDER.indexOf(kyc_wfPhase));
  const approved = kyc?.status === "APPROVED", rejected = kyc?.status === "REJECTED";
  const isFinal = !approved && !rejected && curIdx >= 4;
  const curLabel = approved ? "Validé" : rejected ? "Rejeté" : (WF_STEPS[curIdx] || { label: "Approbation finale" }).label;
  const curRole = approved || rejected ? "—" : (WF_STEPS[curIdx] || { role: "Head of PB + CEO" }).role;

  const card: React.CSSProperties = { background: T.surface, borderRadius: 14, padding: 24, border: `1px solid ${T.line}` };
  const questions: Question[] = QUESTIONS_TEMPLATE[sec] || [];

  const submitVisa = () => {
    if (visaVerdict !== "OK" && !visaMsg.trim()) return;
    setVisaModal(null);
  };

  return (
    <div>
      {/* Bandeau d'en-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <button onClick={onBack} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Retour</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>
          KYC / <span style={{ fontFamily: "monospace", color: T.olive700 }}>{KYC_CODE}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.inkMid, marginLeft: 8 }}>R{KYC_VERSION}</span>
          <span style={{ fontSize: 11, color: T.inkSoft, marginLeft: 8 }}>· {kyc_ddl} · {kyc_status} · AUM {kyc_aum} · RM {kyc_rm}</span>
        </div>
        <button onClick={() => setSec("aml")} title={`Score de risque AML ${ev.score}/100 (${amlBande}) — ${amlHits} règle(s) déclenchée(s) sur ${ev.rules.length}.`}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, border: `1px solid ${amlCol}55`, background: amlCol + "0D", cursor: "pointer", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Score AML</span>
          <span style={{ fontSize: 17, fontWeight: 800, fontFamily: "monospace", color: amlCol, lineHeight: 1 }}>{ev.score}</span>
          <span style={{ fontSize: 9, fontWeight: 800, color: amlCol }}>{amlBande}</span>
          {amlHits > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: T.inkSoft }}>· {amlHits} règle{amlHits > 1 ? "s" : ""}</span>}
        </button>
        <div style={{ display: "flex", gap: 3, background: T.cream, padding: 3, borderRadius: 9, border: `1px solid ${T.line}` }}>
          {([["consult", "Consultation"], ["create", "Création / remplissage"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)} style={{ padding: "6px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: mode === id ? T.olive600 : "transparent", color: mode === id ? "#fff" : T.inkMid, fontSize: 11, fontWeight: mode === id ? 700 : 500 }}>{label}</button>))}
        </div>
        <button onClick={() => { }} style={{ padding: "8px 13px", borderRadius: 8, border: `1px solid ${T.olive600}`, background: T.surface, color: T.olive700, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>▤ Documents</button>
        {revs.length > 1 && <button onClick={() => setCompareOpen(true)} style={{ padding: "8px 13px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>⇄ Comparer versions</button>}
      </div>

      {/* Note MOD-70 */}
      <OliveNote style={{ marginTop: 4, padding: "10px 14px", background: T.oliveSoft, borderRadius: 9, fontSize: 12, color: T.inkMid }}>
        <div>Les données saisies ici ne mettront à jour la <strong>fiche client (MOD-70)</strong> qu'<strong>après validation</strong> de ce KYC. Un nouveau KYC pourra être créé si le profil de risque change.</div>
      </OliveNote>

      {/* Bandeau workflow */}
      <div style={{ background: isFinal ? T.amberSoft : T.surface, borderRadius: 12, padding: "12px 16px", border: `1px solid ${isFinal ? T.gold : T.line}`, margin: "16px 0 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15 }}>{approved ? "✓" : rejected ? "✕" : "⚖"}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>
            {approved ? <span style={{ color: T.green }}>Workflow validé — propagé à la fiche client</span>
              : rejected ? <span style={{ color: T.red }}>Workflow rejeté — fiche client inchangée</span>
                : <>Étape courante : <b>{curLabel}</b> {isFinal && <span style={{ color: T.gold, fontWeight: 800 }}>— approbation finale à effectuer</span>}</>}
          </div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 1 }}>Responsable : {curRole}</div>
        </div>
        <button onClick={() => setWfDiagramOpen(true)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${isFinal ? T.gold : T.olive600}`, background: isFinal ? T.gold : T.olive600, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>Voir le workflow →</button>
      </div>

      {/* Détail du workflow — stepper + transitions gouvernées (WF_DEFS + guards) */}
      <div style={{ ...card, padding: "20px 24px", marginBottom: 18 }}>
        <div onClick={() => setWfPanelOpen(!wfPanelOpen)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: wfPanelOpen ? 18 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 1 }}>Détail du workflow</span>
          <span style={{ fontSize: 11, color: T.inkMid }}>· {KYC_PHASES[wfIdx]} ({wfIdx + 1}/{KYC_PHASES.length})</span>
          <span style={{ marginLeft: "auto", fontSize: 13, color: T.inkSoft, transform: wfPanelOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▾</span>
        </div>
        {wfPanelOpen && <>
          <div style={{ display: "flex", alignItems: "center" }}>
            {KYC_PHASES.map((ph, i, arr) => {
              const state = wfStatus === "rejected" ? (i < wfIdx ? "done" : i === wfIdx ? "rejected" : "pending") : wfStatus === "approved" ? "done" : (i < wfIdx ? "done" : i === wfIdx ? "current" : "pending");
              const col = state === "done" ? T.green : state === "current" ? T.gold : state === "rejected" ? T.red : T.inkSoft;
              return <div key={i} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 90 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: state === "pending" ? T.surface : col, border: state === "pending" ? `2px solid ${T.line}` : "none", color: state === "pending" ? T.inkSoft : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{state === "done" ? "✓" : state === "rejected" ? "✕" : i + 1}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: state === "pending" ? T.inkSoft : T.ink, textAlign: "center" }}>{ph}</span>
                </div>
                {i < arr.length - 1 && <div style={{ flex: 1, height: 3, background: state === "done" ? T.green : T.line, margin: "0 4px", marginBottom: 22, borderRadius: 2 }} />}
              </div>;
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.line}`, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, fontSize: 12, color: T.inkSoft, minWidth: 200 }}>
              <span style={{ fontFamily: "monospace", fontSize: 10.5, color: T.olive700, fontWeight: 700, marginRight: 8 }}>{wfHeadId(WF_DEFS[0])}</span>
              <Badge text={wfStatus === "approved" ? "VALIDÉ" : wfStatus === "rejected" ? "REJETÉ" : "EN COURS"} color={wfStatus === "approved" ? T.green : wfStatus === "rejected" ? T.red : T.blue} bg={wfStatus === "approved" ? T.greenSoft : wfStatus === "rejected" ? T.redSoft : T.blueSoft} />
              <span style={{ marginLeft: 8 }}>Phase actuelle : <strong style={{ color: T.ink }}>{KYC_PHASES[wfIdx]}</strong></span>
            </div>
            {wfStatus === "in_progress" && (() => {
              const engInst = { state: WF_ORDER[wfIdx], status: "RUNNING", history: wfLog.map(e => ({ action: e.icon === "✓" ? "validate" : e.icon === "←" ? "pushback" : "reject", by: e.by, byRole: user?.role || "" })), createdBy: kyc_rm };
              const engUser = { name: user?.name || "", role: user?.role || "" };
              const avail = wfAvailable(WF_DEFS[0], engInst, engUser);
              const ownerRole = ["RM", "CO", "AML", "BRM", "HPB"][Math.min(wfIdx, 4)];
              if (avail.length === 0) return <span style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" }}>Aucune action pour votre rôle ({engUser.role || "—"}) dans cette phase — responsabilité : <strong style={{ color: T.ink }}>{ownerRole}</strong>.</span>;
              return <>{avail.map(t => {
                const fails = wfCheckGuards(WF_DEFS[0], engInst, t, engUser, "motif", {});
                const blocked = fails.length > 0;
                const col = t.action === "validate" ? T.olive600 : t.action === "reject" ? T.red : T.amber;
                const solid = t.action === "validate";
                return <button key={t.id} disabled={blocked} title={blocked ? fails.join(" ") : t.label} onClick={() => { setWfModal({ trans: t }); setWfComment(""); }}
                  style={{ padding: solid ? "9px 18px" : "9px 16px", borderRadius: 9, border: solid ? "none" : `1px solid ${blocked ? T.line : col}`, background: solid ? (blocked ? T.line : col) : T.surface, color: solid ? "#fff" : (blocked ? T.inkSoft : col), fontSize: 12.5, fontWeight: 700, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.6 : 1 }}>
                  {t.action === "pushback" ? "← " : ""}{t.label}{t.action === "validate" ? " →" : ""}</button>;
              })}</>;
            })()}
          </div>
          {wfLog.length > 0 && <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Journal des transitions (piste d'audit)</div>
            {wfLog.map((e, i) => <div key={i} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: i < wfLog.length - 1 ? `1px solid ${T.lineSoft}` : "none" }}>
              <span style={{ color: e.color, fontWeight: 700, fontSize: 13, width: 14 }}>{e.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{e.act}</div>
                {e.note && <div style={{ fontSize: 11, color: T.inkMid, fontStyle: "italic" }}>« {e.note} »</div>}
                <div style={{ fontSize: 10, color: T.inkSoft }}>{e.by} · {e.phase} · {e.at}</div>
              </div>
            </div>)}
          </div>}
        </>}
      </div>

      {/* Corps : rail sections + contenu + messages */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        {/* Rail des sections */}
        <div style={{ ...card, padding: 12, width: secNavCollapsed ? 70 : 250, flexShrink: 0, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setSecNavCollapsed(!secNavCollapsed)} title={secNavCollapsed ? "Étendre les sections" : "Réduire les sections (logos seuls)"} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, cursor: "pointer", fontSize: 12, flexShrink: 0 }}>{secNavCollapsed ? "▸" : "▾"}</button>
            {!secNavCollapsed && <span style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>Sections</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {visibleSections.map(s => {
              const done = s.filled === s.total;
              const stColor = SECTION_STATUS_STYLE[sectionStatusOf(s)][0];
              return <button key={s.id} onClick={() => setSec(s.id)} title={`${s.label} — ${s.filled}/${s.total} — ${sectionStatusOf(s)}`}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: secNavCollapsed ? "8px 0" : "7px 10px", borderRadius: 8, border: `1px solid ${sec === s.id ? T.olive600 : "transparent"}`, background: sec === s.id ? T.oliveSoft : "transparent", cursor: "pointer", position: "relative", justifyContent: secNavCollapsed ? "center" : undefined, width: "100%", textAlign: "left" }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={{ position: "absolute", top: 5, right: secNavCollapsed ? 8 : 6, width: 5, height: 5, borderRadius: "50%", background: stColor }} />
                {!secNavCollapsed && <span style={{ flex: 1, fontSize: 11.5, fontWeight: sec === s.id ? 700 : 500, color: sec === s.id ? T.olive700 : T.inkMid, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>}
                {!secNavCollapsed && <span style={{ fontSize: 8.5, fontWeight: 700, color: done ? T.green : T.amber }}>{s.filled}/{s.total}</span>}
              </button>;
            })}
          </div>
        </div>

        {/* Contenu de la section */}
        <div style={{ ...card, flex: "1 1 440px", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: `1px solid ${T.line}` }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: T.oliveSoft, color: T.olive600, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{section.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{secLabel(section.id)}</div>
                {(() => { const st = sectionStatusOf(section); const [sc, sbg] = SECTION_STATUS_STYLE[st]; return <span style={{ fontSize: 9.5, fontWeight: 800, color: sc, background: sbg, padding: "2px 9px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 0.4 }}>{st}</span>; })()}
                <span title={`${section.filled} sur ${section.total} questions renseignées`} style={{ fontSize: 9.5, fontWeight: 800, color: T.olive700, background: T.oliveSoft, padding: "2px 8px", borderRadius: 20, cursor: "help" }}>{section.filled}/{section.total}</span>
              </div>
            </div>
          </div>

          {/* Visa requis */}
          {(() => {
            const visas = SECTION_VISA[sec] || [];
            if (!visas.length) return null;
            return <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 18, padding: "10px 14px", borderRadius: 10, background: T.cream, border: `1px solid ${T.lineSoft}` }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>Visa requis</span>
              {visas.map((v, vi) => {
                const signed = v.status === "signed";
                const vc = signed ? T.green : T.amber, vbg = signed ? T.greenSoft : T.amberSoft, vicon = signed ? "✓" : "○";
                const canSign = mode === "create" && !signed;
                return <span key={vi} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "4px 10px", borderRadius: 20, background: vbg, color: vc, fontWeight: 700 }}>
                  {vicon} {v.role}{signed ? ` — ${v.who || ""}${v.at ? ` · ${v.at}` : ""}` : " — en attente"}
                  {canSign && <button onClick={() => { setVisaModal({ vi, role: v.role }); setVisaVerdict("OK"); setVisaMsg(""); }} style={{ border: "none", background: T.amber, color: "#fff", borderRadius: 12, padding: "2px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: 2 }}>Signer</button>}
                </span>;
              })}
            </div>;
          })()}

          {/* Score AML explicable (section AML) */}
          {sec === "aml" && <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 10, border: `1px solid ${amlCol}55`, background: amlCol + "0D" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: amlCol }}>{ev.score}<span style={{ fontSize: 11, color: T.inkSoft }}>/100</span></span>
              <SevPill sev={amlBande} />
              <span style={{ fontSize: 11, color: T.inkMid }}>Score de risque AML — méthodologie explicable</span>
            </div>
            <RiskFactorsList client={client} kyc={kyc} max={6} compact />
          </div>}

          {/* Questions de la section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {questions.map(qq => {
              if (qq.right === "HIDDEN") return <div key={qq.id} style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" }}>Question masquée pour votre rôle</div>;
              const [rc, rbg, rlabel] = RIGHT_STYLE[qq.right];
              const editable = mode === "create" && (qq.right === "EDIT" || qq.right === "REQUIRED");
              const empty = !qq.a || qq.a === "—";
              return <div key={qq.id} style={{ paddingBottom: 12, borderBottom: `1px solid ${T.lineSoft}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{qq.q}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: rc, background: rbg, padding: "1px 7px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{rlabel}</span>
                  {qq.changed && <span title="Modifié" style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold }} />}
                </div>
                {editable
                  ? <input defaultValue={empty ? "" : qq.a} placeholder="Saisir…" style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.line}`, fontSize: 12.5, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink }} onFocus={e => (e.target.style.borderColor = T.olive600)} onBlur={e => (e.target.style.borderColor = T.line)} />
                  : <div style={{ fontSize: 12.5, color: empty ? T.inkSoft : T.ink, fontStyle: empty ? "italic" : "normal" }}>{empty ? "—" : qq.a}</div>}
                {qq.by && <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 3 }}>Dernière modification · {qq.by}{qq.at ? ` · ${qq.at}` : ""}</div>}
              </div>;
            })}
          </div>
        </div>

        {/* Fil de messages */}
        <div style={{ ...card, flex: "1 1 300px", minWidth: 0, boxSizing: "border-box" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 12 }}>💬 Messages entre intervenants</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {comments.map((c, i) => <div key={i} style={{ padding: "9px 12px", borderRadius: 10, background: T.cream, border: `1px solid ${T.lineSoft}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink }}>{c.who}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: T.olive700 }}>{c.role}</span>
                <span style={{ fontSize: 9.5, color: T.inkSoft, marginLeft: "auto" }}>{c.at}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.5 }}>{c.text}</div>
            </div>)}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && commentDraft.trim()) { setComments(cs => [...cs, { who: user?.name || "Moi", role: user?.roleLabel || "—", at: "à l'instant", text: commentDraft.trim() }]); setCommentDraft(""); } }}
              placeholder="Écrire un commentaire…" style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${T.line}`, fontSize: 12, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink }} />
            <button onClick={() => { if (commentDraft.trim()) { setComments(cs => [...cs, { who: user?.name || "Moi", role: user?.roleLabel || "—", at: "à l'instant", text: commentDraft.trim() }]); setCommentDraft(""); } }} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Envoyer</button>
          </div>
        </div>
      </div>

      {/* Modale comparer versions */}
      {compareOpen && <div onClick={() => setCompareOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,15,8,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 520, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, width: 700, maxWidth: "96vw", maxHeight: "80vh", overflowY: "auto", padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Comparaison des versions KYC — {client?.name}</div>
            <button onClick={() => setCompareOpen(false)} style={{ border: "none", background: "transparent", fontSize: 17, color: T.inkSoft, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>{revs.length} révisions — vue synthétique, sans le détail des champs.</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead><tr style={{ background: T.lineSoft }}>{["Version", "Type", "Statut", "Workflow", "Score", "Créé le"].map(h => <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9.5, color: T.inkSoft, textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{revs.map(r => <tr key={r.id || r.code} style={{ borderTop: `1px solid ${T.lineSoft}`, background: r.code === KYC_CODE ? T.oliveSoft : "transparent" }}>
              <td style={{ padding: "8px 10px", fontWeight: 700, color: T.olive700 }}>R{r.revision}{r.code === KYC_CODE ? " (actuel)" : ""}</td>
              <td style={{ padding: "8px 10px" }}><Badge text={kycTypeOf(r) === "ONBOARDING" ? "Onboarding" : "Review"} color={kycTypeOf(r) === "ONBOARDING" ? T.violet : T.blue} bg={kycTypeOf(r) === "ONBOARDING" ? T.violet + "18" : T.blueSoft} /></td>
              <td style={{ padding: "8px 10px", color: T.inkMid }}>{r.status}</td>
              <td style={{ padding: "8px 10px", color: T.inkMid }}>{r.workflow || "—"}</td>
              <td style={{ padding: "8px 10px", fontWeight: 700, color: T.ink }}>{r.riskScore != null ? r.riskScore : "—"}</td>
              <td style={{ padding: "8px 10px", color: T.inkSoft }}>{r.createdAt || "—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>}

      {/* Modale diagramme workflow */}
      {wfDiagramOpen && <div onClick={() => setWfDiagramOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,15,8,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 520, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.cream, borderRadius: 16, width: 820, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", padding: 20, boxShadow: "0 24px 70px rgba(10,15,8,0.35)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Workflow du dossier KYC</div>
            <button onClick={() => setWfDiagramOpen(false)} style={{ border: "none", background: "transparent", fontSize: 17, color: T.inkSoft, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>Quatre yeux à la décision finale : valider propage au golden record, rejeter le laisse inchangé.</div>
          <div style={{ overflowX: "auto", paddingBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "stretch", minWidth: 660 }}>
              {WF_STEPS.map((s, i) => {
                const st = (approved || rejected) ? "done" : i < curIdx ? "done" : i === curIdx ? "current" : "pending";
                const STY: any = { done: { bg: T.greenSoft, bd: T.green, ic: T.green }, current: { bg: T.cream, bd: T.gold, ic: T.gold }, pending: { bg: T.surface, bd: T.line, ic: T.inkSoft } };
                const c = STY[st];
                return <div key={s.ph} style={{ display: "flex", alignItems: "stretch" }}>
                  <div style={{ width: 118, background: c.bg, border: `${st === "current" ? 2 : 1}px solid ${c.bd}`, borderRadius: 10, padding: "9px 9px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 7, background: st === "pending" ? T.surface : c.ic, border: st === "pending" ? `1.5px solid ${T.line}` : "none", color: st === "pending" ? T.inkSoft : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{st === "done" ? "✓" : s.icon}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: st === "pending" ? T.inkSoft : T.ink, lineHeight: 1.2 }}>{s.label}</div>
                    <div style={{ fontSize: 9.5, color: T.inkSoft }}>{s.role}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", alignSelf: "center", margin: "0 2px" }}>
                    <div style={{ width: 16, height: 2, background: (i < curIdx || approved || rejected) ? T.green : T.line, borderRadius: 2 }} />
                    <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: `6px solid ${(i < curIdx || approved || rejected) ? T.green : T.line}` }} />
                  </div>
                </div>;
              })}
              <div style={{ width: 100, minHeight: 74, background: approved ? T.greenSoft : rejected ? T.redSoft : curIdx >= 4 ? T.cream : T.surface, border: `${curIdx >= 4 && !approved && !rejected ? 2 : 1}px ${approved || rejected || curIdx >= 4 ? "solid" : "dashed"} ${approved ? T.green : rejected ? T.red : curIdx >= 4 ? T.gold : T.line}`, borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, textAlign: "center" }}>
                <div style={{ fontSize: 15 }}>⚖</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink }}>Décision finale</div>
                <div style={{ fontSize: 9, color: T.inkSoft }}>HPB + CEO</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>{([["✓ Terminé", T.green], ["En cours", T.gold], ["À venir", T.inkSoft]] as const).map(([l, c]) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.inkMid }}><span style={{ width: 9, height: 9, borderRadius: 3, background: c, display: "inline-block" }} />{l}</div>)}</div>
        </div>
      </div>}

      {/* Modale apposer le visa */}
      {visaModal && <div onClick={() => setVisaModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 520, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: 440, maxWidth: "92vw", padding: 22, boxShadow: "0 24px 60px rgba(34,38,28,.28)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 12 }}>Apposer le visa — {secLabel(sec)}</div>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Verdict</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {([["OK", "✓ Favorable", T.green], ["CONDITIONAL", "~ Sous condition", T.amber], ["NOK", "✕ Défavorable", T.red]] as const).map(([v, l, c]) => (
              <button key={v} onClick={() => setVisaVerdict(v)} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: `1px solid ${visaVerdict === v ? c : T.line}`, background: visaVerdict === v ? c + "1E" : T.surface, color: visaVerdict === v ? c : T.inkMid, fontSize: 11.5, fontWeight: visaVerdict === v ? 800 : 500, cursor: "pointer" }}>{l}</button>))}
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Message {visaVerdict !== "OK" ? "(obligatoire)" : "(facultatif)"}</div>
          <textarea value={visaMsg} onChange={e => setVisaMsg(e.target.value)} placeholder={visaVerdict === "OK" ? "Commentaire éventuel…" : "Justifiez le verdict…"} style={{ width: "100%", minHeight: 70, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${visaVerdict !== "OK" && !visaMsg.trim() ? T.red + "80" : T.line}`, fontSize: 12, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <button onClick={() => setVisaModal(null)} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
            <button onClick={submitVisa} disabled={visaVerdict !== "OK" && !visaMsg.trim()} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: (visaVerdict !== "OK" && !visaMsg.trim()) ? T.line : T.olive600, color: (visaVerdict !== "OK" && !visaMsg.trim()) ? T.inkSoft : "#fff", fontSize: 12.5, fontWeight: 800, cursor: (visaVerdict !== "OK" && !visaMsg.trim()) ? "not-allowed" : "pointer" }}>Apposer le visa</button>
          </div>
        </div>
      </div>}

      {/* Modale de confirmation de transition workflow */}
      {wfModal && (() => {
        const t = wfModal.trans;
        const needComment = t.action !== "validate";
        const isFinalApp = t.to === "APPROVED";
        const apply = () => {
          if (needComment && !wfComment.trim()) return;
          const icon = t.action === "validate" ? "✓" : t.action === "pushback" ? "←" : "✕";
          const color = t.action === "validate" ? T.green : t.action === "pushback" ? T.amber : T.red;
          setWfLog(l => [{ icon, color, act: t.label, note: wfComment.trim(), by: user?.name || "Moi", phase: KYC_PHASES[wfIdx], at: "à l'instant" }, ...l]);
          if (t.to === "APPROVED") setWfStatus("approved");
          else if (t.to === "REJECTED") setWfStatus("rejected");
          else setWfIdx(WF_ORDER.indexOf(t.to));
          setWfModal(null); setWfComment("");
        };
        return <div onClick={() => setWfModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,20,10,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 14, width: 440, maxWidth: "92vw", padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: T.inkMid, lineHeight: 1.6, marginBottom: 12 }}>
              {isFinalApp
                ? "Approbation finale — principe des quatre yeux : votre visa engage la banque. Le golden record ne sera mis à jour qu'après cette validation."
                : t.action === "reject" ? "Rejet du dossier KYC — la fiche client reste inchangée. Un motif documenté est obligatoire."
                  : t.action === "pushback" ? "Renvoi à l'étape précédente — un motif documenté est obligatoire (piste d'audit)."
                    : "Confirmer la transition vers l'étape suivante du workflow gouverné."}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Motif / commentaire {needComment ? "(obligatoire)" : "(facultatif)"}</div>
            <textarea value={wfComment} onChange={e => setWfComment(e.target.value)} placeholder="Documenter la décision…" style={{ width: "100%", minHeight: 64, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${needComment && !wfComment.trim() ? T.red + "80" : T.line}`, fontSize: 12, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => setWfModal(null)} style={{ padding: "9px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 12.5, cursor: "pointer" }}>Annuler</button>
              <button onClick={apply} disabled={needComment && !wfComment.trim()} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: (needComment && !wfComment.trim()) ? T.line : (t.action === "reject" ? T.red : T.olive600), color: (needComment && !wfComment.trim()) ? T.inkSoft : "#fff", fontSize: 12.5, fontWeight: 800, cursor: (needComment && !wfComment.trim()) ? "not-allowed" : "pointer" }}>Confirmer</button>
            </div>
          </div>
        </div>;
      })()}
    </div>);
}
