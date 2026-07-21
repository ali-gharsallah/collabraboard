import { Module } from "@nestjs/common";
import { GedController } from "./ged.controller";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../../common/audit.service";
import { GedIngestionService } from "./ged-ingestion.service";
import { GedAvanceService } from "./ged-avance.service";
import { VuesService } from "./vues.service";
import { GedConsultationService } from "./ged-consultation.service";
import { RechercheService } from "../recherche/recherche.service";
import { CoffreService } from "../coffre/coffre.service";
import { StorageResolverService } from "../coffre/storage-resolver.service";

/**
 * Câblage Nest du domaine GED — lot 43. AUCUNE logique : la DI, rien d'autre.
 * Les services à ports OPTIONNELS (ingestion, avancé, coffre, resolver) sont fournis
 * par useFactory : leurs paramètres `ports = {}` sont des objets littéraux que la
 * résolution automatique de Nest ne sait pas injecter — la factory appelle le
 * constructeur telle que les corpus le prouvent (ports vides = comportement ratifié ;
 * l'injection des adaptateurs réels — S3 suisse, GED externe — se fait au déploiement
 * en remplaçant CES factories, jamais les services).
 */
const simple = (C: any) => ({ provide: C, useFactory: (p: PrismaService, a: AuditService) => new C(p, a), inject: [PrismaService, AuditService] });

@Module({
  controllers: [GedController],
  providers: [
    PrismaService, AuditService,
    simple(GedIngestionService),
    simple(GedAvanceService),
    simple(VuesService),
    simple(GedConsultationService),
    simple(RechercheService),
    simple(CoffreService),
    { provide: StorageResolverService, useFactory: (p: PrismaService) => new StorageResolverService(p), inject: [PrismaService] },
  ],
})
export class GedModule {}
