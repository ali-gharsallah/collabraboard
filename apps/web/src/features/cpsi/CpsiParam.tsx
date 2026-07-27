import React, { useState } from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Gouvernance des barèmes » (porte CPSI · R68/R69/R70 · CP-08/09/10). Les règles de
// calcul s'affichent EN CLAIR (R68). Tout changement se SIMULE d'abord (R70, dry-run 0 mutation) :
// « Proposer » reste VERROUILLÉ tant que les valeurs saisies n'ont pas été simulées — et se
// re-verrouille si on les modifie. La proposition embarque l'impact (R69) ; un humain adopte ou
// rejette (motivation obligatoire au rejet). La santé expose la jauge de rejeu (R250).

type Impact = { delta_moyen: number; clients_evalues: number; nouveaux_high: number; charge_revues_induite: number; franchissements: { client: string; avant: string; apres: string }[] };
type Proposition = { id: string; auteur: string; chemin: string; valeur: unknown; justification: string; statut: string; impact: Impact };
type Sante = { contractVersion: string; profondeurJournal: number; dernierRejeuMs: number | null; rejeuHorsSeuil: boolean; configEnVigueur: string };

const SEED_RULES = { asOf: null as string | null, regles: [
  "Score client = Statique + Comportemental, plafonné à 100.",
  "Half-life : 180 jours — un signal vieux d'une demi-vie pèse moitié (R64).",
  "Chaque score publie ses drivers ; leur somme reconstitue le score (R67)."] };
const SEED_PROPS: Proposition[] = [{ id: "PROP-1", auteur: "olivia", chemin: "half_life_jours", valeur: 90,
  justification: "réduire la mémoire des signaux", statut: "EN_ATTENTE",
  impact: { delta_moyen: -4.2, clients_evalues: 128, nouveaux_high: 0, charge_revues_induite: 3, franchissements: [] } }];
const SEED_SANTE: Sante = { contractVersion: "1", profondeurJournal: 42, dernierRejeuMs: 12, rejeuHorsSeuil: false, configEnVigueur: "base" };

function parseValeur(brut: string): unknown {
  const n = Number(brut);
  if (brut.trim() !== "" && Number.isFinite(n)) return n;
  try { return JSON.parse(brut); } catch { return brut; }
}

