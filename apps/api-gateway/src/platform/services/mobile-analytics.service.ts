import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import * as crypto from "crypto";

// Analytics and Intelligence interfaces for mobile platform
export interface MobileAnalyticsConfig {
  enableRealTimeAnalytics: boolean;
  enableBehaviorTracking: boolean;
  enablePerformanceMetrics: boolean;
  enableAIInsights: boolean;
  dataRetentionDays: number;
  anomalyDetectionThreshold: number;
  reportingInterval: number;
}

export interface UserBehaviorEvent {
  eventId: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  eventType:
    | "app_open"
    | "screen_view"
    | "user_action"
    | "feature_usage"
    | "error"
    | "crash"
    | "performance";
  eventCategory:
    | "navigation"
    | "authentication"
    | "credential"
    | "invitation"
    | "notification"
    | "system";
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  properties: Record<string, unknown>;
  timestamp: string;
  sessionDuration?: number;
  screenName?: string;
  userAgent: string;
  location?: {
    country: string;
    city: string;
    coordinates?: { lat: number; lng: number };
  };
}

export interface PerformanceMetrics {
  metricId: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  metricType:
    | "app_launch"
    | "api_response"
    | "screen_load"
    | "network_request"
    | "battery_usage"
    | "memory_usage";
  duration: number; // milliseconds
  startTime: string;
  endTime: string;
  success: boolean;
  errorMessage?: string;
  networkType?: "wifi" | "4g" | "5g" | "edge" | "offline";
  deviceSpecs: {
    platform: string;
    osVersion: string;
    appVersion: string;
    deviceModel: string;
    ramSize?: number;
    storageAvailable?: number;
    batteryLevel?: number;
  };
  apiEndpoint?: string;
  responseSize?: number;
  cacheHit?: boolean;
}

export interface UserEngagementMetrics {
  userId: string;
  period: "daily" | "weekly" | "monthly";
  startDate: string;
  endDate: string;
  sessionsCount: number;
  totalSessionDuration: number;
  averageSessionDuration: number;
  screenViewsCount: number;
  featuresUsed: string[];
  credentialsCreated: number;
  credentialsShared: number;
  invitationsAccepted: number;
  notificationEngagement: {
    received: number;
    opened: number;
    clicked: number;
    dismissed: number;
  };
  retentionRate: number;
  churnRisk: "low" | "medium" | "high";
}

export interface AIInsight {
  insightId: string;
  type:
    | "user_behavior"
    | "performance_anomaly"
    | "security_threat"
    | "feature_adoption"
    | "user_retention";
  category:
    | "optimization"
    | "security"
    | "engagement"
    | "performance"
    | "business";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-100 confidence score
  affectedUsers?: string[];
  affectedDevices?: string[];
  data: Record<string, unknown>;
  recommendations: string[];
  timestamp: string;
  status: "active" | "resolved" | "investigating";
}

export interface AnalyticsDashboard {
  dashboardId: string;
  period: "last_hour" | "last_24h" | "last_7d" | "last_30d" | "custom";
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalSessions: number;
  averageSessionDuration: number;
  retentionRate: number;
  crashRate: number;
  popularFeatures: { feature: string; usage: number }[];
  performanceMetrics: {
    averageAppLaunchTime: number;
    averageApiResponseTime: number;
    networkErrorRate: number;
    cacheHitRate: number;
  };
  deviceMetrics: {
    platforms: { platform: string; count: number }[];
    osVersions: { version: string; count: number }[];
    topDevices: { device: string; count: number }[];
  };
  geographicDistribution: { country: string; users: number }[];
  securityMetrics: {
    successfulLogins: number;
    failedLogins: number;
    biometricAuthSuccess: number;
    suspiciousActivities: number;
  };
  aiInsights: AIInsight[];
}

export interface UserJourney {
  userId: string;
  journeyId: string;
  startTime: string;
  endTime?: string;
  status: "active" | "completed" | "abandoned";
  steps: {
    stepId: string;
    stepName: string;
    timestamp: string;
    duration: number;
    success: boolean;
    metadata: Record<string, unknown>;
  }[];
  totalDuration?: number;
  conversionGoal?: string;
  converted: boolean;
  dropOffPoint?: string;
}

