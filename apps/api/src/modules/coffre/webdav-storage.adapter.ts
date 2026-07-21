import { URL } from "url";
import { StoragePort } from "./coffre.service";
import { TiersIndisponibleError } from "./ged-externe.adapter";

/**
 * Adaptateur WebDAV de PRODUCTION — R180→R182 en chair. La GED de la banque (Alfresco,
 * SharePoint, Nextcloud, FileNet… toutes parlent WebDAV) devient l'hébergeur documentaire :
 * O-Live y DÉPOSE par contrat et VÉRIFIE chaque relecture — l'adaptateur n'a pas besoin
 * d'être de confiance, c'est le coffre ratifié qui prouve l'intégrité (R145/R181).
 * Panne, 5xx, objet absent : TiersIndisponibleError EXPLICITE, jamais une dégradation
 * silencieuse (R182 — le résolveur instrumenté émet l'événement).
 * Le transport HTTP est injectable : fetch en production, serveur simulé aux preuves.
 * Le secret ne voyage QUE dans l'en-tête Authorization — jamais dans l'URL, jamais
 * dans un message d'erreur.
 */

export type HttpReponse = { status: number; text(): Promise<string> };
export type HttpTransport = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<HttpReponse>;

export type WebDavConfig = {
  baseUrl: string;                 // ex. https://ged.banque.ch/remote.php/dav/files/olive
  user?: string; password?: string; // Basic — OU
  token?: string;                   // Bearer
  prefixe?: string;                 // racine côté tiers (défaut "olive")
};

export class WebDavStorageAdapter implements StoragePort {
  private collectionsConnues = new Set<string>();
  constructor(private config: WebDavConfig,
    private http: HttpTransport = (globalThis as any).fetch?.bind(globalThis)) {
    if (!this.http) throw new Error("WebDAV : aucun transport HTTP disponible");
  }

  private entetes(): Record<string, string> {
    const h: Record<string, string> = { "User-Agent": "olive-ged/1.0" };
    if (this.config.token) h["Authorization"] = "Bearer " + this.config.token;
    else if (this.config.user) h["Authorization"] =
      "Basic " + Buffer.from(`${this.config.user}:${this.config.password ?? ""}`).toString("base64");
    return h;
  }
  private segmentsDe(cle: string): string[] {
    const segs = String(cle).split("/").filter((s) => s !== "");
    if (segs.length === 0 || segs.some((s) => s === "." || s === ".." || s.includes("\\")))
      throw new Error("WebDAV : clé invalide — segments '.', '..' ou '\\\\' refusés");
    return segs;
  }
  private urlDe(segs: string[]): string {
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const pfx = (this.config.prefixe ?? "olive").replace(/^\/+|\/+$/g, "");
    return base + "/" + [pfx, ...segs].map(encodeURIComponent).join("/");
  }
  private async appel(operation: string, method: string, url: string, body?: string): Promise<HttpReponse> {
    let r: HttpReponse;
    try { r = await this.http(url, { method, headers: this.entetes(), body }); }
    catch (e) {
      const cause = String((e as Error).message ?? e).replace(this.config.password ?? "\u0000", "***").replace(this.config.token ?? "\u0000", "***");
      throw new TiersIndisponibleError(operation, cause);
    }
    if (r.status >= 500) throw new TiersIndisponibleError(operation, `HTTP ${r.status} chez l'hébergeur`);
    if (r.status === 401 || r.status === 403) throw new TiersIndisponibleError(operation, `HTTP ${r.status} — authentification refusée par l'hébergeur`);
    return r;
  }
  private async assurerCollections(segs: string[]): Promise<void> {
    // WebDAV exige les collections parentes : MKCOL best-effort niveau par niveau
    const pfx = (this.config.prefixe ?? "olive").replace(/^\/+|\/+$/g, "");
    const chemin: string[] = [];
    for (const s of [pfx, ...segs.slice(0, -1)]) {
      chemin.push(s);
      const cleCol = chemin.join("/");
      if (this.collectionsConnues.has(cleCol)) continue;
      const url = this.config.baseUrl.replace(/\/+$/, "") + "/" + chemin.map(encodeURIComponent).join("/");
      const r = await this.appel("dépôt", "MKCOL", url);
      // 201 créée · 405/301 existe déjà — les deux conviennent
      if (![201, 405, 301].includes(r.status)) throw new TiersIndisponibleError("dépôt", `MKCOL HTTP ${r.status}`);
      this.collectionsConnues.add(cleCol);
    }
  }

  async ecrire(cle: string, contenu: string, _opts: { region: string; chiffrementRef?: string }): Promise<void> {
    const segs = this.segmentsDe(cle);
    await this.assurerCollections(segs);
    const r = await this.appel("dépôt", "PUT", this.urlDe(segs), contenu);
    if (![200, 201, 204].includes(r.status)) throw new TiersIndisponibleError("dépôt", `PUT HTTP ${r.status}`);
  }
  async lire(cle: string): Promise<string> {
    const segs = this.segmentsDe(cle);
    const r = await this.appel("lecture", "GET", this.urlDe(segs));
    if (r.status === 404) throw new TiersIndisponibleError("lecture", "objet absent chez l'hébergeur (HTTP 404)");
    if (r.status !== 200) throw new TiersIndisponibleError("lecture", `GET HTTP ${r.status}`);
    return r.text();
  }
  async supprimer(cle: string): Promise<void> {
    const segs = this.segmentsDe(cle);
    const r = await this.appel("suppression", "DELETE", this.urlDe(segs));
    if (![200, 204, 404].includes(r.status))   // absent = déjà supprimé, idempotent
      throw new TiersIndisponibleError("suppression", `DELETE HTTP ${r.status}`);
  }
  async lister(prefixe: string): Promise<string[]> {
    const segs = this.segmentsDe(prefixe);
    const r = await this.appel("listage", "PROPFIND", this.urlDe(segs));
    if (r.status === 404) return [];
    if (![207, 200].includes(r.status)) throw new TiersIndisponibleError("listage", `PROPFIND HTTP ${r.status}`);
    const xml = await r.text();
    const base = new URL(this.config.baseUrl).pathname.replace(/\/+$/, "");
    const pfx = (this.config.prefixe ?? "olive").replace(/^\/+|\/+$/g, "");
    const cles: string[] = [];
    for (const m of xml.matchAll(/<[^>]*href[^>]*>([^<]+)<\//gi)) {
      const chemin = decodeURIComponent(m[1]);
      if (chemin.endsWith("/")) continue;                    // collections
      const racine = base + "/" + pfx + "/";
      if (chemin.startsWith(racine)) cles.push(chemin.slice(racine.length));
    }
    return cles;
  }
}
