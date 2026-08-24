import React, { useCallback, useRef, useState } from "react";
import { P } from "../../theme/palette";

// ─── Concepteur de workflow VISUEL (drag & drop) — port fidèle de la maquette ────────────────
// Palette de nœuds à gauche · canevas SVG (grille + nœuds déplaçables + arêtes fléchées) · éditeur
// de nœud. Zéro runtime : produit une DÉFINITION (étapes/transitions) que le Builder gouverné
// enregistre en brouillon (R304-R308). onSave reçoit le `contenu` sérialisé.

type NType = "start" | "step" | "end" | "decision" | "merge";
type Node = { id: string; type: NType; label: string; role: string | null; x: number; y: number };
type Edge = { from: string; to: string };

const NODE_STYLE: Record<NType, { bg: string; border: string }> = {
  start: { bg: P.olive700, border: P.olive900 }, end: { bg: P.ink, border: P.ink },
  step: { bg: P.surface, border: P.line }, decision: { bg: P.amberSoft, border: P.amber },
  merge: { bg: P.sage, border: P.olive600 },
};
const ROLE_COLORS: Record<string, string> = {
  ARM: P.olive600, CO: P.amber, CO_SR: P.amber, AML: P.red, BRM: P.olive700,
  CF: P.violet, HPB: P.gold, CEO: P.gold, DIR: P.gold, ESG: P.green, LEGAL: P.blue, "Système": P.inkSoft,
};
const ROLES = ["ARM", "CO", "CO_SR", "AML", "BRM", "CF", "HPB", "CEO", "ESG", "LEGAL", "DIR", "Système"];
const TYPES: NType[] = ["step", "decision", "merge", "start", "end"];
const W = 600, H = 800;

