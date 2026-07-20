import { Injectable, UnauthorizedException } from "@nestjs/common";
import { sign } from "jsonwebtoken";
import { PrismaService } from "../../common/prisma.service";
import { PasswordHasher } from "./password";
import { Totp } from "./totp";
import { KeyStore } from "./key-store";

// Hash « leurre » : fait tourner scrypt même quand l'email n'existe pas (anti-énumération + timing).
const DUMMY = PasswordHasher.hash("__no_such_user__");

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private keys: KeyStore) {}

  async issueToken(dto: { tenantId: string; email: string; password: string; totp?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { tenantId: dto.tenantId, email: dto.email } });
    // Toujours exécuter la vérification (temps constant), message unique (pas de fuite d'existence).
    const ok = PasswordHasher.verify(dto.password, user?.passwordHash ?? DUMMY);
    if (!user || user.active === false || !ok)
      throw new UnauthorizedException("Identifiants invalides");
    // MFA (IAM) : si activée pour ce user, un code TOTP (RFC 6238) valide est exigé.
    if (user.mfaEnabled && user.mfaSecret) {
      if (!dto.totp || !Totp.verify(dto.totp, Totp.base32Decode(user.mfaSecret)))
        throw new UnauthorizedException("Code MFA invalide ou manquant");
    }
    // Le rôle vient EXCLUSIVEMENT du user en base — jamais d'un paramètre client (anti-escalade).
    // Signature avec la clé ACTIVE du trousseau ; le kid permet la rotation sans invalider
    // les jetons en cours (le vérificateur résout la clé publique par kid via le JWKS).
    const { kid, privatePem } = this.keys.signingKey();
    const token = sign({ tid: user.tenantId, sub: user.id, role: user.role },
      privatePem, { algorithm: "RS256", expiresIn: "15m", keyid: kid });
    return { access_token: token, token_type: "Bearer", expires_in: 900, role: user.role };
  }
}
