// Source : docs/reference/olive-demo.html 40052–40064 — porté verbatim.
// Cloisonnement (segregation) des clients par rôle : ALL / DESK / OWN.
import CLIENTS from "../fixtures/CLIENTS.json";
import { amlHash } from "./preonboarding-support";

export const DESKS = ["Genève", "Zurich", "Lugano", "Middle East", "Asia"];
export const CLOISON_RULES: any = { RM: "OWN", ARM: "OWN", CO: "ALL", CO_SR: "ALL", MLRO: "ALL", BRM: "DESK", DIR: "ALL", HPB: "ALL", CEO: "ALL", CF: "ALL", ESG: "DESK", LEGAL: "ALL", AUDIT: "ALL", ADMIN: "ALL" };
(function assignDesks() { (CLIENTS as any[]).forEach(function (c) { if (!c.desk) c.desk = DESKS[amlHash(c.id + "DSK", DESKS.length)]; }); })();
export function clientVisibleTo(user: any, c: any): boolean {
  if (!user)
    return true;
  const rule = CLOISON_RULES[user.role] || "ALL";
  if (rule === "ALL")
    return true;
  if (rule === "DESK")
    return !user.desk || c.desk === user.desk;
  return c.rm === user.name; // OWN
}
