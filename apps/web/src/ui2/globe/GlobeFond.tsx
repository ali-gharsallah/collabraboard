import React, { useEffect, useRef } from "react";
import { geoOrthographic, geoPath, geoGraticule10, geoInterpolate, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import topo from "./countries-110m.json";
import { CITY, FLOWS, COLOR, RISK_TIERS, RISK_BY_COUNTRY, type Flux } from "./flux-data";

/**
 * UI v2 — LE GLOBE, canvas seul (V2-M19, refondu V2-M22).
 *
 * Port React de la maquette du designer (`docs/design/design_handoff_olive_ui_v2/globe-flux.html`) :
 * projection, interaction et boucle de rendu REPRISES VERBATIM. Ce module ne contient QUE le
 * dessin — les données vivent dans `flux-data.ts`, l'habillage dans `FluxPanneau.tsx`.
 *
 * POURQUOI CETTE SÉPARATION : le globe est le FOND de l'onglet Transactions, la table se lit
 * par-dessus. Elle ne doit pas attendre le chargement de d3 et de l'atlas mondial (~52 kB gz).
 * Seul CE fichier est paresseux ; la substance de l'écran part avec lui.
 *
 * ON-PREMISE (doctrine des polices, V2-M12) : d3, topojson et l'atlas sont dans le bundle —
 * la maquette les chargeait depuis trois CDN. AUCUN appel sortant.
 *
 * CE QUE LE GLOBE DIT, ET NE DIT PAS : il montre des volumes et des statuts déjà qualifiés
 * ailleurs. Il ne qualifie rien, ne lève aucune alerte, ne décide d'aucun blocage (R44).
 */
export function GlobeFond({ hauteur = 560, focus }: { hauteur?: number; focus: Flux | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoteRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<Flux | null>(null);
  focusRef.current = focus;

  useEffect(() => {
    const canvas = canvasRef.current, hote = hoteRef.current;
    if (!canvas || !hote) return;
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
      const r = hote.getBoundingClientRect();
      W = Math.max(240, r.width); H = Math.max(320, r.height || hauteur);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // DEMI-GLOBE (V2-M23) : le globe est plus large que la scène et son centre est REMONTÉ,
      // si bien qu'on n'en voit que la calotte supérieure — une coupole qui occupe le haut de
      // l'écran. Le bas de la sphère passe derrière les transactions, qui sont translucides :
      // la carte continue sous elles au lieu d'être masquée.
      // Le rayon est borné par la LARGEUR et par la hauteur du centre : si la sphère déborde
      // des deux côtés ET par le haut, on ne voit plus qu'une carte plate — c'est la courbure
      // qui fait la coupole. Centre bas, arc supérieur dans le cadre.
      // V2-M26 : la coupole REMONTE — sa ligne de diamètre est à 58 % de la hauteur, et le
      // rayon est borné par cette hauteur pour que l'arc entier tienne dans le haut du cadre.
      // Le bas de la scène se libère : les transactions y descendent, à plat sur la page.
      const cy = H * 0.46;
      R = Math.min(W / 2.15, cy - 14) * zoom;
      projection.scale(R).translate([W / 2, cy]);
    };
    resize();

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
    const ro = new ResizeObserver(resize); ro.observe(hote);

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

    // L'animation des têtes de flux est une INDICATION DE SENS, pas une donnée : elle se coupe
    // si le système demande de réduire les animations, et le globe reste lisible.
    const sobre = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let brut = 0, arret = false;

    const dessiner = (ms: number) => {
      const temps = sobre ? 0 : ms / 1000;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2;
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.18);
      halo.addColorStop(0, "rgba(124,160,66,0.13)");
      halo.addColorStop(1, "rgba(124,160,66,0)");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, 2 * Math.PI); ctx.fill();

      // Océan : un ton au-dessus de la page — le globe est le fond, il ne doit pas trancher.
      ctx.beginPath(); chemin({ type: "Sphere" } as any); ctx.fillStyle = "#EDF1E5"; ctx.fill();
      ctx.beginPath(); chemin(graticule as any);
      ctx.strokeStyle = "#DEE4D2"; ctx.lineWidth = 0.6; ctx.stroke();

      for (const palier of RISK_TIERS) {
        const feats = parPalier[palier.id];
        if (!feats?.length) continue;
        ctx.beginPath(); chemin({ type: "FeatureCollection", features: feats } as any);
        ctx.fillStyle = palier.fill; ctx.fill();
        ctx.strokeStyle = palier.stroke; ctx.lineWidth = 0.5; ctx.stroke();
      }
      ctx.beginPath(); chemin(frontieres as any);
      ctx.strokeStyle = "#C8D1B8"; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath(); chemin({ type: "Sphere" } as any);
      ctx.strokeStyle = "rgba(120,136,96,0.45)"; ctx.lineWidth = 1.1; ctx.stroke();

      const vu = focusRef.current;
      for (const p of prepares) {
        const attenue = vu && vu !== p.f;
        const col = COLOR[p.f.s];
        const w = 0.8 + Math.min(2.2, p.f.v / 190);
        trace(p.pts, col, w * 0.75, attenue ? 0.08 : 0.30);
        if (!sobre) {
          const tete = ((temps * p.vitesse) + p.offset) % 1;
          const queue = Math.max(0, tete - 0.30);
          const seg = p.pts.slice(Math.floor(queue * 96), Math.ceil(tete * 96) + 1);
          trace(seg, col, w * 1.4, attenue ? 0.14 : 0.9);
        }
        for (const ville of [CITY[p.f.a].c, CITY[p.f.b].c]) {
          if (!visible(ville)) continue;
          const xy = projection(ville);
          if (!xy) continue;
          ctx.beginPath(); ctx.arc(xy[0], xy[1], attenue ? 1.6 : 2.4, 0, 2 * Math.PI);
          ctx.fillStyle = col; ctx.globalAlpha = attenue ? 0.3 : 0.9; ctx.fill(); ctx.globalAlpha = 1;
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

  return (
    <div ref={hoteRef} style={{ position: "absolute", inset: 0, display: "grid",
      placeItems: "center", overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", cursor: "grab", touchAction: "none" }} />
    </div>);
}

export default GlobeFond;
