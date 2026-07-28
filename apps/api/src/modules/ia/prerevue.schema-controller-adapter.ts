// Fichier de RÉFÉRENCE (doc de câblage bloc 20) — non exécuté. Le delta schema est DÉJÀ
// appliqué (schema.prisma, post-deploy-v2). Bloc 1/3 commenté pour rester du TS valide
// (typecheck bloquant). Blocs 2/3 et 3/3 sont matérialisés : prerevue.module.ts et
// src/adapters/claude-ia.adapter.ts.
//
// ═══ 1/3 — DELTA schema.prisma (pré-revue IA, R121→R124) ═════════════════════
// ia_prerevues + ia_prompt_versions rejoignent la boucle RLS ET la liste append-only.
/*
model IaPrerevue {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  kycFileId      String   @map("kyc_file_id") @db.Uuid
  snapshotSha256 String   @map("snapshot_sha256") @db.Char(64)   // R122 : qu'a vu l'IA
  modele         String                                          // modèle + version
  promptVersion  Int      @map("prompt_version")                 // quelle règle de lecture
  points         Json                                            // sortie + traitements humains (R123)
  latenceMs      Int      @map("latence_ms")
  at             DateTime
  @@index([tenantId, kycFileId])
  @@map("ia_prerevues")
}

model IaPromptVersion {
  id       String   @id @default(uuid()) @db.Uuid
  tenantId String   @map("tenant_id") @db.Uuid
  numero   Int                                                   // registre append-only (R124)
  texte    String
  par      String                                                // jeton
  at       DateTime
  @@unique([tenantId, numero])
  @@map("ia_prompt_versions")
}
*/

// ═══ 2/3 — prerevue.controller-module.ts ═════════════════════════════════════
/*
import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { PreRevueService } from "./prerevue.service";
import { claudeIaAdapter } from "../../adapters/claude-ia.adapter";

@Controller("ia/prerevue")
export class PreRevueController {
  constructor(private svc: PreRevueService) {}
  @Post("kyc/:id")               demander(@Req() r: any, @Param("id") id: string) { return this.svc.demander(r.ctx, id); }        // R121
  @Get(":id")                    relire(@Req() r: any, @Param("id") id: string) { return this.svc.relire(r.ctx, id); }            // R122
  @Post(":id/points/:idx")       traiter(@Req() r: any, @Param("id") id: string, @Param("idx") i: string, @Body() b: any) { return this.svc.traiterPoint(r.ctx, id, +i, b?.statut, b?.motif); } // R123
  @Get("kyc/:id/traitement")     verif(@Req() r: any, @Param("id") id: string) { return this.svc.verifierTraitement(r.ctx, id); } // R123
  @Post("prompt")                prompt(@Req() r: any, @Body() b: any) { return this.svc.versionnerPrompt(r.ctx, b?.texte); }     // R124
}

@Module({ controllers: [PreRevueController],
  providers: [
    { provide: PreRevueService,
      useFactory: (p: PrismaService, a: AuditService) => new PreRevueService(p, a, { ia: claudeIaAdapter() }),
      inject: [PrismaService, AuditService] }] })
export class PreRevueModule {}

// Câblages : app.module + PreRevueModule ; si le tenant exige le traitement (R123),
// kyc.service (chemin du visa) appelle verifierTraitement et refuse si bloquant — même
// mécanique que la complétude GED (R110). run-rule-tests.sh : + prerevue (193 → 202).
*/

// ═══ 3/3 — adapters/claude-ia.adapter.ts — ADAPTATEUR RÉEL, COMPLET ══════════
// Contrairement à TSA/QES (ASN.1, mTLS — Phase 2), celui-ci s'écrit intégralement :
// API Claude côté serveur (la clé ne vit JAMAIS au client — leçon du MVP), sortie JSON
// contrainte, découpage robuste. Non exécutable hors ligne ici : le CONTRAT est prouvé
// par le faux (AG-01..06) ; le premier appel réel se vérifie en CI/staging avec la clé.
/*
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
*/
