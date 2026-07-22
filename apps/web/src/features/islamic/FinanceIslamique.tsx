import React, { useState } from "react";
import { isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";

// Onglet « Finance Islamique » (Bloc 49, R207→R221) — adaptation minimale (option Ali).
// Deux vues concrètes : le calcul de Zakat (R211) et l'évaluation Shariah d'une opération
// (screening R207/R209/…). Les seuils (nisab, taux, secteurs haram) vivent au registre R-Q
// (clés `islamic*`). La porte d'écriture reste le service — l'onglet ne décide de rien.

type ZakatResp = { _demo?: boolean; zakatDue?: number; taux?: string; status?: string; nisab?: number };
type Signal = { regle: string; type: string };
type ScreenResp = { _demo?: boolean; bloque?: boolean; signaux?: Signal[] };

const apiBase = (): string | undefined => (window as unknown as { OLIVE_API_URL?: string }).OLIVE_API_URL;

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = apiBase();
  if (!base) return { _demo: true } as T;
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({})) as Promise<T>;
}

export function FinanceIslamique() {
  const [clientId, setClientId] = useState("");
  const [patrimoine, setPatrimoine] = useState("500000");
  const [zakat, setZakat] = useState<ZakatResp | null>(null);
  const [secteur, setSecteur] = useState("ALCOOL");
  const [screening, setScreening] = useState<ScreenResp | null>(null);
  const inp = { padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 13 };
  const btn = { ...inp, cursor: "pointer", background: "#4A6B28", color: "#fff", border: "none" };

  async function calculerZakat() {
    setZakat(await post<ZakatResp>("/v1/islamic/zakat", { clientId, patrimoineChf: Number(patrimoine) }));
  }
  async function evaluer() {
    setScreening(await post<ScreenResp>("/v1/islamic/evaluer", {
      clientId, clientIslamic: true, transactions: [{ montantChf: 5000, secteurBeneficiaire: secteur }] }));
  }

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Finance Islamique — conformité Shariah (R207→R221)</h3>
    <p style={{ color: "#666", fontSize: 13 }}>
      Le moteur signale et calcule ; il ne décide jamais seul. Seul le maysir (R209) bloque.
      Seuils au registre R-Q (nisab, taux Zakat, secteurs haram).</p>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0" }}>
      <input style={inp} placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}/>
    </div>

    <fieldset style={{ marginBottom: 14, border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
      <legend style={{ fontWeight: 600 }}>Zakat annuelle (R211)</legend>
      <input style={inp} value={patrimoine} onChange={(e) => setPatrimoine(e.target.value)} placeholder="Patrimoine CHF"/>
      <button style={{ ...btn, marginLeft: 8 }} onClick={calculerZakat}>Calculer</button>
      {zakat && !zakat._demo && <div style={{ marginTop: 8, fontSize: 13 }}>
        Zakat due : <b>{zakat.zakatDue} CHF</b> ({zakat.taux}) — statut {zakat.status} (nisab {zakat.nisab})</div>}
    </fieldset>

    <fieldset style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
      <legend style={{ fontWeight: 600 }}>Screening d'opération (R207/R209/…)</legend>
      <select style={inp} value={secteur} onChange={(e) => setSecteur(e.target.value)}>
        {["ALCOOL", "JEUX", "CASINO", "PORC", "TEXTILE", "SANTE"].map((x) => <option key={x}>{x}</option>)}
      </select>
      <button style={{ ...btn, marginLeft: 8 }} onClick={evaluer}>Évaluer</button>
      {screening && !screening._demo && <div style={{ marginTop: 8, fontSize: 13 }}>
        {screening.bloque ? "⛔ Bloqué" : "⚠ Signalé"} — {(screening.signaux ?? []).map((s) => `${s.regle} ${s.type}`).join(", ") || "aucun signal"}</div>}
    </fieldset>
  </div>;
}
