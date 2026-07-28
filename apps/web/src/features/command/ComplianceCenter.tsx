import React from "react";
import { Tuile } from "../../components/Tuile";
import { Projection } from "./Projection";
import { tokens } from "../../theme/tokens";

/**
 * COMPLIANCE CENTER — R292 (canon triage final, ratifié 2026-07-28) : le Command Center du
 * CO. DEUXIÈME instance du patron `Projection` (DC-08/DC-09 — même composant, autre rôle,
 * autres tuiles) : stats des règles AML, propositions en attente (Olivia + barèmes CPSI),
 * accès MROS (la liste — l'ACTION reste dans l'écran MROS), SLA hit→MROS, CoC et reviews en
 * souffrance. Accès CO/CO_SR ; la Direction y lit ; RM → refus rendu. Aucune action.
 */

const n = (x: unknown[]) => x.length ? <strong style={{ fontSize: 18 }}>{x.length}</strong> : <span style={{ color: tokens.color.muted }}>Aucun élément</span>;

export function ComplianceCenter({ onNaviguer }: { onNaviguer?: (ecran: string) => void } = {}) {
  return <Projection
    titre="Compliance Center — le poste de pilotage conformité (projection, lecture seule)"
    description="Les règles, les propositions et les souffrances SLA — chaque chiffre vient de sa source ratifiée et se clique vers l'écran où l'acte se fait. Rien ne s'exécute ici."
    rolesAcces={["CO", "CO_SR", "DIR"]}
    refusTexte="Écran réservé à la Compliance (CO/CO_SR — la Direction y lit). Votre poste de travail est l'Accueil."
    onNaviguer={onNaviguer}
    composer={({ cpsi, seuils, drill, groupe }) => <>
      {groupe("Règles AML", <Tuile titre="Référentiel effectif" path="/v1/aml/referentiel" seed={{ scenarios: [] as unknown[] }}
        rendre={(r: any) => <div><strong>{(r.scenarios ?? r ?? []).length ?? 0}</strong> scénarios actifs
          {drill("amlref", "référentiel AML", (r.scenarios ?? r ?? []).length ?? 0)}</div>}/>)}
      {cpsi && groupe("Volumétrie & franchissements", <Tuile titre="Volumétrie (PC-13)" path="/v1/cpsi/volumetrie"
        seed={{ franchissements: [] as unknown[] }}
        rendre={(v) => <div>{n(v.franchissements ?? [])}{drill("cpsiParam", "volumétrie", (v.franchissements ?? []).length)}</div>}/>)}
      {groupe("Propositions en attente", <>
        <Tuile titre="Propositions Olivia" path="/v1/olivia/proposals?statut=PENDING" seed={[] as unknown[]}
          rendre={(ps) => <div>{n(ps)}{drill("olivia", "décider (adopt/reject motivé)", ps.length)}</div>}/>
        {cpsi && <Tuile titre="Propositions de barème CPSI" path="/v1/cpsi/params/proposals" seed={[] as unknown[]}
          rendre={(ps) => <div>{n(ps)}{drill("cpsiParam", "barèmes (R69)", ps.length)}</div>}/>}</>)}
      {groupe("MROS", <Tuile titre="Communications" path="/v1/mros" seed={[] as { decision?: string }[]}
        rendre={(cs) => <div>{n(cs)}{drill("mros", "écran MROS (l'acte vit là)", cs.length)}</div>}/>)}
      {groupe("SLA & souffrances", <>
        {cpsi && <Tuile titre="Délais hit→MROS" path="/v1/cpsi/reporting/sla" seed={{ maillons: [] as unknown[] }}
          rendre={(m) => <div>{n(m.maillons ?? [])}{drill("amlws", "chaîne hit→MROS", (m.maillons ?? []).length)}</div>}/>}
        <Tuile titre="Reviews à échéance" path="/v1/reviews/deadlines" seed={[] as { enRetard?: boolean }[]}
          testId="tuile-sla-cc" alerte={(ds) => { const s = seuils.sla_en_retard;
            return s != null && ds.filter((d) => d.enRetard).length >= s ? "rouge" : null; }}
          rendre={(ds) => drill("review", "reviews EN_RETARD", ds.filter((d) => d.enRetard).length)}/>
        <Tuile titre="CoC vs SLA" path="/v1/coc/reporting" seed={{ parMaterialite: {} as Record<string, { n: number }> }}
          rendre={(c) => <div>{Object.entries(c.parMaterialite ?? {}).map(([m, x]) =>
            <div key={m}>{m} : <strong>{(x as { n: number }).n}</strong></div>)}
            {drill("coc", "changements de circonstances", Object.keys(c.parMaterialite ?? {}).length)}</div>}/></>)}
    </>}/>;
}
