// Registre des instances clientes (R319) : version, modules, échéances, canal. Journal
// append-only en mémoire (la vraie persistance = base PROPRE de l'instance vendor, hors
// de ce dépôt). Aucune connexion entrante console → données tenant : on ne stocke QUE des
// métadonnées d'instance, jamais une donnée métier d'un tenant.
export class RegistreInstances {
  #instances = new Map();   // tenantId -> { tenantId, version, modules, echeance, canal, historique[] }

  enregistrer({ tenantId, version, modules, echeance, canal }) {
    if (!tenantId) throw new Error("tenantId requis");
    const inst = this.#instances.get(tenantId) ?? { tenantId, historique: [] };
    inst.version = version ?? inst.version;
    inst.modules = modules ?? inst.modules ?? [];
    inst.echeance = echeance ?? inst.echeance ?? null;
    inst.canal = canal ?? inst.canal ?? "STABLE";
    inst.historique.push({ at: new Date().toISOString(), version: inst.version, modules: inst.modules });
    this.#instances.set(tenantId, inst);
    return { tenantId, version: inst.version, modules: inst.modules, canal: inst.canal };
  }

  lister() { return [...this.#instances.values()].map(({ historique, ...pub }) => pub); }
  get(tenantId) { return this.#instances.get(tenantId) ?? null; }
}
