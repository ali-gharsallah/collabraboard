import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { BanniereCloture } from "../../components/BanniereCloture"; // R267/OF-10 — écran client
import { OliveBranchVertical, Stage } from "../../components/OliveBranch";
import { P } from "../../theme/palette";
import seed from "../../seed/clients.json";

type Row = { id: string; name: string; structure: string; country: string; riskLevel: string; corrLang?: string };

const RISK = (r: string): [string, string] =>
  r === "HIGH" ? [P.red, P.redSoft] : r === "LOW" ? [P.green, P.greenSoft] : [P.amber, P.amberSoft];
const RISK_FR: Record<string, string> = { HIGH: "Élevé", MEDIUM: "Moyen", LOW: "Faible" };
// Rendu du code pays servi (ISO-2 → drapeau) — pas une donnée fabriquée, juste un affichage du champ réel.
const FLAG: Record<string, string> = { CH: "🇨🇭", JP: "🇯🇵", AE: "🇦🇪", FR: "🇫🇷", DE: "🇩🇪", GB: "🇬🇧",
  US: "🇺🇸", IT: "🇮🇹", ES: "🇪🇸", LU: "🇱🇺", AT: "🇦🇹", JE: "🇯🇪", SG: "🇸🇬", HK: "🇭🇰" };

// Cycle de vie affiché = le MODÈLE (Prospection→…→Review) ; le SEUL état dérivé d'une donnée
// réelle servie est le screening (rouge si le client est classé HIGH). Le reste = « client au master
// = relation active », vrai par construction — aucun statut KYC fabriqué (canon : rien d'inventé).
function lifecycle(c: Row): Stage[] {
  const high = c.riskLevel === "HIGH";
  return [
    { id: 1, label: "Prospection", state: "done", desc: "Prise de contact et qualification" },
    { id: 2, label: "Onboarding", state: "done", desc: "Ouverture de la relation" },
    { id: 3, label: "KYC", state: "done", desc: "Dossier de diligence constitué" },
    { id: 4, label: "Screening", state: high ? "alert" : "done",
      desc: high ? "Classé HIGH — diligence renforcée" : "Aucun signalement bloquant" },
    { id: 5, label: "Relation active", state: "current", desc: "Client au master — relation en cours" },
    { id: 6, label: "Review", state: "pending", desc: "Prochaine revue périodique" },
  ];
}

const initiales = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

