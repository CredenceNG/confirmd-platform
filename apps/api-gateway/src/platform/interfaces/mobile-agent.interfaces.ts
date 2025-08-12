// Enhanced Mobile Agent Configuration Service
// Extends existing agent configuration to optimize for mobile wallet interactions

export interface MobileAgentConfig {
  organizationId: string;
  agentLabel: string;

  // Mobile-optimized connection settings
  autoAcceptConnections: boolean;
  autoAcceptCredentials: 'always' | 'contentApproved' | 'never';
  autoAcceptProofs: 'always' | 'contentApproved' | 'never';

  // Mobile-specific endpoints
  webhookUrl: string;
  mobileWebhookUrl?: string; // Enhanced mobile webhook endpoint
  deepLinkBaseUrl?: string; // For mobile app deep links

  // Network configuration
  endpoints: string[];
  ledgerConfig: MobileLedgerConfig[];

  // Mobile wallet compatibility
  walletCompatibility: MobileWalletCompatibility;

  // Real-time configuration
  enableRealTimeNotifications: boolean;
  websocketEndpoint?: string;

  // Mobile-specific features
  mobileFeatures: MobileFeaturesConfig;
}

export interface MobileLedgerConfig {
  name: string;
  genesisUrl: string;
  namespace: string;
  isProduction: boolean;
  mobileOptimized: boolean; // Indicates if ledger supports mobile optimizations
}

export interface MobileWalletCompatibility {
  supportedWallets: string[]; // ['ariesBifold', 'trinsic', 'lissi', 'connectMe']
  protocolVersions: string[]; // ['didcomm/1.0', 'didcomm/2.0']
  transportMethods: string[]; // ['http', 'websocket', 'bluetooth']
  credentialFormats: string[]; // ['indy', 'jsonLD', 'anoncreds']
}

export interface MobileFeaturesConfig {
  enableQRCodeOptimization: boolean;
  enablePushNotifications: boolean;
  enableBackgroundProcessing: boolean;
  enableOfflineMode: boolean;
  maxConnectionsCache: number;
  connectionTimeout: number; // milliseconds
  retryAttempts: number;
}

// Enhanced webhook data structures for mobile events
export interface MobileWebhookData {
  eventType: MobileWebhookEventType;
  organizationId: string;
  agentId: string;
  timestamp: string;
  data: MobileWebhookEventData;
  mobileContext?: MobileContext;
}

export enum MobileWebhookEventType {
  MOBILE_CONNECTION_REQUEST = 'mobile-connection-request',
  MOBILE_CONNECTION_RESPONSE = 'mobile-connection-response',
  MOBILE_CREDENTIAL_OFFER = 'mobile-credential-offer',
  MOBILE_CREDENTIAL_REQUEST = 'mobile-credential-request',
  MOBILE_CREDENTIAL_ISSUED = 'mobile-credential-issued',
  MOBILE_PROOF_REQUEST = 'mobile-proof-request',
  MOBILE_PROOF_PRESENTATION = 'mobile-proof-presentation',
  MOBILE_WALLET_CONNECTED = 'mobile-wallet-connected',
  MOBILE_WALLET_DISCONNECTED = 'mobile-wallet-disconnected',
  MOBILE_ERROR = 'mobile-error',
}

export interface MobileWebhookEventData {
  connectionId?: string;
  credentialId?: string;
  proofId?: string;
  state: string;
  previousState?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface MobileContext {
  walletType: string; // 'ariesBifold', 'trinsic', etc.
  walletVersion: string;
  platformType: 'ios' | 'android' | 'web';
  deviceId?: string;
  userAgent?: string;
  deepLinkOrigin?: string;
}

// Webhook routing configuration for mobile events
export interface MobileWebhookRouting {
  organizationId: string;
  mobileWebhookUrl: string;
  routingRules: MobileRoutingRule[];
  retryPolicy: WebhookRetryPolicy;
  authentication?: WebhookAuthentication;
}

export interface MobileRoutingRule {
  eventTypes: MobileWebhookEventType[];
  destinationUrl: string;
  condition?: string; // JSONPath expression for conditional routing
  transformation?: string; // JSONPath for data transformation
  enabled: boolean;
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  failureNotificationUrl?: string;
}

export interface WebhookAuthentication {
  type: 'bearer' | 'hmac' | 'basic';
  credentials: string;
  additionalHeaders?: Record<string, string>;
}

// Real-time notification configuration
export interface MobileNotificationConfig {
  organizationId: string;

  // Push notification settings
  fcmConfig?: FCMConfig;
  apnsConfig?: APNSConfig;

  // WebSocket settings
  websocketConfig?: WebSocketConfig;

  // Notification templates
  notificationTemplates: MobileNotificationTemplate[];

  // Delivery preferences
  deliveryPreferences: NotificationDeliveryPreferences;
}

export interface FCMConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  enabled: boolean;
}

export interface APNSConfig {
  teamId: string;
  keyId: string;
  privateKey: string;
  bundleId: string;
  enabled: boolean;
}

export interface WebSocketConfig {
  endpoint: string;
  enableHeartbeat: boolean;
  heartbeatInterval: number;
  reconnectAttempts: number;
}

export interface MobileNotificationTemplate {
  eventType: MobileWebhookEventType;
  title: string;
  body: string;
  actionUrl?: string;
  iconUrl?: string;
  priority: 'high' | 'normal' | 'low';
  sound?: string;
  category?: string;
}

export interface NotificationDeliveryPreferences {
  enablePushNotifications: boolean;
  enableWebSocketNotifications: boolean;
  enableEmailNotifications: boolean;
  quietHours?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
    timezone: string;
  };
  maxNotificationsPerHour: number;
}
