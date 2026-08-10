import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderDossier, Ui2Bouton } from "./Header";
import { StatusChip, ChipMode } from "./StatusChip";
import { DiffRow } from "./DiffRow";
import { ImpactPreview } from "./ImpactPreview";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * UI v2 — étape 7 : Revue & sortie — écrans 06 « Revue périodique » et 07 « Changement de
 * circonstances ». La revue n'est pas un questionnaire à refaire : l'écran montre CE QUI A
 * CHANGÉ depuis la dernière validation (delta R467, `/v1/revues/kyc/:code/delta` — modifiées
 * tracées ancien/nouveau, reprises avec preuve d'origine) et ne demande de confirmer que cela.
 * Le CoC montre l'onde de propagation AVANT de la déclencher (principe n°3) ; l'événement émis
 * est horodaté et nominatif — il ne se supprime pas, il se corrige par un nouvel événement.
 */

type Delta = { modifiees: { section: string; question: string; ancien: string; nouveau: string }[];
  reprises: { section: string; question: string }[] };

// Seed maquette 06 : 1 réponse modifiée (delta R467) + 28 sections reprises telles quelles.
const SEED_DELTA: Delta = {
  modifiees: [{ section: "activite", question: "nature",
    ancien: "Négoce de matériel médical, Suisse et UE",
    nouveau: "Ajout d'une activité d'import depuis les Émirats" }],
  reprises: Array.from({ length: 28 }, (_, i) => ({ section: `s${i}`, question: "q" })),
};

// ── V2-M4 : les sorties (/v1/offboarding, bloc 62) — onglet « Sorties » de Revue & sortie
// (cartographie ratifiée). Courrier de clôture généré (R270/OF-09), bannières de statut OF-10.
type Sortie = { id: string; reference?: string; clientId?: string; motif?: string; etape?: string; statut?: string };
const SEED_SORTIES: Sortie[] = [
  { id: "off-1", reference: "OFF-2026-0012", clientId: "Atlas Commodities Ltd", motif: "Décision comité — post-MROS", etape: "Transfert des avoirs", statut: "EN_COURS" },
  { id: "off-2", reference: "OFF-2026-0009", clientId: "Baltika Trading GmbH", motif: "Rupture commerciale (client)", etape: "Courrier de clôture", statut: "EN_COURS" },
  { id: "off-3", reference: "OFF-2026-0004", clientId: "Fonds Aurora LP", motif: "Fin de mandat", etape: "Clôturé", statut: "CLOS" },
];

function CarteEcart({ titre, chip, children }: {
  titre: string; chip: { label: string; mode: ChipMode }; children: React.ReactNode;
}) {
  const bord: Record<string, string> = { alert: "var(--alert-line)", warn: "var(--warn-card-border)",
    ok: "var(--ok-line)", neutral: "var(--border)", info: "var(--info-line)", ai: "var(--border)" };
  return (
    <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderLeft: `3px solid ${bord[chip.mode]}`, borderRadius: "var(--r-card)",
      boxShadow: "var(--shadow-card)", padding: "12px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>{titre}</span>
        <span style={{ marginLeft: "auto" }}><StatusChip mode={chip.mode}>{chip.label}</StatusChip></span>
      </div>
      {children}
    </section>);
}

export function RevueSortie({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [ecran, setEcran] = useState<"revue" | "coc" | "sorties">("revue");
  const sorties = useApiOrSeed<Sortie[]>("/v1/offboarding", SEED_SORTIES);
  // ✓ locaux de l'aperçu — chaque écran garde les siens (leçon de l'étape 6 : pas d'état partagé)
  const [reporte, setReporte] = useState(false);
  const [emis, setEmis] = useState<"" | "emis" | "sans-propagation">("");
  const delta = useApiOrSeed<Delta>("/v1/revues/kyc/KYC-2026-00447/delta", SEED_DELTA);
  const nbModifiees = delta.data.modifiees.length;
  const nbReprises = delta.data.reprises.length;
  const nbSections = nbModifiees + nbReprises + 3;         // + 3 écarts venus d'autres moteurs (alerte, doc, CoC)

  const navRevue = (
    <Ui2Nav active={ecran === "coc" ? "kyc" : active} user="Camille Morel" role="Relationship Manager"
      onNavigate={onNavigate} t={t}
      badges={ecran === "coc" ? { kyc: { n: 3 } } : { journee: { n: 12 }, dossiers: { n: 48, sobre: true },
        clients: { n: 214, sobre: true }, surveillance: { n: 5, alert: true }, revue: { n: 21 } }} />);

  if (ecran === "sorties") {
    return (
      <Ui2Shell nav={navRevue}
        header={<Ui2HeaderDossier nom={t("Revue & sortie — Sorties")} initiales="RS"
          identifiants={sorties.isDemo ? t("données maquette") : t("source : /v1/offboarding (bloc 62)")}
          puces={<StatusChip mode="neutral">{t("OFFBOARDING")}</StatusChip>}
          actions={<Ui2Bouton onClick={() => setEcran("revue")}>{t("← Revue groupée")}</Ui2Bouton>} t={t} />}>
        <EntityList grid="140px 1.3fr 1.3fr 150px 120px" onOpen={() => undefined}
          entetes={[t("Référence"), t("Client"), t("Motif"), t("Étape"), t("Statut")]}
          lignes={(Array.isArray(sorties.data) ? sorties.data : []).slice(0, 30).map((s) => ({
            id: s.id, cells: [
              <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{s.reference ?? s.id}</span>,
              <span key="c" style={{ fontWeight: 600, color: "var(--text)" }}>{s.clientId ?? "—"}</span>,
              t(s.motif ?? "—"),
              t(s.etape ?? "—"),
              <StatusChip key="s" mode={s.statut === "EN_COURS" ? "warn" : "ok"}>
                {t(s.statut === "EN_COURS" ? "EN COURS" : "CLOS")}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("La sortie est un workflow à étapes fermées (bloc 62) : le courrier de clôture est GÉNÉRÉ (R270), le statut du client porte des bannières pendant la sortie, et une clôture post-MROS reste cohérente avec la communication. Un terminal est toujours motivé.")}</div>
      </Ui2Shell>);
  }

  if (ecran === "coc") {
    return (
      <Ui2Shell nav={navRevue} sideWidth={400}
        header={<Ui2HeaderDossier nom="Henrik Vallon" initiales="HV" personne
          identifiants="PER-01994 · Suède · référencé dans 3 dossiers · UBO et signataire"
          puces={<StatusChip mode="neutral">{t("PERSONNE UNIQUE")}</StatusChip>}
          actions={<><Ui2Bouton onClick={() => setEcran("revue")}>{t("← Revue groupée liée")}</Ui2Bouton>
            <Ui2Bouton>{t("Voir la fiche personne")}</Ui2Bouton></>} t={t} />}
        side={<div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{t("Appliquer le changement")}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", margin: "3px 0 12px", lineHeight: 1.5 }}>
            {t("L'événement est horodaté et nominatif. Il ne peut pas être supprimé, seulement corrigé par un nouvel événement.")}</div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
            {t("Date d'effet")}
            <input className="mono" defaultValue="01.07.2026" aria-label={t("Date d'effet")}
              style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 5,
                padding: "9px 11px", borderRadius: "var(--r-input)", border: "1px solid var(--border-input)",
                fontSize: 12.5, color: "var(--text)", background: "var(--bg-surface)" }} /></label>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", margin: "4px 0 12px" }}>
            {t("Antérieure au constat — le rejeu d'audit distinguera les deux dates.")}</div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
            {t("Source du constat")}
            <select aria-label={t("Source du constat")} style={{ display: "block", width: "100%",
              boxSizing: "border-box", marginTop: 5, padding: "9px 11px", borderRadius: "var(--r-input)",
              border: "1px solid var(--border-input)", fontFamily: "inherit", fontSize: 12.5,
              color: "var(--text)", background: "var(--bg-surface)" }}>
              <option>{t("Entretien client du 07.08")}</option>
              <option>{t("Document reçu au portail")}</option>
              <option>{t("Signalement du gestionnaire")}</option>
            </select></label>
          <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
              {t("Ce qui sera créé")}</div>
            {[t("1 événement de changement de circonstances"), t("3 tâches réparties sur 2 gestionnaires"),
              t("1 demande de document au client"), t("2 recalculs de profil de risque")].map((l) => (
              <div key={l} style={{ fontSize: 11.5, color: "var(--text-body)", padding: "1.5px 0" }}>{l}</div>))}
          </div>
          <div style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
            borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 11.5,
            color: "var(--warn-text)", lineHeight: 1.5 }}>
            {t("Le dossier Sablier Investments est en cours d'ouverture : son aiguillage sera recalculé et pourra passer en EDD, ce qui rallongera le délai annoncé au client.")}</div>
          {emis === "emis" ? (
            <div role="status" style={{ background: "var(--ok-chip)", border: "1px solid var(--ok-line)",
              borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "var(--ok-text)", lineHeight: 1.5 }}>
              ✓ {t("Événement émis — horodaté et nominatif. Les tâches, revues et recalculs en découlent. Il ne se supprime pas : il se corrige par un nouvel événement.")}</div>
          ) : (<>
            <Ui2BoutonLarge primaire onClick={() => setEmis("emis")}>{t("Émettre l'événement")}</Ui2BoutonLarge>
            <Ui2BoutonLarge onClick={() => setEmis("sans-propagation")}>{t("Enregistrer sans propager")}</Ui2BoutonLarge>
            {emis === "sans-propagation" && (
              <div role="status" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 7, lineHeight: 1.5 }}>
                {t("Constat enregistré au brouillon — aucun événement émis, aucune propagation.")}</div>)}
          </>)}
        </div>}>
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "14px 16px", marginBottom: 14 }}>
          <div className="microlabel" style={{ marginBottom: 9 }}>{t("Changement constaté")}</div>
          <DiffRow encadre
            labelGauche={t("Au dossier depuis 2019")} gauche={t("Domicile fiscal : Suède")}
            sousGauche={t("Attestation de résidence 2019")}
            labelDroite={t("Déclaré le 07.08.2026")} droite={t("Domicile fiscal : Émirats arabes unis")}
            sousDroite={t("Certificat de résidence à recevoir")} />
          <div style={{ fontSize: 11.5, color: "var(--text-body)", marginTop: 10, lineHeight: 1.5 }}>
            {t("Matérialité évaluée")} <strong style={{ color: "var(--warn-text)" }}>{t("élevée")}</strong>{" "}
            {t("par le moteur : un changement de juridiction fiscale touche l'analyse cross-border, le profil de risque et la documentation fiscale.")}</div>
        </section>
        <ImpactPreview titre={t("Propagation — 3 dossiers concernés")}
          note={t("simulée, non encore appliquée")} t={t}
          dossiers={[
            { nom: "Vallon Nordic Holding AS", effet: { label: t("REVUE ANTICIPÉE"), mode: "warn" },
              detail: t("Sections rouvertes : fiscalité, cross-border, profil de risque · CDD → EDD probable · 2 tâches créées") },
            { nom: "Sablier Investments SA", effet: { label: t("ONBOARDING IMPACTÉ"), mode: "warn" },
              detail: t("Dossier en cours d'ouverture — l'aiguillage sera recalculé avant décision · 1 tâche créée") },
            { nom: "Fondation Vallon", effet: { label: t("SANS EFFET"), mode: "neutral" }, sansEffet: true,
              detail: t("Henrik Vallon y figure comme donateur, sans rôle de contrôle — aucune section rouverte") }]}
          pied={t("Rien ne se déclenche par effet de bord : l'application émet un événement, et les tâches, revues et recalculs en découlent. La liste ci-dessus est ce que cet événement produira, mot pour mot.")} />
      </Ui2Shell>);
  }

  return (
    <Ui2Shell nav={navRevue} sideGauche={<div>
      <div className="microlabel" style={{ marginBottom: 9 }}>{t("Dossiers du groupe")}</div>
      {[{ nom: "Delacroix & Fils SA", sous: t("Personne morale · Genève"), ecarts: t("3 ÉCARTS"), mode: "warn" as ChipMode },
        { nom: "Pierre Delacroix", sous: t("Personne physique · UBO 60 %"), ecarts: t("RAS"), mode: "neutral" as ChipMode },
        { nom: "Hélène Delacroix", sous: t("Personne physique · UBO 40 %"), ecarts: t("1 ÉCART"), mode: "warn" as ChipMode },
        { nom: "Fondation Delacroix", sous: t("Fondation · Vaud"), ecarts: t("RAS"), mode: "neutral" as ChipMode }]
        .map((d) => (
          <section key={d.nom} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--r-card)", boxShadow: "var(--shadow-card)", padding: "10px 12px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", minWidth: 0 }}>{d.nom}</span>
              <span style={{ marginLeft: "auto" }}><StatusChip mode={d.mode}>{d.ecarts}</StatusChip></span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{d.sous}</div>
          </section>))}
      <section style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", padding: "10px 12px", marginTop: 14 }}>
        <div className="microlabel" style={{ marginBottom: 4 }}>{t("Effort évité")}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.5 }}>
          {`${nbReprises} ${t("des")} ${nbSections} ${t("sections sont inchangées et reportées automatiquement, avec leur preuve d'origine.")}`}</div>
      </section>
    </div>}
      header={<Ui2HeaderDossier nom={t("Groupe Delacroix — revue groupée")} initiales="GD"
        identifiants={t("Dernière validation : 22.09.2025 · échéance 22.09.2026 · cycle annuel (risque élevé)")}
        puces={<StatusChip mode="neutral">{t("4 DOSSIERS")}</StatusChip>}
        actions={<><Ui2Bouton onClick={() => setEcran("sorties")}>{`${t("Sorties")} · ${Array.isArray(sorties.data) ? sorties.data.length : 0} →`}</Ui2Bouton>
          <Ui2Bouton>{t("Comparer à 2025")}</Ui2Bouton>
          <Ui2Bouton primaire>{t("Transmettre pour visa")}</Ui2Bouton></>} t={t} />}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{t("Ce qui a changé depuis la dernière revue")}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {`${nbModifiees + 3} ${t("écarts sur")} ${nbSections} ${t("sections")}`}</span>
        {!delta.isDemo && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{t("delta R467 (/v1/revues)")}</span>}
      </div>
      <CarteEcart titre={t("Flux transactionnels hors profil")} chip={{ label: t("À TRAITER"), mode: "alert" }}>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.5 }}>
          {t("Le volume sortant a triplé au 2ᵉ trimestre vers une contrepartie absente du profil déclaré en 2025. Une alerte AML est ouverte sur ce point.")}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          <Ui2Bouton onClick={() => onNavigate("surveillance")}>{t("Ouvrir l'alerte liée")}</Ui2Bouton>
          <Ui2Bouton>{t("Mettre à jour le profil de flux")}</Ui2Bouton>
        </div>
      </CarteEcart>
      {delta.data.modifiees.map((m) => (
        <CarteEcart key={m.section + m.question} titre={t("Nouvelle activité déclarée")}
          chip={{ label: t("À CONFIRMER"), mode: "warn" }}>
          <DiffRow labelGauche={t("Au dossier — 2025")} gauche={m.ancien}
            labelDroite={t("Constaté — 2026")} droite={m.nouveau} />
        </CarteEcart>))}
      <CarteEcart titre={t("Pièce d'identité expirée — Hélène Delacroix")} chip={{ label: t("À RENOUVELER"), mode: "warn" }}>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.5 }}>
          {t("Passeport échu le 11.05.2026. Détecté par le contrôle de validité documentaire, pas par la revue elle-même.")}</div>
      </CarteEcart>
      <CarteEcart titre={t("Changement d'adresse — siège social")} chip={{ label: t("DÉJÀ TRAITÉ"), mode: "ok" }}>
        <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.5 }}>
          {t("Traité en mars par un événement de changement de circonstances et propagé aux 4 dossiers. Aucune action requise ici.")}</div>
        <div style={{ marginTop: 9 }}>
          <Ui2Bouton onClick={() => setEcran("coc")}>{t("Voir le changement de circonstances →")}</Ui2Bouton>
        </div>
      </CarteEcart>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {t("2 écarts restent à traiter avant transmission")}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {reporte ? (
            <span role="status" style={{ fontSize: 11.5, color: "var(--ok-text)" }}>
              ✓ {`${nbReprises} ${t("sections reportées en bloc, avec leur preuve d'origine (visa R467).")}`}</span>
          ) : (
            <Ui2Bouton onClick={() => setReporte(true)}>{`${t("Reporter les")} ${nbReprises} ${t("sections inchangées")}`}</Ui2Bouton>)}
          <Ui2Bouton primaire>{t("Enregistrer")}</Ui2Bouton>
        </span>
      </div>
    </Ui2Shell>);
}

/** Bouton pleine largeur de la colonne d'action (écran 07). */
function Ui2BoutonLarge({ children, primaire, onClick }: {
  children: React.ReactNode; primaire?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", padding: "11px 14px",
      marginBottom: 8, borderRadius: "var(--r-input)", fontFamily: "inherit", fontSize: 13,
      fontWeight: 600, cursor: "pointer",
      border: primaire ? "1px solid var(--brand)" : "1px solid var(--border-input)",
      background: primaire ? "var(--brand)" : "var(--bg-surface)",
      color: primaire ? "#fff" : "var(--text-secondary)" }}>{children}</button>);
}
