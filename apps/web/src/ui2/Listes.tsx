import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe, Ui2Bouton } from "./Header";
import { StatusChip, ChipMode } from "./StatusChip";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";
import clientsSeed from "../seed/clients.json";
import kycSeed from "../seed/kyc.json";

/**
 * UI v2 — étape 9 : pattern « Entity List » (le gabarit qui couvre la majorité des ~50 écrans
 * v1 : Clients, Personnes, Registre LBA, Transactions, Habilitations…). Même invariant que la
 * WorkQueueRow : l'en-tête partage EXACTEMENT la grille des lignes ; le statut est une puce
 * lisible sans la couleur ; chaque ligne s'ouvre. Sources honnêtes : useApiOrSeed — l'API si
 * elle répond, sinon le seed maquette signalé.
 * Deux écrans concrets : « Mes dossiers » (/v1/kyc) et « Mes clients » (/v1/clients, onglet
 * Personnes — une personne est UNIQUE et référencée par ses dossiers, jamais dupliquée).
 */

export function EntityList({ grid, entetes, lignes, onOpen, fond = "surface" }: {
  grid: string; entetes: string[];
  lignes: { id: string; cells: React.ReactNode[] }[];
  onOpen: (id: string) => void;
  /**
   * « transparent » (V2-M25) : la liste n'a NI carte NI fond — elle se pose telle quelle sur ce
   * qui est derrière, aujourd'hui le globe des flux. Les séparateurs et le survol passent en
   * encre translucide, seuls repères qui restent. Défaut inchangé partout ailleurs.
   */
  fond?: "surface" | "transparent";
}) {
  const nu = fond === "transparent";
  const fondLigne = nu ? "transparent" : "var(--bg-surface)";
  const fondSurvol = nu ? "rgba(23,28,34,0.055)" : "var(--bg-subtle)";
  return (
    <section style={{ background: nu ? "transparent" : "var(--bg-surface)",
      border: nu ? "none" : "1px solid var(--border)",
      borderRadius: "var(--r-card)", boxShadow: nu ? "none" : "var(--shadow-card)",
      overflow: "hidden" }}>
      <div role="row" style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center",
        padding: "0 16px", background: nu ? "transparent" : "var(--bg-subtle)",
        borderBottom: nu ? "1px solid rgba(23,28,34,0.16)" : "1px solid var(--border)" }}>
        {entetes.map((h) => <span key={h} className="microlabel" style={{ padding: "9px 10px 9px 0" }}>{h}</span>)}
      </div>
      {lignes.map((l) => (
        <button key={l.id} role="row" onClick={() => onOpen(l.id)}
          style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", width: "100%",
            textAlign: "left", padding: "0 16px", border: "none", cursor: "pointer",
            fontFamily: "inherit", background: fondLigne,
            borderBottom: nu ? "1px solid rgba(23,28,34,0.09)" : "1px solid var(--border-row)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = fondSurvol; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = fondLigne; }}>
          {l.cells.map((c, i) => <span key={i} style={{ padding: "11px 10px 11px 0", minWidth: 0,
            fontSize: 12.5, color: nu ? "var(--text)" : "var(--text-body)" }}>{c}</span>)}
        </button>))}
    </section>);
}

const RISQUE: Record<string, { label: string; mode: ChipMode }> = {
  HIGH: { label: "ÉLEVÉ", mode: "warn" }, MEDIUM: { label: "MOYEN", mode: "neutral" },
  LOW: { label: "FAIBLE", mode: "ok" } };
const STATUT: Record<string, { label: string; mode: ChipMode }> = {
  APPROVED: { label: "VALIDÉ", mode: "ok" }, UNDER_REVIEW: { label: "EN REVUE", mode: "warn" },
  IN_PROGRESS: { label: "EN COURS", mode: "neutral" }, REJECTED: { label: "REFUSÉ", mode: "alert" } };
const chip = (m: { label: string; mode: ChipMode } | undefined, t: (s: string) => string) =>
  m ? <StatusChip mode={m.mode}>{t(m.label)}</StatusChip> : null;

