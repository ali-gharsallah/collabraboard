import React, { useState } from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { BarreActes, ActeMoteur } from "./acte-moteur";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { jour } from "./moteur-formes";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M59 — FINANCE ISLAMIQUE (†ISLAMIC), débloquée sur ARBITRAGE PO (« je veux débloquer ça »).
 * Le semis a instancié un parcours RÉEL par les vraies routes : un signal R207 émis par le
 * moteur (client au profil islamique, virement vers un secteur haram du paramètre tenant) et
 * un calcul de zakat R211 — rien n'est peint, tout est persisté et journalisé.
 *
 * CE QUE L'ÉCRAN TIENT (R207-R221) :
 *   · les seuils et la liste des secteurs sont des PARAMÈTRES tenant (registre R-Q, clés
 *     `islamic*`) — jamais cachés dans le code, jamais réglés ici ;
 *   · le moteur ÉVALUE et SIGNALE — un signal non bloquant reste un signal (R44 : la revue
 *     est humaine) ; le refus franc n'existe que là où le canon le dit (maysir R209) ;
 *   · la zakat est un CALCUL (nisab, taux 2,5 %) qui rend son détail — jamais un montant nu.
 */

type SignalIslamic = { id?: string; type?: string; regle?: string; niveau?: number;
  note?: string; motif?: string; bloquant?: boolean; revueManuelle?: boolean; at?: string };
type Zakat = { id?: string; annee?: number; totalWealth?: number; nisab?: number;
  zakatDue?: number; taux?: string; status?: string };

const CLIENT_DEMO = "619f3674-d01b-4a2b-a3e5-88d5745385db";   // Famille Keller (parcours semé)

// Seeds au format EXACT du moteur — relevés sur l'API vivante après le semis 8l.
const SEED_SIGNAUX: SignalIslamic[] = [
  { id: "ce861a95-8725-4c65-a037-6cf7cf1e0b88", type: "ISLAMIC_PROFILE_VIOLATION", regle: "R207",
    niveau: 2, note: "Client islamique, virements non-Shariah : Casino de Montreux",
    motif: "Client Islamic, pattern non-Shariah (R207)", bloquant: false, revueManuelle: false,
    at: "2026-08-22T06:47:58.144Z" },
];
const SEED_ZAKAT: Zakat[] = [
  { id: "b8a58925-be73-435b-bac2-f7d46a44846c", annee: 2026, totalWealth: 1000000,
    nisab: 100000, zakatDue: 25000, taux: "2.5%", status: "PENDING_PAYMENT" },
];

const ACTES: ActeMoteur[] = [
  { cle: "islamic.evaluer", libelle: "Évaluer un contexte Shariah", route: "POST /v1/islamic/evaluer",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "clientIslamic", libelle: "Profil islamique déclaré ?", exemple: "true" },
      { cle: "secteur", libelle: "Secteur évalué (optionnel)", exemple: "CASINO" }],
    garde: "R207→R213 — le moteur évalue contre les PARAMÈTRES tenant (secteurs haram, seuils — registre R-Q, clés islamic*) et PERSISTE chaque signal au journal. Un signal non bloquant reste un signal : la revue est humaine (R44). Seul le maysir (R209) porte un refus franc — là où le canon le dit, pas ailleurs." },
  { cle: "islamic.zakat", libelle: "Calculer la zakat", route: "POST /v1/islamic/zakat",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "patrimoineChf", libelle: "Patrimoine (CHF)" }],
    garde: "R211 — la zakat est un CALCUL qui rend son détail : patrimoine, nisab (paramètre tenant), taux 2,5 %, montant dû, statut. Jamais un montant nu — un chiffre sans sa décomposition ne se discute pas." },
  { cle: "islamic.mudaraba", libelle: "Vérifier un partage mudaraba", route: "POST /v1/islamic/mudaraba",
    methode: "POST",
    // Champs = ceux que le MOTEUR lit (AC-03 a rougi sur mes noms inventés — corrigé) :
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "profitChf", libelle: "Profit à partager (CHF)" },
      { cle: "bankSharePct", libelle: "Part banque (%)", exemple: "30" },
      { cle: "clientSharePct", libelle: "Part client (%)", exemple: "70" }],
    garde: "R215 — le partage mudaraba se vérifie contre les parts CONVENUES (banque/client, en %) : le moteur calcule la distribution et signale l'écart — il ne corrige pas la répartition (R44)." },
  { cle: "islamic.sukuk", libelle: "Contrôler une maturité sukuk", route: "POST /v1/islamic/sukuk/maturite",
    methode: "POST",
    champs: [{ cle: "clientId", libelle: "Client" },
      { cle: "joursAvantMaturite", libelle: "Jours avant maturité", exemple: "30" }],
    garde: "R220 — à l'approche de la maturité, le moteur ALERTE (rachat garanti au nominal = structure proche du riba) — il consigne l'alerte au journal ; la qualification reste humaine." },
];

