// Adaptateur pré-revue IA (bloc 20, R121/R44) — matérialisé depuis le bloc 3/3 de
// prerevue.schema-controller-adapter.ts (repris VERBATIM). Clé côté SERVEUR uniquement.
type PortIa = { prerevue(snapshot: any, prompt: string): Promise<{ modele: string; points: any[] }> };

export function claudeIaAdapter(): PortIa | undefined {
  const key = process.env.ANTHROPIC_API_KEY;                 // serveur uniquement
  if (!key) return undefined;                                // port absent = refus propre (AG-02)
  const modele = process.env.IA_MODEL ?? "claude-sonnet-4-6";
  return {
    async prerevue(snapshot, prompt) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key,
                   "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: modele, max_tokens: 2000,
          system: prompt + "\n\nRéponds UNIQUEMENT un tableau JSON de points " +
            "{type: MANQUANT|CONTRADICTION|QUESTION, section, detail} — aucun autre texte.",
          messages: [{ role: "user", content: JSON.stringify(snapshot) }],
        }),
      });
      if (!res.ok) throw new Error(`Port IA : ${res.status} ${await res.text().then(t => t.slice(0, 200))}`);
      const data: any = await res.json();
      const texte = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      let points: any[];
      try { points = JSON.parse(texte.replace(/```json|```/g, "").trim()); }
      catch { throw new Error("Port IA : sortie non parseable — pré-revue REFUSÉE (jamais de points inventés)"); }
      if (!Array.isArray(points) || points.some((p) => !p.type || !p.detail))
        throw new Error("Port IA : structure de points invalide — pré-revue refusée");
      return { modele: data.model ?? modele, points };
    },
  };
}
// Doctrine : toute sortie douteuse = ERREUR franche (l'événement n'est pas émis), jamais des
// points « best effort » — un pré-lecteur qui invente est pire qu'absent (R121/R44).
