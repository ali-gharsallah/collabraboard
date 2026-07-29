// Point de montage DEV-ONLY pour le harnais de parité (spec §8) — sert à comparer
// l'écran par capture d'écran contre docs/reference/olive-demo.html. N'est PAS un
// point d'entrée de build de production : l'app gouvernée (index.html) reste intacte.
import React from "react";
import { createRoot } from "react-dom/client";
import { LoginScreen } from "./LoginScreen";

createRoot(document.getElementById("root")!).render(<LoginScreen />);
