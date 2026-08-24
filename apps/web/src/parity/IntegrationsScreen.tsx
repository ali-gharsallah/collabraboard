import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, OliveNote } from "./components";
import { CORE_SYSTEMS, CANONICAL_OBJECTS, TARGET_APPS, MAP_LEVELS, STATUS_STYLE, FIELD_MAPPINGS, MIGRATION_STATUS } from "./integrations-support";

// Source : docs/reference/olive-demo.html 14538–14821 — porté verbatim.
export function IntegrationsScreen() {
  const [tab, setTab] = useState("architecture");
  const [selSys, setSelSys] = useState("AVALOQ");
  const totalMapped = CORE_SYSTEMS.reduce((a, s) => a + s.fieldsMapped, 0);
  const totalFields = CORE_SYSTEMS.reduce((a, s) => a + s.fieldsTotal, 0);
  const totalMigrated = MIGRATION_STATUS.reduce((a, m) => a + m.migrated, 0);
  const totalRecords = MIGRATION_STATUS.reduce((a, m) => a + m.total, 0);
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Data Integration Layer</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Intégrations Core Banking</div>
        <div style={{ fontSize: 13, color: T.inkMid, marginTop: 4, lineHeight: 1.6, maxWidth: 720 }}>Pas un mapping par banque — une traduction unique vers un modèle canonique. Chaque système cœur (Avaloq, Olympic, Temenos) parle sa langue via son adaptateur ; toutes les applications O-Live ne parlent qu'une seule langue derrière.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Systèmes connectés", value: CORE_SYSTEMS.filter(s => s.status === "CONNECTED").length + "/" + CORE_SYSTEMS.length, color: T.olive600 },
          { label: "Objets canoniques", value: CANONICAL_OBJECTS.length, color: T.blue },
          { label: "Champs mappés", value: totalMapped + "/" + totalFields, color: T.gold },
          { label: "Migration globale", value: Math.round(totalMigrated / totalRecords * 100) + "%", color: T.green },
        ].map(k => (
          <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color, fontFamily: "monospace" }}>{k.value}</div>
            <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" }}>
        {([["architecture", "⇌ Architecture"], ["mapping", "▤ Mapping par système"], ["migration", "↻ Migration KYC/Review"]] as [string, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === id ? T.olive600 : "transparent", color: tab === id ? "#fff" : T.inkMid, fontSize: 13, fontWeight: tab === id ? 700 : 500 }}>{label}</button>
        ))}
      </div>
      {tab === "architecture" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 24 }}>
          <svg width="100%" viewBox="0 0 900 380" style={{ minWidth: 760 }}>
            {CORE_SYSTEMS.map((sys, i) => {
              const y = 20 + i * 125;
              return (
                <g key={sys.id}>
                  <rect x={20} y={y} width={190} height={95} rx={10} fill={sys.color + "12"} stroke={sys.color} strokeWidth="1.4" />
                  <text x={35} y={y + 26} fontSize="13" fontWeight="700" fill={T.ink}>{sys.name}</text>
                  <text x={35} y={y + 44} fontSize="10" fill={T.inkSoft}>{sys.vendor}</text>
                  <text x={35} y={y + 61} fontSize="9.5" fill={T.inkMid}>{sys.version}</text>
                  <circle cx={198} cy={y + 14} r={4} fill={sys.status === "CONNECTED" ? T.green : T.amber} />
                  <text x={35} y={y + 80} fontSize="9.5" fontWeight="700" fill={sys.color}>{sys.fieldsMapped}/{sys.fieldsTotal} champs mappés</text>
                  <path d={`M 210 ${y + 47} C 270 ${y + 47}, 300 200, 350 200`} fill="none" stroke={sys.color} strokeWidth="1.6" opacity="0.6" markerEnd="url(#arrowIntg)" />
                  <text x={250} y={y + 47 - 8} fontSize="9" fill={sys.color} fontWeight="700">Adapter</text>
                </g>
              );
            })}
            <defs>
              <marker id="arrowIntg" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={T.inkSoft} />
              </marker>
            </defs>
            <rect x={350} y={100} width={220} height={200} rx={12} fill={T.oliveSoft} stroke={T.olive600} strokeWidth="1.6" />
            <text x={460} y={126} textAnchor="middle" fontSize="12.5" fontWeight="800" fill={T.olive700}>Modèle canonique O-Live</text>
            {CANONICAL_OBJECTS.map((o, i) => (
              <g key={o.id}>
                <text x={368} y={148 + i * 20} fontSize="10.5" fill={T.ink}>{o.icon}</text>
                <text x={386} y={148 + i * 20} fontSize="10.5" fontWeight="700" fill={T.ink}>{o.label}</text>
              </g>
            ))}
            {TARGET_APPS.map((app, i) => {
              const y = 30 + i * 80;
              return (
                <g key={app.id}>
                  <path d={`M 570 200 C 640 200, 660 ${y + 30}, 710 ${y + 30}`} fill="none" stroke={T.olive600} strokeWidth="1.6" opacity="0.6" markerEnd="url(#arrowIntg)" />
                  <rect x={710} y={y} width={170} height={60} rx={10} fill={T.surface} stroke={T.olive600} strokeWidth="1.2" />
                  <text x={725} y={y + 26} fontSize="14">{app.icon}</text>
                  <text x={750} y={y + 30} fontSize="11.5" fontWeight="700" fill={T.ink}>{app.label}</text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 16, padding: "12px 16px", background: T.oliveSoft, borderRadius: 10, fontSize: 12, color: T.inkMid, lineHeight: 1.6 }}>
            <strong>Trois niveaux de mapping</strong> évitent l'explosion combinatoire d'un mapping champ-par-champ-par-banque : <strong style={{ color: T.blue }}>Structural</strong> (champ → champ), <strong style={{ color: T.violet || T.olive700 }}>Semantic</strong> (les systèmes ne découpent pas la réalité pareil — UBO vs ayant droit vs beneficial owner), <strong style={{ color: T.amber }}>Contextual</strong> (échelles de risque, seuils propres à chaque banque).
          </div>
        </div>
      )}
      {tab === "mapping" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {CORE_SYSTEMS.map(sys => (
              <button key={sys.id} onClick={() => setSelSys(sys.id)} style={{ padding: "9px 16px", borderRadius: 9, border: `1.5px solid ${selSys === sys.id ? sys.color : T.line}`, background: selSys === sys.id ? sys.color + "14" : T.surface, color: selSys === sys.id ? sys.color : T.inkMid, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{sys.name}</button>
            ))}
          </div>
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.lineSoft }}>{["Champ canonique O-Live", "Champ source", "Niveau", "Note", "Statut"].map(h => (<th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}</tr>
              </thead>
              <tbody>
                {(FIELD_MAPPINGS[selSys] || []).map((m: any, i: number) => {
                  const lvl = MAP_LEVELS[m.level];
                  const [sc, sbg, sl] = STATUS_STYLE[m.status];
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
                      <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 700, color: T.ink, fontFamily: "monospace" }}>{m.canonical}</td>
                      <td style={{ padding: "11px 14px", fontSize: 11.5, color: T.inkMid, fontFamily: "monospace" }}>{m.source}</td>
                      <td style={{ padding: "11px 14px" }}><Badge text={m.level} color={lvl.color} bg={lvl.color + "18"} /></td>
                      <td style={{ padding: "11px 14px", fontSize: 11, color: T.inkSoft, maxWidth: 320 }}>{m.note}</td>
                      <td style={{ padding: "11px 14px" }}><Badge text={sl} color={sc} bg={sbg} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
            {Object.entries(MAP_LEVELS).map(([k, v]: [string, any]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.inkMid }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: v.color, display: "inline-block" }} />
                <span><strong>{k}</strong> — {v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "migration" && (
        <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: T.lineSoft }}>{["Système", "Entité", "Total", "Migré", "À revoir", "Échec", "Progression"].map(h => (<th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>))}</tr>
            </thead>
            <tbody>
              {MIGRATION_STATUS.map((m, i) => {
                const sys = CORE_SYSTEMS.find(s => s.id === m.system);
                const pct = Math.round(m.migrated / m.total * 100);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
                    <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 700, color: sys ? sys.color : T.ink }}>{sys ? sys.name : m.system}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: T.ink }}>{m.entity}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: T.inkMid, fontFamily: "monospace" }}>{m.total.toLocaleString("fr-CH")}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: T.green, fontFamily: "monospace", fontWeight: 700 }}>{m.migrated.toLocaleString("fr-CH")}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: T.amber, fontFamily: "monospace" }}>{m.needsReview.toLocaleString("fr-CH")}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, color: T.red, fontFamily: "monospace" }}>{m.failed.toLocaleString("fr-CH")}</td>
                    <td style={{ padding: "11px 14px", minWidth: 140 }}>
                      <div style={{ height: 6, background: T.lineSoft, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: pct > 90 ? T.green : pct > 50 ? T.amber : T.red, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 3 }}>{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <OliveNote style={{ padding: "12px 16px", background: T.oliveSoft, fontSize: 11.5, color: T.inkMid, lineHeight: 1.6 }}>
            "À revoir" = enregistrements migrés avec un mapping <strong>Partiel</strong> ou <strong>Non mappé</strong> — nécessitent une validation humaine avant golden record. "Échec" = incompatibilité de schéma bloquante, journalisée pour reprise manuelle.
          </OliveNote>
        </div>
      )}
    </div>
  );
}
