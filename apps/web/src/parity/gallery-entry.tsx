// Galerie DEV-ONLY du kit de composants partagés de parité — preuve de rendu
// (harnais §8). Hors build de production.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { T } from "./tokens";
import { SevPill, Badge, KpiCard, Donut, SectionTitle, ColsBtn, Modal, OliveInfo, Collapsible, KYC_STATUS_STYLE, KYC_STATUS_LABEL } from "./components";

function Gallery() {
  const [modal, setModal] = useState(false);
  const card: React.CSSProperties = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 20, marginBottom: 18 };
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: T.cream, minHeight: "100vh", padding: 28, color: T.ink }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>Kit de composants partagés — parité §4 / Annexe B</h1>

      <div style={card}>
        <SectionTitle right={<ColsBtn list="clients" />}>SectionTitle · SevPill · Badge</SectionTitle>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(s => <SevPill key={s} sev={s} />)}
          <Badge text="SA" color={T.olive700} bg={T.oliveSoft} />
          {Object.entries(KYC_STATUS_LABEL).map(([k, l]) => {
            const [c, bg] = KYC_STATUS_STYLE[k];
            return <span key={k} style={{ fontSize: 10, fontWeight: 700, color: c, background: bg, padding: "2px 8px", borderRadius: 20 }}>{l}</span>;
          })}
        </div>
      </div>

      <div style={card}>
        <SectionTitle>KpiCard (trend ↑/↓)</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          <KpiCard label="Clients référencés" value={60} sub="dont 6 UHNWI" color={T.olive600} icon="◑" />
          <KpiCard label="Approuvés" value={"55%"} sub="du total" trend={15} color={T.green} icon="✓" />
          <KpiCard label="Reviews en retard" value={3} sub="à traiter" trend={-8} color={T.red} icon="↻" />
          <KpiCard label="PEP identifiés" value={4} sub="diligence renforcée" color={T.gold} icon="◈" />
        </div>
      </div>

      <div style={{ ...card, display: "flex", gap: 30, alignItems: "center" }}>
        <div><div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>Donut 22 (LOW)</div><Donut value={22} size={120} /></div>
        <div><div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>Donut 44 (MED)</div><Donut value={44} size={120} /></div>
        <div><div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>Donut 72 (HIGH)</div><Donut value={72} size={120} /></div>
        <div><div style={{ fontSize: 11, color: T.inkSoft, marginBottom: 6 }}>petit (24)</div><Donut value={40} size={24} stroke={3} showLabel={false} /></div>
      </div>

      <div style={card}>
        <SectionTitle>OliveInfo (info rétractable) · Modal · Collapsible</SectionTitle>
        <OliveInfo titre="Principe du profilage continu (CPSI)" texte="Le score se recalcule à chaque événement : nouveau hit de screening, changement de circonstances, transaction à risque. Aucune donnée n'est fabriquée — la matière vient des moteurs." />
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 6 }}>
          <button onClick={() => setModal(true)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Ouvrir une modale</button>
          <Collapsible labelClosed="Détail des règles" labelOpen="Masquer le détail" variant="borde">
            <div style={{ fontSize: 11, color: T.inkMid }}>+20 corridor offshore · +15 PEP · +8 volume 30j</div>
          </Collapsible>
        </div>
        {modal && <Modal onClose={() => setModal(false)} width={440}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Modale standard (backdrop olive)</div>
          <div style={{ fontSize: 12.5, color: T.inkMid, lineHeight: 1.7 }}>Backdrop rgba(20,26,14,0.55), carte radius 14, bordure 1.5px, croix ✕ en haut à droite, clic backdrop = fermeture.</div>
        </Modal>}
      </div>
    </div>);
}

createRoot(document.getElementById("root")!).render(<Gallery />);
