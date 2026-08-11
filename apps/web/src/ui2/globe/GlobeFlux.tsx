import React, { useEffect, useRef, useState } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoInterpolate, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import topo from "./countries-110m.json";
import { traduire, langue } from "../../lib/i18n";

/**
 * UI v2 — GLOBE DES FLUX (V2-M19). Port React de la maquette du designer
 * (`docs/design/design_handoff_olive_ui_v2/globe-flux.html`) : données de flux, palette,
 * paliers de risque pays et boucle de rendu REPRISES VERBATIM — seule l'enveloppe change
 * (canvas piloté par React, dépendances vendorisées, i18n).
 *
 * ON-PREMISE (même doctrine que les polices, V2-M12) : la maquette chargeait d3, topojson et
 * l'atlas mondial depuis trois CDN. Ici les trois sont dans le bundle — AUCUN appel sortant.
 * L'atlas est réduit à son objet `countries` (l'objet `land` était redondant).
 *
 * BUDGET : ce module pèse ~55 kB gz (atlas 37 + d3-geo + topojson). Il est chargé PARESSEUSEMENT
 * à l'ouverture de l'onglet Transactions et EXCLU du budget cœur, au même titre que les packs de
 * langue — le chargement initial ne le paie pas (cf. verifier-budget-bundle.js).
 *
 * CE QUE LE GLOBE DIT, ET CE QU'IL NE DIT PAS : il montre des VOLUMES et des STATUTS de flux
 * déjà qualifiés ailleurs. Il ne qualifie rien lui-même, ne lève aucune alerte et ne décide
 * d'aucun blocage (R44) — c'est une vue, pas un moteur.
 */

type Statut = "ok" | "watch" | "alert";
type Flux = { a: string; b: string; v: number; n: number; s: Statut };

const CITY: Record<string, { name: string; c: [number, number] }> = {
  zurich: { name: "Zurich", c: [8.54, 47.37] }, geneve: { name: "Genève", c: [6.14, 46.20] },
  londres: { name: "Londres", c: [-0.13, 51.51] }, luxembourg: { name: "Luxembourg", c: [6.13, 49.61] },
  francfort: { name: "Francfort", c: [8.68, 50.11] }, jersey: { name: "Jersey", c: [-2.10, 49.21] },
  newyork: { name: "New York", c: [-74.01, 40.71] }, panama: { name: "Panama", c: [-79.52, 8.98] },
  saopaulo: { name: "São Paulo", c: [-46.63, -23.55] }, dubai: { name: "Dubaï", c: [55.27, 25.20] },
  riyad: { name: "Riyad", c: [46.72, 24.71] }, beyrouth: { name: "Beyrouth", c: [35.50, 33.89] },
  nairobi: { name: "Nairobi", c: [36.82, -1.29] }, mumbai: { name: "Mumbai", c: [72.88, 19.08] },
  singapour: { name: "Singapour", c: [103.82, 1.35] }, hongkong: { name: "Hong Kong", c: [114.17, 22.32] },
  tokyo: { name: "Tokyo", c: [139.69, 35.69] }, sydney: { name: "Sydney", c: [151.21, -33.87] },
};

// Statuts : ok = nominal · watch = sous surveillance · alert = alerte AML ouverte.
export const FLOWS: Flux[] = [
  { a: "zurich", b: "londres", v: 412, n: 1840, s: "ok" },
  { a: "geneve", b: "luxembourg", v: 388, n: 1210, s: "ok" },
  { a: "zurich", b: "francfort", v: 301, n: 1595, s: "ok" },
  { a: "geneve", b: "jersey", v: 274, n: 430, s: "watch" },
  { a: "zurich", b: "newyork", v: 268, n: 920, s: "ok" },
  { a: "geneve", b: "dubai", v: 233, n: 512, s: "watch" },
  { a: "zurich", b: "singapour", v: 219, n: 688, s: "ok" },
  { a: "geneve", b: "beyrouth", v: 141, n: 186, s: "alert" },
  { a: "zurich", b: "hongkong", v: 137, n: 474, s: "watch" },
  { a: "geneve", b: "panama", v: 118, n: 96, s: "alert" },
  { a: "zurich", b: "riyad", v: 112, n: 204, s: "watch" },
  { a: "geneve", b: "saopaulo", v: 96, n: 248, s: "ok" },
  { a: "zurich", b: "tokyo", v: 88, n: 361, s: "ok" },
  { a: "geneve", b: "nairobi", v: 74, n: 132, s: "alert" },
  { a: "zurich", b: "mumbai", v: 69, n: 277, s: "ok" },
  { a: "geneve", b: "sydney", v: 52, n: 164, s: "ok" },
];

