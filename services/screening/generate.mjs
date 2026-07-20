/**
 * Générateur de données de screening — DÉVELOPPEMENT ET TESTS UNIQUEMENT.
 *
 * ⚠ Aucune personne réelle. Aucune donnée sous licence. Synthétique et déterministe
 *   (graine 20260715 → mêmes fichiers, donc chiffres comparables dans le temps).
 *
 * FIDÉLITÉ : la structure reprend celle que vendent les providers (Dow Jones R&C, World-Check,
 * ComplyAdvantage) — vérifiée par recherche le 15.07.2026 :
 *   • catégories : Sanctions · PEP · RCA (proches & associés) · SIP/SIE (intérêt spécial) · SCO (règle des 50 %)
 *   • identifiants multiples : alias typés (AKA/FKA) avec QUALITÉ (strong/weak), nom en script original,
 *     dates de naissance multiples et parfois PARTIELLES, lieu de naissance, genre, nationalités,
 *     adresses, documents d'identité (passeport / pièce nationale)
 *   • PEP : catégorie d'occupation (22 chez Dow Jones), fonction, pays, niveau domestique/étranger/
 *     international, dates de début/fin, statut actuel/ancien
 *   • sanctions : programme/régime, date d'inscription, base légale, remarques, statut actif/radié
 *
 *   node services/screening/generate.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

let _s = 20260715;
const rnd = () => { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; return Math.abs(_s) / 2147483647; };
const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
const some = (a, n) => { const c = [...a], o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const d2 = (n) => String(n).padStart(2, "0");
const dateAlea = (a1, a2) => `${int(a1, a2)}-${d2(int(1, 12))}-${d2(int(1, 28))}`;

// ── Briques onomastiques par aire : c'est là que le rapprochement souffre ──
const N = {
  ar: { pre: ["Muhammad","Ahmad","Khalid","Yusuf","Ibrahim","Omar","Hassan","Tariq","Abdullah","Faisal","Salim","Rashid"],
        nom: ["Al-Sayed","Al-Rashid","Bin Zayed","El-Masri","Al-Habib","Ibn Saud","Al-Nouri","Al-Jaber","Haddad","Mansour"],
        script: (p,n) => `${p} ${n}`.replace(/[A-Za-z]/g, "") || "محمد السيد", ordre: "prenom_nom" },
  ru: { pre: ["Aleksandr","Dmitri","Sergei","Nikolai","Yevgeni","Mikhail","Vladimir","Igor","Anatoli","Viktor"],
        nom: ["Volkov","Petrov","Sokolov","Morozov","Lebedev","Novikov","Orlov","Kuznetsov","Popov","Fedorov"],
        script: () => "Александр Волков", ordre: "prenom_nom" },
  cn: { pre: ["Wei","Fang","Min","Jing","Lei","Xiu","Hao","Yan","Tao","Ling"],
        nom: ["Li","Wang","Zhang","Chen","Liu","Yang","Huang","Zhao","Wu","Zhou"],
        script: () => "李伟", ordre: "nom_prenom" },
  eu: { pre: ["Johannes","François","Miguel","Lars","Giuseppe","Katarzyna","Henrik","Pierre","Alessandro","Ingrid"],
        nom: ["van der Berg","de la Cruz","O'Sullivan","Müller","Björnsson","Kowalski","Dubois","Rossi","Andersson","Novak"],
        script: null, ordre: "prenom_nom" },
};
const AIRES = ["ar","ru","cn","eu"];
/** Variantes de translittération PRÉSENTES dans les alias (cas facile). */
const ALIAS_CONNUS = {
  Muhammad:["Mohammed","Mohamed","Muhammed"], Ahmad:["Ahmed","Ahmet"], Yusuf:["Yousef","Youssef"],
  Ibrahim:["Ebrahim","Brahim"], Aleksandr:["Alexander","Aleksander"], Dmitri:["Dmitry","Dimitri"],
  Sergei:["Sergey","Serguei"], Yevgeni:["Evgeny","Evgenii"], Mikhail:["Michail","Mikhaïl"],
  "Müller":["Mueller","Muller"], "Al-Sayed":["El Sayed","Alsayed"], "Al-Rashid":["Al Rashed"],
};
/** Variantes ABSENTES des alias (le vrai test du moteur). */
const VARIANTES_HORS_LISTE = {
  Muhammad:"Mohamad", Ahmad:"Ahmadd", Yusuf:"Yusef", Ibrahim:"Ibraheem", Aleksandr:"Alexandre",
  Dmitri:"Dmitrii", Sergei:"Sergueï", Yevgeni:"Yevgeny", Mikhail:"Mihail", Khalid:"Khaled",
  Omar:"Umar", Hassan:"Hasan", Tariq:"Tarek", Nikolai:"Nikolay", "Müller":"Myuller",
  Abdullah:"Abdallah", Faisal:"Faysal", Vladimir:"Wladimir", Viktor:"Victor",
};

