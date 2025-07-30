import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import {
  MobileWebSocketService,
  MobileNotificationPayload,
} from "./mobile-websocket.service";
// import { MobileFCMService } from "./mobile-fcm.service";
import {
  MobileWebhookEventType,
  MobileNotificationConfig,
  NotificationDeliveryPreferences,
} from "../interfaces/mobile-agent.interfaces";

// Mock FCM Service until dependencies are available
class MockMobileFCMService {
  async sendNotification(): Promise<boolean> {
    return true;
  }
  async sendMulticastNotification(): Promise<{
    successCount: number;
    failureCount: number;
  }> {
    return { successCount: 1, failureCount: 0 };
  }
  async sendToDevice(): Promise<{
    successCount: number;
    failureCount: number;
  }> {
    return { successCount: 1, failureCount: 0 };
  }
  async sendToOrganization(): Promise<{
    successCount: number;
    failureCount: number;
  }> {
    return { successCount: 1, failureCount: 0 };
  }
}

// Enhanced notification types for mobile real-time communication
export interface NotificationDeliveryResult {
  delivered: boolean;
  channels: string[];
  timestamp: string;
  errors?: string[];
}

export interface NotificationQueue {
  id: string;
  organizationId: string;
  userId?: string;
  connectionId?: string;
  notification: MobileNotificationPayload;
  scheduledFor: string;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "delivered" | "failed" | "cancelled";
}

@Injectable()
export class MobileNotificationService {
  private readonly logger = new Logger("MobileNotificationService");
  private notificationQueue = new Map<string, NotificationQueue>();
  private deliveryStats = {
    total: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
  };

  constructor(
    @Inject("NATS_CLIENT") private readonly natsClient: ClientProxy,
    private readonly mobileWebSocketService: MobileWebSocketService,
    private readonly mobileFCMService: MockMobileFCMService = new MockMobileFCMService()
  ) {
    this.logger.log(
      "🚀 MobileNotificationService initialized - Real-time notification delivery ready"
    );
    this.startNotificationProcessor();
  }

