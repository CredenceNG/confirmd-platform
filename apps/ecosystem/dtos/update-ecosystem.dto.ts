import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

@ApiExtraModels()
export class UpdateEcosystemDto {
  @ApiProperty({ example: 'Healthcare Ecosystem', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ example: 'An updated description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  userId: string;
  ecosystemId: string;
}