const PROGRAMMES = [
  { code:"CH-SECO-RU-2022", base:"O-Ukraine (RS 946.231.176.72)", autorite:"SECO" },
  { code:"EU-833/2014",     base:"Règlement (UE) 833/2014",       autorite:"UE" },
  { code:"UN-1267",         base:"Résolution CSNU 1267 (1999)",   autorite:"ONU" },
  { code:"US-OFAC-SDN",     base:"Executive Order 13662",         autorite:"OFAC" },
  { code:"CH-SECO-IR-2010", base:"O-Iran (RS 946.231.143.6)",     autorite:"SECO" },
  { code:"EU-2016/44",      base:"Règlement (UE) 2016/44",        autorite:"UE" },
];
const PAYS = ["RU","IR","SY","KP","BY","MM","VE","CN","LY","SD","AF","ZW"];
const PAYS_OK = ["CH","FR","DE","GB","IT","ES","AT","LU","SG","AE","US","CA"];
const VILLES = { RU:["Moscou","Saint-Pétersbourg","Kazan"], IR:["Téhéran","Ispahan"], SY:["Damas","Alep"],
  KP:["Pyongyang"], BY:["Minsk"], CN:["Pékin","Shanghai","Shenzhen"], VE:["Caracas"], MM:["Yangon"],
  LY:["Tripoli"], SD:["Khartoum"], AF:["Kaboul"], ZW:["Harare"], CH:["Genève","Zurich"], AE:["Dubaï"] };
const SUFFIXES_ENT = ["Trading","Holdings","Shipping","Petroleum","Industries","Logistics","Capital","Invest","Maritime","Energy"];

// ══════════════════════════════════════════════════════════════════════
// 1. LISTE DE SANCTIONS — structure fidèle aux feeds commerciaux
// ══════════════════════════════════════════════════════════════════════
const sanctions = [];
const vusNoms = new Set();
let uid = 100000;

/**
 * Noms uniques. Le vivier prénom × nom s'épuise vite (≈120 combinaisons par aire) : on ajoute
 * alors un second élément — patronyme, deuxième prénom, particule — comme dans la vraie vie.
 * Sans unicité, le cas « homonyme → ne doit PAS matcher » devient faux (une autre entrée du même
 * nom matcherait légitimement). Le banc l'avait révélé une première fois ; on ne le repaie pas.
 */
function nouveauNom(aire) {
  const b = N[aire];
  for (let k = 0; k < 60; k++) {
    const pre = pick(b.pre), nom = pick(b.nom);
    const complet = b.ordre === "nom_prenom" ? `${nom} ${pre}` : `${pre} ${nom}`;
    if (!vusNoms.has(complet)) { vusNoms.add(complet); return { pre, nom, complet, ordre: b.ordre, aire }; }
  }
  for (let k = 0; k < 400; k++) {
    const pre = pick(b.pre), mid = pick(b.pre), nom = pick(b.nom);
    if (mid === pre) continue;
    const preC = `${pre} ${mid}`;
    const complet = b.ordre === "nom_prenom" ? `${nom} ${preC}` : `${preC} ${nom}`;
    if (!vusNoms.has(complet)) { vusNoms.add(complet); return { pre, nom, complet, ordre: b.ordre, aire, prenom_compose: preC }; }
  }
  return null;
}
function aliasDe(pre, nom, complet, ordre) {
  const out = [];
  (ALIAS_CONNUS[pre] || []).forEach((v) => out.push({
    nom: ordre === "nom_prenom" ? `${nom} ${v}` : `${v} ${nom}`, type: "AKA", qualite: "strong" }));
  (ALIAS_CONNUS[nom] || []).forEach((v) => out.push({
    nom: ordre === "nom_prenom" ? `${v} ${pre}` : `${pre} ${v}`, type: "AKA", qualite: "strong" }));
  if (rnd() < 0.3) out.push({ nom: complet.replace(/[\s-]/g, ""), type: "AKA", qualite: "weak" });
  if (rnd() < 0.15) out.push({ nom: `${pre.slice(0,1)}. ${nom}`, type: "AKA", qualite: "weak" });
  if (rnd() < 0.12) out.push({ nom: complet, type: "FKA", qualite: "strong" });
  return out.slice(0, 4);
}

