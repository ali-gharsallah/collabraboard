# -*- coding: utf-8 -*-
"""
CPSI bloc 20 — Analytique 2G AML gap (R399–R403, AN-01..05).

Détecteurs statistiques exécutés DANS CPSI Python — jamais réécrits en Nest (décision 4 du journal
2026-08-04 ; le moteur Nest les refuse via meta.deferred). Contrairement au corpus GT (où TP ET FP
DÉCLENCHENT), un détecteur statistique DOIT DISCRIMINER : on teste le cas déviant (déclenche) ET le
cas normal (ne déclenche pas). Chaque signal est explicable (R44) et non coercitif (R39).
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from olive_cpsi.analytique_2g import (  # noqa: E402
    peer_deviation, behavior_shift, first_time, segment_reactivation, income_mismatch,
    DETECTEURS_2G,
)


def _ok(cond, msg):
    if not cond:
        raise AssertionError(msg)


# ── AN-01 (R399) PEER_DEVIATION — z-score robuste médiane/MAD ──
def test_an01_outlier_devie_du_groupe():
    # Groupe « Affluent CH » ~cohérent, un client à 4.2σ (given de la spec).
    groupe = [10, 11, 9, 10, 12, 8, 11, 10, 9, 11]
    r = peer_deviation(value=40, group_values=groupe, zscore_seuil=3.5)
    _ok(r["raised"] is True, "AN-01 : l'outlier doit déclencher")
    _ok(r["niveau"] == 2 and r["blocking"] is False, "AN-01 : niveau 2, non bloquant")
    _ok(r["payload"]["zscore"] >= 3.5, "AN-01 : z robuste ≥ seuil, explicable")
    _ok(len(r["explanation"]) > 0, "AN-01 : R44 explicable")


def test_an01_membre_normal_ne_devie_pas():
    groupe = [10, 11, 9, 10, 12, 8, 11, 10, 9, 11]
    r = peer_deviation(value=11, group_values=groupe, zscore_seuil=3.5)
    _ok(r["raised"] is False, "AN-01 : un membre dans la distribution ne déclenche pas")
    _ok(r["explanation"] == "", "AN-01 : pas de signal levé → pas d'explication")


def test_an01_mad_robuste_a_l_outlier():
    # La présence d'un outlier ne doit PAS gonfler la dispersion (piège de σ) : MAD reste petit.
    # σ classique serait ~155 (le 500 le gonfle) → 40 paraîtrait normal ; le MAD reste à 1.
    groupe = [8, 9, 10, 11, 12, 10, 9, 11, 10, 500]
    r = peer_deviation(value=40, group_values=groupe, zscore_seuil=3.5)
    _ok(r["payload"]["mad"] <= 2, "AN-01 : le MAD n'est pas gonflé par le 500 (dispersion robuste)")
    _ok(r["raised"] is True, "AN-01 : MAD robuste → 40 reste déviant malgré le 500 dans le groupe")


# ── AN-02 (R400) BEHAVIOR_SHIFT — changepoint vs baseline 12 mois ──
def test_an02_triplement_de_volumetrie_declenche():
    baseline = [100] * 12          # 4 ans stables, résumé sur 12 mois
    recent = [300, 320, 310]       # triple en 3 semaines (given)
    r = behavior_shift(baseline, recent, sensibilite_rupture=2.0)
    _ok(r["raised"] is True, "AN-02 : ×3 ≥ sensibilité ×2 doit déclencher")
    _ok(r["payload"]["ratio"] >= 2.0, "AN-02 : ratio explicable joint au signal")


def test_an02_variation_normale_ne_declenche_pas():
    baseline = [100] * 12
    recent = [110, 95, 105]
    r = behavior_shift(baseline, recent, sensibilite_rupture=2.0)
    _ok(r["raised"] is False, "AN-02 : une variation ordinaire ne déclenche pas")


# ── AN-03 (R401) FIRST_TIME — première dimension sensible × matérialité (Niveau 1, friction douce) ──
def test_an03_premier_virement_hrj_materiel_declenche():
    r = first_time(dimension="HRJ", amount=80000, seen_dimensions=["domestique"], materialite_ft=25000)
    _ok(r["raised"] is True, "AN-03 : première occurrence HRJ au-dessus de la matérialité déclenche")
    _ok(r["niveau"] == 1 and r["blocking"] is False, "AN-03 : Niveau 1, JAMAIS bloquant (R39)")


def test_an03_dimension_deja_vue_ne_declenche_pas():
    r = first_time(dimension="HRJ", amount=80000, seen_dimensions=["HRJ", "cash"], materialite_ft=25000)
    _ok(r["raised"] is False, "AN-03 : pas une première occurrence → pas de signal")


def test_an03_sous_materialite_ne_declenche_pas():
    r = first_time(dimension="international", amount=1000, seen_dimensions=[], materialite_ft=25000)
    _ok(r["raised"] is False, "AN-03 : sous la matérialité → pas de friction")


# ── AN-04 (R402) SEGMENT_REACTIVATION — dormance par segment puis réactivation ──
def test_an04_segment_cash_dormant_reactive_declenche():
    r = segment_reactivation(months_since_last_segment_activity=36, has_current_activity=True,
                             dormance_segment=24)
    _ok(r["raised"] is True, "AN-04 : 36 mois de dormance cash ≥ 24 puis dépôts → déclenche")
    _ok(r["niveau"] == 2, "AN-04 : niveau 2")


def test_an04_segment_actif_recent_ne_declenche_pas():
    r = segment_reactivation(months_since_last_segment_activity=3, has_current_activity=True,
                             dormance_segment=24)
    _ok(r["raised"] is False, "AN-04 : segment actif récemment → pas une réactivation")


# ── AN-05 (R403) INCOME_MISMATCH — entrées récurrentes vs revenu déclaré au KYC ──
def test_an05_salaire_incoherent_declenche():
    r = income_mismatch(observed_income=45000, declared_income=12000, ecart_revenu_max=50)
    _ok(r["raised"] is True, "AN-05 : 45k observé vs 12k déclaré (275%) > 50% → déclenche")
    _ok(r["payload"]["ecartPct"] > 50, "AN-05 : écart % explicable")


def test_an05_revenu_coherent_ne_declenche_pas():
    r = income_mismatch(observed_income=12500, declared_income=12000, ecart_revenu_max=50)
    _ok(r["raised"] is False, "AN-05 : entrée cohérente avec le KYC → pas de signal")


# ── Parité de couverture : les 5 détecteurs 2G existent (R399–R403) ──
def test_couverture_5_detecteurs_2g():
    _ok(set(DETECTEURS_2G) == {"AN-01", "AN-02", "AN-03", "AN-04", "AN-05"},
        "bloc 61 couvert : AN-01..05 (R399–R403) implémentés en CPSI Python")
