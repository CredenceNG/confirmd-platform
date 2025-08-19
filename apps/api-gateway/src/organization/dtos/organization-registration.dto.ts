import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsNumber
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsNotSQLInjection, trim } from '@credebl/common/cast.helper';

export class OrganizationRegistrationDto {
  // Basic Information
  @ApiProperty({
    description: 'Legal name of the organization as registered',
    example: 'ACME Financial Services Ltd'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Legal name is required.' })
  @IsString({ message: 'Legal name must be in string format.' })
  @IsNotSQLInjection({ message: 'Incorrect pattern for legal name.' })
  legalName: string;

  @ApiProperty({
    description: 'Public display name for the organization',
    example: 'ACME Financial'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Public name is required.' })
  @IsString({ message: 'Public name must be in string format.' })
  @IsNotSQLInjection({ message: 'Incorrect pattern for public name.' })
  publicName: string;

  @ApiProperty({
    description: 'Company registration number',
    example: 'RC123456789'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Company registration number is required.' })
  @IsString({
    message: 'Company registration number must be in string format.'
  })
  companyRegistrationNumber: string;

  @ApiPropertyOptional({
    description: 'Organization website URL',
    example: 'https://www.acmefinancial.com'
  })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsUrl({
    require_protocol: true,
    require_tld: true
  })
  website?: string;

  // Regulatory Information
  @ApiProperty({
    description: 'Regulator ID from the regulators lookup table',
    example: 'ng-cbn'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Regulator ID is required.' })
  @IsString({ message: 'Regulator ID must be in string format.' })
  regulatorId: string;

  @ApiProperty({
    description: 'Registration number with the regulatory body',
    example: 'CBN/REG/2023/001'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Regulation registration number is required.' })
  @IsString({
    message: 'Regulation registration number must be in string format.'
  })
  regulatoryRegistrationNumber: string;

  // Location Information
  @ApiProperty({
    description: 'Country ID from the countries lookup table',
    example: 101
  })
  @IsNotEmpty({ message: 'Country is required.' })
  @IsNumber({}, { message: 'Country ID must be a number.' })
  countryId: number;

  @ApiProperty({
    description: 'State ID from the states lookup table',
    example: 4008
  })
  @IsNotEmpty({ message: 'State is required.' })
  @IsNumber({}, { message: 'State ID must be a number.' })
  stateId: number;

  @ApiProperty({
    description: 'City ID from the cities lookup table',
    example: 1000
  })
  @IsNotEmpty({ message: 'City is required.' })
  @IsNumber({}, { message: 'City ID must be a number.' })
  cityId: number;

  @ApiProperty({
    description: 'Physical address of the organization',
    example: '123 Victoria Island, Lagos State, Nigeria'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Address is required.' })
  @IsString({ message: 'Address must be in string format.' })
  address: string;

  // Official Contact Information
  @ApiProperty({
    description: 'First name of the official contact person',
    example: 'John'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Official contact first name is required.' })
  @IsString({
    message: 'Official contact first name must be in string format.'
  })
  @IsNotSQLInjection({
    message: 'Incorrect pattern for official contact first name.'
  })
  officialContactFirstName: string;

  @ApiProperty({
    description: 'Last name of the official contact person',
    example: 'Doe'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Official contact last name is required.' })
  @IsString({ message: 'Official contact last name must be in string format.' })
  @IsNotSQLInjection({
    message: 'Incorrect pattern for official contact last name.'
  })
  officialContactLastName: string;

  @ApiProperty({
    description: 'Phone number of the official contact person',
    example: '+234-801-234-5678'
  })
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'Official contact phone number is required.' })
  @IsString({
    message: 'Official contact phone number must be in string format.'
  })
  officialContactPhoneNumber: string;

  @ApiPropertyOptional({
    description: 'Organization logo (base64 encoded or URL)',
    example:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Logo must be in string format.' })
  logo?: string = '';

  @ApiPropertyOptional({
    description: 'Organization description',
    example:
      'A leading financial services company providing digital banking solutions'
  })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsString({ message: 'Description must be in string format.' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Webhook URL for notifications',
    example: 'https://api.acmefinancial.com/webhooks/confirmd'
  })
  @IsOptional()
  @Transform(({ value }) => trim(value))
  @IsUrl({
    require_protocol: true,
    require_tld: true
  })
  notificationWebhook?: string;
}
