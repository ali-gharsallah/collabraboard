// Source : docs/reference/olive-demo.html 29631-préambule (CB_ACTIVITIES/CB_RULES/cbCountry/cbCheckTrip/CB_V_META) — porté verbatim.
// Cross-Border (MOD-33) : country manual — ce qu'un RM suisse peut faire par juridiction.
import { T } from "./tokens";
import { pushParamAudit } from "./param-audit-support";

export const CB_ACTIVITIES: any[] = [
  { code: "MEET", label: "Rencontre client existant" },
  { code: "PROSP", label: "Prospection active" },
  { code: "ADVICE", label: "Conseil en placement" },
  { code: "MKT", label: "Documentation marketing" },
  { code: "SIGN", label: "Signature de contrat" },
  { code: "ORDER", label: "Réception d'ordres" },
];
export const CB_RULES: any[] = [
  { cc: "CH", country: "Suisse", flag: "🇨🇭", regime: "Marché domestique", rules: { MEET: ["OK", ""], PROSP: ["OK", ""], ADVICE: ["OK", ""], MKT: ["OK", ""], SIGN: ["OK", ""], ORDER: ["OK", ""] } },
  { cc: "FR", country: "France", flag: "🇫🇷", regime: "UE — pas de passeport MiFID (banque CH)", rules: { MEET: ["OK", "Servicing passif d'une relation existante toléré"], PROSP: ["NON", "Démarchage bancaire réservé aux établissements agréés (CMF)"], ADVICE: ["COND", "Uniquement reverse solicitation documentée"], MKT: ["COND", "Documentation sans caractère promotionnel, remise sur demande"], SIGN: ["NON", "Signature en France = fourniture de service en France"], ORDER: ["NON", "Réception d'ordres nécessite l'agrément ACPR"] } },
  { cc: "DE", country: "Allemagne", flag: "🇩🇪", regime: "Exemption BaFin (§2 Abs.5 KWG) si accordée", rules: { MEET: ["OK", "Sous couvert de l'exemption BaFin de l'établissement"], PROSP: ["COND", "Uniquement clientèle fortunée pré-qualifiée, via l'exemption"], ADVICE: ["COND", "Dans le cadre de l'exemption BaFin"], MKT: ["OK", "Documentation conforme WpHG"], SIGN: ["COND", "Recommandé : signature en Suisse"], ORDER: ["COND", "Via l'entité couverte par l'exemption"] } },
  { cc: "IT", country: "Italie", flag: "🇮🇹", regime: "Restrictif — pas d'exemption générale", rules: { MEET: ["OK", "Relation existante uniquement"], PROSP: ["NON", "Sollecitazione réservée aux agréés Consob"], ADVICE: ["NON", "Interdit sans succursale locale"], MKT: ["NON", "Toute promotion = offre au public"], SIGN: ["NON", ""], ORDER: ["NON", ""] } },
  { cc: "GB", country: "Royaume-Uni", flag: "🇬🇧", regime: "Overseas Persons Exclusion (FSMA)", rules: { MEET: ["OK", ""], PROSP: ["COND", "Financial promotion : via personne autorisée FCA (s21)"], ADVICE: ["COND", "OPE si l'activité résulte d'une legitimate approach"], MKT: ["COND", "Approbation s21 FSMA requise"], SIGN: ["COND", "Recommandé : conclusion depuis la Suisse"], ORDER: ["OK", "Dans le cadre de l'OPE"] } },
  { cc: "US", country: "États-Unis", flag: "🇺🇸", regime: "SEC — régime le plus restrictif", rules: { MEET: ["COND", "Strictement servicing, aucune discussion d'investissement"], PROSP: ["NON", "Interdit sans enregistrement SEC/FINRA"], ADVICE: ["NON", "Investment advice = enregistrement RIA obligatoire"], MKT: ["NON", "Toute documentation = general solicitation"], SIGN: ["NON", ""], ORDER: ["NON", "Réservé broker-dealer enregistré"] } },
  { cc: "AE", country: "Émirats (Dubaï)", flag: "🇦🇪", regime: "DIFC/DFSA — tolérant hors place financière", rules: { MEET: ["OK", ""], PROSP: ["COND", "Professional clients uniquement (DFSA)"], ADVICE: ["COND", "Hors DIFC : sur base reverse solicitation"], MKT: ["COND", "Documentation restreinte aux professional clients"], SIGN: ["COND", "Privilégier la signature en Suisse"], ORDER: ["COND", "Via desk suisse"] } },
  { cc: "SA", country: "Arabie saoudite", flag: "🇸🇦", regime: "CMA — très restrictif", rules: { MEET: ["COND", "Visites privées, aucun acte de commerce"], PROSP: ["NON", "Securities business réservé aux licenciés CMA"], ADVICE: ["NON", ""], MKT: ["NON", ""], SIGN: ["NON", ""], ORDER: ["NON", ""] } },
  { cc: "SG", country: "Singapour", flag: "🇸🇬", regime: "MAS — exemptions accredited investors", rules: { MEET: ["OK", ""], PROSP: ["COND", "Accredited investors, safe harbour MAS"], ADVICE: ["COND", "Exemption FAA pour AI, à documenter"], MKT: ["COND", "Documents réservés AI"], SIGN: ["OK", ""], ORDER: ["COND", "Via arrangement exempté"] } },
  { cc: "HK", country: "Hong Kong", flag: "🇭🇰", regime: "SFC — professional investors", rules: { MEET: ["OK", ""], PROSP: ["COND", "Professional investors uniquement (SFO)"], ADVICE: ["COND", "PI, sans établissement local"], MKT: ["COND", "Documentation PI"], SIGN: ["COND", ""], ORDER: ["COND", "Desk suisse recommandé"] } },
  { cc: "BR", country: "Brésil", flag: "🇧🇷", regime: "CVM — restrictif", rules: { MEET: ["OK", "Relation existante"], PROSP: ["NON", "Oferta pública réservée aux enregistrés CVM"], ADVICE: ["NON", ""], MKT: ["NON", ""], SIGN: ["NON", ""], ORDER: ["COND", "Ordre non sollicité initié par le client"] } },
  { cc: "RU", country: "Russie", flag: "🇷🇺", regime: "⛔ Sanctions — voyage soumis à autorisation", rules: { MEET: ["NON", "Politique sanctions : déplacement interdit sans clearance Compliance"], PROSP: ["NON", ""], ADVICE: ["NON", ""], MKT: ["NON", ""], SIGN: ["NON", ""], ORDER: ["NON", "Contrôle sanctions sur toute instruction"] } },
  { cc: "TR", country: "Turquie", flag: "🇹🇷", regime: "CMB — restrictif", rules: { MEET: ["OK", "Relation existante"], PROSP: ["NON", "Réservé aux licenciés CMB"], ADVICE: ["COND", "Reverse solicitation documentée"], MKT: ["NON", ""], SIGN: ["NON", ""], ORDER: ["COND", "Ordre client non sollicité"] } },
];
export function cbCountry(cc: string): any { return CB_RULES.find(function (x) { return x.cc === cc; }); }
export function cbCheckTrip(cc: string, acts: string[], user: any): any {
  const c = cbCountry(cc);
  if (!c)
    return { c: null, lines: [], verdict: "INCONNU", blocked: 0 };
  const lines = acts.map(function (a) {
    const r = c.rules[a] || ["COND", "Juridiction à analyser au cas par cas"];
    return { act: CB_ACTIVITIES.find(function (x) { return x.code === a; }).label, code: a, v: r[0], note: r[1] };
  });
  const blocked = lines.filter(function (l) { return l.v === "NON"; }).length;
  const cond = lines.filter(function (l) { return l.v === "COND"; }).length;
  const verdict = blocked > 0 ? "REFUS PARTIEL" : cond > 0 ? "AUTORISÉ SOUS CONDITIONS" : "AUTORISÉ";
  pushParamAudit((user && user.name) || "—", "Cross-Border — check pré-voyage " + c.country + " : " + acts.length + " activité(s) → " + verdict + " (" + blocked + " interdite(s), " + cond + " sous conditions)");
  return { c: c, lines: lines, verdict: verdict, blocked: blocked, cond: cond };
}
export const CB_V_META: any = { OK: ["OK", T.green, "greenSoft"], COND: ["Conditions", T.amber, "amberSoft"], NON: ["Interdit", T.red, "redSoft"] };
