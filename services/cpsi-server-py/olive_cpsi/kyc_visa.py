# -*- coding: utf-8 -*-
"""R86 — Visa qualifié : verdict + message (extension du visa uniforme R15).

Apposer un visa ne se réduit pas à « signé / non signé » : le signataire rend un
verdict — OK (favorable), CONDITIONAL (sous condition) ou NOK (défavorable) — et
un message. Un verdict NOK ou CONDITIONAL EXIGE un message justificatif ; OK peut
rester sans message. Le visa demeure un objet uniforme, apposable/retirable par
son seul signataire, entièrement tracé (R48/R49). Un NOK est bloquant."""

VERDICTS = {"OK", "CONDITIONAL", "NOK"}


class VisaError(Exception):
    pass


class QualifiedVisa:
    def __init__(self):
        self.visas = {}   # cle (section/étape + rôle) -> visa
        self.log = []

    def apposer(self, cle, user, role, verdict, message, at):
        if verdict not in VERDICTS:
            raise VisaError("Verdict invalide : %r" % verdict)
        if verdict in ("NOK", "CONDITIONAL") and not (message and message.strip()):
            raise VisaError("Un visa %s exige un message justificatif (R86)" % verdict)
        v = {"by": user, "role": role, "verdict": verdict,
             "message": (message or "").strip(), "at": at.isoformat(), "valid": True}
        self.visas[cle] = v
        self.log.append(dict(at=at.isoformat(), action="visa", cle=cle,
                             user=user, verdict=verdict, message=v["message"]))
        return v

    def retirer(self, cle, user, at):
        v = self.visas.get(cle)
        if not v:
            raise VisaError("Aucun visa à retirer")
        if v["by"] != user:
            raise VisaError("Seul le signataire (%s) peut retirer son visa" % v["by"])
        del self.visas[cle]
        self.log.append(dict(at=at.isoformat(), action="retrait_visa", cle=cle, user=user))
        return None

    def verdict(self, cle):
        v = self.visas.get(cle)
        return v["verdict"] if v else None

    def bloquant(self, cle):
        return self.verdict(cle) == "NOK"
