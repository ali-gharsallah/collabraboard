import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

/**
 * P-L8-2 — KPI CONFORMITÉ (projections de LECTURE, R50). Données lues des TABLES RÉELLES
 * (screening_hits + qualifications, risk_cases, mros_communications) — aucune table KPI,
 * aucun cache (C8) : chaque appel recalcule. `now` injectable (tests). Définitions ASSUMÉES
 * et affichées dans le rapport (un KPI sans définition est un chiffre mort) :
 *  · âge d'un hit = détection → qualification (ou → now s'il est encore BRUT), en jours ;
 *  · conversion alerte→déclaration = communications DECLARER / risk cases ouverts (période) ;
 *  · charge analyste = qualifications signées par personne (R101) sur la période.
 */

type Ctx = { tenantId: string };
type Periode = { du: string; au: string };

export function p90(valeurs: number[]): number {
  if (!valeurs.length) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  return tri[Math.min(tri.length - 1, Math.ceil(0.9 * tri.length) - 1)];
}
const jours = (a: Date | string, b: Date | string) =>
  Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
const compter = <T,>(rows: T[], cle: (r: T) => string) => {
  const m: Record<string, number> = {};
  for (const r of rows) m[cle(r)] = (m[cle(r)] ?? 0) + 1;
  return m;
};

/** Bornes ISO d'un trimestre civil (UTC). */
export function bornesTrimestre(annee: number, trimestre: 1 | 2 | 3 | 4): Periode {
  if (![1, 2, 3, 4].includes(trimestre)) throw new BadRequestException("trimestre ∈ 1..4");
  const du = new Date(Date.UTC(annee, (trimestre - 1) * 3, 1));
  const au = new Date(Date.UTC(annee, trimestre * 3, 1));
  return { du: du.toISOString(), au: au.toISOString() };
}

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  async conformite(ctx: Ctx, periode: Periode, now: Date = new Date()) {
    if (!periode?.du || !periode?.au || !(new Date(periode.du) < new Date(periode.au)))
      throw new BadRequestException("période du/au requise (du < au)");
    const dans = (at: Date | string) =>
      new Date(at) >= new Date(periode.du) && new Date(at) < new Date(periode.au);

    const hits = (await this.prisma.screeningHit.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((h: any) => dans(h.at));
    const quals = (await this.prisma.screeningQualification.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((q: any) => hits.some((h: any) => h.id === q.hitId));
    const cases = (await this.prisma.riskCase.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((c: any) => dans(c.etatDepuis));
    const mros = (await this.prisma.mrosCommunication.findMany({ where: { tenantId: ctx.tenantId } }))
      .filter((m: any) => dans(m.decideAt));

    const qualParHit = new Map(quals.map((q: any) => [q.hitId, q]));
    const ages = hits.map((h: any) => {
      const q: any = qualParHit.get(h.id);
      return jours(h.at, q ? q.at : now);                        // BRUT : âge courant, transparent
    });
    const declare = mros.filter((m: any) => m.decision === "DECLARER").length;

    return {
      periode,
      definitions: {
        age: "détection → qualification (→ now si BRUT), jours",
        conversion: "mros DECLARER / risk cases ouverts sur la période",
        charge: "qualifications signées par analyste (R101)",
      },
      screening: {
        volumes: { total: hits.length, ...compter(hits, (h: any) => h.statut) },
        parListe: compter(hits, (h: any) => h.listeVersion),
        ageMoyenJours: ages.length ? Number((ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(2)) : 0,
        ageP90Jours: Number(p90(ages).toFixed(2)),
        verdicts: compter(quals, (q: any) => q.verdict),
      },
      riskCases: { volumes: { total: cases.length, ...compter(cases, (c: any) => c.statut) } },
      mros: { volumes: { total: mros.length, ...compter(mros, (m: any) => m.decision) },
        conversionAlerteDeclaration: cases.length ? Number((declare / cases.length).toFixed(3)) : 0 },
      chargeParAnalyste: compter(quals, (q: any) => q.par),
    };
  }

  /** Rapport TRIMESTRIEL exportable — JSON + CSV plat (une ligne par indicateur). */
  async trimestriel(ctx: Ctx, annee: number, trimestre: 1 | 2 | 3 | 4, now: Date = new Date()) {
    const kpi = await this.conformite(ctx, bornesTrimestre(annee, trimestre), now);
    const lignes: [string, string | number][] = [["periode", `${annee}-T${trimestre}`]];
    const aplatir = (prefixe: string, o: any) => {
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === "object" && v !== null) aplatir(`${prefixe}${k}.`, v);
        else lignes.push([`${prefixe}${k}`, v as any]);
      }
    };
    aplatir("", { screening: kpi.screening, riskCases: kpi.riskCases, mros: kpi.mros,
      chargeParAnalyste: kpi.chargeParAnalyste });
    const csv = ["indicateur;valeur", ...lignes.map(([k, v]) => `${k};${v}`)].join("\n");
    return { ...kpi, trimestre: `${annee}-T${trimestre}`, csv };
  }
}