// -- personnes physiques
for (let i = 0, g = 0; i < 420 && g < 5000; i++, g++) {
  const aire = pick(AIRES); const n = nouveauNom(aire); if (!n) { i--; continue; }
  const nat = pick(PAYS);
  const dobs = [dateAlea(1948, 1992)];
  if (rnd() < 0.18) dobs.push(dateAlea(1948, 1992));               // dates multiples : le feed en donne parfois plusieurs
  const partielle = rnd() < 0.12 ? dobs[0].slice(0, 4) : null;      // date partielle (année seule)
  sanctions.push({
    uid: "SYN-SAN-P-" + (uid++), type: "individu", categorie: "SANCTION",
    nom_complet: n.complet, prenom: n.pre, nom_famille: n.nom, ordre: n.ordre,
    nom_script_original: N[aire].script ? N[aire].script(n.pre, n.nom) : null,
    genre: rnd() < 0.85 ? "M" : "F",
    alias: aliasDe(n.pre, n.nom, n.complet, n.ordre),
    dates_naissance: partielle ? [partielle] : dobs,
    date_naissance_partielle: !!partielle,
    lieu_naissance: { ville: pick(VILLES[nat] || ["—"]), pays: nat },
    nationalites: rnd() < 0.2 ? some(PAYS, 2) : [nat],
    adresses: [{ ville: pick(VILLES[nat] || ["—"]), pays: nat }],
    documents: rnd() < 0.55 ? [{ type: "passeport", numero: `${nat}${int(1000000, 9999999)}`, pays: nat }] : [],
    programme: pick(PROGRAMMES),
    date_inscription: dateAlea(2014, 2026),
    remarques: rnd() < 0.3 ? "Inscrit au titre du soutien matériel au régime." : null,
    statut: rnd() < 0.06 ? "RADIE" : "ACTIF",
    date_radiation: null, aire_culturelle: aire,
  });
}
sanctions.filter((e) => e.statut === "RADIE").forEach((e) => { e.date_radiation = dateAlea(2023, 2026); });

// -- entités
const entitesSanctionnees = [];
for (let i = 0; i < 160; i++) {
  const aire = pick(AIRES); const base = pick(N[aire].nom); const pays = pick(PAYS);
  const nom = `${base} ${pick(SUFFIXES_ENT)}`;
  if (vusNoms.has(nom)) continue; vusNoms.add(nom);
  const e = {
    uid: "SYN-SAN-E-" + (uid++), type: "entite", categorie: "SANCTION",
    nom_complet: nom,
    alias: [{ nom: `${nom} Ltd`, type: "AKA", qualite: "strong" },
            { nom: nom.replace(/\s+/g, ""), type: "AKA", qualite: "weak" }],
    adresses: [{ ville: pick(VILLES[pays] || ["—"]), pays }],
    pays,
    identifiants: rnd() < 0.4 ? [{ type: "registre_commerce", numero: `RC-${int(100000, 999999)}`, pays }] : [],
    programme: pick(PROGRAMMES),
    date_inscription: dateAlea(2014, 2026),
    statut: "ACTIF",
  };
  sanctions.push(e); entitesSanctionnees.push(e);
}

// -- navires (les feeds en contiennent : c'est un piège classique du rapprochement)
for (let i = 0; i < 20; i++) {
  sanctions.push({
    uid: "SYN-SAN-V-" + (uid++), type: "navire", categorie: "SANCTION",
    nom_complet: `MV ${pick(["Aurora","Neptune","Pioneer","Meridian","Osprey","Falcon"])} ${int(1, 9)}`,
    imo: `IMO${int(9000000, 9999999)}`, pavillon: pick(PAYS),
    programme: pick(PROGRAMMES), date_inscription: dateAlea(2018, 2026), statut: "ACTIF", alias: [],
  });
}

