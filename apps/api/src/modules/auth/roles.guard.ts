import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

/**
 * RBAC centralisé : lit les rôles requis (@Roles) sur la route/classe et les confronte à
 * req.ctx.role (posé par TenantMiddleware depuis le JWT). Défense en profondeur : les services
 * gardent leurs contrôles métier, le guard bloque en amont, déclarativement.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY,
      [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;          // endpoint non restreint
    const req = context.switchToHttp().getRequest();
    const role = req?.ctx?.role;
    if (!role || !required.includes(role))
      throw new ForbiddenException(`Rôle ${role ?? "—"} non autorisé (requis : ${required.join(", ")})`);
    return true;
  }
}
