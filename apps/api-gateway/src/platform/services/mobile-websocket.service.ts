import { Injectable, Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
// import { Server, Socket } from "socket.io"; // Disabled until dependencies available
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

// Mock types for Socket.IO until dependencies are available
type Server = any;
type Socket = any;

// Real-time notification types for mobile wallets
export interface MobileNotificationPayload {
  eventType: string;
  organizationId: string;
  userId?: string;
  connectionId?: string;
  credentialId?: string;
  data: Record<string, unknown>;
  timestamp: string;
  priority: 'high' | 'normal' | 'low';
}

export interface MobileSocketConnection {
  socketId: string;
  organizationId: string;
  userId?: string;
  connectionId?: string;
  deviceInfo?: {
    platform: 'ios' | 'android' | 'web';
    walletType: string;
    userAgent: string;
  };
  connectedAt: string;
  lastActivity: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  namespace: '/mobile'
})
@Injectable()
export class MobileWebSocketService
  implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('MobileWebSocketService');
  private connectedClients = new Map<string, MobileSocketConnection>();
  private organizationSockets = new Map<string, Set<string>>(); // orgId -> socketIds
  private connectionSockets = new Map<string, Set<string>>(); // connectionId -> socketIds

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log(
      '🚀 MobileWebSocketService initialized - Real-time mobile communication ready'
    );
  }

  /**
   * Handle new mobile client connections
   */
  async handleConnection(client: Socket): Promise<void> {
    this.logger.log(`📱 Mobile client connected: ${client.id}`);

    try {
      // Extract connection parameters from handshake
      const {
        organizationId,
        userId,
        connectionId,
        platform,
        walletType,
        userAgent
      } = client.handshake.query;

      // Validate required parameters
      if (!organizationId) {
        this.logger.warn(
          `❌ Connection rejected - missing organizationId: ${client.id}`
        );
        client.disconnect();
        return;
      }

      // Create connection record
      const connection: MobileSocketConnection = {
        socketId: client.id,
        organizationId: organizationId as string,
        userId: userId as string,
        connectionId: connectionId as string,
        deviceInfo: {
          platform: (platform as 'ios' | 'android' | 'web') || 'web',
          walletType: (walletType as string) || 'unknown',
          userAgent: (userAgent as string) || 'unknown'
        },
        connectedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      // Store connection
      this.connectedClients.set(client.id, connection);

      // Index by organization
      if (!this.organizationSockets.has(connection.organizationId)) {
        this.organizationSockets.set(connection.organizationId, new Set());
      }
      this.organizationSockets.get(connection.organizationId)?.add(client.id);

      // Index by connection if provided
      if (connection.connectionId) {
        if (!this.connectionSockets.has(connection.connectionId)) {
          this.connectionSockets.set(connection.connectionId, new Set());
        }
        this.connectionSockets.get(connection.connectionId)?.add(client.id);
      }

      // Join organization room
      client.join(`org:${connection.organizationId}`);

      // Join connection room if applicable
      if (connection.connectionId) {
        client.join(`connection:${connection.connectionId}`);
      }

      // Send welcome message
      client.emit('mobile:connected', {
        status: 'connected',
        organizationId: connection.organizationId,
        capabilities: this.getMobileCapabilities(),
        timestamp: new Date().toISOString()
      });

      // Track connection analytics
      await this.trackMobileConnection(connection);

      this.logger.log(
        `✅ Mobile client registered: ${client.id} (org: ${connection.organizationId}, wallet: ${connection.deviceInfo?.walletType})`
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling mobile connection: ${error.message}`
      );
      client.disconnect();
    }
  }

  /**
   * Handle mobile client disconnections
   */
  async handleDisconnect(client: Socket): Promise<void> {
    this.logger.log(`📱 Mobile client disconnected: ${client.id}`);

    try {
      const connection = this.connectedClients.get(client.id);

      if (connection) {
        // Remove from organization index
        this.organizationSockets
          .get(connection.organizationId)
          ?.delete(client.id);

        // Remove from connection index
        if (connection.connectionId) {
          this.connectionSockets
            .get(connection.connectionId)
            ?.delete(client.id);
        }

        // Track disconnection analytics
        await this.trackMobileDisconnection(connection);

        // Clean up empty sets
        if (
          0 === this.organizationSockets.get(connection.organizationId)?.size
        ) {
          this.organizationSockets.delete(connection.organizationId);
        }

        if (
          connection.connectionId &&
          0 === this.connectionSockets.get(connection.connectionId)?.size
        ) {
          this.connectionSockets.delete(connection.connectionId);
        }
      }

      // Remove connection record
      this.connectedClients.delete(client.id);
    } catch (error) {
      this.logger.error(
        `❌ Error handling mobile disconnection: ${error.message}`
      );
    }
  }

  /**
   * Handle mobile wallet status updates
   */
  @SubscribeMessage('mobile:status')
  async handleMobileStatus(
    client: Socket,
    payload: { status: string; data?: Record<string, unknown> }
  ): Promise<void> {
    this.logger.log(
      `📱 Mobile status update: ${client.id} - ${payload.status}`
    );

    const connection = this.connectedClients.get(client.id);
    if (!connection) {
      return;
    }

    // Update last activity
    connection.lastActivity = new Date().toISOString();

    // Broadcast status to organization
    this.server
      .to(`org:${connection.organizationId}`)
      .emit('mobile:status:update', {
        socketId: client.id,
        organizationId: connection.organizationId,
        connectionId: connection.connectionId,
        status: payload.status,
        data: payload.data,
        timestamp: new Date().toISOString()
      });

    // Send to backend for processing
    await this.natsClient
      .send(
        { cmd: 'mobile-status-update' },
        {
          connection,
          status: payload.status,
          data: payload.data
        }
      )
      .toPromise();
  }

  /**
   * Handle mobile invitation acceptance
   */
  @SubscribeMessage('mobile:invitation:accept')
  async handleInvitationAccept(
    client: Socket,
    payload: { invitationId: string; data?: Record<string, unknown> }
  ): Promise<void> {
    this.logger.log(
      `📱 Mobile invitation accepted: ${client.id} - ${payload.invitationId}`
    );

    const connection = this.connectedClients.get(client.id);
    if (!connection) {
      return;
    }

    connection.lastActivity = new Date().toISOString();

    // Process invitation acceptance
    await this.natsClient
      .send(
        { cmd: 'mobile-invitation-accept' },
        {
          connection,
          invitationId: payload.invitationId,
          data: payload.data
        }
      )
      .toPromise();

    // Confirm to mobile client
    client.emit('mobile:invitation:accepted', {
      invitationId: payload.invitationId,
      status: 'processing',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle mobile credential responses
   */
  @SubscribeMessage('mobile:credential:response')
  async handleCredentialResponse(
    client: Socket,
    payload: {
      credentialId: string;
      action: 'accept' | 'reject';
      data?: Record<string, unknown>;
    }
  ): Promise<void> {
    this.logger.log(
      `📱 Mobile credential response: ${client.id} - ${payload.credentialId} (${payload.action})`
    );

    const connection = this.connectedClients.get(client.id);
    if (!connection) {
      return;
    }

    connection.lastActivity = new Date().toISOString();

    // Process credential response
    await this.natsClient
      .send(
        { cmd: 'mobile-credential-response' },
        {
          connection,
          credentialId: payload.credentialId,
          action: payload.action,
          data: payload.data
        }
      )
      .toPromise();

    // Confirm to mobile client
    client.emit('mobile:credential:response:confirmed', {
      credentialId: payload.credentialId,
      action: payload.action,
      status: 'processing',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send real-time notification to specific organization
   */
  async sendToOrganization(
    organizationId: string,
    notification: MobileNotificationPayload
  ): Promise<void> {
    this.logger.log(
      `📢 Sending notification to organization: ${organizationId} - ${notification.eventType}`
    );

    const socketIds = this.organizationSockets.get(organizationId);
    if (!socketIds || 0 === socketIds.size) {
      this.logger.log(
        `📱 No connected mobile clients for organization: ${organizationId}`
      );
      return;
    }

    // Send to all organization sockets
    this.server
      .to(`org:${organizationId}`)
      .emit('mobile:notification', notification);

    this.logger.log(
      `✅ Notification sent to ${socketIds.size} mobile clients in organization: ${organizationId}`
    );
  }

  /**
   * Send real-time notification to specific connection
   */
  async sendToConnection(
    connectionId: string,
    notification: MobileNotificationPayload
  ): Promise<void> {
    this.logger.log(
      `📢 Sending notification to connection: ${connectionId} - ${notification.eventType}`
    );

    const socketIds = this.connectionSockets.get(connectionId);
    if (!socketIds || 0 === socketIds.size) {
      this.logger.log(
        `📱 No connected mobile clients for connection: ${connectionId}`
      );
      return;
    }

    // Send to all connection sockets
    this.server
      .to(`connection:${connectionId}`)
      .emit('mobile:notification', notification);

    this.logger.log(
      `✅ Notification sent to ${socketIds.size} mobile clients for connection: ${connectionId}`
    );
  }

  /**
   * Send notification to specific socket
   */
  async sendToSocket(
    socketId: string,
    notification: MobileNotificationPayload
  ): Promise<void> {
    this.logger.log(
      `📢 Sending notification to socket: ${socketId} - ${notification.eventType}`
    );

    const socket = this.server.sockets.sockets.get(socketId);
    if (!socket) {
      this.logger.log(`📱 Socket not found: ${socketId}`);
      return;
    }

    socket.emit('mobile:notification', notification);

    this.logger.log(`✅ Notification sent to socket: ${socketId}`);
  }

  /**
   * Broadcast notification to all connected mobile clients
   */
  async broadcastToAll(notification: MobileNotificationPayload): Promise<void> {
    this.logger.log(
      `📢 Broadcasting notification to all mobile clients - ${notification.eventType}`
    );

    this.server.emit('mobile:notification', notification);

    this.logger.log(
      `✅ Notification broadcasted to ${this.connectedClients.size} mobile clients`
    );
  }

  /**
   * Get mobile capabilities for client
   */
  private getMobileCapabilities(): Record<string, boolean> {
    return {
      realTimeNotifications: true,
      credentialOffers: true,
      proofRequests: true,
      connectionTracking: true,
      backgroundSync: true,
      pushNotifications: false, // Will be enabled in Step 4
      offlineMode: false
    };
  }

  /**
   * Track mobile connection for analytics
   */
  private async trackMobileConnection(
    connection: MobileSocketConnection
  ): Promise<void> {
    try {
      await this.natsClient
        .send(
          { cmd: 'track-mobile-connection' },
          {
            type: 'websocket_connect',
            connection,
            timestamp: new Date().toISOString()
          }
        )
        .toPromise();
    } catch (error) {
      this.logger.error('Error tracking mobile connection:', error);
    }
  }

  /**
   * Track mobile disconnection for analytics
   */
  private async trackMobileDisconnection(
    connection: MobileSocketConnection
  ): Promise<void> {
    try {
      await this.natsClient
        .send(
          { cmd: 'track-mobile-disconnection' },
          {
            type: 'websocket_disconnect',
            connection,
            duration: Date.now() - new Date(connection.connectedAt).getTime(),
            timestamp: new Date().toISOString()
          }
        )
        .toPromise();
    } catch (error) {
      this.logger.error('Error tracking mobile disconnection:', error);
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    connectionsByOrganization: Record<string, number>;
    connectionsByWallet: Record<string, number>;
    connectionsByPlatform: Record<string, number>;
  } {
    const stats = {
      totalConnections: this.connectedClients.size,
      connectionsByOrganization: {} as Record<string, number>,
      connectionsByWallet: {} as Record<string, number>,
      connectionsByPlatform: {} as Record<string, number>
    };

    for (const connection of this.connectedClients.values()) {
      // Count by organization
      stats.connectionsByOrganization[connection.organizationId] =
        (stats.connectionsByOrganization[connection.organizationId] || 0) + 1;

      // Count by wallet type
      const walletType = connection.deviceInfo?.walletType || 'unknown';
      stats.connectionsByWallet[walletType] =
        (stats.connectionsByWallet[walletType] || 0) + 1;

      // Count by platform
      const platform = connection.deviceInfo?.platform || 'unknown';
      stats.connectionsByPlatform[platform] =
        (stats.connectionsByPlatform[platform] || 0) + 1;
    }

    return stats;
  }
}
