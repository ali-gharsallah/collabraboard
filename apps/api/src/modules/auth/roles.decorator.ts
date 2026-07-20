import { SetMetadata } from "@nestjs/common";
export const ROLES_KEY = "roles";
/** Restreint un endpoint à une liste de rôles. Ex : @Roles("CO_SR","MLRO","DIR","ADMIN"). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
