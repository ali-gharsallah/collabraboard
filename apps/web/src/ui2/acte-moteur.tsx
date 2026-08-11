import React, { useState } from "react";
import { apiPost, isDemoMode, type OliveError } from "../lib/api";
import { StatusChip } from "./StatusChip";

/**
 * UI v2 — L'ACTE QUI PART VRAIMENT (V2-M35).
 *
 * Constat du lot V2-M34 : l'UI v2 ne faisait AUCUNE écriture vers le moteur. Elle décrivait
 * ses actes — chacun nommait sa garde et sa route — sans jamais les poser. Ce module est la
 * pièce qui manquait, et elle tient en une phrase : **un refus du moteur doit s'AFFICHER**.
 *
 * POURQUOI LE REFUS EST LE SUJET, pas le succès. Les gardes du produit — motif obligatoire
 * (R7), second regard (R13), engagement de responsabilité (R445), rôle habilité (R294) — ne
 * vivent qu'au moteur. Une UI qui avale les erreurs les rend invisibles : l'utilisateur croit
 * avoir agi, la banque croit la garde active, et personne ne voit que rien n'a été écrit.
 * Ici le message du serveur est rendu TEL QUEL (FE-04, jamais reformulé), la liste de refus
 * voyage ENTIÈRE (R269/R306, jamais tronquée) et le pop-up R445 est porté à l'écran.
 *
 * MODE DÉMONSTRATION : `apiPost` refuse d'écrire quand l'API n'est pas connectée, et ce refus
 * est affiché comme les autres. On ne simule JAMAIS une écriture — un succès inventé est le
 * mensonge que ce lot est venu corriger.
 */

export type EtatActe =
  | { phase: "repos" }
  | { phase: "envoi" }
  | { phase: "succes"; reponse: unknown }
  | { phase: "refus"; erreur: OliveError };

export function useActeMoteur() {
  const [etat, setEtat] = useState<EtatActe>({ phase: "repos" });
  const poser = async (route: string, corps: unknown) => {
    setEtat({ phase: "envoi" });
    try {
      const reponse = await apiPost<unknown>(route, corps);
      setEtat({ phase: "succes", reponse });
    } catch (e) {
      const erreur = e as OliveError;
      setEtat({ phase: "refus", erreur: erreur?.message
        ? erreur
        : { code: "ERREUR", status: 0, message: String(e) } });
    }
  };
  return { etat, poser, reinitialiser: () => setEtat({ phase: "repos" }) };
}

/** Rendu de l'issue d'un acte — succès, refus, ou envoi. Rien n'est masqué, rien n'est reformulé. */
export function RetourActe({ etat, route, t }: {
  etat: EtatActe; route: string; t: (s: string) => string;
}) {
  if (etat.phase === "repos") return null;
  if (etat.phase === "envoi") {
    return (
      <div role="status" style={{ marginTop: 9, fontSize: 12, color: "var(--text-muted)" }}>
        {t("Envoi au moteur…")} <span className="mono">{route}</span></div>);
  }
  if (etat.phase === "succes") {
    return (
      <div role="status" style={{ marginTop: 9, background: "var(--ok-chip)",
        border: "1px solid var(--ok-line)", borderRadius: 9, padding: "10px 12px",
        fontSize: 12, color: "var(--ok-text)", lineHeight: 1.5 }}>
        ✓ {t("Acte enregistré par le moteur — horodaté et nominatif. Il ne se supprime pas : il se corrige par un nouvel acte (R49).")}
        <div className="mono" style={{ fontSize: 10.5, marginTop: 5, opacity: 0.85 }}>{route}</div>
      </div>);
  }
  const e = etat.erreur;
  const demo = e.code === "DEMO_MODE" || isDemoMode();
  return (
    <div role="alert" style={{ marginTop: 9,
      background: demo ? "var(--bg-subtle)" : "var(--alert-card, var(--warn-card))",
      border: `1px solid ${demo ? "var(--border)" : "var(--alert-line)"}`,
      borderLeft: `3px solid ${demo ? "var(--info-line)" : "var(--alert-line)"}`,
      borderRadius: 9, padding: "10px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <StatusChip mode={demo ? "info" : "alert"}>
          {t(demo ? "AUCUNE ÉCRITURE" : "REFUSÉ PAR LE MOTEUR")}</StatusChip>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
          {e.code}{e.status ? ` · ${e.status}` : ""}</span>
      </div>
      {/* Le message du serveur, TEL QUEL — c'est lui qui porte la règle enfreinte. */}
      <div style={{ fontSize: 12.5, color: "var(--text)", marginTop: 6, lineHeight: 1.55 }}>
        {e.message}</div>
      {Array.isArray(e.refus) && e.refus.length > 0 && (
        <ul style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: 11.5,
          color: "var(--text-body)", lineHeight: 1.6 }}>
          {e.refus.map((r) => <li key={r}>{r}</li>)}
        </ul>)}
      {e.popup && (
        <div style={{ marginTop: 8, background: "var(--warn-card)",
          border: "1px solid var(--warn-card-border)", borderRadius: 8, padding: "9px 11px",
          fontSize: 11.5, color: "var(--warn-text)", lineHeight: 1.55 }}>
          {t("Engagement de responsabilité requis (R445) — le moteur a renvoyé le pop-up plutôt que d'écrire :")}
          <div className="mono" style={{ fontSize: 10.5, marginTop: 5, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(e.popup, null, 1)}</div>
        </div>)}
      <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
        {route}</div>
      {demo && (
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 5, lineHeight: 1.5 }}>
          {t("L'API n'est pas connectée : rien n'a été écrit et rien n'a été simulé. Un succès inventé serait un mensonge — l'écran préfère le dire.")}</div>)}
    </div>);
}