// -- SCO : entités détenues à ≥50 % par un sanctionné (règle des 50 % OFAC / équivalents UE-UK)
const sco = [];
for (let i = 0; i < 60; i++) {
  const proprio = pick(sanctions.filter((e) => e.type === "individu"));
  const pays = pick(PAYS.concat(PAYS_OK));
  const nom = `${proprio.nom_famille} ${pick(SUFFIXES_ENT)} ${pick(["Group","International","Partners"])}`;
  if (vusNoms.has(nom)) continue; vusNoms.add(nom);
  sco.push({
    uid: "SYN-SCO-" + (uid++), type: "entite", categorie: "SCO",
    nom_complet: nom, alias: [{ nom: `${nom} SA`, type: "AKA", qualite: "strong" }],
    pays, adresses: [{ ville: pick(VILLES[pays] || ["—"]), pays }],
    detention: { proprietaire_uid: proprio.uid, proprietaire_nom: proprio.nom_complet, pourcentage: int(50, 100) },
    motif: "Détenue majoritairement par une personne sanctionnée (règle des 50 %)",
    programme: proprio.programme, date_inscription: dateAlea(2022, 2026), statut: "ACTIF",
  });
}

// ══════════════════════════════════════════════════════════════════════
// 2. PEP + RCA — 22 catégories d'occupation, niveaux, RCA liés
// ══════════════════════════════════════════════════════════════════════
const OCCUPATIONS = [
  { cat:"Chef d'État / de gouvernement", niveau:"national", risque:3 },
  { cat:"Ministre", niveau:"national", risque:3 },
  { cat:"Vice-ministre / secrétaire d'État", niveau:"national", risque:3 },
  { cat:"Parlementaire", niveau:"national", risque:2 },
  { cat:"Membre d'une cour suprême", niveau:"national", risque:2 },
  { cat:"Membre d'une cour des comptes", niveau:"national", risque:2 },
  { cat:"Membre d'un conseil de banque centrale", niveau:"national", risque:3 },
  { cat:"Ambassadeur / chargé d'affaires", niveau:"national", risque:2 },
  { cat:"Officier supérieur des forces armées", niveau:"national", risque:2 },
  { cat:"Dirigeant d'entreprise d'État", niveau:"national", risque:3 },
  { cat:"Membre d'un parti politique (organe dirigeant)", niveau:"national", risque:2 },
  { cat:"Haut fonctionnaire", niveau:"national", risque:2 },
  { cat:"Gouverneur / élu régional", niveau:"regional", risque:2 },
  { cat:"Maire d'une grande ville", niveau:"regional", risque:1 },
  { cat:"Élu local", niveau:"local", risque:1 },
  { cat:"Juge d'une cour régionale", niveau:"regional", risque:1 },
  { cat:"Dirigeant d'organisation internationale", niveau:"international", risque:3 },
  { cat:"Haut fonctionnaire d'organisation internationale", niveau:"international", risque:2 },
  { cat:"Membre d'une famille royale régnante", niveau:"national", risque:3 },
  { cat:"Dirigeant d'organisme de régulation", niveau:"national", risque:2 },
  { cat:"Responsable d'un fonds souverain", niveau:"national", risque:3 },
  { cat:"Dirigeant d'un parti d'opposition majeur", niveau:"national", risque:1 },
];
const LIENS_RCA = ["époux/épouse","fils","fille","père","mère","frère","sœur","beau-fils","belle-fille",
  "associé d'affaires","conseiller proche","prête-nom présumé"];

