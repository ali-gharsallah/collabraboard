# -*- coding: utf-8 -*-
"""R85 — Passage de main entre validateurs, section par section.

Le validateur d'une section passe la main à l'étape suivante (« next_step ») ou
rend la main à l'étape précédente (« revenir »). MESSAGE OBLIGATOIRE à chaque
passage — il est adressé à l'intervenant concerné (prédécesseur/successeur) et
consigné. Jusqu'à la section de validation : valider ou rejeter. Tout est tracé
(R48/R49). Rien ne change d'état sans événement tracé (invariant moteur)."""


class HandoffError(Exception):
    pass


class KycHandoff:
    def __init__(self, phases):
        if not phases:
            raise HandoffError("Au moins une phase requise")
        self.phases = list(phases)   # ex: ["ARM","RM","BRM","Compliance","Validation"]
        self.idx = 0
        self.status = "en_cours"     # en_cours | valide | rejete
        self.log = []

    def _t(self, at, action, user, message, **kw):
        self.log.append(dict(at=at.isoformat(), action=action,
                             phase=self.phases[self.idx], user=user, message=message, **kw))

    def phase_courante(self):
        return self.phases[self.idx]

    def est_derniere(self):
        return self.idx >= len(self.phases) - 1

    def _exige_message(self, message, quoi):
        if not message or not message.strip():
            raise HandoffError("Message obligatoire %s (R85)" % quoi)

    def next_step(self, user, message, at):
        if self.status != "en_cours":
            raise HandoffError("Dossier terminé (%s)" % self.status)
        self._exige_message(message, "au passage de main")
        if self.est_derniere():
            raise HandoffError("Dernière étape — utilisez valider() ou rejeter()")
        de = self.phases[self.idx]
        self.idx += 1
        self._t(at, "next_step", user, message.strip(), de=de, a=self.phases[self.idx])
        return self.phases[self.idx]

    def revenir(self, user, message, at):
        if self.status != "en_cours":
            raise HandoffError("Dossier terminé (%s)" % self.status)
        self._exige_message(message, "au renvoi")
        if self.idx == 0:
            raise HandoffError("Déjà à la première étape")
        de = self.phases[self.idx]
        self.idx -= 1
        self._t(at, "revenir", user, message.strip(), de=de, a=self.phases[self.idx])
        return self.phases[self.idx]

    def valider(self, user, message, at):
        if self.status != "en_cours":
            raise HandoffError("Dossier terminé (%s)" % self.status)
        if not self.est_derniere():
            raise HandoffError("La validation n'est possible qu'à la section de validation")
        self._exige_message(message, "à la validation")
        self.status = "valide"
        self._t(at, "validation", user, message.strip())
        return self.status

    def rejeter(self, user, message, at):
        if self.status != "en_cours":
            raise HandoffError("Dossier terminé (%s)" % self.status)
        self._exige_message(message, "au rejet")   # motif obligatoire (R7)
        self.status = "rejete"
        self._t(at, "rejet", user, message.strip())
        return self.status
