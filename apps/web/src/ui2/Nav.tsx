import React from "react";
import "./tokens.css";
import { CalendarCheck, Folders, Users, UserPlus, ShieldCheck, Radar, RefreshCw,
  BarChart3, Settings, Search, ChevronDown } from "lucide-react";

/**
 * UI v2 — barre latérale (handoff §« Le shell applicatif », 248px, plan validé PO 10.08.2026).
 * 3 blocs (Mon espace · Parcours client · Pilotage) + bloc « Métiers » OPTIONNEL affiché
 * uniquement si des modules verticaux sont licenciés (arbitrage PO n°4, R320). Le reste des
 * écrans s'atteint par la palette ⌘K (étape 4) — le champ de recherche l'annonce.
 * Pièges encodés par le handoff : libellés/badges en nowrap + ellipsis (le retour à la ligne
 * d'une entrée active est LE défaut visuel de cette barre) ; icônes Unicode provisoires (jeu
 * vectoriel à proposer au PO avant intégration).
 */

export type Ui2NavId = "journee" | "dossiers" | "clients" | "entree" | "kyc"
  | "surveillance" | "revue" | "rapports" | "param" | string;

export type Ui2NavProps = {
  active: Ui2NavId;
  user: string;                       // "Camille Morel"
  role: string;                       // "Relationship Manager"
  onNavigate?: (id: Ui2NavId) => void;
  onSearch?: () => void;              // ouvrira la palette ⌘K (étape 4)
  modulesLicencies?: { id: string; label: string; icon?: React.ReactNode }[];  // bloc « Métiers » (R320)
  // Badge : pilule brand (défaut), pilule d'alerte, ou nombre SOBRE en Mono (maquette 01 —
  // les compteurs informatifs ne crient pas, seuls l'actif et l'alerte prennent une pilule).
  badges?: Record<string, { n: number | string; alert?: boolean; sobre?: boolean }>;
  t?: (cle: string) => string;        // i18n (clé = FR) — brancher traduire(langue())
};

// Jeu d'icônes VECTORIEL : Lucide (arbitrage PO 10.08.2026 — trait 1,75, taille 16, gouttière fixe).
const ICONE = { size: 16, strokeWidth: 1.75 } as const;
const BLOCS: { label: string; items: { id: Ui2NavId; label: string; icon: React.ReactNode }[] }[] = [
  { label: "Mon espace", items: [
    { id: "journee", label: "Ma journée", icon: <CalendarCheck {...ICONE} /> },
    { id: "dossiers", label: "Mes dossiers", icon: <Folders {...ICONE} /> },
    { id: "clients", label: "Mes clients", icon: <Users {...ICONE} /> }] },
  { label: "Parcours client", items: [
    { id: "entree", label: "Entrée en relation", icon: <UserPlus {...ICONE} /> },
    { id: "kyc", label: "Connaissance client", icon: <ShieldCheck {...ICONE} /> },
    { id: "surveillance", label: "Surveillance", icon: <Radar {...ICONE} /> },
    { id: "revue", label: "Revue & sortie", icon: <RefreshCw {...ICONE} /> }] },
  { label: "Pilotage", items: [
    { id: "rapports", label: "Rapports", icon: <BarChart3 {...ICONE} /> },
    { id: "param", label: "Paramétrage", icon: <Settings {...ICONE} /> }] },
];

