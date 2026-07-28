import { Injectable, ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { PasswordHasher } from "./password";

type Safe = { id: string; email: string; name: string; role: string; active: boolean; mfaEnabled: boolean };
const strip = (u: any): Safe => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, mfaEnabled: u.mfaEnabled });

/** Gestion des utilisateurs (réservée ADMIN via @Roles). Ne renvoie jamais le hash ni le secret MFA. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: { email: string; name: string; role: string; password: string }): Promise<Safe> {
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

  async setActive(tenantId: string, userId: string, active: boolean): Promise<Safe> {
    await this.mustGet(tenantId, userId);
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { active } }));
  }

  async setRole(tenantId: string, userId: string, role: string, par?: string): Promise<Safe> {
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
      await this.prisma.domainEvent.create({ data: { tenantId, type: "iam.cumul_so_admin.autorise",
        aggregateId: userId, payload: { de: u.role, vers: role, par: par ?? "system" },
        at: new Date().toISOString() } });
    }
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { role: role as any } }));
  }

  /** Réinitialise la MFA (force un nouvel enrôlement) — ex. perte de téléphone. */
  async resetMfa(tenantId: string, userId: string): Promise<Safe> {
    await this.mustGet(tenantId, userId);
    return strip(await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } }));
  }
}
