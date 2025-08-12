import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformAdminWalletController } from './platform-admin-wallet.controller';
import { PlatformAdminWalletService } from './platform-admin-wallet.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule } from '@nestjs/config';
import { getNatsOptions } from '@credebl/common/nats.config';
import { CommonConstants } from '@credebl/common/common.constant';
import { NATSClient } from '@credebl/common/NATSClient';
import { MobileWebhookService } from './services/mobile-webhook.service';
import { MobileAgentConfigService } from './services/mobile-agent-config.service';
// import { MobileNotificationService } from "./services/mobile-notification.service";
// import { MobileFCMService } from "./services/mobile-fcm.service";
import { MobileSecurityService } from './services/mobile-security.service';
import { MobileAnalyticsService } from './services/mobile-analytics.service';
import { RealDIDCommWebhookService } from './services/real-didcomm-webhook.service';
import { MobilePushNotificationService } from './services/mobile-push-notification.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ClientsModule.register([
      {
        name: 'NATS_CLIENT',
        transport: Transport.NATS,
        options: getNatsOptions(
          CommonConstants.PLATFORM_SERVICE,
          process.env.API_GATEWAY_NKEY_SEED
        )
      }
    ])
  ],
  controllers: [PlatformController, PlatformAdminWalletController],
  providers: [
    PlatformService,
    PlatformAdminWalletService,
    NATSClient,
    MobileWebhookService,
    MobileAgentConfigService,
    // MobileNotificationService,
    // MobileFCMService,
    MobileSecurityService,
    MobileAnalyticsService,
    RealDIDCommWebhookService,
    MobilePushNotificationService
  ]
})
export class PlatformModule {}
