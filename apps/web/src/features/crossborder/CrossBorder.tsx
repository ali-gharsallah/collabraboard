import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

/**
 * `crossborder` — R293-R295 (canon triage final, ratifié 2026-07-28). Le COUNTRY MANUAL est
 * la clé EXISTANTE `tripCrossBorderReferentiel` (R223) enrichie — cet écran la REND (lecture
 * registre) et n'écrit JAMAIS le manual ici : il s'édite au registre (R7). Le check est LE
 * moteur servi (POST /v1/crossborder/check) — juridiction absente = NON DÉTERMINÉ, jamais un
 * « autorisé » par défaut. Un verdict restrictif ne bloque rien (R39) : conformité VISIBLE,
 * la voie prévue est la dérogation motivée + visa d'un second (R13). Le reporting MESURE
 * les ordres par pays (R295). Les refus backend s'affichent tels quels (FE-04).
 */

type Entree = { jurisdiction: string; activite: string; verdict: string; depuisLe: string;
  licence?: string; source?: string };
type Check = { verdict: string; manualAt: string; note?: string;
  parActivite: { activite: string; verdict: string; detail?: string; position?: string; licence?: string | null }[] };
type Conf = { conforme: boolean; verdict: string; note?: string; derogation?: unknown };
type Rep = { parPays: Record<string, { total: number; reverseSolicitation: number }> };

