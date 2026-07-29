import React, { useState } from "react";
import { apiGetSourced, apiPost, isDemoMode, OliveError } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import { tokens } from "../../theme/tokens";
import { GrilleMatrice, SectionGrille } from "./GrilleMatrice";

// R283/RW-04 — `sdar` et `sdgar` : écrans de SÉLECTION sur le composant de grille commun de
// sdkyc (un composant, trois configurations). Le gabarit KYC est SERVI par le backend
// (/v1/reviews/profils — source unique, jamais recopié ici) ; l'écran écrit UNIQUEMENT le
// paramètre `reviewProfiles` par le registre R-Q (motivé, versionné) — JAMAIS kyc_access_rules :
// les droits restent la matrice R282, la review n'a pas de matrice parallèle.

type Profil = { type: string; niveau: string; sectionsActives: string[];
  questionsRequises: string[]; sectionsReconfirmation: string[] };
type Servi = { gabarits: Record<string, SectionGrille[]>; profils: Profil[] };
const NIVEAUX = ["SDD", "CDD", "EDD"];

const vide = (type: string, niveau: string): Profil =>
  ({ type, niveau, sectionsActives: [], questionsRequises: [], sectionsReconfirmation: [] });
const bascule = (xs: string[], x: string) => xs.includes(x) ? xs.filter((v) => v !== x) : [...xs, x];

export function ProfilsReview({ type, ecran }: { type: "AR" | "GAR"; ecran: string }) {
  const [servi, setServi] = useState<Servi | null>(null);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [niveau, setNiveau] = useState("CDD");
  const [msg, setMsg] = useState("");

  const charger = async () => {
    setMsg("");
    const r = await apiGetSourced<Servi>("/v1/reviews/profils", null as unknown as Servi);
    if (r.isDemo || !r.data) { setMsg("Profils indisponibles (API absente)"); return; }
    setServi(r.data);
    setProfils(r.data.profils.map((p) => ({ ...vide(p.type, p.niveau), ...p })));
  };
  const courant = profils.find((p) => p.type === type && p.niveau === niveau) ?? vide(type, niveau);
  const poser = (maj: Partial<Profil>) =>
    setProfils((ps) => [...ps.filter((p) => !(p.type === type && p.niveau === niveau)), { ...courant, ...maj }]);
  const enregistrer = async () => {
    setMsg("");
    try {
      // RW-04 : LA seule écriture de l'écran — le paramètre versionné, par le registre (R7 : motivé)
      await apiPost("/v1/parametres/valeur/reviewProfiles",
        { valeur: profils, motif: `R283 : profils de review ${type} (écran ${ecran})` });
      setMsg(`Profils ${type} enregistrés (paramètre reviewProfiles, versionné au registre).`);
    } catch (e) { setMsg((e as OliveError).message ?? "Erreur"); }
  };

  return <div>
    {isDemoMode() && <DemoModeBanner/>}
    <h3>Profils de review {type} ({ecran}) — la review SÉLECTIONNE dans le KYC, un seul modèle (R283)</h3>
    <p style={{ fontSize: 12, color: tokens.color.muted }}>Sections actives (re-réponse), questions REQUISES ajoutées, sections en re-confirmation simple.
      Le gabarit est servi par le backend ; l&apos;écran n&apos;écrit QUE le paramètre reviewProfiles — jamais la matrice de droits (R282).</p>
    <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
      <button onClick={charger} disabled={isDemoMode()} style={{ fontSize: 12 }}>Charger</button>
      {servi && NIVEAUX.map((n) => <button key={n} onClick={() => setNiveau(n)}
        style={{ fontSize: 12, fontWeight: n === niveau ? 700 : 400 }}>{n}</button>)}
      {servi && <button data-testid="enregistrer" onClick={enregistrer} disabled={isDemoMode()} style={{ fontSize: 12 }}>Enregistrer les profils {type}</button>}
    </div>
    {msg && <p data-testid={`msg-${ecran}`} style={{ fontSize: 12, color: tokens.color.olive700 }}>{msg}</p>}
    {servi && <GrilleMatrice sections={servi.gabarits[niveau] ?? []} colonnes={["REQUISE"]}
      enTeteSection={(s) => <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 400 }}>
        <label style={{ marginRight: 8 }}><input type="checkbox" checked={courant.sectionsActives.includes(s.code)}
          onChange={() => poser({ sectionsActives: bascule(courant.sectionsActives, s.code) })}/> active</label>
        <label><input type="checkbox" checked={courant.sectionsReconfirmation.includes(s.code)}
          onChange={() => poser({ sectionsReconfirmation: bascule(courant.sectionsReconfirmation, s.code) })}/> re-confirmation</label></span>}
      cellule={(q) => <input type="checkbox" aria-label={`requise ${q.code}`}
        checked={courant.questionsRequises.includes(q.code)}
        onChange={() => poser({ questionsRequises: bascule(courant.questionsRequises, q.code) })}/>}/>}
  </div>;
}
