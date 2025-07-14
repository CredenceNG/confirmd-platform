import { trim } from "@credebl/common/cast.helper";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class LoginUserDto {
  @ApiProperty({ example: "awqx@yopmail.com" })
  @IsEmail({}, { message: "Please provide a valid email" })
  @IsNotEmpty({ message: "Email is required" })
  @IsString({ message: "Email should be a string" })
  @Transform(({ value }) => trim(value))
  email: string;

  @ApiProperty({ example: "Password@1" })
  @IsOptional()
  @IsString({ message: "password should be string" })
  password?: string;

  @ApiProperty({ example: "false" })
  @IsOptional()
  @IsBoolean({ message: "isPasskey should be boolean" })
  isPasskey?: boolean;

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
