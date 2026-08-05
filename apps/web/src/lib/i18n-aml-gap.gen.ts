// GÉNÉRÉ par tools/aml-gap/gen_aml_gap.py depuis data/i18n-aml-gap.json — NE PAS ÉDITER À LA MAIN.
// PÉRIMÈTRE FRONT = CHROME uniquement (familles + libellés UI). Le CONTENU des règles (nom/desc
// des 64 scénarios) N'EST PAS bundlé (SPEC-I18N §3 : « le front ne traduit pas le contenu métier,
// il l'affiche ») — il est servi par l'API (AmlScenario.i18n versionné, R29).
//
// LANGUES : FR (= clé, repli) + EN/DE/IT (terminologie PO, glossaire GLOSSAIRE-AML-4L.md
// CONTRAIGNANT) + AR (5e langue « Both », E-FB-4). L'AR du chrome est une PASSE MACHINE (MSA,
// SPEC-I18N §2) en attente de relecture pro avant BAT — fusion autorisée PO (skip review).
// Toute clé/langue absente retombe proprement sur le FR (i18n.ts, « jamais un trou »).

export type AmlGapLang = 'EN' | 'DE' | 'IT' | 'AR';
export const AMLGAP_FAMILLES: Record<AmlGapLang, Record<string, string>> = {
 "EN": {
  "Screening en flux": "In-flow screening",
  "Indices OBA-FINMA": "AMLO-FINMA indicators",
  "Vision groupe UBO": "UBO group view",
  "Instruments PB": "Private banking instruments",
  "Crypto / VASP": "Crypto / VASP",
  "CFT": "Counter-terrorist financing (CFT)",
  "Gouvernance du dispositif": "Programme governance",
  "TBML": "Trade-based money laundering (TBML)",
  "Correspondent Banking": "Correspondent banking",
  "Prolifération": "Proliferation financing",
  "Immobilier & Art": "Real estate & art",
  "Analytique 2G": "2nd-generation analytics"
 },
 "DE": {
  "Screening en flux": "Transaktionsbegleitendes Screening",
  "Indices OBA-FINMA": "GwV-FINMA-Anhaltspunkte",
  "Vision groupe UBO": "Gruppensicht wirtschaftlich Berechtigte",
  "Instruments PB": "Private-Banking-Instrumente",
  "Crypto / VASP": "Krypto / VASP",
  "CFT": "Bekämpfung der Terrorismusfinanzierung",
  "Gouvernance du dispositif": "Governance des Dispositivs",
  "TBML": "Handelsbasierte Geldwäscherei (TBML)",
  "Correspondent Banking": "Korrespondenzbankgeschäft",
  "Prolifération": "Proliferationsfinanzierung",
  "Immobilier & Art": "Immobilien & Kunst",
  "Analytique 2G": "Analytik der 2. Generation"
 },
 "IT": {
  "Screening en flux": "Screening nei flussi",
  "Indices OBA-FINMA": "Indizi ORD-FINMA",
  "Vision groupe UBO": "Vista di gruppo ADE",
  "Instruments PB": "Strumenti di private banking",
  "Crypto / VASP": "Crypto / VASP",
  "CFT": "Contrasto al finanziamento del terrorismo (CFT)",
  "Gouvernance du dispositif": "Governance del dispositivo",
  "TBML": "Riciclaggio basato sul commercio (TBML)",
  "Correspondent Banking": "Attività di banca corrispondente",
  "Prolifération": "Finanziamento della proliferazione",
  "Immobilier & Art": "Immobili & arte",
  "Analytique 2G": "Analitica di seconda generazione"
 },
 "AR": {
  "Screening en flux": "الفرز أثناء التدفّق",
  "Indices OBA-FINMA": "مؤشّرات OBA-FINMA",
  "Vision groupe UBO": "رؤية مجموعة المستفيدين الحقيقيين",
  "Instruments PB": "أدوات الخدمات المصرفية الخاصة",
  "Crypto / VASP": "العملات المشفّرة / VASP",
  "CFT": "مكافحة تمويل الإرهاب (CFT)",
  "Gouvernance du dispositif": "حوكمة النظام",
  "TBML": "غسل الأموال القائم على التجارة (TBML)",
  "Correspondent Banking": "الصيرفة المراسِلة",
  "Prolifération": "تمويل الانتشار",
  "Immobilier & Art": "العقارات والفنون",
  "Analytique 2G": "تحليلات الجيل الثاني"
 }
};

