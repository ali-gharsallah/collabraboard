// ═══ 1/3 — DELTA schema.prisma (Onboarding, R117→R120) ═══════════════════════
// À coller en fin de schema.prisma. `onboardings` rejoint la boucle RLS (tenantée).

model Onboarding {
  id            String   @id @default(uuid()) @db.Uuid
  tenantId      String   @map("tenant_id") @db.Uuid
  prospectNom   String   @map("prospect_nom")
  rmId          String?  @map("rm_id")
  etape         String   @default("PROSPECT")           // PROSPECT|COLLECTE|KYC_EN_COURS|DECISION|OUVERT|REFUSE|ABANDONNE (R117)
  etapeDepuis   DateTime @map("etape_depuis")           // base du SLA (R120)
  slaSignale    Boolean  @default(false) @map("sla_signale")   // une alerte, pas une boucle
  kycFileId     String?  @map("kyc_file_id") @db.Uuid   // UN KYC actif par onboarding (R118)
  motifTerminal String?  @map("motif_terminal")         // R7 : REFUSE/ABANDONNE motivés
  terminePar    String?  @map("termine_par")            // jeton
  createdAt     DateTime @default(now()) @map("created_at")
  @@index([tenantId, etape])
  @@map("onboardings")
}

// ═══ 2/3 — onboarding.controller-module.ts ═══════════════════════════════════
/*
import { Body, Controller, Get, Module, Param, Post, Req } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { KycService } from "../kyc/kyc.service";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
export class OnboardingController {
  constructor(private svc: OnboardingService) {}
  @Post()                      creer(@Req() r: any, @Body() b: any) { return this.svc.creer(r.ctx, b); }
  @Post(":id/transition")      tr(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.transitionner(r.ctx, id, b?.vers, { motif: b?.motif, form: b?.form }); }
  @Get(":id/funnel")           funnel(@Req() r: any, @Param("id") id: string) { return this.svc.funnel(r.ctx, id); }
}

@Module({ controllers: [OnboardingController],
  providers: [OnboardingService, KycService, PrismaService, AuditService] })
export class OnboardingModule {}

// Câblages : app.module + OnboardingModule ; scheduler → svc.tickSla(ctx, new Date()) ;
// consommateur de `onboarding.ouvert` (outbox) → création de compte / tâches de bienvenue ;
// run-rule-tests.sh : + onboarding (corpus 184 → 193) ; RLS : + 'onboardings'.
*/

// ═══ 3/3 — ADAPTATEURS PHASE 2 (squelettes HONNÊTES — chantier 2) ════════════
// Les CONTRATS sont définis et testés (GedAvanceService ports {tsa,qes,ia}, GD-07..14 verts
// avec fakes). Ce qui suit est le squelette d'intégration réelle : il COMPILE, il REFUSE
// proprement sans credentials, il ne simule JAMAIS (doctrine R114 « pas de simulacre »).
// À placer dans src/adapters/ — chaque adaptateur exige ses variables d'env, sinon le port
// reste absent (les services refusent alors explicitement, comportement déjà testé GD-10).
/*
import { createHash } from "crypto";

// ── TSA RFC 3161 (R113) — ex. DFN, Swisscom, SwissSign ──
export function tsaAdapter(): { timestamp(racine: string): Promise<{ token: string; at: string }> } | undefined {
  const url = process.env.TSA_URL;                        // ex. https://tsa.swisssign.net
  if (!url) return undefined;                             // port absent = refus propre en amont
  return {
    async timestamp(racine: string) {
      // TODO Phase 2 : requête ASN.1 TimeStampReq (hash = racine), POST content-type
      // application/timestamp-query, parser TimeStampResp, extraire genTime + jeton DER (base64).
      // Bibliothèque candidate : asn1js + pkijs. AUCUN fallback simulé.
      throw new Error("TSA_URL posée mais adaptateur RFC 3161 non implémenté (Phase 2) — pas de simulacre");
    },
  };
}

// ── QES ZertES (R114) — Swisscom AIS ou Skribble ──
export function qesAdapter(): { signer(sha256: string, signataire: string): Promise<{ evidenceId: string; contenuSigne: string }> } | undefined {
  const { AIS_URL, AIS_CLIENT_CERT, AIS_CLIENT_KEY } = process.env as any;
  if (!AIS_URL || !AIS_CLIENT_CERT || !AIS_CLIENT_KEY) return undefined;
  return {
    async signer(sha256: string, signataire: string) {
      // TODO Phase 2 : AIS SignRequest (DTBS = sha256), authent mTLS (cert client),
      // consentement signataire (Mobile ID / SMS), réponse = signature CAdES + evidence.
      throw new Error("AIS configuré mais adaptateur non implémenté (Phase 2) — pas de simulacre");
    },
  };
}

// ── IA classification (R116/R44) — API Claude ──
export function iaAdapter(): { classifier(contenu: string): Promise<{ type: string; expirationDetectee?: string }> } | undefined {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  return {
    async classifier(contenu: string) {
      // TODO Phase 2 : POST /v1/messages, prompt « classifie ce document parmi les codes du
      // référentiel tenant, réponds en JSON {type, expirationDetectee} » — la CLÉ VIT AU
      // SERVEUR (leçon du MVP : jamais dans le navigateur). La réponse reste une PROPOSITION
      // (R44) : c'est confirmerClassification, humain, qui applique.
      throw new Error("Clé posée mais adaptateur non implémenté (Phase 2)");
    },
  };
}

// Câblage : app.module → { provide: 'GED_PORTS', useFactory: () =>
//   ({ tsa: tsaAdapter(), qes: qesAdapter(), ia: iaAdapter() }) }
// Prérequis NON techniques (à obtenir par Ali) : contrat TSA qualifié, compte Swisscom AIS
// (mTLS) ou Skribble API, clé Anthropic serveur. Sans eux, les fonctionnalités R113/R114/R116
// sont ABSENTES et le disent — jamais dégradées en simulation.
*/
