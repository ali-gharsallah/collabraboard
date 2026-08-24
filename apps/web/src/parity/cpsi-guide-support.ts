// Source : docs/reference/olive-demo.html 18774–18804 — données du guide CPSI (extraction verbatim).
// Profilage continu : le fil conducteur pédagogique (7 étapes, scénario de démo, pièges & réponses).

export const CPSI_ETAPES = [
{ n: "1", t: "Population & attributs", d: "Chaque client est projeté avec ses attributs calculés : risque pays, risque structure, risque activité, statut PEP, ancienneté, intensité cash, ratio de mouvements… Ce sont des faits dérivés, pas des saisies.",
ou: "Paramétrage → Référentiel : les pondérations pays / structure / activité alimentent ces attributs." },
{ n: "2", t: "Groupes (populations)", d: "Les clients sont regroupés par prédicats métier (type d'entité, segment, juridiction, comportement). Un client appartient à plusieurs groupes ; la priorité arbitre.",
ou: "Bac à sable AML : la colonne « Population » montre la taille réelle de chaque groupe." },
{ n: "3", t: "Scénarios & seuils par groupe", d: "Un scénario compare un attribut à un seuil — mais le seuil est défini PAR GROUPE. Une société de domicile offshore n'a pas le même seuil qu'une personne physique suisse. C'est le cœur de la proportionnalité.",
ou: "Bac à sable AML → sélectionner un scénario : un seuil par groupe, éditable." },
{ n: "4", t: "Franchissement", d: "Quand un client dépasse le seuil de son groupe, c'est un franchissement : un ÉVÉNEMENT horodaté, pas une alerte. Le même client peut franchir plusieurs scénarios.",
ou: "Le franchissement est la matière brute — jamais montrée telle quelle à l'analyste." },
{ n: "5", t: "Signal (déduplication)", d: "Les franchissements liés au même motif sont dédupliqués en un signal. C'est ce qui évite d'inonder l'analyste avec dix lignes pour un seul comportement.",
ou: "AML Monitoring : les signaux, pas les franchissements." },
{ n: "6", t: "Score & bandes", d: "Le score combine les attributs statiques (poids configurables) et les signaux, ces derniers s'estompant avec une demi-vie : un signal d'il y a six mois pèse moins qu'hier. Les bandes LOW / MEDIUM / HIGH sont paramétrables.",
ou: "Paramétrage → CPSI — Règles de calcul : poids, demi-vie, bandes." },
{ n: "7", t: "Proposition, pas décision", d: "Le franchissement d'une bande génère une PROPOSITION (revoir le KYC, passer en EDD, ouvrir un case) — jamais une action automatique. L'humain décide, la machine trace (R44, R39 : mesurer sans coercer).",
ou: "Écran CPSI : file des propositions, chacune acceptée ou refusée avec motif (R7)." },
];
export const CPSI_PIEGES = [
["Le zéro silencieux", "Une activité sans pondération vaut 0 par défaut : elle devient invisible au score. Le Référentiel signale désormais les activités non scorées — un score implicite n'est pas un choix, c'est un oubli."],
["Le seuil global", "Un seuil unique pour toute la banque produit soit du bruit sur les petits clients, soit de l'aveuglement sur les gros. D'où les seuils par groupe."],
["Le paramétrage à l'aveugle", "Changer un seuil sans voir l'impact, c'est piloter sans instruments. Le bac à sable montre exactement quelles alertes apparaissent et disparaissent, nommément, avant d'écrire quoi que ce soit."],
["La rétroactivité", "Un seuil modifié aujourd'hui ne doit pas réécrire l'histoire : date de mise en vigueur et grandfathering (R29). Un dossier de 2024 se relit avec les règles de 2024 (R48/R49)."],
];
export const CPSI_DEMO = [
{ t: "1. Le problème (45 s)", d: "« La revue périodique tous les 3 ans, c'est regarder le client une fois et espérer. Le profilage continu, c'est le regarder tous les jours sans noyer l'analyste. »" },
{ t: "2. La chaîne (1 min)", d: "Dérouler les 7 étapes : population → groupes → scénarios/seuils → franchissement → signal dédupliqué → score → proposition. Insister : franchissement ≠ alerte." },
{ t: "3. La proportionnalité (1 min)", d: "Bac à sable AML : montrer qu'un même scénario a un seuil différent par groupe. C'est ce que FINMA attend d'une approche fondée sur les risques." },
{ t: "4. L'impact avant l'écriture (2 min)", d: "Baisser un seuil dans le bac à sable : les nouvelles alertes apparaissent NOMMÉMENT, avec valeur vs seuil. Puis « Appliquer » avec date de mise en vigueur. Message : aucun paramétrage à l'aveugle." },
{ t: "5. Le temps qui passe (45 s)", d: "CPSI — Règles de calcul : la demi-vie. Un signal ancien pèse moins. C'est ce qui empêche un score de rester rouge à vie après un incident isolé." },
{ t: "6. La décision reste humaine (1 min)", d: "Les propositions CPSI s'acceptent ou se refusent avec motif. Rien ne bascule tout seul : R39 (mesurer sans coercer) et R44 (l'IA analyse, l'humain décide)." },
{ t: "7. La preuve (45 s)", d: "Audit : chaque changement de seuil, chaque proposition, chaque décision est journalisée et rejouable à date. C'est ce que l'inspecteur regarde." },
];
