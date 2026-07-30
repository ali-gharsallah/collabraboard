import React, { useState } from "react";
import { T } from "./tokens";
import { SectionTitle, Badge } from "./components";
import { ExportBtn } from "./components-data";
import { pushParamAudit } from "./param-audit-support";
import { AML_SCORING_RULES, AML_PARAMS } from "./aml";
import { AML_SCENARIOS } from "./aml-workspace-support";
import { C48_AML, C48_ISL, AML_NOMS_FR, amlCleanName, amlThemeOf, amlHitsSeries, RULE_PARAM_KEY } from "./aml-catalog-support";

// CONSIGNÉ — CPSI_SCENARIOS / CPSI_GROUPES (profilage continu) non portés → undefined.
// La garde `typeof … !== "undefined"` de la source saute cette section : ces scénarios
// n'apparaissent pas dans le référentiel (fidèle tant que le moteur CPSI n'est pas porté).
const CPSI_SCENARIOS: any = undefined;
const CPSI_GROUPES: any = undefined;

// Source : docs/reference/olive-demo.html 26972–27122 — porté verbatim.
export function AmlEncyclopediaScreen({ user }: { user?: any }) {
  const [, force] = useState(0);
  const [theme, setTheme] = useState("Tous");
  const [q, setQ] = useState("");
  const [openCode, setOpenCode] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  function audit(msg: string) { try { pushParamAudit("Compliance", "Règles AML — " + msg); } catch (e) { /* noop */ } }
  const gherkinByRule: any = {}; C48_AML.forEach(g => { gherkinByRule[g.rule] = g; }); C48_ISL.forEach(g => { gherkinByRule[g.rule] = g; });
  const rows: any[] = [];
  AML_SCORING_RULES.forEach(function (r: any) {
    const pk = RULE_PARAM_KEY[r.id]; const p = pk ? (AML_PARAMS as any)[pk] : null;
    rows.push({ code: r.id, ref: "réf. scoring " + r.id, kind: "SCORING", family: "SCORE", nom: r.label, ico: "◉",
      descH: "Quand ce critère est vérifié chez le client, le scénario ajoute " + r.pts + " points à son score de risque. Le score détermine le niveau de diligence (SDD / CDD / EDD) et l'aiguillage vers le bon comité.",
      calc: "+" + r.pts + " points au score de risque si la condition « " + r.label + " » est vérifiée sur le client ou son KYC courant.",
      cat: r.cat, obj: r, param: p, on: true, fixed: true, niveau: null, block: false });
  });
  AML_SCENARIOS.forEach(function (s: any) {
    const m = (s.name || "").match(/\(R(\d+)\)/); const g = m ? gherkinByRule["R" + m[1]] : null;
    rows.push({ code: s.code, ref: m ? "réf. catalogue R" + m[1] : "réf. " + s.code, kind: "MONITORING", family: "AML",
      nom: (function (nn) { return AML_NOMS_FR[nn] || nn; })(amlCleanName(g ? g.nom : s.name)), ico: g ? g.ico : "◬",
      descH: g ? (g.desc + " " + g.then) : ("Surveillance continue des transactions : " + s.logic + ". En cas de déclenchement, une alerte documentée part vers le Compliance Officer."),
      calc: s.logic + (typeof s.threshold === "number" ? " — seuil déclencheur : " + s.threshold + " " + (s.unit || "") : ""),
      cat: s.cat, obj: s, threshold: s.threshold, unit: s.unit, on: s.on, gherkin: g, niveau: g ? g.niveau : null, block: g ? g.block : false,
      hitsBase: s.hits || 0 });
  });
  C48_ISL.forEach(function (g: any) {
    rows.push({ code: g.id, ref: "réf. catalogue " + g.rule, kind: "MONITORING", family: "ISL", nom: AML_NOMS_FR[g.nom] || g.nom, ico: g.ico,
      descH: g.desc + " " + g.then, calc: g.when + " → " + (g.block ? "blocage automatique (Niveau 1), décision humaine requise." : "signal Niveau " + g.niveau + " vers le Compliance Officer."),
      cat: "Islamic", obj: g, on: g.on !== false, gherkin: g, niveau: g.niveau, block: g.block, hitsBase: 0 });
  });
  const refIndex: any = {}; rows.forEach(function (r) { const m = String(r.ref || "").match(/R\d+/); if (m) refIndex[m[0]] = r; });
  if (typeof CPSI_SCENARIOS !== "undefined") (CPSI_SCENARIOS as any[]).forEach(function (sc: any) {
    if (!sc.label || !sc.groupes_seuils) return;
    const gseuils = Object.keys(sc.groupes_seuils).map(function (gid) {
      const g = (typeof CPSI_GROUPES !== "undefined") && (CPSI_GROUPES as any[]).find(function (x) { return x.id === gid; });
      return { gid: gid, gnom: (g && (g.nom || g.label)) || gid, obj: sc.groupes_seuils, key: gid };
    });
    const host = sc.ruleRef && refIndex[sc.ruleRef];
    if (host) { host.cpsiSeuils = gseuils; host.cpsiObj = sc; return; }
    rows.push({ code: sc.id, ref: "réf. profilage continu", kind: "MONITORING", family: "CPSI", nom: AML_NOMS_FR[sc.label] || sc.label, ico: "◉", descH: sc.desc || "Scénario de profilage continu sur l'ensemble du portefeuille.", calc: "Surveillance du champ « " + sc.champ + " »", cat: sc.fam, obj: sc, on: sc.on !== false, cpsiSeuils: gseuils, niveau: null, block: false, hitsBase: 2, themeOverride: sc.fam });
  });
  rows.forEach(function (r) { r.theme = r.themeOverride || amlThemeOf(r); r.hits = amlHitsSeries(r.code, r.hitsBase); r.hitsTotal = r.hits.reduce(function (a: number, b: number) { return a + b; }, 0) + (r.hitsBase || 0); });
  const THEMES = ["Tous"]; rows.forEach(function (r) { if (THEMES.indexOf(r.theme) < 0) THEMES.push(r.theme); });
  const themeCounts: any = {}; rows.forEach(function (r) { themeCounts[r.theme] = (themeCounts[r.theme] || 0) + 1; });
  const ql = q.trim().toLowerCase();
  const view = rows.filter(function (r) {
    if (theme !== "Tous" && r.theme !== theme) return false;
    if (ql && (r.nom + " " + r.descH + " " + (r.calc || "") + " " + r.theme).toLowerCase().indexOf(ql) < 0) return false;
    return true;
  });
  function toggleOn(r: any) { if (r.fixed) return; r.obj.on = !r.obj.on; audit("« " + r.nom + " » " + (r.obj.on ? "activé" : "désactivé")); force(x => x + 1); }
  function setThreshold(r: any, v: number) { if (r.obj && typeof r.obj.threshold === "number") { r.obj.threshold = v; audit("« " + r.nom + " » — seuil → " + v + " " + (r.unit || "")); force(x => x + 1); } }
  function setParam(r: any, v: number) { if (r.param) { r.param.value = v; audit("« " + r.nom + " » — paramètre « " + r.param.label + " » → " + v); force(x => x + 1); } }
  function setWeight(r: any, v: number) { if (r.obj && typeof r.obj.pts === "number") { r.obj.pts = v; audit("« " + r.nom + " » — poids scoring → " + v + " pts"); force(x => x + 1); } }
  function simulate(r: any) {
    const g = r.gherkin; if (!g) return;
    let score = Math.round(35 + Math.random() * 55); if (g.block) score = Math.max(score, 92);
    setSignals(p => [{ ts: new Date().toLocaleString("fr-CH"), nom: r.nom, niveau: g.niveau, block: g.block, score: score, theme: r.theme }].concat(p).slice(0, 20));
    audit("simulation « " + r.nom + " » — score " + score + (g.block ? " — BLOQUÉ" : ""));
  }
  const numInp = (val: any, onCh: (v: number) => void, w?: number) => (
    <input type="number" value={val} onChange={e => onCh(parseFloat(e.target.value || "0"))} style={{ width: w || 86, padding: "5px 7px", borderRadius: 7, border: "1px solid " + T.line, fontSize: 12, fontWeight: 700, color: T.olive700, background: "#fff" }} />
  );
  const HitBars = (r: any) => {
    const mx = Math.max.apply(null, r.hits.concat([1]));
    const MO = ["fév", "mar", "avr", "mai", "juin", "juil"];
    return <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 34 }}>{r.hits.map((v: number, i: number) => <div key={i} title={MO[i] + " 2026 · " + v + " hit(s)"} style={{ width: 10, height: Math.max(3, Math.round(v / mx * 30)), borderRadius: 2, background: i === 5 ? T.gold : T.leafLight }} />)}</div>;
  };
  return (
    <div>
      <SectionTitle right={<ExportBtn filename="regles-aml.csv" headers={["Scénario", "Thème", "Type", "Description", "Calcul", "Seuil", "Unité", "Actif", "Blocage", "Hits 6 mois"]} rows={() => rows.map(r => [r.nom, r.theme, r.kind, r.descH, r.calc || "", r.threshold != null ? r.threshold : (r.param ? r.param.value : ""), r.unit || (r.param ? r.param.unit : ""), r.on ? "Oui" : "Non", r.block ? "AUTO" : "", r.hitsTotal])} />}>Règles AML</SectionTitle>
      <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: -8, marginBottom: 14 }}>Tous les scénarios AML de la banque, en langage humain, groupés par thème bancaire. Survolez un nom pour comprendre ce que fait le scénario ; cliquez pour le détail complet. Seuils, poids et activation se règlent ici — chaque modification est tracée.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {THEMES.map(function (t) {
          const on = theme === t; const n = t === "Tous" ? rows.length : (themeCounts[t] || 0);
          return <button key={t} onClick={() => setTheme(t)} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid " + (on ? T.olive600 : T.line), background: on ? T.olive600 : "#fff", color: on ? "#fff" : T.inkMid, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{t + " · " + n}</button>;
        })}
      </div>
      <input placeholder="Rechercher un scénario par son nom ou un mot-clé (structuring, zakat, sanctions…)" value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", borderRadius: 10, border: "1px solid " + T.line, fontSize: 12.5, background: "#fff", marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(430px,1fr))", gap: 12, marginBottom: 16 }}>
        {view.map(function (r) {
          const open = openCode === r.code;
          return (
            <div key={r.code} style={{ background: T.surface, border: "1px solid " + (open ? T.sage : T.line), borderRadius: 12, padding: 14, borderLeft: "4px solid " + (r.block ? T.red : r.theme === "Islamic Finance" ? T.violet : r.theme === "Private Banking" ? T.gold : T.olive500) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 15 }}>{r.ico}</span>
                <div title={r.descH} onClick={() => setOpenCode(open ? null : r.code)} style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: T.ink, cursor: "help", lineHeight: 1.3 }}>{r.nom}</div>
                {r.block && <Badge text="⛔ BLOQUE" color="#fff" bg={T.red} />}
                {!r.fixed && <button onClick={() => toggleOn(r)} style={{ padding: "3px 10px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 800, background: r.obj.on ? T.greenSoft : T.lineSoft, color: r.obj.on ? T.green : T.inkSoft }}>{r.obj.on ? "ON" : "OFF"}</button>}
                {r.fixed && <span style={{ fontSize: 9.5, color: T.green, fontWeight: 800 }}>● socle</span>}
              </div>
              <div style={{ fontSize: 11.5, color: T.inkMid, lineHeight: 1.55, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: open ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{r.descH}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", background: T.lineSoft, borderRadius: 10, padding: "10px 12px" }}>
                <div>
                  <div style={{ fontSize: 9, color: T.inkSoft, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{r.kind === "SCORING" ? "Poids" : "Seuil"}</div>
                  {r.kind === "SCORING"
                    ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{numInp(r.obj.pts, (v) => setWeight(r, v), 60)}<span style={{ fontSize: 10, color: T.inkSoft }}>pts</span></div>
                    : (typeof (r.obj && r.obj.threshold) === "number"
                      ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{numInp(r.obj.threshold, (v) => setThreshold(r, v))}<span style={{ fontSize: 9.5, color: T.inkSoft, maxWidth: 74 }}>{r.unit || ""}</span></div>
                      : r.param
                        ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{numInp(r.param.value, (v) => setParam(r, v))}<span style={{ fontSize: 9.5, color: T.inkSoft }}>{r.param.unit || ""}</span></div>
                        : r.cpsiSeuils
                          ? <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{r.cpsiSeuils.map((gs: any) => <div key={gs.gid} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 9, color: T.inkSoft, width: 74, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={gs.gnom}>{gs.gnom}</span>{numInp(gs.obj[gs.key], (v) => { gs.obj[gs.key] = v; audit("« " + r.nom + " » — seuil groupe " + gs.gnom + " → " + v); force(x => x + 1); }, 58)}</div>)}</div>
                          : <span style={{ fontSize: 11, color: T.inkSoft }}>qualitatif</span>)}
                </div>
                <div>
                  <div style={{ fontSize: 9, color: T.inkSoft, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Comment c'est calculé</div>
                  <div style={{ fontSize: 10.5, color: T.inkMid, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: open ? "unset" : 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{r.calc || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: T.inkSoft, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Hits · 6 mois</div>
                  {HitBars(r)}
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: r.hitsTotal > 12 ? T.red : T.olive700, marginTop: 2 }}>{r.hitsTotal + " au total"}</div>
                </div>
              </div>
              {open && (
                <div style={{ marginTop: 10, background: "#fff", border: "1px solid " + T.sage, borderRadius: 10, padding: 12, fontSize: 11.5, lineHeight: 1.65 }}>
                  {r.gherkin && [
                    <div key="g"><b style={{ color: T.olive700 }}>Situation de départ — </b>{r.gherkin.given}</div>,
                    <div key="w"><b style={{ color: T.olive700 }}>Ce que le moteur observe — </b>{r.gherkin.when}</div>,
                    <div key="t"><b style={{ color: T.olive700 }}>Ce qui se passe — </b>{r.gherkin.then}</div>]}
                  {!r.gherkin && <div><b style={{ color: T.olive700 }}>Détail — </b>{r.calc}</div>}
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9.5, color: T.inkSoft }}>{r.ref + " · thème " + r.theme + " · paramètre tenant (registre R-Q), modifiable sans redéploiement"}</span>
                    {r.gherkin && <button onClick={() => simulate(r)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>▶ Simuler ce scénario</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ background: T.surface, border: "1px solid " + T.line, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Journal des signaux — append-only (rejeu à date)</div>
        {signals.length === 0
          ? <div style={{ fontSize: 11.5, color: T.inkSoft }}>Aucun signal — ouvrez un scénario Private Banking ou Islamic et cliquez « ▶ Simuler ». Chaque signal et chaque changement de seuil est un événement tracé.</div>
          : signals.map(function (s, i) {
            return <div key={i} style={{ padding: "8px 12px", borderRadius: 9, marginBottom: 6, background: s.block ? T.redSoft : T.lineSoft, borderLeft: "3px solid " + (s.block ? T.red : s.niveau === 1 ? T.gold : T.olive500), fontSize: 11.5, display: "flex", justifyContent: "space-between" }}><span style={{ fontWeight: 700, color: T.ink }}>{s.nom + " — " + s.theme}</span><span style={{ color: s.block ? T.red : T.amber, fontWeight: 800 }}>{(s.block ? "⛔ BLOQUÉ" : "Alerte N" + s.niveau) + " · " + s.score + "/100 · " + s.ts}</span></div>;
          })}
      </div>
    </div>
  );
}
