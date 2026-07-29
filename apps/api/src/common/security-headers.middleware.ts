import { Injectable, NestMiddleware } from "@nestjs/common";

/**
 * En-têtes de sécurité (partie 4 du solde 4 écarts, 2026-07-29 — ASVS V14.4) : posés
 * SERVEUR sur TOUTE réponse, refus compris — l'app est sûre sans le reverse-proxy
 * (Caddy ajoute HSTS/TLS en prod, cf. infra/compose/Caddyfile §8). Une API JSON ne sert
 * pas de HTML : CSP default-src 'none' (rien à charger), anti-sniff, anti-frame,
 * aucun referrer sortant.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: any, res: any, next: () => void) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  }
}
