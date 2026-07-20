# -*- coding: utf-8 -*-
"""R84 — Édition exclusive du dossier KYC (« la main » / checkout).

Un dossier KYC en édition est détenu par UN SEUL intervenant à la fois — comme un
dossier physique entre les mains de quelqu'un. Les autres ne peuvent le consulter
que s'il est libéré (release). Sinon, ils demandent la main (requête tracée) ; le
détenteur peut libérer ou passer la main. Tout est journalisé (R48/R49)."""


class KycLockError(Exception):
    pass


class KycLock:
    def __init__(self):
        self.holders = {}    # kyc_id -> détenteur (str) ; None/absent = libéré (release)
        self.requests = {}   # kyc_id -> [demandeurs de la main]
        self.log = []

    def _t(self, at, action, **kw):
        self.log.append(dict(at=at.isoformat(), action=action, **kw))

    # ── état ──
    def detenteur(self, kyc_id):
        return self.holders.get(kyc_id)

    def est_libere(self, kyc_id):
        return self.holders.get(kyc_id) is None

    def peut_consulter(self, kyc_id, user):
        h = self.holders.get(kyc_id)
        return h is None or h == user

    def demandeurs(self, kyc_id):
        return list(self.requests.get(kyc_id, []))

    # ── actions ──
    def prendre_la_main(self, kyc_id, user, at):
        h = self.holders.get(kyc_id)
        if h is not None and h != user:
            raise KycLockError("Dossier détenu par %s — demandez la main" % h)
        self.holders[kyc_id] = user
        self.requests[kyc_id] = [u for u in self.requests.get(kyc_id, []) if u != user]
        self._t(at, "prise_de_main", kyc=kyc_id, user=user)
        return user

    def liberer(self, kyc_id, user, at):
        h = self.holders.get(kyc_id)
        if h != user:
            raise KycLockError("Seul le détenteur (%s) peut libérer" % h)
        self.holders[kyc_id] = None
        self._t(at, "liberation", kyc=kyc_id, user=user)
        return None

    def demander_la_main(self, kyc_id, user, at):
        h = self.holders.get(kyc_id)
        if h is None:
            raise KycLockError("Dossier libre — prenez la main directement")
        if h == user:
            raise KycLockError("Vous détenez déjà le dossier")
        reqs = self.requests.setdefault(kyc_id, [])
        if user not in reqs:
            reqs.append(user)
        self._t(at, "demande_de_main", kyc=kyc_id, user=user, detenteur=h)
        return {"detenteur": h, "demandeurs": list(reqs)}

    def passer_la_main(self, kyc_id, de, a, at):
        h = self.holders.get(kyc_id)
        if h != de:
            raise KycLockError("Seul le détenteur (%s) peut passer la main" % h)
        self.holders[kyc_id] = a
        self.requests[kyc_id] = [u for u in self.requests.get(kyc_id, []) if u != a]
        self._t(at, "passage_de_main", kyc=kyc_id, de=de, a=a)
        return a
