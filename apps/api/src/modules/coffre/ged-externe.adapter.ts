import { StoragePort } from "./coffre.service";

/**
 * Adaptateur GED externe — R180→R182 (GX-01..05). L'hébergeur de la banque devient un
 * StoragePort : le CoffreService ratifié tourne dessus TEL QUEL — empreinte avant remise,
 * relecture re-vérifiée, isolation par préfixe, restitution (R181 : tout adaptateur passe
 * les mêmes preuves). Contrat d'intégration : le tiers range PAR CLÉ (CMIS/WebDAV/S3-compat).
 * R182 : la panne du tiers est une erreur EXPLICITE et typée — jamais de file cachée ni de
 * copie de secours hors du port ; le signal est émis par l'appelant transactionnel.
 */

export class TiersIndisponibleError extends Error {
  constructor(operation: string, cause: string) {
    super(`R182 : GED externe indisponible (${operation}) — ${cause}. Aucun contournement : la disponibilité se traite au contrat de service.`);
  }
}

type ClientTiers = {
  deposer(cle: string, contenu: string): Promise<void>;
  obtenir(cle: string): Promise<string>;
  retirer(cle: string): Promise<void>;
  parPrefixe(prefixe: string): Promise<string[]>;
};

export class GedExterneAdapter implements StoragePort {
  private panne = false;
  constructor(private client: ClientTiers) {}
  simulerPanne(v: boolean) { this.panne = v; }   // recette/exercice — la prod branche un vrai client

  private async garde<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (this.panne) throw new TiersIndisponibleError(operation, "connexion refusée");
    try { return await fn(); }
    catch (e) {
      if (e instanceof TiersIndisponibleError) throw e;
      throw new TiersIndisponibleError(operation, (e as Error).message);
    }
  }
  async ecrire(cle: string, contenu: string, _opts: { region: string; chiffrementRef?: string }) {
    await this.garde("dépôt", () => this.client.deposer(cle, contenu));
  }
  async lire(cle: string) {
    return this.garde("lecture", () => this.client.obtenir(cle));
  }
  async supprimer(cle: string) {
    await this.garde("retrait", () => this.client.retirer(cle));
  }
  async lister(prefixe: string) {
    return this.garde("inventaire", () => this.client.parPrefixe(prefixe));
  }
}