const COLOR: Record<Statut, string> = { ok: "#A4C56B", watch: "#E3C75A", alert: "#E06B5A" };
const LABEL: Record<Statut, string> = { ok: "nominal", watch: "surveillance", alert: "alerte AML" };

// Paliers de risque pays — classification de DÉMONSTRATION inspirée des listes GAFI. Elle
// n'engage aucune position de la banque : la vraie matrice pays est une config gouvernée.
const RISK_TIERS = [
  { id: "critique", label: "Critique", fill: "#8E3B33", stroke: "#A8544B" },
  { id: "eleve", label: "Élevé", fill: "#7A5730", stroke: "#966C3C" },
  { id: "modere", label: "Modéré", fill: "#4A5361", stroke: "#5A6472" },
  { id: "faible", label: "Faible", fill: "#333B46", stroke: "#414A57" },
];
const RISK_BY_COUNTRY: Record<string, string> = {};
const assign = (tier: string, noms: string[]) => noms.forEach((n) => { RISK_BY_COUNTRY[n] = tier; });
assign("critique", ["Iran", "North Korea", "Myanmar", "Syria", "Afghanistan", "Yemen", "Somalia",
  "Libya", "Sudan", "South Sudan", "Venezuela", "Belarus", "Russia", "Haiti"]);
assign("eleve", ["Lebanon", "Panama", "Nigeria", "Mali", "Burkina Faso", "Niger", "Chad",
  "Democratic Republic of the Congo", "Cameroon", "Mozambique", "Tanzania", "Zimbabwe", "Angola",
  "Iraq", "Turkey", "Ukraine", "Kazakhstan", "Uzbekistan", "Turkmenistan", "Tajikistan",
  "Kyrgyzstan", "Pakistan", "Bangladesh", "Cambodia", "Laos", "Philippines", "Vietnam", "Nepal",
  "Guinea", "Sierra Leone", "Liberia", "Central African Republic", "Republic of the Congo",
  "Equatorial Guinea", "Eritrea", "Nicaragua", "Bolivia", "Paraguay", "Honduras", "Guatemala",
  "Algeria", "Egypt", "Jordan", "Azerbaijan", "Armenia", "Georgia", "Mongolia", "Papua New Guinea",
  "Madagascar", "Zambia", "Uganda", "Kenya", "Ethiopia", "Ghana", "Ivory Coast", "Senegal",
  "Benin", "Togo"]);
assign("faible", ["Switzerland", "Liechtenstein", "Germany", "France", "Austria", "Netherlands",
  "Belgium", "Luxembourg", "Denmark", "Norway", "Sweden", "Finland", "Iceland", "Ireland",
  "United Kingdom", "Spain", "Portugal", "Italy", "Czechia", "Slovakia", "Slovenia", "Poland",
  "Estonia", "Latvia", "Lithuania", "Canada", "United States of America", "Australia",
  "New Zealand", "Japan", "Singapore", "South Korea", "Chile", "Uruguay", "Israel", "Qatar",
  "Greece", "Hungary", "Croatia"]);

