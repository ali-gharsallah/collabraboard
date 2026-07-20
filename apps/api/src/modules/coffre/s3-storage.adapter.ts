/**
 * Adaptateur de PRODUCTION — Exoscale SOS (S3-compatible, résidence suisse).
 * Implémente StoragePort (coffre.service.ts). Câblage verbatim ; NON exécuté hors production.
 * Activation (RUNBOOK) : EXOSCALE_SOS_KEY / EXOSCALE_SOS_SECRET / EXOSCALE_SOS_BUCKET en env ;
 * région servie par le registre R-Q (storageRegion, défaut ch-gva-2 — endpoint sos-{region}.exo.io).
 * npm i @aws-sdk/client-s3
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { StoragePort } from "./coffre.service";

export function exoscaleStoragePort(env = process.env): StoragePort {
  const bucket = env.EXOSCALE_SOS_BUCKET;
  if (!env.EXOSCALE_SOS_KEY || !env.EXOSCALE_SOS_SECRET || !bucket)
    throw new Error("R144 : coffre Exoscale non configuré (EXOSCALE_SOS_KEY/SECRET/BUCKET) — pas de dépôt fantôme");
  const clients = new Map<string, S3Client>();
  const client = (region: string) => {
    if (!clients.has(region))
      clients.set(region, new S3Client({ region,
        endpoint: `https://sos-${region}.exo.io`, forcePathStyle: true,
        credentials: { accessKeyId: env.EXOSCALE_SOS_KEY!, secretAccessKey: env.EXOSCALE_SOS_SECRET! } }));
    return clients.get(region)!;
  };
  return {
    async ecrire(cle, contenu, opts) {
      await client(opts.region).send(new PutObjectCommand({ Bucket: bucket, Key: cle,
        Body: contenu, ServerSideEncryption: "AES256",
        Metadata: opts.chiffrementRef ? { "olive-chiffrement-ref": opts.chiffrementRef } : undefined }));
    },
    async lire(cle) {
      const r = await client("ch-gva-2").send(new GetObjectCommand({ Bucket: bucket, Key: cle }));
      return r.Body!.transformToString();
    },
    async supprimer(cle) {
      await client("ch-gva-2").send(new DeleteObjectCommand({ Bucket: bucket, Key: cle }));
    },
    async lister(prefixe) {
      const out: string[] = []; let token: string | undefined;
      do {
        const r = await client("ch-gva-2").send(new ListObjectsV2Command({
          Bucket: bucket, Prefix: prefixe, ContinuationToken: token }));
        for (const o of r.Contents ?? []) if (o.Key) out.push(o.Key);
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      return out;
    },
  };
}
