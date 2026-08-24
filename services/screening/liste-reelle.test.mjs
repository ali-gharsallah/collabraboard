/**
 * BOUT EN BOUT sur un feed au FORMAT RÉEL (R409) — prouve que la chaîne complète compose sur un flux
 * HÉTÉROGÈNE (entrées OFAC-SDN et UN-consolidated mélangées) : ingererListe (normalise) → construireIdf
 * → construireIndex (pré-filtre) → rapprocherDetail (score fin + discriminants). Ce n'est pas le golden
 * set synthétique : c'est la démonstration que l'adaptateur d'ingestion branche un vrai format sur le
 * moteur, sans mapping ad hoc.
 *
 *   node services/screening/liste-reelle.test.mjs
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ingererListe, construireIdf, construireIndex, candidats, rapprocherDetail } from "@olive/screening-engine";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const feed = JSON.parse(readFileSync(join(DIR, "liste-reelle-exemple.json"), "utf8"));

const SEUIL = 85;
const entries = ingererListe(feed.entries);         // R409 — un seul adaptateur pour tout le feed
construireIdf(entries);
const idx = construireIndex(entries);

let echecs = [];
const check = (cond, msg) => { if (!cond) echecs.push(msg); };
const rapprocher1 = (req) => { const c = candidats(idx, req.nom); return rapprocherDetail(req, c, SEUIL); };

console.log(`LISTE RÉELLE (bout en bout) — feed hétérogène OFAC+UN · ${entries.length} entrées normalisées · seuil ${SEUIL}\n`);

// 1) Ingestion : le feed hétérogène a bien produit des EntreeMoteur exploitables (uid/nom pour toutes).
const bienForme = entries.every((e) => e.uid && e.nom_complet);
console.log(`1. ingestion   ${entries.length} entrées, toutes avec uid+nom_complet : ${bienForme}`);
check(bienForme, "certaines entrées du feed n'ont pas été normalisées (uid/nom manquant)");

// 2) Translittération : « Mohamad Haddad » (dans les alias OFAC) → hit sur OFAC-0001, score composite.
const t = rapprocher1({ nom: "Mohamad Haddad", dob: "1980-05-22", nationalites: ["SY"] });
console.log(`2. translit    Mohamad Haddad → ${t ? t.uid + " score " + t.score : "AUCUN"}`);
check(t && t.uid === "OFAC-0001" && t.score >= SEUIL, "la translittération ne retombe pas sur OFAC-0001");
check(t && t.detail && typeof t.detail.nameScore === "number", "décomposition (detail) absente");

// 3) Discriminant DOB : même nom, année incompatible → écarté (pas de hit).
const h = rapprocher1({ nom: "Muhammad Haddad", dob: "2002-05-22" });
console.log(`3. homonyme    Muhammad Haddad / 2002 → ${h ? h.uid + " (score " + h.score + ")" : "rejeté (aucun hit)"}`);
check(!h, "l'homonyme à date incompatible aurait dû être écarté par le discriminant DOB");

// 4) Cross-format UN : « Kim Cheol Su » (alias UN) → hit sur UN-KPi.045.
const k = rapprocher1({ nom: "Kim Cheol Su", dob: "1966-08-01" });
console.log(`4. format UN    Kim Cheol Su → ${k ? k.uid + " score " + k.score : "AUCUN"}`);
check(k && k.uid === "UN-KPi.045" && k.score >= SEUIL, "l'alias UN ne retombe pas sur UN-KPi.045");

// 5) Client ordinaire : aucun rapprochement.
const n = rapprocher1({ nom: "Jean Dupont", dob: "1970-01-10" });
console.log(`5. neutre      Jean Dupont → ${n ? n.uid : "aucun hit"}`);
check(!n, "un client sans rapport a produit un hit");

if (echecs.length) {
  console.log(`\n✗ LISTE RÉELLE ROUGE — ${echecs.length} :`);
  echecs.forEach((m) => console.log(`   ✗ ${m}`));
  process.exit(1);
}
console.log(`\n✓ feed hétérogène ingéré · translit + alias UN retrouvés · homonyme DOB écarté · neutre ignoré.`);
console.log(`### 5/5 liste-reelle verts (R409) ###`);
