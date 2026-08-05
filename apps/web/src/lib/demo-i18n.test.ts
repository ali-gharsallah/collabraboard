import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Localise demo/olive-demo.html en remontant depuis le cwd (robuste : cwd = apps/web ou racine repo).
function trouverDemo(): string {
  let d = process.cwd();
  for (let i = 0; i < 6; i++) {
    const p = path.join(d, "demo", "olive-demo.html");
    if (fs.existsSync(p)) return p;
    d = path.dirname(d);
  }
  throw new Error("demo/olive-demo.html introuvable");
}

// DEMO-I18N (SPEC-I18N §1) : on charge le VRAI runtime injecté dans demo/olive-demo.html (bloc entre
// les marqueurs OLIVE-I18N) dans un DOM jsdom de test, et on prouve la traduction du chrome, le RTL
// en AR, le repli FR et la restauration sans perte. Aucune donnée métier n'est traduite (chrome seul).
type OliveI18n = {
  tr: (s: string, lang: string) => string; setLang: (lang: string) => void;
  dict: Record<string, Record<string, string>>; langs: string[];
};
const i18n = (): OliveI18n => (window as unknown as { __oliveI18n: OliveI18n }).__oliveI18n;

describe("DEMO-I18N — runtime de traduction DOM de la maquette (SPEC-I18N §1)", () => {
  beforeAll(() => {
    const demo = fs.readFileSync(trouverDemo(), "utf8");
    const s = demo.indexOf("<!-- OLIVE-I18N:START");
    const e = demo.indexOf("<!-- OLIVE-I18N:END");
    if (s < 0 || e < 0) throw new Error("bloc runtime i18n absent — lancer node scripts/gen-demo-i18n.mjs");
    const block = demo.slice(s, e);
    const script = block.slice(block.indexOf("<script>") + 8, block.indexOf("</script>"));
    // Fixture : quelques libellés FR de chrome (= clés du dictionnaire) + une chaîne NON couverte.
    document.body.innerHTML =
      '<nav><a id="a-home">Accueil</a><a id="a-comp">Compliance & Risque</a>' +
      '<span id="a-ext">Profilage CPSI</span><span id="a-fam">Screening en flux</span>' +
      '<span id="a-uncov">Chaîne non couverte par le dico</span></nav>';
    // eslint-disable-next-line no-eval
    (0, eval)(script);   // le runtime s'amorce (boot) et applique FR par défaut
  });

  const txt = (id: string) => document.getElementById(id)!.textContent;

  it("le sélecteur FR/EN/DE/AR et l'API de test sont posés", () => {
    expect(i18n()).toBeTruthy();
    expect(i18n().langs).toEqual(["FR", "EN", "DE", "AR"]);
    expect(document.getElementById("olive-lang-bar")).toBeTruthy();
  });

  it("EN / DE : le chrome (nav + sous-nav éditeur) est traduit ; la donnée non couverte reste FR", () => {
    i18n().setLang("EN");
    expect(txt("a-home")).toBe("Home");
    expect(txt("a-comp")).toBe("Compliance & Risk");
    expect(txt("a-ext")).toBe("CPSI Profiling");
    expect(txt("a-uncov")).toBe("Chaîne non couverte par le dico");   // repli FR (jamais un trou)
    expect(document.documentElement.dir).toBe("ltr");

    i18n().setLang("DE");
    expect(txt("a-home")).toBe("Startseite");
    expect(txt("a-comp")).toBe("Compliance & Risiko");
  });

  it("AR : chrome traduit (nav + famille AML gap) + RTL automatique (dir=rtl, lang=ar)", () => {
    i18n().setLang("AR");
    expect(txt("a-home")).toBe("الرئيسية");
    expect(txt("a-ext")).toBe("تنميط CPSI");
    expect(txt("a-fam")).toBe("الفرز أثناء التدفّق");
    expect(txt("a-uncov")).toBe("Chaîne non couverte par le dico");   // repli FR même en AR
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("retour FR : restauration sans perte (__frSrc) + dir=ltr", () => {
    i18n().setLang("FR");
    expect(txt("a-home")).toBe("Accueil");
    expect(txt("a-comp")).toBe("Compliance & Risque");
    expect(txt("a-fam")).toBe("Screening en flux");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("MutationObserver : un nœud injecté APRÈS bascule est traduit à la volée (AR)", async () => {
    i18n().setLang("AR");
    const el = document.createElement("span"); el.id = "a-late"; el.textContent = "Tâches";
    document.querySelector("nav")!.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));   // laisse le MutationObserver s'exécuter
    expect(txt("a-late")).toBe("المهام");
    i18n().setLang("FR");
  });
});
