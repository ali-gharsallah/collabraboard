// Source : docs/reference/olive-demo.html 22616–22617 — styles partagés des écrans workflow.
import { T } from "./tokens";
export const wfCarte: any = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "16px 18px", marginBottom: 14 };
export const wfBouton = (bg: string): any => ({ background: bg, color: "#fff", border: "none", borderRadius: 7, padding: "7px 15px", fontSize: 13, cursor: "pointer" });
