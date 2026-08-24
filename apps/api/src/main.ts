import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  if (!process.env.AUDIT_HMAC_SECRET) throw new Error("AUDIT_HMAC_SECRET manquant");
  const app = await NestFactory.create(AppModule);
  // CORS opt-in : no-op sauf si CORS_ORIGIN est posé (ex. démo docker-compose : web:8080 → api:3000).
  // En prod même-origine (LB/reverse-proxy) on ne pose pas la variable → comportement inchangé.
  if (process.env.CORS_ORIGIN)
    app.enableCors({ origin: process.env.CORS_ORIGIN.split(",").map((o) => o.trim()), credentials: true });
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();                       // drain propre derrière un LB
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
