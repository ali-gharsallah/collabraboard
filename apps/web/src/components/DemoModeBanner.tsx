import React from "react";

// Bandeau unique « mode démonstration ». Affiché DÈS qu'un écran montre des données de seed
// (fallback déclenché) — jamais quand la donnée vient de l'API réelle. Une seule formulation,
// réutilisée partout (lectures ET écritures) pour qu'il n'y ait pas deux messages différents.
export const DEMO_MESSAGE = "⚠ Mode démonstration — données d'exemple (API non connectée)";

export function DemoModeBanner({ style }: { style?: React.CSSProperties }) {
  return <div role="status" style={{
    margin: "0 0 12px", padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: "#7a4b00", background: "#fdf3d8", border: "1px solid #e6c65c", ...style }}>
    {DEMO_MESSAGE}
  </div>;
}
