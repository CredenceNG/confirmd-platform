import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import * as crypto from "crypto";

// DIDComm Protocol interfaces and types
export interface DIDCommMessage {
  "@id": string;
  "@type": string;
  "~transport"?: {
    return_route?: string;
  };
  "~thread"?: {
    thid?: string;
    pthid?: string;
  };
  [key: string]: unknown;
}

export interface DIDCommConnection {
  connectionId: string;
  state:
    | "invitation-sent"
    | "invitation-received"
    | "request-sent"
    | "request-received"
    | "response-sent"
    | "response-received"
    | "completed";
  role: "inviter" | "invitee";
  theirDid?: string;
  myDid?: string;
  invitationKey?: string;
  theirLabel?: string;
  imageUrl?: string;
  serviceEndpoint?: string;
  routingKeys?: string[];
  recipientKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DIDCommCredentialOffer {
  credentialDefinitionId: string;
  attributes: Record<string, string>;
  connectionId: string;
  threadId: string;
  state:
    | "offer-sent"
    | "offer-received"
    | "request-sent"
    | "request-received"
    | "credential-issued"
    | "credential-received"
    | "done";
}

export interface DIDCommProofRequest {
  name: string;
  version: string;
  requestedAttributes: Record<string, unknown>;
  requestedPredicates: Record<string, unknown>;
  connectionId: string;
  threadId: string;
  state:
    | "request-sent"
    | "request-received"
    | "presentation-sent"
    | "presentation-received"
    | "done";
}

export interface DIDCommProtocolHandler {
  protocolType: string;
  version: string;
  processMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null>;
}

export interface DIDCommProtocolState {
  protocolType: string;
  threadId: string;
  state: string;
  metadata: Record<string, unknown>;
  lastMessage?: DIDCommMessage;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DIDCommProtocolService {
  private readonly logger = new Logger(DIDCommProtocolService.name);
  private readonly protocolHandlers: Map<string, DIDCommProtocolHandler> =
    new Map();
  private readonly activeConnections: Map<string, DIDCommConnection> =
    new Map();
  private readonly protocolStates: Map<string, DIDCommProtocolState> =
    new Map();
  private readonly messageQueue: Map<string, DIDCommMessage[]> = new Map();

  constructor(@Inject("NATS_CLIENT") private readonly natsClient: ClientProxy) {
    this.logger.log("DIDComm Protocol Service initialized");
    this.initializeProtocolHandlers();
  }

  /**
   * Initialize all DIDComm protocol handlers
   */
  private initializeProtocolHandlers(): void {
    // Connection Protocol Handler
    this.registerProtocolHandler({
      protocolType: "https://didcomm.org/connections/1.0",
      version: "1.0",
      processMessage: this.processConnectionMessage.bind(this),
    });

    // Out-of-Band Protocol Handler
    this.registerProtocolHandler({
      protocolType: "https://didcomm.org/out-of-band/1.1",
      version: "1.1",
      processMessage: this.processOutOfBandMessage.bind(this),
    });

    // Issue Credential Protocol Handler
    this.registerProtocolHandler({
      protocolType: "https://didcomm.org/issue-credential/2.0",
      version: "2.0",
      processMessage: this.processCredentialMessage.bind(this),
    });

    // Present Proof Protocol Handler
    this.registerProtocolHandler({
      protocolType: "https://didcomm.org/present-proof/2.0",
      version: "2.0",
      processMessage: this.processProofMessage.bind(this),
    });

    // Trust Ping Protocol Handler
    this.registerProtocolHandler({
      protocolType: "https://didcomm.org/trust_ping/1.0",
      version: "1.0",
      processMessage: this.processTrustPingMessage.bind(this),
    });

    this.logger.log(
      `Initialized ${this.protocolHandlers.size} protocol handlers`
    );
  }

  /**
   * Register a new protocol handler
   */
  public registerProtocolHandler(handler: DIDCommProtocolHandler): void {
    const key = `${handler.protocolType}/${handler.version}`;
    this.protocolHandlers.set(key, handler);
    this.logger.log(`Registered protocol handler: ${key}`);
  }

  /**
   * Process incoming DIDComm message
   */
  public async processMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      this.logger.log(`Processing DIDComm message: ${message["@type"]}`, {
        id: message["@id"],
        type: message["@type"],
        connectionId,
      });

      // Validate message structure
      if (!this.validateMessage(message)) {
        throw new Error(`Invalid DIDComm message structure: ${message["@id"]}`);
      }

      // Extract protocol type and version
      const { protocolType, version } = this.parseProtocolType(
        message["@type"]
      );
      const handlerKey = `${protocolType}/${version}`;

      // Find appropriate protocol handler
      const handler = this.protocolHandlers.get(handlerKey);
      if (!handler) {
        this.logger.warn(`No handler found for protocol: ${handlerKey}`);
        return null;
      }

      // Update protocol state
      await this.updateProtocolState(message, connectionId);

      // Process message with handler
      const responseMessage = await handler.processMessage(
        message,
        connectionId
      );

      // Log message processing
      this.logger.log(`Message processed successfully: ${message["@id"]}`);

      // Emit message processing event
      await this.emitMessageEvent("message-processed", {
        message,
        connectionId,
        responseMessage,
        timestamp: new Date().toISOString(),
      });

      return responseMessage;
    } catch (error) {
      this.logger.error(`Failed to process message: ${message["@id"]}`, error);

      // Emit error event
      await this.emitMessageEvent("message-error", {
        message,
        connectionId,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Process connection protocol messages
   */
  private async processConnectionMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      const messageType = message["@type"];

      this.logger.log(`Processing connection message: ${messageType}`, {
        id: message["@id"],
        connectionId,
      });

      if (messageType.includes("invitation")) {
        return await this.processConnectionInvitation(message);
      } else if (messageType.includes("request")) {
        return await this.processConnectionRequest(message, connectionId);
      } else if (messageType.includes("response")) {
        return await this.processConnectionResponse(message, connectionId);
      } else if (messageType.includes("problem_report")) {
        await this.processConnectionProblemReport(message, connectionId);
        return null;
      }

      this.logger.warn(`Unknown connection message type: ${messageType}`);
      return null;
    } catch (error) {
      this.logger.error("Failed to process connection message", error);
      throw error;
    }
  }

  /**
   * Process out-of-band protocol messages
   */
  private async processOutOfBandMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      const messageType = message["@type"];

      this.logger.log(`Processing out-of-band message: ${messageType}`, {
        id: message["@id"],
        connectionId,
      });

      if (messageType.includes("invitation")) {
        return await this.processOutOfBandInvitation(message);
      } else if (messageType.includes("handshake-reuse")) {
        return await this.processHandshakeReuse(message, connectionId);
      }

      this.logger.warn(`Unknown out-of-band message type: ${messageType}`);
      return null;
    } catch (error) {
      this.logger.error("Failed to process out-of-band message", error);
      throw error;
    }
  }

