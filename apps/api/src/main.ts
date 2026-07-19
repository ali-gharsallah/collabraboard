import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  if (!process.env.AUDIT_HMAC_SECRET) throw new Error("AUDIT_HMAC_SECRET manquant");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();                       // drain propre derrière un LB
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
