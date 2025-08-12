import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

// Firebase admin is optional - will use mock notifications if not available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: any = null;
try {
  admin = require('firebase-admin');
} catch (error) {
  // Firebase admin not available - will use mock notifications
}

// Mobile Push Notification interfaces
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  sound?: string;
  data?: Record<string, string>;
  clickAction?: string;
  tag?: string;
}

export interface MobileDevice {
  deviceId: string;
  userId: string;
  platform: 'android' | 'ios';
  fcmToken: string;
  appVersion: string;
  isActive: boolean;
  registeredAt: string;
  lastSeen: string;
}

export interface NotificationTemplate {
  templateId: string;
  name: string;
  title: string;
  body: string;
  category: 'connection' | 'credential' | 'proof' | 'message' | 'system';
  priority: 'high' | 'normal' | 'low';
  requiresAction: boolean;
  actionButtons?: NotificationAction[];
}

export interface NotificationAction {
  actionId: string;
  title: string;
  icon?: string;
  inputPlaceholder?: string;
  requiresInput?: boolean;
}

export interface PushNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deviceToken?: string;
}

@Injectable()
export class MobilePushNotificationService {
  private readonly logger = new Logger(MobilePushNotificationService.name);
  private readonly devices: Map<string, MobileDevice> = new Map();
  private readonly templates: Map<string, NotificationTemplate> = new Map();
  private isFirebaseInitialized = false;

