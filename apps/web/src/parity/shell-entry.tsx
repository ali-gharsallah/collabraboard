import React from "react";
import { createRoot } from "react-dom/client";
import "./demo-init"; // enrichissements globaux au démarrage (exoticOverlay), comme la maquette
import { Shell } from "./Shell";
createRoot(document.getElementById("root")!).render(<Shell />);
