import React, { useState } from "react";
import { T } from "./tokens";
import { wfCarte, wfBouton } from "./wf-styles";
import { WF_ENGINE, WF_INVARIANTS, WF_TYPES_RT, wfOliviaPropose } from "./olive-wf-engine";
import RULES_CATALOG from "../fixtures/RULES_CATALOG.json";

// Source : docs/reference/olive-demo.html 24150–24244 — porté verbatim.
// Interne à l'écran (E-NAV-6 arbitré : purge sélective — l'export mort est retiré).
function WfRulesCatalogPanel({ go }: { go?: (s: string) => void }) {
  const [q, setQ] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const [compact, setCompact] = useState(false);
  const RC = RULES_CATALOG as any[];
  const norm = (s: any) => String(s).toLowerCase();
  const estImplementee = (r: any) => /verts|certifi|e2e|prouv/i.test(r.statut) || /prouv/i.test(r.comment);
  const match = (r: any) => {
    if (filtre === "tenant" && r.param !== "tenant") return false;
    if (filtre === "fixe" && r.param !== "fixe") return false;
    if (filtre === "implementes" && !estImplementee(r)) return false;
    if (!q) return true;
    const n = norm(q);
    return norm(r.id).indexOf(n) >= 0 || norm(r.titre).indexOf(n) >= 0 || norm(r.expl).indexOf(n) >= 0 || norm(r.comment).indexOf(n) >= 0;
  };
  const visibles = RC.filter(match).slice().sort((a, b) => a.num - b.num);
  const blocs: string[] = [];
  visibles.forEach((r) => { if (blocs.indexOf(r.bloc) < 0) blocs.push(r.bloc); });
  blocs.sort((a, b) => parseInt(a) - parseInt(b));
  const nT = RC.filter((r) => r.param === "tenant").length;
  const nImpl = RC.filter(estImplementee).length;
  const chip = (id: string, label: string) => <button key={id} onClick={() => setFiltre(id)} style={{ padding: "6px 13px", borderRadius: 16, border: "1px solid " + (filtre === id ? T.olive600 : T.line), background: filtre === id ? T.olive600 : T.surface, color: filtre === id ? "#fff" : T.inkMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{label}</button>;
  const badgeStatut = (r: any) => {
    const s = r.statut;
    const c = s.indexOf("PROPOS") === 0 || s.indexOf("Proposition") === 0 ? T.gold : (s.indexOf("À venir") === 0 ? T.inkSoft : T.green);
    return <span title={s} style={{ fontSize: 10, fontWeight: 800, letterSpacing: .5, color: c, border: "1px solid " + c, borderRadius: 9, padding: "1px 8px", whiteSpace: "nowrap" }}>{s.indexOf("PROPOS") === 0 || s.indexOf("Proposition") === 0 ? "PROPOSÉE" : (s.indexOf("À venir") === 0 ? "À VENIR" : (estImplementee(r) ? "IMPLÉMENTÉE · TESTÉE" : "RATIFIÉE"))}</span>;
  };
  const cibleParam = (r: any) => {
    const c = norm(r.comment);
    if (c.indexOf("coc") >= 0) return ["coc", "Écran CoC"];
    if (c.indexOf("screening") >= 0) return ["screening", "Écran Screening"];
    if (c.indexOf("questionnaire") >= 0 || c.indexOf("r-q") >= 0) return ["admin", "Admin · questionnaire R-Q"];
    if (c.indexOf("iam") >= 0 || c.indexOf("utilisateur") >= 0 || c.indexOf("droit") >= 0) return ["admin", "Admin · IAM & droits"];
    if (c.indexOf("tenant.settings") >= 0) return ["admin", "Admin · Tenant.settings"];
    return ["__editor", "Règles tenant du moteur (ci-dessous)"];
  };
  const paramBtn = (r: any) => {
    const t = cibleParam(r);
    return <button key="p" title={"Paramétrer : " + t[1]} onClick={(ev) => { ev.stopPropagation(); if (t[0] === "__editor") { const n = document.getElementById("wf-tenant-editor"); if (n && n.scrollIntoView) n.scrollIntoView({ behavior: "smooth" }); } else if (go) go(t[0]); }} style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: T.blue, border: "none", borderRadius: 9, padding: "2px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>⚙ Paramétrer → {t[1]}</button>;
  };
  const ligne = (r: any) => <div key={r.id} style={{ padding: "11px 2px", borderBottom: "1px solid " + T.lineSoft }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: T.olive700, minWidth: 44 }}>{r.id}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{r.titre}</span>
      {badgeStatut(r)}
      <span style={{ fontSize: 10.5, fontWeight: 700, color: r.param === "tenant" ? T.blue : T.inkSoft, background: r.param === "tenant" ? T.blueSoft : T.surface, border: "1px solid " + T.lineSoft, borderRadius: 9, padding: "1px 8px" }}>{r.param === "tenant" ? "⚙ paramétrable banque" : "🔒 invariant"}</span>
      {r.param === "tenant" ? paramBtn(r) : null}
    </div>
    {!compact && <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.55, margin: "5px 0 0 44px", maxWidth: 860 }}>{r.expl}</div>}
    {!compact && <div style={{ margin: "7px 0 0 44px", maxWidth: 860, background: r.param === "tenant" ? T.blueSoft : T.cream, border: "1px solid " + T.lineSoft, borderRadius: 8, padding: "7px 11px", display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: r.param === "tenant" ? T.blue : T.olive700, whiteSpace: "nowrap" }}>{r.param === "tenant" ? "⚙ COMMENT PARAMÉTRER" : "🔒 POURQUOI FIXE"}</span>
      <span style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}>{r.comment}</span>
    </div>}
  </div>;
  return <div style={{ ...wfCarte, marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.olive900 }}>Catalogue des règles de workflow (R1→R104)</div>
      <div style={{ fontSize: 12, color: T.inkSoft }}>{RC.length + " règles · " + nImpl + " implémentées & testées · " + nT + " paramétrables · " + (RC.length - nT) + " invariants"}</div>
    </div>
    <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 10, lineHeight: 1.5 }}>Liste normative ordonnée (R1 → R104), groupée par bloc. Chaque règle affiche son énoncé, son statut de mise en place, et — si elle est paramétrable — <b>la clé exacte, son type, sa valeur par défaut et l'écran où la régler</b>. Les invariants expliquent pourquoi ils ne se paramètrent pas.</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (n°, titre, énoncé, clé…)" style={{ flex: 1, minWidth: 220, padding: "8px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 13, background: T.surface, color: T.ink }} />
      {chip("tous", "Toutes")}{chip("implementes", "✓ Implémentées & testées")}{chip("tenant", "⚙ Paramétrables (" + nT + ")")}{chip("fixe", "🔒 Invariants")}
      <button onClick={() => setCompact(!compact)} style={{ padding: "6px 13px", borderRadius: 16, border: "1px solid " + T.line, background: T.surface, color: T.inkMid, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{compact ? "▾ Détailler" : "▴ Vue compacte"}</button>
    </div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{blocs.map((b) => <button key={"s" + b} onClick={() => { const n = document.getElementById("wfbloc-" + parseInt(b)); if (n && n.scrollIntoView) n.scrollIntoView({ behavior: "smooth" }); }} style={{ fontSize: 11, padding: "4px 11px", borderRadius: 12, border: "1px solid " + T.sage, background: T.surface, color: T.olive900, cursor: "pointer", fontWeight: 600 }}>{b + " (" + visibles.filter((r) => r.bloc === b).length + ")"}</button>)}</div>
    {visibles.length === 0 && <div style={{ fontSize: 13, color: T.inkSoft, padding: "14px 4px" }}>Aucune règle ne correspond.</div>}
    {blocs.map((b) => <div key={b} id={"wfbloc-" + parseInt(b)} style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", color: T.olive700, margin: "14px 0 2px", padding: "5px 8px", background: T.oliveSoft, borderRadius: 7 }}>{"Bloc " + b + "  ·  " + visibles.filter((r) => r.bloc === b).length + " règle(s)"}</div>
      {visibles.filter((r) => r.bloc === b).map(ligne)}
    </div>)}
  </div>;
}

// Source : docs/reference/olive-demo.html 24245–24336 — porté verbatim.
export function WfEngineScreen({ go }: { go?: (s: string) => void }) {
  const [rtType, setRtType] = useState("minPreparateurs");
  const [props, setProps] = useState<any>(null);
  const [msg, setMsg] = useState<any>(null);
  const [, force] = useState(0);
  const maj = () => force(x => x + 1);
  const versions = WF_ENGINE.audit().filter((e: any) => e.type.indexOf("REGLE_TENANT") === 0);
  return <div style={{ maxWidth: 1020 }}>
    <div style={{ ...wfCarte, display: "flex", gap: 14, alignItems: "center", padding: "11px 18px" }}>
      <div style={{ flex: 1, fontSize: 12.5, color: T.inkMid }}>Ici : les règles et leur versioning. Conception → <b>Designer</b> · suivi → <b>Instances</b> · rejeu & preuves → <b>Audit</b>.</div>
      <button style={wfBouton(T.olive600)} onClick={() => go && go("wfdesigner")}>✎ Designer</button>
      <button style={{ ...wfBouton(T.surface), color: T.olive700, border: `1px solid ${T.olive600}` }} onClick={() => go && go("wfmanagement")}>▶ Instances</button>
      <button style={{ ...wfBouton(T.surface), color: T.olive700, border: `1px solid ${T.olive600}` }} onClick={() => go && go("wfaudit")}>🔍 Audit</button>
    </div>
    <WfRulesCatalogPanel go={go} />
    {msg && <div style={{ borderRadius: 8, padding: "9px 14px", marginBottom: 12, fontSize: 13, background: msg.ok ? T.greenSoft : T.redSoft, border: `1px solid ${msg.ok ? T.green : T.red}`, color: msg.ok ? T.olive900 : T.red }} onClick={() => setMsg(null)}>{msg.texte}</div>}
    <div style={{ ...wfCarte }} id="wf-tenant-editor">
      <div style={{ fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 8 }}>Règles du workflow</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>{(WF_INVARIANTS as any[]).map(([r, l]) => <span key={r} title={l} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 11, background: T.oliveSoft, color: T.olive900, border: `1px solid ${T.sage}` }}>🔒 {r} — {l}</span>)}</div>
      {WF_ENGINE.tenantRules.length === 0 && <div style={{ fontSize: 13, color: T.inkSoft, margin: "6px 0" }}>Aucune règle tenant — le socle réglementaire s'applique seul.</div>}
      {WF_ENGINE.tenantRules.map((r: any) => <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 4px", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 13, opacity: r.actif ? 1 : .5 }}>
        <b style={{ color: T.olive700 }}>{r.id}</b>
        <span>{((WF_TYPES_RT as any[]).find(t => t[0] === r.type) || [, r.type])[1]}</span>
        <span style={{ fontSize: 11, color: T.inkSoft }}>{JSON.stringify(r.params || {})}</span>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9, background: r.source === "IA" ? T.violetSoft : T.blueSoft, color: r.source === "IA" ? T.violet : T.blue }}>{r.source === "IA" ? "🤖 Olivia" : "manuel"}</span>
        <button style={{ ...wfBouton(r.actif ? T.red : T.olive600), marginLeft: "auto", padding: "4px 10px", fontSize: 12 }} onClick={() => { WF_ENGINE.setTenantRuleActive(r.id, !r.actif); maj(); }}>{r.actif ? "Désactiver" : "Réactiver"}</button>
      </div>)}
      <div style={{ display: "flex", gap: 9, marginTop: 10, alignItems: "center" }}>
        <select value={rtType} onChange={e => setRtType(e.target.value)} style={{ border: `1px solid ${T.sage}`, borderRadius: 6, padding: "6px 9px" }}>{(WF_TYPES_RT as any[]).map(([t, l]) => <option key={t} value={t}>{l}</option>)}</select>
        <button style={wfBouton(T.olive600)} onClick={() => { const [t, , p] = (WF_TYPES_RT as any[]).find(x => x[0] === rtType); try { WF_ENGINE.addTenantRule({ id: "RT-" + (WF_ENGINE.tenantRules.length + 1), type: t, params: p, source: "manuel", justification: "ajout manuel" }); setMsg({ ok: true, texte: "Règle ajoutée et tracée (R56)." }); maj(); } catch (x: any) { setMsg({ ok: false, texte: String(x.message || x) }); } }}>+ Ajouter</button>
      </div>
    </div>
    <div style={{ ...wfCarte, border: `1px solid ${T.violet}55`, background: T.violetSoft }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.violet, marginBottom: 4 }}>🤖 Olivia — règles proposées depuis le journal</div>
      <div style={{ fontSize: 12, color: T.inkMid, marginBottom: 8 }}>L'IA propose, l'humain adopte (R44) — adoption tracée.</div>
      <button style={wfBouton(T.violet)} onClick={() => setProps(wfOliviaPropose())}>Analyser & proposer</button>
      {props && props.length === 0 && <div style={{ fontSize: 13, marginTop: 8, color: T.inkMid }}>Rien à proposer.</div>}
      {props && props.map((p: any, i: number) => <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px", margin: "8px 0", fontSize: 13 }}>
        <b style={{ color: T.violet }}>{((WF_TYPES_RT as any[]).find(t => t[0] === p.type) || [, p.type])[1]}</b>
        <span style={{ fontSize: 11, color: T.inkSoft }}> {JSON.stringify(p.params)}</span>
        <div style={{ fontSize: 12, color: T.inkMid, margin: "4px 0" }}>{p.justification}</div>
        <button style={{ ...wfBouton(T.olive600), padding: "5px 12px", fontSize: 12 }} onClick={() => { WF_ENGINE.addTenantRule({ id: "RT-" + (WF_ENGINE.tenantRules.length + 1), type: p.type, params: p.params, source: "IA", justification: p.justification }); setProps((v: any) => v.filter((_: any, j: number) => j !== i)); setMsg({ ok: true, texte: "Règle adoptée — tracée, source : IA." }); maj(); }}>✔ Adopter</button>
        <button style={{ ...wfBouton(T.surface), color: T.inkMid, border: `1px solid ${T.line}`, padding: "5px 12px", fontSize: 12, marginLeft: 6 }} onClick={() => setProps((v: any) => v.filter((_: any, j: number) => j !== i))}>Écarter</button>
      </div>)}
    </div>
    <div style={wfCarte}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.olive900, marginBottom: 4 }}>Versioning des règles</div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 10 }}>Chaque changement = un événement daté ; les dossiers validés ne sont jamais réécrits (grandfathering R29/R48).</div>
      {versions.length === 0 && <div style={{ fontSize: 13, color: T.inkSoft }}>Aucun changement de règle pour l'instant.</div>}
      {versions.map((ev: any) => <div key={ev.seq} style={{ padding: "5px 10px", borderLeft: `3px solid ${T.gold}`, background: T.surface, marginBottom: 4, fontSize: 12, borderRadius: "0 6px 6px 0", border: `1px solid ${T.lineSoft}` }}>
        <span style={{ color: T.inkSoft, fontSize: 11 }}>#{ev.seq} · {"" + ev.at}</span> — <b>{ev.type}</b> · {ev.regle}{ev.regleType ? " (" + ev.regleType + ")" : ""}{ev.source ? " · " + ev.source : ""}
      </div>)}
    </div>
  </div>;
}
