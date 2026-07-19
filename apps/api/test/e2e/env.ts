// setupFiles e2e : secrets + URL de la base jetable (docker-compose.test.yml).
// Les clés JWT ne viennent plus de l'environnement : le KeyStore de l'app les génère (JWKS/rotation).
process.env.AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET ?? "test-audit-secret";
process.env.WEBHOOK_SECRET    = process.env.WEBHOOK_SECRET    ?? "test-webhook-secret";
process.env.DATABASE_URL      = process.env.DATABASE_URL      ?? "postgresql://olive:olive@localhost:5433/olive_test";
