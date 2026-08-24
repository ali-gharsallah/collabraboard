import React, { useState } from "react";
import { T } from "./tokens";
import { QTYPE_META, QB_RIGHTS, QB_ROLES, QB_TEMPLATE_KYC, QB_TEMPLATE_AR } from "./formbuilder-support";
import type { QbSection, QbQuestion } from "./formbuilder-support";

// Source : docs/reference/olive-demo.html 42657-42891 — Questionnaire Builder (drag & drop) — KYC + Account Review.
// Chaque banque configure son questionnaire (glisser-déposer, par tenant) : palette d'éléments,
// sections réordonnables, questions typées avec droit par défaut / rôle responsable / options,
// aperçu du rendu et export JSON du schéma. Porté verbatim (invent NOTHING).

export default function QuestionnaireBuilderScreen() {
  const [schemas, setSchemas] = useState<Record<string, QbSection[]>>({ KYC: QB_TEMPLATE_KYC, AR: QB_TEMPLATE_AR });
  const [target, setTarget] = useState("KYC");
  const [sel, setSel] = useState<{ sec: string; q: string } | null>(null); // {sec,q}
  const [preview, setPreview] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const cnt = useState(() => ({ n: 100 }))[0];
  const nid = (p: string) => p + "-" + (++cnt.n);
  const schema = schemas[target];
  const setSchema = (next: QbSection[] | ((s: QbSection[]) => QbSection[])) => setSchemas({ ...schemas, [target]: typeof next === "function" ? (next as any)(schema) : next });
  const qCount = schema.reduce((a: number, s: QbSection) => a + s.questions.length, 0);
  const addSection = () => setSchema([...schema, { id: nid("s"), label: "Nouvelle section", questions: [] }]);
  const delSection = (sid: string) => setSchema(schema.filter((s: QbSection) => s.id !== sid));
  const renameSection = (sid: string, label: string) => setSchema(schema.map((s: QbSection) => s.id === sid ? { ...s, label } : s));
  const moveSection = (i: number, d: number) => { const a = [...schema]; const j = i + d; if (j < 0 || j >= a.length)
    return; [a[i], a[j]] = [a[j], a[i]]; setSchema(a); };
  const newQuestion = (type: string): QbQuestion => ({ id: nid("q"), label: QTYPE_META[type].label, type, right: "EDIT", role: "RM / ARM", required: false, options: (type === "SINGLE" || type === "MULTI") ? ["Option 1", "Option 2"] : [] });
  const addQuestion = (sid: string, type: string, beforeQid?: string | null) => setSchema(schema.map((s: QbSection) => {
    if (s.id !== sid)
      return s;
    const q = newQuestion(type);
    if (!beforeQid)
      return { ...s, questions: [...s.questions, q] };
    const idx = s.questions.findIndex((x: QbQuestion) => x.id === beforeQid);
    const arr = [...s.questions];
    arr.splice(idx, 0, q);
    return { ...s, questions: arr };
  }));
  const moveQuestion = (srcSec: string, qid: string, dstSec: string, beforeQid?: string | null) => setSchema((prev: QbSection[]) => {
    let moved: QbQuestion | null = null;
    const cleaned = prev.map((s: QbSection) => s.id === srcSec ? { ...s, questions: s.questions.filter((q: QbQuestion) => { if (q.id === qid) {
      moved = q;
      return false;
    } return true; }) } : s);
    if (!moved)
      return prev;
    return cleaned.map((s: QbSection) => {
      if (s.id !== dstSec)
        return s;
      if (!beforeQid)
        return { ...s, questions: [...s.questions, moved as QbQuestion] };
      const idx = s.questions.findIndex((x: QbQuestion) => x.id === beforeQid);
      const arr = [...s.questions];
      arr.splice(idx, 0, moved as QbQuestion);
      return { ...s, questions: arr };
    });
  });
  const delQuestion = (sid: string, qid: string) => { setSchema(schema.map((s: QbSection) => s.id === sid ? { ...s, questions: s.questions.filter((q: QbQuestion) => q.id !== qid) } : s)); if (sel && sel.q === qid)
    setSel(null); };
  const patchQuestion = (sid: string, qid: string, patch: Partial<QbQuestion>) => setSchema(schema.map((s: QbSection) => s.id === sid ? { ...s, questions: s.questions.map((q: QbQuestion) => q.id === qid ? { ...q, ...patch } : q) } : s));
  // DnD
  const onDropSection = (e: any, sid: string, beforeQid?: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    const d = e.dataTransfer.getData("text/plain");
    if (!d)
      return;
    if (d.startsWith("new:")) {
      const t = d.slice(4);
      if (t !== "SECTION")
        addQuestion(sid, t, beforeQid);
    }
    else if (d.startsWith("move:")) {
      const [, src, qid] = d.split(":");
      moveQuestion(src, qid, sid, beforeQid);
    }
  };
  const onDropCanvas = (e: any) => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d === "new:SECTION")
    addSection(); };
  const allow = (e: any) => { e.preventDefault(); };
  const T2 = T;
  const palStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 9, border: `1px solid ${T2.line}`, background: "#fff", fontSize: 12.5, color: T2.ink, cursor: "grab", marginBottom: 7 };
  const inp: React.CSSProperties = { width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${T2.line}`, fontSize: 12.5, boxSizing: "border-box", background: "#fff" };
  const lab: React.CSSProperties = { fontSize: 10.5, color: T2.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4, display: "block" };
  const rightColor = (r: string) => (({ EDIT: T2.olive700, VIEW: T2.inkSoft, REQUIRED: T2.amber, HIDDEN: T2.inkSoft } as Record<string, string>)[r] || T2.inkSoft);
  const PreviewField = ({ q }: { q: QbQuestion }) => {
    if (q.right === "HIDDEN")
      return null;
    const ro = q.right === "VIEW";
    return (React.createElement("div", { style: { marginBottom: 14 } },
      React.createElement("label", { style: { fontSize: 12.5, fontWeight: 600, color: T2.ink } },
        q.label,
        q.required && React.createElement("span", { style: { color: T2.red, marginLeft: 4 } }, "*"),
        ro && React.createElement("span", { style: { fontSize: 10, color: T2.inkSoft, marginLeft: 6 } }, "(lecture seule)")),
      React.createElement("div", { style: { marginTop: 6 } },
        q.type === "TEXT" && React.createElement("input", { disabled: ro, placeholder: "Réponse…", style: inp }),
        q.type === "NUMBER" && React.createElement("input", { type: "number", disabled: ro, placeholder: "0", style: { ...inp, maxWidth: 180 } }),
        q.type === "DATE" && React.createElement("input", { type: "date", disabled: ro, style: { ...inp, maxWidth: 200 } }),
        q.type === "FILE" && React.createElement("label", { style: { ...inp, maxWidth: 260, cursor: ro ? "not-allowed" : "pointer", textAlign: "left", color: T2.inkSoft, display: "inline-block" } },
          "📎 ",
          q._fileName || "Téléverser un document…",
          React.createElement("input", { type: "file", disabled: ro, style: { display: "none" }, onChange: (e: any) => { const f = e.target.files && e.target.files[0]; if (f) {
            q._fileName = f.name + " (" + Math.max(1, Math.round(f.size / 1024)) + " Ko)";
            e.target.parentNode.childNodes[0].textContent = "📎 " + q._fileName;
          } } })),
        q.type === "BOOL" && React.createElement("div", { style: { display: "flex", gap: 14 } }, ["Oui", "Non"].map(o => React.createElement("label", { key: o, style: { fontSize: 12.5, display: "flex", gap: 5, alignItems: "center" } },
          React.createElement("input", { type: "radio", name: q.id, disabled: ro }),
          o))),
        q.type === "SINGLE" && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, (q.options || []).map((o, i) => React.createElement("label", { key: i, style: { fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" } },
          React.createElement("input", { type: "radio", name: q.id, disabled: ro }),
          o))),
        q.type === "MULTI" && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, (q.options || []).map((o, i) => React.createElement("label", { key: i, style: { fontSize: 12.5, display: "flex", gap: 6, alignItems: "center" } },
          React.createElement("input", { type: "checkbox", disabled: ro }),
          o))))));
  };
  return (React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", alignItems: "center", marginBottom: 16, gap: 10, flexWrap: "wrap" } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: T2.ink } }, "Questionnaire Builder ⊞"),
        React.createElement("div", { style: { fontSize: 12.5, color: T2.inkSoft, marginTop: 2 } }, "Chaque banque configure son questionnaire — glisser-déposer, par tenant.")),
      React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        React.createElement("div", { style: { display: "flex", border: `1px solid ${T2.line}`, borderRadius: 9, overflow: "hidden" } }, ["KYC", "AR"].map(t => (React.createElement("button", { key: t, onClick: () => { setTarget(t); setSel(null); }, style: { padding: "8px 14px", fontSize: 12.5, fontWeight: 700, border: "none", cursor: "pointer", background: target === t ? T2.olive600 : "#fff", color: target === t ? "#fff" : T2.inkSoft } }, t === "KYC" ? "KYC" : "Account Review")))),
        React.createElement("button", { onClick: () => setSchemas({ ...schemas, [target]: target === "KYC" ? JSON.parse(JSON.stringify(QB_TEMPLATE_KYC)) : JSON.parse(JSON.stringify(QB_TEMPLATE_AR)) }), style: { padding: "8px 12px", fontSize: 12, borderRadius: 9, border: `1px solid ${T2.line}`, background: "#fff", color: T2.inkMid, cursor: "pointer" } }, "↺ Modèle standard"),
        React.createElement("button", { onClick: () => { setPreview(!preview); setShowJson(false); }, style: { padding: "8px 12px", fontSize: 12, fontWeight: 700, borderRadius: 9, border: `1px solid ${T2.olive600}`, background: preview ? T2.olive700 : "#fff", color: preview ? "#fff" : T2.olive700, cursor: "pointer" } }, preview ? "✎ Éditer" : "▷ Aperçu"),
        React.createElement("button", { onClick: () => setShowJson(!showJson), style: { padding: "8px 12px", fontSize: 12, borderRadius: 9, border: `1px solid ${T2.line}`, background: "#fff", color: T2.inkMid, cursor: "pointer" } }, "⤓ JSON"))),
    React.createElement("div", { style: { display: "flex", gap: 10, fontSize: 11.5, color: T2.inkSoft, marginBottom: 14 } },
      React.createElement("span", null,
        React.createElement("b", { style: { color: T2.olive700 } }, schema.length),
        " sections"),
      React.createElement("span", null, "·"),
      React.createElement("span", null,
        React.createElement("b", { style: { color: T2.olive700 } }, qCount),
        " questions"),
      React.createElement("span", null, "·"),
      React.createElement("span", null,
        "Cible : ",
        React.createElement("b", { style: { color: T2.ink } }, target === "KYC" ? "Dossier KYC" : "Account Review"))),
    showJson && (React.createElement("div", { style: { background: T2.ink, color: "#CFE3B8", borderRadius: 12, padding: 14, marginBottom: 14, maxHeight: 240, overflow: "auto" } },
      React.createElement("pre", { style: { margin: 0, fontSize: 10.5, fontFamily: "monospace", whiteSpace: "pre-wrap" } }, JSON.stringify({ target, sections: schema }, null, 2)))),
    preview ? (React.createElement("div", { style: { background: T2.surface, border: `1px solid ${T2.line}`, borderRadius: 14, padding: 24, maxWidth: 680 } }, schema.map((s: QbSection) => (React.createElement("div", { key: s.id, style: { marginBottom: 22 } },
      React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: T2.olive900, borderBottom: `2px solid ${T2.sage}`, paddingBottom: 6, marginBottom: 14 } }, s.label),
      s.questions.map((q: QbQuestion) => React.createElement(PreviewField, { key: q.id, q: q })),
      s.questions.length === 0 && React.createElement("div", { style: { fontSize: 12, color: T2.inkSoft } }, "— section vide —")))))) : (React.createElement("div", { style: { display: "grid", gridTemplateColumns: "190px 1fr 250px", gap: 14, alignItems: "start" } },
      React.createElement("div", { style: { position: "sticky", top: 10 } },
        React.createElement("div", { style: { fontSize: 10.5, color: T2.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 } }, "Éléments — glisser ▸"),
        Object.keys(QTYPE_META).map(t => (React.createElement("div", { key: t, draggable: true, onDragStart: (e: any) => e.dataTransfer.setData("text/plain", "new:" + t), style: palStyle },
          React.createElement("span", { style: { fontSize: 14, width: 18, textAlign: "center" } }, QTYPE_META[t].icon),
          QTYPE_META[t].label))),
        React.createElement("button", { onClick: addSection, style: { width: "100%", marginTop: 6, padding: "8px", borderRadius: 9, border: `1px dashed ${T2.olive600}`, background: T2.oliveSoft, color: T2.olive700, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "+ Section")),
      React.createElement("div", { onDragOver: allow, onDrop: onDropCanvas, style: { minHeight: 200, display: "flex", flexDirection: "column", gap: 12 } },
        schema.map((s: QbSection, si: number) => (React.createElement("div", { key: s.id, style: { background: T2.surface, border: `1px solid ${T2.line}`, borderRadius: 12, overflow: "hidden" } },
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: T2.oliveSoft, borderBottom: `1px solid ${T2.sage}` } },
            React.createElement("input", { value: s.label, onChange: (e: any) => renameSection(s.id, e.target.value), style: { flex: 1, fontSize: 13, fontWeight: 700, color: T2.olive900, border: "none", background: "transparent", outline: "none" } }),
            React.createElement("button", { onClick: () => moveSection(si, -1), style: { border: "none", background: "transparent", cursor: "pointer", color: T2.inkSoft, fontSize: 13 } }, "▲"),
            React.createElement("button", { onClick: () => moveSection(si, 1), style: { border: "none", background: "transparent", cursor: "pointer", color: T2.inkSoft, fontSize: 13 } }, "▼"),
            React.createElement("button", { onClick: () => delSection(s.id), style: { border: "none", background: "transparent", cursor: "pointer", color: T2.red, fontSize: 13 } }, "✕")),
          React.createElement("div", { onDragOver: allow, onDrop: (e: any) => onDropSection(e, s.id, null), style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 } },
            s.questions.map((q: QbQuestion) => {
              const isSel = sel && sel.sec === s.id && sel.q === q.id;
              return (React.createElement("div", { key: q.id, draggable: true, onDragStart: (e: any) => { e.dataTransfer.setData("text/plain", "move:" + s.id + ":" + q.id); }, onDragOver: allow, onDrop: (e: any) => onDropSection(e, s.id, q.id), onClick: () => setSel({ sec: s.id, q: q.id }), style: { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: `1px solid ${isSel ? T2.olive600 : T2.line}`, background: isSel ? T2.oliveSoft : "#fff", cursor: "grab" } },
                React.createElement("span", { style: { color: T2.inkSoft, fontSize: 13 } }, "⠿"),
                React.createElement("span", { style: { fontSize: 13, width: 18, textAlign: "center" } }, QTYPE_META[q.type].icon),
                React.createElement("span", { style: { flex: 1, fontSize: 12.5, color: T2.ink } }, q.label),
                q.required && React.createElement("span", { style: { fontSize: 9.5, color: T2.red } }, "obligatoire"),
                React.createElement("span", { style: { fontSize: 9.5, fontWeight: 700, color: rightColor(q.right) } }, q.right)));
            }),
            React.createElement("div", { onDragOver: allow, onDrop: (e: any) => onDropSection(e, s.id, null), style: { padding: "8px", textAlign: "center", fontSize: 11, color: T2.inkSoft, border: `1px dashed ${T2.line}`, borderRadius: 8 } }, "déposer une question ici"))))),
        schema.length === 0 && React.createElement("div", { onDragOver: allow, onDrop: onDropCanvas, style: { padding: 40, textAlign: "center", color: T2.inkSoft, border: `2px dashed ${T2.line}`, borderRadius: 12 } }, "Glissez « Section » ici, ou cliquez sur « + Section ».")),
      React.createElement("div", { style: { position: "sticky", top: 10 } }, (() => {
        if (!sel)
          return React.createElement("div", { style: { background: T2.surface, border: `1px solid ${T2.line}`, borderRadius: 12, padding: 16, fontSize: 12, color: T2.inkSoft } }, "Cliquez une question pour la configurer (intitulé, type, droit, rôle, options).");
        const s = schema.find((x: QbSection) => x.id === sel.sec);
        const q = s && s.questions.find((x: QbQuestion) => x.id === sel.q);
        if (!q)
          return null;
        return (React.createElement("div", { style: { background: T2.surface, border: `1px solid ${T2.olive600}`, borderRadius: 12, padding: 16 } },
          React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: T2.olive900, marginBottom: 12 } }, "Configurer la question"),
          React.createElement("label", { style: lab }, "Intitulé"),
          React.createElement("input", { value: q.label, onChange: (e: any) => patchQuestion(s!.id, q.id, { label: e.target.value }), style: { ...inp, marginBottom: 12 } }),
          React.createElement("label", { style: lab }, "Type"),
          React.createElement("select", { value: q.type, onChange: (e: any) => patchQuestion(s!.id, q.id, { type: e.target.value, options: (e.target.value === "SINGLE" || e.target.value === "MULTI") && (!q.options || !q.options.length) ? ["Option 1", "Option 2"] : q.options }), style: { ...inp, marginBottom: 12 } }, Object.keys(QTYPE_META).filter(t => t !== "SECTION").map(t => React.createElement("option", { key: t, value: t }, QTYPE_META[t].label))),
          React.createElement("label", { style: lab }, "Droit par défaut"),
          React.createElement("select", { value: q.right, onChange: (e: any) => patchQuestion(s!.id, q.id, { right: e.target.value }), style: { ...inp, marginBottom: 12 } }, QB_RIGHTS.map(r => React.createElement("option", { key: r, value: r }, r))),
          React.createElement("label", { style: lab }, "Rôle responsable"),
          React.createElement("select", { value: q.role, onChange: (e: any) => patchQuestion(s!.id, q.id, { role: e.target.value }), style: { ...inp, marginBottom: 12 } }, QB_ROLES.map(r => React.createElement("option", { key: r, value: r }, r))),
          React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T2.ink, marginBottom: 12, cursor: "pointer" } },
            React.createElement("input", { type: "checkbox", checked: q.required, onChange: (e: any) => patchQuestion(s!.id, q.id, { required: e.target.checked }) }),
            " Réponse obligatoire"),
          (q.type === "SINGLE" || q.type === "MULTI") && (React.createElement("div", { style: { marginBottom: 12 } },
            React.createElement("label", { style: lab }, "Options (une par ligne)"),
            React.createElement("textarea", { value: (q.options || []).join("\n"), onChange: (e: any) => patchQuestion(s!.id, q.id, { options: e.target.value.split("\n").filter((x: string) => x.trim()) }), rows: 4, style: { ...inp, resize: "vertical", fontFamily: "inherit" } }))),
          React.createElement("button", { onClick: () => delQuestion(s!.id, q.id), style: { width: "100%", padding: "8px", borderRadius: 8, border: `1px solid ${T2.red}33`, background: T2.redSoft, color: T2.red, fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "Supprimer la question")));
      })()))),
    React.createElement("div", { style: { fontSize: 11, color: T2.inkSoft, marginTop: 14, lineHeight: 1.5 } },
      "Glissez un élément depuis la palette vers une section ; réordonnez en glissant les questions ; cliquez pour configurer (type, droit par rôle, options). Le même builder sert au ",
      React.createElement("b", null, "KYC"),
      " et à l'",
      React.createElement("b", null, "Account Review"),
      ". En production : schéma versionné par tenant, consommé par le moteur de rendu KYC/AR.")));
}
