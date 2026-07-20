"""Adaptateurs IA — pattern AI-assisted, human-decided (R44).

Le domaine appelle une interface ; l'IA propose, l'événement trace la
proposition, et la décision reste TOUJOURS humaine (decider_whitelist).
Aucune sortie IA ne modifie un état — elle alimente le journal et les tâches.
"""


class AnalyseIALocale:
    """Analyse déterministe hors ligne — comportement par défaut, tests."""

    def analyser_impact_whitelist(self, personne, profil, champ,
                                  justification_entree):
        return (f"changement {champ} : pertinence de la whitelist à réévaluer "
                f"(entrée : {justification_entree})")


class AnalyseIAClaude:
    """Production : analyse par Claude via l'API Anthropic.

    Usage :
        eng = Engine(journal=PostgresJournal(dsn),
                     ia=AnalyseIAClaude(api_key=..., model="claude-sonnet-4-6"))
    """

    PROMPT = (
        "Tu es un analyste compliance sanctions/PEP en banque privée suisse. "
        "Une personne figure en whitelist de screening (faux positif récurrent) "
        "avec la justification d'entrée suivante : {justification}. "
        "La donnée d'identité '{champ}' de cette personne vient de changer. "
        "Profil source du hit écarté : {profil}. "
        "Évalue en 3 phrases maximum si ce changement remet en cause la "
        "pertinence de la whitelist, et recommande 'maintien' ou 'sortie' "
        "avec ta confiance. Tu proposes ; la décision revient au responsable "
        "de la whitelist."
    )

    def __init__(self, api_key, model="claude-sonnet-4-6"):
        import anthropic
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    def analyser_impact_whitelist(self, personne, profil, champ,
                                  justification_entree):
        msg = self._client.messages.create(
            model=self._model, max_tokens=300,
            messages=[{"role": "user", "content": self.PROMPT.format(
                justification=justification_entree, champ=champ,
                profil=profil)}])
        return msg.content[0].text