export function CpsiParam() {
  const { data: rules, isDemo } = useApiOrSeed<typeof SEED_RULES>("/v1/cpsi/rules", SEED_RULES);
  const { data: props, reload: reloadProps } = useApiOrSeed<Proposition[]>("/v1/cpsi/params/proposals", SEED_PROPS);
  const { data: sante } = useApiOrSeed<Sante>("/v1/cpsi/health", SEED_SANTE);
  const [chemin, setChemin] = useState("");
  const [valeur, setValeur] = useState("");
  const [justif, setJustif] = useState("");
  const [impact, setImpact] = useState<Impact | null>(null);
  const [simulee, setSimulee] = useState<string | null>(null);            // R70 : clé (chemin=valeur) simulée
  const [msg, setMsg] = useState("");

  const cle = `${chemin.trim()}=${valeur.trim()}`;
  const verrouille = simulee !== cle || !chemin.trim();                   // R70 : proposer exige la simulation des valeurs SAISIES

  async function simuler() {
    setMsg(""); setImpact(null);
    try {
      const r = await apiPost<Impact>("/v1/cpsi/sandbox/simulate", { changements: { [chemin.trim()]: parseValeur(valeur) } });
      setImpact(r); setSimulee(cle);
      setMsg("Impact simulé (dry-run, aucune mutation) — proposition déverrouillée pour CES valeurs (R70).");
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); setSimulee(null); }
  }
  async function proposer() {
    setMsg("");
    try {
      const p = await apiPost<Proposition>("/v1/cpsi/params/proposals", { chemin: chemin.trim(), valeur: parseValeur(valeur), justification: justif });
      setMsg(`Proposition ${p.id} émise — aucun effet avant adoption humaine (R69).`);
      setSimulee(null); setImpact(null); reloadProps();
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }
  async function decider(pid: string, action: "adopt" | "reject") {
    setMsg("");
    let body: Record<string, unknown> = {};
    if (action === "reject") { const m = window.prompt("Motivation du rejet (obligatoire, R69) :"); if (!m) return; body = { motivation: m }; }
    try { await apiPost(`/v1/cpsi/params/proposals/${pid}/${action}`, body); setMsg(`Proposition ${pid} ${action === "adopt" ? "adoptée (config versionnée R68)" : "rejetée (motivée)"}.`); reloadProps(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  }

  const btn = (label: string, bg: string, on: () => void, disabled = false) =>
    <button disabled={disabled || isDemoMode()} onClick={on} style={{ padding: "6px 14px", borderRadius: 6, border: "none",
      background: disabled || isDemoMode() ? "#ccc" : bg, color: "#fff", cursor: disabled || isDemoMode() ? "default" : "pointer", fontSize: 12 }}>{label}</button>;

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>CPSI — Gouvernance des barèmes (R68 · R69 · R70)</h3>
    <div style={{ display: "flex", gap: 6, fontSize: 11, flexWrap: "wrap", margin: "6px 0" }}>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>contrat v{sante.contractVersion}</span>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>journal : {sante.profondeurJournal} évts</span>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: sante.rejeuHorsSeuil ? tokens.color.danger : tokens.color.ok, color: "#fff" }}>
        rejeu {sante.dernierRejeuMs ?? "—"} ms{sante.rejeuHorsSeuil ? " (hors seuil — notifié, jamais bloquant R39)" : ""}</span>
      <span style={{ padding: "3px 10px", borderRadius: 999, background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>config en vigueur : {sante.configEnVigueur}</span>
    </div>

    <h4 style={{ marginBottom: 4 }}>Règles de calcul en clair (R68)</h4>
    <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 12, color: tokens.color.ink }}>
      {rules.regles.map((r, i) => <li key={i} style={{ padding: "1px 0" }}>{r}</li>)}
    </ul>

    <h4 style={{ marginBottom: 4 }}>Bac à sable — simuler AVANT de proposer (R70)</h4>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={chemin} onChange={(e) => setChemin(e.target.value)} placeholder="chemin (ex. half_life_jours)"
        style={{ padding: 7, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 240 }}/>
      <input value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="valeur (ex. 90 ou [35,65])"
        style={{ padding: 7, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}`, fontSize: 12, width: 160 }}/>
      <input value={justif} onChange={(e) => setJustif(e.target.value)} placeholder="justification (R69)"
        style={{ padding: 7, borderRadius: tokens.radius.sm, border: `1px solid ${tokens.color.border}`, fontSize: 12, flex: 1, minWidth: 180 }}/>
      {btn("Simuler l'impact", tokens.color.olive600, simuler, !chemin.trim())}
      {btn("Proposer", tokens.color.olive700, proposer, verrouille)}
      {verrouille && chemin.trim() && <span style={{ fontSize: 11, color: tokens.color.muted }}>verrouillé : simulez d'abord ces valeurs (R70)</span>}
    </div>
    {impact && <div style={{ marginTop: 8, padding: 10, borderRadius: tokens.radius.md, background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
      <strong>Rapport d'impact</strong> — {impact.clients_evalues} clients évalués · Δ moyen {impact.delta_moyen} ·
      nouveaux HIGH {impact.nouveaux_high} · charge de revues induite {impact.charge_revues_induite}
      {impact.franchissements.length > 0 && <div style={{ marginTop: 4 }}>
        Franchissements nominatifs : {impact.franchissements.map((f) => `${f.client} ${f.avant}→${f.apres}`).join(" · ")}</div>}
    </div>}
    {msg && <div style={{ margin: "8px 0", padding: 8, borderRadius: 6, background: "#eef4e6", fontSize: 12 }}>{msg}</div>}

    <h4 style={{ margin: "14px 0 4px" }}>Propositions — l'IA propose, l'humain décide (R69)</h4>
    {props.map((p) => <div key={p.id} style={{ padding: 10, marginTop: 6, borderRadius: tokens.radius.md,
      background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, fontSize: 12 }}>
      <strong>{p.id}</strong> · {p.chemin} → {JSON.stringify(p.valeur)} <span style={{ color: tokens.color.muted }}>· par {p.auteur}</span>
      <span style={{ marginLeft: 8, padding: "1px 8px", borderRadius: 999, fontSize: 11, color: "#fff",
        background: p.statut === "ADOPTEE" ? tokens.color.ok : p.statut === "REJETEE" ? tokens.color.danger : tokens.color.gold }}>{p.statut}</span>
      <div style={{ color: tokens.color.muted, marginTop: 2 }}>{p.justification || "(sans justification)"} · impact : Δ {p.impact?.delta_moyen} sur {p.impact?.clients_evalues} clients, {p.impact?.franchissements?.length ?? 0} franchissement(s)</div>
      {p.statut === "EN_ATTENTE" && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {btn("Adopter", tokens.color.ok, () => decider(p.id, "adopt"))}
        {btn("Rejeter", tokens.color.danger, () => decider(p.id, "reject"))}
      </div>}
    </div>)}
    {!props.length && <div style={{ marginTop: 8, color: tokens.color.muted, fontSize: 13 }}>Aucune proposition.</div>}
  </div>;
}
