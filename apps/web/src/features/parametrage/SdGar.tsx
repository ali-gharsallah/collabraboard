import React from "react";
import { ProfilsReview } from "./ProfilsReview";

// R283 — `sdgar` : profils de Grande Account Review (profil plus large, AUCUNE particularité
// de modèle). Une CONFIGURATION du composant commun.
export function SdGar() { return <ProfilsReview type="GAR" ecran="sdgar"/>; }
