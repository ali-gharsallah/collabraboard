import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * `ssoparam` — R290 (extension MOD-30, ratifiée 2026-07-28) : le fournisseur d'identité se
 * PILOTE, tracé. L'écran REND l'état servi (IM-01 : le secret ne descend JAMAIS — le backend
 * ne sert que « configuré/absent ») ; « Tester » = dry-run tracé (IM-03) ; la rotation JWKS
 * est MOTIVÉE ; la bascule de mode est à DEUX REGARDS et à date (IM-04) — les refus backend
 * (R7, R13) sont affichés tels quels. La config déclarée s'écrit par le REGISTRE (ssoOidc).
 */

type Etat = { oidc: { issuer: string | null; audience: string | null; roleMapping: unknown; secretConfigure: boolean };
  jwks: { kidCourant: string; derniereRotation: string | null };
  mode: string; basculeEnAttente: { vers: string; effetAt: string; par: string } | null };

export function SsoParam() {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [msg, setMsg] = useState("");
  const [motifRotation, setMotifRotation] = useState("");
  const [bascule, setBascule] = useState({ vers: "sso", effetAt: "", motif: "" });

  const charger = async () => {
    const r = await apiGetSourced<Etat | null>("/v1/admin/sso/etat", null);
    setEtat(r.isDemo ? null : r.data);
  };
  const agir = async (fn: () => Promise<unknown>, ok: (x: any) => string) => {
    setMsg("");
    try { const x = await fn(); await charger(); setMsg(ok(x)); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }           // le refus backend, TEL QUEL
  };

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>SSO — fédération d&apos;identité (ssoparam) — la porte d&apos;entrée se pilote, tracée</h3>
    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      {etat && <button style={{ fontSize: 12 }} disabled={isDemoMode()}
        onClick={() => agir(() => apiPost<{ resultat: string }>("/v1/admin/sso/test", {}), (x) => `Test (dry-run tracé) : ${x.resultat}`)}>Tester la connexion</button>}
    </div>
    {msg && <p data-testid="msg-ssoparam" style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {etat && <div style={{ fontSize: 12 }}>
      <h4 style={{ margin: "8px 0 4px" }}>Fournisseur OIDC (déclaré au registre — jamais de secret ici)</h4>
      <p>issuer : <strong>{etat.oidc.issuer ?? "—"}</strong> · audience : <strong>{etat.oidc.audience ?? "—"}</strong> ·
        {" "}secret : <strong>{etat.oidc.secretConfigure ? "configuré (coffre)" : "absent"}</strong></p>
      <h4 style={{ margin: "8px 0 4px" }}>Trousseau JWKS</h4>
      <p>kid courant : <code>{etat.jwks.kidCourant.slice(0, 8)}…</code> · dernière rotation : {etat.jwks.derniereRotation ?? "jamais (clé de démarrage)"}
        <input placeholder="motif de rotation (R7)" value={motifRotation} onChange={(e) => setMotifRotation(e.target.value)}
          style={{ marginLeft: 8, fontSize: 11 }}/>
        <button style={{ marginLeft: 4, fontSize: 11 }} disabled={isDemoMode()}
          onClick={() => agir(() => apiPost("/v1/admin/sso/jwks/rotation", { motif: motifRotation }), () => "Rotation effectuée — les jetons émis restent vérifiables (grâce).")}>Tourner la clé</button></p>
      <h4 style={{ margin: "8px 0 4px" }}>Mode d&apos;authentification : <strong>{etat.mode}</strong></h4>
      {etat.basculeEnAttente
        ? <p>Bascule vers <strong>{etat.basculeEnAttente.vers}</strong> (effet {etat.basculeEnAttente.effetAt.slice(0, 10)}) EN ATTENTE de visa d&apos;un second —
            <button style={{ marginLeft: 6, fontSize: 11 }} disabled={isDemoMode()}
              onClick={() => agir(() => apiPost("/v1/admin/sso/mode/visa", {}), (x: any) => `Bascule visée — effet au ${String(x.effetAt).slice(0, 10)} (les sessions du jour continuent).`)}>Viser (second regard)</button></p>
        : <p>
            <select value={bascule.vers} onChange={(e) => setBascule({ ...bascule, vers: e.target.value })} style={{ fontSize: 11 }}>
              <option value="sso">sso</option><option value="jwt">jwt</option></select>
            <input type="date" value={bascule.effetAt} onChange={(e) => setBascule({ ...bascule, effetAt: e.target.value })} style={{ marginLeft: 4, fontSize: 11 }}/>
            <input placeholder="motif (R7)" value={bascule.motif} onChange={(e) => setBascule({ ...bascule, motif: e.target.value })} style={{ marginLeft: 4, fontSize: 11 }}/>
            <button style={{ marginLeft: 4, fontSize: 11 }} disabled={isDemoMode()}
              onClick={() => agir(() => apiPost("/v1/admin/sso/mode", { vers: bascule.vers,
                effetAt: bascule.effetAt ? new Date(bascule.effetAt).toISOString() : undefined, motif: bascule.motif }),
                () => "Bascule demandée — en attente du visa d'un SECOND (R13).")}>Demander la bascule</button></p>}
    </div>}
  </div>;
}