  /**
   * Process credential protocol messages
   */
  private async processCredentialMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      const messageType = message["@type"];

      this.logger.log(`Processing credential message: ${messageType}`, {
        id: message["@id"],
        connectionId,
      });

      if (messageType.includes("offer-credential")) {
        return await this.processCredentialOffer(message, connectionId);
      } else if (messageType.includes("request-credential")) {
        return await this.processCredentialRequest(message, connectionId);
      } else if (messageType.includes("issue-credential")) {
        return await this.processCredentialIssue(message, connectionId);
      } else if (messageType.includes("ack")) {
        await this.processCredentialAck(message, connectionId);
        return null;
      }

      this.logger.warn(`Unknown credential message type: ${messageType}`);
      return null;
    } catch (error) {
      this.logger.error("Failed to process credential message", error);
      throw error;
    }
  }

  /**
   * Process proof protocol messages
   */
  private async processProofMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      const messageType = message["@type"];

      this.logger.log(`Processing proof message: ${messageType}`, {
        id: message["@id"],
        connectionId,
      });

      if (messageType.includes("request-presentation")) {
        return await this.processProofRequest(message, connectionId);
      } else if (messageType.includes("presentation")) {
        return await this.processProofPresentation(message, connectionId);
      } else if (messageType.includes("ack")) {
        await this.processProofAck(message, connectionId);
        return null;
      }

      this.logger.warn(`Unknown proof message type: ${messageType}`);
      return null;
    } catch (error) {
      this.logger.error("Failed to process proof message", error);
      throw error;
    }
  }

  /**
   * Process trust ping messages
   */
  private async processTrustPingMessage(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    try {
      const messageType = message["@type"];

      this.logger.log(`Processing trust ping message: ${messageType}`, {
        id: message["@id"],
        connectionId,
      });

      if (messageType.includes("ping")) {
        return await this.processTrustPing(message, connectionId);
      } else if (messageType.includes("ping_response")) {
        await this.processTrustPingResponse(message, connectionId);
        return null;
      }

      this.logger.warn(`Unknown trust ping message type: ${messageType}`);
      return null;
    } catch (error) {
      this.logger.error("Failed to process trust ping message", error);
      throw error;
    }
  }

  /**
   * Get connection by ID
   */
  public getConnection(connectionId: string): DIDCommConnection | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Update connection state
   */
  public async updateConnection(
    connectionId: string,
    updates: Partial<DIDCommConnection>
  ): Promise<void> {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      const updatedConnection = {
        ...connection,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.activeConnections.set(connectionId, updatedConnection);

      // Emit connection updated event
      await this.emitMessageEvent("connection-updated", {
        connectionId,
        connection: updatedConnection,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send message to connection
   */
  public async sendMessage(
    connectionId: string,
    message: DIDCommMessage
  ): Promise<void> {
    try {
      const connection = this.activeConnections.get(connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${connectionId}`);
      }

      this.logger.log(`Sending message to connection: ${connectionId}`, {
        messageId: message["@id"],
        messageType: message["@type"],
      });

      // Queue message for delivery
      if (!this.messageQueue.has(connectionId)) {
        this.messageQueue.set(connectionId, []);
      }
      this.messageQueue.get(connectionId)!.push(message);

      // Emit message sent event
      await this.emitMessageEvent("message-sent", {
        connectionId,
        message,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Message queued for delivery: ${message["@id"]}`);
    } catch (error) {
      this.logger.error(`Failed to send message: ${message["@id"]}`, error);
      throw error;
    }
  }

  // Private helper methods

  private validateMessage(message: DIDCommMessage): boolean {
    return !!(message["@id"] && message["@type"]);
  }

  private parseProtocolType(messageType: string): {
    protocolType: string;
    version: string;
  } {
    const parts = messageType.split("/");
    if (parts.length < 4) {
      throw new Error(`Invalid message type format: ${messageType}`);
    }

    const version = parts[parts.length - 2];
    const protocolType = parts.slice(0, -2).join("/");

    return { protocolType, version };
  }

  private async updateProtocolState(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<void> {
    const threadId = message["~thread"]?.thid || message["@id"];
    const { protocolType } = this.parseProtocolType(message["@type"]);

    const state: DIDCommProtocolState = {
      protocolType,
      threadId,
      state: this.extractStateFromMessage(message),
      metadata: { connectionId },
      lastMessage: message,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.protocolStates.set(threadId, state);
  }

  private extractStateFromMessage(message: DIDCommMessage): string {
    const messageType = message["@type"];
    const parts = messageType.split("/");
    return parts[parts.length - 1] || "unknown";
  }

  private async emitMessageEvent(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.natsClient.emit(`didcomm.${eventType}`, data);
    } catch (error) {
      this.logger.error(`Failed to emit event: ${eventType}`, error);
    }
  }

  // Stub implementations for specific message processing
  // These would be implemented based on actual DIDComm protocol requirements

  private async processConnectionInvitation(
    message: DIDCommMessage
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing connection invitation");
    // Implementation would create connection record and optionally return connection request
    return null;
  }

  private async processConnectionRequest(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing connection request");
    // Implementation would process request and return connection response
    return null;
  }

  private async processConnectionResponse(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing connection response");
    // Implementation would complete connection establishment
    return null;
  }

  private async processConnectionProblemReport(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<void> {
    this.logger.log("Processing connection problem report");
    // Implementation would handle connection errors
  }

  private async processOutOfBandInvitation(
    message: DIDCommMessage
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing out-of-band invitation");
    // Implementation would process OOB invitation
    return null;
  }

  private async processHandshakeReuse(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing handshake reuse");
    // Implementation would handle handshake reuse
    return null;
  }

  private async processCredentialOffer(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing credential offer");
    // Implementation would handle credential offer
    return null;
  }

  private async processCredentialRequest(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing credential request");
    // Implementation would handle credential request
    return null;
  }

  private async processCredentialIssue(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing credential issue");
    // Implementation would handle credential issue
    return null;
  }

  private async processCredentialAck(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<void> {
    this.logger.log("Processing credential acknowledgment");
    // Implementation would handle credential acknowledgment
  }

  private async processProofRequest(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing proof request");
    // Implementation would handle proof request
    return null;
  }

  private async processProofPresentation(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing proof presentation");
    // Implementation would handle proof presentation
    return null;
  }

  private async processProofAck(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<void> {
    this.logger.log("Processing proof acknowledgment");
    // Implementation would handle proof acknowledgment
  }

  private async processTrustPing(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<DIDCommMessage | null> {
    this.logger.log("Processing trust ping");
    // Implementation would handle trust ping and return ping response
    return {
      "@id": crypto.randomUUID(),
      "@type": "https://didcomm.org/trust_ping/1.0/ping_response",
      "~thread": {
        thid: message["@id"],
      },
    };
  }

  private async processTrustPingResponse(
    message: DIDCommMessage,
    connectionId?: string
  ): Promise<void> {
    this.logger.log("Processing trust ping response");
    // Implementation would handle trust ping response
  }
}
