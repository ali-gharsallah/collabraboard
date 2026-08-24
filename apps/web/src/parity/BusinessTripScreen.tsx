import React, { useState, useEffect } from "react";
import { T } from "./tokens";
import { Badge, SectionTitle } from "./components";
import { cbCountry, CB_ACTIVITIES, CB_V_META } from "./cross-border-support";
import { BUSINESS_TRIPS, XB_C, TRIP_ST, SOLIC, DEST_QUOTAS_SEED, RM_OVERRIDES_SEED, INDIGITA_DB, IND_C, ROLE_GATE } from "./trip-support";

// Source : docs/reference/olive-demo.html 43065-43421 — BusinessTripScreen (MOD-75 Business Trip :
// demandes de voyage, circuit d'approbation multi-rôles, quotas destination/RM, vérification
// cross-border Indigita, compte-rendu). Porté verbatim. `user`/`onNewProspect` optionnels.

export default function BusinessTripScreen({ user = { name: "Sophie Marchand", role: "CO", roleLabel: "Compliance Officer" }, onNewProspect }:
  { user?: any; onNewProspect?: (p: any) => void } = {}) {
  const [tab, setTab] = useState("trips"); // trips | quotas
  const [trips, setTrips] = useState<any[]>(BUSINESS_TRIPS.map((t: any) => ({ ...t, report: t.report || "", reportDate: t.reportDate || null })));
  const [sel, setSel] = useState(BUSINESS_TRIPS[0].id);
  const [quotas, setQuotas] = useState<any[]>(DEST_QUOTAS_SEED);
  const [overrides, setOverrides] = useState<any[]>(RM_OVERRIDES_SEED);
  const [indigita, setIndigita] = useState<any>({});
  const [reportDraft, setReportDraft] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const RM_LIST = [...new Set([...(user ? [user.name] : []), ...trips.map((t: any) => t.rm)])];
  const blankDraft = { rm: (user && user.name) || trips[0].rm, code: "FR", city: "", from: "", to: "", purpose: "Visite clientèle", clients: "", budget: "", newClient: false, extName: "", extType: "PP" };
  const [draft, setDraft] = useState<any>(blankDraft);
  const deriveFromCode = (code: string) => { const st = (INDIGITA_DB[code] || {}).status; if (st === "BLOQUÉ")
    return { xbRisk: "HIGH", solicitation: "forbidden" }; if (st === "CONDITIONNEL")
    return { xbRisk: "MEDIUM", solicitation: "conditional" }; return { xbRisk: "LOW", solicitation: "allowed" }; };
  const nextTripId = () => { const nums = trips.map((t: any) => parseInt((t.id.match(/(\d+)$/) || ["", "0"])[1], 10)); return "BT-2026-" + String(Math.max(0, ...nums) + 1).padStart(3, "0"); };
  const draftValid = !!(draft.rm && draft.code && draft.from && draft.to && draft.from <= draft.to && (!draft.newClient || (draft.extName || "").trim()));
  const addTrip = () => {
    if (!draftValid)
      return;
    const q = quotas.find((c: any) => c.code === draft.code) || quotas[0];
    const der = deriveFromCode(draft.code);
    const lic = /Requise/.test((INDIGITA_DB[draft.code] || {}).lic || "");
    const id = nextTripId();
    const baseClients = draft.clients ? draft.clients.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    if (draft.newClient && (draft.extName || "").trim())
      baseClients.unshift(draft.extName.trim());
    const trip = { id, rm: draft.rm, city: draft.city || q.country, country: q.country, countryCode: q.code, flag: q.flag, from: draft.from, to: draft.to, purpose: draft.purpose, clients: baseClients, status: "PENDING", xbRisk: der.xbRisk, licenceRequired: lic, solicitation: der.solicitation, budget: draft.budget || "CHF —", approvals: [{ role: "RM", label: "Demande RM", state: "done" }, { role: "MGR", label: "Responsable d'équipe", state: "current" }, { role: "XB", label: "Compliance Cross-Border", state: "pending" }, { role: "HPB", label: "Head of Private Banking", state: "pending" }], report: "", reportDate: null };
    if (draft.newClient && (draft.extName || "").trim() && onNewProspect) {
      const nm = draft.extName.trim();
      const TL: any = { PP: "Personne physique", SA: "Société opérationnelle (SA)", SARL: "Société (SARL/GmbH)", HOLD: "Holding", TRUST: "Trust", FOND: "Fondation", FO: "Family Office", FUND: "Fonds de placement" };
      const rnd = Math.floor(1000 + Math.random() * 9000);
      const ini = (nm.split(" ").filter(Boolean).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()) || "NC";
      const docs = ["Formulaire CDB", "Contrat d'ouverture de compte", "Conditions générales", "Profil investisseur (LSFin)", "Pièce d'identité certifiée", "Justificatif de domicile", "Auto-certification CRS / FATCA"].map((l) => ({ label: l, present: true, signed: false }));
      const prospect = { id: "PRO-9" + rnd, name: nm, initials: ini, type: draft.extType, typeLabel: TL[draft.extType] || "Personne physique", country: q.country, countryCode: q.code, countryFlag: q.flag, segment: "Affluent", aum: "CHF —", sector: "—", rm: draft.rm, score: 0, risk: "LOW", ddl: "SDD", cdbForm: (draft.extType === "PP" ? "A" : "K"), uboName: nm, firstKyc: { code: "KYC-2026-" + q.code + "-" + rnd + "-R1", status: "IN_PROGRESS" }, docs: docs, createdAt: new Date().toISOString().slice(0, 10), external: true, source: "Business Trip" };
      onNewProspect(prospect);
    }
    setTrips((ts: any[]) => [trip, ...ts]);
    setSel(id);
    setTab("trips");
    setNewOpen(false);
  };
  const NT_INP: any = { width: "100%", padding: "9px 11px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, color: T.ink, boxSizing: "border-box", outline: "none", background: T.cream, fontFamily: "inherit" };
  const NTField = ({ label, children, full }: any) => (React.createElement("div", { style: { gridColumn: full ? "1 / -1" : "auto" } },
    React.createElement("label", { style: { fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 5 } }, label),
    children));
  const trip = trips.find((t: any) => t.id === sel) || trips[0];
  useEffect(() => { setReportDraft((trips.find((t: any) => t.id === sel) || {}).report || ""); }, [sel]);
  const tripDays = (t: any) => { const a = new Date(t.from) as any, b = new Date(t.to) as any; return Math.max(1, Math.round((b - a) / 86400000) + 1); };
  const bankAllow = (code: string) => (quotas.find((q: any) => q.code === code) || {}).bankDays || 0;
  const rmAllow = (rm: string, code: string) => { const o = overrides.find((x: any) => x.rm === rm && x.code === code); return o ? o.days : bankAllow(code); };
  const consumedBank = (code: string) => trips.filter((t: any) => t.countryCode === code && t.status === "APPROVED").reduce((s: number, t: any) => s + tripDays(t), 0);
  const consumedRM = (rm: string, code: string) => trips.filter((t: any) => t.rm === rm && t.countryCode === code && t.status === "APPROVED").reduce((s: number, t: any) => s + tripDays(t), 0);
  // ── Workflow ──
  const approve = (id: string) => setTrips((ts: any[]) => ts.map((t: any) => {
    if (t.id !== id)
      return t;
    const idx = t.approvals.findIndex((a: any) => a.state === "current");
    if (idx < 0)
      return t;
    const approvals = t.approvals.map((a: any, i: number) => i === idx ? { ...a, state: "done" } : (i === idx + 1 && a.state === "pending" ? { ...a, state: "current" } : a));
    const allDone = approvals.every((a: any) => a.state === "done");
    return { ...t, approvals, status: allDone ? "APPROVED" : "PENDING" };
  }));
  const reject = (id: string) => setTrips((ts: any[]) => ts.map((t: any) => {
    if (t.id !== id)
      return t;
    const approvals = t.approvals.map((a: any) => a.state === "current" ? { ...a, state: "alert" } : a);
    return { ...t, approvals, status: "REJECTED" };
  }));
  const saveReport = () => setTrips((ts: any[]) => ts.map((t: any) => t.id === sel ? { ...t, report: reportDraft, reportDate: new Date().toISOString().slice(0, 10) } : t));
  const runIndigita = (t: any) => setIndigita((m: any) => ({ ...m, [t.id]: INDIGITA_DB[t.countryCode] || { status: "CONDITIONNEL", solic: "À vérifier", lic: "À vérifier", contact: "À vérifier", prod: "À vérifier" } }));
  const curStep = trip.approvals.find((a: any) => a.state === "current");
  const canAct = curStep && (!user || (ROLE_GATE[curStep.role] || []).includes(user.role));
  const sol = SOLIC[trip.solicitation]; void sol;
  const ind = indigita[trip.id];
  return (React.createElement("div", null,
    React.createElement("div", { style: { display: "flex", gap: 4, marginBottom: 18, background: T.surface, padding: 5, borderRadius: 12, border: `1px solid ${T.line}`, width: "fit-content" } }, [["trips", "Voyages"], ["quotas", "Paramétrage quotas"]].map(([k, l]) => (React.createElement("button", { key: k, onClick: () => setTab(k), style: { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === k ? T.olive600 : "transparent", color: tab === k ? "#fff" : T.inkMid, fontSize: 13, fontWeight: tab === k ? 700 : 500 } }, l)))),
    tab === "trips" && (React.createElement("div", null,
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "380px 1fr", gap: 18 } },
        React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 18, border: `1px solid ${T.line}` } },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
            React.createElement(SectionTitle, null, "Demandes de voyage"),
            React.createElement("button", { onClick: () => { setDraft(blankDraft); setNewOpen(true); }, style: { padding: "6px 12px", borderRadius: 8, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" } }, "+ Nouvelle")),
          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, trips.map((t: any) => {
            const st = TRIP_ST[t.status];
            const on = t.id === sel;
            return (React.createElement("div", { key: t.id, onClick: () => setSel(t.id), style: { padding: "11px 13px", borderRadius: 11, border: `1.5px solid ${on ? T.olive600 : T.line}`, background: on ? T.oliveSoft : T.cream, cursor: "pointer" } },
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
                React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: T.ink } }, t.flag, " ", t.city),
                React.createElement(Badge, { text: st.l, color: (T as any)[st.c], bg: (T as any)[st.bg] })),
              React.createElement("div", { style: { fontSize: 11.5, color: T.inkSoft, marginTop: 3 } }, t.rm, " · ", t.purpose, " · ", tripDays(t), "j"),
              React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 } },
                React.createElement("span", { style: { fontSize: 11, color: T.inkSoft, fontFamily: "monospace" } }, t.from, " → ", t.to),
                React.createElement("span", { style: { fontSize: 10, fontWeight: 700, color: (T as any)[XB_C[t.xbRisk]], background: (T as any)[XB_C[t.xbRisk]] + "18", padding: "2px 7px", borderRadius: 5 } }, "X-BORDER ", t.xbRisk))));
          }))),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
          React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 22, border: `1px solid ${T.line}` } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" } },
              React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 1 } }, trip.id),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: T.ink, marginTop: 4 } }, trip.flag, " ", trip.city, " ",
                  React.createElement("span", { style: { fontSize: 14, fontWeight: 500, color: T.inkSoft } }, "· ", trip.country)),
                React.createElement("div", { style: { fontSize: 13, color: T.inkMid, marginTop: 4 } }, trip.rm, " · ", trip.purpose, " · ",
                  React.createElement("span", { style: { fontFamily: "monospace" } }, trip.from, " → ", trip.to), " · ",
                  React.createElement("b", null, tripDays(trip), " jours"))),
              React.createElement(Badge, { text: TRIP_ST[trip.status].l, color: (T as any)[TRIP_ST[trip.status].c], bg: (T as any)[TRIP_ST[trip.status].bg] })),
            trip.clients.length > 0 && (React.createElement("div", { style: { marginTop: 14 } },
              React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 } }, "Clients visités"),
              React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } }, trip.clients.map((c: string) => React.createElement("span", { key: c, style: { fontSize: 12, padding: "4px 10px", borderRadius: 7, background: T.cream, border: `1px solid ${T.line}`, color: T.ink } }, c)))))),
          (() => {
            const code = trip.countryCode;
            const ba = bankAllow(code), ra = rmAllow(trip.rm, code), cb = consumedBank(code), cr = consumedRM(trip.rm, code);
            const over = cr > ra;
            return (React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 20, border: `1px solid ${over ? T.red + "55" : T.line}` } },
              React.createElement(SectionTitle, null, "Quota — année glissante (12 mois)"),
              React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 } },
                React.createElement("div", { style: { padding: "12px 14px", borderRadius: 10, background: T.cream, border: `1px solid ${T.line}` } },
                  React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, "Plafond banque · ", trip.country),
                  React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: T.ink, marginTop: 4 } }, cb, " / ", ba, " jours"),
                  React.createElement("div", { style: { height: 6, background: T.line, borderRadius: 3, marginTop: 6, overflow: "hidden" } },
                    React.createElement("div", { style: { height: "100%", width: `${Math.min(100, cb / Math.max(ba, 1) * 100)}%`, background: cb > ba ? T.red : T.leaf } }))),
                React.createElement("div", { style: { padding: "12px 14px", borderRadius: 10, background: over ? T.redSoft : T.cream, border: `1px solid ${over ? T.red + "44" : T.line}` } },
                  React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, "Plafond RM · ", trip.rm),
                  React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: over ? T.red : T.ink, marginTop: 4 } }, cr, " / ", ra, " jours"),
                  React.createElement("div", { style: { height: 6, background: T.line, borderRadius: 3, marginTop: 6, overflow: "hidden" } },
                    React.createElement("div", { style: { height: "100%", width: `${Math.min(100, cr / Math.max(ra, 1) * 100)}%`, background: over ? T.red : T.olive600 } })))),
              over && React.createElement("div", { style: { marginTop: 10, fontSize: 12, color: T.red, fontWeight: 600 } }, "⚠ Quota RM dépassé pour cette destination — dérogation Compliance requise."),
              (function () {
                if (!draft.code)
                  return null;
                const cbc = cbCountry(draft.code);
                if (!cbc)
                  return React.createElement("div", { style: { marginTop: 10, padding: "9px 12px", borderRadius: 9, background: T.amberSoft, fontSize: 11, color: T.inkMid } }, "🌐 ", draft.code, " hors country manual Cross-Border — analyse Legal requise avant le voyage.");
                const acts = draft.purpose === "Prospection" ? ["PROSP", "MKT"] : draft.purpose === "Visite clientèle" ? ["MEET", "ADVICE"] : ["MEET"];
                const lines = acts.map(function (a: string) { const r = cbc.rules[a]; return { l: CB_ACTIVITIES.find(function (x: any) { return x.code === a; }).label, v: r[0], n: r[1] }; });
                const hasNon = lines.some(function (x: any) { return x.v === "NON"; });
                return (React.createElement("div", { style: { marginTop: 10, padding: "10px 13px", borderRadius: 9, background: hasNon ? T.redSoft : T.cream, border: "1px solid " + T.lineSoft } },
                  React.createElement("div", { style: { fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", marginBottom: 5 } }, "🌐 Cross-border — ", cbc.flag, " ", cbc.country, " · ", cbc.regime),
                  lines.map(function (x: any, i: number) {
                    const m = CB_V_META[x.v];
                    return (React.createElement("div", { key: i, style: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, padding: "2px 0" } },
                      React.createElement("span", { style: { fontSize: 8.5, fontWeight: 800, color: m[1], background: (T as any)[m[2]], padding: "2px 7px", borderRadius: 8, width: 60, textAlign: "center", flexShrink: 0 } }, m[0]),
                      React.createElement("span", { style: { fontWeight: 600, color: T.ink, width: 170, flexShrink: 0 } }, x.l),
                      React.createElement("span", { style: { color: T.inkSoft } }, x.n || "—")));
                  }),
                  hasNon && React.createElement("div", { style: { marginTop: 5, fontSize: 10.5, fontWeight: 700, color: T.red } }, "⛔ Activité interdite dans cette juridiction — adapter le motif du voyage ou obtenir la clearance Compliance (écran Cross-Border).")));
              })()));
          })(),
          React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 20, border: `1px solid ${T.line}` } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 } },
              React.createElement(SectionTitle, null, "Vérification cross-border · Indigita"),
              React.createElement("button", { onClick: () => runIndigita(trip), style: { padding: "7px 13px", borderRadius: 9, border: `1.5px solid ${T.blue}`, background: ind ? T.surface : T.blue, color: ind ? T.blue : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" } }, ind ? "↻ Relancer" : "Lancer Indigita")),
            !ind ? React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginTop: 10 } }, "Lancez la vérification pour obtenir le verdict cross-border (sollicitation, licence, produits, type de contact) de la juridiction ", trip.country, ".")
              : (() => {
                const ic = (T as any)[IND_C[ind.status]];
                return (React.createElement("div", { style: { marginTop: 12 } },
                  React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: "#fff", background: ic, padding: "4px 12px", borderRadius: 7 } }, ind.status),
                    React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } }, "Indigita · règles ", trip.country, " · profil banque privée")),
                  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, [["Sollicitation", ind.solic], ["Licence locale", ind.lic], ["Type de contact", ind.contact], ["Produits", ind.prod]].map(([k, v]) => (React.createElement("div", { key: k, style: { padding: "10px 12px", borderRadius: 9, background: T.cream, border: `1px solid ${T.line}` } },
                    React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 } }, k),
                    React.createElement("div", { style: { fontSize: 12.5, color: T.ink, marginTop: 3, fontWeight: 600 } }, v)))))));
              })()),
          React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 20, border: `1px solid ${T.line}` } },
            React.createElement(SectionTitle, null, "Circuit d'approbation"),
            React.createElement("div", { style: { display: "flex", alignItems: "flex-start", marginTop: 14 } }, trip.approvals.map((a: any, i: number, arr: any[]) => {
              const col = a.state === "done" ? T.green : a.state === "current" ? T.gold : a.state === "alert" ? T.red : T.inkSoft;
              return (React.createElement("div", { key: a.role, style: { display: "flex", alignItems: "flex-start", flex: i < arr.length - 1 ? 1 : "none" } },
                React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 104 } },
                  React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: a.state === "pending" ? T.surface : col, border: a.state === "pending" ? `2px solid ${T.line}` : "none", color: a.state === "pending" ? T.inkSoft : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 } }, a.state === "done" ? "✓" : a.state === "alert" ? "✕" : i + 1),
                  React.createElement("span", { style: { fontSize: 10.5, fontWeight: 600, color: a.state === "pending" ? T.inkSoft : T.ink, textAlign: "center", lineHeight: 1.3 } }, a.label),
                  a.state === "current" && React.createElement(Badge, { text: "EN COURS", color: T.gold, bg: T.amberSoft })),
                i < arr.length - 1 && React.createElement("div", { style: { flex: 1, height: 3, background: a.state === "done" ? T.green : T.line, margin: "16px 4px 0", borderRadius: 2 } })));
            })),
            curStep && trip.status !== "APPROVED" && trip.status !== "REJECTED" && (React.createElement("div", { style: { marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}` } },
              React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, marginBottom: 10 } }, "Action attendue : ",
                React.createElement("b", { style: { color: T.ink } }, curStep.label), " · réservé aux rôles ", (ROLE_GATE[curStep.role] || []).join(", "),
                user ? ` · connecté : ${user.roleLabel || user.role}` : ""),
              React.createElement("div", { style: { display: "flex", gap: 10 } },
                React.createElement("button", { disabled: !canAct, onClick: () => approve(trip.id), style: { padding: "9px 16px", borderRadius: 9, border: "none", background: canAct ? T.olive600 : T.line, color: canAct ? "#fff" : T.inkSoft, fontSize: 13, fontWeight: 700, cursor: canAct ? "pointer" : "not-allowed" } }, curStep.role === "XB" ? "Valider (Compliance) →" : curStep.role === "HPB" ? "Approbation finale ✓" : "Approuver →"),
                React.createElement("button", { disabled: !canAct, onClick: () => reject(trip.id), style: { padding: "9px 16px", borderRadius: 9, border: `1px solid ${canAct ? T.red : T.line}`, background: T.surface, color: canAct ? T.red : T.inkSoft, fontSize: 13, fontWeight: 700, cursor: canAct ? "pointer" : "not-allowed" } }, "Refuser")),
              !canAct && React.createElement("div", { style: { fontSize: 11, color: T.amber, marginTop: 8 } }, "Votre rôle ne permet pas de valider cette étape (démo : connectez-vous avec un Compliance Officer pour l'étape cross-border)."))),
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}` } },
              React.createElement("span", { style: { fontSize: 12, color: T.inkSoft } }, "Budget estimé · notes de frais"),
              React.createElement("span", { style: { fontSize: 16, fontWeight: 800, color: T.ink } }, trip.budget))),
          React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 20, border: `1px solid ${T.line}` } },
            React.createElement(SectionTitle, null, "Compte-rendu de voyage"),
            React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, margin: "4px 0 10px" } }, "Au retour, le RM documente le déroulement : clients rencontrés, sujets abordés, opportunités, points de conformité."),
            React.createElement("textarea", { value: reportDraft, onChange: (e: any) => setReportDraft(e.target.value), placeholder: "Décrire le voyage et son compte-rendu…", style: { width: "100%", minHeight: 96, padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.line}`, fontSize: 13, color: T.ink, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", background: T.cream } }),
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 } },
              React.createElement("span", { style: { fontSize: 11, color: T.inkSoft } }, trip.reportDate ? `Dernier dépôt : ${trip.reportDate}` : "Aucun compte-rendu déposé"),
              React.createElement("button", { onClick: saveReport, disabled: !reportDraft.trim(), style: { padding: "8px 15px", borderRadius: 9, border: "none", background: reportDraft.trim() ? T.olive600 : T.line, color: reportDraft.trim() ? "#fff" : T.inkSoft, fontSize: 12.5, fontWeight: 700, cursor: reportDraft.trim() ? "pointer" : "not-allowed" } }, "Enregistrer le compte-rendu"))))))),
    tab === "quotas" && (React.createElement("div", null,
      React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 22, border: `1px solid ${T.line}`, marginBottom: 16 } },
        React.createElement(SectionTitle, null, "Plafonds banque — jours par destination (année glissante)"),
        React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, margin: "4px 0 14px" } }, "Nombre maximal de jours de présence autorisés par destination sur 12 mois glissants, au niveau de la banque. La consommation agrège les voyages approuvés."),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: "0 16px", alignItems: "center", fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 8, borderBottom: `1px solid ${T.line}` } },
          React.createElement("span", null, "Destination"),
          React.createElement("span", null, "Jours / an"),
          React.createElement("span", null, "Consommé (banque)")),
        quotas.map((q: any, i: number) => {
          const cb = consumedBank(q.code);
          const over = cb > q.bankDays;
          return (React.createElement("div", { key: q.code, style: { display: "grid", gridTemplateColumns: "1fr 120px 1fr", gap: "0 16px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.lineSoft}` } },
            React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: T.ink } }, q.flag, " ", q.country),
            React.createElement("input", { type: "number", value: q.bankDays, onChange: (e: any) => { const v = parseInt(e.target.value) || 0; setQuotas((qs: any[]) => qs.map((x: any, j: number) => j === i ? { ...x, bankDays: v } : x)); }, style: { width: 80, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, color: T.ink, outline: "none" } }),
            React.createElement("span", { style: { display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: over ? T.red : T.ink } }, cb, " j"),
              React.createElement("span", { style: { flex: 1, maxWidth: 160, height: 6, background: T.line, borderRadius: 3, overflow: "hidden" } },
                React.createElement("span", { style: { display: "block", height: "100%", width: `${Math.min(100, cb / Math.max(q.bankDays, 1) * 100)}%`, background: over ? T.red : T.leaf } })))));
        })),
      React.createElement("div", { style: { background: T.surface, borderRadius: 14, padding: 22, border: `1px solid ${T.line}` } },
        React.createElement(SectionTitle, null, "Surcharges par RM"),
        React.createElement("div", { style: { fontSize: 12, color: T.inkSoft, margin: "4px 0 14px" } }, "Plafond spécifique à un RM pour une destination, prioritaire sur le plafond banque."),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.4fr 1fr 120px 1fr", gap: "0 16px", alignItems: "center", fontSize: 10, fontWeight: 700, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, paddingBottom: 8, borderBottom: `1px solid ${T.line}` } },
          React.createElement("span", null, "RM"),
          React.createElement("span", null, "Destination"),
          React.createElement("span", null, "Jours / an"),
          React.createElement("span", null, "Consommé (RM)")),
        overrides.map((o: any, i: number) => {
          const q = quotas.find((x: any) => x.code === o.code) || { country: o.code, flag: "" };
          const cr = consumedRM(o.rm, o.code);
          const over = cr > o.days;
          return (React.createElement("div", { key: o.rm + o.code, style: { display: "grid", gridTemplateColumns: "1.4fr 1fr 120px 1fr", gap: "0 16px", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.lineSoft}` } },
            React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: T.ink } }, o.rm),
            React.createElement("span", { style: { fontSize: 13, color: T.inkMid } }, q.flag, " ", q.country),
            React.createElement("input", { type: "number", value: o.days, onChange: (e: any) => { const v = parseInt(e.target.value) || 0; setOverrides((os: any[]) => os.map((x: any, j: number) => j === i ? { ...x, days: v } : x)); }, style: { width: 80, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, color: T.ink, outline: "none" } }),
            React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: over ? T.red : T.ink } }, cr, " j ", over ? "⚠" : "")));
        }),
        React.createElement("div", { style: { fontSize: 11, color: T.inkSoft, marginTop: 12 } }, "Les modifications sont appliquées à la volée dans cette démo (non persistées). En production : table ",
          React.createElement("span", { style: { fontFamily: "monospace" } }, "business_trip_quota"), " par tenant.")))),
    newOpen && (React.createElement("div", { onClick: () => setNewOpen(false), style: { position: "fixed", inset: 0, background: "rgba(10,15,8,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9000, padding: 20 } },
      React.createElement("div", { onClick: (e: any) => e.stopPropagation(), style: { background: T.surface, borderRadius: 16, width: 580, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", border: `1px solid ${T.line}` } },
        React.createElement("div", { style: { padding: "20px 24px 14px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" } },
          React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: T.olive700, textTransform: "uppercase", letterSpacing: 1 } }, "Business Trip"),
            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: T.ink, marginTop: 4 } }, "Nouvelle demande de voyage")),
          React.createElement("button", { onClick: () => setNewOpen(false), style: { border: "none", background: "none", fontSize: 20, color: T.inkSoft, cursor: "pointer" } }, "×")),
        React.createElement("div", { style: { padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 } },
          React.createElement(NTField, { label: "RM demandeur" },
            React.createElement("select", { value: draft.rm, onChange: (e: any) => setDraft((d: any) => ({ ...d, rm: e.target.value })), style: NT_INP }, RM_LIST.map((r) => React.createElement("option", { key: r, value: r }, r)))),
          React.createElement(NTField, { label: "Destination" },
            React.createElement("select", { value: draft.code, onChange: (e: any) => setDraft((d: any) => ({ ...d, code: e.target.value })), style: NT_INP }, quotas.map((q: any) => React.createElement("option", { key: q.code, value: q.code }, q.flag, " ", q.country)))),
          React.createElement(NTField, { label: "Ville (optionnel)" },
            React.createElement("input", { value: draft.city, onChange: (e: any) => setDraft((d: any) => ({ ...d, city: e.target.value })), placeholder: "Ville", style: NT_INP })),
          React.createElement(NTField, { label: "Motif" },
            React.createElement("select", { value: draft.purpose, onChange: (e: any) => setDraft((d: any) => ({ ...d, purpose: e.target.value })), style: NT_INP }, ["Visite clientèle", "Prospection", "Conférence", "Due diligence", "Roadshow"].map((o) => React.createElement("option", { key: o, value: o }, o)))),
          React.createElement(NTField, { label: "Date de départ" },
            React.createElement("input", { type: "date", value: draft.from, onChange: (e: any) => setDraft((d: any) => ({ ...d, from: e.target.value })), style: NT_INP })),
          React.createElement(NTField, { label: "Date de retour" },
            React.createElement("input", { type: "date", value: draft.to, onChange: (e: any) => setDraft((d: any) => ({ ...d, to: e.target.value })), style: NT_INP })),
          React.createElement(NTField, { label: "Clients visités (séparés par des virgules)", full: true },
            React.createElement("input", { value: draft.clients, onChange: (e: any) => setDraft((d: any) => ({ ...d, clients: e.target.value })), placeholder: "Client A, Client B", style: NT_INP })),
          React.createElement(NTField, { label: "Budget estimé" },
            React.createElement("input", { value: draft.budget, onChange: (e: any) => setDraft((d: any) => ({ ...d, budget: e.target.value })), placeholder: "CHF 0", style: NT_INP })),
          React.createElement(NTField, { label: "Client rencontré en voyage", full: true },
            React.createElement("label", { style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.ink, cursor: "pointer", padding: "8px 10px", borderRadius: 8, border: `1px solid ${draft.newClient ? T.olive600 : T.line}`, background: draft.newClient ? T.oliveSoft : T.cream } },
              React.createElement("input", { type: "checkbox", checked: !!draft.newClient, onChange: (e: any) => setDraft((d: any) => ({ ...d, newClient: e.target.checked })) }),
              "Nouveau client externe (ni prospect ni client existant) → créer un prospect + premier KYC d'onboarding")),
          draft.newClient && React.createElement(NTField, { label: "Nom / raison sociale du nouveau client", full: true },
            React.createElement("input", { value: draft.extName, onChange: (e: any) => setDraft((d: any) => ({ ...d, extName: e.target.value })), placeholder: "Ex. Meridian Global SA", style: NT_INP })),
          draft.newClient && React.createElement(NTField, { label: "Type de client" },
            React.createElement("select", { value: draft.extType, onChange: (e: any) => setDraft((d: any) => ({ ...d, extType: e.target.value })), style: NT_INP }, [["PP", "Personne physique"], ["SA", "Société (SA)"], ["SARL", "Société (SARL/GmbH)"], ["HOLD", "Holding"], ["TRUST", "Trust"], ["FOND", "Fondation"], ["FO", "Family Office"], ["FUND", "Fonds de placement"]].map(([v, l]) => React.createElement("option", { key: v, value: v }, l))))),
        React.createElement("div", { style: { padding: "0 24px 4px", display: "flex", flexDirection: "column", gap: 6 } },
          draft.from && draft.to && draft.from > draft.to && React.createElement("div", { style: { fontSize: 12, color: T.red, fontWeight: 600 } }, "⚠ La date de retour doit être postérieure ou égale au départ."),
          (() => { const st = (INDIGITA_DB[draft.code] || {}).status || "CONDITIONNEL"; const ic = (T as any)[IND_C[st] || "amber"]; const q = quotas.find((c: any) => c.code === draft.code) || {}; return React.createElement("div", { style: { fontSize: 12, color: T.inkSoft } }, "Pré-évaluation cross-border ", q.flag, " ", q.country, " : ",
            React.createElement("b", { style: { color: ic } }, st), " — Indigita à relancer après création."); })()),
        React.createElement("div", { style: { padding: "14px 24px 20px", borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "flex-end", gap: 10 } },
          React.createElement("button", { onClick: () => setNewOpen(false), style: { padding: "10px 16px", borderRadius: 9, border: `1px solid ${T.line}`, background: T.surface, color: T.inkMid, fontSize: 13, fontWeight: 600, cursor: "pointer" } }, "Annuler"),
          React.createElement("button", { disabled: !draftValid, onClick: addTrip, style: { padding: "10px 18px", borderRadius: 9, border: "none", background: draftValid ? T.olive600 : T.line, color: draftValid ? "#fff" : T.inkSoft, fontSize: 13, fontWeight: 700, cursor: draftValid ? "pointer" : "not-allowed" } }, "Créer la demande →")))))));
}