export function WorkflowCanvas({ onSave }: { onSave?: (contenu: unknown) => void }) {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "start", type: "start", label: "Début", role: null, x: 300, y: 60 },
    { id: "s1", type: "step", label: "Étape 1", role: "ARM", x: 300, y: 200 },
    { id: "end", type: "end", label: "Fin", role: null, x: 300, y: 360 },
  ]);
  const [edges, setEdges] = useState<Edge[]>([{ from: "start", to: "s1" }, { from: "s1", to: "end" }]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<Node | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nextId = useRef(9);

  const addNode = (type: NType) => {
    const id = `n${++nextId.current}`;
    const label = type === "step" ? "Nouvelle étape" : type === "decision" ? "Décision ?" : type;
    setNodes(p => [...p, { id, type, label, role: type === "step" ? "ARM" : null, x: 300, y: 320 + p.length * 24 }]);
  };
  const onMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    setNodes(p => p.map(n => n.id === dragging ? { ...n, x, y } : n));
  }, [dragging]);
  const connectEdge = (toId: string) => {
    if (connecting && connecting !== toId && !edges.find(e => e.from === connecting && e.to === toId))
      setEdges(p => [...p, { from: connecting, to: toId }]);
    setConnecting(null);
  };
  const deleteSelected = () => {
    if (!selected) return;
    setNodes(p => p.filter(n => n.id !== selected));
    setEdges(p => p.filter(e => e.from !== selected && e.to !== selected));
    setSelected(null);
  };
  // Sérialise le canevas → définition de workflow (étapes/owner/transitions + terminaux).
  const serialiser = () => {
    const etapes = nodes.filter(n => n.type === "step" || n.type === "decision").map(n => ({
      code: n.id, label: n.label, owner: n.role ?? undefined,
      transitions: edges.filter(e => e.from === n.id).map(e => e.to),
    }));
    const terminaux = nodes.filter(n => n.type === "end").map(n => n.id);
    return { etapes, terminaux };
  };

  const dot = { fontSize: 10, color: P.olive700, textTransform: "uppercase" as const, letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 };
  const paletteBtn = { display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: `1px solid ${P.line}`, background: P.cream, cursor: "pointer", fontSize: 12, fontWeight: 600, color: P.ink, textAlign: "left" as const };

  const renderNode = (n: Node) => {
    const st = NODE_STYLE[n.type], isSel = selected === n.id;
    const down = (e: React.MouseEvent) => { e.stopPropagation(); setDragging(n.id); setSelected(n.id); };
    const up = () => { setDragging(null); connectEdge(n.id); };
    if (n.type === "start" || n.type === "end")
      return <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "move" }} onMouseDown={down} onMouseUp={up}>
        <circle r={22} fill={st.bg} stroke={isSel ? P.gold : st.border} strokeWidth={isSel ? 3 : 2} />
        <text textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700} fill="#fff">{n.type === "start" ? "START" : "END"}</text></g>;
    if (n.type === "decision")
      return <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "move" }} onMouseDown={down} onMouseUp={up}>
        <polygon points="0,-36 36,0 0,36 -36,0" fill={P.amberSoft} stroke={isSel ? P.gold : P.amber} strokeWidth={isSel ? 3 : 1.5} />
        <text textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill={P.ink}>?</text></g>;
    if (n.type === "merge")
      return <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: "move" }} onMouseDown={down} onMouseUp={up}>
        <circle r={12} fill={P.sage} stroke={isSel ? P.gold : P.olive600} strokeWidth={1.5} /></g>;
    const w = 130, h = 44, rc = ROLE_COLORS[n.role ?? ""] ?? P.inkSoft;
    return <g key={n.id} transform={`translate(${n.x - w / 2},${n.y - h / 2})`} style={{ cursor: "move" }}
      onMouseDown={down} onMouseUp={up} onDoubleClick={() => setEditNode(n)}>
      <rect width={w} height={h} rx={8} fill={P.surface} stroke={isSel ? P.gold : P.olive600} strokeWidth={isSel ? 2.5 : 1.5} />
      <ellipse cx={w - 12} cy={10} rx={6} ry={3.5} fill={rc} opacity={0.85} transform={`rotate(-40,${w - 12},10)`} />
      <text x={w / 2} y={22} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight={600} fill={P.ink}>{n.label}</text>
      {n.role && <text x={w / 2} y={35} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fontWeight={700} fill={rc} letterSpacing={0.5}>{n.role}</text>}</g>;
  };
  const renderEdge = (e: Edge, i: number) => {
    const f = nodes.find(n => n.id === e.from), t = nodes.find(n => n.id === e.to);
    if (!f || !t) return null;
    const d = `M ${f.x} ${f.y + 24} C ${f.x} ${(f.y + t.y) / 2}, ${t.x} ${(f.y + t.y) / 2}, ${t.x} ${t.y - 24}`;
    return <path key={`e${i}`} d={d} fill="none" stroke={P.sage} strokeWidth={1.8} markerEnd="url(#barrow)" />;
  };

  return <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
    {/* palette + actions */}
    <div style={{ width: 168, flexShrink: 0, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={dot}>Ajouter</div>
      {TYPES.map(type => <button key={type} onClick={() => addNode(type)} style={paletteBtn}>
        <span style={{ width: 16, height: 16, flexShrink: 0, borderRadius: type === "step" ? 4 : "50%", background: NODE_STYLE[type].bg, border: `1.5px solid ${NODE_STYLE[type].border}` }} />
        {type.charAt(0).toUpperCase() + type.slice(1)}</button>)}
      <div style={{ height: 1, background: P.line, margin: "4px 0" }} />
      <div style={dot}>Actions</div>
      <button onClick={() => setConnecting(selected)} disabled={!selected} style={{ ...paletteBtn, borderColor: connecting ? P.gold : P.line, opacity: selected ? 1 : 0.5 }}>↳ Relier depuis</button>
      <button onClick={deleteSelected} disabled={!selected} style={{ ...paletteBtn, color: selected ? P.red : P.inkSoft, opacity: selected ? 1 : 0.5 }}>🗑 Supprimer</button>
      <button onClick={() => onSave?.(serialiser())} style={{ padding: "9px 10px", borderRadius: 8, border: "none", background: P.olive600, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓ Enregistrer le brouillon</button>
      {selected && nodes.find(n => n.id === selected)?.type === "step" && (
        <div style={{ marginTop: 6, padding: 10, background: P.oliveSoft, borderRadius: 9, border: `1px solid ${P.line}` }}>
          <div style={{ ...dot, marginBottom: 6 }}>Rôle</div>
          <select value={nodes.find(n => n.id === selected)?.role ?? ""} onChange={e => setNodes(p => p.map(n => n.id === selected ? { ...n, role: e.target.value } : n))} style={{ width: "100%" }}>
            <option value="">Aucun</option>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
        </div>)}
    </div>
    {/* canevas */}
    <div style={{ flex: 1, minWidth: 0, background: P.cream, border: `1px solid ${P.line}`, borderRadius: 12, overflow: "hidden", position: "relative" }}>
      {connecting && <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", background: P.amberSoft, border: `1px solid ${P.amber}`, borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 600, color: P.ink, zIndex: 2 }}>Cliquez le nœud cible…</div>}
      <svg ref={svgRef} width="100%" height={520} viewBox={`0 0 ${W} ${H}`} style={{ cursor: dragging ? "grabbing" : "default" }} onMouseMove={onMove} onMouseUp={() => setDragging(null)} onMouseDown={() => setSelected(null)}>
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke={P.line} strokeWidth="0.5" /></pattern>
          <marker id="barrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={P.sage} /></marker>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {edges.map(renderEdge)}
        {nodes.map(renderNode)}
      </svg>
      <div style={{ position: "absolute", bottom: 8, right: 12, fontSize: 10, color: P.inkSoft }}>Double-clic sur une étape pour éditer · glisser pour déplacer</div>
    </div>
    {/* éditeur de nœud */}
    {editNode && <div style={{ width: 190, flexShrink: 0, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: P.olive700, marginBottom: 12 }}>Éditer le nœud</div>
      <div style={{ ...dot, fontSize: 9 }}>Libellé</div>
      <input value={editNode.label} onChange={e => setEditNode({ ...editNode, label: e.target.value })} style={{ width: "100%", marginBottom: 10 }} />
      <div style={{ ...dot, fontSize: 9 }}>Rôle</div>
      <select value={editNode.role ?? ""} onChange={e => setEditNode({ ...editNode, role: e.target.value })} style={{ width: "100%", marginBottom: 12 }}>
        <option value="">Aucun</option>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
      <button onClick={() => { setNodes(p => p.map(n => n.id === editNode.id ? editNode : n)); setEditNode(null); }} style={{ width: "100%", padding: 8, borderRadius: 7, border: "none", background: P.olive600, color: "#fff", fontWeight: 700, cursor: "pointer" }}>✓ Enregistrer</button>
    </div>}
  </div>;
}
