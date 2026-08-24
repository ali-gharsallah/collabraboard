import React, { useState } from "react";
import { StatusChip } from "./StatusChip";
import { Ui2Bouton } from "./Header";

/**
 * UI v2 — V2-M9 : l'ÉDITION depuis le Paramétrage, comme en v1 mais en formulaire (le Builder
 * v1, R304-R308, édite du JSON brut). Même circuit gouverné, inchangé : les modifications ne
 * touchent qu'un BROUILLON local ; le diff avant/après se voit AVANT toute soumission ;
 * la simulation (R305) précède la publication ; la publication exige un motif (R7) et un
 * SECOND habilité (R13) — l'auteur ne publie jamais lui-même. La version en vigueur reste
 * intouchée jusqu'à publication (R29) ; en mode branché, tout passe par /v1/builder (R306
 * renvoie ses refus de cohérence en liste complète).
 */

export type LigneMatrice = { code: string; exigence: string; sdd: string; cdd: string; edd: string };
export const NIVEAUX_CELLULE = ["OBLIGATOIRE", "DÉCLARATIVE", "SI STRUCTURE", "SI > 1 MCHF", "SI PM", "—"];

type DiffItem = { cible: string; avant: string; apres: string; genre: "MODIFIÉ" | "AJOUTÉ" | "RETIRÉ" };

const inputStyle: React.CSSProperties = { fontFamily: "inherit", fontSize: 12, padding: "6px 9px",
  borderRadius: 8, border: "1px solid var(--border-input)", background: "var(--bg-surface)",
  color: "var(--text)", width: "100%", boxSizing: "border-box" };

function DiffListe({ items, t }: { items: DiffItem[]; t: (s: string) => string }) {
  if (items.length === 0) return (
    <div style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "10px 0" }}>
      {t("Aucun écart avec la version en vigueur — rien à soumettre.")}</div>);
  return (
    <section style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
      borderRadius: "var(--r-card)", padding: "12px 14px", margin: "12px 0" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--warn-text)", marginBottom: 7 }}>
        {`${t("Écarts du brouillon")} (${items.length})`}</div>
      {items.map((d) => (
        <div key={d.genre + d.cible} style={{ display: "flex", gap: 8, alignItems: "baseline",
          padding: "5px 0", borderBottom: "1px solid var(--border-row)", flexWrap: "wrap" }}>
          <StatusChip mode={d.genre === "RETIRÉ" ? "alert" : d.genre === "AJOUTÉ" ? "ok" : "warn"}>{t(d.genre)}</StatusChip>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text)" }}>{d.cible}</span>
          {d.genre === "MODIFIÉ" && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d.avant}</span>}
          {d.genre === "MODIFIÉ" && <span aria-hidden style={{ color: "var(--text-muted)" }}>→</span>}
          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--warn-text)" }}>
            {d.genre === "RETIRÉ" ? d.avant : d.apres}</span>
        </div>))}
    </section>);
}

// Pied de circuit commun : simuler (R305) PUIS soumettre avec motif (R7) à un second (R13).
function CircuitGouverne({ nbEcarts, t }: { nbEcarts: number; t: (s: string) => string }) {
  const [simule, setSimule] = useState(false);
  const [motif, setMotif] = useState("");
  const [etat, setEtat] = useState<"" | "SANS_MOTIF" | "SOUMIS">("");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Ui2Bouton onClick={() => { if (nbEcarts > 0) setSimule(true); }}>{t("Simuler (bac à sable, R305)")}</Ui2Bouton>
        <input aria-label={t("motif de publication (R7)")} placeholder={t("motif de publication (R7)")}
          value={motif} onChange={(e) => setMotif(e.target.value)} style={{ ...inputStyle, width: 230 }} />
        <Ui2Bouton primaire onClick={() => setEtat(motif.trim() ? "SOUMIS" : "SANS_MOTIF")}>
          {t("Soumettre le brouillon")}</Ui2Bouton>
      </div>
      {simule && nbEcarts > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 8, lineHeight: 1.55 }}>
          <StatusChip mode="ai">{t("SIMULATION")}</StatusChip>{" "}
          {t("données maquette — en mode branché, le rapport d'impact est SERVI par le moteur (dossiers en cours concernés, charge par rôle) et toute modification du brouillon l'invalide.")}</div>)}
      {etat === "SANS_MOTIF" && (
        <div role="alert" style={{ fontSize: 11.5, color: "var(--alert-text)", marginTop: 8 }}>
          {t("Refusé : le motif de publication est obligatoire (R7).")}</div>)}
      {etat === "SOUMIS" && (
        <div role="status" style={{ fontSize: 11.5, color: "var(--ok-text)", marginTop: 8, lineHeight: 1.55 }}>
          ✓ {t("Brouillon soumis — la publication exige un SECOND habilité (R13, l'auteur ne publie pas lui-même) ; les refus de cohérence éventuels (R306) reviendront en liste complète. La version en vigueur reste inchangée jusqu'à publication.")}</div>)}
    </div>);
}

