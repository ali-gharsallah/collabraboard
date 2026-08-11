import React, { lazy, Suspense, useState } from "react";
import { CITY, FLOWS, COLOR, LABEL, RISK_TIERS, type Flux, type Statut } from "./flux-data";
import { traduire, langue } from "../../lib/i18n";

/**
 * UI v2 — LA SCÈNE DES FLUX (V2-M22). Le globe est le FOND de l'onglet Transactions ; les KPI,
 * les corridors et la table des transactions (passée en `children`) se lisent PAR-DESSUS.
 *
 * Ce fichier part avec l'écran — il ne contient ni d3 ni atlas. Seul `GlobeFond` est paresseux :
 * la table ne doit jamais attendre le décor pour s'afficher (leçon de la première version, où
 * la table était à l'intérieur du composant paresseux et disparaissait des tests).
 *
 * La scène prend la couleur de la page (--bg-app) : pas de bordure de carte, l'onglet est d'un
 * seul tenant. Ce qui flotte au-dessus du globe est posé sur un voile clair — la lisibilité
 * prime sur l'effet.
 */
const GlobeFond = lazy(() => import("./GlobeFond").then((m) => ({ default: m.GlobeFond })));

export function FluxPanneau({ children }: { children?: React.ReactNode }) {
  const t = traduire(langue());
  const [focus, setFocus] = useState<Flux | null>(null);

  // Les KPI sont CALCULÉS des flux, jamais saisis : un chiffre écrit en dur devient faux dès
  // que la donnée bouge.
  const total = FLOWS.reduce((s, f) => s + f.v, 0);
  const operations = FLOWS.reduce((s, f) => s + f.n, 0);
  const enAlerte = FLOWS.filter((f) => f.s === "alert");
  const sousSurv = FLOWS.filter((f) => f.s === "watch");
  const partAlerte = Math.round((enAlerte.reduce((s, f) => s + f.v, 0) / total) * 1000) / 10;

  const KPI: { v: string; l: string; mode?: Statut }[] = [
    { v: String(FLOWS.length), l: t("corridors actifs") },
    { v: total.toLocaleString("fr-CH"), l: t("MCHF par mois") },
    { v: operations.toLocaleString("fr-CH"), l: t("opérations") },
    { v: String(sousSurv.length), l: t("sous surveillance"), mode: "watch" },
    { v: String(enAlerte.length), l: t("en alerte AML"), mode: "alert" },
    { v: `${String(partAlerte).replace(".", ",")} %`, l: t("du volume en alerte"), mode: "alert" },
  ];

  return (
    <section style={{ position: "relative", background: "var(--bg-app)",
      borderRadius: "var(--r-card)", overflow: "hidden", padding: "12px 16px 16px",
      minHeight: 780, display: "grid", gridTemplateRows: "auto 1fr auto", gap: 10 }}>
      <Suspense fallback={null}>
        <GlobeFond focus={focus} />
      </Suspense>

      {/* HAUT DE SCÈNE — les KPI, petits et SANS FOND (V2-M27). Ils se posent directement sur
          la carte : plus de tuile, seul le liseré de statut subsiste pour les trois indicateurs
          de risque. L'encre reste au-dessus de 7:1 sur les pastels de la carte. */}
      <div className="globe-kpis" style={{ position: "relative", zIndex: 1, display: "grid",
        gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8,
        width: "min(100%, 980px)", margin: "0 auto" }}>
        {KPI.map((k) => (
          <div key={k.l} style={{ padding: "2px 0 2px 9px",
            borderLeft: `2px solid ${k.mode ? COLOR[k.mode] : "rgba(23,28,34,0.18)"}` }}>
            <div className="mono" style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em",
              color: k.mode ? COLOR[k.mode] : "var(--text)" }}>{k.v}</div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 1 }}>{k.l}</div>
          </div>))}
      </div>

      {/* MILIEU — laissé vide : c'est la coupole qui l'occupe. */}
      <div aria-hidden />

      {/* BAS DE SCÈNE — corridors, légendes, puis la liste des transactions, transparente et
          DÉFILANTE dans sa propre hauteur : la page ne s'allonge plus avec le nombre de lignes. */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 10,
        width: "min(100%, 980px)", margin: "0 auto" }}>
        <div className="globe-corridors" style={{ display: "flex", gap: 8, overflowX: "auto",
          paddingBottom: 2 }}>
          {FLOWS.map((f) => (
            <button key={`${f.a}-${f.b}`} onClick={() => setFocus(focus === f ? null : f)}
              aria-pressed={focus === f}
              style={{ flexShrink: 0, textAlign: "left", font: "inherit", cursor: "pointer",
                borderRadius: 9, padding: "6px 10px", backdropFilter: "blur(6px)",
                border: `1px solid ${focus === f ? COLOR[f.s] : "rgba(23,28,34,0.14)"}`,
                background: focus === f ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                  background: COLOR[f.s] }} />
                <span style={{ fontSize: 11.5, color: "var(--text)", whiteSpace: "nowrap" }}>
                  {CITY[f.a].name} → {CITY[f.b].name}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-body)",
                  whiteSpace: "nowrap" }}>{f.v}</span>
              </div>
              <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginLeft: 13,
                whiteSpace: "nowrap" }}>
                {f.n.toLocaleString("fr-CH")} {t("op.")} · {t(LABEL[f.s])}</div>
            </button>))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 10.5,
          color: "var(--text-muted)", alignItems: "center" }}>
          <span className="microlabel">{t("risque pays")}</span>
          {RISK_TIERS.map((r) => (
            <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: r.fill,
                border: `1px solid ${r.stroke}` }} />{t(r.label)}</span>))}
          <span className="microlabel" style={{ marginLeft: 4 }}>{t("flux")}</span>
          {(["ok", "watch", "alert"] as Statut[]).map((s2) => (
            <span key={s2} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: COLOR[s2] }} />
              {t(LABEL[s2])}</span>))}
          <span style={{ marginLeft: "auto" }}>{t("glisser pour tourner · molette pour zoomer")}</span>
        </div>

        {/* La liste défile dans sa propre hauteur — l'en-tête reste collé en haut du cadre. */}
        {children && (
          <div style={{ maxHeight: 236, overflowY: "auto", overscrollBehavior: "contain" }}>
            {children}</div>)}

        <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {t("Le globe MONTRE des volumes et des statuts déjà qualifiés ailleurs. Il ne qualifie rien, ne lève aucune alerte et ne décide d'aucun blocage (R44). Les paliers de risque pays affichés sont une classification de démonstration — la matrice pays en vigueur est une configuration gouvernée.")}</div>
      </div>
      {/* La règle mobile générale de tokens.css (`.ui2 main div → 1fr !important`) empile TOUTES
          les grilles ; six KPI en colonne mangeraient l'écran avant que la coupole apparaisse.
          On la surclasse en spécificité (classe répétée) pour garder une bande compacte. */}
      <style>{`@media (max-width: 900px){
        .ui2 main div.globe-kpis.globe-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}
      }
      @media (max-width: 520px){
        .ui2 main div.globe-kpis.globe-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      }
      /* Même raison pour la bande de corridors : repliée, elle empile seize pastilles et
         repousse la coupole d'un écran entier. Elle DÉFILE latéralement, dans son cadre. */
      .ui2 main div.globe-corridors.globe-corridors{flex-wrap:nowrap!important}`}</style>
    </section>);
}

export default FluxPanneau;
