import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { VisaBadge } from "../../components/VisaBadge";
import { tokens } from "../../theme/tokens";

// Écran « Business Trip » (MOD-75, R222→R230 · FE-TRIP — étendu Bloc 63, repo R446–R452 + R465).
// Câblé au backend : liste/création/soumission (R222/R446 : activités + budget → chaîne résolue),
// avis cross-border qui ne décident pas (R223), guards à sévérité tenant surfacés tels que servis
// (R447 — le message serveur n'est jamais reformulé, FE-04), visa avec dérogation MOTIVÉE,
// certificat de trip (R450 : soumettre → validateur RÉSOLU, viser → clôture), rejeu à date (R48),
// registre §BusinessTrip avec pop-up d'engagement R445 (409 → payload exact du pop-up, jamais
// d'écriture sans confirmation).

type Trip = { id: string; status: string; dateStart: string; dateEnd: string; destinations: string[]; clients: string[]; revision: number };
type Advisory = { jurisdiction: string; activite: string; verdict: string; referentielVersion: string };
type Signal = { type: string; severite: string; detail: string };
type TripVisa = { role: string; status: string; signedBy?: string | null; signedAt?: string | null };
type Detail = Trip & { advisories: Advisory[]; signals: Signal[]; visas: TripVisa[] };
type Rejeu = { asOf: string; referentielVersion: string; parActivite: { jurisdiction: string; activite: string; verdict: string; position?: string }[] };
type PopupR445 = { cle: string; ancien: unknown; nouveau: unknown; portee: string; rappelReglementaire?: string };