type ClientRow = { id: string; name: string; structure?: string; country?: string; riskLevel?: string };
type KycRow = { code: string; clientId?: string; status: string; riskLevel?: string; createdAt?: string };

const badges = { journee: { n: 12 }, dossiers: { n: 48, sobre: true },
  clients: { n: 214, sobre: true }, surveillance: { n: 5, alert: true } };

export function MesDossiers({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const r = useApiOrSeed<KycRow[]>("/v1/kyc", kycSeed as KycRow[]);
  const lignes = (Array.isArray(r.data) ? r.data : []).slice(0, 30);
  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager"
      onNavigate={onNavigate} t={t} badges={badges} />}
      header={<Ui2HeaderListe titre={t("Mes dossiers")}
        sousTitre={`${lignes.length} ${t("dossiers")} · ${r.isDemo ? t("données maquette") : t("source : /v1/kyc")}`}
        action={<Ui2Bouton primaire>{t("Nouveau dossier")}</Ui2Bouton>} t={t} />}>
      <EntityList grid="1.4fr 1fr 110px 110px 110px" onOpen={() => onNavigate("kyc")}
        entetes={[t("Dossier"), t("Client"), t("Statut"), t("Risque"), t("Ouvert le")]}
        lignes={lignes.map((k) => ({ id: k.code, cells: [
          <span key="c" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{k.code}</span>,
          k.clientId ?? "—",
          chip(STATUT[k.status] ?? { label: k.status, mode: "neutral" }, t),
          chip(k.riskLevel ? RISQUE[k.riskLevel] : undefined, t),
          <span key="d" className="mono">{k.createdAt ?? "—"}</span>] }))} />
    </Ui2Shell>);
}

// V2-M3 — profil CPSI de la fiche client (/v1/cpsi/clients/:cid/score) : le score PERPÉTUEL du
// moteur Python, pur et REJOUABLE à date (asOf, R48). Le moteur PROPOSE — couplage au workflow
// par propositions/tâches uniquement (R39/R44), jamais par effet de bord. Seed au format API.
type ScoreCpsi = { clientId?: string; score?: number; niveau?: string; asOf?: string | null;
  composantes?: { code: string; label?: string; points?: number }[] } | null;
const SEED_SCORE: ScoreCpsi = { score: 62, niveau: "MOYEN", composantes: [
  { code: "PAYS", label: "Risque pays (pondéré exposition)", points: 24 },
  { code: "STRUCTURE", label: "Structure de détention (2 niveaux)", points: 18 },
  { code: "FLUX", label: "Écart de flux constaté (30 j)", points: 14 },
  { code: "ANCIENNETE", label: "Ancienneté de la relation", points: 6 },
] };

// Personnes du seed des écrans maquettés — une personne est unique, ses dossiers la référencent.
const PERSONNES = [
  { id: "PER-01994", nom: "Henrik Vallon", detail: "Suède · UBO et signataire", refs: "3 dossiers" },
  { id: "PER-02110", nom: "Nadia Farah", detail: "Liban · pièce d'identité à recevoir", refs: "1 dossier" },
  { id: "PER-01730", nom: "Andrei Volkov", detail: "Fédération de Russie · hit sanctions à qualifier", refs: "2 dossiers" },
];