const peps = [], rcas = [];
for (let i = 0, g = 0; i < 380 && g < 5000; i++, g++) {
  const aire = pick(AIRES); const n = nouveauNom(aire); if (!n) { i--; continue; }
  const occ = pick(OCCUPATIONS);
  const pays = rnd() < 0.55 ? pick(PAYS) : pick(PAYS_OK);
  const debut = dateAlea(2005, 2024);
  const ancien = rnd() < 0.3;
  const p = {
    uid: "SYN-PEP-" + (uid++), type: "individu", categorie: "PEP",
    nom_complet: n.complet, prenom: n.pre, nom_famille: n.nom, ordre: n.ordre,
    nom_script_original: N[aire].script ? N[aire].script(n.pre, n.nom) : null,
    genre: rnd() < 0.8 ? "M" : "F",
    alias: aliasDe(n.prenom_compose || n.pre, n.nom, n.complet, n.ordre),
    dates_naissance: [dateAlea(1945, 1985)],
    lieu_naissance: { ville: pick(VILLES[pays] || ["—"]), pays },
    nationalites: [pays],
    occupation: { categorie: occ.cat, niveau: occ.niveau, risque_indicatif: occ.risque },
    fonction: `${occ.cat} — ${pays}`,
    pays_fonction: pays,
    date_debut: debut,
    date_fin: ancien ? dateAlea(2020, 2026) : null,
    statut: ancien ? "ANCIEN" : "ACTUEL",
    source: "Registre officiel / presse (synthétique)",
    aire_culturelle: aire,
  };
  peps.push(p);

  // RCA : générés à chaque PEP identifié — c'est ainsi que les providers procèdent
  const nbRca = rnd() < 0.5 ? int(1, 3) : 0;
  for (let r = 0; r < nbRca; r++) {
    const lien = pick(LIENS_RCA);
    const meme = /époux|fils|fille|père|mère|frère|sœur/.test(lien);
    let nr = null, complet = null;
    if (meme) {
      // Un proche de la famille porte le MÊME nom de famille : c'est précisément ce qui rend
      // les RCA difficiles à distinguer du PEP lui-même.
      for (let k = 0; k < 40 && !complet; k++) {
        const pre = pick(N[aire].pre);
        const c = n.ordre === "nom_prenom" ? `${n.nom} ${pre}` : `${pre} ${n.nom}`;
        if (!vusNoms.has(c)) { vusNoms.add(c); nr = { pre, nom: n.nom, ordre: n.ordre }; complet = c; }
      }
    } else {
      // nouveauNom() enregistre DÉJÀ le nom : le re-tester ici rejetait 100 % des RCA.
      const g = nouveauNom(pick(AIRES));
      if (g) { nr = { pre: g.prenom_compose || g.pre, nom: g.nom, ordre: g.ordre }; complet = g.complet; }
    }
    if (!complet) continue;
    rcas.push({
      uid: "SYN-RCA-" + (uid++), type: "individu", categorie: "RCA",
      nom_complet: complet, prenom: nr.pre, nom_famille: nr.nom, ordre: nr.ordre,
      alias: aliasDe(nr.pre, nr.nom, complet, nr.ordre),
      dates_naissance: [dateAlea(1955, 2000)],
      nationalites: [pays],
      lien: { type: lien, pep_uid: p.uid, pep_nom: p.nom_complet },
      motif: `Lié à un PEP (${lien}) — ${p.fonction}`,
      statut: p.statut, source: "Déclarations d'intérêts / filings (synthétique)",
    });
  }
}

// ── SIP : personnes d'intérêt spécial (crime) ──
const sips = [];
for (let i = 0, g = 0; i < 60 && g < 2000; i++, g++) {
  const aire = pick(AIRES); const n = nouveauNom(aire); if (!n) { i--; continue; }
  sips.push({
    uid: "SYN-SIP-" + (uid++), type: "individu", categorie: "SIP",
    nom_complet: n.complet, prenom: n.pre, nom_famille: n.nom, ordre: n.ordre,
    alias: aliasDe(n.pre, n.nom, n.complet, n.ordre),
    dates_naissance: [dateAlea(1955, 1995)], nationalites: [pick(PAYS.concat(PAYS_OK))],
    infraction: pick(["blanchiment","corruption","fraude fiscale","trafic de stupéfiants","abus de marché","détournement de fonds publics"]),
    stade: pick(["accusé","arrêté","condamné","mis en examen"]),
    date_evenement: dateAlea(2016, 2026), source: "Presse / registres judiciaires (synthétique)", statut: "ACTIF",
  });
}

