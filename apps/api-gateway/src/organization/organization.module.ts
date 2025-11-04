import { CommonModule, CommonService } from '@credebl/common';
import { PrismaService } from '@credebl/prisma-service';

import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrgAppsController } from './org-apps.controller';
import { OrgAppsService } from './org-apps.service';
import { getNatsOptions } from '@credebl/common/nats.config';
import { AwsService } from '@credebl/aws';
import { CommonConstants } from '@credebl/common/common.constant';
@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'NATS_CLIENT',
        transport: Transport.NATS,
        options: getNatsOptions(CommonConstants.ORGANIZATION_SERVICE, process.env.API_GATEWAY_NKEY_SEED)
      },
      CommonModule
    ])
  ],
  controllers: [OrganizationController, OrgAppsController],
  providers: [OrganizationService, OrgAppsService, CommonService, AwsService, PrismaService]
})
export class OrganizationModule {}
