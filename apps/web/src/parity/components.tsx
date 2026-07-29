import React, { useEffect, useState } from "react";
import { T } from "./tokens";

// ─── Composants partagés — PORT VERBATIM de docs/reference/olive-demo.html §4
// (lignes 13099–13279). « À porter EN PREMIER : tout le reste en dépend. »
// Purs (sans dépendance de données) : SevPill, Badge, KpiCard, StatsToggle,
// Donut, SectionTitle + nomenclatures de statut KYC + colonnes configurables.
// RiskFactorsList / ScorePopover dépendent de evalAmlRules → portés avec les écrans.

// SevPill (13099)
export function SevPill({ sev }: { sev: string }) {
  const map: Record<string, [string, string]> = {
    LOW: [T.green, T.greenSoft], MEDIUM: [T.amber, T.amberSoft], HIGH: [T.amber, T.amberSoft], CRITICAL: [T.red, T.redSoft],
  };
  const [c, bg] = map[sev] || [T.inkSoft, T.lineSoft];
  return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: bg, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.5 }}>{sev}</span>;
}

// Badge (13104)
export function Badge({ text, color, bg }: { text: React.ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: "3px 10px", borderRadius: 6 }}>{text}</span>;
}

// KpiCard (13107)
export function KpiCard({ label, value, sub, trend, color, icon }: { label: string; value: React.ReactNode; sub?: string; trend?: number | null; color: string; icon?: string }) {
  return (
    <div style={{ background: T.surface, borderRadius: 12, padding: "15px 17px", border: `1px solid ${T.line}`, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ fontSize: 12, color, opacity: 0.8, lineHeight: 1 }}>{icon}</span>}
        <span style={{ fontSize: 10, color: T.inkSoft, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: T.ink, letterSpacing: -0.4 }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
        {trend != null && <span style={{ fontSize: 10.5, fontWeight: 700, color: trend > 0 ? T.green : T.red }}>{trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%</span>}
        <span style={{ fontSize: 10.5, color: T.inkSoft }}>{sub}</span>
      </div>
    </div>);
}

// StatsToggle (13123) — décision produit (B.6) : retourne null. Les 9 écrans
// appelants gardent l'appel ; les KPI d'écran vivent dans Accueil → onglet 📊 KPI.
export function StatsToggle(_props: { children?: React.ReactNode; label?: string }) {
  return null;
}

// Donut (13158)
export function Donut({ value, max = 100, size = 120, stroke = 12, showLabel = true }: { value: number; max?: number; size?: number; stroke?: number; showLabel?: boolean }) {
  const color = value >= 60 ? T.red : value >= 30 ? T.amber : T.green;
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, pct = Math.min(value / max, 1);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.lineSoft} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1.2s ease" }} />
      </svg>
      {showLabel && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size > 80 ? 32 : 16, fontWeight: 800, color: T.ink, lineHeight: 1 }}>{value}</span>
        {size > 80 && <span style={{ fontSize: 10, color: T.inkSoft, marginTop: 2 }}>/ 100</span>}
      </div>}
    </div>);
}

// SectionTitle (13169)
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{children}</div>
      {right}
    </div>);
}

// ─── Nomenclatures de statut KYC (13246–13257) — VERBATIM
export const KYC_STATUS_STYLE: Record<string, [string, string]> = {
  APPROVED: [T.green, T.greenSoft], IN_PROGRESS: [T.gold, T.amberSoft], UNDER_REVIEW: [T.amber, T.amberSoft],
  PENDING_APPROVAL: [T.olive600, T.oliveSoft], DRAFT: [T.inkSoft, T.lineSoft], REJECTED: [T.red, T.redSoft],
};
export const KYC_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Approuvé", IN_PROGRESS: "En cours", UNDER_REVIEW: "En revue",
  PENDING_APPROVAL: "Att. approbation", DRAFT: "Brouillon", REJECTED: "Rejeté",
};

// ─── Colonnes configurables des listes (13259–13279) — VERBATIM
export const LIST_COLS: Record<string, Record<string, boolean>> = {
  kycs: { "Code KYC": true, "Client": true, "Structure": true, "Rév.": false, "Workflow": true, "Score": true, "Statut": true, "RM": true, "Créé le": false },
  clients: { "Client": true, "ID": false, "Structure": true, "Segment": true, "AUM": true, "Pays": true, "Risque": true, "Score": false, "KYC": true },
};
const COL_RENAME: Record<string, Record<string, string>> = {};
export const colOn = (list: string, h: string) => !LIST_COLS[list] || LIST_COLS[list][h] !== false;
export const colLabel = (list: string, h: string) => (COL_RENAME[list] && COL_RENAME[list][h]) || h;

