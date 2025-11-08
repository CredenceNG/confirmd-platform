import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

@ApiExtraModels()
export class CreateEcosystemDto {
  @ApiProperty({ example: 'Healthcare Ecosystem' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://example.com/logo.png', required: false })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({ example: 'A healthcare ecosystem for medical credentials', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  userId: string;
}