export function CrossBorder() {
  const [manual, setManual] = useState<Entree[] | null>(null);
  const [rep, setRep] = useState<Rep | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [conf, setConf] = useState<Conf | null>(null);
  const [msg, setMsg] = useState("");
  const [sim, setSim] = useState({ juridiction: "", activites: "prospection", voyageId: "" });
  const [dero, setDero] = useState({ voyageId: "", juridiction: "", motif: "", id: "" });

  const charger = async () => {
    const m = await apiGetSourced<Entree[] | null>("/v1/parametres/valeur/tripCrossBorderReferentiel", null);
    setManual(m.isDemo ? null : (m.data ?? []));
    const r = await apiGetSourced<Rep | null>("/v1/crossborder/reporting", null);
    setRep(r.isDemo ? null : r.data);
  };
  const agir = async (fn: () => Promise<void>) => {
    setMsg("");
    try { await fn(); } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); } // le refus, TEL QUEL
  };
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol
  const td = { fontSize: 12, borderTop: `1px solid ${tokens.color.border}`, padding: "3px 8px" };
  const couleur = (v: string) => v === "AUTORISE" ? tokens.color.olive700 : v === "NON_DETERMINE" ? "#b45309" : "#b91c1c";

  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Cross-border — le country manual de la banque, servi (R293) — O-Live structure la position, il ne fournit jamais l&apos;avis</h3>
    <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12, marginBottom: 10 }}>Charger</button>
    {msg && <p data-testid="msg-xb" style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}

    {manual && <div>
      <h4 style={{ margin: "8px 0 4px", fontSize: 13 }}>Country manual (clé `tripCrossBorderReferentiel` — s&apos;édite au registre, versionné par date d&apos;effet)</h4>
      {manual.length === 0 && <p style={{ fontSize: 12, color: tokens.color.muted }}>Manual vide — toute juridiction est NON DÉTERMINÉE (default-deny)</p>}
      {manual.length > 0 && <table style={{ borderCollapse: "collapse" }}><tbody>
        {manual.map((e, i) => <tr key={i}>
          <td style={td}><strong>{e.jurisdiction}</strong></td>
          <td style={td}>{e.activite}</td>
          <td style={{ ...td, color: couleur(e.verdict === "AUTORISEE" ? "AUTORISE" : "RESTREINT") }}>{e.verdict}{e.licence ? ` (licence ${e.licence})` : ""}</td>
          <td style={{ ...td, color: tokens.color.muted }}>depuis {e.depuisLe}{e.source ? ` · ${e.source}` : ""}</td>
        </tr>)}
      </tbody></table>}

      <h4 style={{ margin: "12px 0 4px", fontSize: 13 }}>Check (R294 — le moteur, un événement tracé)</h4>
      <input placeholder="juridiction (ISO2)" value={sim.juridiction} onChange={(e) => setSim({ ...sim, juridiction: e.target.value.toUpperCase() })} style={{ fontSize: 12, width: 110 }}/>
      <input placeholder="activités (virgule)" value={sim.activites} onChange={(e) => setSim({ ...sim, activites: e.target.value })} style={{ fontSize: 12, marginLeft: 4, width: 180 }}/>
      <input placeholder="voyageId (optionnel)" value={sim.voyageId} onChange={(e) => setSim({ ...sim, voyageId: e.target.value })} style={{ fontSize: 12, marginLeft: 4, width: 140 }}/>
      <button style={{ fontSize: 12, marginLeft: 4 }} disabled={isDemoMode()} onClick={() => agir(async () => {
        setCheck(await apiPost<Check>("/v1/crossborder/check", { juridiction: sim.juridiction,
          activites: sim.activites.split(",").map((a) => a.trim()).filter(Boolean),
          ...(sim.voyageId ? { contexte: { voyageId: sim.voyageId } } : {}) }));
      })}>Évaluer</button>
      {check && <div data-testid="verdict-xb" style={{ fontSize: 12, marginTop: 6 }}>
        <p>Verdict : <strong style={{ color: couleur(check.verdict) }}>{check.verdict}</strong> (manual au {check.manualAt.slice(0, 10)}){check.note ? ` — ${check.note}` : ""}</p>
        <ul style={{ margin: "2px 0 0 18px" }}>{check.parActivite.map((a) => <li key={a.activite}>
          {a.activite} : <span style={{ color: couleur(a.verdict) }}>{a.verdict}</span>
          {a.position ? ` (${a.position}${a.licence ? `, licence ${a.licence}` : ""})` : ""}{a.detail ? ` — ${a.detail}` : ""}</li>)}</ul>
      </div>}

      <h4 style={{ margin: "12px 0 4px", fontSize: 13 }}>Dérogation & conformité (rien n&apos;est bloqué, tout est visible — R39 ; visa d&apos;un SECOND, R13)</h4>
      <input placeholder="voyageId" value={dero.voyageId} onChange={(e) => setDero({ ...dero, voyageId: e.target.value })} style={{ fontSize: 12, width: 120 }}/>
      <input placeholder="juridiction" value={dero.juridiction} onChange={(e) => setDero({ ...dero, juridiction: e.target.value.toUpperCase() })} style={{ fontSize: 12, marginLeft: 4, width: 100 }}/>
      <input placeholder="motif (R7)" value={dero.motif} onChange={(e) => setDero({ ...dero, motif: e.target.value })} style={{ fontSize: 12, marginLeft: 4, width: 180 }}/>
      <button style={{ fontSize: 12, marginLeft: 4 }} disabled={isDemoMode()} onClick={() => ask({ title: "Demander une dérogation cross-border (R7)",
        message: "Une dérogation motivée est demandée ; elle exige le visa d'un second (four-eyes). Le backend valide.",
        items: [{ label: dero.juridiction ? `Juridiction : ${dero.juridiction}` : "Juridiction non renseignée (vérifiée serveur)", ok: !!dero.juridiction },
          { label: dero.motif ? "Motif fourni" : "Motif non renseigné (R7)", ok: !!dero.motif }],
        confirmLabel: "Confirmer la demande", onConfirm: () => agir(async () => {
          const r = await apiPost<{ id: string }>("/v1/crossborder/derogations", { voyageId: dero.voyageId, juridiction: dero.juridiction, motif: dero.motif });
          setDero({ ...dero, id: r.id }); setMsg(`Dérogation ${r.id.slice(0, 8)}… demandée — en attente du visa d'un second.`);
        }) })}>Demander</button>
      {dero.id && <button style={{ fontSize: 12, marginLeft: 4 }} disabled={isDemoMode()} onClick={() => ask({ title: "Viser la dérogation (second regard)",
        message: "Second regard four-eyes : le viseur doit être distinct du demandeur (contrôlé serveur).", confirmLabel: "Viser",
        onConfirm: () => agir(async () => { await apiPost(`/v1/crossborder/derogations/${dero.id}/visa`, {}); setMsg("Dérogation visée."); }) })}>Viser (second regard)</button>}
      <button style={{ fontSize: 12, marginLeft: 4 }} disabled={isDemoMode()} onClick={() => agir(async () => {
        const r = await apiGetSourced<Conf | null>(`/v1/crossborder/voyages/${dero.voyageId || sim.voyageId}/conformite`, null);
        setConf(r.isDemo ? null : r.data);
      })}>Conformité du voyage</button>
      {conf && <p data-testid="conf-xb" style={{ fontSize: 12 }}>
        {conf.conforme ? "CONFORME" : "NON CONFORME"} — verdict {conf.verdict}{conf.derogation ? " (avec dérogation visée)" : ""}{conf.note ? ` · ${conf.note}` : ""}</p>}
    </div>}

    {rep && <div style={{ marginTop: 12 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 13 }}>Ordres par pays (R295 — mesuré, jamais bloqué)</h4>
      {Object.keys(rep.parPays).length === 0
        ? <p style={{ fontSize: 12, color: tokens.color.muted }}>Aucun ordre tracé</p>
        : <table style={{ borderCollapse: "collapse" }}><tbody>
            {Object.entries(rep.parPays).map(([p, v]) => <tr key={p}>
              <td style={td}><strong>{p}</strong></td>
              <td style={td}>{v.total} ordre{v.total > 1 ? "s" : ""}</td>
              <td style={{ ...td, color: tokens.color.muted }}>dont {v.reverseSolicitation} en reverse solicitation</td>
            </tr>)}
          </tbody></table>}
    </div>}
  </div>;
}
