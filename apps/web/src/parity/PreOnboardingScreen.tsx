import React, { useState } from "react";
import { T } from "./tokens";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";
import { PROSPECT_LEADS, markLeadDecision, PENDING } from "./prospection-support";
import { runPreOnboardingCheck, ocrExtract, DOC_STRUCTURES } from "./preonboarding-support";

// pushParamAudit : piste d'audit (hors périmètre front) → no-op.
const pushParamAudit = (_actor: string, _msg: string) => {};

// Source : docs/reference/olive-demo.html 21163–21266 — porté verbatim.
export function PreOnboardingScreen({ user, goTo }: { user?: any; goTo?: (s: string) => void }) {
  const [linkedLeadId, setLinkedLeadId] = useState<string>(function () { const id = PENDING.testLeadId; PENDING.testLeadId = null; return id || ""; });
  const linkedLead = linkedLeadId ? PROSPECT_LEADS.find(function (l) { return l.id === linkedLeadId; }) : null;
  const [name, setName] = useState<string>(function () { return linkedLead ? linkedLead.name : ""; });
  const [countryCode, setCountryCode] = useState("CH");
  const [type, setType] = useState("PP");
  const [pep, setPep] = useState(false);
  const [sector, setSector] = useState<string>(function () { return linkedLead ? linkedLead.sector : ""; });
  const [aum, setAum] = useState("");
  const [ocrDocType, setOcrDocType] = useState("Passeport");
  const [ocrDone, setOcrDone] = useState(false);
  const [, bump] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _re = function () { bump(function (x) { return x + 1; }); };
  void setLinkedLeadId;
  const OCR_DOC_TYPES = ["Passeport", "Carte d'identité", "Registre du commerce", "Justificatif de domicile"];
  const runOcr = function () {
    const ex = ocrExtract(ocrDocType, name);
    if (ex.name) setName(ex.name);
    if (ex.countryCode) setCountryCode(ex.countryCode);
    if (ex.type) setType(ex.type);
    setOcrDone(true);
    pushParamAudit((user && user.name) || "RM", "OCR (simulation) — extraction depuis " + ocrDocType);
  };
  const COUNTRIES = [["CH", "🇨🇭 Suisse"], ["FR", "🇫🇷 France"], ["DE", "🇩🇪 Allemagne"], ["GB", "🇬🇧 Royaume-Uni"], ["KY", "🇰🇾 Cayman Islands"], ["PA", "🇵🇦 Panama"], ["MC", "🇲🇨 Monaco"], ["AE", "🇦🇪 EAU"], ["RU", "🇷🇺 Russie"], ["KP", "🇰🇵 Corée du Nord"], ["IR", "🇮🇷 Iran"], ["SY", "🇸🇾 Syrie"], ["CU", "🇨🇺 Cuba"], ["US", "🇺🇸 États-Unis"], ["SG", "🇸🇬 Singapour"]];
  const pseudo = { name, countryCode, type, pep, sector, aumM: parseFloat(aum) || 0 };
  const res = runPreOnboardingCheck(pseudo);
  const verdictCol = res.verdict === "BLOCKED" ? T.red : res.verdict === "CONDITIONAL" ? T.amber : T.green;
  const verdictBg = res.verdict === "BLOCKED" ? T.redSoft : res.verdict === "CONDITIONAL" ? T.amberSoft : T.greenSoft;
  const verdictLbl = res.verdict === "BLOCKED" ? "NON ONBOARDABLE" : res.verdict === "CONDITIONAL" ? "ONBOARDABLE SOUS CONDITIONS" : "ONBOARDABLE";
  const card: any = { background: T.surface, border: "1px solid " + T.line, borderRadius: 14, padding: 18 };
  const inp: any = { padding: "9px 12px", borderRadius: 9, border: "1px solid " + T.line, fontSize: 12.5, width: "100%", boxSizing: "border-box" };
  const lbl: any = { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 };
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: T.olive700, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>Pré-KYC — sans friction</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{(SCREEN_LABEL as any).preonboarding}</div>
        <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Quelques informations suffisent pour un verdict immédiat, avant d'engager le client dans un KYC complet. Aucune donnée n'est enregistrée — outil de décision rapide pour le RM.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "10px 12px", background: T.oliveSoft + "55", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: T.olive700 }}>📄 OCR (simulation)</span>
              <select value={ocrDocType} onChange={function (e) { setOcrDocType(e.target.value); }} style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid " + T.line, fontSize: 10.5 }}>{OCR_DOC_TYPES.map(function (d) { return <option key={d} value={d}>{d}</option>; })}</select>
              <button onClick={runOcr} style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: T.olive600, color: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}>Extraire →</button>
              {ocrDone && <span style={{ fontSize: 9.5, color: T.green, fontWeight: 700 }}>✓ Champs pré-remplis</span>}
              <span style={{ fontSize: 9, color: T.inkSoft, width: "100%" }}>Extraction simulée à des fins de démonstration — connexion à un moteur OCR réel en Phase 2.</span>
            </div>
            <div>
              <div style={lbl}>Nom (optionnel)</div>
              <input value={name} onChange={function (e) { setName(e.target.value); }} placeholder="ex. Riviera Holding" style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={lbl}>Pays / juridiction</div>
                <select value={countryCode} onChange={function (e) { setCountryCode(e.target.value); }} style={inp}>{COUNTRIES.map(function (c) { return <option key={c[0]} value={c[0]}>{c[1]}</option>; })}</select>
              </div>
              <div>
                <div style={lbl}>Structure</div>
                <select value={type} onChange={function (e) { setType(e.target.value); }} style={inp}>{DOC_STRUCTURES.map(function (st) { return <option key={st.id} value={st.id}>{st.name}</option>; })}</select>
              </div>
            </div>
            <div>
              <div style={lbl}>Secteur d'activité</div>
              <input value={sector} onChange={function (e) { setSector(e.target.value); }} placeholder="ex. crypto, négoce, technologie…" style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={lbl}>AUM estimé (CHF M)</div>
                <input value={aum} onChange={function (e) { setAum(e.target.value); }} placeholder="ex. 2.5" style={inp} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, cursor: "pointer", fontSize: 12.5, color: T.inkMid }}>
                <input type="checkbox" checked={pep} onChange={function (e) { setPep(e.target.checked); }} style={{ accentColor: T.olive600 }} />
                Client PEP
              </label>
            </div>
          </div>
        </div>
        <div>
          <div style={{ ...card, background: verdictBg, border: "1.5px solid " + verdictCol, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: verdictCol, textTransform: "uppercase", letterSpacing: 0.5 }}>Verdict</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: verdictCol, marginTop: 2 }}>{verdictLbl}</div>
            <div style={{ fontSize: 11, color: T.inkMid, marginTop: 6 }}>{res.hits.length === 0 ? "Aucune règle déclenchée sur les informations saisies." : res.hits.length + " règle(s) déclenchée(s)."}</div>
          </div>
          {res.hits.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Quoi faire pour rendre le dossier onboardable</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {res.hits.map(function (r) {
                  return (
                    <div key={r.id} style={{ borderLeft: "3px solid " + (r.severity === "BLOCK" ? T.red : T.amber), paddingLeft: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", background: T.lineSoft, padding: "1px 6px", borderRadius: 4 }}>{r.jurisdiction}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: r.severity === "BLOCK" ? T.red : T.amber }}>{r.severity === "BLOCK" ? "BLOQUANT" : "CONDITIONNEL"}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.ink, fontWeight: 600 }}>{r.message}</div>
                      <div style={{ fontSize: 11, color: T.inkMid, marginTop: 2 }}>→ {r.action}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {linkedLead && (
            <div style={{ marginTop: 10, padding: "12px 14px", background: T.cream, borderRadius: 10, border: "1px solid " + T.line }}>
              <div style={{ fontSize: 11, color: T.inkMid, marginBottom: 10 }}>Test lié au prospect <strong style={{ color: T.ink }}>{linkedLead.name}</strong> ({linkedLead.identifiedBy === "IA" ? "identifié par IA" : "identifié par RM"}). Seuls les prospects avec un <strong>GO</strong> peuvent passer à l'étape « Prospect à onboarder ».</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={function () { markLeadDecision(linkedLead.id, "GO", user); if (goTo) goTo("prospect_contact"); }} disabled={res.verdict === "BLOCKED"} style={{ flex: 1, padding: "9px 14px", borderRadius: 9, border: "none", background: res.verdict === "BLOCKED" ? T.line : T.green, color: "#fff", fontSize: 12, fontWeight: 800, cursor: res.verdict === "BLOCKED" ? "not-allowed" : "pointer", opacity: res.verdict === "BLOCKED" ? 0.6 : 1 }}>✓ Marquer GO — autoriser l'onboarding</button>
                <button onClick={function () { markLeadDecision(linkedLead.id, "NO_GO", user); if (goTo) goTo("prospect_contact"); }} style={{ flex: 1, padding: "9px 14px", borderRadius: 9, border: "1px solid " + T.red, background: T.surface, color: T.red, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Marquer NO-GO</button>
              </div>
            </div>
          )}
          {!linkedLead && res.verdict !== "BLOCKED" && <div style={{ fontSize: 10.5, color: T.inkSoft, marginTop: 10 }}>Prochaine étape : {res.verdict === "OK" ? "lancer directement l'onboarding complet." : "lever les conditions ci-dessus, puis lancer l'onboarding complet."} Un prospect testé depuis l'écran « Prospect à contacter » peut recevoir un GO ici pour être autorisé à l'onboarding.</div>}
        </div>
      </div>
    </div>
  );
}