@Injectable()
export class MobileAnalyticsService {
  private readonly logger = new Logger(MobileAnalyticsService.name);
  private readonly behaviorEvents: UserBehaviorEvent[] = [];
  private readonly performanceMetrics: PerformanceMetrics[] = [];
  private readonly engagementMetrics: Map<string, UserEngagementMetrics> =
    new Map();
  private readonly aiInsights: AIInsight[] = [];
  private readonly userJourneys: Map<string, UserJourney> = new Map();
  private readonly activeSessions: Map<
    string,
    { userId: string; startTime: string; lastActivity: string }
  > = new Map();

  private readonly analyticsConfig: MobileAnalyticsConfig = {
    enableRealTimeAnalytics: true,
    enableBehaviorTracking: true,
    enablePerformanceMetrics: true,
    enableAIInsights: true,
    dataRetentionDays: 90,
    anomalyDetectionThreshold: 0.75,
    reportingInterval: 300000, // 5 minutes
  };

  constructor(@Inject("NATS_CLIENT") private readonly natsClient: ClientProxy) {
    this.logger.log("Mobile Analytics Service initialized");
    this.startRealTimeAnalytics();
  }

  /**
   * Track user behavior event
   */
  async trackUserBehavior(
    eventData: Omit<UserBehaviorEvent, "eventId" | "timestamp">
  ): Promise<void> {
    try {
      if (!this.analyticsConfig.enableBehaviorTracking) return;

      const event: UserBehaviorEvent = {
        eventId: `event_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...eventData,
      };

      this.behaviorEvents.push(event);
      this.cleanupOldData();

      // Update session activity
      this.updateSessionActivity(event.sessionId, event.userId);

      // Real-time analytics processing
      await this.processRealTimeEvent(event);

      // Emit event for external processing
      await this.natsClient.emit("mobile.analytics.behavior", event);

      this.logger.debug(
        `Behavior event tracked: ${event.eventType} for user ${event.userId}`
      );
    } catch (error) {
      this.logger.error("Failed to track user behavior:", error);
    }
  }

  /**
   * Track performance metrics
   */
  async trackPerformanceMetrics(
    metricsData: Omit<PerformanceMetrics, "metricId">
  ): Promise<void> {
    try {
      if (!this.analyticsConfig.enablePerformanceMetrics) return;

      const metrics: PerformanceMetrics = {
        metricId: `metric_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        ...metricsData,
      };

      this.performanceMetrics.push(metrics);

      // Check for performance anomalies
      await this.detectPerformanceAnomalies(metrics);

      // Emit metrics for external processing
      await this.natsClient.emit("mobile.analytics.performance", metrics);

      this.logger.debug(
        `Performance metrics tracked: ${metrics.metricType} - ${metrics.duration}ms`
      );
    } catch (error) {
      this.logger.error("Failed to track performance metrics:", error);
    }
  }

