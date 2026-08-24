// V2-M57 — build DÉMO MONO-FICHIER (demo/olive-demo-v2.html). Hors CI, hors budget : le budget
// bundle garde le paquet SERVI (dist/), pas cet artefact de démonstration autonome. Les chunks
// paresseux (modules licenciés, packs de langue, globe) sont FUSIONNÉS ici — c'est le contraire
// de la doctrine de production, et c'est voulu : un fichier unique qui s'ouvre en double-clic,
// sans serveur, tout en mode démo (OLIVE_API_URL=null → seeds signalés « données maquette »).
import react from "@vitejs/plugin-react";
export default {
  plugins: [react()],
  build: {
    outDir: "dist-demo",
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 5000,
  },
};
