import React, { useEffect, useState } from "react";
import { apiGetSourced, isDemoMode } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

/**
 * R292 (canon triage final, ratifié 2026-07-28) — LE patron de PROJECTION DE PILOTAGE.
 * Command Center (Direction) et Compliance Center (CO/CO_SR) sont deux INSTANCES de ce
 * composant : lecture seule, sources ratifiées, drill vers l'opérationnel, seuils qui
 * COLORENT (command_seuils, R39 — jamais un blocage), aucune action (DC-05). Toute
 * projection de rôle future = une déclaration de tuiles sous ce patron, pas une règle.
 * DC-09 : les deux écrans IMPORTENT ce composant (vérifié à l'import, pattern RW-04).
 */

type ModulesActifs = { enforcement: boolean; modules: { code: string }[] | null };
export type OutilsProjection = {
  cpsi: boolean;
  seuils: Record<string, number>;
  drill: (ecran: string, libelle: string, compte: number) => React.ReactNode;
  groupe: (titre: string, contenu: React.ReactNode) => React.ReactNode;
};

const role = (): string => ((window as unknown as { OLIVE_SESSION?: { role?: string } }).OLIVE_SESSION?.role) ?? "CO";

export function Projection({ titre, description, rolesAcces, refusTexte, composer, onNaviguer }: {
  titre: string; description: string; rolesAcces: string[]; refusTexte: string;
  composer: (o: OutilsProjection) => React.ReactNode;
  onNaviguer?: (ecran: string) => void;
}) {
  const r = role();
  const autorise = rolesAcces.includes(r);
  const [mods, setMods] = useState<ModulesActifs | null>(null);
  const [seuils, setSeuils] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!autorise) return;
    apiGetSourced<ModulesActifs>("/v1/modules/actifs", { enforcement: false, modules: null }).then((x) => setMods(x.data));
    apiGetSourced<Record<string, number>>("/v1/parametres/valeur/command_seuils", {}).then((x) => setSeuils(x.data ?? {}));
  }, [autorise]);
  // DC-01/DC-08 : le refus est RENDU — et les sources appliquent en plus leur périmètre serveur.
  if (!autorise) return <div><h3>{titre}</h3>
    <p style={{ fontSize: 13, color: tokens.color.danger }}>{refusTexte}</p></div>;
  if (mods === null) return <div><h3>{titre}</h3><div style={{ height: 18, borderRadius: 4, background: "#eee", maxWidth: 400 }}/></div>;
  const cpsi = !mods.enforcement || (mods.modules ?? []).some((m) => m.code === "cpsi");
  const drill = (ecran: string, libelle: string, compte: number) =>
    <button onClick={() => onNaviguer?.(ecran)} style={{ display: "block", fontSize: 12, background: "none",
      border: "none", padding: 0, cursor: "pointer", color: tokens.color.olive700, textAlign: "left" }}>
      {libelle} : <strong>{compte}</strong> →</button>;   // DC-02 : le drill ORIENTE — l'acte vit dans l'écran métier
  const groupe = (t: string, contenu: React.ReactNode) =>
    <div key={t} style={{ flex: "1 1 300px" }}><h4 style={{ margin: "10px 0 6px", fontSize: 13 }}>{t}</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{contenu}</div></div>;
  return <div data-testid="projection-pilotage">
    {isDemoMode() && <DemoModeBanner/>}
    <h3>{titre}</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>{description}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>{composer({ cpsi, seuils, drill, groupe })}</div>
  </div>;
}
