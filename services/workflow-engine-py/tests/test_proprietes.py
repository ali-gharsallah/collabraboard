"""Filet de propriétés — invariants globaux du moteur sous séquences ALÉATOIRES.
Mini-harness seedé (hors-ligne, même principe qu'hypothesis) : on génère des
séquences de commandes plausibles ET hostiles ; les OliveRuleError sont des
règles qui tirent (attendu) ; tout autre crash ou violation d'invariant = bug.

PR-01  I1  Jamais un visa ACCORDÉ signé par un préparateur de sa section (R13/R52).
PR-02  I2  Journal append-only : seq strictement croissant, préfixe immuable (R49).
PR-03  I3  Rejeu déterministe : etat_a_date rejoué deux fois ⇒ identique, et le
           nombre d'événements par dossier croît monotoniquement avec la date (R48).
PR-04  I4  Visa ACCORDÉ ⇒ aucune modification de données postérieure au grant.
PR-05  I5  R14 : tout visa final accordé est apparié à un engagement ;
           R7 : tout refus journalisé porte une motivation non vide.
"""
import random
from datetime import datetime, timedelta
from olive_engine.domain import Engine, FINAL_STEP, VisaState
from olive_engine.errors import OliveRuleError

T0 = datetime(2026, 7, 1, 9, 0)
SECTIONS = ["Identification", "Fiscalite", "SOF"]
ACTEURS = ["U1", "U2", "U3", "V1", "V2", "V3", "VF", "PO1"]
N_SEQUENCES, N_COMMANDES = 120, 30


def sequence_aleatoire(seed):
    """Exécute une séquence seedée ; retourne (engine, dossiers, horloge finale)."""
    rng = random.Random(seed)
    e = Engine()
    e.actifs |= set(ACTEURS)
    heure = [0]
    def at():
        heure[0] += 1
        return T0 + timedelta(hours=heure[0])
    dossiers = []
    d = e.creer_dossier(f"KYC-PR-{seed}", [(s, rng.choice(["V1", "V2", "V3"]))
                                           for s in SECTIONS], at())
    e.definir_validation_finale(d, rng.choice(["VF", "V3"]), at())
    dossiers.append(d)
    for _ in range(N_COMMANDES):
        cible = rng.choice(dossiers)
        sec = rng.choice(SECTIONS + [FINAL_STEP])
        acteur = rng.choice(ACTEURS)
        try:
            k = rng.randrange(10)
            if k == 0: e.modifier_donnee(cible, rng.choice(SECTIONS), acteur, "c", str(rng.random()), at())
            elif k == 1: e.soumettre_au_visa(cible, rng.choice(SECTIONS), acteur, at())
            elif k == 2: e.accorder_visa(cible, sec, acteur, at(), engagement=rng.random() < 0.5)
            elif k == 3: e.refuser_visa(cible, sec, acteur, at(),
                                        motivation=rng.choice(["", "pièce illisible", None, "hors profil"]))
            elif k == 4: e.tenter_revocation(cible, sec, acteur, at())
            elif k == 5: e.accorder_visa(cible, rng.choice(SECTIONS), acteur, at(),
                                         derogation={"decideur": "PO1", "fiche_de_poste": "FP-1"})
            elif k == 6: e.annuler_pour_vice(cible, sec, "vice", "PO1",
                                             cible.sections[FINAL_STEP].validateur, at())
            elif k == 7: e.absences.add(rng.choice(["V1", "V2", "V3"]))
            elif k == 8: e.relais[rng.choice(["V1", "V2"])] = rng.choice(["V3", "VF"])
            else: e.resoumettre(cible, rng.choice(SECTIONS), acteur, at())
        except OliveRuleError:
            pass                                    # une règle a tiré : attendu
    return e, dossiers, T0 + timedelta(hours=heure[0])


def _verifie_I1(e, dossiers):
    """I1 : signataire jamais préparateur de la section (ni du dossier pour la finale)."""
    for d in dossiers:
        for nom, s in d.sections.items():
            if s.visa and s.visa.etat == VisaState.ACCORDE:
                accs = [ev for ev in e.journal.of_type("visa_accorde")
                        if ev.payload.get("dossier") == d.id and ev.payload.get("section") == nom]
                assert accs, f"visa ACCORDÉ sans événement ({d.id}/{nom})"
                signataire = accs[-1].actor
                assert signataire not in s.preparateurs, \
                    f"I1 violé : {signataire} préparateur ET signataire de {nom}"
                if nom == FINAL_STEP:
                    contributeurs = set().union(*(x.preparateurs for x in d.sections.values()))
                    assert signataire not in contributeurs, \
                        f"I1/R52 violé : contributeur {signataire} a signé la finale"


