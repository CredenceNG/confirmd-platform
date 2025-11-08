import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EcosystemRole } from '@prisma/client';

@ApiExtraModels()
export class CreateEcosystemInvitationDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiProperty({
    example: ['ECOSYSTEM_MEMBER'],
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
