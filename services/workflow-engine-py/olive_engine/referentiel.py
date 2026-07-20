"""Référentiel versionné O-Live (R29 généralisée + R48).

TOUT artefact de configuration est versionné par date de mise en vigueur :
matrice documentaire, définitions de sections, questionnaires KYC, règles.
Les versions sont immuables et append-only. Un dossier validé est estampillé
avec le snapshot complet du référentiel en vigueur (grandfathering R29) ;
le rejeu à date (R48) est une résolution de version, pas une reconstruction.
"""
from dataclasses import dataclass
from datetime import datetime
from types import MappingProxyType


def _freeze(x):
    if isinstance(x, dict):
        return MappingProxyType({k: _freeze(v) for k, v in x.items()})
    if isinstance(x, list):
        return tuple(_freeze(v) for v in x)
    return x


@dataclass(frozen=True)
class VersionArtefact:
    artefact: str          # "matrice_documentaire" | "definition_sections" | "questionnaire_kyc" | ...
    version: str           # "v1", "v2", ...
    en_vigueur_le: datetime
    contenu: object        # structure immuable


class Referentiel:
    """Registre versionné. Aucune version n'est jamais modifiée ni supprimée."""

    def __init__(self, journal=None):
        self._versions = {}    # artefact -> [VersionArtefact triées par vigueur]
        self._journal = journal

    def publier(self, artefact, contenu, en_vigueur_le, acteur="system"):
        versions = self._versions.setdefault(artefact, [])
        v = VersionArtefact(artefact=artefact,
                            version=f"v{len(versions) + 1}",
                            en_vigueur_le=en_vigueur_le,
                            contenu=_freeze(contenu))
        versions.append(v)
        versions.sort(key=lambda x: x.en_vigueur_le)
        if self._journal:
            self._journal.append(en_vigueur_le, "referentiel_publie", acteur,
                                 artefact=artefact, version=v.version)
        return v

    def en_vigueur(self, artefact, at):
        """La version en vigueur à une date donnée (R48 : rejeu à date)."""
        candidates = [v for v in self._versions.get(artefact, ())
                      if v.en_vigueur_le <= at]
        if not candidates:
            raise KeyError(f"Aucune version de {artefact} en vigueur au {at}")
        return candidates[-1]

    def version(self, artefact, version_id):
        for v in self._versions.get(artefact, ()):
            if v.version == version_id:
                return v
        raise KeyError(f"{artefact} {version_id} inconnu")

    def snapshot(self, at):
        """Photo complète du référentiel en vigueur — estampille du dossier (R29)."""
        return {a: self.en_vigueur(a, at).version for a in self._versions}

    @staticmethod
    def resoudre_document(exigence, juridiction):
        """R27 : la juridiction du cas détermine le document du groupe
        d'équivalence. exigence : str simple, ou mapping
        {"groupe": ..., "par_juridiction": {"CH": ..., "*": ...}}."""
        if isinstance(exigence, str):
            return exigence
        par_j = exigence["par_juridiction"]
        return par_j.get(juridiction, par_j.get("*"))
