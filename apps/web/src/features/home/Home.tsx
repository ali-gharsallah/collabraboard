import React, { useCallback, useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran HOME (principe sans R-number, spec `spec-fonctionnelle-home-olivia.md` Partie A).
// PROJECTION par rôle, JAMAIS un module : aucun état propre, aucun agrégat local — chaque tuile
// appelle sa source EXISTANTE (le périmètre est appliqué SERVEUR, HO-01) et affiche la réponse
// telle quelle. États A.4 : squelette indépendant par tuile ; erreur = « indisponible » (jamais un
// zéro — un zéro est une donnée) ; vide réel = « Aucun élément ». Home n'émet AUCUNE requête
// non-GET (HO-08). T2 (action personnelle) toujours en premier.
// ⚠ Écarts consignés (ECARTS) : T7 (reviews à échéance) et T8 (CoC non traités) ABSENTES —
// aucun modèle ratifié d'échéance de review ni de cycle de vie/matérialité CoC ; HO-02 (licence
// R177 par module) partiel — la visibilité v1 est par RÔLE, la licence n'est pas surfacée au front.

type Session = { role?: string };
const role = (): string => ((window as unknown as { OLIVE_SESSION?: Session }).OLIVE_SESSION?.role) ?? "CO";

// Une tuile = une source, un état indépendant (chargement / indisponible / vide / données).
function Tuile<T>({ titre, path, seed, rendre, clic }: {
  titre: string; path: string; seed: T; rendre: (data: T) => React.ReactNode; clic?: string;
}) {
  const [etat, setEtat] = useState<{ data: T | null; indisponible: boolean; charge: boolean }>({ data: null, indisponible: false, charge: false });
  const charger = useCallback(async () => {
    setEtat({ data: null, indisponible: false, charge: false });
    const r = await apiGetSourced<T>(path, seed);
    // API configurée mais appel retombé sur le seed ⇒ la SOURCE est indisponible (HO-04 : pas un zéro).
    if (!isDemoMode() && r.isDemo) setEtat({ data: null, indisponible: true, charge: true });
    else setEtat({ data: r.data, indisponible: false, charge: true });
  }, [path]);
  useEffect(() => { charger(); }, [charger]);
  return <div data-tuile={titre} style={{ flex: "1 1 240px", padding: 12, borderRadius: tokens.radius.lg,
    background: tokens.color.surface, border: `1px solid ${tokens.color.border}`, minHeight: 90 }}>
    <div style={{ fontWeight: 700, fontSize: 13, color: tokens.color.olive700 }}>{titre}</div>
    {!etat.charge && <div style={{ marginTop: 8, height: 18, borderRadius: 4, background: "#eee" }}/>}
    {etat.charge && etat.indisponible && <div style={{ marginTop: 8, fontSize: 12, color: tokens.color.danger }}>
      indisponible <button onClick={charger} style={{ marginLeft: 6, fontSize: 11, padding: "2px 8px", borderRadius: 4,
        border: `1px solid ${tokens.color.border}`, background: "#fff", cursor: "pointer" }}>réessayer</button></div>}
    {etat.charge && !etat.indisponible && <div style={{ marginTop: 6, fontSize: 12 }}>{rendre(etat.data as T)}</div>}
    {clic && <div style={{ marginTop: 6, fontSize: 11, color: tokens.color.muted }}>→ {clic}</div>}
  </div>;
}

const n = (x: unknown[]) => x.length ? <strong style={{ fontSize: 20 }}>{x.length}</strong> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;

export function Home() {
  const r = role();
  const tous = r !== "ADMIN";
  const risque = ["CO", "CO_SR", "BRM", "DIR"].includes(r);
  const t1 = tous && r !== "BRM";                                          // matrice A.3 : BRM = tuiles risque + T2/T3

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Accueil — votre travail, dans votre périmètre</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Chaque chiffre vient de sa source réelle, dans le périmètre
      exact de votre rôle (appliqué serveur). Une source en panne se dit <strong>indisponible</strong> — jamais zéro.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {tous && <Tuile titre="Visas en attente de moi" path="/v1/kyc/visas/pending"
        seed={[{ kycCode: "K-DEMO", section: "IDENTITY", requiredRole: "CO" }]}
        rendre={(v: { kycCode: string; section: string }[]) => <div>{n(v)}{v.slice(0, 3).map((x, i) => <div key={i} style={{ color: tokens.color.muted }}>{x.kycCode} · {x.section}</div>)}</div>}
        clic="dossier concerné"/>}
      {t1 && <Tuile titre="Mes dossiers KYC" path="/v1/kyc"
        seed={[{ code: "K-DEMO", status: "IN_PROGRESS" }]}
        rendre={(ks: { status: string }[]) => {
          const parStatut = new Map<string, number>();
          ks.forEach((k) => parStatut.set(k.status, (parStatut.get(k.status) ?? 0) + 1));
          return ks.length ? <div>{[...parStatut.entries()].map(([s, c]) => <div key={s}>{s} : <strong>{c}</strong></div>)}</div> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;
        }} clic="liste KYC filtrée"/>}
      {/* T3 : tous les rôles, ADMIN compris (matrice A.3 : SO/ADMIN = T3+T9) */}
      <Tuile titre="Tâches ouvertes" path="/v1/tasks?status=OPEN"
        seed={[{ id: "t", type: "REVUE_KYC" }]}
        rendre={(ts: { type: string }[]) => <div>{n(ts)}{ts.slice(0, 5).map((t, i) => <div key={i} style={{ color: tokens.color.muted }}>{t.type}</div>)}</div>}
        clic="écran Tâches"/>
      {risque && <Tuile titre="Alertes AML scorées" path="/v1/cpsi/alerts"
        seed={{ alertes: [{ client: "c", scenario: "SC" }] }}
        rendre={(a: { alertes: unknown[] }) => n(a.alertes ?? [])} clic="AML → Signaux scorés"/>}
      {["CO", "CO_SR", "DIR"].includes(r) && <Tuile titre="Risk cases" path="/v1/riskcases"
        seed={[{ id: "rc", statut: "NOUVELLE" }]}
        rendre={(rc: { statut: string }[]) => {
          const par = new Map<string, number>();
          rc.forEach((c) => par.set(c.statut, (par.get(c.statut) ?? 0) + 1));
          return rc.length ? <div>{[...par.entries()].map(([s, c]) => <div key={s}>{s} : <strong>{c}</strong></div>)}</div> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;
        }} clic="Risk case manager"/>}
      {["CO_SR", "BRM", "DIR"].includes(r) && <Tuile titre="Propositions CPSI en attente" path="/v1/cpsi/params/proposals"
        seed={[{ id: "PROP-1", statut: "EN_ATTENTE" }]}
        rendre={(ps: { statut: string }[]) => n(ps.filter((p) => p.statut === "EN_ATTENTE"))} clic="écran propositions"/>}
      {r === "ADMIN" && <Tuile titre="Santé de la porte CPSI" path="/v1/cpsi/health"
        seed={{ profondeurJournal: 0, dernierRejeuMs: null }}
        rendre={(h: { profondeurJournal: number; dernierRejeuMs: number | null }) =>
          <div>journal : <strong>{h.profondeurJournal}</strong> évts · rejeu {h.dernierRejeuMs ?? "—"} ms</div>} clic="écran cpsiparam"/>}
      {tous && <Tuile titre="Olivia — propositions en attente" path="/v1/olivia/proposals?statut=PENDING"
        seed={[]}
        rendre={(ps: unknown[]) => n(ps)} clic="écran Olivia"/>}
    </div>
  </div>;
}