  /**
   * Send real-time notification with intelligent routing
   */
  async sendNotification(
    organizationId: string,
    eventType: MobileWebhookEventType,
    data: Record<string, unknown>,
    options?: {
      userId?: string;
      connectionId?: string;
      priority?: "high" | "normal" | "low";
      channels?: string[];
      scheduled?: Date;
    }
  ): Promise<NotificationDeliveryResult> {
    this.logger.log(
      `📢 Sending mobile notification: ${eventType} to org: ${organizationId}`
    );

    try {
      // Get notification configuration for organization
      const notificationConfig = await this.getNotificationConfig(
        organizationId
      );

      // Create notification payload
      const notification: MobileNotificationPayload = {
        eventType,
        organizationId,
        userId: options?.userId,
        connectionId: options?.connectionId,
        data,
        timestamp: new Date().toISOString(),
        priority: options?.priority || "normal",
      };

      // Apply notification template if available
      const templatedNotification = await this.applyNotificationTemplate(
        notification,
        notificationConfig
      );

      // Check delivery preferences and quiet hours
      if (
        !this.canDeliver(
          templatedNotification,
          notificationConfig?.deliveryPreferences
        )
      ) {
        return await this.queueNotification(
          templatedNotification,
          options?.scheduled
        );
      }

      // Deliver notification across channels
      const result = await this.deliverNotification(
        templatedNotification,
        options?.channels
      );

      // Track delivery analytics
      await this.trackNotificationDelivery(templatedNotification, result);

      this.updateDeliveryStats(result.delivered);

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error sending mobile notification: ${error.message}`
      );
      this.updateDeliveryStats(false);

      return {
        delivered: false,
        channels: [],
        timestamp: new Date().toISOString(),
        errors: [error.message],
      };
    }
  }

  /**
   * Send notification to specific connection
   */
  async sendToConnection(
    connectionId: string,
    eventType: MobileWebhookEventType,
    data: Record<string, unknown>,
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<NotificationDeliveryResult> {
    this.logger.log(`📱 Sending notification to connection: ${connectionId}`);

    const notification: MobileNotificationPayload = {
      eventType,
      organizationId: "", // Will be resolved from connection
      connectionId,
      data,
      timestamp: new Date().toISOString(),
      priority,
    };

    // Resolve organization from connection
    const connectionInfo = await this.resolveConnectionOrganization(
      connectionId
    );
    if (connectionInfo) {
      notification.organizationId = connectionInfo.organizationId;
      notification.userId = connectionInfo.userId;
    }

    // Send via WebSocket
    await this.mobileWebSocketService.sendToConnection(
      connectionId,
      notification
    );

    return {
      delivered: true,
      channels: ["websocket"],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Broadcast notification to all connected mobile clients
   */
  async broadcastNotification(
    eventType: MobileWebhookEventType,
    data: Record<string, unknown>,
    priority: "high" | "normal" | "low" = "normal"
  ): Promise<NotificationDeliveryResult> {
    this.logger.log(`📡 Broadcasting notification: ${eventType}`);

    const notification: MobileNotificationPayload = {
      eventType,
      organizationId: "broadcast",
      data,
      timestamp: new Date().toISOString(),
      priority,
    };

    // Broadcast via WebSocket
    await this.mobileWebSocketService.broadcastToAll(notification);

    return {
      delivered: true,
      channels: ["websocket-broadcast"],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Schedule notification for future delivery
   */
  async scheduleNotification(
    organizationId: string,
    eventType: MobileWebhookEventType,
    data: Record<string, unknown>,
    scheduledFor: Date,
    options?: {
      userId?: string;
      connectionId?: string;
      priority?: "high" | "normal" | "low";
    }
  ): Promise<string> {
    this.logger.log(
      `⏰ Scheduling notification for: ${scheduledFor.toISOString()}`
    );

    const notification: MobileNotificationPayload = {
      eventType,
      organizationId,
      userId: options?.userId,
      connectionId: options?.connectionId,
      data,
      timestamp: new Date().toISOString(),
      priority: options?.priority || "normal",
    };

    const queueItem: NotificationQueue = {
      id: this.generateNotificationId(),
      organizationId,
      userId: options?.userId,
      connectionId: options?.connectionId,
      notification,
      scheduledFor: scheduledFor.toISOString(),
      attempts: 0,
      maxAttempts: 3,
      status: "pending",
    };

    this.notificationQueue.set(queueItem.id, queueItem);
    this.deliveryStats.pending++;

    return queueItem.id;
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<boolean> {
    const queueItem = this.notificationQueue.get(notificationId);
    if (queueItem && "pending" === queueItem.status) {
      queueItem.status = "cancelled";
      this.notificationQueue.delete(notificationId);
      this.deliveryStats.pending--;
      return true;
    }
    return false;
  }

  /**
   * Process connection events for real-time notifications
   */
  async handleConnectionEvent(
    organizationId: string,
    connectionId: string,
    eventType: MobileWebhookEventType,
    eventData: Record<string, unknown>
  ): Promise<void> {
    this.logger.log(
      `🔗 Handling connection event: ${eventType} for connection: ${connectionId}`
    );

    // Send real-time notification
    await this.sendToConnection(
      connectionId,
      eventType,
      {
        connectionId,
        state: eventData.state,
        previousState: eventData.previousState,
        metadata: eventData.metadata,
        timestamp: new Date().toISOString(),
      },
      "high"
    );

    // Also notify organization
    await this.sendNotification(
      organizationId,
      eventType,
      {
        connectionId,
        eventData,
        realTimeUpdate: true,
      },
      {
        connectionId,
        priority: "normal",
      }
    );
  }

  /**
   * Process credential events for real-time notifications
   */
  async handleCredentialEvent(
    organizationId: string,
    credentialId: string,
    connectionId: string,
    eventType: MobileWebhookEventType,
    eventData: Record<string, unknown>
  ): Promise<void> {
    this.logger.log(
      `🎫 Handling credential event: ${eventType} for credential: ${credentialId}`
    );

    // Send to connection
    await this.sendToConnection(
      connectionId,
      eventType,
      {
        credentialId,
        connectionId,
        state: eventData.state,
        credentialType: eventData.credentialType,
        metadata: eventData.metadata,
        timestamp: new Date().toISOString(),
      },
      "high"
    );

    // Notify organization
    await this.sendNotification(
      organizationId,
      eventType,
      {
        credentialId,
        connectionId,
        eventData,
        realTimeUpdate: true,
      },
      {
        connectionId,
        priority: "high",
      }
    );
  }

  /**
   * Apply notification template to notification
   */
  private async applyNotificationTemplate(
    notification: MobileNotificationPayload,
    config?: MobileNotificationConfig
  ): Promise<MobileNotificationPayload> {
    if (!config?.notificationTemplates) {
      return notification;
    }

    const template = config.notificationTemplates.find(
      (t) => t.eventType === notification.eventType
    );

    if (template) {
      return {
        ...notification,
        data: {
          ...notification.data,
          title: template.title,
          body: template.body,
          actionUrl: template.actionUrl,
          iconUrl: template.iconUrl,
          priority: template.priority as "high" | "normal" | "low",
          sound: template.sound,
          category: template.category,
        },
      };
    }

    return notification;
  }

  /**
   * Check if notification can be delivered based on preferences
   */
  private canDeliver(
    notification: MobileNotificationPayload,
    preferences?: NotificationDeliveryPreferences
  ): boolean {
    if (!preferences) {
      return true;
    }

    // Check quiet hours
    if (preferences.quietHours) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      if (
        currentTime >= preferences.quietHours.start &&
        currentTime <= preferences.quietHours.end
      ) {
        this.logger.log(
          `🔕 Notification delayed due to quiet hours: ${currentTime}`
        );
        return false;
      }
    }

    // Check rate limiting
    if (
      preferences.maxNotificationsPerHour &&
      this.isRateLimited(
        notification.organizationId,
        preferences.maxNotificationsPerHour
      )
    ) {
      this.logger.log(
        `🚫 Notification rate limited for org: ${notification.organizationId}`
      );
      return false;
    }

    return true;
  }

  /**
   * Deliver notification across available channels
   */
  private async deliverNotification(
    notification: MobileNotificationPayload,
    channels?: string[]
  ): Promise<NotificationDeliveryResult> {
    const deliveredChannels: string[] = [];
    const errors: string[] = [];

    // WebSocket delivery (always attempted if available)
    try {
      if (notification.connectionId) {
        await this.mobileWebSocketService.sendToConnection(
          notification.connectionId,
          notification
        );
        deliveredChannels.push("websocket-connection");
      } else {
        await this.mobileWebSocketService.sendToOrganization(
          notification.organizationId,
          notification
        );
        deliveredChannels.push("websocket-organization");
      }
    } catch (error) {
      this.logger.error("WebSocket delivery failed:", error);
      errors.push(`WebSocket: ${error.message}`);
    }

    // Email delivery (if requested and enabled)
    if (channels?.includes("email")) {
      try {
        await this.sendEmailNotification(notification);
        deliveredChannels.push("email");
      } catch (error) {
        this.logger.error("Email delivery failed:", error);
        errors.push(`Email: ${error.message}`);
      }
    }

    // Push notification delivery (if requested and enabled)
    if (channels?.includes("push")) {
      try {
        await this.sendPushNotification(notification);
        deliveredChannels.push("push");
      } catch (error) {
        this.logger.error("Push notification delivery failed:", error);
        errors.push(`Push: ${error.message}`);
      }
    }

    return {
      delivered: 0 < deliveredChannels.length,
      channels: deliveredChannels,
      timestamp: new Date().toISOString(),
      errors: 0 < errors.length ? errors : undefined,
    };
  }

  /**
   * Queue notification for later delivery
   */
  private async queueNotification(
    notification: MobileNotificationPayload,
    scheduledFor?: Date
  ): Promise<NotificationDeliveryResult> {
    const queueItem: NotificationQueue = {
      id: this.generateNotificationId(),
      organizationId: notification.organizationId,
      userId: notification.userId,
      connectionId: notification.connectionId,
      notification,
      scheduledFor: (
        scheduledFor || new Date(Date.now() + 60000)
      ).toISOString(), // Default 1 minute later
      attempts: 0,
      maxAttempts: 3,
      status: "pending",
    };

    this.notificationQueue.set(queueItem.id, queueItem);
    this.deliveryStats.pending++;

    this.logger.log(`📥 Notification queued for delivery: ${queueItem.id}`);

    return {
      delivered: false,
      channels: ["queue"],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Start background notification processor
   */
  private startNotificationProcessor(): void {
    setInterval(async () => {
      await this.processNotificationQueue();
    }, 30000); // Process every 30 seconds
  }

  /**
   * Process queued notifications
   */
  private async processNotificationQueue(): Promise<void> {
    const now = new Date();

    for (const [id, queueItem] of this.notificationQueue.entries()) {
      if (
        "pending" === queueItem.status &&
        new Date(queueItem.scheduledFor) <= now
      ) {
        try {
          queueItem.attempts++;

          const result = await this.deliverNotification(queueItem.notification);

          if (result.delivered) {
            queueItem.status = "delivered";
            this.notificationQueue.delete(id);
            this.deliveryStats.pending--;
            this.deliveryStats.delivered++;
          } else if (queueItem.attempts >= queueItem.maxAttempts) {
            queueItem.status = "failed";
            this.notificationQueue.delete(id);
            this.deliveryStats.pending--;
            this.deliveryStats.failed++;
          } else {
            // Reschedule for later
            queueItem.scheduledFor = new Date(
              Date.now() + queueItem.attempts * 60000
            ).toISOString();
          }
        } catch (error) {
          this.logger.error(
            `Error processing queued notification ${id}:`,
            error
          );
          queueItem.attempts++;

          if (queueItem.attempts >= queueItem.maxAttempts) {
            queueItem.status = "failed";
            this.notificationQueue.delete(id);
            this.deliveryStats.pending--;
            this.deliveryStats.failed++;
          }
        }
      }
    }
  }

  /**
   * Helper methods
   */
  private async getNotificationConfig(
    organizationId: string
  ): Promise<MobileNotificationConfig | null> {
    try {
      return await this.natsClient
        .send({ cmd: "get-mobile-notification-config" }, { organizationId })
        .toPromise();
    } catch (error) {
      this.logger.error("Error getting notification config:", error);
      return null;
    }
  }

  private async resolveConnectionOrganization(
    connectionId: string
  ): Promise<{ organizationId: string; userId?: string } | null> {
    try {
      return await this.natsClient
        .send({ cmd: "resolve-connection-organization" }, { connectionId })
        .toPromise();
    } catch (error) {
      this.logger.error("Error resolving connection organization:", error);
      return null;
    }
  }

  private async sendEmailNotification(
    notification: MobileNotificationPayload
  ): Promise<void> {
    // Placeholder for email notification implementation
    await this.natsClient
      .send({ cmd: "send-email-notification" }, notification)
      .toPromise();
  }

  private async sendPushNotification(
    notification: MobileNotificationPayload
  ): Promise<void> {
    try {
      // Send push notification via FCM service
      if (notification.connectionId) {
        // Send to specific connection/user
        const result = await this.mobileFCMService.sendToDevice();

        this.logger.log(
          `📱 Push notification sent to connection ${notification.connectionId}: ${result.successCount}/${result.successCount + result.failureCount}`
        );
      } else {
        // Send to organization
        const result = await this.mobileFCMService.sendToOrganization();

        this.logger.log(
          `📱 Push notification sent to organization ${
            notification.organizationId
          }: ${result.successCount}/${
            result.successCount + result.failureCount
          } successful`
        );
      }
    } catch (error) {
      this.logger.error("Error sending push notification:", error);
      throw error;
    }
  }

  private isRateLimited(_organizationId: string, _maxPerHour: number): boolean {
    // Placeholder for rate limiting implementation
    // This would check the number of notifications sent in the last hour
    return false;
  }

  private generateNotificationId(): string {
    return `mobile_notif_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
  }

  private updateDeliveryStats(delivered: boolean): void {
    this.deliveryStats.total++;
    if (delivered) {
      this.deliveryStats.delivered++;
    } else {
      this.deliveryStats.failed++;
    }
  }

  private async trackNotificationDelivery(
    notification: MobileNotificationPayload,
    result: NotificationDeliveryResult
  ): Promise<void> {
    try {
      await this.natsClient
        .send(
          { cmd: "track-notification-delivery" },
          {
            notification,
            result,
            timestamp: new Date().toISOString(),
          }
        )
        .toPromise();
    } catch (error) {
      this.logger.error("Error tracking notification delivery:", error);
    }
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(): typeof this.deliveryStats {
    return { ...this.deliveryStats };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalQueued: number;
    pending: number;
    processing: number;
    failed: number;
  } {
    const status = {
      totalQueued: this.notificationQueue.size,
      pending: 0,
      processing: 0,
      failed: 0,
    };

    for (const item of this.notificationQueue.values()) {
      switch (item.status) {
        case "pending":
          status.pending++;
          break;
        case "failed":
          status.failed++;
          break;
        default:
          // No action needed for other statuses
          break;
      }
    }

    return status;
  }
}
