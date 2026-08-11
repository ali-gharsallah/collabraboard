/**
 * UI v2 — cartographie de migration des écrans v1, DÉRIVÉE du registre des capacités
 * (V2-M14). Le principe n°2 du handoff tient : « un écran rarement utilisé n'a pas besoin
 * d'une entrée de menu permanente ; il a besoin d'être trouvable en deux frappes ». Chaque
 * écran de la v1 est donc cherchable en ⌘K sous son ANCIEN nom et mène à sa destination v2.
 *
 * CHANGEMENT DE MÉTHODE (V2-M14) : cette liste était écrite à la main et couvrait 60 des 82
 * entrées v1 — 22 capacités n'avaient aucune destination, pas même en recherche (écart
 * E-V2-3). Elle se CALCULE désormais depuis `capacites.ts`, la source unique. Une capacité
 * oubliée devient donc impossible : la garde U2-40 compare les deux et rougit.
 */
import { CAPACITES, type Capacite } from "./capacites";

export type EcranMigre = { id: string; libelle: string; detail: string };

/** Phrase de destination lisible : où la capacité atterrit, et si elle est déjà bâtie. */
export function detailDe(c: Capacite): string {
  const ou = c.onglet ? `→ ${LIBELLE_ECRAN[c.destination] ?? c.destination}, onglet ${c.onglet}`
                      : `→ ${LIBELLE_ECRAN[c.destination] ?? c.destination}`;
  return c.statut === "livre" ? ou : `${ou} — à construire`;
}

const LIBELLE_ECRAN: Record<string, string> = {
  journee: "Ma journée", dossiers: "Mes dossiers", clients: "Mes clients",
  entree: "Entrée en relation", kyc: "Connaissance client", surveillance: "Surveillance",
  revue: "Revue & sortie", rapports: "Rapports", param: "Paramétrage",
  crossborder: "Cross-Border", custody: "Custody & TA", oprisk: "Octopulse OpRisk",
  legal: "Legal — Contrats", cpsi: "Profilage CPSI", pms: "PMS", fx: "Multi-devise & FX",
  mobile: "Mobile Banking", islamic: "Finance Islamique",
};

export const ECRANS_MIGRES: EcranMigre[] = CAPACITES.map((c) => ({
  id: c.destination, libelle: c.libelle, detail: detailDe(c),
}));
