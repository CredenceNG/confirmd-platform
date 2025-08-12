import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { user } from '@prisma/client';
import { BaseService } from 'libs/service/base.service';
import { AgentSpinupDto } from './dto/agent-service.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import {
  AgentSpinUpSatus,
  IWalletRecord
} from './interface/agent-service.interface';
import { AgentStatus } from './interface/agent-service.interface';
import { CreateDidDto } from './dto/create-did.dto';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { AgentConfigureDto } from './dto/agent-configure.dto';
import { NATSClient } from '@credebl/common/NATSClient';

@Injectable()
export class AgentService extends BaseService {
  constructor(
    @Inject('NATS_CLIENT') private readonly agentServiceProxy: ClientProxy,
    private readonly natsClient: NATSClient
  ) {
    super('AgentService');
  }

  /**
   * Spinup the agent by organization
   * @param agentSpinupDto
   * @param user
   * @returns Get agent status
   */
  async agentSpinup(
    agentSpinupDto: AgentSpinupDto,
    user: user
  ): Promise<AgentSpinUpSatus> {
    const payload = { agentSpinupDto, user };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'agent-spinup',
      payload
    );
  }

  async createTenant(
    createTenantDto: CreateTenantDto,
    user: user
  ): Promise<AgentSpinUpSatus> {
    const payload = { createTenantDto, user };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'create-tenant',
      payload
    );
  }

  async createDid(
    createDidDto: CreateDidDto,
    orgId: string,
    user: user
  ): Promise<object> {
    const payload = { createDidDto, orgId, user };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'create-did',
      payload
    );
  }

  async createWallet(
    createWalletDto: CreateWalletDto,
    user: user
  ): Promise<IWalletRecord> {
    const payload = { createWalletDto, user };
    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'create-wallet',
      payload
    );
  }

  async getAgentHealth(user: user, orgId: string): Promise<AgentStatus> {
    const payload = { user, orgId };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'agent-health',
      payload
    );
  }

  async signData(data: unknown, orgId: string): Promise<AgentStatus> {
    const payload = { data, orgId };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'sign-data-from-agent',
      payload
    );
  }

  async verifysignature(data: unknown, orgId: string): Promise<AgentStatus> {
    const payload = { data, orgId };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'verify-signature-from-agent',
      payload
    );
  }

  async getLedgerConfig(user: user): Promise<object> {
    const payload = { user };

    // NATS call
    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'get-ledger-config',
      payload
    );
  }

  async createSecp256k1KeyPair(orgId: string): Promise<object> {
    const payload = { orgId };
    // NATS call

    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'polygon-create-keys',
      payload
    );
  }

  async agentConfigure(
    agentConfigureDto: AgentConfigureDto,
    user: user
  ): Promise<object> {
    const payload = { agentConfigureDto, user };
    // NATS call

    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'agent-configure',
      payload
    );
  }

  async deleteWallet(orgId: string, user: user): Promise<object> {
    const payload = { orgId, user };
    // NATS call

    return this.natsClient.sendNatsMessage(
      this.agentServiceProxy as any,
      'delete-wallet',
      payload
    );
  }
}
