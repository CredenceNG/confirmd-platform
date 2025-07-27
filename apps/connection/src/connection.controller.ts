import { Controller, Logger } from "@nestjs/common"; // Import the common service in the library
import { ConnectionService } from "./connection.service"; // Import the common service in connection module
import { MessagePattern } from "@nestjs/microservices"; // Import the nestjs microservices package
import {
  GetAllConnections,
  ICreateConnection,
  ICreateOutOfbandConnectionInvitation,
  IFetchConnectionById,
  IFetchConnections,
  IReceiveInvitationByOrg,
  IReceiveInvitationByUrlOrg,
  IReceiveInvitationResponse,
} from "./interfaces/connection.interfaces";
import {
  IConnectionList,
  IDeletedConnectionsRecord,
} from "@credebl/common/interfaces/connection.interface";
import { IConnectionDetailsById } from "apps/api-gateway/src/interfaces/IConnectionSearch.interface";
import { IQuestionPayload } from "./interfaces/messaging.interfaces";
import { user } from "@prisma/client";

@Controller()
export class ConnectionController {
  private readonly logger = new Logger("ConnectionController");

  constructor(private readonly connectionService: ConnectionService) {
    this.logger.log("🔧 ConnectionController initialized");
  }

  /**
   * Receive connection webhook responses and save details in connection table
   * @param orgId
   * @returns Callback URL for connection and created connections details
   */
  @MessagePattern({ cmd: "webhook-get-connection" })
  async getConnectionWebhook(payload: ICreateConnection): Promise<object> {
    this.logger.log("🎯 === WEBHOOK CONNECTION REQUEST RECEIVED ===");
    this.logger.log(`📨 Payload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const result = await this.connectionService.getConnectionWebhook(payload);
      this.logger.log("✅ Webhook connection processed successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Webhook connection failed:", error);
      throw error;
    }
  }

  /**
   * Description: Fetch connection url by refernceId.
   * @param payload
   * @returns Created connection invitation for out-of-band
   */
  @MessagePattern({ cmd: "get-connection-url" })
  async getUrl(payload: { referenceId }): Promise<string> {
    this.logger.log("🔗 === GET CONNECTION URL REQUEST ===");
    this.logger.log(`📋 Reference ID: ${payload.referenceId}`);

    try {
      const result = await this.connectionService.getUrl(payload.referenceId);
      this.logger.log("✅ Connection URL retrieved successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Get connection URL failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "get-all-connections" })
  async getConnections(payload: IFetchConnections): Promise<IConnectionList> {
    this.logger.log("📋 === GET ALL CONNECTIONS REQUEST ===");
    this.logger.log(`👤 User: ${JSON.stringify(payload.user)}`);
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(
      `🔍 Search Criteria: ${JSON.stringify(payload.connectionSearchCriteria)}`
    );

    try {
      const { user, orgId, connectionSearchCriteria } = payload;
      const result = await this.connectionService.getConnections(
        user,
        orgId,
        connectionSearchCriteria
      );
      this.logger.log(`✅ Retrieved ${result.totalItems || 0} connections`);
      return result;
    } catch (error) {
      this.logger.error("❌ Get connections failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "get-all-agent-connection-list" })
  async getConnectionListFromAgent(
    payload: GetAllConnections
  ): Promise<string> {
    this.logger.log("🤖 === GET AGENT CONNECTION LIST REQUEST ===");
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(
      `🔍 Search Criteria: ${JSON.stringify(payload.connectionSearchCriteria)}`
    );

    try {
      const { orgId, connectionSearchCriteria } = payload;
      const result = await this.connectionService.getAllConnectionListFromAgent(
        orgId,
        connectionSearchCriteria
      );
      this.logger.log("✅ Agent connection list retrieved successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Get agent connection list failed:", error);
      throw error;
    }
  }

  /**
   *
   * @param connectionId
   * @param orgId
   * @returns connection details by connection Id
   */
  @MessagePattern({ cmd: "get-connection-details-by-connectionId" })
  async getConnectionsById(
    payload: IFetchConnectionById
  ): Promise<IConnectionDetailsById> {
    this.logger.log("🔍 === GET CONNECTION DETAILS BY ID REQUEST ===");
    this.logger.log(`👤 User: ${JSON.stringify(payload.user)}`);
    this.logger.log(`🔗 Connection ID: ${payload.connectionId}`);
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);

    try {
      const { user, connectionId, orgId } = payload;
      const result = await this.connectionService.getConnectionsById(
        user,
        connectionId,
        orgId
      );
      this.logger.log("✅ Connection details retrieved successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Get connection details failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "get-connection-records" })
  async getConnectionRecordsByOrgId(payload: {
    orgId: string;
    userId: string;
  }): Promise<number> {
    this.logger.log("📊 === GET CONNECTION RECORDS REQUEST ===");
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(`👤 User ID: ${payload.userId}`);

    try {
      const { orgId } = payload;
      const result = await this.connectionService.getConnectionRecords(orgId);
      this.logger.log(`✅ Retrieved ${result} connection records`);
      return result;
    } catch (error) {
      this.logger.error("❌ Get connection records failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "receive-invitation-url" })
  async receiveInvitationUrl(
    payload: IReceiveInvitationByUrlOrg
  ): Promise<IReceiveInvitationResponse> {
    this.logger.log("🌐 === RECEIVE INVITATION URL REQUEST ===");
    this.logger.log(`📧 Invitation URL: ${payload.receiveInvitationUrl}`);
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(`👤 User: ${JSON.stringify(payload.user)}`);

    try {
      const { user, receiveInvitationUrl, orgId } = payload;
      const result = await this.connectionService.receiveInvitationUrl(
        user,
        receiveInvitationUrl,
        orgId
      );
      this.logger.log("✅ Invitation URL received successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Receive invitation URL failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "receive-invitation" })
  async receiveInvitation(
    payload: IReceiveInvitationByOrg
  ): Promise<IReceiveInvitationResponse> {
    this.logger.log("📨 === RECEIVE INVITATION REQUEST ===");
    this.logger.log(
      `🔗 Invitation: ${JSON.stringify(payload.receiveInvitation)}`
    );
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(`👤 User: ${JSON.stringify(payload.user)}`);

    try {
      const { user, receiveInvitation, orgId } = payload;
      const result = await this.connectionService.receiveInvitation(
        user,
        receiveInvitation,
        orgId
      );
      this.logger.log("✅ Invitation received successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Receive invitation failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "send-question" })
  async sendQuestion(payload: IQuestionPayload): Promise<object> {
    this.logger.log("❓ === SEND QUESTION REQUEST ===");
    this.logger.log(`📋 Payload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const result = await this.connectionService.sendQuestion(payload);
      this.logger.log("✅ Question sent successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Send question failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "get-question-answer-record" })
  async getQuestionAnswersRecord(orgId: string): Promise<object> {
    this.logger.log("📋 === GET QUESTION ANSWER RECORD REQUEST ===");
    this.logger.log(`🏢 Org ID: ${orgId}`);

    try {
      const result = await this.connectionService.getQuestionAnswersRecord(
        orgId
      );
      this.logger.log("✅ Question answer records retrieved successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Get question answer record failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "create-connection-invitation" })
  async createConnectionInvitation(
    payload: ICreateOutOfbandConnectionInvitation
  ): Promise<object> {
    this.logger.log("🎫 === CREATE CONNECTION INVITATION REQUEST ===");
    this.logger.log(`📋 Payload: ${JSON.stringify(payload, null, 2)}`);

    try {
      const result = await this.connectionService.createConnectionInvitation(
        payload
      );
      this.logger.log("✅ Connection invitation created successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Create connection invitation failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "delete-connection-records" })
  async deleteConnectionRecords(payload: {
    orgId: string;
    userDetails: user;
  }): Promise<IDeletedConnectionsRecord> {
    this.logger.log("🗑️ === DELETE CONNECTION RECORDS REQUEST ===");
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(`👤 User: ${JSON.stringify(payload.userDetails)}`);

    try {
      const { orgId, userDetails } = payload;
      const result = await this.connectionService.deleteConnectionRecords(
        orgId,
        userDetails
      );
      this.logger.log("✅ Connection records deleted successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Delete connection records failed:", error);
      throw error;
    }
  }

  @MessagePattern({ cmd: "send-basic-message-on-connection" })
  async sendBasicMessage(payload: {
    content: string;
    orgId: string;
    connectionId: string;
  }): Promise<object> {
    this.logger.log("💬 === SEND BASIC MESSAGE REQUEST ===");
    this.logger.log(`📝 Content: ${payload.content}`);
    this.logger.log(`🏢 Org ID: ${payload.orgId}`);
    this.logger.log(`🔗 Connection ID: ${payload.connectionId}`);

    try {
      const result = await this.connectionService.sendBasicMesage(payload);
      this.logger.log("✅ Basic message sent successfully");
      return result;
    } catch (error) {
      this.logger.error("❌ Send basic message failed:", error);
      throw error;
    }
  }
}
