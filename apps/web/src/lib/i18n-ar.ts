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

// Sous-nav ÉDITEUR/ADMIN (53 libellés — `EXT` côté i18n.ts). Passe MACHINE MSA (SPEC-I18N §2).
// Produits/acronymes internationaux conservés (CPSI, Olivia, MROS, KYC, BRM, SSO, IAM, BAT, AML Gap).
const EXT_AR: Record<string, string> = {
  "Profilage CPSI": "تنميط CPSI", "Transactions & Marchés": "المعاملات والأسواق", "Audit": "التدقيق",
  "Recette client (BAT)": "قبول العميل (BAT)", "Bac à sable KYC": "بيئة اختبار KYC",
  "Bac à sable BRM": "بيئة اختبار BRM", "Bac à sable Central File": "بيئة اختبار الملف المركزي",
  "Bac à sable Workflow": "بيئة اختبار سير العمل", "Command Center": "مركز القيادة", "Onboarding": "الإدماج",
  "Screening avancé": "الفرز المتقدّم", "File d'alertes": "قائمة التنبيهات", "Dossiers de risque": "ملفات المخاطر",
  "Personnes / UBO": "الأشخاص / المستفيد الحقيقي", "Chgt circonstances": "تغيّر الظروف",
  "Custody & TA": "الحفظ ووكيل التحويل", "Settlement": "التسوية", "Reporting MROS": "إبلاغ MROS",
  "Pièces (GED)": "المستندات (إدارة الوثائق)", "GED / coffre": "إدارة الوثائق / الخزنة", "Workflow": "سير العمل",
  "Paramétrage": "الإعداد", "Config & Go-live": "التهيئة والإطلاق",
  "Référentiel AML": "المرجعية لمكافحة غسل الأموال", "Bac à sable AML": "بيئة اختبار مكافحة غسل الأموال",
  "Bac à sable Onboarding": "بيئة اختبار الإدماج", "Ports": "المنافذ", "Workflow Instances": "حالات سير العمل",
  "Formations": "التدريب", "Octopulse OpRisk": "Octopulse OpRisk", "Rejeu KYC à date": "إعادة تشغيل KYC بتاريخ",
  "Règles AML": "قواعد مكافحة غسل الأموال", "AML Gap": "AML Gap", "Finance Islamique": "التمويل الإسلامي",
  "CPSI · Profil": "CPSI · الملف", "CPSI · Segmentation": "CPSI · التقسيم", "CPSI · Risk cases": "CPSI · ملفات المخاطر",
  "CPSI · Barèmes": "CPSI · المقاييس", "CPSI · Guide": "CPSI · الدليل", "Olivia": "Olivia",
  "Olivia · Runs": "Olivia · التشغيلات", "Sections & droits": "الأقسام والصلاحيات", "Profils AR": "ملفات AR",
  "Profils GAR": "ملفات GAR", "Registre paramètres": "سجل المعلمات", "Matrice documentaire": "مصفوفة المستندات",
  "Types de CoC": "أنواع CoC", "Bacs à sable": "بيئات الاختبار", "Audit & transport": "التدقيق والنقل",
  "Audit IT": "تدقيق تقنية المعلومات", "Utilisateurs & rôles": "المستخدمون والأدوار", "Guide IAM": "دليل IAM",
  "SSO / Fédération": "SSO / الاتحاد",
};

// Dictionnaire AR complet (clés FR → AR) fusionné dans DICT.AR au chargement.
export const AR_PACK: Record<string, string> = { ...NAV_AR, ...EXT_AR, ...AMLGAP_FAMILLES_AR, ...AMLGAP_UI_AR };