export function Islamic({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const [vue, setVue] = useState<"signaux" | "zakat">("signaux");
  const sig = useApiOrSeed<SignalIslamic[]>(`/v1/islamic/clients/${CLIENT_DEMO}/signaux`, SEED_SIGNAUX);
  const zak = useApiOrSeed<Zakat[]>(`/v1/islamic/clients/${CLIENT_DEMO}/zakat`, SEED_ZAKAT);
  const signaux = Array.isArray(sig.data) ? sig.data : [];
  const zakats = Array.isArray(zak.data) ? zak.data : [];

  const pilule = (id: "signaux" | "zakat", label: string) => (
    <button key={id} onClick={() => setVue(id)} aria-pressed={vue === id}
      style={{ padding: "6px 13px", borderRadius: 999, fontFamily: "inherit", fontSize: 12,
        fontWeight: 600, cursor: "pointer",
        border: vue === id ? "1px solid var(--brand)" : "1px solid var(--border-input)",
        background: vue === id ? "var(--brand-surface)" : "var(--bg-surface)",
        color: vue === id ? "var(--brand)" : "var(--text-secondary)" }}>{label}</button>);

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Finance Islamique — couche Shariah")}
        sousTitre={sig.isDemo ? t("données maquette")
          : t("source : /v1/islamic — signaux persistés, paramètres tenant R-Q (clés islamic*), R44 tenu")}
        t={t} />}>
      <BarreActes actes={ACTES} t={t} />
      <div style={{ display: "flex", gap: 8, margin: "12px 0 14px", flexWrap: "wrap" }}>
        {pilule("signaux", `${t("Signaux Shariah")} · ${signaux.length}`)}
        {pilule("zakat", `${t("Zakat")} · ${zakats.length}`)}
      </div>

      {vue === "signaux" && (!signaux.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {t("Aucun signal Shariah pour ce client.")}</div>
      ) : (<>
        <EntityList grid="90px 1.6fr 90px 120px 110px" onOpen={() => setVue("zakat")}
          entetes={[t("Règle"), t("Constat du moteur"), t("Niveau"), t("Bloquant"), t("Émis le")]}
          lignes={signaux.map((x, i) => ({ id: x.id ?? String(i), cells: [
            <span key="r" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{x.regle ?? "—"}</span>,
            <span key="n" style={{ fontSize: 12 }}>{x.note ?? x.motif ?? "—"}</span>,
            <span key="v" className="mono">{`N${x.niveau ?? "—"}`}</span>,
            x.bloquant ? <StatusChip key="b" mode="alert">{t("BLOQUANT")}</StatusChip>
              : <StatusChip key="b" mode="warn">{t("SIGNAL")}</StatusChip>,
            <span key="a" className="mono" style={{ fontSize: 11 }}>{jour(x.at) ?? "—"}</span>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le signal R207 affiché est RÉEL : émis par le moteur au semis (profil islamique + virement vers un secteur du paramètre tenant), persisté et journalisé. Un signal non bloquant se REVOIT — il ne se ferme pas tout seul, et l'écran ne le qualifie pas : la revue est humaine (R44).")}</div>
      </>))}

      {vue === "zakat" && (!zakats.length ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("Aucun calcul de zakat.")}</div>
      ) : (<>
        <EntityList grid="90px 140px 130px 130px 90px 150px" onOpen={() => setVue("signaux")}
          entetes={[t("Année"), t("Patrimoine"), t("Nisab"), t("Zakat due"), t("Taux"), t("Statut")]}
          lignes={zakats.map((z, i) => ({ id: z.id ?? String(i), cells: [
            <span key="a" className="mono" style={{ fontWeight: 600 }}>{z.annee ?? "—"}</span>,
            <span key="p" className="mono">{(z.totalWealth ?? 0).toLocaleString("fr-CH")}</span>,
            <span key="n" className="mono">{(z.nisab ?? 0).toLocaleString("fr-CH")}</span>,
            <span key="d" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>
              {(z.zakatDue ?? 0).toLocaleString("fr-CH")}</span>,
            <span key="t" className="mono">{z.taux ?? "—"}</span>,
            <StatusChip key="s" mode={z.status === "PAID" ? "ok" : "warn"}>{z.status ?? "—"}</StatusChip>] }))} />
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le calcul rend son DÉTAIL — patrimoine, nisab (paramètre tenant), taux, montant, statut — jamais un montant nu (R211). Les seuils se règlent au Paramétrage (clés islamic*), pas ici.")}</div>
      </>))}
    </Ui2Shell>);
}