export const AMLGAP_UI: Record<AmlGapLang, Record<string, string>> = {
 "EN": {
  "Filtres": "Filters",
  "Réinitialiser": "Reset",
  "résultat(s)": "result(s)",
  "Thème bancaire": "Banking theme",
  "Seuil": "Threshold",
  "Comment c'est calculé": "How it is computed",
  "Situation de départ": "Given (starting situation)",
  "Ce que le moteur observe": "What the engine observes",
  "Ce qui se passe": "What happens",
  "Cas plantés — dataset GT": "Planted cases — GT dataset",
  "Simuler ce scénario": "Simulate this scenario",
  "BLOQUE": "BLOCKS",
  "Vraie alerte (TP)": "True positive (TP)",
  "Fausse alerte (FP)": "False positive (FP)",
  "Revues en retard": "Overdue reviews",
  "Statut alerte": "Alert status",
  "Déclencheur": "Trigger",
  "paramètre tenant (registre R-Q)": "tenant parameter (R-Q register)"
 },
 "DE": {
  "Filtres": "Filter",
  "Réinitialiser": "Zurücksetzen",
  "résultat(s)": "Ergebnis(se)",
  "Thème bancaire": "Bankfachliches Thema",
  "Seuil": "Schwellenwert",
  "Comment c'est calculé": "Berechnungslogik",
  "Situation de départ": "Ausgangslage",
  "Ce que le moteur observe": "Was die Engine beobachtet",
  "Ce qui se passe": "Was geschieht",
  "Cas plantés — dataset GT": "Hinterlegte Fälle — GT-Datensatz",
  "Simuler ce scénario": "Szenario simulieren",
  "BLOQUE": "BLOCKIERT",
  "Vraie alerte (TP)": "Echter Treffer (TP)",
  "Fausse alerte (FP)": "Fehlalarm (FP)",
  "Revues en retard": "Überfällige Überprüfungen",
  "Statut alerte": "Alert-Status",
  "Déclencheur": "Auslöser",
  "paramètre tenant (registre R-Q)": "mandantenspezifischer Parameter (R-Q-Register)"
 },
 "IT": {
  "Filtres": "Filtri",
  "Réinitialiser": "Reimposta",
  "résultat(s)": "risultato/i",
  "Thème bancaire": "Tema bancario",
  "Seuil": "Soglia",
  "Comment c'est calculé": "Come viene calcolato",
  "Situation de départ": "Situazione di partenza",
  "Ce que le moteur observe": "Cosa osserva il motore",
  "Ce qui se passe": "Cosa succede",
  "Cas plantés — dataset GT": "Casi predisposti — dataset GT",
  "Simuler ce scénario": "Simula questo scenario",
  "BLOQUE": "BLOCCA",
  "Vraie alerte (TP)": "Vero positivo (TP)",
  "Fausse alerte (FP)": "Falso positivo (FP)",
  "Revues en retard": "Revisioni in ritardo",
  "Statut alerte": "Stato allerta",
  "Déclencheur": "Fattore scatenante",
  "paramètre tenant (registre R-Q)": "parametro tenant (registro R-Q)"
 },
 "AR": {
  "Filtres": "عوامل التصفية",
  "Réinitialiser": "إعادة التعيين",
  "résultat(s)": "نتيجة/نتائج",
  "Thème bancaire": "الموضوع المصرفي",
  "Seuil": "العتبة",
  "Comment c'est calculé": "كيفية الاحتساب",
  "Situation de départ": "الوضع الابتدائي",
  "Ce que le moteur observe": "ما يرصده المحرّك",
  "Ce qui se passe": "ما يحدث",
  "Cas plantés — dataset GT": "الحالات المزروعة — مجموعة بيانات GT",
  "Simuler ce scénario": "محاكاة هذا السيناريو",
  "BLOQUE": "يحظر",
  "Vraie alerte (TP)": "تنبيه صحيح (TP)",
  "Fausse alerte (FP)": "تنبيه كاذب (FP)",
  "Revues en retard": "المراجعات المتأخّرة",
  "Statut alerte": "حالة التنبيه",
  "Déclencheur": "المُطلِق",
  "paramètre tenant (registre R-Q)": "معلمة المستأجر (سجل R-Q)"
 }
};
