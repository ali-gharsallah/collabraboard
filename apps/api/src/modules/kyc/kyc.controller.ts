import { Body, Controller, Get, Param, Post, Patch, Req, BadRequestException } from "@nestjs/common";
import { KycCreate, QuestionAnswer } from "@olive/shared/src/contracts";
import { KycService } from "./kyc.service";

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
  @Get(":code")
  get(@Req() req: any, @Param("code") code: string) { return this.svc.get(req.ctx, code); }

  @Patch(":code/questions/:qcode")
  answer(@Req() req: any, @Param("code") code: string, @Param("qcode") qcode: string, @Body() body: unknown) {
    const p = QuestionAnswer.safeParse(body);
    if (!p.success) throw new BadRequestException(p.error.flatten());
    return this.svc.answer(req.ctx, code, qcode, p.data.answer);
  }
  @Post(":code/visas/:section")
  visa(@Req() req: any, @Param("code") code: string, @Param("section") section: string, @Body() body: any) {
    return this.svc.signVisa(req.ctx, code, section, body?.verdict ?? "OK", body?.message ?? "");
  }

  // RBAC appliqué DANS le service (après four-eyes R13/R52) — voir note d'en-tête.
  @Post(":code/validate")
  validate(@Req() req: any, @Param("code") code: string) { return this.svc.validate(req.ctx, code); }

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
  hNext(@Req() req: any, @Param("code") code: string, @Body() body: any) { return this.svc.handoffNext(req.ctx, code, body?.message ?? ""); }
  @Post(":code/handoff/back")
  hBack(@Req() req: any, @Param("code") code: string, @Body() body: any) { return this.svc.handoffBack(req.ctx, code, body?.message ?? ""); }
  @Post(":code/handoff/validate")
  hValidate(@Req() req: any, @Param("code") code: string, @Body() body: any) { return this.svc.handoffValidate(req.ctx, code, body?.message ?? ""); }
  @Post(":code/handoff/reject")
  hReject(@Req() req: any, @Param("code") code: string, @Body() body: any) { return this.svc.handoffReject(req.ctx, code, body?.message ?? ""); }
}
