import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";

// Enhanced security interfaces for mobile authentication
export interface MobileSecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  maxLoginAttempts: number;
  lockoutDuration: number;
  deviceTrustDuration: number;
  requireBiometric: boolean;
  enableDeviceFingerprinting: boolean;
}

export interface DeviceFingerprint {
  deviceId: string;
  platform: "android" | "ios" | "web";
  osVersion: string;
  appVersion: string;
  deviceModel: string;
  screenResolution?: string;
  timezone: string;
  language: string;
  fingerprint: string; // SHA-256 hash of combined device attributes
  trustScore: number; // 0-100 trust score based on device history
  registeredAt: string;
  lastSeen: string;
}

export interface BiometricChallenge {
  challengeId: string;
  userId: string;
  deviceId: string;
  challengeType: "fingerprint" | "face" | "voice" | "pin";
  challengeData: string; // Encrypted challenge data
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "completed" | "failed" | "expired";
  createdAt: string;
}

export interface SecurityAuditLog {
  eventId: string;
  userId: string;
  deviceId?: string;
  eventType:
    | "login"
    | "logout"
    | "failed_login"
    | "device_registered"
    | "biometric_auth"
    | "suspicious_activity";
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    city: string;
    coordinates?: { lat: number; lng: number };
  };
  riskScore: number; // 0-100 risk assessment
  details: Record<string, unknown>;
  timestamp: string;
}

export interface TrustedDevice {
  deviceId: string;
  userId: string;
  deviceFingerprint: DeviceFingerprint;
  trustLevel: "low" | "medium" | "high";
  trustedAt: string;
  expiresAt: string;
  lastUsed: string;
  usageCount: number;
  isActive: boolean;
}

export interface SecurityTokens {
  accessToken: string;
  refreshToken: string;
  deviceToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  scope: string[];
}

@Injectable()
export class MobileSecurityService {
  private readonly logger = new Logger(MobileSecurityService.name);
  private readonly deviceFingerprints: Map<string, DeviceFingerprint> =
    new Map();
  private readonly biometricChallenges: Map<string, BiometricChallenge> =
    new Map();
  private readonly auditLogs: SecurityAuditLog[] = [];
  private readonly trustedDevices: Map<string, TrustedDevice> = new Map();
  private readonly loginAttempts: Map<
    string,
    { count: number; lastAttempt: string; lockedUntil?: string }
  > = new Map();

  private readonly securityConfig: MobileSecurityConfig = {
    jwtSecret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    jwtExpiresIn: "15m",
    refreshTokenExpiresIn: "7d",
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    deviceTrustDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    requireBiometric: false,
    enableDeviceFingerprinting: true,
  };

  constructor(@Inject("NATS_CLIENT") private readonly natsClient: ClientProxy) {
    this.logger.log("Mobile Security Service initialized");
  }