// ── Éditeur de la MATRICE DOCUMENTAIRE : libellés d'exigence + composition du tableau
// (cellules par niveau, ajout / retrait de lignes).
export function EditeurMatriceDoc({ base, t }: { base: LigneMatrice[]; t: (s: string) => string }) {
  const [lignes, setLignes] = useState<LigneMatrice[]>(base.map((l) => ({ ...l })));
  const [retirees, setRetirees] = useState<string[]>([]);
  const poser = (code: string, champ: keyof LigneMatrice, valeur: string) =>
    setLignes((ls) => ls.map((l) => (l.code === code ? { ...l, [champ]: valeur } : l)));
  const ajouter = () => {
    const n = lignes.filter((l) => l.code.startsWith("NV-")).length + 1;
    setLignes((ls) => [...ls, { code: `NV-0${n}`, exigence: "Nouvelle exigence",
      sdd: "—", cdd: "—", edd: "OBLIGATOIRE" }]);
  };
  const retirer = (code: string) => {
    setLignes((ls) => ls.filter((l) => l.code !== code));
    if (base.some((b) => b.code === code)) setRetirees((r) => [...r, code]);
  };

  const diff: DiffItem[] = [];
  for (const l of lignes) {
    const b = base.find((x) => x.code === l.code);
    if (!b) { diff.push({ cible: l.code, avant: "", apres: l.exigence, genre: "AJOUTÉ" }); continue; }
    if (b.exigence !== l.exigence)
      diff.push({ cible: `${l.code} · ${t("libellé")}`, avant: b.exigence, apres: l.exigence, genre: "MODIFIÉ" });
    for (const niv of ["sdd", "cdd", "edd"] as const) if (b[niv] !== l[niv])
      diff.push({ cible: `${l.code} · ${niv.toUpperCase()}`, avant: b[niv], apres: l[niv], genre: "MODIFIÉ" });
  }
  for (const code of retirees) {
    const b = base.find((x) => x.code === code);
    if (b) diff.push({ cible: code, avant: b.exigence, apres: "", genre: "RETIRÉ" });
  }

  const sel = (l: LigneMatrice, niv: "sdd" | "cdd" | "edd") => (
    <select aria-label={`${l.code} ${niv.toUpperCase()}`} value={l[niv]}
      onChange={(e) => poser(l.code, niv, e.target.value)}
      style={{ ...inputStyle, padding: "5px 6px", width: "auto", minWidth: 0 }}>
      {NIVEAUX_CELLULE.map((n) => <option key={n} value={n}>{t(n)}</option>)}
    </select>);

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 9, lineHeight: 1.5 }}>
        {t("Brouillon local — la version en vigueur reste intouchée. Libellés et composition du tableau se modifient ici ; le diff se voit avant toute soumission.")}</div>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", overflowX: "auto" }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "70px 1.6fr 1fr 1fr 1fr 40px",
          alignItems: "center", padding: "0 14px", background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)" }}>
          {[t("Code"), t("Exigence"), "SDD", "CDD", "EDD", ""].map((h, i) => (
            <span key={i} className="microlabel" style={{ padding: "9px 8px 9px 0" }}>{h}</span>))}
        </div>
        {lignes.map((l) => (
          <div role="row" key={l.code} style={{ display: "grid",
            gridTemplateColumns: "70px 1.6fr 1fr 1fr 1fr 40px", alignItems: "center", gap: 6,
            padding: "7px 14px", borderBottom: "1px solid var(--border-row)" }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{l.code}</span>
            <input aria-label={`${t("libellé")} ${l.code}`} value={l.exigence}
              onChange={(e) => poser(l.code, "exigence", e.target.value)} style={inputStyle} />
            {sel(l, "sdd")}{sel(l, "cdd")}{sel(l, "edd")}
            <button aria-label={`${t("retirer")} ${l.code}`} onClick={() => retirer(l.code)}
              style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                color: "var(--alert-text)", fontSize: 15, lineHeight: 1 }}>×</button>
          </div>))}
      </section>
      <div style={{ margin: "10px 0" }}>
        <Ui2Bouton onClick={ajouter}>{t("+ Ajouter une exigence")}</Ui2Bouton></div>
      <DiffListe items={diff} t={t} />
      <CircuitGouverne nbEcarts={diff.length} t={t} />
    </div>);
}

