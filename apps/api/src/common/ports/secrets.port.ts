export abstract class SecretsPort {
  abstract get(name: string): Promise<string>;
}
// Dev/CI : variables d'environnement.
export class EnvSecrets extends SecretsPort {
  async get(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Secret manquant : ${name}`);
    return v;
  }
}
// Production : HashiCorp Vault (KV v2) — rotation gérée côté Vault, cache TTL court.
export class VaultSecrets extends SecretsPort {
  constructor(private baseUrl: string, private token: string) { super(); }
  private cache = new Map<string, { v: string; exp: number }>();
  async get(name: string) {
    const hit = this.cache.get(name);
    if (hit && hit.exp > Date.now()) return hit.v;
    const r = await fetch(`${this.baseUrl}/v1/secret/data/olive/${name}`,
      { headers: { "X-Vault-Token": this.token } });
    if (!r.ok) throw new Error(`Vault ${r.status} pour ${name}`);
    const v = ((await r.json()) as any).data.data.value as string;   // réponse Vault non typée (json() → unknown)
    this.cache.set(name, { v, exp: Date.now() + 60_000 });
    return v;
  }
}
