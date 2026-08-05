// PACK DE LANGUE ARABE — chargé PARESSEUSEMENT (import dynamique dans i18n.ts::chargerAR), donc
// HORS du bundle de base : le budget 220 kB gz ne compte pas ce pack (« pull ar out », décision PO
// 2026-08-05). L'AR reste la 5e langue ratifiée (« Both », E-FB-4) ; son contenu est une PASSE
// MACHINE (MSA, SPEC-I18N §2) en attente de relecture pro avant BAT — provenance conservée.
//
// Contenu : NAV principale (hand-authored ici) + CHROME AML gap (familles + UI, généré, importé
// depuis i18n-aml-gap.ar.gen.ts). Toute clé absente retombe sur le FR côté i18n.ts (« jamais un trou »).
import { AMLGAP_FAMILLES_AR, AMLGAP_UI_AR } from "./i18n-aml-gap.ar.gen";

// NAV principale (53 libellés). Noms de produits/acronymes internationaux conservés (Octopulse, PMS,
// Olivia, KYC, API). Clés = FR (doctrine « le libellé FR EST la clé »).
const NAV_AR: Record<string, string> = {
  "Analyseur SWIFT/SEPA": "محلّل SWIFT/SEPA", "Multi-devise & FX": "متعدّد العملات والصرف الأجنبي",
  "Exécution & Settlement": "التنفيذ والتسوية", "Legal — Contrats": "الشؤون القانونية — العقود",
  "Pré-prospection": "ما قبل الاستكشاف", "Octopulse OppRisk": "Octopulse OppRisk", "Accueil": "الرئيسية",
  "Dashboard central": "لوحة القيادة المركزية", "Clients & Relations": "العملاء والعلاقات",
  "Prospect à contacter": "عميل محتمل للاتصال", "Prospect en contact": "عميل محتمل قيد الاتصال",
  "Prospect à onboarder": "عميل محتمل للإدماج", "Clients": "العملاء", "Personnes": "الأشخاص", "KYC": "KYC",
  "Account Review": "مراجعة الحساب", "Change of Circumstances": "تغيّر الظروف", "Offboarding": "إنهاء العلاقة",
  "Front & Croissance": "الواجهة والنمو", "CRM Banque": "إدارة علاقات العملاء المصرفية",
  "Contact Reports": "تقارير الاتصال", "Prochaines actions": "الإجراءات التالية", "Tâches": "المهام",
  "Business Trip": "رحلة عمل", "Cross-Border": "عبر الحدود", "Compliance & Risque": "الامتثال والمخاطر",
  "Screening": "الفرز", "Compliance Center": "مركز الامتثال", "AML Investigation": "تحقيق مكافحة غسل الأموال",
  "Investigation financière": "التحقيق المالي", "Transactions Risk Monitoring": "مراقبة مخاطر المعاملات",
  "Transferts & ordres": "التحويلات والأوامر", "Registre LBA": "سجل مكافحة غسل الأموال",
  "Corroboration KYC": "تأكيد KYC", "Reporting réglementaire": "الإبلاغ التنظيمي",
  "Formations & habilitations": "التدريب والتأهيل", "Veille réglementaire": "الرصد التنظيمي",
  "Wealth & Marchés": "الثروات والأسواق", "PMS": "PMS", "Mobile Banking": "الخدمات المصرفية عبر الهاتف",
  "Dashboard Exécutif": "لوحة القيادة التنفيذية", "Data & Intelligence": "البيانات والذكاء",
  "Olivia (AI Core)": "Olivia (نواة الذكاء الاصطناعي)", "BI — Reporting sur mesure": "ذكاء الأعمال — تقارير مخصّصة",
  "GED — Documents": "إدارة الوثائق — المستندات", "API & Intégrations": "API والتكاملات", "Intégrations": "التكاملات",
  "Configuration": "الإعدادات", "Administration": "الإدارة", "Workflow Builder": "منشئ سير العمل",
  "Workflow Management": "إدارة سير العمل", "Questionnaire Builder": "منشئ الاستبيانات",
  "Administration Éditeur": "إدارة المحرّر",
};

// Dictionnaire AR complet (clés FR → AR) fusionné dans DICT.AR au chargement.
export const AR_PACK: Record<string, string> = { ...NAV_AR, ...AMLGAP_FAMILLES_AR, ...AMLGAP_UI_AR };