// ── Éditeur des STRUCTURES JURIDIQUES (V2-M10) : le barème de scoring est une RÈGLE
// gouvernée (R288) — points par forme + exigence documentaire associée. Même circuit.
export type LigneStructure = { code: string; libelle: string; points: number; exigence: string };
export const EXIGENCES_STRUCTURE = ["—", "Formulaire A", "Formulaire K", "Formulaire T",
  "Organigramme + registre", "Acte de trust + trustee"];

export function EditeurStructures({ base, t }: { base: LigneStructure[]; t: (s: string) => string }) {
  const [lignes, setLignes] = useState<LigneStructure[]>(base.map((l) => ({ ...l })));
  const poser = (code: string, patch: Partial<LigneStructure>) =>
    setLignes((ls) => ls.map((l) => (l.code === code ? { ...l, ...patch } : l)));

  const diff: DiffItem[] = [];
  for (const l of lignes) {
    const b = base.find((x) => x.code === l.code);
    if (!b) continue;
    if (b.libelle !== l.libelle)
      diff.push({ cible: `${l.code} · ${t("libellé")}`, avant: b.libelle, apres: l.libelle, genre: "MODIFIÉ" });
    if (b.points !== l.points)
      diff.push({ cible: `${l.code} · ${t("points")}`, avant: `${b.points} pts`, apres: `${l.points} pts`, genre: "MODIFIÉ" });
    if (b.exigence !== l.exigence)
      diff.push({ cible: `${l.code} · ${t("exigence")}`, avant: t(b.exigence), apres: t(l.exigence), genre: "MODIFIÉ" });
  }

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 9, lineHeight: 1.5 }}>
        {t("Le barème est une règle gouvernée (R288) : chaque point pèse dans le scoring de TOUS les nouveaux dossiers. Brouillon local — le barème en vigueur reste intouché.")}</div>
      <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", overflow: "hidden", overflowX: "auto" }}>
        <div role="row" style={{ display: "grid", gridTemplateColumns: "90px 1.5fr 110px 1.2fr",
          alignItems: "center", padding: "0 14px", background: "var(--bg-subtle)",
          borderBottom: "1px solid var(--border)" }}>
          {[t("Code"), t("Structure"), t("Points"), t("Exigence documentaire")].map((h) => (
            <span key={h} className="microlabel" style={{ padding: "9px 8px 9px 0" }}>{h}</span>))}
        </div>
        {lignes.map((l) => (
          <div role="row" key={l.code} style={{ display: "grid",
            gridTemplateColumns: "90px 1.5fr 110px 1.2fr", alignItems: "center", gap: 6,
            padding: "7px 14px", borderBottom: "1px solid var(--border-row)" }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{l.code}</span>
            <input aria-label={`${t("libellé")} ${l.code}`} value={l.libelle}
              onChange={(e) => poser(l.code, { libelle: e.target.value })} style={inputStyle} />
            <select aria-label={`${l.code} ${t("points")}`} value={l.points}
              onChange={(e) => poser(l.code, { points: Number(e.target.value) })}
              style={{ ...inputStyle, padding: "5px 6px", width: "auto" }}>
              {[0, 5, 10, 15, 20, 25, 30, 35].map((p) => <option key={p} value={p}>{p} pts</option>)}
            </select>
            <select aria-label={`${l.code} ${t("exigence")}`} value={l.exigence}
              onChange={(e) => poser(l.code, { exigence: e.target.value })}
              style={{ ...inputStyle, padding: "5px 6px", width: "auto", minWidth: 0 }}>
              {EXIGENCES_STRUCTURE.map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </div>))}
      </section>
      <DiffListe items={diff} t={t} />
      <CircuitGouverne nbEcarts={diff.length} t={t} />
    </div>);
}

