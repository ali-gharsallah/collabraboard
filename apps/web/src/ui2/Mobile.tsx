import React from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { BarreActes, ActeMoteur } from "./acte-moteur";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M59 — MOBILE BANKING (†MOBILE), débloqué sur ARBITRAGE PO (« je veux débloquer ça ») :
 * la clé gouvernée `mobile_actif` a été posée avec motif et une identité cliente réelle
 * (Famille Keller) activée par le RM — code hors bande remis UNE fois, jamais stocké en clair.
 *
 * CE QUE L'ÉCRAN TIENT, parce que c'est la doctrine du moteur (R316-R318, MB-01..05) :
 *   · les clients finaux sont une POPULATION IAM DISTINCTE — table sans colonne de rôle,
 *     structurel (R316) ; MFA TOTP obligatoire ;
 *   · clé `mobile_actif` OFF ⇒ toute la surface répond 404 NEUTRE — l'existence est cachée,
 *     jamais un 403 qui avouerait quelque chose (MB-04, structurel) ;
 *   · v1 = LECTURE + MESSAGERIE. Modifier une donnée personnelle passe par un MESSAGE que le
 *     RM traite en ouvrant un CoC — la voie R276 réelle, jamais un second circuit (MB-05) ;
 *   · le client ne voit QUE le partagé (marquage EXPLICITE par pièce/compte, R318) — rien par
 *     défaut, et AUCUNE donnée compliance, pas même son existence.
 */

type MessageMobile = { id?: string; de?: string; texte?: string; at?: string; luPar?: string | null };

// Seed au format du moteur (messagesBanque) — la messagerie est VIDE après l'activation :
// c'est l'état réel du parcours fraîchement ouvert, et l'écran le dit.
const SEED_MSG: { messages: MessageMobile[] } = { messages: [] };
const CLIENT_DEMO = "619f3674-d01b-4a2b-a3e5-88d5745385db";   // Famille Keller (identité activée au semis)

const ACTES: ActeMoteur[] = [
  { cle: "mobile.activer", libelle: "Activer un client", route: "POST /v1/mobile/activer",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client (du portefeuille du RM)" }],
    garde: "MB-01/R316 — l'activation est l'acte du RM du client : elle crée une identité dans la population DISTINCTE des clients finaux et remet le code d'activation UNE fois, pour le canal hors bande — il n'est jamais stocké ni journalisé en clair. Réactiver régénère le code et invalide le MFA." },
  { cle: "mobile.partager", libelle: "Partager une pièce ou un compte", route: "POST /v1/mobile/partager",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "cible", libelle: "Cible", exemple: "document | compte" },
      { cle: "id", libelle: "Identifiant de la pièce / du compte" },
      { cle: "partage", libelle: "Partager ?", exemple: "true | false" }],
    garde: "R318 — le client ne voit QUE le marqué partagé, pièce par pièce, compte par compte : rien par défaut (mobile_partage_defaut), le marquage est tracé, et AUCUNE donnée compliance ne traverse — pas même son existence (pattern OL-34/R270)." },
  { cle: "mobile.repondre", libelle: "Répondre à un message", route: "POST /v1/mobile/messages/:id/repondre",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Client (fil de discussion)" },
      { cle: "texte", libelle: "Réponse" }],
    garde: "R317 — la messagerie est LE canal du parcours v1 (lecture + messagerie, liste fermée du canon). Une réponse est un message de la banque, tracé — jamais une modification de données faite « au nom du client »." },
  { cle: "mobile.coc", libelle: "Ouvrir un CoC depuis un message", route: "POST /v1/mobile/messages/:id/ouvrir-coc",
    methode: "POST",
    champs: [{ cle: ":id", libelle: "Message" },
      { cle: "typeCode", libelle: "Type de CoC (R276)" },
      { cle: "description", libelle: "Description" }],
    garde: "MB-05 — un client qui demande un changement de données personnelles ne modifie RIEN lui-même : le RM ouvre un CoC depuis le message — la voie R276 réelle, avec sa matérialité et son circuit. Jamais un second circuit mobile." },
];

export function Mobile({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const msg = useApiOrSeed<{ messages: MessageMobile[] }>(
    `/v1/mobile/messages?clientId=${CLIENT_DEMO}`, SEED_MSG);
  const messages = Array.isArray(msg.data?.messages) ? msg.data.messages : [];

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Marc Dupont" role="Relationship Manager"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Mobile Banking — administration")}
        sousTitre={msg.isDemo ? t("données maquette")
          : t("source : /v1/mobile — population cliente distincte (R316), lecture + messagerie (R317), partage explicite (R318)")}
        t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "14px 0 8px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("Messagerie — Famille Keller")}</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {t("identité activée au semis, code remis hors bande")}</span>
      </div>
      {!messages.length ? (
        <section style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", padding: "13px 16px" }}>
          <div style={{ fontSize: 12, color: "var(--text-body)", lineHeight: 1.6 }}>
            {t("Aucun message — le parcours vient d'être ouvert et le client ne voit encore RIEN : le partage est explicite, pièce par pièce (R318), rien par défaut. C'est l'état réel d'une activation fraîche, pas un écran en panne.")}</div>
        </section>
      ) : (
        <EntityList grid="140px 1fr 130px 110px" onOpen={() => {}}
          entetes={[t("De"), t("Message"), t("Reçu le"), t("Lu")]}
          lignes={messages.map((m, i) => ({ id: m.id ?? String(i), cells: [
            <span key="d" className="mono" style={{ fontSize: 11 }}>{m.de ?? "—"}</span>,
            <span key="x" style={{ fontSize: 12 }}>{m.texte ?? "—"}</span>,
            <span key="a" className="mono" style={{ fontSize: 11 }}>{(m.at ?? "").slice(0, 10) || "—"}</span>,
            m.luPar ? <StatusChip key="l" mode="ok">{t("LU")}</StatusChip>
              : <StatusChip key="l" mode="warn">{t("NON LU")}</StatusChip>] }))} />)}
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
        {t("Tant que la clé gouvernée mobile_actif est OFF, TOUTE la surface répond 404 neutre — l'existence du service est cachée, jamais avouée par un 403 (MB-04, structurel). Les exclusions v1 du canon n'ont pas de route : leur 404 n'est pas un garde, c'est une absence. Un changement de données demandé par le client passe par un CoC ouvert du message (MB-05) — jamais un second circuit.")}</div>
    </Ui2Shell>);
}
