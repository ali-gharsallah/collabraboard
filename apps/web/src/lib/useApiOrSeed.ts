import { useCallback, useEffect, useState } from "react";
import { apiGetSourced, OliveError } from "./api";

// Hook de lecture (SPEC-FRONT-CÂBLAGE v2, FE-CORE) : charge un endpoint, retombe sur un seed
// signalé si le backend est absent/en erreur, et expose de quoi recharger (les actions relisent
// l'état plutôt que de muter en optimiste — invariant « événements only »). `asOf` propage le
// rejeu à date (R48/R49). Ne masque jamais la source : { data, isDemo, loading, reload }.
// V2-M47 : `refus` remonte le message du moteur quand il REFUSE (404/409/422…) au lieu de le
// perdre. L'écart n'est pas théorique — l'onglet Exigences affichait un message générique là où
// le moteur nommait la paire (type d'entité, juridiction) qui n'est pas couverte.
export function useApiOrSeed<T>(path: string, seed: T, opts?: { asOf?: string }): {
  data: T; isDemo: boolean; loading: boolean; reload: () => void; refus?: OliveError;
} {
  const [data, setData] = useState<T>(seed);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [refus, setRefus] = useState<OliveError | undefined>(undefined);

  const charger = useCallback(async () => {
    setLoading(true);
    const r = await apiGetSourced<T>(path, seed, opts);
    setData(r.data); setIsDemo(r.isDemo); setRefus(r.refus); setLoading(false);
  }, [path, opts?.asOf]);

  useEffect(() => { charger(); }, [charger]);
  return { data, isDemo, loading, reload: charger, refus };
}
