// Source : docs/reference/olive-demo.html — enrichissements globaux exécutés au démarrage de la
// maquette (IIFE top-level), AVANT tout rendu d'écran. Rejoués une seule fois ici (garde idempotente)
// pour rester iso-fonctionnel : la maquette mute CLIENTS en place au chargement, tous les écrans en
// héritent. `aumMOf` (30008) est aussi exposé ici (parseur AUM partagé).
import CLIENTS from "../fixtures/CLIENTS.json";
import { amlHash } from "./preonboarding-support";

export function aumMOf(c: any) {
  const str = String(c.aum || "0");
  const m = str.match(/([\d.]+)\s*(k|K|Md|MD|B|b)?/);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  if (m[2] && /k/i.test(m[2])) return v / 1000;
  if (m[2] && /(md|b)/i.test(m[2])) return v * 1000;
  return v; // défaut : millions CHF
}

// -- exoticOverlay (21358) : ~12% des clients reçoivent un secteur exotique (art, crypto, casinos…),
//    passent LOW→MEDIUM et sont tagués SECTEUR-EXOTIQUE. Verbatim, idempotent. --
let __exoticDone = false;
export function runExoticOverlay() {
  if (__exoticDone) return;
  __exoticDone = true;
  const EXOTICS = [["Négoce d'art & galeries", "🎨"], ["Crypto-actifs & exchanges", "₿"], ["Casinos & gaming", "🎰"], ["Courtage de yachts", "⛵"], ["Aviation privée", "🛩"], ["Négoce de matières premières", "🛢"], ["Pierres précieuses & diamants", "💎"], ["Football professionnel & transferts", "⚽"], ["Vins fins & spiritueux de collection", "🍷"], ["Antiquités & archéologie", "🏺"]];
  let n = 0;
  (CLIENTS as any[]).forEach(function (c) {
    if (n >= EXOTICS.length) return;
    if (amlHash(c.id + "EXO", 100) < 12) {
      const ex = EXOTICS[n++];
      c.sector = ex[0];
      c.exotic = true;
      c.exoticIcon = ex[1];
      if (c.risk === "LOW") c.risk = "MEDIUM";
      c.tags = (c.tags || []).concat(["SECTEUR-EXOTIQUE"]);
    }
  });
}

// Exécuté à l'import (comme l'IIFE de la maquette).
runExoticOverlay();
