// Entrée DEV-ONLY pour la capture de parité de ClientsScreen (§8). Hors build de prod.
import React from "react";
import { createRoot } from "react-dom/client";
import { T } from "./tokens";
import { ClientsScreen } from "./ClientsScreen";

createRoot(document.getElementById("root")!).render(
  <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: T.cream, minHeight: "100vh", padding: "20px 26px", color: T.ink }}>
    <ClientsScreen />
  </div>
);
