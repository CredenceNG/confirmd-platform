import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

// FCM-specific interfaces for push notifications
export interface FCMDeviceRegistration {
  token: string; // FCM device token
  userId: string;
  organizationId?: string;
  platform: 'android' | 'ios' | 'web';
  metadata?: {
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
  };
}

export interface FCMStoredDevice {
  userId: string;
  organizationId?: string;
  connectionId?: string;
  deviceToken: string;
  platform: 'android' | 'ios' | 'web';
  appVersion?: string;
  registeredAt: string;
  lastActive: string;
  preferences: {
    enablePush: boolean;
    enableSound: boolean;
    enableVibration: boolean;
    quietHours?: {
      start: string;
      end: string;
    };
    categories: string[];
  };
}

export interface FCMSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  failureCount: number;
  successCount: number;
  canonicalIds: number;
  multicastId?: string;
  results?: {
    messageId?: string;
    registrationId?: string;
    error?: string;
  }[];
}

export interface FCMNotification {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
  badge?: number;
  tag?: string;
  color?: string;
  clickAction?: string;
  bodyLocKey?: string;
  bodyLocArgs?: string[];
  titleLocKey?: string;
  titleLocArgs?: string[];
}

export interface FCMStats {
  totalDevices: number;
  activeDevices: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesFailed: number;
  lastUpdated: string;
  platformBreakdown: {
    android: number;
    ios: number;
    web: number;
  };
  recentActivity: {
    timestamp: string;
    action: string;
    count: number;
  }[];
}

