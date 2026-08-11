import React, { useEffect, useState } from "react";
import { apiPost, apiGetSourced, isDemoMode, type OliveError } from "../lib/api";
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
  // Certaines familles d'actes sont des LECTURES qui font partie du geste — relire la matrice
  // à une date (R453/R29), rejouer un verdict d'époque (R48), demander la conformité d'un
  // voyage. Elles n'écrivent rien, et l'écran doit le dire aussi clairement que pour une
  // écriture : une lecture qui retombe sur un seed n'est pas une lecture du moteur.
  const lire = async (route: string) => {
    setEtat({ phase: "envoi" });
    const r = await apiGetSourced<unknown>(route, null);
    if (r.isDemo) {
      setEtat({ phase: "refus", erreur: { code: "DEMO_MODE", status: 0,
        message: "Mode démonstration — le moteur n'a pas répondu, aucune donnée réelle n'est affichée" } });
      return;
    }
    setEtat({ phase: "succes", reponse: r.data });
  };
  return { etat, poser, lire, reinitialiser: () => setEtat({ phase: "repos" }) };
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

// ══════════════════════════════════════════════════════════════════════════════════════════
// LA BARRE D'ACTES, MUTUALISÉE (V2-M37)
//
// Cross-Border (V2-M36) puis Rapports (V2-M37) posent leurs actes de la même façon ; une
// deuxième copie du même formulaire aurait été le début de la dérive que ce chantier corrige.
// Un acte se déclare : son libellé, sa route, sa GARDE en toutes lettres, sa méthode, et les
// champs que le MOTEUR exige. L'écran ne re-implémente aucune garde — un acte incomplet part
// et se fait refuser, avec la règle du moteur affichée.

export type Champ = { cle: string; libelle: string; exemple?: string };
export type ActeMoteur = { cle: string; libelle: string; route: string; garde: string;
  methode?: "POST" | "GET"; champs?: Champ[] };

export function BarreActes({ actes, t, ouvrirCle }: {
  actes: ActeMoteur[]; t: (s: string) => string;
  /** Ouvre un acte depuis l'extérieur — une ligne de liste mène à l'acte qui la concerne
   *  (V2-M33). L'utilisateur reste maître ensuite : il peut en ouvrir un autre. */
  ouvrirCle?: string | null;
}) {
  const [ouvert, setOuvert] = useState<ActeMoteur | null>(null);
  const [saisie, setSaisie] = useState<Record<string, string>>({});
  const moteur = useActeMoteur();
  useEffect(() => {
    if (!ouvrirCle) return;
    const a = actes.find((x) => x.cle === ouvrirCle);
    if (a) { setOuvert(a); setSaisie({}); }
  }, [ouvrirCle]);

  // `:id`, `:empreinte` et `asOf` ne sont pas des champs du CORPS : ce sont des morceaux de la
  // ROUTE. On les y place, et la route résolue est affichée avec le retour — c'est elle qui
  // distingue un rejeu d'une lecture courante.
  const DANS_LA_ROUTE = [":id", ":empreinte", "asOf"];
  const routeResolue = (a: ActeMoteur) => {
    let r = a.route.replace(/^(POST|GET)\s+/, "");
    for (const p of [":id", ":empreinte"]) if (r.includes(p)) r = r.replace(p, encodeURIComponent(saisie[p] || p));
    if (a.methode === "GET" && saisie.asOf) r += `?asOf=${encodeURIComponent(saisie.asOf)}`;
    return r;
  };
  const poser = (a: ActeMoteur) => {
    const route = routeResolue(a);
    if (a.methode === "GET") { void moteur.lire(route); return; }
    const corps: Record<string, unknown> = {};
    for (const c of a.champs ?? []) {
      if (DANS_LA_ROUTE.includes(c.cle)) continue;
      if (saisie[c.cle]) corps[c.cle] = saisie[c.cle];
    }
    void moteur.poser(route, corps);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actes.map((a) => (
          <button key={a.cle} onClick={() => {
            setOuvert(ouvert?.cle === a.cle ? null : a); setSaisie({}); moteur.reinitialiser(); }}
            style={{ padding: "7px 13px", borderRadius: "var(--r-input)", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${ouvert?.cle === a.cle ? "var(--brand)" : "var(--border-input)"}`,
              background: ouvert?.cle === a.cle ? "var(--brand-surface)" : "var(--bg-surface)",
              color: ouvert?.cle === a.cle ? "var(--brand)" : "var(--text-secondary)" }}>
            {t(a.libelle)}</button>))}
      </div>
      {ouvert && (
        <div role="status" style={{ marginTop: 9, background: "var(--warn-card)",
          border: "1px solid var(--warn-card-border)", borderLeft: "3px solid var(--warn-line)",
          borderRadius: 9, padding: "11px 13px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{t(ouvert.libelle)}</div>
          {/* La garde AVANT le formulaire : on sait ce qui sera refusé avant de saisir. */}
          <div style={{ fontSize: 12, color: "var(--text-body)", marginTop: 4, lineHeight: 1.55 }}>
            {t(ouvert.garde)}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 6 }}>
            {ouvert.route}</div>
          {(ouvert.champs ?? []).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 8, marginTop: 10 }}>
              {(ouvert.champs ?? []).map((c) => (
                <label key={c.cle} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {t(c.libelle)}
                  <input value={saisie[c.cle] ?? ""} aria-label={t(c.libelle)} placeholder={c.exemple ?? ""}
                    onChange={(e) => setSaisie({ ...saisie, [c.cle]: e.target.value })}
                    style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 4,
                      padding: "7px 9px", borderRadius: "var(--r-input)", fontFamily: "inherit",
                      border: "1px solid var(--border-input)", fontSize: 12, color: "var(--text)",
                      background: "var(--bg-surface)" }} /></label>))}
            </div>)}
          <div style={{ marginTop: 10 }}>
            <button onClick={() => poser(ouvert)}
              style={{ padding: "9px 14px", borderRadius: "var(--r-input)", fontFamily: "inherit",
                fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid var(--brand)",
                background: "var(--brand)", color: "#fff" }}>
              {t(ouvert.methode === "GET" ? "Interroger le moteur" : "Poser l'acte")}</button>
          </div>
          <RetourActe etat={moteur.etat} route={routeResolue(ouvert)} t={t} />
        </div>)}
    </div>);
}
