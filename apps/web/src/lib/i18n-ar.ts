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
  "Transferts & ordres": "التحويلات والأوامر", "Registre LBA": "سجل مكافحة غسل الأموال", "Checklist exigences": "قائمة المتطلبات",
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
  "Rapports conformité": "تقارير الامتثال", "Pré-revue IA": "المراجعة المسبقة بالذكاء الاصطناعي",
  "Gouvernance O": "حوكمة O", "Capacité équipe": "قدرة الفريق", "Surveillance ES": "مراقبة ES",
  "Audit IT": "تدقيق تقنية المعلومات", "Utilisateurs & rôles": "المستخدمون والأدوار", "Guide IAM": "دليل IAM",
  "SSO / Fédération": "SSO / الاتحاد",
};

// Contenus d'ÉCRANS (48 chaînes — `ECRANS` côté i18n.ts : login, BI, OpRisk, Mobile Banking).
// Passe MACHINE MSA (SPEC-I18N §2). Réf. règles/produits conservées (R318, R276, GED, CoC, RM).
const ECRANS_AR: Record<string, string> = {
 "Session expirée — reconnectez-vous (votre brouillon en cours est conservé).": "انتهت الجلسة — أعد الاتصال (تُحفَظ مسودتك الحالية).",
 "e-mail": "البريد الإلكتروني",
 "mot de passe": "كلمة المرور",
 "Se reconnecter": "إعادة الاتصال",
 "Connexion impossible — vérifiez le réseau.": "تعذّر الاتصال — تحقّق من الشبكة.",
 "BI — Reporting sur mesure (projections déclarées seulement — zéro SQL libre)": "ذكاء الأعمال — تقارير مخصّصة (إسقاطات معلنة فقط — لا SQL حر)",
 "Charger l'annuaire": "تحميل الدليل",
 "Interroger": "استعلام",
 "ligne(s) source (scopées BACKEND) · sensibilité": "سطر/أسطر المصدر (بنطاق الخادم) · الحساسية",
 "Chargement de l'écran…": "جارٍ تحميل الشاشة…",
 "Octopulse OpRisk — incidents opérationnels (dossiers tracés, taxonomie Bâle du tenant)": "Octopulse OpRisk — الحوادث التشغيلية (ملفات متتبَّعة، تصنيف بازل الخاص بالمستأجر)",
 "Charger": "تحميل",
 "titre de l'incident": "عنوان الحادث",
 "catégorie Bâle": "فئة بازل",
 "Déclarer": "الإبلاغ",
 "Heatmap (CALCULÉE serveur — fréquence × sévérité, rejouable à date ; aucune cellule ne se saisit)": "خريطة حرارية (محسوبة على الخادم — التكرار × الخطورة، قابلة لإعادة التشغيل بتاريخ ؛ لا تُدخَل أي خلية)",
 "catégorie": "الفئة",
 "fréquence": "التكرار",
 "sévérité max": "أقصى خطورة",
 "score": "النتيجة",
 "Incidents": "الحوادث",
 "sévérité": "الخطورة",
 "Analyser": "تحليل",
 "Clore (motivé)": "إغلاق (مع تعليل)",
 "Plan d'action (le retard est un fait calculé — notifié, jamais bloquant)": "خطة العمل (التأخّر واقعة محسوبة — يُخطَر بها، دون أن تحجب أبدًا)",
 "EN RETARD": "متأخّر",
 "document": "مستند",
 "compte": "حساب",
 "Mobile Banking — face banque (population cliente DISTINCTE, jamais un rôle interne)": "الخدمات المصرفية عبر الهاتف — جانب البنك (فئة عملاء منفصلة، وليست دورًا داخليًا أبدًا)",
 "v1 = lecture + messagerie côté client. Le client ne voit QUE le partagé (rien par défaut) ; aucune donnée compliance ne sort — contrôle SERVEUR, l'app est un rendu.": "الإصدار 1 = قراءة + مراسلة على جانب العميل. لا يرى العميل إلا ما تمّت مشاركته (لا شيء افتراضيًا) ؛ لا تخرج أي بيانات امتثال — التحكّم على الخادم، والتطبيق مجرّد عرض.",
 "Activer le canal (RM)": "تفعيل القناة (RM)",
 "Messagerie": "المراسلة",
 "Identité": "الهوية",
 "code hors bande": "رمز خارج القناة",
 "remis UNE fois, à transmettre HORS canal (l'événement ne le porte jamais).": "يُسلَّم مرّة واحدة، ويُنقَل خارج القناة (لا يحمله الحدث أبدًا).",
 "documentId (GED)": "معرّف المستند (إدارة الوثائق)",
 "référence du compte": "مرجع الحساب",
 "Marqué « partagé client » — acte tracé.": "معلَّم «مُشارَك مع العميل» — إجراء متتبَّع.",
 "Marquer partagé": "وضع علامة مُشارَك",
 "rien n'est partagé par défaut (R318)": "لا شيء يُشارَك افتراضيًا (R318)",
 "Fil du client": "سلسلة العميل",
 "Aucun message.": "لا رسائل.",
 "CoC ouvert": "CoC مفتوح",
 "la demande suit la voie R276, jamais un second circuit.": "يتّبع الطلب مسار R276، وليس دائرة ثانية أبدًا.",
 "Ouvrir un CoC": "فتح CoC",
 "répondre au client": "الرد على العميل",
 "Réponse envoyée.": "تمّ إرسال الرد.",
 "Envoyer": "إرسال"
};

// Dictionnaire AR complet (clés FR → AR) fusionné dans DICT.AR au chargement.
export const AR_PACK: Record<string, string> = { ...NAV_AR, ...EXT_AR, ...ECRANS_AR, ...AMLGAP_FAMILLES_AR, ...AMLGAP_UI_AR };
