import { Body, Controller, Get, Post, Query, Req, BadRequestException } from "@nestjs/common";
import { emitEvent } from "../../common/domain-event";
import { Prisma } from "@prisma/client";
import { ClientCreate } from "@olive/shared/src/contracts";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";

@Controller("clients")
export class ClientsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  @Get()
  async list(@Req() req: any, @Query("cursor") cursor?: string, @Query("take") take = "50") {
    const { tenantId } = req.ctx;
    const rows = await this.prisma.client.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: Math.min(+take, 200) + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, name: true, structure: true, country: true, riskLevel: true, corrLang: true },
    });
    const hasMore = rows.length > Math.min(+take, 200);
    return { data: hasMore ? rows.slice(0, -1) : rows, next_cursor: hasMore ? rows[rows.length - 2].id : null };
  }

  @Post()
  async create(@Req() req: any, @Body() body: unknown) {
    const parsed = ClientCreate.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { tenantId, userId } = req.ctx;
    const c = await this.prisma.client.create({
      data: { tenantId, ...parsed.data } as Prisma.ClientUncheckedCreateInput });
    await this.audit.log(tenantId, userId, "CLIENT_CREATED", c.id);
    return c;
  }

  @Post(":id/events")   // Change of Circumstances entrant (core banking → Olive)
  async coc(@Req() req: any, @Body() body: any) {
    const { tenantId } = req.ctx;
    const material = ["ADDRESS_CHANGE","UBO_CHANGE","PEP_STATUS"].includes(body?.type);
    await emitEvent(this.prisma, tenantId, "client.coc", req.params.id, body ?? {});
    return { received: true, material };
  }
}
