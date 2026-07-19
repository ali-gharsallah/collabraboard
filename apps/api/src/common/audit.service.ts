import { Injectable } from "@nestjs/common";
import { createHmac } from "crypto";
import { PrismaService } from "./prisma.service";

// Journal chaîné : hash(n) = HMAC(secret, hash(n-1) | acteur | action | cible | t)
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  async log(tenantId: string, actor: string, action: string, target?: string) {
    const last = await this.prisma.auditLog.findFirst({
      where: { tenantId }, orderBy: { id: "desc" }, select: { hash: true } });
    const at = new Date();
    const hash = createHmac("sha256", process.env.AUDIT_HMAC_SECRET!)
      .update([last?.hash ?? "", actor, action, target ?? "", at.toISOString()].join("|"))
      .digest("hex");
    await this.prisma.auditLog.create({ data: { tenantId, actor, action, target, at, hash } });
  }
}
