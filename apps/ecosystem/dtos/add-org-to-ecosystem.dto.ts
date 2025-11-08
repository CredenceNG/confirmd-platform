import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { EcosystemRole } from '@prisma/client';

@ApiExtraModels()
export class AddOrgToEcosystemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsNotEmpty()
  @IsString()
  orgId: string;

  @ApiProperty({
    example: ['ECOSYSTEM_ISSUER', 'ECOSYSTEM_VERIFIER'],
    enum: EcosystemRole,
    isArray: true
  })
  @IsNotEmpty()
  @IsArray()
  @IsEnum(EcosystemRole, { each: true })
  ecosystemRole: EcosystemRole[];

  ecosystemId: string;
  userId: string;
}
