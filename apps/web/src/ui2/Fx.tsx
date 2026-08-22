import React from "react";
import { Ui2Shell } from "./Shell";
import { Ui2Nav, Ui2NavId } from "./Nav";
import { Ui2HeaderListe } from "./Header";
import { StatusChip } from "./StatusChip";
import { EntityList } from "./Listes";
import { useApiOrSeed } from "../lib/useApiOrSeed";
import { traduire, langue } from "../lib/i18n";

/**
 * V2-M59 — MULTI-DEVISE & FX (†FX). L'arbitrage sur ce qui reste fermé appartient au PO — cet
 * écran existe donc, et il montre EXACTEMENT ce que le moteur détient : l'exposition par devise
 * telle que /v1/fx/exposition la sert. Sans port FX configuré, le moteur répond « montants en
 * devise d'origine, jamais un taux inventé (R167) » — et l'écran affiche CE message, mot pour
 * mot, à la place d'un tableau de conversions peintes. Même famille d'honnêteté que Settlement
 * (V2-M48) et que le registre de breaches PMS (V2-M56) : le vide est expliqué, jamais maquillé.
 */

type Exposition = { parDevise?: Record<string, number>; conversion?: string };

// Seed au format EXACT du moteur — relevé sur l'API vivante (port FX absent, message R167).
const SEED: Exposition = { parDevise: {},
  conversion: "aucun port FX configuré — montants en devise d'origine, jamais un taux inventé (R167)" };

export function Fx({ active, onNavigate }: { active: Ui2NavId; onNavigate: (id: Ui2NavId) => void }) {
  const t = traduire(langue());
  const expo = useApiOrSeed<Exposition>("/v1/fx/exposition", SEED);
  const devises = Object.entries(expo.data?.parDevise ?? {});

  return (
    <Ui2Shell nav={<Ui2Nav active={active} user="Sofia Berger" role="Compliance Officer"
      onNavigate={onNavigate} t={t}
      badges={{ journee: { n: 12 }, dossiers: { n: 48, sobre: true }, clients: { n: 214, sobre: true },
        surveillance: { n: 5, alert: true } }} />}
      header={<Ui2HeaderListe titre={t("Multi-devise & FX")}
        sousTitre={expo.isDemo ? t("données maquette") : t("source : /v1/fx/exposition (R167)")}
        t={t} />}>
      {!devises.length ? (
        <section style={{ background: "var(--warn-card)", border: "1px solid var(--warn-card-border)",
          borderRadius: "var(--r-card)", padding: "13px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <StatusChip mode="warn">{t("AUCUN PORT FX")}</StatusChip>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
              {t("Exposition vide — le message est celui du moteur")}</span>
          </div>
          {/* FE-04 : le message du moteur, tel quel — il porte R167 mieux que toute paraphrase. */}
          <div className="mono" style={{ fontSize: 11.5, color: "var(--warn-text)", lineHeight: 1.6 }}>
            {expo.data?.conversion ?? "—"}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-body)", lineHeight: 1.6, marginTop: 8 }}>
            {t("L'exposition par devise s'alimente des flux transactionnels, eux-mêmes servis par le port core banking — la même dépendance que Settlement et Transactions Risk Monitoring. Un tableau de conversions sans taux réel serait indiscernable d'un vrai : c'est ce que R167 interdit. Le jour où le port est configuré, cet écran se remplit sans une ligne de code.")}</div>
        </section>
      ) : (
        <EntityList grid="140px 1fr" onOpen={() => {}}
          entetes={[t("Devise"), t("Exposition (devise d'origine)")]}
          lignes={devises.map(([d, m]) => ({ id: d, cells: [
            <span key="d" className="mono" style={{ fontWeight: 600, color: "var(--text)" }}>{d}</span>,
            <span key="m" className="mono">{Number(m).toLocaleString("fr-CH")}</span>] }))} />)}
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
        {t("Les montants restent en DEVISE D'ORIGINE tant qu'aucun port FX ne fournit de taux — le moteur ne convertit jamais avec un taux inventé (R167), et l'écran n'affiche jamais une somme toutes-devises qui n'existe pas.")}</div>
    </Ui2Shell>);
}
