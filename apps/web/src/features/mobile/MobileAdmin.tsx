import React, { useState } from "react";
import { apiPost, apiGet, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { traduire, langue } from "../../lib/i18n";

/**
 * `mobileadmin` — R316-R318 (dégel V7, GO Ali 2026-07-28). La FACE BANQUE du canal mobile :
 * l'app cliente est un rendu, tout contrôle est serveur — cet écran est la seule surface
 * livrée v1. Le RM active (code hors bande remis UNE fois — jamais stocké), marque le
 * partagé (rien par défaut), lit et répond aux messages ; « changer mon adresse » se traite
 * en ouvrant un CoC (CC-01). Les refus backend s'affichent tels quels (FE-04). Converti au
 * cliquet i18n (tour 3) : l'UI passe par t(), les DONNÉES (messages, motifs) restent verbatim.
 */

type Message = { id: string; de: string; texte: string };

export function MobileAdmin() {
  const [clientId, setClientId] = useState("");
  const [activation, setActivation] = useState<{ identite: string; code: string } | null>(null);
  const [cible, setCible] = useState<"document" | "compte">("document");
  const [cibleId, setCibleId] = useState("");
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [reponse, setReponse] = useState("");
  const [msg, setMsg] = useState("");

  const erreur = (e: unknown) => setMsg((e as OliveError).message ?? "Erreur");  // le refus, TEL QUEL
  const petit = { fontSize: 12 } as const;
  const t = traduire(langue());
  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>{t("Mobile Banking — face banque (population cliente DISTINCTE, jamais un rôle interne)")}</h3>
    <p style={{ ...petit, color: tokens.color.muted }}>
      {t("v1 = lecture + messagerie côté client. Le client ne voit QUE le partagé (rien par défaut) ; aucune donnée compliance ne sort — contrôle SERVEUR, l'app est un rendu.")}
    </p>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <input placeholder="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} style={petit}/>
      <button style={petit} disabled={isDemoMode() || !clientId} onClick={async () => {
        setMsg("");
        try { setActivation(await apiPost("/v1/mobile/activer", { clientId })); } catch (e) { erreur(e); }
      }}>{t("Activer le canal (RM)")}</button>
      <button style={petit} disabled={isDemoMode() || !clientId} onClick={async () => {
        setMsg("");
        try { setMessages((await apiGet<{ messages: Message[] }>(`/v1/mobile/messages?clientId=${clientId}`, { messages: [] })).messages); }
        catch (e) { erreur(e); }
      }}>{t("Messagerie")}</button>
    </div>
    {activation && <p style={{ ...petit, color: tokens.color.olive700 }}>
      {t("Identité")} <strong>{activation.identite.slice(0, 8)}</strong> — {t("code hors bande")} <strong>{activation.code}</strong> :
      {" "}{t("remis UNE fois, à transmettre HORS canal (l'événement ne le porte jamais).")}
    </p>}
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <select value={cible} onChange={(e) => setCible(e.target.value as "document" | "compte")} style={petit}>
        <option value="document">{t("document")}</option><option value="compte">{t("compte")}</option></select>
      <input placeholder={cible === "document" ? t("documentId (GED)") : t("référence du compte")}
        value={cibleId} onChange={(e) => setCibleId(e.target.value)} style={petit}/>
      <button style={petit} disabled={isDemoMode() || !cibleId} onClick={async () => {
        setMsg("");
        try { await apiPost("/v1/mobile/partager", { cible, id: cibleId, clientId: clientId || undefined, partage: true }); setMsg(t("Marqué « partagé client » — acte tracé.")); }
        catch (e) { erreur(e); }
      }}>{t("Marquer partagé")}</button>
      <span style={{ ...petit, color: tokens.color.muted }}>{t("rien n'est partagé par défaut (R318)")}</span>
    </div>
    {msg && <p style={{ ...petit, color: tokens.color.olive700 }}>{msg}</p>}
    {messages && <div>
      <h4 style={{ fontSize: 13 }}>{t("Fil du client")}</h4>
      {messages.length === 0 && <p style={{ ...petit, color: tokens.color.muted }}>{t("Aucun message.")}</p>}
      <ul style={{ paddingLeft: 16 }}>{messages.map((m) => <li key={m.id} style={petit}>
        <strong>{m.de}</strong> — {m.texte}
        {m.de === "CLIENT" && <button style={{ ...petit, marginLeft: 8 }} disabled={isDemoMode()} onClick={async () => {
          setMsg("");
          try {
            const d = await apiPost<{ id: string }>(`/v1/mobile/messages/${m.id}/ouvrir-coc`,
              { typeCode: "MOD_DONNEES_PERSO", description: `Demande par message mobile : ${m.texte.slice(0, 80)}` });
            setMsg(`${t("CoC ouvert")} (${d.id.slice(0, 8)}) — ${t("la demande suit la voie R276, jamais un second circuit.")}`);
          } catch (e) { erreur(e); }
        }}>{t("Ouvrir un CoC")}</button>}
      </li>)}</ul>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder={t("répondre au client")} value={reponse} onChange={(e) => setReponse(e.target.value)} style={{ ...petit, width: 320 }}/>
        <button style={petit} disabled={isDemoMode() || !reponse || !clientId} onClick={async () => {
          setMsg("");
          try { await apiPost(`/v1/mobile/messages/${clientId}/repondre`, { texte: reponse }); setReponse(""); setMsg(t("Réponse envoyée.")); }
          catch (e) { erreur(e); }
        }}>{t("Envoyer")}</button>
      </div>
    </div>}
  </div>;
}
