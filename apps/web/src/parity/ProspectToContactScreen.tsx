import React, { useState } from "react";
import { T } from "./tokens";
import { prospectionSuggest, addProspectLead, PROSPECT_LEADS, PENDING } from "./prospection-support";

// Source : docs/reference/olive-demo.html 13924–14000 — porté verbatim.
export function ProspectToContactScreen({ user, goTo }: { user?: any; goTo: (s: string) => void }) {
  const [, bump] = useState(0);
  const re = function () { bump(function (x) { return x + 1; }); };
  const [mName, setMName] = useState("");
  const [mCountry, setMCountry] = useState("Suisse");
  const [mSector, setMSector] = useState("");
  const [mNote, setMNote] = useState("");
  const suggestions = prospectionSuggest().slice(0, 5);
  const addManual = function () {
    if (!mName.trim()) return;
    addProspectLead({ name: mName.trim(), country: mCountry, countryFlag: ({ Suisse: "🇨🇭", France: "🇫🇷", Allemagne: "🇩🇪", "Royaume-Uni": "🇬🇧", Italie: "🇮🇹", EAU: "🇦🇪", Monaco: "🇲🇨", Luxembourg: "🇱🇺" } as any)[mCountry] || "🏳", sector: mSector.trim() || "—", note: mNote.trim() || "Ajouté manuellement par le RM.", suggestedRm: (user && user.name) || "—" }, "RM", user);
    setMName("");
    setMSector("");
    setMNote("");
    re();
  };
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 18 };
  const STATUS_STYLE: any = { PENDING: [T.inkSoft, T.lineSoft, "À tester"], GO: [T.green, T.greenSoft, "GO — onboardable"], NO_GO: [T.red, T.redSoft, "NO-GO"] };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Prospect — stade 1</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>Prospect à contacter</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Futurs prospects identifiés par un RM ou par l'IA, en provenance du module prospection. Aucune relation bancaire, aucun KYC. Rien n'est créé tant que la décision d'onboarder n'est pas prise.</div>
      </div>
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Module prospection</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: T.olive700, background: T.oliveSoft, padding: "2px 8px", borderRadius: 10 }}>MOD-72</span>
        </div>
        <div style={{ fontSize: 10.5, color: T.inkSoft, marginBottom: 14 }}>Deux canaux d'identification : suggestion IA (Olivia — réseau des relations existantes, déterministe et explicable) et ajout manuel RM.</div>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.violet, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>✦ Suggestions IA — personnes du réseau sans relation en nom propre</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {suggestions.map(function (sg) {
            return (
              <div key={sg.personId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid " + T.lineSoft, borderRadius: 10, background: T.cream }}>
                <span style={{ fontSize: 11, fontWeight: 800, fontFamily: "monospace", color: T.violet, background: T.violetSoft, padding: "3px 8px", borderRadius: 7, flexShrink: 0 }}>{sg.aiScore}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{sg.countryFlag} {sg.name}</span>
                    {sg.pepFlag && <span style={{ fontSize: 8.5, fontWeight: 700, color: sg.pep === "PEP" ? T.red : T.amber, background: sg.pep === "PEP" ? T.redSoft : T.amberSoft, padding: "1px 7px", borderRadius: 10 }}>{sg.pepFlag}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: T.inkSoft, marginTop: 1 }}>{sg.rationale}</div>
                </div>
                <span style={{ fontSize: 9.5, color: T.inkSoft, whiteSpace: "nowrap" }}>RM suggéré : {sg.suggestedRm}</span>
                <button onClick={function () { addProspectLead(sg, "IA", user); re(); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + T.violet, background: T.surface, color: T.violet, fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>＋ Ajouter au pipeline</button>
              </div>
            );
          })}
          {suggestions.length === 0 && <div style={{ fontSize: 11, color: T.inkSoft, fontStyle: "italic" }}>Aucune suggestion — tout le réseau exploitable est déjà dans le pipeline ou client.</div>}
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: T.olive700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>＋ Ajout manuel (RM)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={mName} onChange={function (e) { setMName(e.target.value); }} placeholder="Nom du prospect…" style={{ flex: "2 1 180px", padding: "8px 11px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11.5 }} />
          <select value={mCountry} onChange={function (e) { setMCountry(e.target.value); }} style={{ padding: "8px 11px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11.5 }}>
            {["Suisse", "France", "Allemagne", "Royaume-Uni", "Italie", "EAU", "Monaco", "Luxembourg"].map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
          <input value={mSector} onChange={function (e) { setMSector(e.target.value); }} placeholder="Secteur" style={{ flex: "1 1 120px", padding: "8px 11px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11.5 }} />
          <input value={mNote} onChange={function (e) { setMNote(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") addManual(); }} placeholder="Note (origine du contact…)" style={{ flex: "3 1 200px", padding: "8px 11px", borderRadius: 8, border: "1px solid " + T.line, fontSize: 11.5 }} />
          <button onClick={addManual} disabled={!mName.trim()} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: mName.trim() ? T.olive600 : T.line, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: mName.trim() ? "pointer" : "not-allowed" }}>Ajouter</button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {PROSPECT_LEADS.map(function (lead) {
          const sty = STATUS_STYLE[lead.onboardableStatus] || STATUS_STYLE.PENDING;
          return (
            <div key={lead.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: T.lineSoft, color: T.inkMid, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{lead.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{lead.countryFlag} {lead.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: lead.identifiedBy === "IA" ? T.violet : T.blue, background: (lead.identifiedBy === "IA" ? T.violet : T.blue) + "18", padding: "2px 8px", borderRadius: 20 }}>{lead.identifiedBy === "IA" ? "✦ Identifié par IA" : "👤 Identifié par RM"}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, color: sty[0], background: sty[1], padding: "2px 8px", borderRadius: 20 }}>{sty[2]}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 2 }}>{lead.note}</div>
                </div>
                <span style={{ fontSize: 10, color: T.inkSoft, whiteSpace: "nowrap" }}>{lead.rm}</span>
                {lead.onboardableStatus === "GO"
                  ? <button onClick={function () { PENDING.onboardName = lead.name; goTo("prospect_onboard"); }} style={{ padding: "7px 13px", borderRadius: 8, border: "1px solid " + T.olive600, background: T.olive600, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>→ Démarrer l'onboarding</button>
                  : <button onClick={function () { PENDING.testLeadId = lead.id; goTo("prospect_test"); }} style={{ padding: "7px 13px", borderRadius: 8, border: "1px solid " + T.olive600, background: T.surface, color: T.olive700, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>→ Tester l'onboardabilité</button>}
              </div>
            </div>
          );
        })}
        {PROSPECT_LEADS.length === 0 && <div style={{ fontSize: 11.5, color: T.inkSoft, fontStyle: "italic" }}>Aucun prospect à contacter pour l'instant.</div>}
      </div>
    </div>
  );
}
