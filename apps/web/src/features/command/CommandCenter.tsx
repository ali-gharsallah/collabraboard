import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { Tuile } from "../../components/Tuile";
import { tokens } from "../../theme/tokens";

/**
 * COMMAND CENTER — R289 (canon triage écrans HTML, ratifié 2026-07-28). Le poste de pilotage
 * Direction : une PROJECTION, aucun module — même nature que Home (« un patron, deux écrans »,
 * Tuile partagée). AUCUN état propre, AUCUN endpoint de calcul, AUCUN chiffre front : chaque
 * tuile déclare sa source RATIFIÉE et le drill ORIENTE vers l'écran opérationnel — le Command
 * Center n'agit jamais (aucun non-GET, DC-05). R291 (ratifié 2026-07-28) COMPLÈTE l'écran :
 * la tuile « Charge compliance » (agrégat SERVI /v1/kyc/visas/charge, DC-06) et les dead-letters
 * (matrice T9 étendue à DIR en LECTURE, DC-07) rejoignent les 7 tuiles v1. `command_seuils` (R-Q)
 * COLORE ambre/rouge — les notifications restent celles des modules ratifiés (R39, DC-03).
 */

const role = (): string => ((window as unknown as { OLIVE_SESSION?: { role?: string } }).OLIVE_SESSION?.role) ?? "CO";
type ModulesActifs = { enforcement: boolean; modules: { code: string }[] | null };
type Seuils = Record<string, number>;

const n = (x: unknown[]) => x.length ? <strong style={{ fontSize: 18 }}>{x.length}</strong> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;

