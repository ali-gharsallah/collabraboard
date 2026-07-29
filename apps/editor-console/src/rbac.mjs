// RBAC de l'instance VENDOR (R319) — EDITOR n'existe QUE ici. Cette liste est LOCALE à la
// console éditeur : elle n'est jamais importée par apps/api (le RBAC tenant l'ignore —
// VE-01, test négatif permanent des deux côtés).
export const ROLES_VENDOR = ["EDITOR", "VENDOR_ADMIN", "SUPPORT"];

export function garderRoleVendor(role) {
  if (!ROLES_VENDOR.includes(role))
    throw new Error(`R319 : rôle inconnu du RBAC vendor — ${role}`);
}
