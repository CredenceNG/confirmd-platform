import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

@ApiExtraModels()
export class UpdateSchemaPricingDto {
  // Pricing
  @ApiProperty({ example: 10.0, description: 'Price for issuing a credential', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  issuancePrice?: number;

  @ApiProperty({ example: 5.0, description: 'Price for verifying a credential', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  verificationPrice?: number;

  @ApiProperty({ example: 2.0, description: 'Price for revoking a credential', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  revocationPrice?: number;

  @ApiProperty({ example: 'USD', description: 'Currency code (USD, EUR, etc.)', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  // Issuance Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of issuance revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuancePlatformShare?: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of issuance revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuanceEcosystemShare?: number;

  @ApiProperty({ example: 85, description: 'Issuer share of issuance revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuanceIssuerShare?: number;

  // Verification Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of verification revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationPlatformShare?: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of verification revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationEcosystemShare?: number;

  @ApiProperty({ example: 85, description: 'Verifier share of verification revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationVerifierShare?: number;

  // Revocation Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of revocation revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationPlatformShare?: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of revocation revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationEcosystemShare?: number;

  @ApiProperty({ example: 85, description: 'Issuer share of revocation revenue (%)', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationIssuerShare?: number;

  ecosystemId: string;
  schemaId: string;
  userId: string;
}