  /**
   * Start user journey tracking
   */
  async startUserJourney(
    userId: string,
    journeyType: string,
    conversionGoal?: string
  ): Promise<UserJourney> {
    try {
      const journeyId = `journey_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const journey: UserJourney = {
        userId,
        journeyId,
        startTime: new Date().toISOString(),
        status: "active",
        steps: [],
        converted: false,
        conversionGoal,
      };

      this.userJourneys.set(journeyId, journey);

      // Track journey start event
      await this.trackUserBehavior({
        userId,
        deviceId: "unknown",
        sessionId: journeyId,
        eventType: "user_action",
        eventCategory: "navigation",
        eventAction: "journey_start",
        eventLabel: journeyType,
        properties: { journeyType, conversionGoal },
        userAgent: "mobile-app",
      });

      this.logger.log(`User journey started: ${journeyId} for user ${userId}`);
      return journey;
    } catch (error) {
      this.logger.error("Failed to start user journey:", error);
      throw error;
    }
  }

  /**
   * Add step to user journey
   */
  async addJourneyStep(
    journeyId: string,
    stepName: string,
    success: boolean,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      const journey = this.userJourneys.get(journeyId);
      if (!journey || journey.status !== "active") return;

      const step = {
        stepId: `step_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        stepName,
        timestamp: new Date().toISOString(),
        duration:
          journey.steps.length > 0
            ? Date.now() -
              new Date(
                journey.steps[journey.steps.length - 1].timestamp
              ).getTime()
            : Date.now() - new Date(journey.startTime).getTime(),
        success,
        metadata,
      };

      journey.steps.push(step);

      // Check for conversion
      if (
        journey.conversionGoal &&
        stepName === journey.conversionGoal &&
        success
      ) {
        journey.converted = true;
        journey.status = "completed";
        journey.endTime = new Date().toISOString();
        journey.totalDuration =
          new Date(journey.endTime).getTime() -
          new Date(journey.startTime).getTime();
      }

      // Check for drop-off
      if (!success) {
        journey.dropOffPoint = stepName;
        journey.status = "abandoned";
        journey.endTime = new Date().toISOString();
      }

      this.userJourneys.set(journeyId, journey);

      this.logger.debug(
        `Journey step added: ${stepName} (${success ? "success" : "failed"})`
      );
    } catch (error) {
      this.logger.error("Failed to add journey step:", error);
    }
  }

  /**
   * Generate analytics dashboard
   */
  async generateDashboard(
    period: AnalyticsDashboard["period"] = "last_24h",
    customStartDate?: string,
    customEndDate?: string
  ): Promise<AnalyticsDashboard> {
    try {
      this.logger.log(`Generating analytics dashboard for period: ${period}`);

      const { startDate, endDate } = this.getPeriodDates(
        period,
        customStartDate,
        customEndDate
      );

      // Filter data by period
      const periodEvents = this.behaviorEvents.filter(
        (event) =>
          new Date(event.timestamp) >= startDate &&
          new Date(event.timestamp) <= endDate
      );

      const periodMetrics = this.performanceMetrics.filter(
        (metric) =>
          new Date(metric.startTime) >= startDate &&
          new Date(metric.startTime) <= endDate
      );

      // Calculate dashboard metrics
      const dashboard: AnalyticsDashboard = {
        dashboardId: `dashboard_${Date.now()}`,
        period,
        totalUsers: new Set(periodEvents.map((e) => e.userId)).size,
        activeUsers: this.calculateActiveUsers(periodEvents),
        newUsers: this.calculateNewUsers(periodEvents, startDate),
        totalSessions: new Set(periodEvents.map((e) => e.sessionId)).size,
        averageSessionDuration:
          this.calculateAverageSessionDuration(periodEvents),
        retentionRate: this.calculateRetentionRate(periodEvents),
        crashRate: this.calculateCrashRate(periodEvents),
        popularFeatures: this.getPopularFeatures(periodEvents),
        performanceMetrics: {
          averageAppLaunchTime: this.calculateAverageMetric(
            periodMetrics,
            "app_launch"
          ),
          averageApiResponseTime: this.calculateAverageMetric(
            periodMetrics,
            "api_response"
          ),
          networkErrorRate: this.calculateErrorRate(periodMetrics),
          cacheHitRate: this.calculateCacheHitRate(periodMetrics),
        },
        deviceMetrics: {
          platforms: this.getDevicePlatforms(periodEvents),
          osVersions: this.getOSVersions(periodMetrics),
          topDevices: this.getTopDevices(periodMetrics),
        },
        geographicDistribution: this.getGeographicDistribution(periodEvents),
        securityMetrics: this.getSecurityMetrics(periodEvents),
        aiInsights: this.getActiveAIInsights(),
      };

      this.logger.log(
        `Dashboard generated with ${dashboard.totalUsers} users and ${dashboard.totalSessions} sessions`
      );
      return dashboard;
    } catch (error) {
      this.logger.error("Failed to generate dashboard:", error);
      throw error;
    }
  }

  /**
   * Generate AI insights from collected data
   */
  async generateAIInsights(): Promise<AIInsight[]> {
    try {
      if (!this.analyticsConfig.enableAIInsights) return [];

      this.logger.log("Generating AI insights from analytics data");

      const insights: AIInsight[] = [];

      // Analyze user behavior patterns
      const behaviorInsights = await this.analyzeBehaviorPatterns();
      insights.push(...behaviorInsights);

      // Analyze performance anomalies
      const performanceInsights = await this.analyzePerformanceAnomalies();
      insights.push(...performanceInsights);

      // Analyze security threats
      const securityInsights = await this.analyzeSecurityThreats();
      insights.push(...securityInsights);

      // Analyze user retention
      const retentionInsights = await this.analyzeUserRetention();
      insights.push(...retentionInsights);

      // Store and emit insights
      insights.forEach((insight) => {
        this.aiInsights.push(insight);
        this.natsClient.emit("mobile.analytics.insight", insight);
      });

      this.logger.log(`Generated ${insights.length} AI insights`);
      return insights;
    } catch (error) {
      this.logger.error("Failed to generate AI insights:", error);
      return [];
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(
    userId: string,
    period: UserEngagementMetrics["period"] = "weekly"
  ): Promise<UserEngagementMetrics> {
    try {
      const cacheKey = `${userId}_${period}`;
      const cached = this.engagementMetrics.get(cacheKey);

      if (cached) {
        return cached;
      }

      const { startDate, endDate } = this.getEngagementPeriod(period);

      const userEvents = this.behaviorEvents.filter(
        (event) =>
          event.userId === userId &&
          new Date(event.timestamp) >= startDate &&
          new Date(event.timestamp) <= endDate
      );

      const sessions = new Set(userEvents.map((e) => e.sessionId));
      const sessionDurations = Array.from(sessions).map((sessionId) =>
        this.calculateSessionDuration(sessionId, userEvents)
      );

      const metrics: UserEngagementMetrics = {
        userId,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        sessionsCount: sessions.size,
        totalSessionDuration: sessionDurations.reduce(
          (sum, duration) => sum + duration,
          0
        ),
        averageSessionDuration:
          sessionDurations.length > 0
            ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
              sessionDurations.length
            : 0,
        screenViewsCount: userEvents.filter(
          (e) => e.eventType === "screen_view"
        ).length,
        featuresUsed: [
          ...new Set(
            userEvents.filter((e) => e.eventAction).map((e) => e.eventAction)
          ),
        ],
        credentialsCreated: userEvents.filter(
          (e) => e.eventAction === "create_credential"
        ).length,
        credentialsShared: userEvents.filter(
          (e) => e.eventAction === "share_credential"
        ).length,
        invitationsAccepted: userEvents.filter(
          (e) => e.eventAction === "accept_invitation"
        ).length,
        notificationEngagement:
          this.calculateNotificationEngagement(userEvents),
        retentionRate: this.calculateUserRetentionRate(userId),
        churnRisk: this.calculateChurnRisk(userEvents),
      };

      this.engagementMetrics.set(cacheKey, metrics);
      return metrics;
    } catch (error) {
      this.logger.error("Failed to get user engagement metrics:", error);
      throw error;
    }
  }

  /**
   * Get user journey analytics
   */
  async getUserJourneyAnalytics(userId?: string): Promise<{
    totalJourneys: number;
    completedJourneys: number;
    abandonedJourneys: number;
    averageJourneyDuration: number;
    conversionRate: number;
    topDropOffPoints: { step: string; count: number }[];
    journeys: UserJourney[];
  }> {
    try {
      const journeys = Array.from(this.userJourneys.values()).filter(
        (journey) => !userId || journey.userId === userId
      );

      const completed = journeys.filter((j) => j.status === "completed");
      const abandoned = journeys.filter((j) => j.status === "abandoned");
      const converted = journeys.filter((j) => j.converted);

      const dropOffPoints = abandoned
        .filter((j) => j.dropOffPoint)
        .reduce((acc, j) => {
          acc[j.dropOffPoint!] = (acc[j.dropOffPoint!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      return {
        totalJourneys: journeys.length,
        completedJourneys: completed.length,
        abandonedJourneys: abandoned.length,
        averageJourneyDuration:
          completed.reduce((sum, j) => sum + (j.totalDuration || 0), 0) /
            completed.length || 0,
        conversionRate:
          journeys.length > 0 ? (converted.length / journeys.length) * 100 : 0,
        topDropOffPoints: Object.entries(dropOffPoints)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([step, count]) => ({ step, count })),
        journeys: journeys.slice(0, 100), // Return latest 100
      };
    } catch (error) {
      this.logger.error("Failed to get user journey analytics:", error);
      throw error;
    }
  }

  // Private helper methods

  private startRealTimeAnalytics(): void {
    if (!this.analyticsConfig.enableRealTimeAnalytics) return;

    setInterval(async () => {
      try {
        await this.processRealTimeAnalytics();
      } catch (error) {
        this.logger.error("Real-time analytics processing failed:", error);
      }
    }, this.analyticsConfig.reportingInterval);
  }

  private async processRealTimeAnalytics(): Promise<void> {
    // Generate insights periodically
    await this.generateAIInsights();

    // Clean up old data
    this.cleanupOldData();

    // Update engagement metrics cache
    this.updateEngagementMetricsCache();
  }

  private async processRealTimeEvent(event: UserBehaviorEvent): Promise<void> {
    // Check for anomalies in real-time
    await this.detectBehaviorAnomalies(event);

    // Update user journey if applicable
    if (event.sessionId && this.userJourneys.has(event.sessionId)) {
      await this.addJourneyStep(
        event.sessionId,
        event.eventAction,
        event.eventType !== "error",
        event.properties
      );
    }
  }

  private updateSessionActivity(sessionId: string, userId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date().toISOString();
    } else {
      this.activeSessions.set(sessionId, {
        userId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      });
    }
  }

  private cleanupOldData(): void {
    const cutoffDate = new Date(
      Date.now() - this.analyticsConfig.dataRetentionDays * 24 * 60 * 60 * 1000
    );

    // Clean behavior events
    const validEvents = this.behaviorEvents.filter(
      (event) => new Date(event.timestamp) > cutoffDate
    );
    this.behaviorEvents.splice(0, this.behaviorEvents.length, ...validEvents);

    // Clean performance metrics
    const validMetrics = this.performanceMetrics.filter(
      (metric) => new Date(metric.startTime) > cutoffDate
    );
    this.performanceMetrics.splice(
      0,
      this.performanceMetrics.length,
      ...validMetrics
    );
  }

  private getPeriodDates(
    period: AnalyticsDashboard["period"],
    customStartDate?: string,
    customEndDate?: string
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = customEndDate ? new Date(customEndDate) : now;
    let startDate: Date;

    switch (period) {
      case "last_hour":
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "last_24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "last_7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "last_30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        startDate = customStartDate
          ? new Date(customStartDate)
          : new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }

  private calculateActiveUsers(events: UserBehaviorEvent[]): number {
    const activeThreshold = new Date(Date.now() - 5 * 60 * 1000); // Last 5 minutes
    return new Set(
      events
        .filter((event) => new Date(event.timestamp) > activeThreshold)
        .map((event) => event.userId)
    ).size;
  }

  private calculateNewUsers(
    events: UserBehaviorEvent[],
    startDate: Date
  ): number {
    return new Set(
      events
        .filter(
          (event) =>
            event.eventAction === "user_registration" &&
            new Date(event.timestamp) >= startDate
        )
        .map((event) => event.userId)
    ).size;
  }

  private calculateAverageSessionDuration(events: UserBehaviorEvent[]): number {
    const sessions = new Map<string, { start: number; end: number }>();

    events.forEach((event) => {
      const timestamp = new Date(event.timestamp).getTime();
      const session = sessions.get(event.sessionId);

      if (session) {
        session.end = Math.max(session.end, timestamp);
      } else {
        sessions.set(event.sessionId, { start: timestamp, end: timestamp });
      }
    });

    const durations = Array.from(sessions.values()).map((s) => s.end - s.start);
    return durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) /
          durations.length
      : 0;
  }

  private calculateRetentionRate(events: UserBehaviorEvent[]): number {
    // Mock retention calculation - implement based on your business logic
    const totalUsers = new Set(events.map((e) => e.userId)).size;
    const returningUsers = new Set(
      events.filter((e) => e.eventAction === "app_open").map((e) => e.userId)
    ).size;

    return totalUsers > 0 ? (returningUsers / totalUsers) * 100 : 0;
  }

  private calculateCrashRate(events: UserBehaviorEvent[]): number {
    const totalSessions = new Set(events.map((e) => e.sessionId)).size;
    const crashedSessions = new Set(
      events.filter((e) => e.eventType === "crash").map((e) => e.sessionId)
    ).size;

    return totalSessions > 0 ? (crashedSessions / totalSessions) * 100 : 0;
  }

  private getPopularFeatures(
    events: UserBehaviorEvent[]
  ): { feature: string; usage: number }[] {
    const featureUsage = events
      .filter((e) => "feature_usage" === (e.eventCategory as string))
      .reduce((acc, event) => {
        acc[event.eventAction] = (acc[event.eventAction] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(featureUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([feature, usage]) => ({ feature, usage }));
  }

  private calculateAverageMetric(
    metrics: PerformanceMetrics[],
    metricType: string
  ): number {
    const relevantMetrics = metrics.filter((m) => m.metricType === metricType);
    return relevantMetrics.length > 0
      ? relevantMetrics.reduce((sum, m) => sum + m.duration, 0) /
          relevantMetrics.length
      : 0;
  }

  private calculateErrorRate(metrics: PerformanceMetrics[]): number {
    const total = metrics.length;
    const errors = metrics.filter((m) => !m.success).length;
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private calculateCacheHitRate(metrics: PerformanceMetrics[]): number {
    const relevantMetrics = metrics.filter((m) => m.cacheHit !== undefined);
    const hits = relevantMetrics.filter((m) => m.cacheHit).length;
    return relevantMetrics.length > 0
      ? (hits / relevantMetrics.length) * 100
      : 0;
  }

  private getDevicePlatforms(
    events: UserBehaviorEvent[]
  ): { platform: string; count: number }[] {
    // Extract platform from userAgent or event properties
    const platforms = events.reduce((acc, event) => {
      const platform = this.extractPlatform(event.userAgent);
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(platforms).map(([platform, count]) => ({
      platform,
      count,
    }));
  }

  private getOSVersions(
    metrics: PerformanceMetrics[]
  ): { version: string; count: number }[] {
    const versions = metrics.reduce((acc, metric) => {
      const version = metric.deviceSpecs.osVersion;
      acc[version] = (acc[version] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(versions).map(([version, count]) => ({
      version,
      count,
    }));
  }

  private getTopDevices(
    metrics: PerformanceMetrics[]
  ): { device: string; count: number }[] {
    const devices = metrics.reduce((acc, metric) => {
      const device = metric.deviceSpecs.deviceModel;
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(devices)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([device, count]) => ({ device, count }));
  }

  private getGeographicDistribution(
    events: UserBehaviorEvent[]
  ): { country: string; users: number }[] {
    const countries = events
      .filter((e) => e.location?.country)
      .reduce((acc, event) => {
        const country = event.location!.country;
        acc[country] = (acc[country] || new Set()).add(event.userId);
        return acc;
      }, {} as Record<string, Set<string>>);

    return Object.entries(countries)
      .map(([country, users]) => ({ country, users: users.size }))
      .sort((a, b) => b.users - a.users);
  }

  private getSecurityMetrics(
    events: UserBehaviorEvent[]
  ): AnalyticsDashboard["securityMetrics"] {
    return {
      successfulLogins: events.filter((e) => e.eventAction === "login_success")
        .length,
      failedLogins: events.filter((e) => e.eventAction === "login_failed")
        .length,
      biometricAuthSuccess: events.filter(
        (e) => e.eventAction === "biometric_success"
      ).length,
      suspiciousActivities: events.filter(
        (e) => e.eventAction === "suspicious_activity"
      ).length,
    };
  }

  private getActiveAIInsights(): AIInsight[] {
    return this.aiInsights
      .filter((insight) => insight.status === "active")
      .slice(0, 10);
  }

  private getEngagementPeriod(period: UserEngagementMetrics["period"]): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "daily":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "weekly":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "monthly":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate: now };
  }

  private calculateSessionDuration(
    sessionId: string,
    events: UserBehaviorEvent[]
  ): number {
    const sessionEvents = events.filter((e) => e.sessionId === sessionId);
    if (sessionEvents.length === 0) return 0;

    const timestamps = sessionEvents.map((e) =>
      new Date(e.timestamp).getTime()
    );
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  private calculateNotificationEngagement(
    events: UserBehaviorEvent[]
  ): UserEngagementMetrics["notificationEngagement"] {
    const notificationEvents = events.filter(
      (e) => e.eventCategory === "notification"
    );

    return {
      received: notificationEvents.filter((e) => e.eventAction === "received")
        .length,
      opened: notificationEvents.filter((e) => e.eventAction === "opened")
        .length,
      clicked: notificationEvents.filter((e) => e.eventAction === "clicked")
        .length,
      dismissed: notificationEvents.filter((e) => e.eventAction === "dismissed")
        .length,
    };
  }

  private calculateUserRetentionRate(userId: string): number {
    // Mock calculation - implement based on your business logic
    const userEvents = this.behaviorEvents.filter((e) => e.userId === userId);
    const uniqueDays = new Set(userEvents.map((e) => e.timestamp.split("T")[0]))
      .size;
    const daysSinceFirst =
      userEvents.length > 0
        ? Math.ceil(
            (Date.now() - new Date(userEvents[0].timestamp).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        : 0;

    return daysSinceFirst > 0 ? (uniqueDays / daysSinceFirst) * 100 : 0;
  }

  private calculateChurnRisk(
    events: UserBehaviorEvent[]
  ): UserEngagementMetrics["churnRisk"] {
    const recentEvents = events.filter(
      (e) =>
        new Date(e.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    if (recentEvents.length === 0) return "high";
    if (recentEvents.length < 5) return "medium";
    return "low";
  }

  private extractPlatform(userAgent: string): string {
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS") || userAgent.includes("iPhone")) return "iOS";
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    return "Unknown";
  }

  private updateEngagementMetricsCache(): void {
    // Periodically clear cache to ensure fresh data
    if (Math.random() < 0.1) {
      // 10% chance
      this.engagementMetrics.clear();
    }
  }

  private async detectPerformanceAnomalies(
    metrics: PerformanceMetrics
  ): Promise<void> {
    // Simple anomaly detection based on duration thresholds
    const thresholds = {
      app_launch: 5000, // 5 seconds
      api_response: 2000, // 2 seconds
      screen_load: 3000, // 3 seconds
    };

    const threshold = thresholds[metrics.metricType as keyof typeof thresholds];
    if (threshold && metrics.duration > threshold) {
      const insight: AIInsight = {
        insightId: `perf_anomaly_${Date.now()}`,
        type: "performance_anomaly",
        category: "performance",
        title: `Slow ${metrics.metricType} detected`,
        description: `${metrics.metricType} took ${metrics.duration}ms, which exceeds the normal threshold of ${threshold}ms`,
        severity: "medium",
        confidence: 85,
        affectedUsers: [metrics.userId],
        affectedDevices: [metrics.deviceId],
        data: { metrics },
        recommendations: [
          "Check network connectivity",
          "Optimize application performance",
          "Review server response times",
        ],
        timestamp: new Date().toISOString(),
        status: "active",
      };

      this.aiInsights.push(insight);
    }
  }

  private async detectBehaviorAnomalies(
    event: UserBehaviorEvent
  ): Promise<void> {
    // Simple behavior anomaly detection
    if (event.eventType === "error" || event.eventType === "crash") {
      const insight: AIInsight = {
        insightId: `behavior_anomaly_${Date.now()}`,
        type: "user_behavior",
        category: "optimization",
        title: `${event.eventType} detected`,
        description: `User experienced ${event.eventType} in ${event.eventCategory}`,
        severity: event.eventType === "crash" ? "high" : "medium",
        confidence: 95,
        affectedUsers: [event.userId],
        affectedDevices: [event.deviceId],
        data: { event },
        recommendations: [
          "Review error logs",
          "Check application stability",
          "Improve error handling",
        ],
        timestamp: new Date().toISOString(),
        status: "active",
      };

      this.aiInsights.push(insight);
    }
  }

  private async analyzeBehaviorPatterns(): Promise<AIInsight[]> {
    // Mock AI analysis - implement with actual ML models
    return [];
  }

  private async analyzePerformanceAnomalies(): Promise<AIInsight[]> {
    // Mock AI analysis - implement with actual ML models
    return [];
  }

  private async analyzeSecurityThreats(): Promise<AIInsight[]> {
    // Mock AI analysis - implement with actual ML models
    return [];
  }

  private async analyzeUserRetention(): Promise<AIInsight[]> {
    // Mock AI analysis - implement with actual ML models
    return [];
  }
}
