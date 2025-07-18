import { ClientsModule, Transport } from "@nestjs/microservices";
import { Logger, Module } from "@nestjs/common";

import { CommonModule } from "@credebl/common";
import { OrgRolesRepository } from "libs/org-roles/repositories";
import { OrgRolesService } from "@credebl/org-roles";
import { OrganizationController } from "./organization.controller";
import { OrganizationRepository } from "../repositories/organization.repository";
import { OrganizationService } from "./organization.service";
import { PrismaService } from "@credebl/prisma-service";
import { UserActivityRepository } from "libs/user-activity/repositories";
import { UserActivityService } from "@credebl/user-activity";
import { UserOrgRolesRepository } from "libs/user-org-roles/repositories";
import { UserOrgRolesService } from "@credebl/user-org-roles";
import { UserRepository } from "apps/user/repositories/user.repository";
import { CacheModule } from "@nestjs/cache-manager";
import { getNatsOptions } from "@credebl/common/nats.config";
import { ClientRegistrationService } from "@credebl/client-registration";
import { KeycloakUrlService } from "@credebl/keycloak-url";

import { AwsService } from "@credebl/aws";
import { LocalFileService } from "@credebl/local-file";
import { CommonConstants } from "@credebl/common/common.constant";
import { GlobalConfigModule } from "@credebl/config/global-config.module";
import { ConfigModule as PlatformConfig } from "@credebl/config/config.module";
import { LoggerModule } from "@credebl/logger/logger.module";
import { ContextInterceptorModule } from "@credebl/context/contextInterceptorModule";
import { NATSClient } from "@credebl/common/NATSClient";
@Module({
  imports: [
    ClientsModule.register([
      {
        name: "NATS_CLIENT",
        transport: Transport.NATS,
        options: getNatsOptions(
          CommonConstants.ORGANIZATION_SERVICE,
          process.env.ORGANIZATION_NKEY_SEED
        ),
      },
    ]),
    CommonModule,
    GlobalConfigModule,
    LoggerModule,
    PlatformConfig,
    ContextInterceptorModule,
    CacheModule.register(),
  ],
  controllers: [OrganizationController],
  providers: [
    OrganizationService,
    OrganizationRepository,
    PrismaService,
    Logger,
    OrgRolesService,
    UserOrgRolesService,
    OrgRolesRepository,
    UserActivityRepository,
    UserActivityRepository,
    UserOrgRolesRepository,
    UserRepository,
    UserActivityService,
    ClientRegistrationService,
    KeycloakUrlService,
    AwsService,
    LocalFileService,
    NATSClient,
  ],
})
export class OrganizationModule {}
