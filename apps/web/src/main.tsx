import React from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";                       // thème global olive (palette + typo + tableaux + champs)
import { Router } from "./app/router";
createRoot(document.getElementById("root")!).render(<Router/>);
