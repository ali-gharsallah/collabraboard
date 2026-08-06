// Types du moteur de screening partagé (@olive/screening-engine, R408).
export interface EntreeMoteur {
  uid: string;
  nom_complet: string;
  alias?: Array<string | { nom: string }>;
  date_naissance?: string | null;
  type?: string;
  nationalites?: string[];         // R417 — codes pays (ISO-2) de l'entrée listée
}
export interface Requete {
  nom: string;
  dob?: string | null;
  est_entite?: boolean;
  nationalites?: string[];         // R417 — nationalité(s) du client interrogé
}
export interface Decomposition {
  score: number;         // 0-100 (float, avant arrondi)
  via: string;           // nom/alias qui a donné le meilleur appariement
  nameScore: number;     // score de nom (avant discriminants)
  typePenalty: number;   // 0, -40, -80
  dobContribution: number; // +6, +2, -12, -45, ou 0
  natContribution: number; // R417 — bonus nationalité commune (0 si méthode off ou pas de recoupement)
}
export interface Resultat { uid: string; score: number; entree: EntreeMoteur; }
export interface ResultatDetaille extends Resultat { detail: Decomposition; }
export interface IndexTrigramme { index: Map<string, number[]>; entries: EntreeMoteur[]; n: number; }
export interface OptionsBlocking { maxTrigrammes?: number; minPartages?: number; plafond?: number; }

// R413 — réglage optionnel du score. Omis → comportement d'origine (défauts = littéraux figés).
export interface ConfigMoteur {
  echelle?: number;                  // amplitude du score (défaut 100)
  penaliteTypeIncompatible?: number; // pénalité PP↔entité (défaut 40)
  bonusDobExact?: number;            // DOB identique (défaut 6)
  bonusDobMemeAnnee?: number;        // même année, jour différent (défaut 2)
  ecartAnneesProche?: number;        // seuil d'années « proche » (défaut 2)
  penaliteDobProche?: number;        // écart ≤ seuil (défaut 12)
  penaliteDobIncompatible?: number;  // écart > seuil (défaut 45)
  phonetique?: boolean;              // R416 — méthode phonétique (défaut false = Jaro seul)
  phonetiquePoids?: number;          // similarité créditée sur clé phonétique identique (défaut 0.9)
  nationalite?: boolean;             // R417 — discriminant nationalité (défaut false)
  nationaliteBonus?: number;         // bonus sur nationalité commune (défaut 8)
}
export declare const DEFAUTS_MOTEUR: Readonly<Required<ConfigMoteur>>;
export declare const DEFAUTS_BLOCKING: Readonly<Required<OptionsBlocking>>;

export function normaliser(s: string): string;
export function jetonsTries(s: string): string;
export function jaroWinkler(a: string, b: string): number;
export function clePhonetique(s: string): string;
export function construireIdf(entries: EntreeMoteur[]): { df: Map<string, number>; n: number };
export function scorer(requete: Requete, entree: EntreeMoteur, config?: ConfigMoteur): number;
export function scorerDetail(requete: Requete, entree: EntreeMoteur, config?: ConfigMoteur): Decomposition;
export function rapprocher(requete: Requete, entries: EntreeMoteur[], seuil: number, config?: ConfigMoteur): Resultat | null;
export function rapprocherDetail(requete: Requete, entries: EntreeMoteur[], seuil: number, config?: ConfigMoteur): ResultatDetaille | null;
export function construireIndex(entries: EntreeMoteur[]): IndexTrigramme;
export function candidats(idx: IndexTrigramme, nom: string, opts?: OptionsBlocking): EntreeMoteur[];

// Ingestion multi-format (sous R409) — normalise une entrée brute (SECO/synthétique, OFAC, UN) vers EntreeMoteur.
export function ingererEntree(e: any): EntreeMoteur;
export function ingererListe(entrees: any[]): EntreeMoteur[];
export function normaliserType(t: unknown): string | undefined;
