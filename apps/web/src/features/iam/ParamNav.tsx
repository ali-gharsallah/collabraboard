import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { useConfirmGate } from "../../components/ConfirmValidation";  // contrat UX
import { tokens } from "../../theme/tokens";

/**
 * `paramnav` — utilisateurs & rôles : RENDU de MOD-30 (canon triage écrans, ratifié 2026-07-28).
 * AUCUNE nouvelle règle : l'écran appelle les routes existantes (/v1/admin/users — ADMIN-only,
 * garde serveur) et AFFICHE LES REFUS BACKEND TELS QUELS (IM-02) — cumul SO/ADMIN (SO-05, R284),
 * dernier ADMIN (IAM_DERNIER_ADMIN), rien n'est précalculé côté écran.
 * `ssoparam` est DIFFÉRÉ (extension MOD-30 à ratifier — verdict étape 0.d).
 */

type U = { id: string; email: string; name: string; role: string; active: boolean; mfaEnabled: boolean };
const ROLES = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN", "SO"];

export function ParamNav() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [msg, setMsg] = useState("");
  const [nouveau, setNouveau] = useState({ email: "", name: "", role: "RM", password: "" });
  const { ask, modal } = useConfirmGate();               // contrat UX : confirmation + pré-vol

  const charger = async () => {
    const r = await apiGetSourced<U[] | null>("/v1/admin/users", null);
    setUsers(r.isDemo ? null : r.data);
  };
  const agir = async (fn: () => Promise<unknown>) => {
    setMsg("");
    try { await fn(); await charger(); }
    catch (e) { setMsg((e as OliveError).message ?? "Erreur"); await charger(); }   // le refus backend, TEL QUEL
  };

  return <div>
    {modal}
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Utilisateurs & rôles (paramnav) — MOD-30 rendu, garde-fous serveur</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Cumul SO/ADMIN et retrait du dernier ADMIN sont refusés PAR LE BACKEND —
      l&apos;écran affiche le refus tel quel, il ne le précalcule pas (IM-02).</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      <input placeholder="email" value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} style={{ fontSize: 12 }}/>
      <input placeholder="nom" value={nouveau.name} onChange={(e) => setNouveau({ ...nouveau, name: e.target.value })} style={{ fontSize: 12 }}/>
      <select value={nouveau.role} onChange={(e) => setNouveau({ ...nouveau, role: e.target.value })} style={{ fontSize: 12 }}>
        {ROLES.map((r) => <option key={r}>{r}</option>)}</select>
      <input placeholder="mot de passe initial" type="password" value={nouveau.password}
        onChange={(e) => setNouveau({ ...nouveau, password: e.target.value })} style={{ fontSize: 12 }}/>
      <button disabled={isDemoMode()} style={{ fontSize: 12 }}
        onClick={() => ask({ title: "Créer un utilisateur",
          message: "Création d'un compte (garde serveur : cumul SO/ADMIN refusé, etc.).",
          items: [{ label: nouveau.email ? `Email : ${nouveau.email}` : "Email manquant", ok: !!nouveau.email },
            { label: `Rôle : ${nouveau.role}`, ok: true }, { label: nouveau.password ? "Mot de passe initial fourni" : "Mot de passe manquant", ok: !!nouveau.password }],
          confirmLabel: "Créer", onConfirm: () => agir(() => apiPost("/v1/admin/users", nouveau)) })}>Créer</button>
    </div>
    {msg && <p data-testid="msg-paramnav" style={{ fontSize: 12, color: tokens.color.danger }}>{msg}</p>}
    {users && <table cellPadding={4} style={{ borderCollapse: "collapse", fontSize: 12 }}><thead><tr>
      <th align="left">Email</th><th align="left">Nom</th><th>Rôle</th><th>MFA</th><th>Statut</th><th/></tr></thead>
      <tbody>{users.map((u) => <tr key={u.id} style={{ borderTop: `1px solid ${tokens.color.border}` }}>
        <td>{u.email}</td><td>{u.name}</td>
        <td><select data-testid={`role-${u.id}`} value={u.role} disabled={isDemoMode()}
          onChange={(e) => agir(() => apiPost(`/v1/admin/users/${u.id}/role`, { role: e.target.value }))}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
        <td style={{ textAlign: "center" }}>{u.mfaEnabled ? "✓" : "—"}
          {u.mfaEnabled && <button style={{ marginLeft: 4, fontSize: 10 }} disabled={isDemoMode()}
            onClick={() => ask({ title: "Réinitialiser le MFA", danger: true,
              message: `Réinitialise le second facteur de ${u.email}. Il devra le reconfigurer à sa prochaine connexion.`, confirmLabel: "Réinitialiser",
              onConfirm: () => agir(() => apiPost(`/v1/admin/users/${u.id}/reset-mfa`, {})) })}>réinit.</button>}</td>
        <td style={{ textAlign: "center" }}>{u.active ? "actif" : "désactivé"}</td>
        <td><button style={{ fontSize: 11 }} disabled={isDemoMode()}
          onClick={() => ask({ title: u.active ? "Désactiver l'utilisateur" : "Réactiver l'utilisateur", danger: u.active,
            message: u.active ? `${u.email} ne pourra plus se connecter (le retrait du dernier ADMIN est refusé serveur).` : `${u.email} pourra de nouveau se connecter.`,
            confirmLabel: u.active ? "Désactiver" : "Réactiver",
            onConfirm: () => agir(() => apiPost(`/v1/admin/users/${u.id}/active`, { active: !u.active })) })}>
          {u.active ? "Désactiver" : "Réactiver"}</button></td>
      </tr>)}</tbody></table>}
  </div>;
}