export function MesClients({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [onglet, setOnglet] = useState<"clients" | "personnes">("clients");
  const [ouvert, setOuvert] = useState<string | null>(null);       // fiche client (panneau latéral)
  const r = useApiOrSeed<ClientRow[]>("/v1/clients", clientsSeed as ClientRow[]);
  const lignes = (Array.isArray(r.data) ? r.data : []).slice(0, 30);
  const client = ouvert ? lignes.find((c) => c.id === ouvert) ?? null : null;
  const cpsi = useApiOrSeed<ScoreCpsi>(ouvert ? `/v1/cpsi/clients/${ouvert}/score` : "/v1/cpsi/__hors-api__", SEED_SCORE);
  const pilule = (id: "clients" | "personnes", label: string) => (
    <button key={id} onClick={() => setOnglet(id)} aria-pressed={onglet === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: onglet === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: onglet === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: onglet === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);
  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Camille Morel" role="Relationship Manager"
      onNavigate={onNavigate} t={t} badges={badges} />}
      header={<Ui2HeaderListe titre={t("Mes clients")}
        sousTitre={onglet === "clients"
          ? `${lignes.length} ${t("clients")} · ${r.isDemo ? t("données maquette") : t("source : /v1/clients")}`
          : t("une personne est unique — ses dossiers la référencent, rien n'est ressaisi")}
        filtres={<span style={{ display: "flex", gap: 8 }}>{pilule("clients", t("Clients"))}{pilule("personnes", t("Personnes"))}</span>}
        action={<Ui2Bouton primaire>{t("Nouveau client")}</Ui2Bouton>} t={t} />}
      sideWidth={340}
      side={client ? <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)", minWidth: 0 }}>{client.name}</span>
          <button aria-label={t("Fermer la fiche")} onClick={() => setOuvert(null)}
            style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, color: "var(--text-muted)" }}>✕</button>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "2px 0 12px" }}>
          {`${client.id} · ${client.structure ?? "—"} · ${client.country ?? "—"}`}</div>
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("Profil CPSI")}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
              {cpsi.isDemo ? t("données maquette") : t("source : /v1/cpsi (rejouable à date)")}</span>
          </div>
          <div className="mono" style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.1, color: "var(--text)" }}>
            {cpsi.data?.score ?? "—"}
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--warn-text)", marginLeft: 8 }}>
              {t(cpsi.data?.niveau ?? "")}</span></div>
          <div style={{ marginTop: 9 }}>
            {(cpsi.data?.composantes ?? []).map((c) => (
              <div key={c.code} style={{ display: "flex", alignItems: "baseline", gap: 8,
                padding: "3.5px 0", borderBottom: "1px solid var(--border-row)" }}>
                <span style={{ fontSize: 11.5, color: "var(--text-body)", minWidth: 0 }}>{t(c.label ?? c.code)}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600 }}>
                  {c.points != null ? `+${c.points}` : "—"}</span>
              </div>))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
            {t("Score perpétuel du moteur CPSI — pur et rejouable à date (R48). Le moteur PROPOSE ; toute suite passe par une proposition ou une tâche (R44), jamais par effet de bord.")}</div>
        </section>
        <button onClick={() => onNavigate("kyc")} style={{ display: "block", width: "100%",
          marginTop: 12, padding: "10px 14px", borderRadius: "var(--r-input)",
          border: "1px solid var(--brand)", background: "var(--brand)", color: "#fff",
          fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {t("Ouvrir le dossier KYC")}</button>
      </div> : undefined}>
      {onglet === "clients" ? (
        <EntityList grid="1.5fr 110px 90px 110px" onOpen={(id) => setOuvert(id)}
          entetes={[t("Client"), t("Structure"), t("Pays"), t("Risque")]}
          lignes={lignes.map((c) => ({ id: c.id, cells: [
            <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{c.name}</span>,
            c.structure ?? "—",
            <span key="p" className="mono">{c.country ?? "—"}</span>,
            chip(c.riskLevel ? RISQUE[c.riskLevel] : undefined, t)] }))} />
      ) : (
        <EntityList grid="120px 1.5fr 1fr 110px" onOpen={() => onNavigate("kyc")}
          entetes={[t("Référence"), t("Personne"), t("Contexte"), t("Dossiers")]}
          lignes={PERSONNES.map((p) => ({ id: p.id, cells: [
            <span key="r" className="mono">{p.id}</span>,
            <span key="n" style={{ fontWeight: 600, color: "var(--text)" }}>{p.nom}</span>,
            t(p.detail),
            <span key="f" className="mono">{t(p.refs)}</span>] }))} />
      )}
    </Ui2Shell>);
}