// ColsBtn (13266) — bouton ⚙ Colonnes + menu de bascule (audit paramétrage retiré du port UI-pur).
export function ColsBtn({ list, onChange }: { list: string; onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{ padding: "7px 13px", borderRadius: 8, border: `1px solid ${open ? T.olive600 : T.line}`, background: open ? T.oliveSoft : T.surface, color: open ? T.olive700 : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>⚙ Colonnes</button>
      {open && <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 60, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, boxShadow: "0 12px 32px rgba(10,15,8,0.18)", padding: 10, minWidth: 190 }}>
        {Object.keys(LIST_COLS[list]).map(h => {
          const on = LIST_COLS[list][h] !== false;
          return <button key={h} onClick={() => { LIST_COLS[list][h] = !on; bump(x => x + 1); onChange?.(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${on ? T.olive600 : T.line}`, background: on ? T.oliveSoft : T.surface, color: T.olive700, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>
            <span style={{ fontSize: 11.5, color: on ? T.ink : T.inkSoft, fontWeight: on ? 600 : 400 }}>{h}</span>
          </button>;
        })}
        <div style={{ fontSize: 9.5, color: T.inkSoft, padding: "6px 8px 2px", borderTop: `1px solid ${T.lineSoft}`, marginTop: 4 }}>Aussi paramétrable : Admin → Écrans &amp; visibilité</div>
      </div>}
    </div>);
}

// ─── Annexe B.1 — Modale plein écran standard. Trois teintes de backdrop EXACTES
// selon le contexte (la plus fréquente d'abord). Clic backdrop = fermeture ;
// stopPropagation sur la carte ; croix ✕ en haut à droite.
export const MODAL_BACKDROP = {
  olive: "rgba(20,26,14,0.55)", // la plus fréquente (9 occurrences)
  ink50: "rgba(10,15,8,0.5)",
  ink45: "rgba(10,15,8,0.45)",
} as const;
export function Modal({ backdrop = MODAL_BACKDROP.olive, width = 480, onClose, children }:
  { backdrop?: string; width?: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: backdrop, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", background: T.surface, borderRadius: 14, border: `1.5px solid ${T.line}`, boxShadow: "0 24px 60px rgba(34,38,28,.28)", width, maxWidth: "94vw", maxHeight: "90vh", overflowY: "auto", padding: "22px 24px" }}>
        <button onClick={onClose} aria-label="Fermer" style={{ position: "absolute", top: 14, right: 16, border: "none", background: "transparent", fontSize: 16, color: T.inkSoft, cursor: "pointer", padding: 0 }}>✕</button>
        {children}
      </div>
    </div>);
}

// ─── Annexe B.1 (famille 3) — OliveInfo : info rétractable. PORT VERBATIM (44125–44154).
// Ligne discrète + bouton « i » ; au clic, popup plein écran (backdrop rgba(34,38,28,.35),
// zIndex 10005), fermeture par clic backdrop, croix ✕ OU touche Escape.
export function OliveInfo({ titre, texte, extra }: { titre: React.ReactNode; texte: React.ReactNode; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open]);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: T.oliveSoft, border: `1px solid ${T.line}`, borderRadius: 10, marginBottom: 12 }}>
        <button onClick={() => setOpen(true)} title="En savoir plus" style={{ width: 22, height: 22, borderRadius: 11, border: `1.5px solid ${T.olive600}`, background: "#fff", color: T.olive700, fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0, lineHeight: "18px", padding: 0 }}>i</button>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.olive700 }}>{titre}</span>
        {extra || null}
      </div>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10005, background: "rgba(34,38,28,.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", background: "#fff", borderRadius: 14, border: `1.5px solid ${T.line}`, boxShadow: "0 24px 60px rgba(34,38,28,.28)", padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: T.olive700, flex: 1 }}>{titre}</span>
            <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", color: T.inkSoft, fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.75 }}>{texte}</div>
        </div>
      </div>}
    </div>);
}

// ─── Annexe B.2 — Bloc repliable ▸/▾ (accordéon inline, PAS une modale). Convention
// systématique : chevron ▸ (fermé) / ▾ (ouvert) + libellé qui change. `variant` reproduit
// les deux styles canoniques : « bordé » (bouton blanc radius 8) et « nu » (sans fond).
export function Collapsible({ labelClosed, labelOpen, defaultOpen = false, variant = "nu", color = T.olive700, children }:
  { labelClosed: string; labelOpen: string; defaultOpen?: boolean; variant?: "nu" | "borde"; color?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const base: React.CSSProperties = variant === "borde"
    ? { border: `1px solid ${T.line}`, background: T.surface, borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 10.5 }
    : { border: "none", background: "none", padding: 0, fontWeight: 700, fontSize: 11.5 };
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ ...base, color, cursor: "pointer" }}>
        {open ? "▾ " : "▸ "}{open ? labelOpen : labelClosed}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>);
}

// OliveNote (44444) — petite note « i » repliable (PORT VERBATIM).
export function OliveNote({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const pastille = <button onClick={() => setOpen(!open)} title={open ? "Replier" : "En savoir plus"}
    style={{ width: 20, height: 20, borderRadius: 10, border: `1.5px solid ${T.olive600}`, background: "#fff", color: T.olive700, fontSize: 11, fontWeight: 800, cursor: "pointer", flexShrink: 0, lineHeight: "16px", padding: 0 }}>i</button>;
  if (!open)
    return <div onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px", background: T.oliveSoft, borderRadius: 9, marginTop: 8, cursor: "pointer" }}>
      {pastille}<span style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 700 }}>Info</span></div>;
  return <div style={{ display: "flex", alignItems: "flex-start", gap: 8, ...style }}>{pastille}<div style={{ flex: 1 }}>{children}</div></div>;
}