export function Ui2Nav({ active, user, role, onNavigate, onSearch, modulesLicencies, badges, t }: Ui2NavProps) {
  const tr = t ?? ((s: string) => s);
  const entree = (it: { id: Ui2NavId; label: string; icon: React.ReactNode }) => {
    const actif = active === it.id;
    const b = badges?.[it.id];
    return (
      <button key={it.id} onClick={() => onNavigate?.(it.id)} aria-current={actif ? "page" : undefined}
        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", minWidth: 0,
          height: 36, padding: "9px 10px", border: "none", borderRadius: 8, cursor: "pointer",
          textAlign: "left", fontFamily: "inherit", fontSize: "13.5px",
          fontWeight: actif ? 500 : 400, background: actif ? "var(--nav-active-bg)" : "transparent",
          color: actif ? "var(--nav-text-strong)" : "var(--nav-text)" }}
        onMouseEnter={(e) => { if (!actif) e.currentTarget.style.background = "var(--nav-hover)"; }}
        onMouseLeave={(e) => { if (!actif) e.currentTarget.style.background = "transparent"; }}>
        <span aria-hidden style={{ width: 16, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
          color: actif ? "var(--nav-active-icon)" : "var(--nav-icon)" }}>{it.icon}</span>
        <span style={{ whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
          {tr(it.label)}</span>
        {b != null && (b.sobre && !actif && !b.alert
          ? <span style={{ marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--nav-label)" }}>{b.n}</span>
          : <span style={{ marginLeft: "auto", flexShrink: 0, whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, padding: "1px 7px",
              borderRadius: "var(--r-pill)",
              background: b.alert ? "var(--nav-badge-alert-bg)" : "var(--brand)",
              color: b.alert ? "var(--nav-badge-alert-text)" : "#fff" }}>{b.n}</span>)}
      </button>);
  };
  const blocLabel = (label: string) => (
    <div style={{ padding: "14px 10px 5px", fontFamily: "var(--font-mono)", fontSize: 9.5,
      fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--nav-label)",
      whiteSpace: "nowrap" }}>{tr(label)}</div>);
  return (
    <nav aria-label={tr("Navigation principale")} style={{ width: "var(--nav-w)", flexShrink: 0,
      height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column",
      background: "var(--nav-bg)", overflowY: "auto", padding: "14px 10px 0", boxSizing: "border-box" }}>
      {/* Logo — reproductible en CSS, aucun fichier image (handoff §Assets). */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 4px 12px" }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: "linear-gradient(135deg,#4A6B28,#7BA042)", display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          <span style={{ width: 9, height: 12, borderRadius: "50%", background: "var(--gold)" }} />
        </span>
        <span style={{ color: "var(--nav-text-strong)", fontWeight: 600, fontSize: 14.5,
          whiteSpace: "nowrap" }}>O-Live</span>
      </div>
      {/* Recherche unifiée — la palette ⌘K est LE chemin des écrans rares (étape 4). */}
      <button onClick={() => onSearch?.()} style={{ display: "flex", alignItems: "center", gap: 8,
        margin: "0 0 6px", padding: "8px 10px", borderRadius: 8, cursor: "pointer",
        background: "var(--nav-field)", border: "1px solid var(--nav-field-border)",
        color: "var(--nav-icon)", fontFamily: "inherit", fontSize: 12.5, width: "100%",
        boxSizing: "border-box" }}>
        <span aria-hidden style={{ display: "flex" }}><Search size={13} strokeWidth={2} /></span>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr("Rechercher…")}</span>
        <span className="mono" style={{ marginLeft: "auto", flexShrink: 0, fontSize: 10,
          border: "1px solid var(--nav-field-border)", borderRadius: 5, padding: "1px 5px" }}>⌘K</span>
      </button>
      {BLOCS.map((b) => (
        <div key={b.label}>
          {blocLabel(b.label)}
          {b.items.map(entree)}
        </div>))}
      {/* Bloc « Métiers » — UNIQUEMENT si le module est licencié (arbitrage PO n°4, R320). */}
      {modulesLicencies && modulesLicencies.length > 0 && (
        <div>
          {blocLabel("Métiers")}
          {modulesLicencies.map((m) => entree({ id: m.id, label: m.label, icon: m.icon ?? <Folders {...ICONE} /> }))}
        </div>)}
      {/* Pied : avatar, nom, rôle, chevron — épinglé en bas. */}
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--nav-divider)",
        margin: "12px -10px 0", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: "var(--nav-active-bg)", color: "var(--nav-active-icon)", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600 }}>
          {user.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: "var(--nav-text-strong)", fontSize: 12.5,
            fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user}</span>
          <span style={{ display: "block", color: "var(--nav-label)", fontSize: 10.5,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tr(role)}</span>
        </span>
        <span aria-hidden style={{ marginLeft: "auto", color: "var(--nav-icon)", display: "flex" }}><ChevronDown size={13} strokeWidth={2} /></span>
      </div>
    </nav>);
}