  constructor(@Inject('NATS_CLIENT') private readonly natsClient: ClientProxy) {
    this.logger.log('Mobile Push Notification Service initialized');
    this.initializeFirebase();
    this.setupNotificationTemplates();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private async initializeFirebase(): Promise<void> {
    try {
      // Check if Firebase is already initialized
      if (0 < admin.apps.length) {
        this.isFirebaseInitialized = true;
        this.logger.log('Firebase Admin already initialized');
        return;
      }

      // Initialize Firebase with service account
      const serviceAccount = this.getFirebaseServiceAccount();
      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });
        this.isFirebaseInitialized = true;
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.logger.warn('Firebase service account not configured - push notifications will be mocked');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
      this.logger.warn('Push notifications will be mocked until Firebase is properly configured');
    }
  }

  /**
   * Get Firebase service account from environment variables
   */
  private getFirebaseServiceAccount(): Record<string, unknown> | null {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      }

      if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_PRIVATE_KEY &&
        process.env.FIREBASE_CLIENT_EMAIL
      ) {
        return {
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Error parsing Firebase service account:', error);
      return null;
    }
  }

  /**
   * Setup predefined notification templates
   */
  private setupNotificationTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        templateId: 'connection-invitation',
        name: 'Connection Invitation',
        title: 'New Connection Invitation',
        body: 'You have received a new connection invitation from {organizationName}',
        category: 'connection',
        priority: 'high',
        requiresAction: true,
        actionButtons: [
          { actionId: 'accept', title: 'Accept', icon: 'check' },
          { actionId: 'decline', title: 'Decline', icon: 'close' }
        ]
      },
      {
        templateId: 'connection-established',
        name: 'Connection Established',
        title: 'Connection Established',
        body: 'Successfully connected with {organizationName}',
        category: 'connection',
        priority: 'normal',
        requiresAction: false
      },
      {
        templateId: 'credential-offer',
        name: 'Credential Offer',
        title: 'New Credential Offer',
        body: '{organizationName} is offering you a {credentialType} credential',
        category: 'credential',
        priority: 'high',
        requiresAction: true,
        actionButtons: [
          { actionId: 'accept', title: 'Accept', icon: 'check' },
          { actionId: 'decline', title: 'Decline', icon: 'close' }
        ]
      },
      {
        templateId: 'credential-received',
        name: 'Credential Received',
        title: 'Credential Received',
        body: 'You have successfully received a {credentialType} credential',
        category: 'credential',
        priority: 'normal',
        requiresAction: false
      },
      {
        templateId: 'proof-request',
        name: 'Proof Request',
        title: 'Proof Request',
        body: '{organizationName} is requesting proof of {proofType}',
        category: 'proof',
        priority: 'high',
        requiresAction: true,
        actionButtons: [
          { actionId: 'present', title: 'Present Proof', icon: 'share' },
          { actionId: 'decline', title: 'Decline', icon: 'close' }
        ]
      },
      {
        templateId: 'basic-message',
        name: 'Message Received',
        title: 'New Message',
        body: 'You have a new message from {senderName}',
        category: 'message',
        priority: 'normal',
        requiresAction: false
      }
    ];

    templates.forEach((template) => {
      this.templates.set(template.templateId, template);
    });

    this.logger.log(`Setup ${templates.length} notification templates`);
  }

  /**
   * Register a mobile device for push notifications
   */
  public async registerDevice(
    userId: string,
    deviceId: string,
    fcmToken: string,
    platform: 'android' | 'ios',
    appVersion: string = '1.0.0'
  ): Promise<void> {
    try {
      const device: MobileDevice = {
        deviceId,
        userId,
        platform,
        fcmToken,
        appVersion,
        isActive: true,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      };

      this.devices.set(deviceId, device);
      
      this.logger.log(`Mobile device registered for push notifications`, {
        deviceId,
        userId,
        platform
      });

      // Emit device registration event
      await this.emitNotificationEvent('device-registered', {
        device,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to register mobile device:', error);
      throw error;
    }
  }

  /**
   * Unregister a mobile device
   */
  public async unregisterDevice(deviceId: string): Promise<void> {
    try {
      const device = this.devices.get(deviceId);
      if (device) {
        device.isActive = false;
        this.devices.set(deviceId, device);
        
        this.logger.log(`Mobile device unregistered: ${deviceId}`);
        
        // Emit device unregistration event
        await this.emitNotificationEvent('device-unregistered', {
          deviceId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to unregister mobile device:', error);
      throw error;
    }
  }

  /**
   * Send push notification using template
   */
  public async sendNotificationFromTemplate(
    templateId: string,
    deviceId: string,
    variables: Record<string, string> = {},
    customData: Record<string, string> = {}
  ): Promise<PushNotificationResult> {
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Notification template not found: ${templateId}`);
      }

      const device = this.devices.get(deviceId);
      if (!device || !device.isActive) {
        throw new Error(`Device not found or inactive: ${deviceId}`);
      }

      // Replace variables in template
      const title = this.replaceVariables(template.title, variables);
      const body = this.replaceVariables(template.body, variables);

      const payload: PushNotificationPayload = {
        title,
        body,
        icon: 'ic_notification',
        sound: 'default',
        data: {
          ...customData,
          templateId,
          category: template.category,
          priority: template.priority,
          requiresAction: template.requiresAction.toString()
        }
      };

      return await this.sendPushNotification(device.fcmToken, payload);
    } catch (error) {
      this.logger.error('Failed to send notification from template:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send push notification to user's devices
   */
  public async sendNotificationToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult[]> {
    try {
      const userDevices = Array.from(this.devices.values()).filter(
        (device) => device.userId === userId && device.isActive
      );

      if (0 === userDevices.length) {
        this.logger.warn(`No active devices found for user: ${userId}`);
        return [];
      }

      const results = await Promise.all(
        userDevices.map((device) => this.sendPushNotification(device.fcmToken, payload)
        )
      );

      this.logger.log(`Sent notifications to ${userDevices.length} devices for user: ${userId}`);
      return results;
    } catch (error) {
      this.logger.error('Failed to send notifications to user:', error);
      return [
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      ];
    }
  }

  /**
   * Send push notification to specific device token
   */
  public async sendPushNotification(
    fcmToken: string,
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult> {
    try {
      if (!this.isFirebaseInitialized) {
        // Mock notification for development/testing
        return await this.mockPushNotification(fcmToken, payload);
      }

      const message: Record<string, unknown> = {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.icon
        },
        data: payload.data || {},
        android: {
          notification: {
            icon: payload.icon || 'ic_notification',
            sound: payload.sound || 'default',
            tag: payload.tag,
            clickAction: payload.clickAction
          },
          priority: 'high'
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body
              },
              badge: payload.badge ? parseInt(payload.badge, 10) : undefined,
              sound: payload.sound || 'default'
            }
          }
        }
      };

      const messageId = await admin.messaging().send(message);
      
      this.logger.log(`Push notification sent successfully: ${messageId}`, {
        fcmToken: `${fcmToken.substring(0, 20)}...`,
        title: payload.title
      });

      // Emit notification sent event
      await this.emitNotificationEvent('notification-sent', {
        messageId,
        fcmToken: `${fcmToken.substring(0, 20)}...`,
        payload,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        messageId,
        deviceToken: fcmToken
      };
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
      
      // Emit notification error event
      await this.emitNotificationEvent('notification-error', {
        fcmToken: `${fcmToken.substring(0, 20)}...`,
        payload,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deviceToken: fcmToken
      };
    }
  }

  /**
   * Send connection invitation notification
   */
  public async sendConnectionInvitationNotification(
    deviceId: string,
    organizationName: string,
    invitationId: string
  ): Promise<PushNotificationResult> {
    return await this.sendNotificationFromTemplate(
      'connection-invitation',
      deviceId,
      { organizationName },
      { invitationId, type: 'connection-invitation' }
    );
  }

  /**
   * Send connection established notification
   */
  public async sendConnectionEstablishedNotification(
    deviceId: string,
    organizationName: string,
    connectionId: string
  ): Promise<PushNotificationResult> {
    return await this.sendNotificationFromTemplate(
      'connection-established',
      deviceId,
      { organizationName },
      { connectionId, type: 'connection-established' }
    );
  }

  /**
   * Send credential offer notification
   */
  public async sendCredentialOfferNotification(
    deviceId: string,
    organizationName: string,
    credentialType: string,
    offerId: string
  ): Promise<PushNotificationResult> {
    return await this.sendNotificationFromTemplate(
      'credential-offer',
      deviceId,
      { organizationName, credentialType },
      { offerId, type: 'credential-offer' }
    );
  }

  /**
   * Send proof request notification
   */
  public async sendProofRequestNotification(
    deviceId: string,
    organizationName: string,
    proofType: string,
    requestId: string
  ): Promise<PushNotificationResult> {
    return await this.sendNotificationFromTemplate(
      'proof-request',
      deviceId,
      { organizationName, proofType },
      { requestId, type: 'proof-request' }
    );
  }

  /**
   * Get notification templates
   */
  public getNotificationTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get registered devices for user
   */
  public getUserDevices(userId: string): MobileDevice[] {
    return Array.from(this.devices.values()).filter(
      (device) => device.userId === userId && device.isActive
    );
  }

  // Private helper methods

  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    return result;
  }

  private async mockPushNotification(
    fcmToken: string,
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult> {
    // Mock implementation for development/testing
    const mockMessageId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log('📱 MOCK PUSH NOTIFICATION:', {
      fcmToken: `${fcmToken.substring(0, 20)}...`,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      messageId: mockMessageId
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: mockMessageId,
      deviceToken: fcmToken
    };
  }

  private async emitNotificationEvent(
    eventType: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.natsClient.emit(`mobile.notification.${eventType}`, data);
    } catch (error) {
      this.logger.error(`Failed to emit notification event: ${eventType}`, error);
    }
  }
}
