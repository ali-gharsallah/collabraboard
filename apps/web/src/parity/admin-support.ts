// Source : docs/reference/olive-demo.html — ADMIN_NAV (39881), SCOPE_OPTS (39135), WF_ROLE_UNIVERSE (15315). Verbatim.
// wfEmit consigné (le bus d'événements de paramétrage relève du backend gouverné).

export function wfEmit(_type?: any, _def?: any, _patch?: any) { /* consigné */ }

export const WF_ROLE_UNIVERSE = ["RM", "ARM", "CO", "CO_SR", "AML", "MLRO", "BRM", "ESG", "LEGAL", "CF", "HPB", "CEO", "DIR"];

export const SCOPE_OPTS: any[] = [
{ id: "own_clients", icon: "👤", label: "Clients propres", desc: "Ne voit que les clients dont il est RM / ARM attitré." },
{ id: "all_clients", icon: "👥", label: "Tous les clients", desc: "Vue transverse — Compliance, Central File, Direction." },
{ id: "read_only", icon: "👁", label: "Lecture seule", desc: "Consultation sans modification — audit, inspection." },
{ id: "admin", icon: "⚙", label: "Admin", desc: "Paramétrage, utilisateurs, référentiels." },
];

// Source : docs/reference/olive-demo.html 31916-31922 — SANCTIONS_SOURCES. Verbatim.
export const SANCTIONS_SOURCES: any[] = [
{ id: "ofac", label: "OFAC SDN (US Treasury)", ver: "2026-07-10", entries: 12480, mode: "Flux auto quotidien", status: "À jour" },
{ id: "seco", label: "SECO SESAM (Suisse)", ver: "2026-07-11", entries: 4312, mode: "Flux auto quotidien", status: "À jour" },
{ id: "eu", label: "UE — mesures restrictives", ver: "2026-07-09", entries: 5121, mode: "Flux auto quotidien", status: "À jour" },
{ id: "un", label: "ONU — Conseil de sécurité", ver: "2026-07-08", entries: 1098, mode: "Flux auto hebdo", status: "À jour" },
{ id: "hmt", label: "UK HMT / OFSI", ver: "2026-06-30", entries: 4870, mode: "Manuel", status: "⚠ 11 j" },
];

export const ADMIN_NAV: any[] = [
{ group: "Identité & accès", items: [
{ id: "screencfg", icon: "◫", label: "Colonnes & libellés par écran" },
{ id: "user_create", icon: "➕", label: "Créer un utilisateur" },
{ id: "users", icon: "⚙", label: "Utilisateurs & rôles" },
{ id: "rights", icon: "🔐", label: "Matrice des droits" },
{ id: "cloison", icon: "🧱", label: "Cloisonnement des clients" },
{ id: "ldap", icon: "🗝", label: "Annuaire LDAP / AD" },
] },
{ group: "Modules métier", items: [
{ id: "pms_admin", icon: "▦", label: "PMS — profils & limites" },
{ id: "cb_admin", icon: "🌐", label: "Cross-Border — country manual" },
{ id: "riskcountries", icon: "⚑", label: "Pays à risque (GAFI + interne)" },
{ id: "sanctionssrc", icon: "⛔", label: "Listes de sanctions & embargos" },
{ id: "gov_admin", icon: "🎓", label: "Certifications & délais MROS" },
{ id: "trip_admin", icon: "✈", label: "Business Trip — quotas & rôles" },
{ id: "ar_admin", icon: "↻", label: "Account Review — revue de groupe" },
{ id: "offboarding_admin", icon: "🚪", label: "Offboarding" },
{ id: "rmai_config", icon: "✦", label: "Assistants IA" },
] },
{ group: "KYC & Onboarding", items: [
{ id: "kyc_types", icon: "🗂", label: "KYC Types" },
{ id: "kycar_workflow", icon: "⌘", label: "Workflow KYC & AR" },
{ id: "workflow", icon: "🏛", label: "Workflows — Versions & publication" },
{ id: "preonboard_admin", icon: "⚡", label: "Pré-onboarding" },
{ id: "docmatrix", icon: "▤", label: "Matrice documentaire" },
{ id: "gedparams", icon: "▣", label: "GED — Paramètres" },
{ id: "registre", icon: "⚙", label: "Paramètres — Registre R-Q" },
{ id: "sectionvis", icon: "◫", label: "Écrans & visibilité" },
{ id: "referentiels", icon: "▣", label: "Référentiels" },
{ id: "scoring", icon: "◉", label: "Scoring client" },
{ id: "amlscen", icon: "◈", label: "Scénarios AML" },
] },
{ group: "Système & sécurité", items: [
{ id: "audit", icon: "☷", label: "Audit paramètres" },
{ id: "vendorlic", icon: "◈", label: "Licences — Modules par instance" },
{ id: "resilience", icon: "⚡", label: "Résilience & sécurité" },
] },
];
