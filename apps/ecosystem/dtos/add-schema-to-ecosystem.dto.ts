import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min, Max } from 'class-validator';

@ApiExtraModels()
export class AddSchemaToEcosystemDto {
  @ApiProperty({ example: 'schema:123:name:1.0' })
  @IsNotEmpty()
  @IsString()
  schemaLedgerId: string;

  // Pricing
  @ApiProperty({ example: 10.0, description: 'Price for issuing a credential' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  issuancePrice: number;

  @ApiProperty({ example: 5.0, description: 'Price for verifying a credential' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  verificationPrice: number;

  @ApiProperty({ example: 2.0, description: 'Price for revoking a credential' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  revocationPrice: number;

  @ApiProperty({ example: 'USD', description: 'Currency code (USD, EUR, etc.)' })
  @IsNotEmpty()
  @IsString()
  currency: string;

  // Issuance Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of issuance revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuancePlatformShare: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of issuance revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuanceEcosystemShare: number;

  @ApiProperty({ example: 85, description: 'Issuer share of issuance revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  issuanceIssuerShare: number;

  // Verification Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of verification revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationPlatformShare: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of verification revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationEcosystemShare: number;

  @ApiProperty({ example: 85, description: 'Verifier share of verification revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  verificationVerifierShare: number;

  // Revocation Revenue Sharing (must total 100%)
  @ApiProperty({ example: 10, description: 'Platform share of revocation revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationPlatformShare: number;

  @ApiProperty({ example: 5, description: 'Ecosystem share of revocation revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationEcosystemShare: number;

  @ApiProperty({ example: 85, description: 'Issuer share of revocation revenue (%)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  revocationIssuerShare: number;

  ecosystemId: string;
  userId: string;
}
