import { Module } from "@nestjs/common";
import { ClientsController } from "./clients.controller";
@Module({ controllers: [ClientsController], providers: [] })
export class ClientsModule {}
