// Source : docs/reference/olive-demo.html 40326-40354 — données guide IAM (briques, scénario démo, objections). Verbatim.

export const IAM_BRIQUES: any[] = [
{ icon: "🔑", titre: "Authentification vérifiée", quoi: "Mot de passe haché (scrypt, jamais en clair), compte désactivable, message unique en cas d'échec (aucune fuite sur l'existence d'un compte).",
demo: "Écran de connexion — un compte désactivé est refusé.", preuve: "6 tests (AU-01..06)" },
{ icon: "🔐", titre: "MFA — double facteur (TOTP)", quoi: "Code à 6 chiffres compatible Google Authenticator / Authy (standard RFC 6238). Enrôlement en deux temps : le compte n'est protégé qu'après un premier code valide.",
demo: "Administration → Utilisateurs & rôles : colonne MFA, bouton « Réinit. MFA » (perte de téléphone).", preuve: "4 tests dont les vecteurs officiels RFC 6238" },
{ icon: "🛡", titre: "RBAC — le rôle décide", quoi: "Le rôle est porté par le jeton et vient EXCLUSIVEMENT du compte en base : aucun appel client ne peut se déclarer ADMIN. Chaque endpoint sensible déclare les rôles admis.",
demo: "Se connecter avec un RM puis un CO Senior : la validation finale n'est offerte qu'au second.", preuve: "4 tests (RG-01..04)" },
{ icon: "🔗", titre: "SSO — fédération d'identité", quoi: "La banque garde son annuaire (Entra ID, Keycloak, Ping…). O-Live valide le jeton de l'IdP, traduit les groupes en rôles O-Live et crée le compte à la volée. L'IdP reste la source de vérité.",
demo: "Paramétrage → SSO — Fédération d'identité : issuer, audience, mapping groupes → rôles.", preuve: "6 tests (OI-01..06)" },
{ icon: "♻", titre: "Rotation des clés (JWKS)", quoi: "Les clés de signature tournent sans invalider les sessions en cours (période de grâce), et les clés publiques sont exposées au standard JWKS.",
demo: "Argument d'exploitation : rotation sans coupure de service.", preuve: "12 tests (rotation + vérification par kid)" },
{ icon: "👥", titre: "Administration des comptes", quoi: "Création, activation/désactivation, changement de rôle, réinitialisation MFA — réservé aux administrateurs, et chaque action est journalisée.",
demo: "Administration → Utilisateurs & rôles, puis Audit → Audit paramètres pour la trace.", preuve: "6 tests (AD-01..06)" },
];
export const IAM_DEMO_STEPS: any[] = [
{ t: "1. Poser le cadre (30 s)", d: "« La sécurité d'accès est le socle : sans elle, aucune preuve d'audit ne tient. » Montrer le sélecteur de profils : 20 utilisateurs, 9 rôles métier suisses (RM, ARM, CO, CO Senior, MLRO, Central File, BRM, Direction, Admin)." },
{ t: "2. Le rôle décide (1 min)", d: "Se connecter en RM → la validation finale du KYC n'est pas proposée. Reprendre en CO Senior → elle apparaît. Message : le rôle vient du compte, pas de l'écran." },
{ t: "3. Four-eyes (1 min)", d: "Sur un KYC, montrer qu'un contributeur d'une section ne peut pas viser cette section (R13), et qu'un contributeur du dossier ne peut pas prononcer la validation finale (R52). C'est du contrôle serveur, pas du grisage d'écran." },
{ t: "4. MFA (1 min)", d: "Administration → Utilisateurs & rôles : colonne MFA (Activée / À enrôler). Cliquer « Réinit. MFA » sur un compte : le collaborateur devra ré-enrôler son authenticator. Cas réel : téléphone perdu." },
{ t: "5. Désactivation immédiate (45 s)", d: "Cliquer « Désactiver » sur un compte : l'accès est coupé sans supprimer l'historique (l'audit reste attribuable). Cas réel : départ d'un collaborateur." },
{ t: "6. La trace (1 min)", d: "Audit → Audit paramètres : les deux actions viennent de s'inscrire au journal. Message clé : rien ne change d'état sans événement tracé." },
{ t: "7. « Et notre annuaire ? » (1 min)", d: "Paramétrage → SSO : issuer, audience, mapping groupes → rôles. La banque garde son IdP et ses règles ; O-Live ne redemande pas de mot de passe. Le mapping est un paramètre de la banque (questionnaire R-Q)." },
];
export const IAM_OBJECTIONS: [string, string][] = [
["« Nous avons déjà Entra ID / Keycloak »", "Parfait : O-Live se branche dessus (OIDC). Vos groupes deviennent des rôles O-Live, le compte est créé à la première connexion, et si vous retirez un groupe le rôle suit automatiquement."],
["« Nos données doivent rester en Suisse »", "Hébergement Exoscale Zurich, isolation par tenant au niveau base (RLS), audit inaltérable chaîné par empreinte."],
["« Comment prouvez-vous que c'est sûr ? »", "Chaque brique a ses tests exécutables (47 pour l'IAM) et le TOTP est validé contre les vecteurs officiels de la RFC. La revue FINMA regarde la preuve, pas la promesse."],
["« Qui peut débloquer un compte ? »", "Seul un administrateur, et l'action est journalisée avec auteur et horodatage — donc opposable."],
];
