import React, { useEffect, useState } from "react";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { BanniereCloture } from "../../components/BanniereCloture"; // R267/OF-10 — écran KYC
import { useConfirmGate } from "../../components/ConfirmValidation"; // contrat UX : confirmer + pré-vol

// Détail dossier : sections → questions (droits appliqués côté serveur),
// visas de section, validation four-eyes. Miroir produit de l'écran démo.
export function KycDetail({ code }: { code: string }) {
  const [kyc, setKyc] = useState<any>(null);
  const [procs, setProcs] = useState<any[]>([]);   // R23 — processes du dossier
  const [err, setErr] = useState("");
  const { ask, modal } = useConfirmGate();          // contrat UX : confirmation + pré-vol
  const base = (window as any).OLIVE_API_URL;
  const H = { "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("olive_jwt")}` };
  const load = () => fetch(`${base}/v1/kyc/${code}`, { headers: H })
    .then(r => r.json()).then(setKyc);
  const loadProcs = () => fetch(`${base}/v1/kyc/${code}/processes`, { headers: H })
    .then(r => r.ok ? r.json() : []).then((p) => setProcs(Array.isArray(p) ? p : [])).catch(() => setProcs([]));
  useEffect(() => { if (base) { load(); loadProcs(); } }, [code]);
  if (!base) return <DemoModeBanner/>;
  if (!kyc) return <p>Chargement…</p>;

  // R336/LK (lot 1) : les mutations de visa/validation portent If-Match (version attendue).
  // Un 409 concurrent_modification ⇒ JAMAIS d'écrasement silencieux : message + rechargement de
  // l'état à jour (le collaborateur reprend son action sur la version fraîche).
  async function call(path: string, method: string, body?: any, ifMatch?: number) {
    setErr("");
    const headers: Record<string, string> = ifMatch != null ? { ...H, "If-Match": String(ifMatch) } : { ...H };
    const r = await fetch(`${base}${path}`, { method, headers,
      body: body ? JSON.stringify(body) : undefined });
    if (r.status === 409) {
      const b = await r.json().catch(() => ({} as any));
      setErr(b?.error === "concurrent_modification"
        ? "Le dossier a été modifié entre-temps par un autre utilisateur — rechargement. Reprenez votre action sur la version à jour."
        : (b?.message ?? "Conflit de concurrence"));
      load();                                                        // recharge la version fraîche
      return;
    }
    if (!r.ok) setErr((await r.json()).message ?? "Erreur"); else { load(); loadProcs(); }
  }
  // R17/R19/R23 — actions cycle de vie (le back applique les gardes d'état ; l'UI grise selon kyc.status).
  const fige = !!kyc?.lectureSeule || kyc?.status === "SUSPENDED" || kyc?.status === "ABANDONED";
  const suspendable = ["IN_PROGRESS", "UNDER_REVIEW", "EN_MAJ"].includes(kyc?.status);
  // Pré-vol de validation finale (« tout est-il à valider ? ») — reconstruit de l'état chargé.
  const preflight = () => {
    const qManquantes = (kyc.sections ?? []).flatMap((s: any) => (s.questions ?? [])
      .filter((q: any) => q.right === "REQUIRED" && !q.answer).map((q: any) => q.label));
    const visasEnAttente = (kyc.visas ?? []).filter((v: any) => v.status !== "SIGNED");
    return [
      { label: qManquantes.length ? `${qManquantes.length} question(s) obligatoire(s) à renseigner` : "Questions obligatoires renseignées", ok: qManquantes.length === 0 },
      { label: visasEnAttente.length ? `${visasEnAttente.length} visa(s) de section à signer` : "Tous les visas de section signés", ok: visasEnAttente.length === 0 },
    ];
  };
  return <div>
    {modal}
    <BanniereCloture clientId={kyc.clientId}/>
    <h3>{kyc.code} — {kyc.workflow} · score {kyc.riskScore} · {kyc.status}</h3>
    {err && <p style={{ color: "#B5483C" }}>{err}</p>}
    {kyc.sections.map((s: any) => <div key={s.code} style={{ marginBottom: 14 }}>
      <h4>{s.label} {kyc.visas.filter((v: any) => v.sectionCode === s.code)
        .map((v: any) => <button key={v.requiredRole} disabled={v.status === "SIGNED"}
          onClick={() => call(`/v1/kyc/${code}/visas/${s.code}`, "POST", undefined, v.version)}
          style={{ marginLeft: 8, fontSize: 11 }}>
          {v.status === "SIGNED" ? `✓ visa ${v.requiredRole}` : `Signer (${v.requiredRole})`}</button>)}
      </h4>
      {s.questions.map((q: any) => <div key={q.code} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
        <span style={{ width: 380, fontSize: 13 }}>{q.label}</span>
        <input defaultValue={q.answer ?? ""} disabled={q.right !== "EDIT" && q.right !== "REQUIRED"}
          onBlur={e => e.target.value !== (q.answer ?? "") &&
            call(`/v1/kyc/${code}/questions/${q.code}`, "PATCH", { answer: e.target.value })}
          style={{ flex: 1, padding: 6, borderRadius: 6,
            border: "1px solid #ccc", fontSize: 12 }}/>
        <span style={{ fontSize: 10, color: "#888", width: 70 }}>{q.right}</span>
      </div>)}
    </div>)}
    <button onClick={() => ask({ title: "Validation finale (four-eyes)",
        message: "Vérifiez que le dossier est complet avant d'engager la validation.",
        items: preflight(), blockIfIncomplete: true, confirmLabel: "Valider le dossier",
        onConfirm: () => call(`/v1/kyc/${code}/validate`, "POST", undefined, kyc.version) })}
      disabled={kyc.status === "VALIDATED" || fige}
      style={{ padding: "10px 18px", background: "#4A6B28", color: "#fff",
        border: "none", borderRadius: 8, cursor: "pointer" }}>
      Validation finale (four-eyes)</button>

    {/* R17/R19/R23 — cycle de vie du dossier (Lot B) */}
    <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #e5e5e5" }}>
      <h4 style={{ margin: "0 0 8px" }}>Cycle de vie du dossier</h4>
      {fige && <p style={{ fontSize: 12, color: "#B5483C", margin: "0 0 8px" }}>
        Dossier {kyc.status === "SUSPENDED" ? "suspendu" : kyc.status === "ABANDONED" ? "abandonné" : "en lecture seule"} — écriture métier gelée (R17/R20).
        {kyc.status === "SUSPENDED" && kyc.restrictions &&
          ` Opérations : entrées ${kyc.restrictions.entrees ? "autorisées" : "gelées"}, sorties ${kyc.restrictions.sorties ? "autorisées" : "gelées"}.`}
      </p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suspendable && <button onClick={() => ask({ title: "Suspendre le dossier (R17)", danger: true,
            message: "Les opérations et l'écriture métier seront gelées jusqu'à réactivation.",
            input: { label: "Cause de la suspension", placeholder: "ex. alerte AML", required: true }, confirmLabel: "Suspendre",
            onConfirm: (cause) => call(`/v1/kyc/${code}/suspendre`, "POST", { cause }) })}
          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #B5483C", background: "#fff", color: "#B5483C", cursor: "pointer" }}>Suspendre</button>}
        {kyc.status === "IN_PROGRESS" && <button onClick={() => ask({ title: "Abandonner le dossier (R19)", danger: true,
            message: "Le dossier passera en préparation abandonnée (réactivable).",
            input: { label: "Motif d'abandon", placeholder: "ex. inactivité", required: true }, confirmLabel: "Abandonner",
            onConfirm: (motif) => call(`/v1/kyc/${code}/abandonner`, "POST", { motif }) })}
          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #888", background: "#fff", cursor: "pointer" }}>Abandonner</button>}
        {(kyc.status === "ABANDONED" || kyc.status === "SUSPENDED") && <button onClick={() => ask({ title: "Réactiver le dossier (R19)",
            message: "Le dossier repasse en préparation active.", confirmLabel: "Réactiver",
            onConfirm: () => call(`/v1/kyc/${code}/reactiver`, "POST") })}
          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #4A6B28", background: "#fff", color: "#4A6B28", cursor: "pointer" }}>Réactiver</button>}
        {kyc.status === "VALIDATED" && <button onClick={() => ask({ title: "Ouvrir une recertification (R23)",
            message: "Un événement de risque ultérieur la mettrait en pause (priorité).", confirmLabel: "Ouvrir",
            onConfirm: () => call(`/v1/kyc/${code}/processes`, "POST", { type: "recertification" }) })}
          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #4A6B28", background: "#fff", color: "#4A6B28", cursor: "pointer" }}>Ouvrir une recertification (R23)</button>}
        {(kyc.visas ?? []).some((v: any) => v.status === "PENDING") && <button onClick={() => ask({ title: "Geler les visas sur hit (R46)", danger: true,
            message: "Les visas en attente sont gelés le temps de l'analyse du hit ; le comité tranchera.",
            input: { label: "Référence du hit", placeholder: "ex. HIT-2026-0007", required: true }, confirmLabel: "Geler",
            onConfirm: (hit) => call(`/v1/kyc/${code}/geler-hit`, "POST", { hit }) })}
          style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #B5483C", background: "#fff", color: "#B5483C", cursor: "pointer" }}>Geler sur hit (R46)</button>}
        {(kyc.visas ?? []).some((v: any) => v.status === "GELE") && <>
          <button onClick={() => ask({ title: "Décision comité — poursuite (R46)",
            message: "Les visas gelés sont dégelés et l'instruction reprend.",
            input: { label: "Référence du hit", placeholder: "ex. HIT-2026-0007", required: true }, confirmLabel: "Poursuivre",
            onConfirm: (hit) => call(`/v1/kyc/${code}/comite`, "POST", { hit, decision: "poursuite" }) })}
            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #4A6B28", background: "#fff", color: "#4A6B28", cursor: "pointer" }}>Comité : poursuivre</button>
          <button onClick={() => ask({ title: "Décision comité — offboarding (R46)", danger: true,
            message: "Un offboarding est proposé ; les visas restent gelés.",
            input: { label: "Référence du hit", placeholder: "ex. HIT-2026-0007", required: true }, confirmLabel: "Proposer l'offboarding",
            onConfirm: (hit) => call(`/v1/kyc/${code}/comite`, "POST", { hit, decision: "offboarding" }) })}
            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #B5483C", background: "#fff", color: "#B5483C", cursor: "pointer" }}>Comité : offboarding</button>
        </>}
      </div>
      {procs.length > 0 && <table style={{ marginTop: 10, borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ textAlign: "left", color: "#888" }}><th style={{ padding: "2px 12px 2px 0" }}>Process</th><th style={{ padding: "2px 12px" }}>État</th><th style={{ padding: "2px 12px" }}>Ouvert le</th></tr></thead>
        <tbody>{procs.map((p: any) => <tr key={p.id}>
          <td style={{ padding: "2px 12px 2px 0" }}>{p.type}</td>
          <td style={{ padding: "2px 12px" }}>{p.etat}</td>
          <td style={{ padding: "2px 12px", color: "#888" }}>{String(p.ouvertLe ?? "").slice(0, 10)}</td>
        </tr>)}</tbody>
      </table>}
    </div>
  </div>;
}
