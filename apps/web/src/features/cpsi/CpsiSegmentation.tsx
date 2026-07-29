import React from "react";
import { useApiOrSeed } from "../../lib/useApiOrSeed";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";

// Écran « CPSI — Segmentation » (porte mince CPSI, CP-03). LECTURE : GET /v1/cpsi/segmentation →
// grille déterministe B/M/H × CALME/ACTIF/INTENSE (R65). Labels stables, segment explicable ;
// le calcul vient du moteur ratifié (aucune écriture, aucun recalcul côté porte).

type Seg = { client: string; segment: string };
type Resp = { asOf: string | null; segments: Seg[] };

const SEED: Resp = { asOf: null, segments: [
  { client: "c-001", segment: "H-INTENSE" }, { client: "c-002", segment: "M-ACTIF" },
  { client: "c-003", segment: "B-CALME" }, { client: "c-004", segment: "M-CALME" },
  { client: "c-005", segment: "H-ACTIF" }] };

export function CpsiSegmentation() {
  const { data, isDemo } = useApiOrSeed<Resp>("/v1/cpsi/segmentation", SEED);
  const parSegment = new Map<string, string[]>();
  for (const s of data.segments) (parSegment.get(s.segment) ?? parSegment.set(s.segment, []).get(s.segment))!.push(s.client);
  const segments = [...parSegment.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return <div>
    {isDemo && <DemoModeBanner/>}
    <h3>CPSI — Segmentation en groupes de pairs (R65)</h3>
    <p style={{ fontSize: tokens.font.sm, color: tokens.color.muted }}>Grille <strong>déterministe</strong> (statique B/M/H ×
      comportement CALME/ACTIF/INTENSE) — labels stables, segment explicable en une phrase. L'anomalie se mesure
      au sein du groupe de pairs, sans jamais altérer le score (R39).</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
      {segments.map(([seg, clients]) => <div key={seg} style={{ flex: "1 1 180px", padding: 12, borderRadius: tokens.radius.lg,
        background: tokens.color.surface, border: `1px solid ${tokens.color.border}` }}>
        <div style={{ fontWeight: 700, color: tokens.color.olive700 }}>{seg}</div>
        <div style={{ fontSize: 11, color: tokens.color.muted, marginBottom: 6 }}>{clients.length} client(s)</div>
        {clients.map((c) => <div key={c} style={{ fontSize: 12, padding: "2px 0", color: tokens.color.ink }}>{c}</div>)}
      </div>)}
    </div>
    {!data.segments.length && <div style={{ marginTop: 12, color: tokens.color.muted, fontSize: 13 }}>Aucun client segmenté.</div>}
  </div>;
}