// ══════════════════════════════════════════════════════════════════════
// 3. BASE CLIENTS — large, avec des hits PLANTÉS (vérité terrain)
// ══════════════════════════════════════════════════════════════════════
const PRE_CH = ["Jean","Marie","Pierre","Anna","Luca","Sofia","Thomas","Elena","Marc","Nadia","Paul","Claire","David","Laura","Nicolas","Julia"];
const NOM_CH = ["Dupont","Martin","Rossi","Weber","Meier","Fontana","Blanc","Keller","Girard","Baumann","Perret","Schneider","Favre","Berger","Morel","Chen"];
const SECTEURS = ["Technologie","Immobilier","Santé","Energie","Industrie","Finance & Asset management","Négoce matières premières",
  "Négoce d'art & galeries","Crypto-actifs & exchanges","Casinos & gaming","Courtage de yachts","Aviation privée","Agriculture","Retail / Distribution"];
const TYPES = [["PP","Personne physique"],["SA","Société opérationnelle (SA)"],["DOM","Société de domicile"],
  ["TRUST","Trust"],["HOLD","Holding"],["FOND","Fondation"],["FO","Family Office"]];

const clients = [];
const hitsPlantes = [];
const toutesEntrees = [...sanctions, ...sco, ...peps, ...rcas, ...sips];
let cid = 1;
const segDeAum = (m) => m >= 100 ? "UHNWI" : m >= 10 ? "HNWI" : m >= 1 ? "Affluent" : "Mass Affluent";

for (let i = 0; i < 2000; i++) {
  const tp = pick(TYPES);
  const pp = tp[0] === "PP";
  let nom, planted = null, variante = null;

  // ⚠ Un vrai hit doit être VRAIMENT la même personne : même nom ET date de naissance compatible.
  // Première version : la date était tirée au hasard → mes « vrais hits » étaient des homonymes par
  // construction, et le rappel mesuré ne voulait rien dire. Le banc l'a révélé.
  let dobImposee = null;
  const tirage = rnd();
  if (tirage < (pp ? 0.05 : 0.012)) {                       // ~1,6 % : vrai hit, nom EXACT d'une entrée
    const e = pick(toutesEntrees.filter((x) => (pp ? x.type === "individu" : x.type === "entite")));
    if (e) {
      nom = e.nom_complet;
      if (pp && e.dates_naissance) dobImposee = e.dates_naissance[0];
      planted = { uid: e.uid, categorie: e.categorie, mode: "exact" };
    }
  } else if (pp && tirage < 0.09) {          // ~0,8 % : vrai hit, translittération HORS liste — clients PP seulement
    const e = pick(toutesEntrees.filter((x) => x.type === "individu" && VARIANTES_HORS_LISTE[x.prenom]));
    if (e) {
      const v = VARIANTES_HORS_LISTE[e.prenom];
      nom = e.ordre === "nom_prenom" ? `${e.nom_famille} ${v}` : `${v} ${e.nom_famille}`;
      if (e.dates_naissance) dobImposee = e.dates_naissance[0];
      planted = { uid: e.uid, categorie: e.categorie, mode: "translitteration" }; variante = v;
    }
  } else if (pp && tirage < 0.20) {           // ~3,4 % : quasi-homonyme — clients PP seulement
    const e = pick(toutesEntrees.filter((x) => x.type === "individu"));
    if (e) { nom = `${pick(N[e.aire_culturelle || "eu"].pre)} ${e.nom_famille}`; planted = { uid: null, mode: "quasi_homonyme" }; }
  }
  if (!nom) nom = pp ? `${pick(PRE_CH)} ${pick(NOM_CH)}` : `${pick(NOM_CH)} ${pick(["SA","Holding","Trust","Invest","Partners"])}`;

  const aum = int(1, 400) + int(0, 9) / 10;
  const c = {
    id: "CLI-" + String(cid++).padStart(5, "0"),
    name: nom, type: tp[0], typeLabel: tp[1],
    countryCode: rnd() < 0.72 ? pick(PAYS_OK) : pick(PAYS),
    segment: segDeAum(aum), aum: `CHF ${aum}M`,
    sector: pick(SECTEURS),
    date_naissance: pp ? (dobImposee || dateAlea(1945, 2000)) : null,
    pep_declare: rnd() < 0.04,
    onboardingDate: dateAlea(2012, 2026),
  };
  clients.push(c);
  if (planted) hitsPlantes.push({ client_id: c.id, client_nom: c.name, ...planted, variante });
}

