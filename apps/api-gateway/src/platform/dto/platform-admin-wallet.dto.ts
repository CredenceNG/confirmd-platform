import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  IsEnum,
} from "class-validator";
import { trim } from "@credebl/common/cast.helper";

export enum PlatformAdminWalletType {
  DEDICATED = "DEDICATED",
  SHARED = "SHARED",
}

export enum PlatformAdminWalletNetwork {
  INDICIO_TESTNET = "indicio:testnet",
  INDICIO_MAINNET = "indicio:mainnet",
  BCOVRIN_TESTNET = "bcovrin:testnet",
  POLYGON = "polygon",
  NO_LEDGER = "no-ledger",
}

export class CreatePlatformAdminWalletDto {
  @ApiProperty({
    description: "Label for the platform admin wallet",
    example: "Platform Admin Wallet",
  })
  @IsString({ message: "label must be in string format." })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: "label is required" })
  @MinLength(2, { message: "Minimum length for label must be 2 characters." })
  @MaxLength(50, { message: "Maximum length for label must be 50 characters." })
  label: string;

  @ApiPropertyOptional({
    description: "Wallet type for platform admin",
    enum: PlatformAdminWalletType,
    example: PlatformAdminWalletType.DEDICATED,
  })
  @IsOptional()
  @IsEnum(PlatformAdminWalletType, {
    message: "walletType must be a valid wallet type",
  })
  walletType?: PlatformAdminWalletType;

  @ApiPropertyOptional({
    description: "Network for the platform admin wallet",
    enum: PlatformAdminWalletNetwork,
    example: PlatformAdminWalletNetwork.INDICIO_TESTNET,
  })
  @IsOptional()
  @IsEnum(PlatformAdminWalletNetwork, {
    message: "network must be a valid network",
  })
  network?: PlatformAdminWalletNetwork;

  @ApiPropertyOptional({
    description: "Seed for wallet creation (32-character hex string)",
    example: "000000000000000000000000000000000000000000000000",
  })
  @IsOptional()
  @IsString({ message: "seed must be in string format." })
  @Transform(({ value }) => trim(value))
  seed?: string;

  @ApiPropertyOptional({
    description: "Client socket ID for real-time updates",
    example: "socket-id-12345",
  })
  @IsOptional()
  @IsString({ message: "clientSocketId must be in string format." })
  clientSocketId?: string;

  @ApiPropertyOptional({
    description: "Additional configuration for the wallet",
    example: { enableAdvancedFeatures: true },
  })
  @IsOptional()
  config?: Record<string, unknown>;
}

export class ConfigurePlatformAdminWalletDto {
  @ApiProperty({
    description: "Wallet configuration settings",
    example: {
      autoAcceptConnections: true,
      autoAcceptCredentials: "contentApproved",
    },
  })
  @IsNotEmpty({ message: "config is required" })
  config: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Client socket ID for real-time updates",
    example: "socket-id-12345",
  })
  @IsOptional()
  @IsString({ message: "clientSocketId must be in string format." })
  clientSocketId?: string;
}

export class PlatformAdminWalletStatusDto {
  @ApiProperty({
    description: "Current status of the platform admin wallet",
    example: "ACTIVE",
  })
  status: string;

  @ApiProperty({
    description: "Wallet endpoint URL",
    example: "http://platform-admin-wallet:8001",
  })
  endpoint: string;

  @ApiProperty({
    description: "Wallet creation timestamp",
    example: "2024-01-01T00:00:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last updated timestamp",
    example: "2024-01-01T00:00:00Z",
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Additional wallet information",
  })
  additionalInfo?: Record<string, unknown>;
}
