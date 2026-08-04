# -*- coding: utf-8 -*-
"""
Analytique 2G — détecteurs statistiques AML gap (bloc 61, R399–R403).

INVARIANT (décision 4 du journal 2026-08-04) : ces détecteurs s'exécutent DANS le service CPSI
Python — JAMAIS réécrits en Nest. Le moteur Nest (src/aml/engine.ts) les REFUSE (meta.deferred) ;
la surface AML gap (blocs 50–60) mesure des seuils, l'Analytique 2G mesure des DISTRIBUTIONS.

Esprit R44 / R39 : chaque détecteur MESURE et retourne un résultat EXPLICABLE (attribut, valeur,
distribution du groupe joints) — il n'exécute rien et ne décide rien. L'humain qualifie (TP/FP).
Aucune dépendance externe (numpy absent du service) : statistiques robustes en Python pur.
"""

# Constante de cohérence : 0.6745 = Φ⁻¹(0.75), rend le MAD comparable à l'écart-type d'une normale.
_MAD_TO_SIGMA = 0.6745


def _median(xs):
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return 0.0
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def _mad(xs, med=None):
    """Median Absolute Deviation — dispersion robuste (insensible aux outliers, contrairement à σ)."""
    if med is None:
        med = _median(xs)
    return _median([abs(x - med) for x in xs])


def _result(sid, rule_ref, signal, niveau, blocking, raised, payload, explanation):
    return {
        "scenarioId": sid, "ruleRef": rule_ref, "signal": signal, "niveau": niveau,
        "blocking": blocking, "raised": raised,
        "payload": payload,
        "explanation": explanation if raised else "",
    }


def peer_deviation(value, group_values, zscore_seuil=3.5):
    """AN-01 (R399) PEER_DEVIATION — z-score robuste (médiane/MAD) d'un attribut vs son groupe de
    pairs. Robuste = l'outlier lui-même ne gonfle pas la dispersion (piège de σ classique)."""
    med = _median(group_values)
    mad = _mad(group_values, med)
    # MAD nul (groupe dégénéré) : on retombe sur l'écart absolu normalisé par la médiane, borné.
    z = 0.0 if mad == 0 else _MAD_TO_SIGMA * (value - med) / mad
    raised = abs(z) >= zscore_seuil
    return _result(
        "AN-01", "R399", "PEER_DEVIATION", 2, False, raised,
        {"attribut": value, "medianeGroupe": med, "mad": mad, "zscore": round(z, 2), "seuil": zscore_seuil},
        f"Déviation au groupe de pairs : z robuste {abs(z):.2f}σ ≥ seuil {zscore_seuil}σ "
        f"(valeur {value} vs médiane {med}).",
    )


def behavior_shift(baseline_series, recent_series, sensibilite_rupture=2.0):
    """AN-02 (R400) BEHAVIOR_SHIFT — rupture (changepoint) de volumétrie : moyenne de la fenêtre
    récente vs baseline 12 mois. `sensibilite_rupture` (tenant) = multiplicateur déclencheur."""
    base = sum(baseline_series) / len(baseline_series) if baseline_series else 0.0
    recent = sum(recent_series) / len(recent_series) if recent_series else 0.0
    ratio = float("inf") if base == 0 else recent / base
    raised = ratio >= float(sensibilite_rupture)
    return _result(
        "AN-02", "R400", "BEHAVIOR_SHIFT", 2, False, raised,
        {"baselineMoyenne": round(base, 2), "recenteMoyenne": round(recent, 2),
         "ratio": None if ratio == float("inf") else round(ratio, 2), "sensibilite": sensibilite_rupture},
        f"Rupture de comportement : volumétrie récente ×{ratio:.2f} de la baseline "
        f"≥ sensibilité ×{sensibilite_rupture}.",
    )


def first_time(dimension, amount, seen_dimensions,
               dimensions_ft=("international", "cash", "HRJ", "produit_risque"),
               materialite_ft=25000):
    """AN-03 (R401) FIRST_TIME — première occurrence sur une dimension sensible × matérialité.
    Niveau 1, NON bloquant : friction douce, jamais un blocage (R39 : mesurer, pas coercer)."""
    sensible = dimension in set(dimensions_ft)
    premiere = dimension not in set(seen_dimensions)
    materiel = amount >= materialite_ft
    raised = sensible and premiere and materiel
    return _result(
        "AN-03", "R401", "FIRST_TIME", 1, False, raised,
        {"dimension": dimension, "montant": amount, "materialite": materialite_ft,
         "sensible": sensible, "premiere": premiere},
        f"First-time pattern : première occurrence « {dimension} » à {amount} CHF "
        f"≥ matérialité {materialite_ft} CHF.",
    )


def segment_reactivation(months_since_last_segment_activity, has_current_activity,
                         dormance_segment=24):
    """AN-04 (R402) SEGMENT_REACTIVATION — dormance PAR SEGMENT (cash/international/produit) puis
    réactivation : première activité du segment après N mois de silence."""
    raised = bool(has_current_activity) and months_since_last_segment_activity >= dormance_segment
    return _result(
        "AN-04", "R402", "SEGMENT_REACTIVATION", 2, False, raised,
        {"moisSansActivite": months_since_last_segment_activity, "seuilDormance": dormance_segment,
         "activiteCourante": bool(has_current_activity)},
        f"Réactivation de segment dormant : {months_since_last_segment_activity} mois de silence "
        f"≥ dormance {dormance_segment} mois, puis activité.",
    )


def income_mismatch(observed_income, declared_income, ecart_revenu_max=50):
    """AN-05 (R403) INCOME_MISMATCH — entrées récurrentes (« salaire ») vs rémunération déclarée
    au KYC. `ecart_revenu_max` en % : au-delà, mise à jour KYC ou justification exigée (CoC)."""
    if declared_income <= 0:
        ecart = float("inf")
    else:
        ecart = (observed_income - declared_income) / declared_income * 100.0
    raised = ecart > float(ecart_revenu_max)
    return _result(
        "AN-05", "R403", "INCOME_MISMATCH", 2, False, raised,
        {"revenuObserve": observed_income, "revenuDeclare": declared_income,
         "ecartPct": None if ecart == float("inf") else round(ecart, 1), "toleranceMax": ecart_revenu_max},
        f"Revenus entrants incohérents : {observed_income} observé vs {declared_income} déclaré "
        f"(écart {ecart:.0f}% > toléré {ecart_revenu_max}%).",
    )


# Registre des 5 détecteurs 2G — parité avec meta.deferred (bloc 61) côté Nest.
DETECTEURS_2G = {
    "AN-01": peer_deviation, "AN-02": behavior_shift, "AN-03": first_time,
    "AN-04": segment_reactivation, "AN-05": income_mismatch,
}
