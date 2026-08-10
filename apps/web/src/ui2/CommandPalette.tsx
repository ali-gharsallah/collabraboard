import React, { useEffect, useMemo, useRef, useState } from "react";
import "./tokens.css";
import { apiGetSourced } from "../lib/api";
import { traduire, langue } from "../lib/i18n";
import clientsSeed from "../seed/clients.json";
import kycSeed from "../seed/kyc.json";

/**
 * UI v2 — étape 4 : la palette de commandes ⌘K (handoff §Interactions).
 * Le PIVOT de l'architecture à 10 entrées : recherche unifiée clients · dossiers KYC · ÉCRANS,
 * résultats groupés par type (5 par groupe), navigation au clavier (↑ ↓ · Entrée ouvre · Échap
 * ferme), recherche floue insensible aux accents sur le nom ET l'identifiant. Un écran rare n'a
 * pas d'entrée de menu — il a besoin d'être trouvable en deux frappes. Les données viennent de
 * l'API quand elle répond (source signalée), du seed sinon (apiGetSourced — jamais masqué).
 */

type Resultat = { groupe: string; libelle: string; detail: string; cible: string };

const ECRANS: { id: string; libelle: string }[] = [
  { id: "journee", libelle: "Ma journée" }, { id: "dossiers", libelle: "Mes dossiers" },
  { id: "clients", libelle: "Mes clients" }, { id: "entree", libelle: "Entrée en relation" },
  { id: "kyc", libelle: "Connaissance client" }, { id: "surveillance", libelle: "Surveillance" },
  { id: "revue", libelle: "Revue & sortie" }, { id: "rapports", libelle: "Rapports" },
  { id: "param", libelle: "Paramétrage" },
];

const plat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Flou : sous-chaîne insensible aux accents ; les préfixes remontent en tête. */
export function scorer(requete: string, texte: string): number {
  const q = plat(requete), t = plat(texte);
  if (!q) return 0;
  const i = t.indexOf(q);
  if (i < 0) return -1;
  return i === 0 ? 2 : 1;
}

export function chercher(requete: string, sources: { ecrans: typeof ECRANS;
  clients: { id: string; name: string }[]; kycs: { code: string; status: string }[] },
  tr: (s: string) => string): Resultat[] {
  const rangs = (xs: { score: number; r: Resultat }[]) =>
    xs.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map((x) => x.r);
  return [
    ...rangs(sources.ecrans.map((e) => ({ score: scorer(requete, tr(e.libelle)),
      r: { groupe: "Écrans", libelle: tr(e.libelle), detail: "", cible: e.id } }))),
    ...rangs(sources.clients.map((c) => ({ score: Math.max(scorer(requete, c.name), scorer(requete, c.id)),
      r: { groupe: "Clients", libelle: c.name, detail: c.id, cible: "clients" } }))),
    ...rangs(sources.kycs.map((k) => ({ score: scorer(requete, k.code),
      r: { groupe: "Dossiers KYC", libelle: k.code, detail: k.status, cible: "kyc" } }))),
  ];
}

export function CommandPalette({ ouvert, onOuvrir, onFermer, onNavigate }: {
  ouvert: boolean; onOuvrir: () => void; onFermer: () => void; onNavigate: (id: string) => void;
}) {
  const t = traduire(langue());
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<{ id: string; name: string }[]>(clientsSeed as never);
  const [kycs, setKycs] = useState<{ code: string; status: string }[]>(kycSeed as never);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {                                            // ⌘K / Ctrl+K global, Échap ferme
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (ouvert) onFermer(); else onOuvrir(); }
      if (ouvert && e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ouvert, onOuvrir, onFermer]);

  useEffect(() => {
    if (!ouvert) return;
    setQ(""); setSel(0);
    setTimeout(() => champ.current?.focus(), 30);
    apiGetSourced<{ data: { id: string; name: string }[] }>("/v1/clients", { data: clientsSeed as never })
      .then((r) => setClients(r.data.data ?? (r.data as never)));
    apiGetSourced<{ code: string; status: string }[]>("/v1/kyc", kycSeed as never)
      .then((r) => setKycs(Array.isArray(r.data) ? r.data : (kycSeed as never)));
  }, [ouvert]);

  const resultats = useMemo(() => chercher(q, { ecrans: ECRANS, clients, kycs }, t), [q, clients, kycs, t]);
  const ouvrir = (r: Resultat) => { onNavigate(r.cible); onFermer(); };

  if (!ouvert) return null;
  let dernierGroupe = "";
  return (
    <div className="ui2" role="dialog" aria-modal="true" aria-label={t("Palette de commandes")}
      onClick={onFermer} style={{ position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(23,28,34,0.45)", display: "flex", justifyContent: "center",
      alignItems: "flex-start", paddingTop: "14vh" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "92vw",
        background: "var(--bg-surface)", borderRadius: "var(--r-window)",
        boxShadow: "0 18px 50px rgba(23,28,34,0.24)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px",
          borderBottom: "1px solid var(--border)" }}>
          <span aria-hidden style={{ color: "var(--text-muted)" }}>⌕</span>
          <input ref={champ} value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, resultats.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter" && resultats[sel]) ouvrir(resultats[sel]);
            }}
            placeholder={t("Client, dossier, écran…")} aria-label={t("Recherche unifiée")}
            style={{ flex: 1, border: "none", outline: "none", fontFamily: "inherit",
              fontSize: 14, color: "var(--text)", background: "transparent" }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)",
            border: "1px solid var(--border-input)", borderRadius: 5, padding: "1px 6px" }}>{t("Échap")}</span>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
          {q && resultats.length === 0 && (
            <div style={{ padding: "14px 16px", fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
              {t("Aucun résultat — cherchez un nom, un identifiant ou un écran.")}</div>)}
          {!q && (
            <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--text-muted)" }}>
              {t("Tapez pour chercher un client, un dossier KYC ou un écran — ↑ ↓ pour naviguer, Entrée pour ouvrir.")}</div>)}
          {resultats.map((r, i) => {
            const entete = r.groupe !== dernierGroupe; dernierGroupe = r.groupe;
            return (
              <React.Fragment key={`${r.groupe}:${r.libelle}:${i}`}>
                {entete && <div className="microlabel" style={{ padding: "9px 16px 4px" }}>{t(r.groupe)}</div>}
                <button onClick={() => ouvrir(r)} onMouseEnter={() => setSel(i)}
                  style={{ display: "flex", alignItems: "baseline", gap: 10, width: "100%",
                    textAlign: "left", padding: "8px 16px", border: "none", cursor: "pointer",
                    fontFamily: "inherit",
                    background: i === sel ? "var(--brand-surface)" : "transparent" }}>
                  <span style={{ fontSize: 13, fontWeight: i === sel ? 600 : 400,
                    color: i === sel ? "var(--brand)" : "var(--text)", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis" }}>{r.libelle}</span>
                  {r.detail && <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)",
                    whiteSpace: "nowrap" }}>{r.detail}</span>}
                  {i === sel && <span className="mono" style={{ marginLeft: "auto", fontSize: 10,
                    color: "var(--text-muted)" }}>↵</span>}
                </button>
              </React.Fragment>);
          })}
        </div>
      </div>
    </div>);
}
