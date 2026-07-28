import React from "react";
import { Tuile } from "../../components/Tuile";
import { Projection } from "./Projection";
import { tokens } from "../../theme/tokens";

/**
 * COMMAND CENTER — R289 + R291 (canon triage écrans, ratifiés 2026-07-28) : le poste de
 * pilotage DIRECTION. Depuis R292, l'écran est une INSTANCE du patron `Projection`
 * (un patron, N projections de rôle — DC-09) : il ne fait que DÉCLARER ses tuiles.
 * Sources ratifiées, drill qui ORIENTE, aucun non-GET (DC-05), seuils qui colorent (DC-03).
 */

const n = (x: unknown[]) => x.length ? <strong style={{ fontSize: 18 }}>{x.length}</strong> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;

export function CommandCenter({ onNaviguer }: { onNaviguer?: (ecran: string) => void } = {}) {
  return <Projection
    titre="Command Center — où en est la banque (projection, lecture seule)"
    description="Chaque chiffre vient de sa source ratifiée et se clique vers l'écran qui le justifie. Le Command Center oriente — il n'agit jamais. Une source en panne se dit indisponible, jamais zéro."
    rolesAcces={["DIR"]}
    refusTexte="Écran réservé à la Direction (DIR — matrice A.3). Votre poste de travail est l'Accueil."
    onNaviguer={onNaviguer}
    composer={({ cpsi, seuils, drill, groupe }) => <>
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
        rendre={(c) => <div>{Object.entries(c.parRole ?? {}).map(([role, x]) => <div key={role}>{role} : <strong>{x as number}</strong></div>)}
          {c.plusAncien && <div style={{ color: tokens.color.muted }}>le plus ancien : {String(c.plusAncien).slice(0, 10)}</div>}
          {drill("kyc", "dossiers KYC", c.total ?? 0)}</div>}/>)}
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
    </>}/>;
}
