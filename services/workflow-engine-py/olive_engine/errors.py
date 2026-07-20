"""Erreurs métier du moteur O-Live — chaque erreur référence sa règle du catalogue."""

class OliveRuleError(Exception):
    rule = None
    def __init__(self, message):
        super().__init__(f"[{self.rule}] {message}")

class FourEyesViolation(OliveRuleError):
    rule = "R13"

class MotivationRequired(OliveRuleError):
    rule = "R7"

class RevocationNotAllowed(OliveRuleError):
    rule = "R9"

class NotAuthorized(OliveRuleError):
    rule = "R11"

class EngagementRequired(OliveRuleError):
    rule = "R14"

class InvalidTransition(OliveRuleError):
    rule = "R1"

class AppendOnlyViolation(OliveRuleError):
    rule = "R49"

class ConcurrencyConflict(OliveRuleError):
    rule = "R53"

class NotNamedValidator(NotAuthorized):
    """Signature réservée au validateur nommé (dérogation R4 possible)."""
    rule = "R2"


class RegleTenantInvalide(OliveRuleError):
    """R56 : type de règle inconnu ou interdit — les règles tenant ne peuvent
    QUE durcir un invariant, jamais l'assouplir. Refus AVANT tout effet."""

class RegleTenantViolation(OliveRuleError):
    """R56 : une règle tenant active bloque l'action (contrôle additionnel)."""
