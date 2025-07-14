import { IsEmail, IsNotEmpty, IsString, IsOptional } from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { trim } from "@credebl/common/cast.helper";

export class LoginUserDto {
  @ApiProperty({ example: "awqx@yopmail.com" })
  @IsEmail({}, { message: "Please provide a valid email" })
  @IsNotEmpty({ message: "Email is required" })
  @IsString({ message: "Email should be a string" })
  @Transform(({ value }) => trim(value))
  email: string;

  @ApiProperty()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: "Password is required." })
  password: string;

  @ApiPropertyOptional({ description: "Client ID for authentication" })
  @IsOptional()
  @IsString({ message: "Client ID should be a string" })
  @Transform(({ value }) => trim(value))
  clientId?: string;

  @ApiPropertyOptional({ description: "Client Secret for authentication" })
  @IsOptional()
  @IsString({ message: "Client Secret should be a string" })
  @Transform(({ value }) => trim(value))
  clientSecret?: string;
}
