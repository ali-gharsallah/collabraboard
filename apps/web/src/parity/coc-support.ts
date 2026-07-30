// Source : docs/reference/olive-demo.html 21758-21806 — moteur de configuration CoC (porté verbatim).
// « Une seule vérité » : COC_CONFIG gouverne l'écran Change of Circumstances ET le signal CPSI (coc_sensible).
import COC_CONFIG_DEFAULT from "../fixtures/COC_CONFIG_DEFAULT.json";
import COC_TYPE_LABELS_JSON from "../fixtures/COC_TYPE_LABELS.json";
import COC_ROLES_JSON from "../fixtures/COC_ROLES.json";
import COC_DATA_JSON from "../fixtures/COC_DATA.json";
import TASKS_DATA from "../fixtures/TASKS_DATA.json";

// COC_TYPE_LABELS est muté par CocParamScreen (ajout de types) → objet mutable partagé.
export const COC_TYPE_LABELS: any = COC_TYPE_LABELS_JSON;
export const COC_ROLES: any[] = COC_ROLES_JSON as any[];
export const COC_DATA: any[] = COC_DATA_JSON as any[];

export const COC_ACT_LABEL: any = { ROLE: "Routage à un rôle", KYC: "Révision KYC proposée", TASK: "Créer une tâche" };
export const COC_ACTION_DONE: any = {}; // traitements de la file "Actions en attente" (clé coc|action → 1), tracés au PARAM_AUDIT
export const COC_CREATED_TASKS: any[] = TASKS_DATA as any[]; // "Créer une tâche" (CoC) pousse dans la liste Tâches (même référence que TASKS_DATA)
export const COC_CONFIG: any = Object.fromEntries(Object.entries(COC_CONFIG_DEFAULT as any).map(([k, v]: any) =>
  [k, Object.assign({}, v, { cpsiSev: v.materiality === "HIGH" ? 2 : (v.materiality === "MEDIUM" ? 1 : 0), actions: [v.action] })]));

export function cocActions(c: any) {
  if (c && c.actions && c.actions.length)
    return c.actions;
  var cfg = (typeof COC_CONFIG !== "undefined") && c && COC_CONFIG[c.type]; // actions par type (togglées au Paramétrage)
  if (cfg && cfg.actions && cfg.actions.length)
    return cfg.actions;
  return [(c && c.action) || "ROLE"];
}
export function cocPrimaryAction(acts: any[]) { return acts.indexOf("KYC") >= 0 ? "KYC" : (acts.indexOf("ROLE") >= 0 ? "ROLE" : acts[0]); }
