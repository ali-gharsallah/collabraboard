import React, { useState } from "react";
import { T } from "./tokens";
import { Badge, KpiCard, StatsToggle } from "./components";
import PERSONS_DATA from "../fixtures/PERSONS_DATA.json";

// PersonsScreen — PORT (v1) de docs/reference/olive-demo.html 17657–17752 (vue Liste détaillée).
// Câblé sur PERSONS_DATA (120). StatsToggle → null (B.6). Vue graphe (17753+) consignée.
const persons = PERSONS_DATA as any[];

const LEGAL_STRUCTURES: Record<string, string> = {
  PP: "Personne physique", SA: "Société opérationnelle (SA)", SARL: "Société (SARL)", DOM: "Société de domicile",
  HOLD: "Holding", TRUST: "Trust", FOND: "Fondation", FO: "Family Office", FUND: "Fonds de placement",
  SCS: "Société en commandite", ASSO: "Association", EST: "Succession (estate)",
};
const PEP_STYLE: Record<string, [string, string, string]> = {
  "PEP": [T.red, T.redSoft, "PEP"], "NEAR": [T.amber, T.amberSoft, "Near-PEP"], "NEAR-PEP": [T.amber, T.amberSoft, "Near-PEP"],
};
const PERSON_PAGE = 30;

