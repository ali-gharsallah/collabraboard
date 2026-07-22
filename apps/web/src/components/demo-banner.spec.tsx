import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DemoModeBanner, DEMO_MESSAGE } from "./DemoModeBanner";
import { apiGetSourced, isDemoMode } from "../lib/api";

// Test léger du SIGNAL de démo (on simule la couche réseau, jamais le métier) :
//   • le bandeau rend un texte visible ;
//   • source = seed (pas d'API, ou API en échec) ⇒ isDemo=true  ⇒ bandeau ;
//   • source = api (base + 200)                  ⇒ isDemo=false ⇒ aucun bandeau.
declare const process: { exit(n: number): void };
declare const global: { window?: unknown; fetch?: unknown; sessionStorage?: unknown };

let passed = 0, failed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; fails.push(m); } };

(async () => {
  global.sessionStorage = { getItem: () => null };

  // 1. le bandeau rend un texte visible
  const html = renderToStaticMarkup(React.createElement(DemoModeBanner));
  ok(html.includes("Mode démonstration"), "le bandeau rend le message");
  ok(DEMO_MESSAGE.length > 0, "message de démo non vide");

  // 2. pas d'API → seed, isDemo=true (bandeau visible)
  global.window = {};
  const r1 = await apiGetSourced<{ v: string }>("/v1/x", { v: "seed" });
  ok(r1.isDemo === true, "sans base → isDemo=true (seed)");
  ok(r1.data.v === "seed", "sans base → renvoie le seed");
  ok(isDemoMode() === true, "isDemoMode()=true sans base");

  // 3. API + 200 → api, isDemo=false (aucun bandeau)
  global.window = { OLIVE_API_URL: "http://api" };
  global.fetch = async () => ({ ok: true, json: async () => ({ v: "api" }) });
  const r2 = await apiGetSourced<{ v: string }>("/v1/x", { v: "seed" });
  ok(r2.isDemo === false, "avec base + 200 → isDemo=false (api)");
  ok(r2.data.v === "api", "avec base → renvoie l'API");
  ok(isDemoMode() === false, "isDemoMode()=false avec base");

  // 4. API en échec → seed, isDemo=true (bandeau visible)
  global.fetch = async () => { throw new Error("network"); };
  const r3 = await apiGetSourced<{ v: string }>("/v1/x", { v: "seed" });
  ok(r3.isDemo === true, "fetch échoue → isDemo=true (seed)");

  console.log(`\nDemoModeBanner (signal de démo) — ${passed}/${passed + failed} tests verts`);
  if (failed) { fails.forEach(f => console.log("✗ " + f)); process.exit(1); }
})();
