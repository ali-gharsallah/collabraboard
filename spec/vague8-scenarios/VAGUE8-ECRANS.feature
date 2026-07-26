# language: fr
Fonctionnalité: Vague 8 — Référentiel AML : scénarios & seuils (spec-first)
  Statut: Vague 8
  Écran: Référentiel AML — les 18 scénarios de surveillance (R189→R206) et leurs seuils effectifs
  Doctrine: projection LISIBLE du canon ratifié (A-69..A-86). Zéro invention.
  Les seuils sont pilotés par le registre R-Q (clés `aml*`) — le référentiel les relit à chaud.

  # ── Le catalogue des scénarios ──
  Scénario: V8-REFERENTIEL — les 18 scénarios se lisent, avec leurs seuils effectifs
    Étant donné le moteur de surveillance ratifié (R189→R206)
    Quand le Compliance Officer ouvre le référentiel AML
    Alors les 18 scénarios s'affichent (code, type, niveau, libellé)
    Et les seuils effectifs du tenant s'affichent (défaut du canon, surchargeables)

  # ── Les seuils sont gouvernés par le registre ──
  Scénario: V8-SEUIL — abaisser un seuil au registre se reflète dans le référentiel (R125→R127)
    Étant donné un seuil AML au registre R-Q (ex. structuring)
    Quand un CO change ce seuil (acte motivé, R126)
    Alors le référentiel AML affiche la NOUVELLE valeur effective
    Et le changement de règle passe par la gouvernance du paramétrage (jamais en dur)
