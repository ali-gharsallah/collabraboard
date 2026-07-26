import { useCallback, useEffect, useState } from "react";
import { apiGetSourced } from "./api";

// Hook de lecture (SPEC-FRONT-CÂBLAGE v2, FE-CORE) : charge un endpoint, retombe sur un seed
// signalé si le backend est absent/en erreur, et expose de quoi recharger (les actions relisent
// l'état plutôt que de muter en optimiste — invariant « événements only »). `asOf` propage le
// rejeu à date (R48/R49). Ne masque jamais la source : { data, isDemo, loading, reload }.
export function useApiOrSeed<T>(path: string, seed: T, opts?: { asOf?: string }): {
  data: T; isDemo: boolean; loading: boolean; reload: () => void;
} {
  const [data, setData] = useState<T>(seed);
  const [isDemo, setIsDemo] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const charger = useCallback(async () => {
    setLoading(true);
    const r = await apiGetSourced<T>(path, seed, opts);
    setData(r.data); setIsDemo(r.isDemo); setLoading(false);
  }, [path, opts?.asOf]);

  useEffect(() => { charger(); }, [charger]);
  return { data, isDemo, loading, reload: charger };
}