// ══════════════════════════════════════════════════════════════════════
// 4. GOLDEN SET — les cas durs, avec leur réponse attendue
//    (régénéré ici : sans lui, les bancs jugeraient contre des UID périmés)
// ══════════════════════════════════════════════════════════════════════
const cas = [];
const sanP = sanctions.filter((e) => e.type === "individu" && e.statut === "ACTIF");
const sanE = sanctions.filter((e) => e.type === "entite");
const dob1 = (e) => e.dates_naissance[0];

sanP.slice(0, 15).forEach((e) => cas.push({ id: "G-EXACT-" + e.uid,
  requete: { nom: e.nom_complet, dob: dob1(e) }, attendu: e.uid,
  categorie: "exact", pourquoi: "nom et date identiques" }));

sanP.filter((e) => e.alias.some((a) => a.type === "AKA" && a.qualite === "strong")).slice(0, 12).forEach((e) => {
  const a = e.alias.find((x) => x.type === "AKA" && x.qualite === "strong");
  cas.push({ id: "G-ALIAS-" + e.uid, requete: { nom: a.nom, dob: dob1(e) }, attendu: e.uid,
    categorie: "alias_connu", pourquoi: "alias listé — le moteur n'a qu'à le lire" });
});

sanP.filter((e) => VARIANTES_HORS_LISTE[e.prenom]).slice(0, 20).forEach((e) => {
  const v = VARIANTES_HORS_LISTE[e.prenom];
  if (e.alias.some((a) => a.nom.toLowerCase().includes(v.toLowerCase()))) return;
  const nom = e.ordre === "nom_prenom" ? `${e.nom_famille} ${v}` : `${v} ${e.nom_famille}`;
  cas.push({ id: "G-TRANSLIT-" + e.uid, requete: { nom, dob: dob1(e) }, attendu: e.uid,
    categorie: "translitteration_hors_liste", pourquoi: `« ${v} » n'est dans aucun alias : à déduire` });
});

sanP.slice(15, 27).forEach((e) => cas.push({ id: "G-ORDRE-" + e.uid,
  requete: { nom: e.ordre === "nom_prenom" ? `${e.nom_famille} ${e.prenom}` : `${e.prenom} ${e.nom_famille}`, dob: dob1(e) },
  attendu: e.uid, categorie: "ordre_nom", pourquoi: "nom et prénom inversés" }));

sanP.slice(27, 39).forEach((e) => {
  const n2 = e.nom_complet, p = Math.floor(n2.length / 2);
  cas.push({ id: "G-TYPO-" + e.uid, requete: { nom: n2.slice(0, p) + n2.slice(p + 1), dob: dob1(e) },
    attendu: e.uid, categorie: "typo", pourquoi: "une lettre manquante" });
});

sanP.filter((e) => /[éèüïöñ]/i.test(e.nom_complet)).slice(0, 8).forEach((e) => cas.push({
  id: "G-DIACRIT-" + e.uid,
  requete: { nom: e.nom_complet.normalize("NFD").replace(/[\u0300-\u036f]/g, ""), dob: dob1(e) },
  attendu: e.uid, categorie: "diacritiques", pourquoi: "accents retirés" }));

// ── Les cas qui ne doivent PAS matcher : la moitié qui compte ──
sanP.slice(0, 18).forEach((e) => {
  const an = parseInt(dob1(e).slice(0, 4)) + 22;
  cas.push({ id: "G-HOMONYME-" + e.uid, requete: { nom: e.nom_complet, dob: `${an}${dob1(e).slice(4)}` },
    attendu: null, categorie: "homonyme", pourquoi: "même nom, date incompatible → faux positif à écarter" });
});
sanP.slice(40, 48).forEach((e) => cas.push({
  id: "G-PROCHE-" + e.uid, requete: { nom: `${pick(N[e.aire_culturelle].pre)} ${e.nom_famille}`, dob: dateAlea(1950, 1990) },
  attendu: null, categorie: "proche_non_liste", pourquoi: "même nom de famille, autre personne" }));

