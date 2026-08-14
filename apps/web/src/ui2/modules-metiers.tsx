import React from "react";
import { Globe2, LayoutGrid, ArrowLeftRight, Landmark, ShieldAlert } from "lucide-react";
import { CAPACITES } from "./capacites";

/**
 * UI v2 — le bloc « Métiers » de la navigation (R320), en UN SEUL endroit.
 *
 * Pourquoi ce fichier : la liste des modules licenciés était recopiée à la main dans cinq
 * écrans (Ma journée, Dossier KYC, Surveillance, l'aperçu, et bientôt chaque vertical). Un
 * module ajouté dans quatre fichiers sur cinq disparaît d'un écran sur cinq — c'est
 * exactement la classe d'écart que le registre des capacités a été bâti pour éliminer.
 *
 * Le LIBELLÉ n'est pas écrit ici : il est lu dans `capacites.ts`, si bien que la nav ne peut
 * pas nommer un module autrement que le registre. Seuls l'icône et l'appartenance au jeu de
 * licences du tenant de démonstration vivent dans ce fichier.
 */

/** Jeu de licences du tenant de DÉMONSTRATION (R320). Un tenant réel le reçoit de sa licence
 *  signée ; ici il est déclaré une fois, pas déduit d'un écran. */
const DEMO: { destination: string; icon: React.ReactNode }[] = [
  { destination: "pms", icon: <LayoutGrid size={16} strokeWidth={1.75} /> },
  { destination: "fx", icon: <ArrowLeftRight size={16} strokeWidth={1.75} /> },
  { destination: "crossborder", icon: <Globe2 size={16} strokeWidth={1.75} /> },
  // V2-M50 : †CUSTODY entre au jeu de licences de la démonstration — son écran existe désormais.
  { destination: "custody", icon: <Landmark size={16} strokeWidth={1.75} /> },
  // V2-M52 : †OPRISK au jeu de licences de la démonstration — son écran existe désormais.
  { destination: "oprisk", icon: <ShieldAlert size={16} strokeWidth={1.75} /> },
];

const libelleDe = (destination: string) =>
  CAPACITES.find((c) => c.destination === destination)?.libelle ?? destination;

export const MODULES_METIERS_DEMO: { id: string; label: string; icon: React.ReactNode }[] =
  DEMO.map((m) => ({ id: m.destination, label: libelleDe(m.destination), icon: m.icon }));