// ─── Carte de visite (popup) — port fidèle de la maquette : deux colonnes,
// branche d'olivier verticale du cycle de vie à gauche, carte identité dégradée à droite.
function CarteVisite({ c, onClose }: { c: Row; onClose: () => void }) {
  const [rc, rbg] = RISK(c.riskLevel);
  const badge = { fontSize: 10.5, color: P.inkMid, background: P.lineSoft, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" as const };
  return (
    <div onClick={onClose} role="dialog" aria-modal aria-label={`Carte de visite ${c.name}`}
      style={{ position: "fixed", inset: 0, background: "rgba(10,15,8,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: P.cream, borderRadius: 18, width: 900, maxWidth: "96vw", maxHeight: "90vh", overflowY: "auto", padding: 24, boxShadow: "0 24px 70px rgba(10,15,8,0.35)" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
          <button onClick={onClose} aria-label="Fermer la carte de visite"
            style={{ border: "none", background: "transparent", fontSize: 20, color: P.inkSoft, cursor: "pointer" }}>✕</button>
        </div>
        <div className="olv-carte-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18 }}>
          {/* colonne gauche : la branche d'olivier = cycle de vie */}
          <div style={{ background: P.surface, borderRadius: 14, padding: 24, border: `1px solid ${P.line}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: P.ink }}>
              Cycle de vie — {FLAG[c.country] ? FLAG[c.country] + " " : ""}{c.name}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <span style={{ ...badge, fontFamily: "monospace", fontWeight: 700, color: P.olive700, background: P.oliveSoft }}>{c.id}</span>
              <span style={badge}>{c.structure}</span>
              <span style={badge}>{FLAG[c.country] ? FLAG[c.country] + " " : ""}{c.country}</span>
              <span style={{ ...badge, fontWeight: 700, color: rc, background: rbg }}>Risque {RISK_FR[c.riskLevel] ?? c.riskLevel}</span>
            </div>
            <OliveBranchVertical stages={lifecycle(c)} />
          </div>
          {/* colonne droite : carte identité dégradée + note d'honnêteté des données */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg,${P.olive700},${P.olive500})`, borderRadius: 14, padding: 20, color: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, fontWeight: 800, fontSize: 16,
                  background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales(c.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>{c.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{c.structure} · {FLAG[c.country] ? FLAG[c.country] + " " : ""}{c.country}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
                <div><div style={{ fontSize: 10, opacity: 0.8 }}>Identifiant</div><div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace" }}>{c.id}</div></div>
                <div><div style={{ fontSize: 10, opacity: 0.8 }}>Niveau de risque</div><div style={{ fontSize: 13, fontWeight: 700 }}>{RISK_FR[c.riskLevel] ?? c.riskLevel}</div></div>
                {c.corrLang && <div><div style={{ fontSize: 10, opacity: 0.8 }}>Langue</div><div style={{ fontSize: 13, fontWeight: 700 }}>{c.corrLang}</div></div>}
              </div>
            </div>
            <div style={{ background: P.oliveSoft, borderRadius: 14, padding: 16, border: `1px solid ${P.line}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: P.ink, marginBottom: 6 }}>🫒 Vue construite sur les données maîtres</div>
              <div style={{ fontSize: 11.5, color: P.inkMid, lineHeight: 1.6 }}>
                Cette carte n'affiche que les champs réellement servis (identifiant, structure, pays,
                risque, langue). Le cycle de vie est le <strong>modèle</strong> : seul le screening
                est piloté par une donnée réelle (rouge si le client est classé HIGH). Aucun statut
                KYC n'est fabriqué.</div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}

export function ClientsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [demo, setDemo] = useState(false);
  const [selection, setSelection] = useState<string | null>(null); // ligne sélectionnée → bannière R267
  const [carte, setCarte] = useState<Row | null>(null);            // carte de visite ouverte (popup)
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("ALL");
  useEffect(() => { apiGetSourced<{ data: Row[] }>("/v1/clients", { data: seed as Row[] })
    .then(r => { setRows(r.data.data); setDemo(r.isDemo); }); }, []);

  const filtered = rows.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
    const matchRisk = filterRisk === "ALL" || c.riskLevel === filterRisk;
    return matchSearch && matchRisk;
  });
  const th = { padding: "9px 14px", textAlign: "left" as const, fontSize: 10, color: P.inkSoft, textTransform: "uppercase" as const, letterSpacing: 0.5, whiteSpace: "nowrap" as const };
  const td = { padding: "12px 14px", fontSize: 12, color: P.inkMid };

  return <div>
    {demo && <DemoModeBanner/>}
    <h2>Clients — {rows.length}</h2>
    <BanniereCloture clientId={selection}/>

    {/* barre recherche + filtres risque (port maquette, câblée aux données réelles) */}
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 200px" }}>
        <span aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.inkSoft, fontSize: 13 }}>🔍</span>
        <input type="search" placeholder="Nom, ID, pays…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8, border: `1px solid ${P.line}`, fontSize: 12, background: P.surface, color: P.ink, outline: "none", boxSizing: "border-box" }}/>
      </div>
      {([["ALL", "Tout risque"], ["LOW", "Faible"], ["MEDIUM", "Moyen"], ["HIGH", "Élevé"]] as const).map(([v, l]) => {
        const on = filterRisk === v;
        const [cc, cbg] = v === "ALL" ? [P.inkMid, "transparent"] : RISK(v);
        return <button key={v} onClick={() => setFilterRisk(v)}
          style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${on ? cc : P.line}`, background: on ? cbg : "transparent",
            color: on ? cc : P.inkMid, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>{l}</button>;
      })}
    </div>

    {/* la LISTE de clients (tableau) — la carte de visite s'ouvre au bout de chaque ligne */}
    <div style={{ background: P.surface, borderRadius: 14, border: `1px solid ${P.line}`, overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{filtered.length} client(s)</span>
        <span style={{ fontSize: 11, color: P.inkSoft }}>Cliquez une ligne pour la sélectionner · 🪪 carte de visite en fin de ligne</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ background: P.lineSoft }}>
              {["Client", "ID", "Structure", "Pays", "Risque", "Langue", ""].map((h, i) =>
                <th key={i} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const [rc, rbg] = RISK(c.riskLevel); const sel = selection === c.id;
              return <tr key={c.id} onClick={() => setSelection(c.id)}
                style={{ borderBottom: `1px solid ${P.lineSoft}`, cursor: "pointer", background: sel ? P.oliveSoft : "transparent" }}
                onMouseEnter={e => e.currentTarget.style.background = P.oliveSoft}
                onMouseLeave={e => e.currentTarget.style.background = sel ? P.oliveSoft : "transparent"}>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#fff",
                      background: `linear-gradient(135deg,${P.olive700},${P.leaf})`, display: "flex", alignItems: "center", justifyContent: "center" }}>{initiales(c.name)}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: P.ink, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  </div>
                </td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 10, color: P.inkSoft }}>{c.id}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: P.olive700, background: P.oliveSoft, padding: "2px 7px", borderRadius: 4 }}>{c.structure}</span></td>
                <td style={td}>{FLAG[c.country] ? FLAG[c.country] + " " : ""}{c.country}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: rc, background: rbg, padding: "2px 7px", borderRadius: 4 }}>{RISK_FR[c.riskLevel] ?? c.riskLevel}</span></td>
                <td style={td}>{c.corrLang ?? "—"}</td>
                <td style={{ padding: "12px 14px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCarte(c)} title="Carte de visite" aria-label={`Carte de visite ${c.name}`}
                    style={{ border: `1px solid ${P.line}`, background: P.surface, color: P.olive700, borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontSize: 14 }}>🪪</button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>

    {carte && <CarteVisite c={carte} onClose={() => setCarte(null)}/>}
  </div>;
}