export function GlobeFlux({ hauteur = 440 }: { hauteur?: number }) {
  const t = traduire(langue());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<Flux | null>(null);
  const focusRef = useRef<Flux | null>(null);
  focusRef.current = focus;

  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const geo: any = topo;
    const pays = (feature(geo, geo.objects.countries) as any).features;
    const frontieres = mesh(geo, geo.objects.countries, (a: any, b: any) => a !== b);
    const parPalier: Record<string, any[]> = {};
    for (const f of pays) {
      const tier = RISK_BY_COUNTRY[(f.properties && f.properties.name) || ""] || "modere";
      (parPalier[tier] ??= []).push(f);
    }

    const projection = geoOrthographic().clipAngle(90).precision(0.3).rotate([-20, -25]);
    const chemin = geoPath(projection as any, ctx as any);
    const graticule = geoGraticule10();
    const rot: [number, number] = [-20, -25];
    let W = 0, H = 0, R = 0, zoom = 1;

    const resize = () => {
      const r = stage.getBoundingClientRect();
      W = Math.max(240, r.width); H = hauteur;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) / 2.35 * zoom;
      projection.scale(R).translate([W / 2, H / 2]);
    };
    resize();

    // ── Interaction : rotation à la souris/au doigt, zoom à la molette ──
    let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      rot[0] += (e.clientX - drag.x) * 0.28;
      rot[1] = Math.max(-89, Math.min(89, rot[1] - (e.clientY - drag.y) * 0.28));
      projection.rotate(rot); drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(0.75, Math.min(2.4, zoom * (e.deltaY < 0 ? 1.08 : 0.926)));
      resize();
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    const ro = new ResizeObserver(resize); ro.observe(stage);

    // ── Arcs : grand cercle échantillonné une fois ──
    const prepares = FLOWS.map((f, i) => {
      const interp = geoInterpolate(CITY[f.a].c, CITY[f.b].c);
      const pts: [number, number][] = [];
      for (let k = 0; k <= 96; k++) pts.push(interp(k / 96) as [number, number]);
      return { f, pts, offset: (i * 0.137) % 1, vitesse: 0.055 + f.v / 12000 };
    });
    const trace = (coords: [number, number][], couleur: string, largeur: number, alpha: number) => {
      if (coords.length < 2) return;
      ctx.beginPath(); chemin({ type: "LineString", coordinates: coords } as any);
      ctx.globalAlpha = alpha; ctx.strokeStyle = couleur; ctx.lineWidth = largeur;
      ctx.lineCap = "round"; ctx.stroke(); ctx.globalAlpha = 1;
    };
    const visible = (p: [number, number]) => {
      const r = projection.rotate();
      return geoDistance(p, [-r[0], -r[1]]) < Math.PI / 2;
    };

    // L'animation des têtes de flux est une INDICATION DE SENS, pas une donnée. Elle se coupe
    // si le système demande de réduire les animations — le globe reste lisible sans elle.
    const sobre = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let brut = 0, arret = false;

    const dessiner = (ms: number) => {
      const temps = sobre ? 0 : ms / 1000;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
      halo.addColorStop(0, "rgba(156,193,103,0.16)");
      halo.addColorStop(1, "rgba(156,193,103,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, 2 * Math.PI); ctx.fill();

      ctx.beginPath(); chemin({ type: "Sphere" } as any); ctx.fillStyle = "#171D24"; ctx.fill();
      ctx.beginPath(); chemin(graticule as any); ctx.strokeStyle = "#252D37"; ctx.lineWidth = 0.6; ctx.stroke();

      for (const palier of RISK_TIERS) {
        const feats = parPalier[palier.id];
        if (!feats?.length) continue;
        ctx.beginPath(); chemin({ type: "FeatureCollection", features: feats } as any);
        ctx.fillStyle = palier.fill; ctx.fill();
        ctx.strokeStyle = palier.stroke; ctx.lineWidth = 0.5; ctx.stroke();
      }
      ctx.beginPath(); chemin(frontieres as any);
      ctx.strokeStyle = "#20272F"; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath(); chemin({ type: "Sphere" } as any);
      ctx.strokeStyle = "rgba(190,202,216,0.42)"; ctx.lineWidth = 1.1; ctx.stroke();

      const vu = focusRef.current;
      for (const p of prepares) {
        const attenue = vu && vu !== p.f;
        const col = COLOR[p.f.s];
        const w = 0.8 + Math.min(2.2, p.f.v / 190);
        trace(p.pts, col, w * 0.75, attenue ? 0.1 : 0.34);
        if (!sobre) {
          const tete = ((temps * p.vitesse) + p.offset) % 1;
          const queue = Math.max(0, tete - 0.30);
          const seg = p.pts.slice(Math.floor(queue * 96), Math.ceil(tete * 96) + 1);
          ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = attenue ? 0 : 12;
          trace(seg, col, w * 1.5, attenue ? 0.18 : 1); ctx.restore();
        }
        for (const ville of [CITY[p.f.a].c, CITY[p.f.b].c]) {
          if (!visible(ville)) continue;
          const xy = projection(ville);
          if (!xy) continue;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], attenue ? 1.6 : 2.4, 0, 2 * Math.PI);
          ctx.fillStyle = col; ctx.globalAlpha = attenue ? 0.35 : 0.95; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      if (!arret) brut = requestAnimationFrame(dessiner);
    };
    brut = requestAnimationFrame(dessiner);

    return () => {
      arret = true; cancelAnimationFrame(brut); ro.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [hauteur]);

  const total = FLOWS.reduce((s, f) => s + f.v, 0);
  const alertes = FLOWS.filter((f) => f.s === "alert").length;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 14,
      alignItems: "start" }}>
      <div ref={stageRef} style={{ background: "#11161C", border: "1px solid var(--border)",
        borderRadius: "var(--r-card)", overflow: "hidden", position: "relative" }}>
        <canvas ref={canvasRef} style={{ display: "block", cursor: "grab", touchAction: "none" }}
          aria-label={t("Globe des flux transfrontaliers — faites glisser pour tourner")} />
        <div className="microlabel" style={{ position: "absolute", left: 12, bottom: 10,
          color: "rgba(190,202,216,0.65)" }}>
          {t("glisser pour tourner · molette pour zoomer")}</div>
      </div>
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
          {[[FLOWS.length, t("corridors")], [total.toLocaleString("fr-CH"), t("MCHF / mois")],
            [alertes, t("en alerte")]].map(([v, l]) => (
            <div key={String(l)} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "9px 11px" }}>
              <div className="mono" style={{ fontSize: 17, fontWeight: 500, color: "var(--text)" }}>{v}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{l}</div>
            </div>))}
        </div>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--r-card)", maxHeight: 330, overflowY: "auto" }}>
          {FLOWS.map((f) => (
            <button key={`${f.a}-${f.b}`} onClick={() => setFocus(focus === f ? null : f)}
              aria-pressed={focus === f}
              style={{ display: "block", width: "100%", textAlign: "left", font: "inherit",
                cursor: "pointer", border: "none", borderBottom: "1px solid var(--border-row)",
                background: focus === f ? "var(--bg-muted)" : "transparent", padding: "8px 12px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, flexShrink: 0,
                  background: COLOR[f.s] }} />
                <span style={{ fontSize: 12.5, color: "var(--text)" }}>
                  {CITY[f.a].name} → {CITY[f.b].name}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-body)" }}>
                  {f.v} MCHF</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginLeft: 15 }}>
                {f.n.toLocaleString("fr-CH")} {t("opérations")} · {t(LABEL[f.s])}</div>
            </button>))}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 9, lineHeight: 1.5 }}>
          {t("Le globe MONTRE des volumes et des statuts déjà qualifiés ailleurs. Il ne qualifie rien, ne lève aucune alerte et ne décide d'aucun blocage (R44). Les paliers de risque pays affichés sont une classification de démonstration — la matrice pays en vigueur est une configuration gouvernée.")}</div>
      </div>
    </div>);
}

export default GlobeFlux;
