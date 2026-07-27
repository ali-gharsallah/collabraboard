import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";

/**
 * Type du client de persistance passé aux helpers/transactions (A3, audit-architecture). Le code
 * ratifié utilise `tx: any` dans les transactions interactives (dette signalée dès le lot 41). On
 * introduit ici l'alias de typage cible, à propager INCRÉMENTALEMENT, fichier par fichier, sans
 * toucher la logique (stratégie ratifiée A3).
 *
 * `DbClient` = soit le client transactionnel interactif (`Prisma.TransactionClient`, sans `$transaction`
 * ni `$connect`…), soit le `PrismaService` complet. Les helpers partagés (emit / settings / visibilité /
 * pagination) n'appellent que des délégués de modèle (`.domainEvent`, `.tenant`, `.user`…) présents sur
 * les deux — d'où ce type union qui accepte `tx` comme `this.prisma`.
 */
export type Tx = Prisma.TransactionClient;
export type DbClient = Prisma.TransactionClient | PrismaService;