def test_PR01_quatre_yeux_sous_sequences_aleatoires():
    for seed in range(N_SEQUENCES):
        e, dossiers, _ = sequence_aleatoire(seed)
        _verifie_I1(e, dossiers)


def test_PR02_journal_append_only_et_prefixe_immuable():
    for seed in range(0, N_SEQUENCES, 7):
        rng = random.Random(seed)
        e = Engine(); e.actifs |= set(ACTEURS)
        d = e.creer_dossier(f"KYC-J-{seed}", [("Identification", "V1")], T0)
        e.definir_validation_finale(d, "VF", T0)
        prefixe = None
        for i in range(N_COMMANDES):
            try:
                if rng.random() < 0.5:
                    e.modifier_donnee(d, "Identification", rng.choice(ACTEURS), "c", "v",
                                      T0 + timedelta(hours=i + 1))
                else:
                    e.soumettre_au_visa(d, "Identification", "U1", T0 + timedelta(hours=i + 1))
            except OliveRuleError:
                pass
            evs = e.journal.all()
            seqs = [ev.seq for ev in evs]
            assert seqs == sorted(seqs) and len(seqs) == len(set(seqs)), "seq non monotone"
            if prefixe is not None:
                assert evs[:len(prefixe)] == prefixe, "préfixe du journal modifié (R49)"
            prefixe = evs


def test_PR03_rejeu_a_date_deterministe_et_monotone():
    for seed in (1, 13, 42, 77, 101):
        e, dossiers, fin = sequence_aleatoire(seed)
        d = dossiers[0]
        a, b = e.etat_a_date(d.id, fin), e.etat_a_date(d.id, fin)
        assert a == b, "deux rejeux à la même date divergent (R48)"
        n_prec = -1
        for h in range(0, 40, 8):
            etat = e.etat_a_date(d.id, T0 + timedelta(hours=h))
            n = len(etat["evenements"])
            assert n >= n_prec, "le passé a changé : moins d'événements à date ultérieure"
            n_prec = n


def test_PR04_visa_accorde_implique_aucune_modification_posterieure():
    for seed in range(N_SEQUENCES):
        e, dossiers, _ = sequence_aleatoire(seed)
        for d in dossiers:
            for nom, s in d.sections.items():
                if s.visa and s.visa.etat == VisaState.ACCORDE:
                    seq_grant = max(ev.seq for ev in e.journal.of_type("visa_accorde")
                                    if ev.payload.get("dossier") == d.id
                                    and ev.payload.get("section") == nom)
                    modifs_apres = [ev for ev in e.journal.of_type("donnee_modifiee")
                                    if ev.payload.get("dossier") == d.id
                                    and ev.payload.get("section") == nom
                                    and ev.seq > seq_grant]
                    assert not modifs_apres, \
                        f"I4 violé : {nom} modifiée après visa (seq {seq_grant})"


def test_PR05_structure_du_journal_R14_R7():
    for seed in range(N_SEQUENCES):
        e, dossiers, _ = sequence_aleatoire(seed)
        engagements = {ev.seq for ev in e.journal.of_type("engagement_responsabilite_confirme")}
        for ev in e.journal.of_type("visa_accorde"):
            if ev.payload.get("section") == FINAL_STEP:
                assert any(abs(s - ev.seq) <= 1 for s in engagements), \
                    "R14 : visa final accordé sans engagement apparié"
        for ev in e.journal.of_type("visa_refuse"):
            m = ev.payload.get("motivation")
            assert m and str(m).strip(), "R7 : refus journalisé sans motivation"


def test_PR00_le_filet_mord_sur_moteur_sabote():
    """Méta-test : un moteur dont on retire le contrôle 4-yeux DOIT violer I1.
    Si ce test échoue, le filet est décoratif."""
    class EngineSabote(Engine):
        def accorder_visa(self, dossier, section_nom, acteur, at, **kw):
            s = dossier.sections[section_nom]
            sauvegarde = set(s.preparateurs)
            s.preparateurs.clear()                      # neutralise R13
            try:
                return super().accorder_visa(dossier, section_nom, acteur, at, **kw)
            finally:
                s.preparateurs |= sauvegarde
    e = EngineSabote(); e.actifs |= set(ACTEURS)
    d = e.creer_dossier("KYC-SAB", [("Identification", "V1")], T0)
    e.definir_validation_finale(d, "VF", T0)
    e.modifier_donnee(d, "Identification", "V1", "c", "v", T0 + timedelta(hours=1))
    e.soumettre_au_visa(d, "Identification", "V1", T0 + timedelta(hours=1))
    e.accorder_visa(d, "Identification", "V1", T0 + timedelta(hours=2))  # passe (saboté)
    import pytest as _pt
    with _pt.raises(AssertionError):
        _verifie_I1(e, [d])                             # le filet doit mordre