@Injectable()
export class MobileFCMService {
  private readonly logger = new Logger(MobileFCMService.name);
  private readonly deviceRegistrations: Map<string, FCMStoredDevice> =
    new Map();
  private readonly fcmStats = {
    totalDevices: 0,
    activeDevices: 0,
    messagesSent: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    lastUpdated: new Date().toISOString()
  };

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log('Mobile FCM Service initialized');
  }

  /**
   * Register a device for FCM push notifications
   */
  async registerDevice(
    deviceRegistration: FCMDeviceRegistration
  ): Promise<FCMStoredDevice> {
    try {
      this.logger.log('Registering FCM device:', deviceRegistration);

      // Validate device token format (mock validation)
      const isValidToken = await this.validateDeviceToken(
        deviceRegistration.token
      );
      if (!isValidToken) {
        throw new Error('Invalid FCM device token format');
      }

      // Create stored device record
      const storedDevice: FCMStoredDevice = {
        userId: deviceRegistration.userId,
        organizationId: deviceRegistration.organizationId,
        deviceToken: deviceRegistration.token,
        platform: deviceRegistration.platform,
        appVersion: deviceRegistration.metadata?.appVersion || '1.0.0',
        registeredAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        preferences: {
          enablePush: true,
          enableSound: true,
          enableVibration: true,
          categories: ['all', 'connections', 'credentials', 'messages']
        }
      };

      // Store device registration
      this.deviceRegistrations.set(deviceRegistration.token, storedDevice);

      // Update stats
      this.fcmStats.totalDevices = this.deviceRegistrations.size;
      this.fcmStats.activeDevices = Array.from(
        this.deviceRegistrations.values()
      ).filter((device) => this.isDeviceActive(device)).length;
      this.fcmStats.lastUpdated = new Date().toISOString();

      // Emit device registration event
      await this.emitDeviceEvent('fcm_device_registered', {
        userId: deviceRegistration.userId,
        organizationId: deviceRegistration.organizationId,
        platform: deviceRegistration.platform,
        timestamp: new Date().toISOString()
      });

      this.logger.log(
        `FCM device registered successfully for user: ${deviceRegistration.userId}`
      );
      return storedDevice;
    } catch (error) {
      this.logger.error('Failed to register FCM device:', error);
      throw new Error(
        `FCM device registration failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Unregister a device from FCM push notifications
   */
  async unregisterDevice(token: string): Promise<boolean> {
    try {
      this.logger.log('Unregistering FCM device:', { token });

      const device = this.deviceRegistrations.get(token);
      if (!device) {
        this.logger.warn(`FCM device not found for token: ${token}`);
        return false;
      }

      // Remove device registration
      this.deviceRegistrations.delete(token);

      // Update stats
      this.fcmStats.totalDevices = this.deviceRegistrations.size;
      this.fcmStats.activeDevices = Array.from(
        this.deviceRegistrations.values()
      ).filter((device) => this.isDeviceActive(device)).length;
      this.fcmStats.lastUpdated = new Date().toISOString();

      // Emit device unregistration event
      await this.emitDeviceEvent('fcm_device_unregistered', {
        userId: device.userId,
        organizationId: device.organizationId,
        platform: device.platform,
        timestamp: new Date().toISOString()
      });

      this.logger.log(
        `FCM device unregistered successfully for user: ${device.userId}`
      );
      return true;
    } catch (error) {
      this.logger.error('Failed to unregister FCM device:', error);
      return false;
    }
  }

  /**
   * Send FCM push notification to a specific device
   */
  async sendToDevice(
    token: string,
    notification: FCMNotification,
    data?: Record<string, string>
  ): Promise<FCMSendResult> {
    try {
      this.logger.log('Sending FCM to device:', { token, notification, data });

      const device = this.deviceRegistrations.get(token);
      if (!device) {
        return {
          success: false,
          error: 'Device not registered',
          failureCount: 1,
          successCount: 0,
          canonicalIds: 0
        };
      }

      // Check if device has push notifications enabled
      if (!device.preferences.enablePush) {
        this.logger.log('Push notifications disabled for device:', token);
        return {
          success: false,
          error: 'Push notifications disabled',
          failureCount: 1,
          successCount: 0,
          canonicalIds: 0
        };
      }

      // Mock FCM send (replace with actual Firebase Admin SDK call)
      const mockResult = await this.mockFCMSend(token, notification, data);

      // Update stats
      this.fcmStats.messagesSent++;
      if (mockResult.success) {
        this.fcmStats.messagesDelivered++;
      } else {
        this.fcmStats.messagesFailed++;
      }
      this.fcmStats.lastUpdated = new Date().toISOString();

      // Update device last active
      device.lastActive = new Date().toISOString();

      this.logger.log('FCM message sent successfully to device:', token);
      return mockResult;
    } catch (error) {
      this.logger.error('Failed to send FCM to device:', error);
      this.fcmStats.messagesFailed++;
      this.fcmStats.lastUpdated = new Date().toISOString();

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: 1,
        successCount: 0,
        canonicalIds: 0
      };
    }
  }

  /**
   * Send FCM push notification to all devices of a user
   */
  async sendToUser(
    userId: string,
    notification: FCMNotification,
    data?: Record<string, string>
  ): Promise<FCMSendResult> {
    try {
      this.logger.log('Sending FCM to user:', { userId, notification, data });

      const userDevices = Array.from(this.deviceRegistrations.values()).filter(
        (device) => device.userId === userId && device.preferences.enablePush
      );

      if (0 === userDevices.length) {
        return {
          success: false,
          error: 'No registered devices found for user',
          failureCount: 1,
          successCount: 0,
          canonicalIds: 0
        };
      }

      let successCount = 0;
      let failureCount = 0;
      const results: FCMSendResult[] = [];

      for (const device of userDevices) {
        const result = await this.sendToDevice(
          device.deviceToken,
          notification,
          data
        );
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
        results.push(result);
      }

      this.logger.log(
        `FCM messages sent to user ${userId}: ${successCount} success, ${failureCount} failed`
      );

      return {
        success: 0 < successCount,
        failureCount,
        successCount,
        canonicalIds: 0,
        results
      };
    } catch (error) {
      this.logger.error('Failed to send FCM to user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: 1,
        successCount: 0,
        canonicalIds: 0
      };
    }
  }

  /**
   * Send FCM push notification to all devices in an organization
   */
  async sendToOrganization(
    organizationId: string,
    notification: FCMNotification,
    data?: Record<string, string>
  ): Promise<FCMSendResult> {
    try {
      this.logger.log('Sending FCM to organization:', {
        organizationId,
        notification,
        data
      });

      const orgDevices = Array.from(this.deviceRegistrations.values()).filter(
        (device) => device.organizationId === organizationId &&
          device.preferences.enablePush
      );

      if (0 === orgDevices.length) {
        return {
          success: false,
          error: 'No registered devices found for organization',
          failureCount: 1,
          successCount: 0,
          canonicalIds: 0
        };
      }

      // Send to multiple devices efficiently
      const tokens = orgDevices.map((device) => device.deviceToken);
      const result = await this.mockFCMMulticast(tokens, notification, data);

      // Update stats
      this.fcmStats.messagesSent += tokens.length;
      this.fcmStats.messagesDelivered += result.successCount;
      this.fcmStats.messagesFailed += result.failureCount;
      this.fcmStats.lastUpdated = new Date().toISOString();

      this.logger.log(
        `FCM messages sent to organization ${organizationId}: ${result.successCount} success, ${result.failureCount} failed`
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to send FCM to organization:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: 1,
        successCount: 0,
        canonicalIds: 0
      };
    }
  }

  /**
   * Get FCM service statistics
   */
  async getFCMStats(): Promise<FCMStats> {
    const platformStats = {
      android: 0,
      ios: 0,
      web: 0
    };

    Array.from(this.deviceRegistrations.values()).forEach((device) => {
      platformStats[device.platform]++;
    });

    return {
      ...this.fcmStats,
      platformBreakdown: platformStats,
      recentActivity: this.getRecentActivity()
    };
  }

  /**
   * Get all devices for a specific user
   */
  async getUserDevices(userId: string): Promise<FCMStoredDevice[]> {
    return Array.from(this.deviceRegistrations.values()).filter(
      (device) => device.userId === userId
    );
  }

  // Private helper methods

  private async validateDeviceToken(token: string): Promise<boolean> {
    // Mock validation - in real implementation, validate with Firebase
    return Boolean(token && 10 < token.length);
  }

  private isDeviceActive(device: FCMStoredDevice): boolean {
    const lastActive = new Date(device.lastActive);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastActive > thirtyDaysAgo;
  }

  private async mockFCMSend(
    _token: string,
    _notification: FCMNotification,
    _data?: Record<string, string>
  ): Promise<FCMSendResult> {
    // Mock FCM send - replace with actual Firebase Admin SDK
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate network delay

    const mockMessageId = `mock_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      success: true,
      messageId: mockMessageId,
      failureCount: 0,
      successCount: 1,
      canonicalIds: 0
    };
  }

  private async mockFCMMulticast(
    tokens: string[],
    _notification: FCMNotification,
    _data?: Record<string, string>
  ): Promise<FCMSendResult> {
    // Mock FCM multicast - replace with actual Firebase Admin SDK
    await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate network delay

    const mockMulticastId = `multicast_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      success: true,
      multicastId: mockMulticastId,
      failureCount: 0,
      successCount: tokens.length,
      canonicalIds: 0,
      results: tokens.map((token) => ({
        messageId: `msg_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 5)}`,
        registrationId: token
      }))
    };
  }

  private getRecentActivity(): {
    timestamp: string;
    action: string;
    count: number;
  }[] {
    // Return mock recent activity
    return [
      {
        timestamp: new Date().toISOString(),
        action: 'message_sent',
        count: 5
      }
    ];
  }

  private async emitDeviceEvent(
    eventType: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      // Emit event via NATS for other services to consume
      await this.natsClient.emit(`mobile.fcm.${eventType}`, {
        eventType,
        timestamp: new Date().toISOString(),
        data: eventData
      });
    } catch (error) {
      this.logger.error('Failed to emit FCM device event:', error);
    }
  }
}