  /**
   * Generate device fingerprint based on device attributes
   */
  async generateDeviceFingerprint(
    deviceInfo: Partial<DeviceFingerprint>
  ): Promise<DeviceFingerprint> {
    try {
      this.logger.log("Generating device fingerprint:", {
        deviceId: deviceInfo.deviceId,
      });

      // Create fingerprint string from device attributes
      const fingerprintData = [
        deviceInfo.platform,
        deviceInfo.osVersion,
        deviceInfo.deviceModel,
        deviceInfo.screenResolution,
        deviceInfo.timezone,
        deviceInfo.language,
      ]
        .filter(Boolean)
        .join("|");

      // Generate SHA-256 hash
      const fingerprint = crypto
        .createHash("sha256")
        .update(fingerprintData)
        .digest("hex");

      // Calculate trust score based on device history
      const trustScore = this.calculateDeviceTrustScore(
        deviceInfo.deviceId || "",
        fingerprint
      );

      const deviceFingerprint: DeviceFingerprint = {
        deviceId: deviceInfo.deviceId || `device_${Date.now()}`,
        platform: deviceInfo.platform || "web",
        osVersion: deviceInfo.osVersion || "unknown",
        appVersion: deviceInfo.appVersion || "1.0.0",
        deviceModel: deviceInfo.deviceModel || "unknown",
        screenResolution: deviceInfo.screenResolution,
        timezone: deviceInfo.timezone || "UTC",
        language: deviceInfo.language || "en",
        fingerprint,
        trustScore,
        registeredAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };

      // Store device fingerprint
      this.deviceFingerprints.set(
        deviceFingerprint.deviceId,
        deviceFingerprint
      );

      // Log security event
      await this.logSecurityEvent({
        eventType: "device_registered",
        userId: "system",
        deviceId: deviceFingerprint.deviceId,
        ipAddress: "127.0.0.1",
        userAgent: `${deviceInfo.platform} ${deviceInfo.osVersion}`,
        riskScore: 100 - trustScore,
        details: { fingerprint: deviceFingerprint.fingerprint },
      });

      this.logger.log(
        `Device fingerprint generated: ${deviceFingerprint.deviceId}`
      );
      return deviceFingerprint;
    } catch (error) {
      this.logger.error("Failed to generate device fingerprint:", error);
      throw new Error(
        `Device fingerprint generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Create biometric authentication challenge
   */
  async createBiometricChallenge(
    userId: string,
    deviceId: string,
    challengeType: BiometricChallenge["challengeType"]
  ): Promise<BiometricChallenge> {
    try {
      this.logger.log("Creating biometric challenge:", {
        userId,
        deviceId,
        challengeType,
      });

      // Generate challenge data
      const challengeData = this.generateChallengeData(challengeType);
      const challengeId = `bio_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const challenge: BiometricChallenge = {
        challengeId,
        userId,
        deviceId,
        challengeType,
        challengeData,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
        attempts: 0,
        maxAttempts: 3,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      // Store challenge
      this.biometricChallenges.set(challengeId, challenge);

      // Auto-cleanup expired challenge
      setTimeout(() => {
        const storedChallenge = this.biometricChallenges.get(challengeId);
        if (storedChallenge && storedChallenge.status === "pending") {
          storedChallenge.status = "expired";
          this.biometricChallenges.set(challengeId, storedChallenge);
        }
      }, 5 * 60 * 1000);

      this.logger.log(`Biometric challenge created: ${challengeId}`);
      return challenge;
    } catch (error) {
      this.logger.error("Failed to create biometric challenge:", error);
      throw new Error(
        `Biometric challenge creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Verify biometric authentication challenge
   */
  async verifyBiometricChallenge(
    challengeId: string,
    biometricData: string
  ): Promise<{
    success: boolean;
    challenge?: BiometricChallenge;
    error?: string;
  }> {
    try {
      this.logger.log("Verifying biometric challenge:", { challengeId });

      const challenge = this.biometricChallenges.get(challengeId);
      if (!challenge) {
        return { success: false, error: "Challenge not found" };
      }

      // Check if challenge is expired
      if (new Date() > new Date(challenge.expiresAt)) {
        challenge.status = "expired";
        this.biometricChallenges.set(challengeId, challenge);
        return { success: false, error: "Challenge expired", challenge };
      }

      // Check if challenge is already completed or failed
      if (challenge.status !== "pending") {
        return {
          success: false,
          error: `Challenge already ${challenge.status}`,
          challenge,
        };
      }

      // Increment attempts
      challenge.attempts++;

      // Mock biometric verification (replace with actual biometric validation)
      const isValid = await this.mockBiometricVerification(
        challenge.challengeData,
        biometricData
      );

      if (isValid) {
        challenge.status = "completed";
        this.biometricChallenges.set(challengeId, challenge);

        // Log successful biometric authentication
        await this.logSecurityEvent({
          eventType: "biometric_auth",
          userId: challenge.userId,
          deviceId: challenge.deviceId,
          ipAddress: "127.0.0.1",
          userAgent: "mobile-app",
          riskScore: 10, // Low risk for successful biometric auth
          details: {
            challengeType: challenge.challengeType,
            attempts: challenge.attempts,
          },
        });

        this.logger.log(
          `Biometric challenge verified successfully: ${challengeId}`
        );
        return { success: true, challenge };
      } else {
        // Check if max attempts reached
        if (challenge.attempts >= challenge.maxAttempts) {
          challenge.status = "failed";
        }
        this.biometricChallenges.set(challengeId, challenge);

        this.logger.warn(
          `Biometric challenge verification failed: ${challengeId}`
        );
        return {
          success: false,
          error: "Biometric verification failed",
          challenge,
        };
      }
    } catch (error) {
      this.logger.error("Failed to verify biometric challenge:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Authenticate user with enhanced security checks
   */
  async authenticateUser(
    userId: string,
    deviceFingerprint: DeviceFingerprint,
    ipAddress: string,
    userAgent: string,
    credentials?: { password?: string; biometricChallengeId?: string }
  ): Promise<{
    success: boolean;
    tokens?: SecurityTokens;
    requiresBiometric?: boolean;
    error?: string;
  }> {
    try {
      this.logger.log("Authenticating user with enhanced security:", {
        userId,
        deviceId: deviceFingerprint.deviceId,
      });

      // Check for account lockout
      const lockoutCheck = this.checkAccountLockout(userId);
      if (lockoutCheck.isLocked) {
        await this.logSecurityEvent({
          eventType: "failed_login",
          userId,
          deviceId: deviceFingerprint.deviceId,
          ipAddress,
          userAgent,
          riskScore: 90,
          details: {
            reason: "account_locked",
            lockedUntil: lockoutCheck.lockedUntil,
          },
        });
        return {
          success: false,
          error: `Account locked until ${lockoutCheck.lockedUntil}`,
        };
      }

      // Calculate risk score
      const riskScore = await this.calculateRiskScore(
        userId,
        deviceFingerprint,
        ipAddress
      );

      // Check if biometric authentication is required
      const requiresBiometric = this.shouldRequireBiometric(
        deviceFingerprint,
        riskScore
      );

      if (requiresBiometric && !credentials?.biometricChallengeId) {
        return {
          success: false,
          requiresBiometric: true,
          error: "Biometric authentication required",
        };
      }

      // Verify biometric challenge if provided
      if (credentials?.biometricChallengeId) {
        const biometricResult = await this.verifyBiometricChallenge(
          credentials.biometricChallengeId,
          "mock-biometric-data"
        );
        if (!biometricResult.success) {
          this.recordFailedLogin(userId);
          return { success: false, error: "Biometric authentication failed" };
        }
      }

      // Mock password verification (replace with actual user authentication)
      const isValidCredentials = await this.mockPasswordVerification(
        userId,
        credentials?.password
      );
      if (!isValidCredentials) {
        this.recordFailedLogin(userId);
        await this.logSecurityEvent({
          eventType: "failed_login",
          userId,
          deviceId: deviceFingerprint.deviceId,
          ipAddress,
          userAgent,
          riskScore: riskScore + 20,
          details: { reason: "invalid_credentials" },
        });
        return { success: false, error: "Invalid credentials" };
      }

      // Clear failed login attempts
      this.loginAttempts.delete(userId);

      // Generate security tokens
      const tokens = await this.generateSecurityTokens(
        userId,
        deviceFingerprint
      );

      // Update device trust
      await this.updateDeviceTrust(userId, deviceFingerprint);

      // Log successful authentication
      await this.logSecurityEvent({
        eventType: "login",
        userId,
        deviceId: deviceFingerprint.deviceId,
        ipAddress,
        userAgent,
        riskScore,
        details: {
          authMethod: requiresBiometric ? "biometric" : "password",
          trustScore: deviceFingerprint.trustScore,
        },
      });

      this.logger.log(`User authenticated successfully: ${userId}`);
      return { success: true, tokens };
    } catch (error) {
      this.logger.error("Failed to authenticate user:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(
    refreshToken: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<{ success: boolean; tokens?: SecurityTokens; error?: string }> {
    try {
      this.logger.log("Refreshing authentication tokens:", {
        deviceId: deviceFingerprint.deviceId,
      });

      // Verify refresh token (mock implementation)
      const tokenPayload = await this.verifyRefreshToken(refreshToken);
      if (!tokenPayload) {
        return { success: false, error: "Invalid refresh token" };
      }

      // Check device trust
      const trustedDevice = this.trustedDevices.get(
        `${tokenPayload.userId}_${deviceFingerprint.deviceId}`
      );
      if (!trustedDevice || !trustedDevice.isActive) {
        return { success: false, error: "Device not trusted" };
      }

      // Generate new tokens
      const newTokens = await this.generateSecurityTokens(
        tokenPayload.userId,
        deviceFingerprint
      );

      // Update device last used
      trustedDevice.lastUsed = new Date().toISOString();
      trustedDevice.usageCount++;
      this.trustedDevices.set(
        `${tokenPayload.userId}_${deviceFingerprint.deviceId}`,
        trustedDevice
      );

      this.logger.log(
        `Tokens refreshed successfully for user: ${tokenPayload.userId}`
      );
      return { success: true, tokens: newTokens };
    } catch (error) {
      this.logger.error("Failed to refresh tokens:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token refresh failed",
      };
    }
  }

  /**
   * Get security audit logs for a user
   */
  async getSecurityAuditLogs(
    userId: string,
    limit = 50
  ): Promise<SecurityAuditLog[]> {
    return this.auditLogs
      .filter((log) => log.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Get trusted devices for a user
   */
  async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return Array.from(this.trustedDevices.values()).filter(
      (device) => device.userId === userId && device.isActive
    );
  }

  /**
   * Revoke device trust
   */
  async revokeTrustedDevice(
    userId: string,
    deviceId: string
  ): Promise<boolean> {
    try {
      const deviceKey = `${userId}_${deviceId}`;
      const trustedDevice = this.trustedDevices.get(deviceKey);

      if (trustedDevice) {
        trustedDevice.isActive = false;
        this.trustedDevices.set(deviceKey, trustedDevice);

        await this.logSecurityEvent({
          eventType: "suspicious_activity",
          userId,
          deviceId,
          ipAddress: "127.0.0.1",
          userAgent: "system",
          riskScore: 60,
          details: { action: "device_trust_revoked" },
        });

        this.logger.log(
          `Device trust revoked: ${deviceId} for user: ${userId}`
        );
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error("Failed to revoke device trust:", error);
      return false;
    }
  }

  // Private helper methods

  private calculateDeviceTrustScore(
    deviceId: string,
    fingerprint: string
  ): number {
    // Mock trust score calculation based on device history
    const existingFingerprint = Array.from(
      this.deviceFingerprints.values()
    ).find((fp) => fp.fingerprint === fingerprint);

    if (existingFingerprint) {
      // Device seen before, higher trust score
      return Math.min(existingFingerprint.trustScore + 10, 100);
    }

    // New device, lower initial trust score
    return 30;
  }

  private generateChallengeData(
    challengeType: BiometricChallenge["challengeType"]
  ): string {
    // Generate challenge data based on type
    const challengeData = {
      challengeType,
      nonce: crypto.randomBytes(16).toString("hex"),
      timestamp: Date.now(),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(challengeData))
      .digest("hex");
  }

  private async mockBiometricVerification(
    _challengeData: string,
    _biometricData: string
  ): Promise<boolean> {
    // Mock biometric verification - replace with actual biometric validation
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate processing time
    return Math.random() > 0.1; // 90% success rate for testing
  }

  private checkAccountLockout(userId: string): {
    isLocked: boolean;
    lockedUntil?: string;
  } {
    const attempts = this.loginAttempts.get(userId);
    if (!attempts) {
      return { isLocked: false };
    }

    if (attempts.lockedUntil && new Date() < new Date(attempts.lockedUntil)) {
      return { isLocked: true, lockedUntil: attempts.lockedUntil };
    }

    return { isLocked: false };
  }

  private async calculateRiskScore(
    userId: string,
    deviceFingerprint: DeviceFingerprint,
    ipAddress: string
  ): Promise<number> {
    let riskScore = 0;

    // Device trust score contributes to risk (inverted)
    riskScore += (100 - deviceFingerprint.trustScore) * 0.3;

    // New device increases risk
    if (!this.trustedDevices.has(`${userId}_${deviceFingerprint.deviceId}`)) {
      riskScore += 30;
    }

    // Mock IP geolocation risk (replace with actual geolocation service)
    const isHighRiskLocation = ipAddress.startsWith("192.168.")
      ? false
      : Math.random() > 0.8;
    if (isHighRiskLocation) {
      riskScore += 25;
    }

    // Recent failed login attempts increase risk
    const attempts = this.loginAttempts.get(userId);
    if (attempts && attempts.count > 0) {
      riskScore += attempts.count * 5;
    }

    return Math.min(Math.round(riskScore), 100);
  }

  private shouldRequireBiometric(
    deviceFingerprint: DeviceFingerprint,
    riskScore: number
  ): boolean {
    // Require biometric for high-risk scenarios
    if (riskScore > 70) return true;

    // Require biometric for untrusted devices
    if (deviceFingerprint.trustScore < 50) return true;

    // Require biometric if globally enabled
    if (this.securityConfig.requireBiometric) return true;

    return false;
  }

  private async mockPasswordVerification(
    _userId: string,
    password?: string
  ): Promise<boolean> {
    // Mock password verification - replace with actual user authentication
    await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate processing time
    return Boolean(password && password.length > 5);
  }

  private recordFailedLogin(userId: string): void {
    const attempts = this.loginAttempts.get(userId) || {
      count: 0,
      lastAttempt: new Date().toISOString(),
    };
    attempts.count++;
    attempts.lastAttempt = new Date().toISOString();

    if (attempts.count >= this.securityConfig.maxLoginAttempts) {
      attempts.lockedUntil = new Date(
        Date.now() + this.securityConfig.lockoutDuration
      ).toISOString();
    }

    this.loginAttempts.set(userId, attempts);
  }

  private async generateSecurityTokens(
    userId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<SecurityTokens> {
    const payload = {
      userId,
      deviceId: deviceFingerprint.deviceId,
      platform: deviceFingerprint.platform,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessToken = jwt.sign(payload, this.securityConfig.jwtSecret, {
      expiresIn: this.securityConfig.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      this.securityConfig.jwtSecret,
      { expiresIn: this.securityConfig.refreshTokenExpiresIn }
    );

    const deviceToken = crypto
      .createHash("sha256")
      .update(`${userId}_${deviceFingerprint.deviceId}_${Date.now()}`)
      .digest("hex");

    return {
      accessToken,
      refreshToken,
      deviceToken,
      expiresIn: 15 * 60, // 15 minutes
      tokenType: "Bearer",
      scope: ["read", "write", "mobile"],
    };
  }

  private async updateDeviceTrust(
    userId: string,
    deviceFingerprint: DeviceFingerprint
  ): Promise<void> {
    const deviceKey = `${userId}_${deviceFingerprint.deviceId}`;
    let trustedDevice = this.trustedDevices.get(deviceKey);

    if (trustedDevice) {
      // Update existing trusted device
      trustedDevice.lastUsed = new Date().toISOString();
      trustedDevice.usageCount++;
      // Increase trust level over time
      if (trustedDevice.usageCount > 10 && trustedDevice.trustLevel === "low") {
        trustedDevice.trustLevel = "medium";
      } else if (
        trustedDevice.usageCount > 50 &&
        trustedDevice.trustLevel === "medium"
      ) {
        trustedDevice.trustLevel = "high";
      }
    } else {
      // Create new trusted device
      trustedDevice = {
        deviceId: deviceFingerprint.deviceId,
        userId,
        deviceFingerprint,
        trustLevel: "low",
        trustedAt: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + this.securityConfig.deviceTrustDuration
        ).toISOString(),
        lastUsed: new Date().toISOString(),
        usageCount: 1,
        isActive: true,
      };
    }

    this.trustedDevices.set(deviceKey, trustedDevice);
  }

  private async verifyRefreshToken(
    refreshToken: string
  ): Promise<{ userId: string; deviceId: string } | null> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        this.securityConfig.jwtSecret
      ) as any;
      if (decoded.type === "refresh") {
        return { userId: decoded.userId, deviceId: decoded.deviceId };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async logSecurityEvent(
    eventData: Omit<SecurityAuditLog, "eventId" | "timestamp">
  ): Promise<void> {
    try {
      const auditLog: SecurityAuditLog = {
        eventId: `audit_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...eventData,
      };

      this.auditLogs.push(auditLog);

      // Keep only last 1000 logs
      if (this.auditLogs.length > 1000) {
        this.auditLogs.splice(0, this.auditLogs.length - 1000);
      }

      // Emit security event via NATS
      await this.natsClient.emit("mobile.security.audit", auditLog);
    } catch (error) {
      this.logger.error("Failed to log security event:", error);
    }
  }
}
