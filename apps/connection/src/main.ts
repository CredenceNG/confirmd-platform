import { NestFactory } from "@nestjs/core";
import { ConnectionModule } from "./connection.module";
import { HttpExceptionFilter } from "libs/http-exception.filter";
import { Logger } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { getNatsOptions } from "@credebl/common/nats.config";
import { CommonConstants } from "@credebl/common/common.constant";
import NestjsLoggerServiceAdapter from "@credebl/logger/nestjsLoggerServiceAdapter";

const logger = new Logger("ConnectionServiceBootstrap");

async function bootstrap(): Promise<void> {
  try {
    logger.log("🚀 === CONNECTION SERVICE BOOTSTRAP STARTED ===");

    // Log environment details
    logger.log("📋 Environment Configuration:");
    logger.log(`   - NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
    logger.log(
      `   - CONNECTION_NKEY_SEED: ${
        process.env.CONNECTION_NKEY_SEED ? "configured" : "not set"
      }`
    );
    logger.log(`   - NATS_URL: ${process.env.NATS_URL || "not set"}`);

    // Get NATS options with logging
    logger.log("🔧 Getting NATS configuration...");
    const natsOptions = getNatsOptions(
      CommonConstants.CONNECTION_SERVICE,
      process.env.CONNECTION_NKEY_SEED
    );
    logger.log("📡 NATS Options:");
    logger.log(`   - Service: ${CommonConstants.CONNECTION_SERVICE}`);
    logger.log(`   - Servers: ${JSON.stringify(natsOptions.servers)}`);
    logger.log(`   - Queue: ${natsOptions.queue || "not set"}`);
    logger.log(
      `   - Max Reconnect Attempts: ${natsOptions.maxReconnectAttempts}`
    );
    logger.log(`   - Reconnect Wait Time: ${natsOptions.reconnectTimeWait}`);

    logger.log("🏗️ Creating microservice instance...");
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
      ConnectionModule,
      {
        transport: Transport.NATS,
        options: natsOptions,
      }
    );

    logger.log("🔧 Configuring application...");
    app.useLogger(app.get(NestjsLoggerServiceAdapter));
    app.useGlobalFilters(new HttpExceptionFilter());

    logger.log("🎯 Starting NATS listener...");
    await app.listen();

    logger.log("✅ === CONNECTION SERVICE SUCCESSFULLY STARTED ===");
    logger.log("🔊 Connection-Service Microservice is listening to NATS");
    logger.log("📊 Service Status: READY");

    // Log connection health periodically
    setInterval(() => {
      logger.debug("💓 Connection Service Heartbeat - Service is running");
    }, 30000); // Every 30 seconds
  } catch (error) {
    logger.error("❌ === CONNECTION SERVICE BOOTSTRAP FAILED ===");
    logger.error("💥 Error details:", error);
    logger.error("📋 Error stack:", error.stack);
    logger.error("🔧 Troubleshooting tips:");
    logger.error("   1. Check NATS server is running and accessible");
    logger.error("   2. Verify environment variables are set correctly");
    logger.error("   3. Ensure network connectivity to NATS server");
    logger.error("   4. Check for port conflicts");
    process.exit(1);
  }
}
bootstrap();
