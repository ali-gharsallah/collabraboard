import React from "react";
import { createRoot } from "react-dom/client";
import { T } from "./tokens";
import { KycListScreen } from "./KycListScreen";
createRoot(document.getElementById("root")!).render(
  <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: T.cream, minHeight: "100vh", padding: "20px 26px", color: T.ink }}>
    <KycListScreen />
  </div>
);
