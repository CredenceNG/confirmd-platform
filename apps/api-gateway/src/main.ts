import * as dotenv from "dotenv";
import * as express from "express";

import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger, VERSION_NEUTRAL, VersioningType } from "@nestjs/common";

import { AppModule } from "./app.module";
import { HttpAdapterHost, NestFactory, Reflector } from "@nestjs/core";
import { AllExceptionsFilter } from "@credebl/common/exception-handler";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { getNatsOptions } from "@credebl/common/nats.config";

import helmet from "helmet";
import { CommonConstants } from "@credebl/common/common.constant";
import NestjsLoggerServiceAdapter from "@credebl/logger/nestjsLoggerServiceAdapter";
import { NatsInterceptor } from "@credebl/common";
import { UpdatableValidationPipe } from "@credebl/common/custom-overrideable-validation-pipe";
dotenv.config();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useLogger(app.get(NestjsLoggerServiceAdapter));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: getNatsOptions(CommonConstants.API_GATEWAY_SERVICE, undefined),
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("x-powered-by", false);
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  app.use(function (req, res, next) {
    let err = null;
    try {
      decodeURIComponent(req.path);
    } catch (e) {
      err = e;
    }
    if (err) {
      return res.status(500).json({ message: "Invalid URL" });
    }
    next();
  });

  const options = new DocumentBuilder()
    .setTitle(`${process.env.PLATFORM_NAME}`)
    .setDescription(`${process.env.PLATFORM_NAME} Platform APIs`)
    .setVersion("1.0")
    .addBearerAuth()
    .addServer(`${process.env.PUBLIC_DEV_API_URL}`)
    .addServer(`${process.env.PUBLIC_LOCALHOST_URL}`)
    .addServer(`${process.env.PUBLIC_QA_API_URL}`)
    .addServer(`${process.env.PUBLIC_PRODUCTION_API_URL}`)
    .addServer(`${process.env.PUBLIC_SANDBOX_API_URL}`)
    .addServer(
      `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_ENDPOINT}`
    )
    .addServer(
      `${process.env.API_GATEWAY_PROTOCOL}://${process.env.API_GATEWAY_HOST}`
    )
    .build();

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ["1"],
  });

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("api", app, document);
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // CORS is now handled by nginx proxy, not by the API Gateway
  Logger.log("CORS handling is delegated to nginx proxy");

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ["1", VERSION_NEUTRAL],
  });

  app.use(express.static("uploadedFiles/holder-profile"));
  app.use(express.static("uploadedFiles/org-logo"));
  app.use(express.static("uploadedFiles/tenant-logo"));
  app.use(express.static("uploadedFiles/exports"));
  app.use(express.static("resources"));
  app.use(express.static("genesis-file"));
  app.use(express.static("invoice-pdf"));
  app.use(express.static("uploadedFiles/bulk-verification-templates"));
  app.use(express.static("uploadedFiles/import"));
  app.use("/uploads", express.static("uploads"));
  // Use custom updatable global pipes
  const reflector = app.get(Reflector);
  app.useGlobalPipes(
    new UpdatableValidationPipe(reflector, { whitelist: true, transform: true })
  );
  app.use(
    helmet({
      xssFilter: true,
    })
  );
  app.useGlobalInterceptors(new NatsInterceptor());
  await app.listen(
    process.env.API_GATEWAY_PORT,
    `${process.env.API_GATEWAY_HOST}`
  );
  Logger.log(
    `API Gateway is listening on port ${process.env.API_GATEWAY_PORT}`
  );
}
bootstrap();