sanE.slice(0, 12).forEach((e) => cas.push({ id: "G-ENTITE-" + e.uid,
  requete: { nom: e.nom_complet + " SA", est_entite: true }, attendu: e.uid,
  categorie: "entite_forme", pourquoi: "même entité, suffixe juridique différent" }));

["Jean Dupont", "Marie Martin", "Pierre Weber", "Anna Meier", "Luca Rossi",
 "Sofia Fontana", "Thomas Blanc", "Elena Keller", "Marc Girard", "Nadia Baumann"].forEach((n2, i) => cas.push({
  id: "G-NEUTRE-" + i, requete: { nom: n2, dob: `197${i % 10}-0${(i % 9) + 1}-1${i % 9}` },
  attendu: null, categorie: "client_ordinaire", pourquoi: "aucun rapport avec la liste" }));

// ══════════════════════════════════════════════════════════════════════
// Écriture
// ══════════════════════════════════════════════════════════════════════
const AVERT = "DONNÉES SYNTHÉTIQUES — aucune personne réelle, aucune donnée sous licence. Dev/test uniquement.";
const meta = { _avertissement: AVERT, version: "2026-07-15", graine: 20260715 };

writeFileSync(join(DIR, "sanctions-synth.json"), JSON.stringify({
  ...meta, source: "SYNTH-SANCTIONS",
  structure_inspiree_de: "feeds commerciaux (Dow Jones R&C / World-Check / ComplyAdvantage) — structure seulement",
  nb: sanctions.length + sco.length,
  repartition: { individus: sanctions.filter(e=>e.type==="individu").length, entites: sanctions.filter(e=>e.type==="entite").length,
                 navires: sanctions.filter(e=>e.type==="navire").length, sco: sco.length,
                 radiees: sanctions.filter(e=>e.statut==="RADIE").length },
  entries: [...sanctions, ...sco],
}, null, 1));

writeFileSync(join(DIR, "pep-synth.json"), JSON.stringify({
  ...meta, source: "SYNTH-PEP",
  nb: peps.length + rcas.length + sips.length,
  repartition: { pep: peps.length, rca: rcas.length, sip: sips.length,
                 pep_actuels: peps.filter(p=>p.statut==="ACTUEL").length, pep_anciens: peps.filter(p=>p.statut==="ANCIEN").length },
  categories_occupation: OCCUPATIONS.length,
  entries: [...peps, ...rcas, ...sips],
}, null, 1));

writeFileSync(join(DIR, "clients-synth.json"), JSON.stringify({
  ...meta, source: "SYNTH-CLIENTS", nb: clients.length,
  hits_plantes: hitsPlantes.length,
  verite_terrain: hitsPlantes,
  clients,
}, null, 1));

writeFileSync(join(DIR, "golden-set.json"), JSON.stringify({
  ...meta, liste: "sanctions-synth.json@2026-07-15", nb: cas.length,
  repartition: cas.reduce((a, c) => { a[c.categorie] = (a[c.categorie] || 0) + 1; return a; }, {}),
  doivent_matcher: cas.filter((c) => c.attendu).length,
  doivent_pas_matcher: cas.filter((c) => !c.attendu).length,
  cas,
}, null, 1));

console.log(`golden-set.json      : ${cas.length} cas — ${cas.filter(c=>c.attendu).length} doivent matcher, ${cas.filter(c=>!c.attendu).length} non`);
console.log(`sanctions-synth.json : ${sanctions.length + sco.length} entrées ` +
  `(${sanctions.filter(e=>e.type==="individu").length} personnes, ${sanctions.filter(e=>e.type==="entite").length} entités, ` +
  `${sanctions.filter(e=>e.type==="navire").length} navires, ${sco.length} SCO, ${sanctions.filter(e=>e.statut==="RADIE").length} radiées)`);
console.log(`pep-synth.json       : ${peps.length} PEP + ${rcas.length} RCA + ${sips.length} SIP — ${OCCUPATIONS.length} catégories d'occupation`);
console.log(`clients-synth.json   : ${clients.length} clients — ${hitsPlantes.length} hits plantés ` +
  `(${hitsPlantes.filter(h=>h.uid).length} vrais, ${hitsPlantes.filter(h=>!h.uid).length} quasi-homonymes)`);
