# -*- coding: utf-8 -*-
"""CPSI bloc 16 — R84 : édition exclusive du dossier KYC (la main / checkout). CK-01..05."""
import pytest
from datetime import datetime, timedelta
from olive_cpsi.kyc_lock import KycLock, KycLockError

T0 = datetime(2026, 1, 1)
def t(d=0): return T0 + timedelta(days=d)

@pytest.fixture
def lock():
    return KycLock()

# CK-01 : prendre la main d'un dossier libre → détenu, plus consultable par les autres
def test_CK01_prise_de_main(lock):
    lock.prendre_la_main("KYC-1", "ARM_Alice", t(1))
    assert lock.detenteur("KYC-1") == "ARM_Alice" and not lock.est_libere("KYC-1")
    assert lock.peut_consulter("KYC-1", "ARM_Alice") is True
    assert lock.peut_consulter("KYC-1", "RM_Bob") is False

# CK-02 : un autre ne peut pas prendre directement ; il demande la main (tracé)
def test_CK02_demande_de_main(lock):
    lock.prendre_la_main("KYC-1", "ARM_Alice", t(1))
    with pytest.raises(KycLockError):
        lock.prendre_la_main("KYC-1", "RM_Bob", t(2))
    r = lock.demander_la_main("KYC-1", "RM_Bob", t(2))
    assert r["detenteur"] == "ARM_Alice" and "RM_Bob" in r["demandeurs"]
    assert any(e["action"] == "demande_de_main" for e in lock.log)

# CK-03 : libération → redevient consultable ; le demandeur peut alors prendre la main
def test_CK03_liberation(lock):
    lock.prendre_la_main("KYC-1", "ARM_Alice", t(1))
    lock.demander_la_main("KYC-1", "RM_Bob", t(2))
    lock.liberer("KYC-1", "ARM_Alice", t(3))
    assert lock.est_libere("KYC-1") and lock.peut_consulter("KYC-1", "RM_Bob")
    lock.prendre_la_main("KYC-1", "RM_Bob", t(4))
    assert lock.detenteur("KYC-1") == "RM_Bob"

# CK-04 : le détenteur passe la main à un demandeur → transfert exclusif
def test_CK04_passage_de_main(lock):
    lock.prendre_la_main("KYC-1", "ARM_Alice", t(1))
    lock.demander_la_main("KYC-1", "RM_Bob", t(2))
    lock.passer_la_main("KYC-1", "ARM_Alice", "RM_Bob", t(3))
    assert lock.detenteur("KYC-1") == "RM_Bob" and "RM_Bob" not in lock.demandeurs("KYC-1")
    # une seule personne à la fois : Alice ne détient plus
    assert lock.peut_consulter("KYC-1", "ARM_Alice") is False

# CK-05 : garde-fous — non-détenteur ne libère pas ; demander un dossier libre échoue
def test_CK05_gardefous(lock):
    with pytest.raises(KycLockError):
        lock.demander_la_main("KYC-1", "RM_Bob", t(1))    # libre
    lock.prendre_la_main("KYC-1", "ARM_Alice", t(2))
    with pytest.raises(KycLockError):
        lock.liberer("KYC-1", "RM_Bob", t(3))             # pas le détenteur
    with pytest.raises(KycLockError):
        lock.demander_la_main("KYC-1", "ARM_Alice", t(3)) # détenteur lui-même
