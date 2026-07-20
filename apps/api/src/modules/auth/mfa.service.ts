import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { SecretBox } from "../../common/secret-box";
import { Totp } from "./totp";

/**
 * Provisioning MFA (TOTP). Enrôlement en deux temps : (1) génère un secret + URI otpauth:// à
 * afficher en QR ; (2) confirme via un premier code valide AVANT d'activer.
 *
 * PATCH 2026-07-19 (SB-01..06) : le secret est désormais CHIFFRÉ au repos (SecretBox,
 * AES-256-GCM, clé MFA_ENC_KEY). Le clair n'existe que dans la réponse d'enrôlement (QR) ;
 * la base ne voit que `enc:v1:…`. Les secrets legacy en clair restent lisibles (passthrough)
 * jusqu'à leur prochain enrôlement.
 */
@Injectable()
export class MfaService {
  constructor(private readonly prisma: PrismaService,
              private readonly box: SecretBox = new SecretBox(process.env.MFA_ENC_KEY)) {}
  // Défaut : box construite depuis MFA_ENC_KEY (fail-fast si absent — voulu en prod ;
  // le harnais de tests pose la variable). L'injection DI reste possible (app.module).

  generateSecret(): string { return Totp.base32Encode(randomBytes(20)); }   // 160 bits

  otpauthUri(secret: string, account: string, issuer = "O-Live"): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const q = `secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    return `otpauth://totp/${label}?${q}`;
  }

  /** (1) Démarre l'enrôlement : secret posé CHIFFRÉ, MFA pas encore activée. */
  async beginEnrollment(tenantId: string, userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new BadRequestException("Utilisateur introuvable");
    const secret = this.generateSecret();
    await this.prisma.user.update({ where: { id: userId },
      data: { mfaSecret: this.box.seal(secret), mfaEnabled: false } });      // ← chiffré au repos
    return { secret, otpauthUri: this.otpauthUri(secret, user.email) };      // clair : QR seulement
  }

  /** (2) Confirme : un code valide active la MFA. */
  async confirmEnrollment(tenantId: string, userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user?.mfaSecret) throw new BadRequestException("Aucun enrôlement MFA en cours");
    if (!code || !Totp.verify(code, Totp.base32Decode(this.box.open(user.mfaSecret))))   // ← open()
      throw new UnauthorizedException("Code MFA invalide");
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }
}

/* ── Deltas hors de ce fichier ────────────────────────────────────────────────
   auth.service.ts (2 lignes) — injecter SecretBox, puis :
     - if (!dto.totp || !Totp.verify(dto.totp, Totp.base32Decode(user.mfaSecret)))
     + if (!dto.totp || !Totp.verify(dto.totp, Totp.base32Decode(this.box.open(user.mfaSecret))))
   auth.module.ts — provider :
     { provide: SecretBox, useFactory: () => new SecretBox(process.env.MFA_ENC_KEY) }
   .env.example — ajouter MFA_ENC_KEY (>= 32 caractères aléatoires).
   users.service.resetMfa — inchangé (met null).                              */
