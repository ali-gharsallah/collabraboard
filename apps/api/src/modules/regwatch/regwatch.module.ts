import { BadRequestException, Body, Controller, Get, Module, NotFoundException, Param, Post, Req, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { loadSettings } from "../../common/tenant-settings";
import { Tx } from "../../common/tx";

/**
 * REGWATCH — dégel V4 (canon ratifié 2026-07-28), R309-R311, VR-01..05.
 * R309 : les sources de veille sont des PORTS déclarés (`regwatch_sources` au registre,
 * credentials au coffre) — sans credentials, le port est ÉTEINT, affiché, rien ne casse ;
 * un item = ÉVÉNEMENT (regwatch.item), dédupliqué par EMPREINTE. Flux de TEST déterministe
 * (REGWATCH_FAKE_FEED) — jamais en prod (R167).
 * R310 : la qualification est HUMAINE et motivée (NON_PERTINENT exige un motif R7) ;
 * Olivia PROPOSE (statut + Rn cités — un Rn inexistant est REFUSÉ, jamais une référence
 * inventée, R257) — l'item reste NON_TRAITE tant qu'un humain n'a pas décidé ; l'adoption
 * trace la filiation (surProposition).
 * R311 : un PERTINENT référence les Rn impactés et OUVRE une tâche d'analyse (événement) —
 * si l'analyse conclut à un changement, la VOIE NORMALE s'applique (amendement ratifié,
 * R68, bac à sable) : ce module n'écrit JAMAIS une règle — lecture + événements seulement,
 * VR-05 le vérifie par revue automatisée. État dérivé des ÉVÉNEMENTS, aucune table.
 */

type Ctx = { tenantId: string; userId: string; role: string };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const RN_MAX = 323;                                        // le catalogue vivant (R1..R323 au dégel)

function fakeFeed(source: string): { titre: string; date: string; reference: string }[] {
  if (process.env.REGWATCH_FAKE_FEED !== "1") return [];
  if (source !== "FINMA") return [];
  return [
    { titre: "Communication FINMA 05/2026 — obligations de diligence crypto", date: "2026-07-20", reference: "FINMA-2026-05" },
    { titre: "Circulaire révisée — gestion des risques cross-border", date: "2026-07-22", reference: "FINMA-CIRC-2026-CB" },
  ];
}

@Injectable()
export class RegwatchService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private emit(tx: Tx, tenantId: string, type: string, aggregateId: string, payload: any) {
    return tx.domainEvent.create({ data: { tenantId, type, aggregateId, payload, at: new Date().toISOString() } });
  }
  private async evenements(tenantId: string, types: string[]) {
    return this.prisma.domainEvent.findMany({
      where: { tenantId, type: { in: types } }, orderBy: { id: "asc" } });
  }

  // ── VR-01/02 : collecter — port par source, dédup par empreinte, l'éteint est AFFICHÉ. ──
  async collecter(ctx: Ctx) {
    const s = await loadSettings(this.prisma, ctx.tenantId);
    const sources: any[] = s.regwatch_sources ?? [];
    const connus = new Set((await this.evenements(ctx.tenantId, ["regwatch.item"]))
      .map((e) => (e.payload as any).empreinte));
    const etat: { code: string; etat: string; items: number; dernierFetchAt?: string }[] = [];
    for (const src of sources) {
      if (!src.credentials) { etat.push({ code: src.code, etat: "ETEINT", items: 0 }); continue; }   // rien cassé
      const livres = fakeFeed(src.code);
      let nouveaux = 0;
      await this.prisma.$transaction(async (tx: Tx) => {
        for (const item of livres) {
          const empreinte = sha(`${src.code}|${item.reference}|${item.titre}`);
          if (connus.has(empreinte)) continue;                              // VR-02 : une seule entrée
          connus.add(empreinte);
          nouveaux++;
          await this.emit(tx, ctx.tenantId, "regwatch.item", empreinte,
            { source: src.code, titre: item.titre, date: item.date, reference: item.reference, empreinte });
        }
        await this.emit(tx, ctx.tenantId, "regwatch.fetch", src.code,
          { source: src.code, livres: livres.length, nouveaux, par: ctx.userId });   // dernier fetch TRACÉ
      });
      etat.push({ code: src.code, etat: "ACTIF", items: nouveaux, dernierFetchAt: new Date().toISOString() });
    }
    await this.audit.log(ctx.tenantId, ctx.userId, "REGWATCH_COLLECTE", etat.map((e) => `${e.code}:${e.items}`).join(","));
    return { sources: etat };
  }

  // État DÉRIVÉ : items + dernière qualification + dernière proposition.
  async items(ctx: Ctx) {
    const evs = await this.evenements(ctx.tenantId,
      ["regwatch.item", "regwatch.qualification", "regwatch.proposition"]);
    const parEmpreinte = new Map<string, any>();
    for (const e of evs) {
      const p: any = e.payload;
      if (e.type === "regwatch.item")
        parEmpreinte.set(p.empreinte, { ...p, statut: "NON_TRAITE", at: e.at });
      if (e.type === "regwatch.proposition" && parEmpreinte.has(p.empreinte))
        parEmpreinte.get(p.empreinte).proposition = { id: p.id, statut: p.statut, regles: p.regles, justification: p.justification };
      if (e.type === "regwatch.qualification" && parEmpreinte.has(p.empreinte))
        Object.assign(parEmpreinte.get(p.empreinte), { statut: p.statut, motif: p.motif ?? null,
          impact: p.impact ?? null, regles: p.regles ?? [], surProposition: p.surProposition ?? null });
    }
    return [...parEmpreinte.values()];
  }

  private async itemOuRefus(ctx: Ctx, empreinte: string) {
    const evs = await this.evenements(ctx.tenantId, ["regwatch.item"]);
    const it = evs.find((e) => (e.payload as any).empreinte === empreinte);
    if (!it) throw new NotFoundException("Item de veille introuvable");
    return it.payload as any;
  }

  private validerRegles(regles?: string[]) {
    for (const r of regles ?? []) {
      const m = /^R(\d{1,3})$/.exec(String(r));
      if (!m || Number(m[1]) < 1 || Number(m[1]) > RN_MAX)
        throw new UnprocessableEntityException(
          `R257 : « ${r} » ne cite pas une règle EXISTANTE du catalogue (R1..R${RN_MAX}) — jamais une référence inventée`);
    }
  }

  // ── VR-04 : Olivia PROPOSE — l'item reste NON_TRAITE, l'humain décidera. ──
  async proposer(ctx: Ctx, empreinte: string, dto: { statut?: string; regles?: string[]; justification?: string }) {
    await this.itemOuRefus(ctx, empreinte);
    if (!["PERTINENT", "NON_PERTINENT"].includes(dto?.statut ?? ""))
      throw new BadRequestException("statut proposé requis : PERTINENT | NON_PERTINENT");
    if (!dto?.justification?.trim()) throw new BadRequestException("R7 : la proposition se justifie");
    this.validerRegles(dto.regles);
    const id = randomUUID();
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "regwatch.proposition", id,
        { id, empreinte, statut: dto.statut, regles: dto.regles ?? [],
          justification: dto.justification!.trim(), par: ctx.userId }));
    return { id, enAttenteDecisionHumaine: true };
  }

  // ── VR-03/05 : qualifier — l'acte HUMAIN ; PERTINENT ouvre la tâche d'analyse. ──
  async qualifier(ctx: Ctx, empreinte: string, dto: { statut?: string; motif?: string;
    impact?: string; regles?: string[]; surProposition?: string }) {
    const item = await this.itemOuRefus(ctx, empreinte);
    if (!["PERTINENT", "NON_PERTINENT"].includes(dto?.statut ?? ""))
      throw new BadRequestException("statut requis : PERTINENT | NON_PERTINENT");
    if (dto.statut === "NON_PERTINENT" && !dto?.motif?.trim())
      throw new BadRequestException("R7 : écarter un item de veille exige un motif");
    if (dto.statut === "PERTINENT" && !(dto.regles ?? []).length)
      throw new BadRequestException("R311 : un item PERTINENT référence les règles Rn impactées");
    this.validerRegles(dto.regles);
    await this.prisma.$transaction(async (tx: Tx) => {
      await this.emit(tx, ctx.tenantId, "regwatch.qualification", empreinte,
        { empreinte, statut: dto.statut, motif: dto.motif?.trim() ?? null, impact: dto.impact ?? null,
          regles: dto.regles ?? [], surProposition: dto.surProposition ?? null, par: ctx.userId });
      if (dto.statut === "PERTINENT")
        await this.emit(tx, ctx.tenantId, "tache.regwatch.analyse", empreinte,
          { empreinte, titre: item.titre, regles: dto.regles, impact: dto.impact ?? null, par: ctx.userId });
    });
    await this.audit.log(ctx.tenantId, ctx.userId, "REGWATCH_QUALIFIE", `${empreinte.slice(0, 8)}:${dto.statut}`);
    return { empreinte, statut: dto.statut };
  }

  // Digest — compté, notifié par événement (R39) ; jamais un blocage.
  async digest(ctx: Ctx) {
    const items = await this.items(ctx);
    const parStatut: Record<string, number> = {};
    for (const i of items) parStatut[i.statut] = (parStatut[i.statut] ?? 0) + 1;
    await this.prisma.$transaction(async (tx: Tx) =>
      this.emit(tx, ctx.tenantId, "regwatch.digest", new Date().toISOString().slice(0, 10),
        { parStatut, notifie: ["CO", "CO_SR", "DIR"], par: ctx.userId }));
    return { parStatut };
  }
}

@Controller("regwatch")
export class RegwatchController {
  constructor(private svc: RegwatchService) {}
  @Post("collecter")                    collecter(@Req() r: any) { return this.svc.collecter(r.ctx); }                                  // VR-01/02
  @Get("items")                         items(@Req() r: any) { return this.svc.items(r.ctx); }
  @Post("items/:empreinte/proposer")    proposer(@Req() r: any, @Param("empreinte") e: string, @Body() b: any) { return this.svc.proposer(r.ctx, e, b ?? {}); }   // VR-04
  @Post("items/:empreinte/qualifier")   qualifier(@Req() r: any, @Param("empreinte") e: string, @Body() b: any) { return this.svc.qualifier(r.ctx, e, b ?? {}); } // VR-03/05
  @Post("digest")                       digest(@Req() r: any) { return this.svc.digest(r.ctx); }
}

@Module({ controllers: [RegwatchController], providers: [RegwatchService] })
export class RegwatchModule {}