// ── Éditeur du QUESTIONNAIRE : libellés de champs + composition des sections (le gabarit
// R304 « SECTION » du Builder v1, en formulaire).
export type SectionQuest = { section: string; active: boolean;
  champs: { code: string; label: string; requise: boolean }[] };

export function EditeurQuestionnaire({ base, t }: { base: SectionQuest[]; t: (s: string) => string }) {
  const [sections, setSections] = useState<SectionQuest[]>(
    base.map((s) => ({ ...s, champs: s.champs.map((c) => ({ ...c })) })));

  const diff: DiffItem[] = [];
  sections.forEach((s, i) => {
    const b = base[i];
    if (b.active !== s.active)
      diff.push({ cible: s.section, avant: t(b.active ? "active" : "inactive"),
        apres: t(s.active ? "active" : "inactive"), genre: s.active ? "AJOUTÉ" : "RETIRÉ" });
    s.champs.forEach((c, j) => {
      const bc = b.champs[j];
      if (bc.label !== c.label)
        diff.push({ cible: `${s.section} · ${c.code}`, avant: bc.label, apres: c.label, genre: "MODIFIÉ" });
      if (bc.requise !== c.requise)
        diff.push({ cible: `${s.section} · ${c.code} · ${t("requise")}`,
          avant: t(bc.requise ? "oui" : "non"), apres: t(c.requise ? "oui" : "non"), genre: "MODIFIÉ" });
    });
  });

  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 9, lineHeight: 1.5 }}>
        {t("Brouillon local — renommer un champ, marquer requis, activer/désactiver une section. Le gabarit en vigueur reste intouché (R29).")}</div>
      {sections.map((s, i) => (
        <section key={s.section} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "11px 14px",
          marginBottom: 10, opacity: s.active ? 1 : 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: s.active ? 8 : 0,
            flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{t(s.section)}</span>
            <button role="switch" aria-checked={s.active} aria-label={`${t("section")} ${t(s.section)}`}
              onClick={() => setSections((xs) => xs.map((x, k) => (k === i ? { ...x, active: !x.active } : x)))}
              style={{ marginLeft: "auto", fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                padding: "4px 10px", borderRadius: 999, cursor: "pointer",
                border: s.active ? "1px solid var(--brand)" : "1px solid var(--border-input)",
                background: s.active ? "var(--brand-surface)" : "var(--bg-subtle)",
                color: s.active ? "var(--brand)" : "var(--text-muted)" }}>
              {t(s.active ? "ACTIVE" : "INACTIVE")}</button>
          </div>
          {s.active && s.champs.map((c, j) => (
            <div key={c.code} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0",
              flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--text-muted)", width: 52 }}>{c.code}</span>
              <input aria-label={`${t("champ")} ${c.code}`} value={c.label}
                onChange={(e) => setSections((xs) => xs.map((x, k) => (k === i
                  ? { ...x, champs: x.champs.map((y, m) => (m === j ? { ...y, label: e.target.value } : y)) }
                  : x)))} style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
              <button role="checkbox" aria-checked={c.requise} aria-label={`${c.code} ${t("requise")}`}
                onClick={() => setSections((xs) => xs.map((x, k) => (k === i
                  ? { ...x, champs: x.champs.map((y, m) => (m === j ? { ...y, requise: !y.requise } : y)) }
                  : x)))}
                style={{ fontFamily: "inherit", fontSize: 10.5, fontWeight: 600, padding: "3px 8px",
                  borderRadius: 6, cursor: "pointer",
                  border: c.requise ? "1px solid var(--warn-card-border)" : "1px solid var(--border-input)",
                  background: c.requise ? "var(--warn-chip)" : "var(--bg-surface)",
                  color: c.requise ? "var(--warn-text)" : "var(--text-muted)" }}>
                {t(c.requise ? "REQUISE" : "FACULTATIVE")}</button>
            </div>))}
        </section>))}
      <DiffListe items={diff} t={t} />
      <CircuitGouverne nbEcarts={diff.length} t={t} />
    </div>);
}
