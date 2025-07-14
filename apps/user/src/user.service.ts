/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
  Inject,
  HttpException
} from '@nestjs/common';


import { ClientRegistrationService } from '@credebl/client-registration';
import { CommonService } from '@credebl/common';
import { EmailDto } from '@credebl/common/dtos/email.dto';
import { LoginUserDto } from '../dtos/login-user.dto';
import { OrgRoles } from 'libs/org-roles/enums';
import { OrgRolesService } from '@credebl/org-roles';
import { PrismaService } from '@credebl/prisma-service';
import { ResponseMessages } from '@credebl/common/response-messages';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { URLUserEmailTemplate } from '../templates/user-email-template';
import { UserOrgRolesService } from '@credebl/user-org-roles';
import { UserRepository } from '../repositories/user.repository';
import { VerifyEmailTokenDto } from '../dtos/verify-email.dto';
import { sendEmail } from '@credebl/common/send-grid-helper-file';
import {
  ICheckUserDetails,
  OrgInvitations,
  PlatformSettings,
  IOrgUsers,
  UpdateUserProfile,
   IUserInformation,
    IUsersProfile,
    IUserResetPassword,
    IUserDeletedActivity,
    UserKeycloakId,
    IEcosystemConfig,
    IUserForgotPassword
} from '../interfaces/user.interface';
import { RecordType } from '@prisma/client';
import { AcceptRejectInvitationDto } from '../dtos/accept-reject-invitation.dto';
import { UserActivityService } from '@credebl/user-activity';
import { SupabaseService } from '@credebl/supabase';
import { UserDevicesRepository } from '../repositories/user-device.repository';
import { v4 as uuidv4 } from 'uuid';
import { Invitation, UserRole } from '@credebl/enum/enum';
import validator from 'validator';
import { DISALLOWED_EMAIL_DOMAIN } from '@credebl/common/common.constant';
import { AwsService } from '@credebl/aws';
import { IUsersActivity } from 'libs/user-activity/interface';
import { ISendVerificationEmail, ISignInUser, IVerifyUserEmail, IUserInvitations, IResetPasswordResponse, ISignUpUserResponse } from '@credebl/common/interfaces/user.interface';
// import { AddPasskeyDetailsDto } from 'apps/api-gateway/src/user/dto/add-user.dto';
import { URLUserResetPasswordTemplate } from '../templates/reset-password-template';
import { toNumber } from '@credebl/common/cast.helper';
import * as jwt from 'jsonwebtoken';
import { NATSClient } from '@credebl/common/NATSClient';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientRegistrationService: ClientRegistrationService,
    private readonly supabaseService: SupabaseService,
    private readonly commonService: CommonService,
    private readonly orgRoleService: OrgRolesService,
    private readonly userOrgRoleService: UserOrgRolesService,
    private readonly userActivityService: UserActivityService,
    private readonly userRepository: UserRepository,
    private readonly awsService: AwsService,
    private readonly userDevicesRepository: UserDevicesRepository,
    private readonly logger: Logger,
    @Inject('NATS_CLIENT') private readonly userServiceProxy: ClientProxy,
    private readonly natsClient : NATSClient
  ) {}

  /**
   *
   * @param userEmailVerification
   * @returns
   */

  async sendVerificationMail(userEmailVerification: ISendVerificationEmail): Promise<any> {
    try {
      const { email, brandLogoUrl, platformName, clientId, clientSecret } = userEmailVerification;
  
      if ('PROD' === process.env.PLATFORM_PROFILE_MODE) {
        // eslint-disable-next-line prefer-destructuring
        const domain = email.split('@')[1];
        if (DISALLOWED_EMAIL_DOMAIN.includes(domain)) {
          throw new BadRequestException(ResponseMessages.user.error.InvalidEmailDomain);
        }
      }
  
      const userDetails = await this.userRepository.checkUserExist(email);
  
      if (userDetails) {
        if (userDetails.isEmailVerified) {
          throw new ConflictException(ResponseMessages.user.error.exists);
        } else {
          throw new ConflictException(ResponseMessages.user.error.verificationAlreadySent);
        }
      }
  
      const verifyCode = uuidv4();
      let sendVerificationMail: boolean;

      try {
        this.logger.log(`🔓 Processing client credentials for email: ${email}`);
        
        // Try to decrypt the client credentials, but if they're plain text, use them as is
        let decryptedClientId = clientId;
        let decryptedClientSecret = clientSecret;
        
        try {
          // Try to decrypt - if it fails, they're already plain text
          decryptedClientId = await this.commonService.decryptPassword(clientId);
          decryptedClientSecret = await this.commonService.decryptPassword(clientSecret);
          this.logger.log(`🔓 Client credentials were encrypted and decrypted successfully`);
        } catch (decryptError) {
          // If decryption fails, assume they're plain text (for development/testing)
          this.logger.log(`🔓 Client credentials appear to be plain text, using as is`);
          decryptedClientId = clientId;
          decryptedClientSecret = clientSecret;
        }
        
        this.logger.log(`🔓 Client credentials processed successfully. ClientId: ${decryptedClientId ? decryptedClientId.substring(0, 8) : 'MISSING'}...`);
        
        const token = await this.clientRegistrationService.getManagementToken(decryptedClientId, decryptedClientSecret);
        this.logger.log(`🎫 Management token obtained successfully`);
        
        const getClientData = await this.clientRegistrationService.getClientRedirectUrl(decryptedClientId, token);
        this.logger.log(`🔗 Client redirect data retrieved: ${JSON.stringify(getClientData)}`);

        const [redirectUrl] = getClientData[0]?.redirectUris || [];
  
        if (!redirectUrl) {
          throw new NotFoundException(ResponseMessages.user.error.redirectUrlNotFound);
        }
  
        this.logger.log(`🔗 Redirect URL found: ${redirectUrl}`);
        
        sendVerificationMail = await this.sendEmailForVerification(email, verifyCode, redirectUrl, decryptedClientId, brandLogoUrl, platformName);
      } catch (error) {
        this.logger.error(`❌ Error in sendVerificationMail flow: ${JSON.stringify(error)}`);
        throw new InternalServerErrorException(ResponseMessages.user.error.emailSend);
      }
  
      if (sendVerificationMail) {
        const uniqueUsername = await this.createUsername(email, verifyCode);
        userEmailVerification.username = uniqueUsername;
        // Store the original encrypted values in the database
        userEmailVerification.clientId = clientId;
        userEmailVerification.clientSecret = clientSecret;
        const resUser = await this.userRepository.createUser(userEmailVerification, verifyCode);
        return resUser;
      } 
    } catch (error) {
      this.logger.error(`In Create User : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async createUsername(email: string, verifyCode: string): Promise<string> {
    try {
      // eslint-disable-next-line prefer-destructuring
      const emailTrim = email.split('@')[0];

      // Replace special characters with hyphens
      const cleanedUsername = emailTrim.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '-');

      // Generate a 5-digit UUID
      // eslint-disable-next-line prefer-destructuring
      const uuid = verifyCode.split('-')[0];

      // Combine cleaned username and UUID
      const uniqueUsername = `${cleanedUsername}-${uuid}`;

      return uniqueUsername;
    } catch (error) {
      this.logger.error(`Error in createUsername: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   *
   * @param email
   * @param orgName
   * @param verificationCode
   * @returns
   */

  async sendEmailForVerification(email: string, verificationCode: string, redirectUrl: string, clientId: string, brandLogoUrl:string, platformName: string): Promise<boolean> {
    try {
      this.logger.log(`📧 Starting email verification for: ${email}`);
      const platformConfigData = await this.prisma.platform_config.findMany();
      this.logger.log(`📧 Platform config data: ${JSON.stringify(platformConfigData)}`);

      // clientId is already decrypted when passed from sendVerificationMail
      const urlEmailTemplate = new URLUserEmailTemplate();
      const emailData = new EmailDto();
      emailData.emailFrom = platformConfigData[0].emailFrom;
      emailData.emailTo = email;
      const platform = platformName || process.env.PLATFORM_NAME;
      emailData.emailSubject = `[${platform}] Verify your email to activate your account`;

      this.logger.log(`📧 Email data prepared: From=${emailData.emailFrom}, To=${emailData.emailTo}, Subject=${emailData.emailSubject}`);

      emailData.emailHtml = await urlEmailTemplate.getUserURLTemplate(email, verificationCode, redirectUrl, clientId, brandLogoUrl, platformName);
      this.logger.log(`📧 Email HTML template generated successfully`);
      
      const isEmailSent = await sendEmail(emailData);
      this.logger.log(`📧 Email send result: ${isEmailSent}`);
      
      if (isEmailSent) {
        return isEmailSent;
      } else {
        throw new InternalServerErrorException(ResponseMessages.user.error.emailSend);
      }
    } catch (error) {
      this.logger.error(`❌ Error in sendEmailForVerification: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   *
   * @param param email, verification code
   * @returns Email verification succcess
   */

  async verifyEmail(param: VerifyEmailTokenDto): Promise<IVerifyUserEmail> {
    try {
      const invalidMessage = ResponseMessages.user.error.invalidEmailUrl;

      if (!param.verificationCode || !param.email) {
        throw new UnauthorizedException(invalidMessage);
      }

      const userDetails = await this.userRepository.getUserDetails(param.email);

      if (!userDetails || param.verificationCode !== userDetails.verificationCode) {
        throw new UnauthorizedException(invalidMessage);
      }

      if (userDetails.isEmailVerified) {
        throw new ConflictException(ResponseMessages.user.error.verifiedEmail);
      }

      if (param.verificationCode === userDetails.verificationCode) {
        const verifiedEmail = await this.userRepository.verifyUser(param.email);
        return verifiedEmail;
      }
    } catch (error) {
      this.logger.error(`error in verifyEmail: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async createUserForToken(userInfo: IUserInformation): Promise<ISignUpUserResponse> {
    try {
      this.logger.log(`🚀 === STARTING USER CREATION FOR TOKEN === Email: ${userInfo.email}`);
      const { email } = userInfo;
      if (!userInfo.email) {
        throw new UnauthorizedException(ResponseMessages.user.error.invalidEmail);
      }
      const checkUserDetails = await this.userRepository.getUserDetails(userInfo.email.toLowerCase());

      if (!checkUserDetails) {
        throw new NotFoundException(ResponseMessages.user.error.emailIsNotVerified);
      }
      if (checkUserDetails.keycloakUserId || (!checkUserDetails.keycloakUserId && checkUserDetails.supabaseUserId)) {
        throw new ConflictException(ResponseMessages.user.error.exists);
      }
      if (false === checkUserDetails.isEmailVerified) {
        throw new NotFoundException(ResponseMessages.user.error.verifyEmail);
      }
      this.logger.log(`📋 User validation passed for ${userInfo.email}`);
      
      const resUser = await this.userRepository.updateUserInfo(userInfo.email.toLowerCase(), userInfo);
      if (!resUser) {
        throw new NotFoundException(ResponseMessages.user.error.invalidEmail);
      }
      const userDetails = await this.userRepository.getUserDetails(userInfo.email.toLowerCase());
      if (!userDetails) {
        throw new NotFoundException(ResponseMessages.user.error.adduser);
      }
      this.logger.log(`📝 User info updated successfully for ${userInfo.email}`);
      
   let keycloakDetails = null;
      
   this.logger.log(`🔑 Getting management token for user ${userInfo.email}`);
   this.logger.log(`🔓 Processing client credentials for user creation...`);
   
   // Try to decrypt the client credentials, but if they're plain text, use them as is
   let decryptedClientId = checkUserDetails.clientId;
   let decryptedClientSecret = checkUserDetails.clientSecret;
   
   try {
     // Try to decrypt - if it fails, they're already plain text
     decryptedClientId = await this.commonService.decryptPassword(checkUserDetails.clientId);
     decryptedClientSecret = await this.commonService.decryptPassword(checkUserDetails.clientSecret);
     this.logger.log(`🔓 Client credentials were encrypted and decrypted successfully for user creation`);
   } catch (decryptError) {
     // If decryption fails, assume they're plain text (for development/testing)
     this.logger.log(`🔓 Client credentials appear to be plain text, using as is for user creation`);
     decryptedClientId = checkUserDetails.clientId;
     decryptedClientSecret = checkUserDetails.clientSecret;
   }
   
   this.logger.log(`🔓 Client credentials processed successfully for user creation. ClientId: ${decryptedClientId ? decryptedClientId.substring(0, 8) : 'MISSING'}...`);
   
   const token = await this.clientRegistrationService.getManagementToken(decryptedClientId, decryptedClientSecret);
   this.logger.log(`✅ Management token obtained successfully for ${userInfo.email}`);
      if (userInfo.isPasskey) {
        this.logger.log(`🔐 Processing passkey flow for ${userInfo.email}`);
        const resUser = await this.userRepository.addUserPassword(email.toLowerCase(), userInfo.password);
        const userDetails = await this.userRepository.getUserDetails(email.toLowerCase());
        const decryptedPassword = await this.commonService.decryptPassword(userDetails.password);

        if (!resUser) {
          throw new NotFoundException(ResponseMessages.user.error.invalidEmail);
        }

        userInfo.password = decryptedPassword;
        this.logger.log(`🔒 About to create user in Keycloak with passkey for ${userInfo.email}`);
        try {          
          keycloakDetails = await this.clientRegistrationService.createUser(userInfo, process.env.KEYCLOAK_REALM, token);
          this.logger.log(`✅ User created successfully in Keycloak with passkey for ${userInfo.email}`);
        } catch (error) {
          this.logger.error(`❌ Error creating user in Keycloak with passkey for ${userInfo.email}: ${JSON.stringify(error)}`);
          throw new InternalServerErrorException('Error while registering user on keycloak');
        }
      } else {
        this.logger.log(`🔑 Processing regular signup flow for ${userInfo.email}`);
        this.logger.log(`📋 Original password present: ${Boolean(userInfo.password)}`);
        
        // For regular signup, password comes from frontend already encrypted
        // We should save it as-is (already encrypted by frontend)
        const frontendEncryptedPassword = userInfo.password;
        this.logger.log(`🔐 Using frontend-encrypted password for database storage`);
        
        // Save the frontend-encrypted password to database (no additional encryption)
        const resUser = await this.userRepository.addUserPassword(email.toLowerCase(), frontendEncryptedPassword);
        if (!resUser) {
          throw new NotFoundException(ResponseMessages.user.error.invalidEmail);
        }
        this.logger.log(`💾 Password saved to database for ${userInfo.email}`);
        
        // For Keycloak, we need to decrypt the password to get the plain text
        const decryptedPasswordForKeycloak = await this.commonService.decryptPassword(frontendEncryptedPassword);
        this.logger.log(`📋 Using decrypted password for Keycloak user creation`);

        // Update userInfo with decrypted password for Keycloak
        userInfo.password = decryptedPasswordForKeycloak;

        this.logger.log(`🔒 About to create user in Keycloak for ${userInfo.email}`);

        try {          
          keycloakDetails = await this.clientRegistrationService.createUser(userInfo, process.env.KEYCLOAK_REALM, token);
          this.logger.log(`✅ User created successfully in Keycloak for ${userInfo.email}`);
        } catch (error) {
          this.logger.error(`❌ Error creating user in Keycloak for ${userInfo.email}: ${JSON.stringify(error)}`);
          
          // Check if error is due to user already existing in Keycloak
          if (error.response && 409 === error.response.statusCode) {
            this.logger.log(`🔄 User already exists in Keycloak, fetching existing user details for ${userInfo.email}`);
            try {
              // Get the existing user from Keycloak using email parameter instead of username
              const keycloakDomain = process.env.KEYCLOAK_DOMAIN.endsWith('/') ? process.env.KEYCLOAK_DOMAIN.slice(0, -1) : process.env.KEYCLOAK_DOMAIN;
              const getUserUrl = `${keycloakDomain}/admin/realms/${process.env.KEYCLOAK_REALM}/users?email=${encodeURIComponent(userInfo.email)}`;
              this.logger.log(`📡 Fetching existing user from URL: ${getUserUrl}`);
              
              const getUserResponse = await this.commonService.httpGet(getUserUrl, { headers: { authorization: `Bearer ${token}` } });
              this.logger.log(`📋 Get user response: ${JSON.stringify(getUserResponse)}`);
              
              if (getUserResponse && 0 < getUserResponse.length) {
                keycloakDetails = { keycloakUserId: getUserResponse[0].id };
                this.logger.log(`✅ Found existing user in Keycloak with ID: ${keycloakDetails.keycloakUserId}`);
              } else {
                this.logger.error(`❌ No user found in Keycloak response: ${JSON.stringify(getUserResponse)}`);
                throw new Error('User not found in Keycloak after conflict error');
              }
            } catch (fetchError) {
              this.logger.error(`❌ Error fetching existing user from Keycloak: ${JSON.stringify(fetchError)}`);
              throw new BadRequestException('Error while fetching existing user from Keycloak');
            }
          } else {
            throw new BadRequestException('Error while registering user on keycloak');
          }
        }
      }

      await this.userRepository.updateUserDetails(userDetails.id,
        keycloakDetails.keycloakUserId.toString()
      );

      if (userInfo?.isHolder) {
        const getUserRole = await this.userRepository.getUserRole(UserRole.HOLDER);

        if (!getUserRole) {
          throw new NotFoundException(ResponseMessages.user.error.userRoleNotFound);
        }
        await this.userRepository.storeUserRole(userDetails.id, getUserRole?.id);
      }

      const realmRoles = await this.clientRegistrationService.getAllRealmRoles(token);
      
      // For signup flow, use mb-user role instead of holder role
      const mbUserRole = realmRoles.filter(role => 'mb-user' === role.name);
      const mbUserRoleData = 0 < mbUserRole.length && mbUserRole[0];

      if (mbUserRoleData) {
        const payload = [
          {
            id: mbUserRoleData.id,
            name: mbUserRoleData.name
          }
        ];

        this.logger.log(`🎯 Assigning mb-user role to user ${userInfo.email} with role ID: ${mbUserRoleData.id}`);
        await this.clientRegistrationService.createUserHolderRole(token, keycloakDetails.keycloakUserId.toString(), payload);
        this.logger.log(`✅ Successfully assigned mb-user role to user ${userInfo.email}`);
      } else {
        this.logger.error(`❌ mb-user role not found in realm roles`);
        throw new BadRequestException('mb-user role not found in realm');
      }
      
      // Still need to handle the org role mapping for database consistency
      try {
        const holderOrgRole = await this.orgRoleService.getRole(OrgRoles.HOLDER);
        await this.userOrgRoleService.createUserOrgRole(userDetails.id, holderOrgRole.id, null, mbUserRoleData.id);
      } catch (orgRoleError) {
        this.logger.error(`❌ Error creating org role mapping: ${JSON.stringify(orgRoleError)}`);
        // Don't throw here as the main user creation was successful
      }

      return { userId: userDetails?.id };
    } catch (error) {
      this.logger.error(`Error in createUserForToken: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async addPasskey(email: string, userInfo: IUserInformation): Promise<string> {
    try {
      if (!email.toLowerCase()) {
        throw new UnauthorizedException(ResponseMessages.user.error.invalidEmail);
      }
      const checkUserDetails = await this.userRepository.getUserDetails(email.toLowerCase());
      if (!checkUserDetails) {
        throw new NotFoundException(ResponseMessages.user.error.invalidEmail);
      }
      if (!checkUserDetails.keycloakUserId) {
        throw new ConflictException(ResponseMessages.user.error.notFound);
      }
      if (false === checkUserDetails.isEmailVerified) {
        throw new NotFoundException(ResponseMessages.user.error.emailNotVerified);
      }

      const decryptedPassword = await this.commonService.decryptPassword(userInfo.password);
      const tokenResponse = await this.generateToken(email.toLowerCase(), decryptedPassword, checkUserDetails);

      if (!tokenResponse) {
        throw new UnauthorizedException(ResponseMessages.user.error.invalidCredentials);
      }

      const resUser = await this.userRepository.addUserPassword(email.toLowerCase(), userInfo.password);
      if (!resUser) {
        throw new NotFoundException(ResponseMessages.user.error.invalidEmail);
      }

      return ResponseMessages.user.success.updateUserProfile;
    } catch (error) {
      this.logger.error(`Error in createUserForToken: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  private validateEmail(email: string): void {
    if (!validator.isEmail(email.toLowerCase())) {
      throw new UnauthorizedException(ResponseMessages.user.error.invalidEmail);
    }
  }

  /**
   *
   * @param loginUserDto
   * @returns User access token details
   */
  async login(loginUserDto: LoginUserDto): Promise<ISignInUser> {
    const { email, password, isPasskey, clientId, clientSecret } = loginUserDto;

    try {
      this.logger.log(`🔐 Starting login process for: ${email}`);
      this.logger.log(`🔑 Client credentials provided: clientId=${clientId ? 'YES' : 'NO'}, clientSecret=${clientSecret ? 'YES' : 'NO'}`);

      this.validateEmail(email.toLowerCase());
      const userData = await this.userRepository.checkUserExist(email.toLowerCase());
      if (!userData) {
        this.logger.log(`❌ User not found: ${email}`);
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      this.logger.log(`✅ User found: ${email} (ID: ${userData.id})`);

      if (userData && !userData.isEmailVerified) {
        this.logger.log(`⚠️ Email not verified for user: ${email}`);
        throw new BadRequestException(ResponseMessages.user.error.verifyMail);
      }

      if (true === isPasskey && false === userData?.isFidoVerified) {
        this.logger.log(`⚠️ FIDO not verified for user: ${email}`);
        throw new UnauthorizedException(ResponseMessages.user.error.registerFido);
      }

      if (true === isPasskey && userData?.username && true === userData?.isFidoVerified) {
        this.logger.log(`🔑 Using FIDO authentication for user: ${email}`);
        const getUserDetails = await this.userRepository.getUserDetails(userData.email.toLowerCase());
        const decryptedPassword = await this.commonService.decryptPassword(getUserDetails.password);
        return await this.generateToken(email.toLowerCase(), decryptedPassword, userData);
      } else {
        this.logger.log(`🔑 Using password authentication for user: ${email}`);
        
        let decryptedPassword;
        try {
          decryptedPassword = await this.commonService.decryptPassword(password);
          this.logger.log(`🔓 Password decrypted successfully`);
        } catch (decryptError) {
          this.logger.error(`❌ Password decryption failed: ${decryptError.message}`);
          this.logger.log(`🔓 Attempting to use password as plain text`);
          decryptedPassword = password;
        }
        
        this.logger.log(`🎯 About to call generateToken for user: ${email}`);
        this.logger.log(`📊 User data: keycloakUserId=${userData.keycloakUserId}, id=${userData.id}`);
        
        // Pass the provided client credentials or use database credentials
        const result = await this.generateToken(email.toLowerCase(), decryptedPassword, userData);
        this.logger.log(`✅ generateToken completed successfully for user: ${email}`);
        return result;        
      }
    } catch (error) {
      this.logger.error(`In Login User : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async refreshTokenDetails(refreshToken: string): Promise<ISignInUser> {

    try {
        try {
          const data = jwt.decode(refreshToken) as jwt.JwtPayload;
          const userByKeycloakId = await this.userRepository.getUserByKeycloakId(data?.sub);
          
          // Decrypt both clientId and clientSecret before sending to Keycloak
          const decryptedClientId = await this.commonService.decryptPassword(userByKeycloakId?.['clientId']);
          const decryptedClientSecret = await this.commonService.decryptPassword(userByKeycloakId?.['clientSecret']);
          
          const tokenResponse = await this.clientRegistrationService.getAccessToken(refreshToken, decryptedClientId, decryptedClientSecret);
          return tokenResponse;
        } catch (error) {
          throw new BadRequestException(ResponseMessages.user.error.invalidRefreshToken);
        }
   
    } catch (error) {
      this.logger.error(`In refreshTokenDetails : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);

    }
  }

  async updateFidoVerifiedUser(email: string, isFidoVerified: boolean, password: string): Promise<boolean> {
    if (isFidoVerified) {
      await this.userRepository.addUserPassword(email.toLowerCase(), password);
      return true;
    }
  }

  /**
   * Forgot password
   * @param forgotPasswordDto 
   * @returns 
   */
  async forgotPassword(forgotPasswordDto: IUserForgotPassword): Promise<IResetPasswordResponse> {
    const { email, brandLogoUrl, platformName, endpoint } = forgotPasswordDto;
    try {
      this.validateEmail(email.toLowerCase());
      const userData = await this.userRepository.checkUserExist(email.toLowerCase());
      if (!userData) {
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      if (userData && !userData.isEmailVerified) {
        throw new BadRequestException(ResponseMessages.user.error.verifyMail);
      }

      const token = uuidv4();
      const expirationTime = new Date();
      expirationTime.setHours(expirationTime.getHours() + 1); // Set expiration time to 1 hour from now
  
      const tokenCreated = await this.userRepository.createTokenForResetPassword(userData.id, token, expirationTime);

      if (!tokenCreated) {
        throw new InternalServerErrorException(ResponseMessages.user.error.resetPasswordLink);
      }

      try {
        await this.sendEmailForResetPassword(email, brandLogoUrl, platformName, endpoint, tokenCreated.token);
      } catch (error) {
        throw new InternalServerErrorException(ResponseMessages.user.error.emailSend);
      }

      return {
        id: tokenCreated.id,
        email: userData.email
      };
      
    } catch (error) {
      this.logger.error(`Error In forgotPassword : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Send email for token verification of reset password
   * @param email 
   * @param verificationCode 
   * @returns 
   */
  async sendEmailForResetPassword(email: string, brandLogoUrl: string, platformName: string, endpoint: string, verificationCode: string): Promise<boolean> {
    try {
      const platformConfigData = await this.prisma.platform_config.findMany();

      const urlEmailTemplate = new URLUserResetPasswordTemplate();
      const emailData = new EmailDto();
      emailData.emailFrom = platformConfigData[0].emailFrom;
      emailData.emailTo = email;

      const platform = platformName || process.env.PLATFORM_NAME;
      emailData.emailSubject = `[${platform}] Important: Password Reset Request`;

      emailData.emailHtml = await urlEmailTemplate.getUserResetPasswordTemplate(email, platform, brandLogoUrl, endpoint, verificationCode);
      const isEmailSent = await sendEmail(emailData);
      if (isEmailSent) {
        return isEmailSent;
      } else {
        throw new InternalServerErrorException(ResponseMessages.user.error.emailSend);
      }
    } catch (error) {
      this.logger.error(`Error in sendEmailForResetPassword: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   * Create reset password token
   * @param resetPasswordDto 
   * @returns user details
   */
  async resetTokenPassword(resetPasswordDto: IUserResetPassword): Promise<IResetPasswordResponse> {
    
    const { email, password, token } = resetPasswordDto;

    try {
      this.validateEmail(email.toLowerCase());
      const userData = await this.userRepository.checkUserExist(email.toLowerCase());
      if (!userData) {
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      if (userData && !userData.isEmailVerified) {
        throw new BadRequestException(ResponseMessages.user.error.verifyMail);
      }
 
      const tokenDetails = await this.userRepository.getResetPasswordTokenDetails(userData.id, token);

      if (!tokenDetails || (new Date() > tokenDetails.expiresAt)) {
        throw new BadRequestException(ResponseMessages.user.error.invalidResetLink);
      }

      const decryptedPassword = await this.commonService.decryptPassword(password);
      try {    
        // Decrypt both clientId and clientSecret before sending to Keycloak
        const decryptedClientId = await this.commonService.decryptPassword(userData.clientId);
        const decryptedClientSecret = await this.commonService.decryptPassword(userData.clientSecret);

        const authToken = await this.clientRegistrationService.getManagementToken(decryptedClientId, decryptedClientSecret);  
        userData.password = decryptedPassword;
        if (userData.keycloakUserId) {
          await this.clientRegistrationService.resetPasswordOfUser(userData, process.env.KEYCLOAK_REALM, authToken);
        } else {          
          const keycloakDetails = await this.clientRegistrationService.createUser(userData, process.env.KEYCLOAK_REALM, authToken);
          await this.userRepository.updateUserDetails(userData.id,
            keycloakDetails.keycloakUserId.toString()
          );
        }

        await this.updateFidoVerifiedUser(email.toLowerCase(), userData.isFidoVerified, password);

      } catch (error) {
        this.logger.error(`Error reseting the password`, error);
        throw new InternalServerErrorException('Error while reseting user password');
      }

      await this.userRepository.deleteResetPasswordToken(tokenDetails.id);

      return {
        id: userData.id,
        email: userData.email
      };
      
    } catch (error) {
      this.logger.error(`Error In resetTokenPassword : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  findUserByUserId(id: string): Promise<IUsersProfile> {
    return this.userRepository.getUserById(id);

  }

  async resetPassword(resetPasswordDto: IUserResetPassword): Promise<IResetPasswordResponse> {
    const { email, oldPassword, newPassword } = resetPasswordDto;

    try {
      this.validateEmail(email.toLowerCase());
      const userData = await this.userRepository.checkUserExist(email.toLowerCase());
      if (!userData) {
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      if (userData && !userData.isEmailVerified) {
        throw new BadRequestException(ResponseMessages.user.error.verifyMail);
      }

      const oldDecryptedPassword = await this.commonService.decryptPassword(oldPassword);
      const newDecryptedPassword = await this.commonService.decryptPassword(newPassword);

      if (oldDecryptedPassword === newDecryptedPassword) {
        throw new BadRequestException(ResponseMessages.user.error.resetSamePassword);
      }

      const tokenResponse = await this.generateToken(email.toLowerCase(), oldDecryptedPassword, userData);
      
      if (tokenResponse) {
        userData.password = newDecryptedPassword;
        try {    
          let keycloakDetails = null;    
          // Decrypt both clientId and clientSecret before sending to Keycloak
          const decryptedClientId = await this.commonService.decryptPassword(userData.clientId);
          const decryptedClientSecret = await this.commonService.decryptPassword(userData.clientSecret);
          
          const token = await this.clientRegistrationService.getManagementToken(decryptedClientId, decryptedClientSecret);  

          if (userData.keycloakUserId) {

            keycloakDetails = await this.clientRegistrationService.resetPasswordOfUser(userData, process.env.KEYCLOAK_REALM, token);
            await this.updateFidoVerifiedUser(email.toLowerCase(), userData.isFidoVerified, newPassword);

          } else {
            keycloakDetails = await this.clientRegistrationService.createUser(userData, process.env.KEYCLOAK_REALM, token);
            await this.userRepository.updateUserDetails(userData.id,
              keycloakDetails.keycloakUserId.toString()
            );
            await this.updateFidoVerifiedUser(email.toLowerCase(), userData.isFidoVerified, newPassword);
          }

          return {
            id: userData.id,
            email: userData.email
          };
    
        } catch (error) {
          throw new InternalServerErrorException('Error while registering user on keycloak');
        }
      } else {
        throw new BadRequestException(ResponseMessages.user.error.invalidCredentials);
      }

    } catch (error) {
      this.logger.error(`In Login User : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getProfile(payload: { id }): Promise<IUsersProfile> {
    try {
      this.logger.log(`🔍 getProfile called for user ID: ${payload.id}`);
      
      const userData = await this.userRepository.getUserById(payload.id);
      
      if (!userData) {
        this.logger.error(`❌ User not found for ID: ${payload.id}`);
        throw new NotFoundException('User not found');
      }
      
      this.logger.log(`✅ User found: ${userData.email}`);
      this.logger.log(`👤 User org roles count: ${userData.userOrgRoles ? userData.userOrgRoles.length : 0}`);
      
      if (userData.userOrgRoles && 0 < userData.userOrgRoles.length) {
        this.logger.log(`📋 User roles: ${userData.userOrgRoles.map(r => r.orgRole.name).join(', ')}`);
      }

      if ('true' === process.env.IS_ECOSYSTEM_ENABLE) {
        const ecosystemSettings = await this._getEcosystemConfig();
        for (const setting of ecosystemSettings) {
          userData[setting.key] = 'true' === setting.value;
        }
      }
    
      return userData;
    } catch (error) {
      this.logger.error(`❌ Error in getProfile: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async  _getEcosystemConfig(): Promise<IEcosystemConfig[]> {
    const pattern = { cmd: 'get-ecosystem-config-details' };
    const payload = { };

    const getEcosystemConfigDetails = await this.userServiceProxy
      .send(pattern, payload)
      .toPromise()
      .catch((error) => {
        this.logger.error(`catch: ${JSON.stringify(error)}`);
        throw new HttpException(
          {
            status: error.status,
            error: error.message
          },
          error.status
        );
      });

    return getEcosystemConfigDetails;
  }

  async getPublicProfile(payload: { username }): Promise<IUsersProfile> {
    try {
      const userProfile = await this.userRepository.getUserPublicProfile(payload.username);

      if (!userProfile) {
        throw new NotFoundException(ResponseMessages.user.error.profileNotFound);
      }

      return userProfile;
    } catch (error) {
      this.logger.error(`get user: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async updateUserProfile(updateUserProfileDto: UpdateUserProfile): Promise<any> {
    try {
      return this.userRepository.updateUserProfile(updateUserProfileDto);
    } catch (error) {
      this.logger.error(`update user profile: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async findByKeycloakId(payload: { id }): Promise<object> {
    try {
      return this.userRepository.getUserBySupabaseId(payload.id);
    } catch (error) {
      this.logger.error(`get user: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async findSupabaseUser(payload: { id }): Promise<object> {
    try {
      return await this.userRepository.getUserBySupabaseId(payload.id);
    } catch (error) {
      this.logger.error(`Error in findSupabaseUser: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async findKeycloakUser(payload: { id }): Promise<object> {
    try {
      return await this.userRepository.getUserByKeycloakId(payload.id);
    } catch (error) {
      this.logger.error(`Error in findKeycloakUser: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async findUserByEmail(payload: { email }): Promise<object> {
    try {
      return await this.userRepository.findUserByEmail(payload.email);
    } catch (error) {
      this.logger.error(`findUserByEmail: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async invitations(payload: { id; status; pageNumber; pageSize; search }): Promise<IUserInvitations> {
    try {
      const userData = await this.userRepository.getUserById(payload.id);
      if (!userData) {
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      const invitationsData = await this.getOrgInvitations(
        userData.email,
        payload.status,
        payload.pageNumber,
        payload.pageSize,
        payload.search
        );
       
        const invitations: OrgInvitations[] = await this.updateOrgInvitations(invitationsData['invitations']);
        invitationsData['invitations'] = invitations;

      return invitationsData;
      
    } catch (error) {
      this.logger.error(`Error in get invitations: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getOrgInvitations(
    email: string,
    status: string,
    pageNumber: number,
    pageSize: number,
    search = ''
  ): Promise<IUserInvitations> {
    const pattern = { cmd: 'fetch-user-invitations' };
    const payload = {
      email,
      status,
      pageNumber,
      pageSize,
      search
    };

    const invitationsData = await this.natsClient
      .send<IUserInvitations>(this.userServiceProxy, pattern, payload)
      
      .catch((error) => {
        this.logger.error(`catch: ${JSON.stringify(error)}`);
        throw new HttpException(
          {
            status: error.status,
            error: error.message
          },
          error.status
        );
      });

    return invitationsData;
  }

  async updateOrgInvitations(invitations: OrgInvitations[]): Promise<OrgInvitations[]> {

    
    const updatedInvitations = [];

    for (const invitation of invitations) {
      const { status, id, organisation, orgId, userId, orgRoles } = invitation;

      const roles = await this.orgRoleService.getOrgRolesByIds(orgRoles as string[]);

      updatedInvitations.push({
        orgRoles: roles,
        status,
        id,
        orgId,
        organisation,
        userId
      });
    }

    return updatedInvitations;
  }

  /**
   *
   * @param acceptRejectInvitation
   * @param userId
   * @returns Organization invitation status
   */
  async acceptRejectInvitations(acceptRejectInvitation: AcceptRejectInvitationDto, userId: string): Promise<IUserInvitations> {
    try {
      const userData = await this.userRepository.getUserById(userId);
     
      if (Invitation.ACCEPTED === acceptRejectInvitation.status) {
        const payload = {userId};
        const TotalOrgs = await this._getTotalOrgCount(payload);
  
        if (TotalOrgs >= toNumber(`${process.env.MAX_ORG_LIMIT}`)) {
        throw new BadRequestException(ResponseMessages.user.error.userOrgsLimit);
         }
      }
      return this.fetchInvitationsStatus(acceptRejectInvitation, userData.keycloakUserId, userData.email, userId);
    } catch (error) {
      this.logger.error(`acceptRejectInvitations: ${error}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async  _getTotalOrgCount(payload: { userId: string }): Promise<number> {
    const pattern = { cmd: 'get-organizations-count' };

    const getOrganizationCount = await this.natsClient
      .send<number>(this.userServiceProxy, pattern, payload)
      
      .catch((error) => {
        this.logger.error(`catch: ${JSON.stringify(error)}`);
        throw new HttpException(
          {
            status: error.status,
            error: error.message
          },
          error.status
        );
      });

    return getOrganizationCount;
  }

  /**
   *
   * @param acceptRejectInvitation
   * @param userId
   * @param email
   * @returns
   */
  async fetchInvitationsStatus(
    acceptRejectInvitation: AcceptRejectInvitationDto,
    keycloakUserId: string,
    email: string,
    userId: string
  ): Promise<IUserInvitations> {
    try {
      const pattern = { cmd: 'update-invitation-status' };

      const { orgId, invitationId, status } = acceptRejectInvitation;

      const payload = { userId, keycloakUserId, orgId, invitationId, status, email };

      const invitationsData = await this.natsClient
        .send<IUserInvitations>(this.userServiceProxy, pattern, payload)
        
        .catch((error) => {
          this.logger.error(`catch: ${JSON.stringify(error)}`);
          throw new HttpException(
            {
              statusCode: error.statusCode,
              error: error.error,
              message: error.message
            },
            error.error
          );
        });

      return invitationsData;
    } catch (error) {
      this.logger.error(`Error In fetchInvitationsStatus: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   *
   * @param orgId
   * @returns users list
   */
  async getOrgUsers(orgId: string, pageNumber: number, pageSize: number, search: string): Promise<IOrgUsers> {
    try {
  
      const query = {
        userOrgRoles: {
          some: { orgId }
        },
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };

      const filterOptions = {
        orgId
      };

      return this.userRepository.findOrgUsers(query, pageNumber, pageSize, filterOptions);
    } catch (error) {
      this.logger.error(`get Org Users: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  /**
   *
   * @param orgId
   * @returns users list
   */
  async get(pageNumber: number, pageSize: number, search: string): Promise<object> {
    try {
      const query = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      };

      return this.userRepository.findUsers(query, pageNumber, pageSize);
    } catch (error) {
      this.logger.error(`get Users: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async checkUserExist(email: string): Promise<ICheckUserDetails> {
    try {
      const userDetails = await this.userRepository.checkUniqueUserExist(email.toLowerCase());
     let userVerificationDetails;
      if (userDetails) {
        userVerificationDetails = {
          isEmailVerified: userDetails.isEmailVerified,
          isFidoVerified: userDetails.isFidoVerified,
          isRegistrationCompleted: null !== userDetails.keycloakUserId && undefined !== userDetails.keycloakUserId,
          message:'',
          userId: userDetails.id
        };

      }
      if (userDetails && !userDetails.isEmailVerified) {
        userVerificationDetails.message = ResponseMessages.user.error.verificationAlreadySent;
        return userVerificationDetails;
      } else if (userDetails && userDetails.keycloakUserId) {
        userVerificationDetails.message = ResponseMessages.user.error.exists;
        return userVerificationDetails;
      } else if (userDetails && !userDetails.keycloakUserId && userDetails.supabaseUserId) {
        userVerificationDetails.message = ResponseMessages.user.error.exists;
        return userVerificationDetails;
      } else if (null === userDetails) {
         return {
          isRegistrationCompleted: false,
           isEmailVerified: false,
           userId:null,
           message: ResponseMessages.user.error.notFound
        };
      } else {
        return userVerificationDetails;
      }
    } catch (error) {
      this.logger.error(`In check User : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getUserActivity(userId: string, limit: number): Promise<IUsersActivity[]> {
    try {
      return this.userActivityService.getUserActivity(userId, limit);
    } catch (error) {
      this.logger.error(`In getUserActivity : ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  // eslint-disable-next-line camelcase
  async updatePlatformSettings(platformSettings: PlatformSettings): Promise<string> {
    try {
      const platformConfigSettings = await this.userRepository.updatePlatformSettings(platformSettings);

      if (!platformConfigSettings) {
        throw new BadRequestException(ResponseMessages.user.error.notUpdatePlatformSettings);
      }

      return ResponseMessages.user.success.platformSettings;
    } catch (error) {
      this.logger.error(`update platform settings: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async getPlatformSettings(): Promise<object> {
    try {
      const platformSettings = {};
      const platformConfigSettings = await this.userRepository.getPlatformSettings();

      if (!platformConfigSettings) {
        throw new BadRequestException(ResponseMessages.user.error.platformSetttingsNotFound);
      }

      platformSettings['platform_config'] = platformConfigSettings;

      return platformSettings;
    } catch (error) {
      this.logger.error(`update platform settings: ${JSON.stringify(error)}`);
      throw new RpcException(error.response ? error.response : error);
    }
  }

  async updateOrgDeletedActivity(orgId: string, userId: string, deletedBy: string, recordType: RecordType, userEmail: string, txnMetadata: object): Promise<IUserDeletedActivity> {
    try {
      return await this.userRepository.updateOrgDeletedActivity(orgId, userId, deletedBy, recordType, userEmail, txnMetadata);
    } catch (error) {
      this.logger.error(`In updateOrgDeletedActivity : ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getUserDetails(userId: string): Promise<string> {
    try {
      const getUserDetails = await this.userRepository.getUserDetailsByUserId(userId);
      const userEmail = getUserDetails.email;
      return userEmail;
    } catch (error) {
      this.logger.error(`In get user details by user Id : ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getUserKeycloakIdByEmail(userEmails: string[]): Promise<UserKeycloakId[]> {
    try {
     
      const getkeycloakUserIds = await this.userRepository.getUserKeycloak(userEmails);
      return getkeycloakUserIds;
    } catch (error) {
      this.logger.error(`In getUserKeycloakIdByEmail : ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getUserByUserIdInKeycloak(email: string): Promise<string> {
    try {
     
      const userData = await this.userRepository.checkUserExist(email.toLowerCase());

      if (!userData) {
        throw new NotFoundException(ResponseMessages.user.error.notFound);
      }

      // Decrypt both clientId and clientSecret before sending to Keycloak
      const decryptedClientId = await this.commonService.decryptPassword(userData?.clientId);
      const decryptedClientSecret = await this.commonService.decryptPassword(userData?.clientSecret);

      const token = await this.clientRegistrationService.getManagementToken(decryptedClientId, decryptedClientSecret);
      const getClientData = await this.clientRegistrationService.getUserInfoByUserId(userData?.keycloakUserId, token);

      return getClientData;
    } catch (error) {
      this.logger.error(`In getUserByUserIdInKeycloak : ${JSON.stringify(error)}`);
      throw error;
    }
  }

   // eslint-disable-next-line camelcase
   async getuserOrganizationByUserId(userId: string): Promise<object[]> {
    try {
        const getOrganizationDetails = await this.userRepository.handleGetUserOrganizations(userId);

        if (!getOrganizationDetails) {
            throw new NotFoundException(ResponseMessages.ledger.error.NotFound);
        }

        return getOrganizationDetails;
    } catch (error) {
        this.logger.error(`Error in getuserOrganizationByUserId: ${error}`);
        throw new RpcException(error.response ? error.response : error);
    }
}  async generateToken(email: string, password: string, userData: any): Promise<ISignInUser> {
    this.logger.log(`🎯 generateToken called for user: ${email}`);
    this.logger.log(`📊 User data: keycloakUserId=${userData.keycloakUserId}, id=${userData.id}`);

    if (userData.keycloakUserId) {
      try {
        // 🔄 SIMPLIFIED LOGIN: Use user management credentials directly
        this.logger.log(`🔍 Using user management credentials for authentication`);
        this.logger.log(`   📧 User: ${email}`);
        this.logger.log(`   🔑 Encrypted Client ID: ${userData.clientId ? `${userData.clientId.substring(0, 8)}...` : '[MISSING]'}`);
        this.logger.log(`   🔐 Encrypted Client Secret: ${userData.clientSecret ? '[PRESENT]' : '[MISSING]'}`);
        
        // Try to decrypt client credentials, but handle plain text gracefully
        let decryptedClientId = userData.clientId;
        let decryptedClientSecret = userData.clientSecret;
        
        // Try to decrypt client ID
        try {
          const testDecryptedClientId = await this.commonService.decryptString(userData.clientId);
          if (testDecryptedClientId && '' !== testDecryptedClientId.trim()) {
            decryptedClientId = testDecryptedClientId;
            this.logger.log(`🔓 Client ID was encrypted and decrypted successfully`);
          } else {
            // If decryption returns empty string, it's likely plain text
            this.logger.log(`🔓 Client ID appears to be plain text, using as is`);
            decryptedClientId = userData.clientId;
          }
        } catch (decryptError) {
          // If decryption fails, assume it's plain text
          this.logger.log(`🔓 Client ID decryption failed, using as plain text`);
          decryptedClientId = userData.clientId;
        }
        
        // Try to decrypt client secret
        try {
          const testDecryptedClientSecret = await this.commonService.decryptString(userData.clientSecret);
          if (testDecryptedClientSecret && '' !== testDecryptedClientSecret.trim()) {
            decryptedClientSecret = testDecryptedClientSecret;
            this.logger.log(`🔓 Client Secret was encrypted and decrypted successfully`);
          } else {
            // If decryption returns empty string, it's likely plain text
            this.logger.log(`🔓 Client Secret appears to be plain text, using as is`);
            decryptedClientSecret = userData.clientSecret;
          }
        } catch (decryptError) {
          // If decryption fails, assume it's plain text
          this.logger.log(`🔓 Client Secret decryption failed, using as plain text`);
          decryptedClientSecret = userData.clientSecret;
        }
        
        this.logger.log(`🔐 Attempting Keycloak authentication`);
        this.logger.log(`   📧 Email: ${email}`);
        this.logger.log(`   🔑 Client ID: ${decryptedClientId}`);
        this.logger.log(`   🔐 Client Secret: ${decryptedClientSecret ? '[PRESENT]' : '[MISSING]'}`);
        this.logger.log(`   🔒 Password: ${password ? '[PRESENT]' : '[MISSING]'}`);
        
        const tokenResponse = await this.clientRegistrationService.getUserToken(email, password, decryptedClientId, decryptedClientSecret);
        this.logger.log(`✅ Keycloak authentication successful`);
        tokenResponse.isRegisteredToSupabase = false;
        return tokenResponse;
      } catch (error) {
        this.logger.error(`🚨 Login authentication failed: ${error.message}`);
        this.logger.error(`   Error details: ${JSON.stringify(error)}`);
        throw new UnauthorizedException(ResponseMessages.user.error.invalidCredentials);
      }
    } else {
      const supaInstance = await this.supabaseService.getClient();  
      const { data, error } = await supaInstance.auth.signInWithPassword({
        email,
        password
      });

      this.logger.error(`Supa Login Error::`, JSON.stringify(error));

      if (error) {
        throw new BadRequestException(error?.message);
      }

      const token = data?.session;

      return {
        // eslint-disable-next-line camelcase
        access_token: token.access_token,
        // eslint-disable-next-line camelcase
        token_type: token.token_type,
        // eslint-disable-next-line camelcase
        expires_in: token.expires_in,
        // eslint-disable-next-line camelcase
        expires_at: token.expires_at,
        isRegisteredToSupabase: true
      };
    }
  }
}