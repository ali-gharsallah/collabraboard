import { Body, Controller, Get, Headers, Param, Post, Patch, Query, Req, BadRequestException } from "@nestjs/common";
import { KycCreate, QuestionAnswer } from "@olive/shared/src/contracts";
import { KycService } from "./kyc.service";

// R336/LK (lot 1) : le contrôle de concurrence optimiste passe par l'en-tête If-Match (version
// attendue). Présent → verrou strict (409 concurrent_modification si périmée) ; absent → repli
// sur la version courante côté service (rollout expand). Accepte "5" ou la forme ETag W/"5".
function versionSiPresente(ifMatch?: string): number | undefined {
  if (!ifMatch) return undefined;
  const m = ifMatch.match(/\d+/);
  return m ? parseInt(m[0], 10) : undefined;
}

// PATCH 2026-07-19 (pré-vol e2e) :
// Le guard RBAC était retiré de `validate`. Un guard s'exécute AVANT le handler ;
// pour le créateur RM il levait 403 (rôle) et masquait le 409 four-eyes attendu par
// VAL-R52 / l'e2e. Le contrôle de rôle est conservé — il vit dans KycService.validate,
// APRÈS four-eyes (R13) et R52, ce qui donne l'ordre voulu : 409 four-eyes → 409 R52 →
// 403 rôle → 400 visas. Imports RolesGuard/Roles/UseGuards supprimés (plus utilisés ici).
@Controller("kyc")
export class KycController {
  constructor(private svc: KycService) {}

  @Post()
  create(@Req() req: any, @Body() body: unknown) {
    const p = KycCreate.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.create(req.ctx, { clientId: p.data.clientId,
      legalStructure: p.data.legalStructure, accountType: p.data.accountType,
      countryCode: p.data.countryCode, rmId: p.data.rmId });
  }
  // ── Portes minces Home (amendement Ali 2026-07-27 : critère « zéro endpoint nouveau » AMENDÉ). ──
  // T1 : liste des dossiers, périmètre par RÔLE côté serveur (RM/ARM = ses clients via Client.rmUserId ;
  // voit-tout = tenant ; ADMIN = refus, aucune donnée client — matrice A.3). Déclarées AVANT ":code".
  @Get()
  lister(@Req() req: any, @Query("statut") statut?: string) { return this.svc.lister(req.ctx, statut); }
  // T2 : visas PENDING dont requiredRole = MON rôle, sur les dossiers de mon périmètre (HO-05).
  @Get("visas/pending")
  visasPending(@Req() req: any) { return this.svc.visasPending(req.ctx); }
  // R291/DC-06 : l'AGRÉGAT de charge — visas PENDING par rôle, tenant entier (Direction/CO_SR).
  @Get("visas/charge")
  visasCharge(@Req() req: any) { return this.svc.visasCharge(req.ctx); }

  @Get(":code")
  get(@Req() req: any, @Param("code") code: string) { return this.svc.get(req.ctx, code); }

  // Rejeu KYC à date (Vague 1, esprit R127) — état reconstruit depuis le journal d'événements
  @Get(":code/access-matrix")
  matrix(@Req() r: any, @Param("code") code: string, @Query("asOf") asOf?: string) { return this.svc.accessMatrix(r.ctx, code, asOf); } // SD-01 + VD-03 (matrice d'époque, R282)
  @Patch(":code/questions/:qcode/access")
  access(@Req() r: any, @Param("code") code: string, @Param("qcode") q: string, @Body() b: any) { return this.svc.modifierAccess(r.ctx, code, q, b ?? {}); } // SD-01/02
  @Get(":code/voir-comme/:role")
  voirComme(@Req() r: any, @Param("code") code: string, @Param("role") role: string) { return this.svc.voirComme(r.ctx, code, role); } // SD-03
  @Get(":code/a-date")
  etatADate(@Req() req: any, @Param("code") code: string, @Query("date") date?: string) {
    return this.svc.etatADate(req.ctx, code, date ? new Date(date) : new Date());
  }

  @Patch(":code/questions/:qcode")
  answer(@Req() req: any, @Param("code") code: string, @Param("qcode") qcode: string, @Body() body: unknown) {
    const p = QuestionAnswer.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.answer(req.ctx, code, qcode, p.data.answer);
  }
  @Post(":code/visas/:section")
  visa(@Req() req: any, @Param("code") code: string, @Param("section") section: string, @Body() body: any, @Headers("if-match") ifMatch?: string) {
    return this.svc.signVisa(req.ctx, code, section, body?.verdict ?? "OK", body?.message ?? "", versionSiPresente(ifMatch));
  }

  // RBAC appliqué DANS le service (après four-eyes R13/R52) — voir note d'en-tête.
  @Post(":code/validate")
  validate(@Req() req: any, @Param("code") code: string, @Headers("if-match") ifMatch?: string) { return this.svc.validate(req.ctx, code, versionSiPresente(ifMatch)); }

  // R84 — édition exclusive (« la main » / checkout)
  @Post(":code/lock")
  lock(@Req() req: any, @Param("code") code: string) { return this.svc.takeLock(req.ctx, code); }
  @Post(":code/release")
  release(@Req() req: any, @Param("code") code: string) { return this.svc.releaseLock(req.ctx, code); }
  @Post(":code/request-hand")
  requestHand(@Req() req: any, @Param("code") code: string) { return this.svc.requestHand(req.ctx, code); }
  @Post(":code/pass-hand")
  passHand(@Req() req: any, @Param("code") code: string, @Body() body: any) { return this.svc.passHand(req.ctx, code, body?.to); }

  // R85 — passage de main section par section (message obligatoire)
  @Post(":code/handoff/next")
  hNext(@Req() req: any, @Param("code") code: string, @Body() body: any, @Headers("if-match") ifMatch?: string) { return this.svc.handoffNext(req.ctx, code, body?.message ?? "", versionSiPresente(ifMatch)); }
  @Post(":code/handoff/back")
  hBack(@Req() req: any, @Param("code") code: string, @Body() body: any, @Headers("if-match") ifMatch?: string) { return this.svc.handoffBack(req.ctx, code, body?.message ?? "", versionSiPresente(ifMatch)); }
  @Post(":code/handoff/validate")
  hValidate(@Req() req: any, @Param("code") code: string, @Body() body: any, @Headers("if-match") ifMatch?: string) { return this.svc.handoffValidate(req.ctx, code, body?.message ?? "", versionSiPresente(ifMatch)); }
  @Post(":code/handoff/reject")
  hReject(@Req() req: any, @Param("code") code: string, @Body() body: any, @Headers("if-match") ifMatch?: string) { return this.svc.handoffReject(req.ctx, code, body?.message ?? "", versionSiPresente(ifMatch)); }
}