export function BusinessTrip() {
  const { data: trips, isDemo, reload } = useApiOrSeed<Trip[]>("/v1/trips", []);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [dest, setDest] = useState(""); const [cli, setCli] = useState("");
  const [d1, setD1] = useState(""); const [d2, setD2] = useState("");
  const [acts, setActs] = useState(""); const [budget, setBudget] = useState("");
  const [motivation, setMotivation] = useState("");
  const [certNarratif, setCertNarratif] = useState(""); const [certEcart, setCertEcart] = useState("");
  const [certEtat, setCertEtat] = useState<{ validateurResolu: string; statut: string } | null>(null);
  const [rejeuDate, setRejeuDate] = useState(""); const [rejeu, setRejeu] = useState<Rejeu | null>(null);
  const [params, setParams] = useState<Record<string, unknown> | null>(null);
  const [popup, setPopup] = useState<{ p: PopupR445; cle: string; valeur: unknown; engagement: string } | null>(null);

  async function creer() {
    setMsg("");
    try {
      const t = await apiPost<Trip>("/v1/trips", {
        destinations: dest.split(",").map((x) => x.trim()).filter(Boolean),
        clients: cli.split(",").map((x) => x.trim()).filter(Boolean),
        activites: acts.split(",").map((x) => x.trim()).filter(Boolean),          // R446/R448 : le check porte SES activités
        ...(budget.trim() ? { budget: Number(budget) } : {}),
        dateStart: d1, dateEnd: d2 });
      await apiPost(`/v1/trips/${t.id}/submit`, {});
      setMsg("Voyage soumis."); reload();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function ouvrir(id: string) {
    setCertEtat(null); setRejeu(null);
    setDetail((await apiGetSourced<Detail | null>(`/v1/trips/${id}`, null)).data);
  }
  async function viser(id: string, role: string) {
    setMsg("");
    try {
      const r = await apiPost<{ status: string }>(`/v1/trips/${id}/visa`,
        { role, ...(motivation.trim() ? { motivation: motivation.trim() } : {}) });   // R447 : dérogation motivée
      setMsg(`Visa ${role} → ${r.status}`); setMotivation(""); ouvrir(id); reload();
    }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function soumettreCertificat(id: string) {
    setMsg("");
    try {
      const ecarts = certEcart.trim() ? [{ detail: certEcart.trim() }] : [];
      const r = await apiPost<{ validateurResolu: string; statut: string }>(`/v1/trips/${id}/certificat`,
        { narratif: certNarratif, ecarts, rencontres: [], activitesParJuridiction: {} });
      setCertEtat(r); setMsg(`Certificat soumis — validateur résolu : ${r.validateurResolu}`);
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function viserCertificat(id: string) {
    setMsg("");
    try { const r = await apiPost<{ statut: string }>(`/v1/trips/${id}/certificat/visa`, {});
      setCertEtat((c) => c ? { ...c, statut: r.statut } : { validateurResolu: "—", statut: r.statut });
      setMsg("Certificat visé — voyage clôturé."); ouvrir(id); reload(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function rejouer(id: string) {
    if (!rejeuDate) return;
    setRejeu((await apiGetSourced<Rejeu | null>(`/v1/trips/${id}/rejouer-check?asOf=${rejeuDate}`, null)).data);
  }
  async function chargerParams() {
    setParams((await apiGetSourced<Record<string, unknown> | null>("/v1/trips/params/registre", null)).data);
  }
  async function modifierGuard(cle: string, valeur: unknown, confirmation?: { engagementTexte: string; auteur: string }) {
    setMsg("");
    try {
      await apiPost("/v1/trips/params/modifier", { cle, valeur,
        enVigueurLe: new Date().toISOString().slice(0, 10), ...(confirmation ? { confirmation } : {}) });
      setPopup(null); setMsg(`Paramètre appliqué : ${cle}`); chargerParams();
    } catch (e) {
      const err = e as OliveError;
      if (err.code === "R445_CONFIRMATION_REQUISE" && err.popup)
        setPopup({ p: err.popup as unknown as PopupR445, cle, valeur, engagement: "" });   // AUCUNE écriture sans confirmation
      else setMsg(err.message ?? "Erreur");
    }
  }

  const verdictColor = (v: string) => v === "INTERDITE" ? tokens.color.danger : v === "SOUMISE_A_LICENCE" ? tokens.color.warn : tokens.color.ok;
  const statutColor = (s: string) => s === "APPROVED" ? tokens.color.ok : s === "CANCELLED" || s === "REJECTED" ? tokens.color.danger : tokens.color.warn;
  const inp = { padding: 6, borderRadius: 6, border: "1px solid #ccc", fontSize: 13 };
  const th = { padding: 6, textAlign: "left" as const };
  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>Business Trip — voyages d'affaires (R222→R230)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>L'avis cross-border s'affiche mais ne décide pas (R223) ;
      l'approbation est un visa uniforme (R225), jamais par le voyageur (R13). Contact reports mesurés, jamais imposés (R226).</p>
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <input style={{ ...inp, width: 180 }} placeholder="Destinations (FR,SA)" value={dest} onChange={(e) => setDest(e.target.value)}/>
      <input style={{ ...inp, width: 200 }} placeholder="Clients visités (ids)" value={cli} onChange={(e) => setCli(e.target.value)}/>
      <input style={{ ...inp, width: 160 }} placeholder="Activités (MEET,ADVICE)" value={acts} onChange={(e) => setActs(e.target.value)}/>
      <input style={{ ...inp, width: 110 }} placeholder="Budget CHF" value={budget} onChange={(e) => setBudget(e.target.value)}/>
      <input type="date" style={inp} value={d1} onChange={(e) => setD1(e.target.value)}/>
      <input type="date" style={inp} value={d2} onChange={(e) => setD2(e.target.value)}/>
      <button disabled={isDemoMode()} style={{ ...inp, cursor: "pointer", background: tokens.color.olive700, color: "#fff", border: "none" }} onClick={creer}>Créer & soumettre</button>
      <button style={{ ...inp, cursor: "pointer" }} onClick={chargerParams}>Registre §BusinessTrip (R452)</button>
    </div>

    {params && <div style={{ margin: "8px 0 12px", padding: 12, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.color.border}` }}>
      <h5 style={{ margin: "0 0 6px" }}>Sévérités des guards (R447) — toute modification passe par le pop-up d'engagement R445</h5>
      {Object.entries((params.guards ?? {}) as Record<string, string>).map(([g, sev]) => <div key={g} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 4 }}>
        <strong style={{ minWidth: 190 }}>{g}</strong>
        <select aria-label={`guard-${g}`} value={sev} disabled={isDemoMode()}
          onChange={(e) => modifierGuard(`guards.${g}`, e.target.value)}
          style={{ ...inp, padding: 4 }}>
          {["BLOQUANT", "AVERTISSEMENT", "DÉSACTIVÉ"].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>)}
    </div>}

    {popup && <div role="dialog" aria-label="engagement-r445" style={{ position: "fixed", inset: 0, background: "rgba(30,35,20,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 20, width: 480, boxShadow: "0 18px 60px rgba(0,0,0,0.25)" }}>
        <h4 style={{ margin: "0 0 8px" }}>⚠ Engagement de responsabilité (R445)</h4>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div><strong>Paramètre :</strong> {popup.p.cle}</div>
          <div><strong>Ancien :</strong> {String(popup.p.ancien)} → <strong>Nouveau :</strong> {String(popup.p.nouveau)}</div>
          <div><strong>Portée :</strong> {popup.p.portee}</div>
          {popup.p.rappelReglementaire && <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "#fdf3e2", color: "#8a6d1a", fontSize: 12, fontWeight: 600 }}>{popup.p.rappelReglementaire}</div>}
        </div>
        <textarea aria-label="engagement-texte" placeholder="Texte d'engagement (obligatoire)…" value={popup.engagement}
          onChange={(e) => setPopup({ ...popup, engagement: e.target.value })}
          style={{ ...inp, width: "100%", minHeight: 56, marginTop: 10, boxSizing: "border-box" }}/>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button style={{ ...inp, cursor: "pointer" }} onClick={() => setPopup(null)}>Annuler — aucune écriture</button>
          <button disabled={!popup.engagement.trim()} style={{ ...inp, cursor: "pointer", background: tokens.color.olive700, color: "#fff", border: "none" }}
            onClick={() => modifierGuard(popup.cle, popup.valeur, { engagementTexte: popup.engagement.trim(), auteur: "web-ui" })}>Je confirme — engagement tracé</button>
        </div>
      </div>
    </div>}

    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: tokens.font.sm }}>
      <thead><tr style={{ borderBottom: `2px solid ${tokens.color.olive700}` }}>
        <th style={th}>Destinations</th><th style={th}>Dates</th><th style={th}>Rév.</th><th style={th}>Statut</th></tr></thead>
      <tbody>
        {trips.map((t) => <tr key={t.id} onClick={() => ouvrir(t.id)} style={{ borderBottom: `1px solid ${tokens.color.border}`, cursor: "pointer" }}>
          <td style={{ padding: 6 }}>{(t.destinations ?? []).join(", ") || "—"}</td>
          <td>{t.dateStart} → {t.dateEnd}</td><td>V{t.revision}</td>
          <td><span style={{ color: statutColor(t.status), fontWeight: 700 }}>{t.status}</span></td>
        </tr>)}
        {!trips.length && <tr><td colSpan={4} style={{ padding: 6, color: tokens.color.muted }}>Aucun voyage.</td></tr>}
      </tbody>
    </table>

    {detail && <div style={{ marginTop: 16, padding: 14, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.color.border}` }}>
      <h4 style={{ margin: "0 0 8px" }}>Voyage V{detail.revision} <span style={{ fontSize: 12, color: tokens.color.muted }}>· {detail.status} · {detail.dateStart} → {detail.dateEnd}</span></h4>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Destinations & avis (R223)</h5>
          {detail.advisories.map((a, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
            <strong>{a.jurisdiction}</strong> · {a.activite} → <span style={{ color: verdictColor(a.verdict), fontWeight: 700 }}>{a.verdict}</span>
            <span style={{ color: tokens.color.muted }}> (réf. {a.referentielVersion})</span></div>)}
          {!detail.advisories.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun avis.</div>}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Signaux (R224/R228)</h5>
          {detail.signals.map((s, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: s.severite.startsWith("BLOQUANT") ? tokens.color.danger : tokens.color.warn, fontWeight: 700 }}>{s.type}</span>
            <span style={{ color: tokens.color.muted }}> · {s.detail}</span></div>)}
          {!detail.signals.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun signal.</div>}
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <h5 style={{ margin: "4px 0" }}>Visas d'approbation (R15/R225 — ordre de la chaîne R446)</h5>
          <input style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 6 }}
            placeholder="Motivation de dérogation (si avertissement — R447)"
            value={motivation} onChange={(e) => setMotivation(e.target.value)}/>
          {detail.visas.map((v, i) => <div key={i}>
            <VisaBadge visa={{ section: v.role, roleRequis: v.role, statut: v.status, signePar: v.signedBy, signeAt: v.signedAt }}/>
            {v.status === "PENDING" && <button disabled={isDemoMode()} style={{ ...inp, cursor: "pointer", background: tokens.color.gold, color: "#fff", border: "none", marginBottom: 6 }} onClick={() => viser(detail.id, v.role)}>Viser {v.role}</button>}
          </div>)}
          {!detail.visas.length && <div style={{ fontSize: 12, color: tokens.color.muted }}>Aucun visa.</div>}
        </div>
      </div>

      {(detail.status === "APPROVED" || detail.status === "COMPLETED") && <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${tokens.color.border}` }}>
        <h5 style={{ margin: "4px 0" }}>Certificat de trip (R450) — le RM certifie, le validateur résolu vise, le visa clôt (R13)</h5>
        {certEtat && <div style={{ fontSize: 12, marginBottom: 6 }}>
          Statut : <strong>{certEtat.statut}</strong> · validateur résolu : <strong>{certEtat.validateurResolu}</strong>
        </div>}
        <textarea aria-label="certificat-narratif" placeholder="Corps narratif — ce qui a réellement eu lieu…" value={certNarratif}
          onChange={(e) => setCertNarratif(e.target.value)} style={{ ...inp, width: "100%", minHeight: 52, boxSizing: "border-box" }}/>
        <input aria-label="certificat-ecart" style={{ ...inp, width: "100%", boxSizing: "border-box", margin: "6px 0" }}
          placeholder="Écart vs autorisation (vide = aucun → validateur MGR ; sinon → XB)"
          value={certEcart} onChange={(e) => setCertEcart(e.target.value)}/>
        <div style={{ display: "flex", gap: 8 }}>
          <button disabled={isDemoMode() || !certNarratif.trim()} style={{ ...inp, cursor: "pointer", background: tokens.color.olive700, color: "#fff", border: "none" }}
            onClick={() => soumettreCertificat(detail.id)}>Soumettre le certificat</button>
          <button disabled={isDemoMode()} style={{ ...inp, cursor: "pointer" }}
            onClick={() => viserCertificat(detail.id)}>Viser — clôturer le voyage</button>
        </div>
      </div>}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${tokens.color.border}` }}>
        <h5 style={{ margin: "4px 0" }}>Rejeu à date (R48) — le verdict d'époque, jamais recalculé</h5>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" aria-label="rejeu-date" style={inp} value={rejeuDate} onChange={(e) => setRejeuDate(e.target.value)}/>
          <button style={{ ...inp, cursor: "pointer" }} onClick={() => rejouer(detail.id)}>Rejouer le check</button>
        </div>
        {rejeu && <div style={{ fontSize: 12, marginTop: 6 }}>
          <div style={{ color: tokens.color.muted }}>Matrice en vigueur au {rejeu.asOf?.slice(0, 10)} : version <strong>{rejeu.referentielVersion}</strong></div>
          {rejeu.parActivite.map((l, i) => <div key={i}>
            <strong>{l.jurisdiction}</strong> · {l.activite} → <span style={{ fontWeight: 700 }}>{l.position ?? l.verdict}</span>
          </div>)}
        </div>}
      </div>
    </div>}
  </div>;
}
