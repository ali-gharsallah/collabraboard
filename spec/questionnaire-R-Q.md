# Questionnaire de paramétrage d'intégration (R-Q)

Prérequis contractuel : réponses validées et signées par la banque avant mise
en place. Chaque réponse alimente directement la configuration tenant du moteur
(`Engine(cfg)`) — aucune n'est du code.

10. Questionnaire de paramétrage d'intégration (R-Q)

En application de la méta-règle R-Q, les points de variabilité suivants
sont posés formellement à la banque lors de l'intégration d'O-Live.
Les réponses validées et signées par la banque constituent un prérequis
de mise en place de la solution et un élément de couverture
contractuelle.

  ------------- ----------------------------------------- ----------------------
  **Réf.**      **Question à poser à la banque**          **Domaine**

  **R4**        Qui sont les relais nommés de chaque      Visa / organisation
                validateur ? Quelle est la procédure de   
                dérogation et son rattachement aux fiches 
                de poste ?                                

  **R5**        Délais des rappels de visa et             Visa / SLA
                destinataires de l'escalade après le     
                deuxième rappel ?                         

  **R17**       Restrictions d'opérations en état        Dossier
                Suspendu (ex. entrées autorisées /        
                sorties gelées en cas de communication    
                MROS) ?                                   

  **R19**       Délais de rappel et de clôture            Dossier
                administrative des dossiers abandonnés ?  

  **R25**       Liste des documents optionnels vs         Matrice documentaire
                obligatoires par section, et délai        
                d'invalidation du visa conditionnel      
                (défaut : 30 jours) ?                     

  **R26/R29**   Contenu de la matrice documentaire par    Matrice documentaire
                structure juridique, personnes liées et   
                comptes ; calendrier des mises en vigueur 
                ?                                         

  **R31**       Le cumul de rôles dans un même dossier    Personnes
                est-il autorisé ? Si oui, dans quels cas, 
                avec quels flags (insider) ?              

  **R33**       Délai post-mandat avant dé-PEPisation, et Personnes / PEP
                qui décide (Central File, RM, Compliance) 
                ?                                         

  **R37**       Périmètre exact du Central File : quels   Organisation
                contrôles qualité, quels documents,       
                quelle corroboration ?                    

  **R39**       Politique SLA : délais formels par type   Tâches / SLA
                de tâche, destinataires des               
                notifications, mécanismes d'incitation ? 

  **R41**       Chaînes d'escalade et de déblocage       Organisation
                d'urgence : application manager,         
                managers de fonction, COO ; suppléances   
                prévues ?                                 

  **R42**       Fréquences du screening perpétuel         Screening
                (quotidien positions/transactions,        
                hebdomadaire PEP/sanctions, ou autres) ?  

  **R43**       Qui porte la LoD2 de confirmation des     Screening
                hits : MLRO ou autre rôle alloué ?        

  **R45**       Sévérité d'application sur hit sanctions Screening / sanctions
                confirmé : suspension immédiate par       
                défaut, modalités du distressed asset     
                offboarding ?                             

  **R47**       La journalisation des accès en lecture    Audit trail
                est-elle exigée ?                         
  ------------- ----------------------------------------- ----------------------

11. Statut du catalogue et contrat d'implémentation

Le catalogue couvre désormais l'intégralité du périmètre moteur : visa
4-yeux, cycle de vie du dossier, section et matrice documentaire,
personnes liées, tâches et rôles, screening AML, audit trail et
reporting. Les trois notes ouvertes de la version 1.0 (R14, R25, R29)
sont tranchées et intégrées au corps des règles.

*Ce document constitue le contrat d'implémentation du moteur O-Live :
chaque scénario correspond à un test d'acceptance automatisé à écrire
avant le code correspondant. Le moteur est réputé conforme lorsque 100 %
des scénarios passent en suite de tests. Toute nouvelle règle découverte
en exploitation est ajoutée au catalogue selon la même numérotation,
avec ses scénarios, avant implémentation.*

12. Paramètres tenant — porte CPSI (amendement R248-R252, 2026-07-27)

  ------------- ----------------------------------------- ----------------------
  **R251**      `cpsi_gate_timeout_ms` — timeout du        Porte CPSI
                sous-processus moteur (défaut 5000 ms).
                Dépassé ⇒ 503 typé CPSI_GATE_UNAVAILABLE
                (refus gracieux, jamais un 500 opaque).

  **R250**      `cpsi_replay_warn_ms` — seuil de durée     Porte CPSI
                d'hydratation (défaut 2000 ms). Dépassé ⇒
                notification tracée (CPSI_REPLAY_SLOW),
                JAMAIS un blocage (R39).

  **R248**      `cpsi_contract_version` supportées —       Porte CPSI
                versions d'enveloppe acceptées (défaut
                ["1"]). Version inconnue ⇒ erreur typée
                UNSUPPORTED_CONTRACT.
  ------------- ----------------------------------------- ----------------------

  Ces paramètres vivent sous `tenant.settings.cpsiConfig` (R68 : versionnés par
  date de mise en vigueur ; le rejeu à date utilise la config d'alors).

13. Paramètres tenant — bloc Offboarding (R267-R271, canon vague écrans pilote §5.4, 2026-07-27)

  ------------- ----------------------------------------- ----------------------
  **R267**      `retentionPostClotureAns` — durée de       Offboarding
                rétention post-clôture (défaut 10 ans,
                LBA art. 7). La purge de fin de rétention
                est un processus distinct (R170).

  **R268**      `visasParTypeCloture` — visas requis par   Offboarding
                type (défauts : EXIT_COMPLIANCE →
                [CO_SR, DIR] (Head PB → DIR, mapping
                ratifié), DECES_SUCCESSION → [CO],
                autres → [CO]).

  **R268**      `documentsParTypeCloture` — documents      Offboarding
                exigés par type (défauts : DEMANDE_CLIENT
                → INSTRUCTION_TRANSFERT_SIGNEE,
                DECES_SUCCESSION → ACTE_DECES).

  **R270**      `rolesMotifSensible` — rôles habilités au  Offboarding
                motif détaillé + réf MROS d'un
                EXIT_COMPLIANCE (défaut [CO_SR, MLRO] ;
                le canon cite SO — rôle non ratifié,
                écart consigné). Appliqué au contrôleur,
                à Olivia (R256) ET par policy SQL
                RESTRICTIVE (GUC app.role).

  **R271**      `exExitComplianceForceEdd` — un ex-        Offboarding
                EXIT_COMPLIANCE qui revient entre en
                workflow EDD imposé (défaut vrai).
  ------------- ----------------------------------------- ----------------------

  Ces paramètres vivent sous `tenant.settings` (R68) ; les valeurs appliquées à une
  clôture (visas, documents) sont figées dans le dossier au moment de l'acte.
