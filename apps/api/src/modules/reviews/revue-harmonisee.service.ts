import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

/**
 * Bloc 65 — Harmonisation des revues (Volet A : moteur, repo R466–R473, HR-01..14).
 * SQUELETTE : les rouges d'abord (doctrine Blocs 62/63/64) — chaque méthode sera implémentée
 * en delta sur l'existant (reviews R283 = l'AR est DÉJÀ une révision du dossier KYC ;
 * la GAR devient un dossier PARENT projeté d'événements, pattern moteur Bloc 62).
 */

type Ctx = { tenantId: string; userId: string; role: string };

@Injectable()
export class RevueHarmoniseeService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private kycSvc?: { create(ctx: Ctx, dto: any, opts: any): Promise<any>; answer(ctx: Ctx, code: string, qCode: string, answer: string): Promise<any> };
  brancherKyc(svc: any) { this.kycSvc = svc; }

  async ouvrirRevue(_ctx: Ctx, _deadlineId: string, _dto: { type?: string }): Promise<any> {
    throw new ConflictException("R467 : non implémenté (Bloc 65 Volet A)");
  }
  async modifierReponse(_ctx: Ctx, _kycCode: string, _dto: { section?: string; question?: string; valeur?: string }): Promise<any> {
    throw new ConflictException("R467 : non implémenté (Bloc 65 Volet A)");
  }
  async delta(_ctx: Ctx, _kycCode: string): Promise<any> {
    throw new ConflictException("R467 : non implémenté (Bloc 65 Volet A)");
  }
  async viserDelta(_ctx: Ctx, _kycCode: string): Promise<any> {
    throw new ConflictException("R467 : non implémenté (Bloc 65 Volet A)");
  }
  async viserEnBloc(_ctx: Ctx, _kycCode: string): Promise<any> {
    throw new ConflictException("R467 : non implémenté (Bloc 65 Volet A)");
  }
  async poserVerdict(_ctx: Ctx, _kycCode: string, _dto: { verdict?: string; motivation?: string }): Promise<any> {
    throw new ConflictException("R468 : non implémenté (Bloc 65 Volet A)");
  }
  async accepterAiguillage(_ctx: Ctx, _kycCode: string, _dto: { option?: string }): Promise<any> {
    throw new ConflictException("R468 : non implémenté (Bloc 65 Volet A)");
  }
  async cloturerRevue(_ctx: Ctx, _kycCode: string): Promise<any> {
    throw new ConflictException("R468 : non implémenté (Bloc 65 Volet A)");
  }
  async surChangementRisque(_ctx: Ctx, _clientId: string, _dto: { risque?: string; motif?: string }): Promise<any> {
    throw new ConflictException("R468 : non implémenté (Bloc 65 Volet A)");
  }
  async composerGroupes(_ctx: Ctx): Promise<any> {
    throw new ConflictException("R469 : non implémenté (Bloc 65 Volet A)");
  }
  async declencherRevueGroupe(_ctx: Ctx, _dto: { cle?: string; origine?: any }): Promise<any> {
    throw new ConflictException("R470 : non implémenté (Bloc 65 Volet A)");
  }
  async vueConsolidee(_ctx: Ctx, _garId: string): Promise<any> {
    throw new ConflictException("R470 : non implémenté (Bloc 65 Volet A)");
  }
  async viserDecisionGroupe(_ctx: Ctx, _garId: string, _dto: { motivation?: string }): Promise<any> {
    throw new ConflictException("R470 : non implémenté (Bloc 65 Volet A)");
  }
  async declencherRevueMembre(_ctx: Ctx, _dto: { clientId?: string; motif?: string; origine?: any }): Promise<any> {
    throw new ConflictException("R471 : non implémenté (Bloc 65 Volet A)");
  }
  async rejouerGar(_ctx: Ctx, _garId: string, _asOf?: Date): Promise<any> {
    throw new ConflictException("R472 : non implémenté (Bloc 65 Volet A)");
  }
  async dossier(_ctx: Ctx, _ref: string): Promise<any> {
    throw new ConflictException("R472 : non implémenté (Bloc 65 Volet A)");
  }
  async parametresReview(_ctx: Ctx): Promise<any> {
    throw new ConflictException("R473 : non implémenté (Bloc 65 Volet A)");
  }
  async modifierParametreReview(_ctx: Ctx, _dto: any): Promise<any> {
    throw new ConflictException("R473 : non implémenté (Bloc 65 Volet A)");
  }
}
