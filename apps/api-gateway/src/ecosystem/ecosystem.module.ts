import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { EcosystemController } from './ecosystem.controller';
import { EcosystemService } from './ecosystem.service';
import { CommonModule } from '@credebl/common';
import { getNatsOptions } from '@credebl/common/nats.config';
import { CommonConstants } from '@credebl/common/common.constant';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NATS_CLIENT',
        transport: Transport.NATS,
        options: getNatsOptions(CommonConstants.API_GATEWAY_SERVICE, process.env.API_GATEWAY_NKEY_SEED)
      }
    ]),
    CommonModule
  ],
  controllers: [EcosystemController],
  providers: [EcosystemService]
})
export class EcosystemModule {}
