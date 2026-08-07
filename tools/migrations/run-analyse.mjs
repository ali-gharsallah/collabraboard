#!/usr/bin/env node
// Runner CI (MG-01/MG-04) — analyse TOUTES les migrations Prisma : expand-only + aucune
// mutation de table append-only. Toute violation = échec dur (la migration destructive ne
// passe pas la porte). Node natif, déterministe.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyserExpandOnly, tablesAppendOnly, analyserMutationAppendOnly, filtrerExceptions } from "./lib.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dirMig = join(racine, "apps", "api", "prisma", "migrations");
const postDeploy = join(racine, "apps", "api", "prisma", "post-deploy-v2.sql");
const tablesAO = tablesAppendOnly(readFileSync(postDeploy, "utf8"));

let total = 0, violations = 0;
console.log("## Migrations — analyse expand/contract (MG-01/MG-04)\n");
console.log(`Tables append-only reconnues : ${[...tablesAO].length} (source : post-deploy-v2.sql)\n`);
for (const d of existsSync(dirMig) ? readdirSync(dirMig) : []) {
  const f = join(dirMig, d, "migration.sql");
  if (!existsSync(f)) continue;
  total++;
  const sql = readFileSync(f, "utf8");
  const vExpand = filtrerExceptions(d, analyserExpandOnly(sql));   // exceptions documentées (lib.mjs)
  const vAO = analyserMutationAppendOnly(sql, tablesAO);
  if (!vExpand.length && !vAO.length) { console.log(`- ✓ ${d} — expand-only, aucune mutation append-only`); continue; }
  violations += vExpand.length + vAO.length;
  console.log(`- ✗ ${d}`);
  for (const v of vExpand) console.log(`    destructif (${v.motif}) : ${v.extrait}`);
  for (const v of vAO) console.log(`    mutation append-only ${v.op} ${v.table} : ${v.extrait}`);
}
console.log(`\n${total} migration(s), ${violations} violation(s).`);
if (violations) { console.error("MIGRATION NON EXPAND-ONLY — refusée en phase N (contract → N+1)."); process.exit(1); }