export function CommandCenter({ onNaviguer }: { onNaviguer?: (ecran: string) => void } = {}) {
  const r = role();
  const [mods, setMods] = useState<ModulesActifs | null>(null);
  const [seuils, setSeuils] = useState<Seuils>({});
  useEffect(() => {
    if (r !== "DIR") return;
    apiGetSourced<ModulesActifs>("/v1/modules/actifs", { enforcement: false, modules: null }).then((x) => setMods(x.data));
    apiGetSourced<Seuils>("/v1/parametres/valeur/command_seuils", {}).then((x) => setSeuils(x.data ?? {}));
  }, [r]);
  // DC-01 : Direction-only — le refus est RENDU (les sources appliquent en plus leur périmètre serveur).
  if (r !== "DIR") return <div><h3>Command Center</h3>
    <p style={{ fontSize: 13, color: tokens.color.danger }}>Écran réservé à la Direction (DIR — matrice A.3). Votre poste de travail est l&apos;Accueil.</p></div>;
  if (mods === null) return <div><h3>Command Center</h3><div style={{ height: 18, borderRadius: 4, background: "#eee", maxWidth: 400 }}/></div>;
  const cpsi = !mods.enforcement || (mods.modules ?? []).some((m) => m.code === "cpsi");
  const drill = (ecran: string, libelle: string, compte: number) =>
    <button onClick={() => onNaviguer?.(ecran)} style={{ display: "block", fontSize: 12, background: "none",
      border: "none", padding: 0, cursor: "pointer", color: tokens.color.olive700, textAlign: "left" }}>
      {libelle} : <strong>{compte}</strong> →</button>;   // DC-02 : le drill ORIENTE — l'acte vit dans l'écran métier

  const groupe = (titre: string, contenu: React.ReactNode) =>
    <div style={{ flex: "1 1 300px" }}><h4 style={{ margin: "10px 0 6px", fontSize: 13 }}>{titre}</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{contenu}</div></div>;

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Command Center — où en est la banque (projection, lecture seule)</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Chaque chiffre vient de sa source ratifiée et se clique vers l&apos;écran qui le justifie.
      Le Command Center oriente — il n&apos;agit jamais. Une source en panne se dit indisponible, jamais zéro.</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
      {groupe("Pipeline onboarding", <Tuile titre="Dossiers en cours" path="/v1/onboarding" seed={[] as { etape?: string }[]}
        rendre={(os) => { const parEtape = new Map<string, number>();
          os.forEach((o) => parEtape.set(o.etape ?? "?", (parEtape.get(o.etape ?? "?") ?? 0) + 1));
          return <div>{n(os)}{[...parEtape.entries()].map(([e, c]) => <div key={e} style={{ color: tokens.color.muted }}>{e} : {c}</div>)}
            {drill("onboarding", "ouvrir le pipeline", os.length)}</div>; }}/>)}
      {cpsi && groupe("Risque", <>
        <Tuile titre="Bandes CPSI" path="/v1/cpsi/segmentation" seed={{ bandes: {} as Record<string, number> }}
          rendre={(s) => <div>{Object.entries(s.bandes ?? {}).map(([b, c]) => <div key={b}>{b} : <strong>{c as number}</strong></div>)}
            {drill("cpsiSeg", "segmentation", Object.keys(s.bandes ?? {}).length)}</div>}/>
        <Tuile titre="Franchissements 30 j" path="/v1/cpsi/volumetrie" seed={{ franchissements: [] as unknown[] }}
          rendre={(v) => <div>{n(v.franchissements ?? [])}{drill("cpsiParam", "volumétrie", (v.franchissements ?? []).length)}</div>}/>
        <Tuile titre="Propositions d'aiguillage" path="/v1/cpsi/case-proposals" seed={[] as unknown[]}
          rendre={(ps) => <div>{n(ps)}{drill("cpsiCases", "propositions de case", ps.length)}</div>}/></>)}
      {groupe("AML & cases", <>
        {cpsi && <Tuile titre="Alertes scorées" path="/v1/cpsi/alerts" seed={{ alertes: [] as { severite?: number }[] }}
          rendre={(a) => <div>{n(a.alertes ?? [])}{drill("amlws", "workspace AML", (a.alertes ?? []).length)}</div>}/>}
        <Tuile titre="Risk cases" path="/v1/riskcases" seed={[] as { statut?: string; etatDepuis?: string }[]}
          rendre={(cs) => { const parEtat = new Map<string, number>();
            cs.forEach((c) => parEtat.set(c.statut ?? "?", (parEtat.get(c.statut ?? "?") ?? 0) + 1));
            const plusAncien = [...cs].sort((a, b) => String(a.etatDepuis).localeCompare(String(b.etatDepuis)))[0]; // TRI d'affichage sur donnée servie
            return <div>{[...parEtat.entries()].map(([e, c]) => <div key={e}>{e} : <strong>{c}</strong></div>)}
              {plusAncien?.etatDepuis && <div style={{ color: tokens.color.muted }}>le plus ancien : {String(plusAncien.etatDepuis).slice(0, 10)}</div>}
              {drill("dossiers", "dossiers de risque", cs.length)}</div>; }}/></>)}
      {groupe("Charge compliance", <Tuile titre="Visas en attente (par rôle)" path="/v1/kyc/visas/charge"
        seed={{ total: 0, parRole: {} as Record<string, number>, plusAncien: null as string | null }}
        rendre={(c) => <div>{Object.entries(c.parRole ?? {}).map(([role, n]) => <div key={role}>{role} : <strong>{n as number}</strong></div>)}
          {c.plusAncien && <div style={{ color: tokens.color.muted }}>le plus ancien : {String(c.plusAncien).slice(0, 10)}</div>}
          {drill("kyc", "dossiers KYC", c.total ?? 0)}</div>}/>)}   {/* R291/DC-06 : agrégat SERVI */}
      {groupe("SLA réglementaires", <>
        <Tuile titre="Reviews à échéance" path="/v1/reviews/deadlines" seed={[] as { enRetard?: boolean }[]}
          testId="tuile-sla" alerte={(ds) => { const s = seuils.sla_en_retard;               // DC-03 : command_seuils COLORE —
            const retard = ds.filter((d) => d.enRetard).length;                             // jamais ne bloque (R39)
            return s != null && retard >= s ? "rouge" : null; }}
          rendre={(ds) => drill("review", "reviews EN_RETARD", ds.filter((d) => d.enRetard).length)}/>
        <Tuile titre="CoC vs SLA" path="/v1/coc/reporting" seed={{ parMaterialite: {} as Record<string, { n: number; delaiMoyenJours: number }> }}
          rendre={(c) => <div>{Object.entries(c.parMaterialite ?? {}).map(([m, x]) =>
            <div key={m}>{m} : {(x as { n: number }).n} (délai moyen {(x as { delaiMoyenJours: number }).delaiMoyenJours} j)</div>)}
            {drill("coc", "changements de circonstances", Object.keys(c.parMaterialite ?? {}).length)}</div>}/>
        {cpsi && <Tuile titre="Délais hit→MROS" path="/v1/cpsi/reporting/sla" seed={{ maillons: [] as unknown[] }}
          rendre={(m) => <div>{n(m.maillons ?? [])}{drill("amlws", "chaîne hit→MROS", (m.maillons ?? []).length)}</div>}/>}</>)}
      {groupe("Clôtures", <Tuile titre="Offboardings en cours" path="/v1/offboarding" seed={[] as { statut?: string }[]}
        rendre={(os) => <div>{n(os.filter((o) => o.statut !== "CLOTUREE" && o.statut !== "ANNULEE"))}
          {drill("offboarding", "clôtures", os.length)}</div>}/>)}
      {groupe("Santé plateforme", <>
        {cpsi && <Tuile titre="Porte CPSI" path="/v1/cpsi/health" seed={{ dernierRejeuMs: null as number | null }}
          rendre={(h) => <div>dernier rejeu : <strong>{h.dernierRejeuMs ?? "—"} ms</strong>{drill("cpsiParam", "santé de la porte", 1)}</div>}/>}
        <Tuile titre="Runs agentiques" path="/v1/olivia/runs/agregat" seed={{ runsParJour: 0, tauxAdoption: 0 }}
          rendre={(a: any) => <div>runs/jour : <strong>{a.runsParJour ?? 0}</strong>{drill("oliviaruns", "runs Olivia", a.runsParJour ?? 0)}</div>}/>
        <Tuile titre="Transport (dead-letters)" path="/v1/events/sante"
          seed={{ enSouffrance: 0, plusAncien: null as string | null }}
          alerte={(x) => { const seuil = seuils.dead_letters; return seuil != null && (x.enSouffrance ?? 0) >= seuil ? "rouge" : null; }}
          rendre={(x) => <div><strong>{x.enSouffrance}</strong> en souffrance
            {x.plusAncien && <div style={{ color: tokens.color.muted }}>le plus ancien : {String(x.plusAncien).slice(0, 10)}</div>}
            {drill("audit", "audit & transport", x.enSouffrance ?? 0)}</div>}/></>)}   {/* R291/DC-07 : T9 étendu à DIR (lecture) */}
      {groupe("Olivia", <Tuile titre="Propositions en attente" path="/v1/olivia/proposals?statut=PENDING" seed={[] as { type?: string }[]}
        rendre={(ps) => { const parType = new Map<string, number>();
          ps.forEach((p) => parType.set(p.type ?? "?", (parType.get(p.type ?? "?") ?? 0) + 1));
          return <div>{n(ps)}{[...parType.entries()].map(([t, c]) => <div key={t} style={{ color: tokens.color.muted }}>{t} : {c}</div>)}
            {drill("olivia", "propositions", ps.length)}</div>; }}/>)}
    </div>
  </div>;
}
