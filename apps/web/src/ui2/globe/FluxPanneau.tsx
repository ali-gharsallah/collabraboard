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
      borderRadius: "var(--r-card)", overflow: "hidden", padding: "26px 16px 22px",
      minHeight: 700, display: "grid", alignContent: "center" }}>
      <Suspense fallback={null}>
        <GlobeFond focus={focus} />
      </Suspense>

      {/* La colonne de contenu est plus étroite que la scène : le globe se voit de part et
          d'autre. C'est ce qui fait la différence entre un fond et une image cachée. */}
      <div style={{ position: "relative", zIndex: 1, display: "grid", gap: 12,
        width: "min(100%, 980px)", margin: "0 auto" }}>
        <div className="globe-kpis" style={{ display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10 }}>
          {KPI.map((k) => (
            <div key={k.l} style={{ background: "rgba(255,255,255,0.86)", backdropFilter: "blur(8px)",
              border: "1px solid var(--border)",
              borderLeft: k.mode ? `3px solid ${COLOR[k.mode]}` : "1px solid var(--border)",
              borderRadius: 11, padding: "10px 13px" }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.02em",
                color: k.mode ? COLOR[k.mode] : "var(--text)" }}>{k.v}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>{k.l}</div>
            </div>))}
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          {FLOWS.map((f) => (
            <button key={`${f.a}-${f.b}`} onClick={() => setFocus(focus === f ? null : f)}
              aria-pressed={focus === f}
              style={{ flexShrink: 0, textAlign: "left", font: "inherit", cursor: "pointer",
                borderRadius: 9, padding: "7px 11px", backdropFilter: "blur(6px)",
                border: `1px solid ${focus === f ? COLOR[f.s] : "var(--border)"}`,
                background: focus === f ? "var(--bg-surface)" : "rgba(255,255,255,0.82)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, flexShrink: 0,
                  background: COLOR[f.s] }} />
                <span style={{ fontSize: 12, color: "var(--text)", whiteSpace: "nowrap" }}>
                  {CITY[f.a].name} → {CITY[f.b].name}</span>
                <span className="mono" style={{ fontSize: 11.5, color: "var(--text-body)",
                  whiteSpace: "nowrap" }}>{f.v}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 13,
                whiteSpace: "nowrap" }}>
                {f.n.toLocaleString("fr-CH")} {t("op.")} · {t(LABEL[f.s])}</div>
            </button>))}
        </div>

        {children && (
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
            {children}</div>)}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 11,
          color: "var(--text-muted)", alignItems: "center" }}>
          <span className="microlabel">{t("risque pays")}</span>
          {RISK_TIERS.map((r) => (
            <span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: r.fill,
                border: `1px solid ${r.stroke}` }} />{t(r.label)}</span>))}
          <span className="microlabel" style={{ marginLeft: 6 }}>{t("flux")}</span>
          {(["ok", "watch", "alert"] as Statut[]).map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: COLOR[s] }} />
              {t(LABEL[s])}</span>))}
          <span style={{ marginLeft: "auto" }}>{t("glisser pour tourner · molette pour zoomer")}</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {t("Le globe MONTRE des volumes et des statuts déjà qualifiés ailleurs. Il ne qualifie rien, ne lève aucune alerte et ne décide d'aucun blocage (R44). Les paliers de risque pays affichés sont une classification de démonstration — la matrice pays en vigueur est une configuration gouvernée.")}</div>
      </div>
      <style>{`@media (max-width: 900px){ .globe-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important} }`}</style>
    </section>);
}

export default FluxPanneau;