export function PersonsScreen() {
  const [view, setView] = useState<"list" | "graph">("list");
  const [lierOpen, setLierOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const [personPage, setPersonPage] = useState(0);
  const nameOf = (id: string) => (persons.find(p => p.id === id) || {}).name || id;

  const personsFiltered = persons.filter(p => {
    if (!personSearch) return true;
    const q = personSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || (p.pep || "").toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
  });
  const personsPage = personsFiltered.slice(personPage * PERSON_PAGE, (personPage + 1) * PERSON_PAGE);
  const personTotalPages = Math.ceil(personsFiltered.length / PERSON_PAGE);
  const pepCount = persons.filter(p => p.pep === "PEP").length;
  const nearPepCount = persons.filter(p => p.pep === "NEAR-PEP").length;
  const multiRoles = persons.filter(p => p.roles.length > 1).length;
  const totalRoles = persons.reduce((a, p) => a + p.roles.length, 0);

  return (
    <div>
      <StatsToggle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          <KpiCard label="Personnes référencées" value={persons.length} sub="PP & structures légales" color={T.olive600} icon="☷" />
          <KpiCard label="Rôles multiples" value={multiRoles} sub={`${totalRoles} rôles au total`} color={T.gold} icon="⧉" />
          <KpiCard label="PEP / Near-PEP" value={pepCount + nearPepCount} sub={`${pepCount} PEP, ${nearPepCount} near`} color={T.red} icon="◬" />
          <KpiCard label="Rôles documentés" value={totalRoles} sub="liens officiels" color={T.leaf} icon="⇄" />
        </div>
      </StatsToggle>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" }}>
        {([["list", "Liste détaillée"], ["graph", "Vue graphe"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: view === id ? T.olive600 : "transparent", color: view === id ? "#fff" : T.inkMid, fontSize: 13, fontWeight: view === id ? 700 : 500 }}>{label}</button>))}
      </div>

      {view === "list" && <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.line}`, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>Personnes &amp; rôles ({personsFiltered.length})</div>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button onClick={() => setLierOpen(true)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12, marginRight: 10, whiteSpace: "nowrap" }}>＋ Lier une personne</button>
            <span style={{ position: "absolute", right: 182, top: "50%", transform: "translateY(-50%)", color: T.inkSoft, fontSize: 12, pointerEvents: "none" }}>🔍</span>
            <input type="search" placeholder="Nom, pays, PEP…" value={personSearch} onChange={e => { setPersonSearch(e.target.value); setPersonPage(0); }} style={{ padding: "6px 10px 6px 28px", borderRadius: 7, border: `1px solid ${T.line}`, fontSize: 12, background: T.cream, color: T.ink, outline: "none", width: 200 }} onFocus={e => (e.target.style.borderColor = T.olive600)} onBlur={e => (e.target.style.borderColor = T.line)} />
          </div>
        </div>
        {personsPage.map(p => {
          const open = expanded === p.id;
          const pep = p.pep ? PEP_STYLE[p.pep] : null;
          return <div key={p.id} style={{ borderBottom: `1px solid ${T.lineSoft}` }}>
            <div onClick={() => setExpanded(open ? null : p.id)} style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", background: open ? T.oliveSoft : "transparent" }}>
              <div style={{ width: 38, height: 38, borderRadius: p.type === "PP" ? "50%" : 10, background: T.surface, border: `1.5px solid ${T.olive600}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: T.olive700, flexShrink: 0 }}>{p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{p.name}</span>
                  <span style={{ fontSize: 13 }}>{p.flag}</span>
                  <Badge text={LEGAL_STRUCTURES[p.type] || p.type} color={T.inkMid} bg={T.lineSoft} />
                  {pep && <span style={{ fontSize: 10, fontWeight: 700, color: pep[0], background: pep[1], padding: "2px 8px", borderRadius: 4 }}>{pep[2]}</span>}
                </div>
                <div style={{ fontSize: 11, color: T.inkSoft, marginTop: 3 }}>{(p.roles || []).length} rôle(s) · {(p.relations || []).length} relation(s) · {p.id}</div>
              </div>
              <span style={{ fontSize: 13, color: T.inkSoft, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </div>
            {open && <div style={{ padding: "4px 20px 18px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Rôles officiels</div>
                {(p.roles || []).map((l: any, i: number) => <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{l.entity}</span>
                    {l.share !== "—" && <span style={{ fontSize: 12, fontWeight: 700, color: T.olive700 }}>{l.share}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                    <Badge text={l.role} color={T.olive700} bg={T.oliveSoft} />
                    <span style={{ fontSize: 10, color: T.inkSoft }}>{LEGAL_STRUCTURES[l.struct]}</span>
                  </div>
                </div>)}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Relations (non officielles)</div>
                {(p.relations || []).length
                  ? (p.relations || []).map((r: any, i: number) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.inkMid, minWidth: 90 }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: T.olive700, fontWeight: 600 }}>{nameOf(r.to)}</span>
                  </div>)
                  : <div style={{ fontSize: 12, color: T.inkSoft, fontStyle: "italic" }}>Aucune relation enregistrée</div>}
                {pep && <div style={{ marginTop: 14, padding: 12, background: pep[1], borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pep[0], background: T.surface, padding: "2px 8px", borderRadius: 4 }}>{pep[2]}</span>
                    {p.pepNote && <span style={{ fontSize: 11, color: T.inkMid }}>{p.pepNote}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.inkMid, lineHeight: 1.5, marginBottom: 8 }}>Le statut PEP ne se propage au dossier qu'<strong>après validation du KYC</strong>.</div>
                  <button title="Action réservée à certains profils (paramétrable)" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${pep[0]}`, background: T.surface, color: pep[0], fontSize: 11, fontWeight: 700, cursor: "not-allowed", opacity: 0.85 }}>🔒 Dé-PEP — réservé</button>
                </div>}
              </div>
            </div>}
          </div>;
        })}
        {personTotalPages > 1 && <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.line}`, display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: T.inkSoft }}>{personsFiltered.length} personnes · page {personPage + 1}/{personTotalPages}</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setPersonPage(p => Math.max(0, p - 1))} disabled={personPage === 0} style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${T.line}`, background: T.surface, color: personPage === 0 ? T.inkSoft : T.olive700, cursor: personPage === 0 ? "not-allowed" : "pointer", fontSize: 10 }}>←</button>
            {Array.from({ length: Math.min(personTotalPages, 5) }, (_, i) => { const pg = personTotalPages <= 5 ? i : Math.max(0, Math.min(personTotalPages - 5, personPage - 2)) + i; return <button key={pg} onClick={() => setPersonPage(pg)} style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${pg === personPage ? T.olive600 : T.line}`, background: pg === personPage ? T.oliveSoft : T.surface, color: pg === personPage ? T.olive700 : T.inkMid, cursor: "pointer", fontSize: 10, fontWeight: pg === personPage ? 700 : 400 }}>{pg + 1}</button>; })}
            <button onClick={() => setPersonPage(p => Math.min(personTotalPages - 1, p + 1))} disabled={personPage === personTotalPages - 1} style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${T.line}`, background: T.surface, color: personPage === personTotalPages - 1 ? T.inkSoft : T.olive700, cursor: personPage === personTotalPages - 1 ? "not-allowed" : "pointer", fontSize: 10 }}>→</button>
          </div>
        </div>}
      </div>}

      {view === "graph" && <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.line}`, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 6 }}>Graphe d'intervention — personnes ↔ comptes</div>
        <div style={{ fontSize: 12.5, color: T.inkSoft, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>Vue graphe (nœuds cliquables, rebond de proximité) — port de parité consigné pour une prochaine session ; la vue Liste détaillée est complète.</div>
      </div>}

      {lierOpen && <div onClick={() => setLierOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,26,14,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: T.surface, borderRadius: 16, padding: 24, width: 440, maxWidth: "92vw", boxShadow: "0 24px 64px rgba(10,15,8,0.3)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 6 }}>＋ Lier une personne</div>
          <div style={{ fontSize: 11.5, color: T.inkSoft, lineHeight: 1.6, marginBottom: 14 }}>Rechercher (live) ou créer une personne, puis attribuer un ou plusieurs rôles cumulables issus du référentiel du service (homonymie signalée, miroir automatique). Popup complète (LierPersonnePopup) consignée pour une prochaine session.</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setLierOpen(false)} style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>Fermer</button>
          </div>
        </div>
      </div>}
    </div>);
}
