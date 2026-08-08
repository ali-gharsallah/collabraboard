import { Injectable, ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { PrismaService } from "../../common/prisma.service";
import { PasswordHasher } from "./password";

type Safe = { id: string; email: string; name: string; role: string; active: boolean; mfaEnabled: boolean };
const strip = (u: any): Safe => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, mfaEnabled: u.mfaEnabled });

// R319 (dégel V8) : le RBAC tenant est une liste FERMÉE — miroir de l'enum Prisma `Role`.
// Un rôle hors liste refuse TYPÉ (jamais un 500 d'enum) ; le rôle vendor n'existe que sur
// l'instance éditeur, séparée (déploiement, base, IAM propres) — test négatif permanent VE-01.
const ROLES_TENANT = ["RM", "ARM", "CO", "CO_SR", "MLRO", "CF", "BRM", "DIR", "ADMIN", "SO"];
function garderRoleTenant(role: string) {
  if (!ROLES_TENANT.includes(role)) throw new BadRequestException(
    `R319 : rôle inconnu du RBAC tenant — ${role}. Le RBAC est une liste fermée ; les rôles de l'éditeur n'existent que sur son instance séparée.`);
}

/** Gestion des utilisateurs (réservée ADMIN via @Roles). Ne renvoie jamais le hash ni le secret MFA. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: { email: string; name: string; role: string; password: string }): Promise<Safe> {
    garderRoleTenant(dto.role);                                              // R319 — VE-01
    const dup = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (dup) throw new ConflictException("Email déjà utilisé dans ce tenant");
    const u = await this.prisma.user.create({ data: {
      tenantId, email: dto.email, name: dto.name, role: dto.role as any, active: true,
      passwordHash: PasswordHasher.hash(dto.password) } });
    return strip(u);
  }

  async list(tenantId: string): Promise<Safe[]> {
    const us = await this.prisma.user.findMany({ where: { tenantId }, orderBy: { email: "asc" } });
    return us.map(strip);
  }

  private async mustGet(tenantId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!u) throw new NotFoundException("Utilisateur introuvable");
    return u;
  }

  // ── IM-02 (canon triage écrans, ratifié 2026-07-28) : la banque ne se verrouille pas elle-même —
  //    retirer le DERNIER ADMIN actif (rétrogradation OU désactivation) refuse typé. ──
  private async garderDernierAdmin(tenantId: string, userId: string) {
    const autres = await this.prisma.user.count({
      where: { tenantId, role: "ADMIN" as any, active: true, id: { not: userId } } });
    if (autres === 0) throw new BadRequestException(
      "IAM_DERNIER_ADMIN : dernier ADMIN actif du tenant — nommer un second ADMIN avant de retirer celui-ci");
  }

  async setActive(tenantId: string, userId: string, active: boolean): Promise<Safe> {
    const u = await this.mustGet(tenantId, userId);
    if (!active && u.role === ("ADMIN" as any) && u.active)
      await this.garderDernierAdmin(tenantId, userId);                       // IM-02
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { active } }));
  }

  async setRole(tenantId: string, userId: string, role: string, par?: string): Promise<Safe> {
    garderRoleTenant(role);                                                  // R319 — VE-01
    const u = await this.mustGet(tenantId, userId);
    // R284/SO-05 : SO surveille, ADMIN paramètre — les deux regards ne se cumulent pas sur une
    // même personne (séparation structurelle). Refus TYPÉ au défaut ; une petite banque
    // assouplit par LE registre (cumul_so_admin_interdit=false, motivé) — accepté ET tracé.
    const cumul = (u.role === "ADMIN" && role === "SO") || (u.role === "SO" && role === "ADMIN");
    if (cumul) {
      const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
      const interdit = ((t?.settings as any) ?? {}).cumul_so_admin_interdit ?? true;
      if (interdit) throw new BadRequestException(
        "cumul_so_admin_interdit : SO surveille (journaux), ADMIN paramètre — un même utilisateur ne porte pas les deux regards (R284) ; assouplissable par le registre R-Q, tracé");
      await emitEvent(this.prisma, tenantId, "iam.cumul_so_admin.autorise",
        userId, { de: u.role, vers: role, par: par ?? "system" });
    }
    if (u.role === ("ADMIN" as any) && role !== "ADMIN" && u.active)
      await this.garderDernierAdmin(tenantId, userId);                       // IM-02 — APRÈS la règle de paire SO-05
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { role: role as any } }));
  }

  /** Réinitialise la MFA (force un nouvel enrôlement) — ex. perte de téléphone. */
  async resetMfa(tenantId: string, userId: string): Promise<Safe> {
    await this.mustGet(tenantId, userId);
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } }));
  }
}
