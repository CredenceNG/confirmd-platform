// TODO: Need to address the eslint issues
/* eslint-disable camelcase */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as qs from 'qs';

import { ClientCredentialTokenPayloadDto } from './dtos/client-credential-token-payload.dto';
import { CommonConstants } from '@credebl/common/common.constant';
import { CommonService } from '@credebl/common';
import { CreateUserDto } from './dtos/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { KeycloakUrlService } from '@credebl/keycloak-url';
import { accessTokenPayloadDto } from './dtos/accessTokenPayloadDto';
import { userTokenPayloadDto } from './dtos/userTokenPayloadDto';
import { KeycloakUserRegistrationDto } from 'apps/user/dtos/keycloak-register.dto';
import { ResponseMessages } from '@credebl/common/response-messages';
import { IClientRoles } from './interfaces/client.interface';
import { IFormattedResponse } from '@credebl/common/interfaces/interface';

@Injectable()
export class ClientRegistrationService {
  constructor(
    private readonly commonService: CommonService,
    private readonly keycloakUrlService: KeycloakUrlService
  ) {}

  private readonly logger = new Logger('ClientRegistrationService');

  async registerKeycloakUser(userDetails: KeycloakUserRegistrationDto, realm: string, token: string) {
    try {
      const url = await this.keycloakUrlService.createUserURL(realm);
      await this.commonService.httpPost(url, userDetails, this.getAuthHeader(token));

      const getUserResponse = await this.commonService.httpGet(
        await this.keycloakUrlService.getUserByUsernameURL(realm, userDetails.email),
        this.getAuthHeader(token)
      );
      if (getUserResponse[0].username === userDetails.email || getUserResponse[1].username === userDetails.email) {
        return { keycloakUserId: getUserResponse[0].id };
      } else {
        throw new NotFoundException(ResponseMessages.user.error.invalidKeycloakId);
      }
    } catch (error) {
      this.logger.error(`error in keycloakUserRegistration in client-registration: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async resetPasswordOfUser(user: CreateUserDto, realm: string, token: string): Promise<IFormattedResponse> {
    const getUserResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.getUserByUsernameURL(realm, user.email),
      this.getAuthHeader(token)
    );
    const userid = getUserResponse[0].id;

    const passwordResponse = await this.resetPasswordOfKeycloakUser(realm, user.password, userid, token);

    return passwordResponse;
  }

  async createUser(user: CreateUserDto, realm: string, token: string): Promise<{ keycloakUserId: string }> {
    try {
      this.logger.log(`🔧 === CREATING KEYCLOAK USER ===`);
      this.logger.log(`📧 Email: ${user.email}`);
      this.logger.log(`👤 Name: ${user.firstName} ${user.lastName}`);
      this.logger.log(`🏰 Realm: ${realm}`);
      this.logger.log(`🔑 Token available: ${token ? 'YES' : 'NO'}`);

      const payload = {
        createdTimestamp: Date.parse(Date.now.toString()),
        username: user.email,
        enabled: true,
        totp: false,
        emailVerified: true,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        disableableCredentialTypes: [],
        requiredActions: [],
        notBefore: 0,
        access: {
          manageGroupMembership: true,
          view: true,
          mapRoles: true,
          impersonate: true,
          manage: true
        },
        realmRoles: ['mb-user'],
        attributes: {
          ...(user.isHolder ? { userRole: `${CommonConstants.USER_HOLDER_ROLE}` } : {})
        }
      };

      this.logger.log(`📋 Keycloak user payload prepared`);
      this.logger.log(`🌐 Creating user in Keycloak...`);

      const createUserUrl = await this.keycloakUrlService.createUserURL(realm);
      this.logger.log(`📡 Create user URL: ${createUserUrl}`);

      const createUserResponse = await this.commonService.httpPost(
        createUserUrl,
        payload,
        this.getAuthHeader(token)
      );

      this.logger.log(`✅ User created successfully in Keycloak`);

      const getUserUrl = await this.keycloakUrlService.getUserByUsernameURL(realm, user.email);
      this.logger.log(`📡 Get user URL: ${getUserUrl}`);

      let getUserResponse;
      let searchAttempts = 0;
      const maxAttempts = 3;

      // Try multiple search approaches with retry logic
      while (searchAttempts < maxAttempts) {
        searchAttempts++;
        this.logger.log(`🔍 Search attempt ${searchAttempts}/${maxAttempts}`);

        try {
          // Try searching by username first
          getUserResponse = await this.commonService.httpGet(
            getUserUrl,
            this.getAuthHeader(token)
          );

          this.logger.log(`📊 Username search response: ${Array.isArray(getUserResponse) ? getUserResponse.length : 'Not array'} results`);

          if (Array.isArray(getUserResponse) && getUserResponse.length > 0) {
            this.logger.log(`✅ User found via username search on attempt ${searchAttempts}`);
            break;
          }

          // If username search fails, try email search
          const emailSearchUrl = `${process.env.KEYCLOAK_DOMAIN}admin/realms/${realm}/users?email=${encodeURIComponent(user.email)}`;
          this.logger.log(`📡 Trying email search URL: ${emailSearchUrl}`);

          getUserResponse = await this.commonService.httpGet(
            emailSearchUrl,
            this.getAuthHeader(token)
          );

          this.logger.log(`📊 Email search response: ${Array.isArray(getUserResponse) ? getUserResponse.length : 'Not array'} results`);

          if (Array.isArray(getUserResponse) && getUserResponse.length > 0) {
            this.logger.log(`✅ User found via email search on attempt ${searchAttempts}`);
            break;
          }

          // If both fail, wait a bit and try again (except on last attempt)
          if (searchAttempts < maxAttempts) {
            this.logger.log(`⏳ Waiting 1 second before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (searchError) {
          this.logger.error(`❌ Search error on attempt ${searchAttempts}: ${JSON.stringify(searchError)}`);
          if (searchAttempts === maxAttempts) {
            throw searchError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!Array.isArray(getUserResponse) || getUserResponse.length === 0) {
        this.logger.error(`❌ No user found after creation despite ${maxAttempts} attempts`);
        this.logger.error(`❌ Search parameters used: username=${user.email}, email=${user.email}`);
        throw new Error('User not found after creation in Keycloak');
      }

      const userid = getUserResponse[0].id;
      this.logger.log(`🆔 Retrieved user ID: ${userid}`);

      this.logger.log(`🔐 Setting user password...`);
      await this.resetPasswordOfKeycloakUser(realm, user.password, userid, token);
      this.logger.log(`✅ Password set successfully`);

      this.logger.log(`🎉 Keycloak user creation completed successfully`);
      return {
        keycloakUserId: getUserResponse[0].id
      };

    } catch (error) {
      this.logger.error(`❌ Error in createUser: ${error.message}`);
      this.logger.error(`❌ Error status: ${error.response?.status}`);
      this.logger.error(`❌ Error statusText: ${error.response?.statusText}`);
      this.logger.error(`❌ Error data: ${JSON.stringify(error.response?.data)}`);
      this.logger.error(`❌ Full error: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async resetPasswordOfKeycloakUser(realm: string, resetPasswordValue: string, userid: string, token: string) {
    const passwordPayload = {
      type: 'password',
      value: resetPasswordValue,
      temporary: false
    };
    const setPasswordResponse = await this.commonService.httpPut(
      //await this.keycloakUrlService.ResetPasswordURL(`${process.env.KEYCLOAK_CREDEBL_REALM}`, userid),
      await this.keycloakUrlService.ResetPasswordURL(realm, userid),
      passwordPayload,
      this.getAuthHeader(token)
    );
    return setPasswordResponse;
  }

  getAuthHeader(token: string) {
    return { headers: { authorization: `Bearer ${token}` } };
  }

  async getUserInfo(token: string) {
    try {
      const jwtService = new JwtService({});
      const decoded = jwtService.decode(token, { complete: true });
      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }

      const payload = decoded['payload'];

      const userInfoResponse = await this.commonService.httpGet(
        `${process.env.KEYCLOAK_DOMAIN}admin/realms/${process.env.KEYCLOAK_REALM}/users/${payload['sub']}`,
        this.getAuthHeader(token)
      );
      return userInfoResponse.data;
    } catch (error) {
      this.logger.error(`[getUserInfo]: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getManagementToken(clientId: string, clientSecret: string) {
    try {
      this.logger.log(`🔐 === GETTING MANAGEMENT TOKEN FROM DEDICATED CLIENT ===`);
      this.logger.log(`Client ID provided: ${clientId ? 'Yes' : 'No'}`);
      this.logger.log(`Client Secret provided: ${clientSecret ? 'Yes' : 'No'}`);

      const payload = new ClientCredentialTokenPayloadDto();
      if (!clientId && !clientSecret) {
        this.logger.error(`❌ getManagementToken ::: Client ID and client secret are missing`);
        throw new BadRequestException(`Client ID and client secret are missing`);
      }

      this.logger.log(`🔓 Processing client credentials...`);
      // clientId and clientSecret are already decrypted when passed from user service
      // No need to decrypt again as they come as plain text
      this.logger.log(`🔍 Client ID received: ${clientId ? `${clientId.substring(0, 8)}...` : 'MISSING'}`);
      this.logger.log(`🔍 Client Secret received: ${clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING'}`);
      this.logger.log(`✅ Client credentials processed successfully`);

      payload.client_id = clientId; // Already plain text
      payload.client_secret = clientSecret; // Already decrypted in user service

      this.logger.log(`🌐 Requesting management token from Keycloak...`);
      this.logger.log(`Using realm: ${process.env.KEYCLOAK_REALM}`);
      this.logger.log(`Token endpoint will be constructed for realm: ${process.env.KEYCLOAK_REALM}`);

      const mgmtTokenResponse = await this.getToken(payload);
      
      this.logger.log(`✅ Management token obtained successfully from dedicated management client`);
      this.logger.log(`Token type: ${mgmtTokenResponse.token_type || 'Bearer'}`);
      this.logger.log(`Token expires in: ${mgmtTokenResponse.expires_in || 'Unknown'} seconds`);

      return mgmtTokenResponse.access_token;
    } catch (error) {
      this.logger.error(`❌ Error in getManagementToken: ${JSON.stringify(error)}`);

      throw error;
    }
  }

  async getManagementTokenFromEnv() {
    try {
      this.logger.log(`🔐 === GETTING MANAGEMENT TOKEN FROM ENVIRONMENT VARIABLES ===`);
      
      const managementClientId = process.env.KEYCLOAK_MANAGEMENT_CLIENT_ID;
      const managementClientSecret = process.env.KEYCLOAK_MANAGEMENT_CLIENT_SECRET;
      
      if (!managementClientId || !managementClientSecret) {
        this.logger.error(`❌ Management client credentials missing from environment variables`);
        throw new BadRequestException(`Management client credentials missing from environment variables`);
      }

      this.logger.log(`✅ Management client credentials found in environment variables`);
      this.logger.log(`Management Client ID: ${managementClientId}`);

      const payload = new ClientCredentialTokenPayloadDto();
      payload.client_id = managementClientId;
      payload.client_secret = managementClientSecret;
      payload.scope = 'openid';

      this.logger.log(`🌐 Requesting management token from Keycloak realm...`);
      
      // Use the application realm instead of master realm for management client
      const keycloakRealm = process.env.KEYCLOAK_REALM;
      const tokenEndpoint = `${process.env.KEYCLOAK_DOMAIN}realms/${keycloakRealm}/protocol/openid-connect/token`;
      
      this.logger.log(`Token endpoint: ${tokenEndpoint}`);
      
      const tokenResponse = await this.commonService.httpPost(
        tokenEndpoint,
        qs.stringify(payload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.logger.log(`✅ Management token obtained successfully from realm ${keycloakRealm}`);
      this.logger.log(`Token type: ${tokenResponse.token_type || 'Bearer'}`);
      this.logger.log(`Token expires in: ${tokenResponse.expires_in || 'Unknown'} seconds`);

      return tokenResponse.access_token;
    } catch (error) {
      this.logger.error(`❌ Error in getManagementTokenFromEnv: ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getManagementTokenWithAdminCredentials() {
    try {
      this.logger.log(`🔐 === GETTING MANAGEMENT TOKEN USING KEYCLOAK MANAGEMENT CLIENT (V2 UPDATED) ===`);
      
      // Use the management client credentials instead of user credentials
      const managementClientId = process.env.KEYCLOAK_MANAGEMENT_CLIENT_ID;
      const managementClientSecret = process.env.KEYCLOAK_MANAGEMENT_CLIENT_SECRET;
      const keycloakRealm = process.env.KEYCLOAK_REALM;
      
      if (!managementClientId || !managementClientSecret || !keycloakRealm) {
        this.logger.error(`❌ Keycloak management client credentials missing from environment variables`);
        throw new BadRequestException(`Keycloak management client credentials missing from environment variables`);
      }

      this.logger.log(`✅ Keycloak management client credentials found in environment variables`);
      this.logger.log(`Management Client ID: ${managementClientId}`);
      this.logger.log(`Management Client Secret length: ${managementClientSecret.length}`);
      this.logger.log(`Keycloak Realm: ${keycloakRealm}`);

      // Use client credentials grant flow with the management client
      const payload = {
        grant_type: 'client_credentials',
        client_id: managementClientId,
        client_secret: managementClientSecret
      };

      this.logger.log(`🌐 Requesting admin token from Keycloak realm using client credentials grant...`);
      
      // Use the actual realm, not master realm
      const tokenEndpoint = `${process.env.KEYCLOAK_DOMAIN}realms/${keycloakRealm}/protocol/openid-connect/token`;
      
      this.logger.log(`Token endpoint: ${tokenEndpoint}`);
      this.logger.log(`Payload client_id: ${payload.client_id}`);
      this.logger.log(`Payload grant_type: ${payload.grant_type}`);
      
      const tokenResponse = await this.commonService.httpPost(
        tokenEndpoint,
        qs.stringify(payload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.logger.log(`✅ Management token obtained successfully from realm ${keycloakRealm}`);
      this.logger.log(`Token type: ${tokenResponse.token_type || 'Bearer'}`);
      this.logger.log(`Token expires in: ${tokenResponse.expires_in || 'Unknown'} seconds`);

      return tokenResponse.access_token;
    } catch (error) {
      this.logger.error(`❌ Error in getManagementTokenWithAdminCredentials: ${JSON.stringify(error)}`);
      
      // Check if this is a Keycloak authentication error vs other error
      if (401 === error?.status || 401 === error?.response?.status) {
        this.logger.error(`🚫 Keycloak authentication failed - invalid client credentials`);
        this.logger.error(`Error details: ${JSON.stringify(error.response || error)}`);
        throw new BadRequestException('Keycloak management client authentication failed - invalid client credentials');
      } else {
        // This is likely a connection or other error
        this.logger.error(`🔧 Non-authentication error occurred: ${error.message}`);
        throw new BadRequestException('Failed to authenticate with Keycloak admin credentials');
      }
    }
  }

  async getClientIdAndSecret(
    clientId: string,
    token: string
  ): Promise<{ clientId: string; clientSecret: string }> | undefined {
    // Client id cannot be undefined
    if (!clientId) {
      return;
    }
    try {
      const realmName = process.env.KEYCLOAK_REALM;
      const getClientResponse = await this.commonService.httpGet(
        await this.keycloakUrlService.GetClientURL(realmName, clientId),
        this.getAuthHeader(token)
      );
      const { id } = getClientResponse[0];
      const client_id = getClientResponse[0].clientId;

      const response = await this.commonService.httpGet(
        `${process.env.KEYCLOAK_DOMAIN}${CommonConstants.URL_KEYCLOAK_CLIENT_SECRET.replace('{id}', id)}`,
        this.getAuthHeader(token)
      );

      return {
        clientId: client_id,
        clientSecret: response.value
      };
    } catch (error) {
      if (404 === error?.response?.statusCode) {
      } else {
        this.logger.error(`Caught exception while retrieving clientSecret from Auth0: ${JSON.stringify(error)}`);
        throw new Error('Unable to retrieve clientSecret from server');
      }
    }
  }

  async deleteClient(idpId: string, token: string) {
    const realmName = process.env.KEYCLOAK_REALM;

    const getClientDeleteResponse = await this.commonService.httpDelete(
      await this.keycloakUrlService.GetClientIdpURL(realmName, idpId),
      this.getAuthHeader(token)
    );

    this.logger.log(`Delete realm client ${JSON.stringify(getClientDeleteResponse)}`);

    return getClientDeleteResponse;
  }

  async createUserClientRole(idpId: string, token: string, userId: string, payload: object[]): Promise<string> {
    const realmName = process.env.KEYCLOAK_REALM;

    const createClientRolesResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetClientUserRoleURL(realmName, userId, idpId),
      payload,
      this.getAuthHeader(token)
    );

    this.logger.debug(`createUserClientRolesResponse ${JSON.stringify(createClientRolesResponse)}`);

    return 'User client role is assigned';
  }

  async deleteUserClientRoles(idpId: string, token: string, userId: string): Promise<boolean> {
    const realmName = process.env.KEYCLOAK_REALM;

    const createClientRolesResponse = await this.commonService
      .httpDelete(
        await this.keycloakUrlService.GetClientUserRoleURL(realmName, userId, idpId),
        this.getAuthHeader(token)
      )
      .then((data) => data?.data)
      .catch((error) => error);

    this.logger.debug(`deleteUserClientRoles ${JSON.stringify(createClientRolesResponse)}`);

    return true;
  }

  async createUserHolderRole(token: string, userId: string, payload: object[]): Promise<string> {
    const realmName = process.env.KEYCLOAK_REALM;

    const createClientRolesResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetClientUserRoleURL(realmName, userId),
      payload,
      this.getAuthHeader(token)
    );

    this.logger.debug(`createUserHolderRole ${JSON.stringify(createClientRolesResponse)}`);

    return 'User holder role is assigned';
  }

  async getAllClientRoles(idpId: string, token: string): Promise<IClientRoles[]> {
    const realmName = process.env.KEYCLOAK_REALM;

    const clientRolesResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientRoleURL(realmName, idpId),
      this.getAuthHeader(token)
    );

    this.logger.debug(`getAllClientRoles ${JSON.stringify(clientRolesResponse)}`);

    return clientRolesResponse;
  }

  async getClientSpecificRoles(idpId: string, token: string, roleName: string): Promise<IClientRoles> {
    const realmName = process.env.KEYCLOAK_REALM;

    const clientRolesResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientRoleURL(realmName, idpId, roleName),
      this.getAuthHeader(token)
    );

    this.logger.debug(`getClientSpecificRoles ${JSON.stringify(clientRolesResponse)}`);

    return clientRolesResponse;
  }

  async getAllRealmRoles(token: string): Promise<IClientRoles[]> {
    const realmName = process.env.KEYCLOAK_REALM;

    const realmRolesResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetRealmRoleURL(realmName),
      this.getAuthHeader(token)
    );

    this.logger.debug(`getAllRealmRoles ${JSON.stringify(realmRolesResponse)}`);

    return realmRolesResponse;
  }

  async createClientRole(idpId: string, token: string, name: string, description: string): Promise<string> {
    const payload = {
      clientRole: true,
      name,
      description
    };

    const realmName = process.env.KEYCLOAK_REALM;

    const createClientRolesResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetClientRoleURL(realmName, idpId),
      payload,
      this.getAuthHeader(token)
    );

    this.logger.debug(`createClientRolesResponse ${JSON.stringify(createClientRolesResponse)}`);

    return 'Client role is created';
  }

  async generateClientSecret(idpId: string, token: string): Promise<string> {
    const realmName = process.env.KEYCLOAK_REALM;

    const createClientSercretResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetClientSecretURL(realmName, idpId),
      {},
      this.getAuthHeader(token)
    );

    this.logger.debug(
      `ClientRegistrationService create realm client secret ${JSON.stringify(createClientSercretResponse)}`
    );

    const getClientSercretResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientSecretURL(realmName, idpId),
      this.getAuthHeader(token)
    );
    this.logger.debug(`ClientRegistrationService get client secret ${JSON.stringify(getClientSercretResponse)}`);
    this.logger.log(`${getClientSercretResponse.value}`);
    const clientSecret = getClientSercretResponse.value;

    return clientSecret;
  }

  async createClient(orgName: string, orgId: string, token: string) {
    this.logger.log(`🏢 === CREATING KEYCLOAK CLIENT FOR ORGANIZATION ===`);
    this.logger.log(`Organization: ${orgName} (ID: ${orgId})`);
    this.logger.log(`Target realm: ${process.env.KEYCLOAK_REALM}`);
    this.logger.log(`📋 This is NOT the master realm - creating client in application realm`);

    //create client for respective created realm in order to access its resources
    const realmName = process.env.KEYCLOAK_REALM;
    const clientPayload = {
      clientId: `${orgId}`,
      name: `${orgName}`,
      adminUrl: process.env.KEYCLOAK_ADMIN_URL,
      alwaysDisplayInConsole: false,
      access: {
        view: true,
        configure: true,
        manage: true
      },
      attributes: {
        orgId: `${orgId}`
      },
      authenticationFlowBindingOverrides: {},
      authorizationServicesEnabled: false,
      bearerOnly: false,
      directAccessGrantsEnabled: true,
      enabled: true,
      protocol: 'openid-connect',
      description: 'rest-api',

      rootUrl: '${authBaseUrl}',
      baseUrl: `/realms/${realmName}/account/`,
      surrogateAuthRequired: false,
      clientAuthenticatorType: 'client-secret',
      defaultRoles: ['manage-account', 'view-profile'],
      redirectUris: [`/realms/${realmName}/account/*`],
      webOrigins: [],
      notBefore: 0,
      consentRequired: false,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      serviceAccountsEnabled: true,
      publicClient: false,
      frontchannelLogout: false,
      fullScopeAllowed: false,
      nodeReRegistrationTimeout: 0
    };

    this.logger.log(`🔧 Creating Keycloak client with payload...`);
    const createClientResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.createClientURL(realmName),
      clientPayload,
      this.getAuthHeader(token)
    );
    this.logger.log(`✅ Keycloak client created successfully`);
    this.logger.debug(`ClientRegistrationService create realm client ${JSON.stringify(createClientResponse)}`);

    this.logger.log(`🔍 Retrieving client details...`);
    const getClientResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientURL(realmName, `${orgId}`),
      this.getAuthHeader(token)
    );
    this.logger.debug(`ClientRegistrationService get realm admin client ${JSON.stringify(createClientResponse)}`);
    const { id } = getClientResponse[0];
    const client_id = getClientResponse[0].clientId;

    this.logger.log(`🔑 Retrieving client secret...`);
    const getClientSercretResponse = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientSecretURL(realmName, id),
      this.getAuthHeader(token)
    );
    this.logger.debug(
      `ClientRegistrationService get realm admin client secret ${JSON.stringify(getClientSercretResponse)}`
    );
    this.logger.log(`Client secret retrieved successfully`);
    const client_secret = getClientSercretResponse.value;

    this.logger.log(`✅ Client creation completed successfully`);
    this.logger.log(`Client ID: ${client_id}, IDP ID: ${id}`);

    return {
      idpId: id,
      clientId: client_id,
      clientSecret: client_secret
    };
  }

  async registerApplication(name: string, organizationId: number, token: string) {
    const payload = {
      is_token_endpoint_ip_header_trusted: false,
      name,
      is_first_party: true,
      oidc_conformant: true,
      sso_disabled: false,
      cross_origin_auth: false,
      refresh_token: {
        rotation_type: 'non-rotating',
        expiration_type: 'non-expiring'
      },
      jwt_configuration: {
        alg: 'RS256',
        lifetime_in_seconds: 36000,
        secret_encoded: false
      },
      app_type: 'non_interactive',
      grant_types: ['client_credentials'],
      custom_login_page_on: true,
      client_metadata: {
        organizationId: organizationId.toString()
      }
    };
    const registerAppResponse = await this.commonService.httpPost(
      `${process.env.KEYCLOAK_DOMAIN}${CommonConstants.URL_KEYCLOAK_MANAGEMENT_APPLICATIONS}`,
      payload,
      this.getAuthHeader(token)
    );
    this.logger.debug(`ClientRegistrationService register app ${JSON.stringify(registerAppResponse)}`);

    return {
      clientId: registerAppResponse.data.client_id,
      clientSecret: registerAppResponse.data.client_secret
    };
  }

  async authorizeApi(clientId: string, scope: string[], token: string) {
    const existingGrantsResponse = await this.commonService.httpGet(
      `${process.env.KEYCLOAK_DOMAIN}${CommonConstants.URL_KEYCLOAK_MANAGEMENT_GRANTS}`,
      this.getAuthHeader(token)
    );

    // If an grant matching the client id is already found, don't recreate it.
    let grantResponse = { data: undefined };
    grantResponse.data = existingGrantsResponse.data.find((grant) => grant.client_id === clientId);
    this.logger.debug(`ClientRegistrationService existing grant ${JSON.stringify(grantResponse)}`);

    // Grant wasn't found, so we need to create it
    if (!grantResponse.data) {
      const payload = {
        client_id: clientId,
        audience: process.env.AUTH0_AUDIENCE,
        scope
      };
      grantResponse = await this.commonService.httpPost(
        `${process.env.KEYCLOAK_DOMAIN}${CommonConstants.URL_KEYCLOAK_MANAGEMENT_GRANTS}`,
        payload,
        this.getAuthHeader(token)
      );
      this.logger.debug(`ClientRegistrationService authorize api ${JSON.stringify(grantResponse)}`);
    }
    return grantResponse.data.id;
  }

  async getToken(payload: ClientCredentialTokenPayloadDto) {
    this.logger.log(`🎫 === REQUESTING TOKEN FROM KEYCLOAK ===`);
    this.logger.log(`Grant type: ${payload.grant_type}`);
    this.logger.log(`Client ID: ${payload.client_id ? 'Present' : 'Missing'}`);
    this.logger.log(`Client Secret: ${payload.client_secret ? 'Present' : 'Missing'}`);

    if ('client_credentials' !== payload.grant_type || !payload.client_id || !payload.client_secret) {
      this.logger.error(`❌ Invalid inputs while getting token`);
      throw new Error('Invalid inputs while getting token.');
    }

    const strURL = await this.keycloakUrlService.GetSATURL(process.env.KEYCLOAK_REALM);
    this.logger.log(`🌐 Token endpoint URL: ${strURL}`);
    this.logger.log(`🔍 Target realm: ${process.env.KEYCLOAK_REALM}`);
    this.logger.log(`📋 This is NOT the master realm - using application realm for management token`);

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    this.logger.log(`📡 Making token request to Keycloak...`);
    const tokenResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetSATURL(process.env.KEYCLOAK_REALM),
      qs.stringify(payload),
      config
    );

    this.logger.log(`✅ Token response received successfully`);
    this.logger.log(`Token type: ${tokenResponse.token_type || 'Bearer'}`);
    this.logger.log(`Access token: ${tokenResponse.access_token ? 'Present' : 'Missing'}`);
    this.logger.log(`Expires in: ${tokenResponse.expires_in || 'Unknown'} seconds`);

    return tokenResponse;
  }

  async CreateConnection(clientId: string, token: string) {
    const payload = {
      name: 'TestConnection1',
      display_name: 'Connectiondisplay',
      strategy: 'auth0',
      options: {
        enabledDatabaseCustomization: true,
        import_mode: false,
        customScripts: {
          login:
            "function login(email, password, callback) {\n  //this example uses the \"pg\" library\n  //more info here: https://github.com/brianc/node-postgres\n\n  const bcrypt = require('bcrypt');\n  const postgres = require('pg');\n\n  const conString = `postgres://${configuration.pg_user}:${configuration.pg_pass}@${configuration.pg_ip}/${configuration.pg_db}`;\n  postgres.connect(conString, function (err, client, done) {\n    if (err) return callback(err);\n\t\t\t\n    const query = 'SELECT id, email, password FROM public.user WHERE email = $1 or username = $1';\n    client.query(query, [email], function (err, result) {\n      // NOTE: always call done() here to close\n      // the connection to the database\n      done();\n\n      if (err || result.rows.length === 0) return callback(err || new WrongUsernameOrPasswordError(email));\n\n      const user = result.rows[0];\n\n      //if(password === user.password) {\n        this.logger.log(email);\n        if (password === user.password) return callback(err || new WrongUsernameOrPasswordError(email));\n\n        return callback(null, {\n          user_id: user.id,\n          email: user.email\n        });\n      });\n      \n    });\n  //});\n}",
          create:
            'function create(user, callback) {\n  // This script should create a user entry in your existing database. It will\n  // be executed when a user attempts to sign up, or when a user is created\n  // through the Auth0 dashboard or API.\n  // When this script has finished executing, the Login script will be\n  // executed immediately afterwards, to verify that the user was created\n  // successfully.\n  //\n  // The user object will always contain the following properties:\n  // * email: the user\'s email\n  // * password: the password entered by the user, in plain text\n  // * tenant: the name of this Auth0 account\n  // * client_id: the client ID of the application where the user signed up, or\n  //              API key if created through the API or Auth0 dashboard\n  // * connection: the name of this database connection\n  //\n  // There are three ways this script can finish:\n  // 1. A user was successfully created\n  //     callback(null);\n  // 2. This user already exists in your database\n  //     callback(new ValidationError("user_exists", "my error message"));\n  // 3. Something went wrong while trying to reach your database\n  //     callback(new Error("my error message"));\n\n  const msg = \'Please implement the Create script for this database connection \' +\n    \'at https://manage.auth0.com/#/connections/database\';\n  return callback(new Error(msg));\n}\n',
          delete:
            "function remove(id, callback) {\n  // This script remove a user from your existing database.\n  // It is executed whenever a user is deleted from the API or Auth0 dashboard.\n  //\n  // There are two ways that this script can finish:\n  // 1. The user was removed successfully:\n  //     callback(null);\n  // 2. Something went wrong while trying to reach your database:\n  //     callback(new Error(\"my error message\"));\n\n  const msg = 'Please implement the Delete script for this database ' +\n    'connection at https://manage.auth0.com/#/connections/database';\n  return callback(new Error(msg));\n}\n",
          verify:
            "function verify(email, callback) {\n  // This script should mark the current user's email address as verified in\n  // your database.\n  // It is executed whenever a user clicks the verification link sent by email.\n  // These emails can be customized at https://manage.auth0.com/#/emails.\n  // It is safe to assume that the user's email already exists in your database,\n  // because verification emails, if enabled, are sent immediately after a\n  // successful signup.\n  //\n  // There are two ways that this script can finish:\n  // 1. The user's email was verified successfully\n  //     callback(null, true);\n  // 2. Something went wrong while trying to reach your database:\n  //     callback(new Error(\"my error message\"));\n  //\n  // If an error is returned, it will be passed to the query string of the page\n  // where the user is being redirected to after clicking the verification link.\n  // For example, returning `callback(new Error(\"error\"))` and redirecting to\n  // https://example.com would redirect to the following URL:\n  //     https://example.com?email=alice%40example.com&message=error&success=false\n\n  const msg = 'Please implement the Verify script for this database connection ' +\n    'at https://manage.auth0.com/#/connections/database';\n  return callback(new Error(msg));\n}\n",
          get_user:
            "function getByEmail(email, callback) {\n  // This script should retrieve a user profile from your existing database,\n  // without authenticating the user.\n  // It is used to check if a user exists before executing flows that do not\n  // require authentication (signup and password reset).\n  //\n  // There are three ways this script can finish:\n  // 1. A user was successfully found. The profile should be in the following\n  // format: https://auth0.com/docs/users/normalized/auth0/normalized-user-profile-schema.\n  //     callback(null, profile);\n  // 2. A user was not found\n  //     callback(null);\n  // 3. Something went wrong while trying to reach your database:\n  //     callback(new Error(\"my error message\"));\n\n  const msg = 'Please implement the Get User script for this database connection ' +\n    'at https://manage.auth0.com/#/connections/database';\n  return callback(new Error(msg));\n}\n",
          change_password:
            "function changePassword(email, newPassword, callback) {\n  // This script should change the password stored for the current user in your\n  // database. It is executed when the user clicks on the confirmation link\n  // after a reset password request.\n  // The content and behavior of password confirmation emails can be customized\n  // here: https://manage.auth0.com/#/emails\n  // The `newPassword` parameter of this function is in plain text. It must be\n  // hashed/salted to match whatever is stored in your database.\n  //\n  // There are three ways that this script can finish:\n  // 1. The user's password was updated successfully:\n  //     callback(null, true);\n  // 2. The user's password was not updated:\n  //     callback(null, false);\n  // 3. Something went wrong while trying to reach your database:\n  //     callback(new Error(\"my error message\"));\n  //\n  // If an error is returned, it will be passed to the query string of the page\n  // where the user is being redirected to after clicking the confirmation link.\n  // For example, returning `callback(new Error(\"error\"))` and redirecting to\n  // https://example.com would redirect to the following URL:\n  //     https://example.com?email=alice%40example.com&message=error&success=false\n\n  const msg = 'Please implement the Change Password script for this database ' +\n    'connection at https://manage.auth0.com/#/connections/database';\n  return callback(new Error(msg));\n}\n"
        },
        passwordPolicy: 'good',
        password_complexity_options: {
          min_length: 8
        },
        password_history: {
          size: 5,
          enable: false
        },
        password_no_personal_info: {
          enable: false
        },
        password_dictionary: {
          enable: false,
          dictionary: []
        },

        gateway_authentication: 'object'
      },
      enabled_clients: [clientId],
      realms: [''],
      metadata: {}
    };

    const clientConnResponse = await this.commonService.httpPost(
      `${process.env.KEYCLOAK_DOMAIN}${CommonConstants.URL_KEYCLOAK_MANAGEMENT_CONNECTIONS}`,
      payload,
      this.getAuthHeader(token)
    );
    this.logger.debug(`ClientRegistrationService create connection app ${JSON.stringify(clientConnResponse)}`);

    return {
      name: clientConnResponse.data.name,
      id: clientConnResponse.data.id
    };
  }

  async getUserToken(email: string, password: string, clientId: string, clientSecret: string) {
    const payload = new userTokenPayloadDto();
    
    this.logger.log(`🔑 getUserToken called for email: ${email}`);
    this.logger.log(`📋 Client ID: ${clientId ? `${clientId.substring(0, 8)}...` : 'MISSING'}`);
    this.logger.log(`🔐 Client Secret: ${clientSecret ? `${clientSecret.substring(0, 8)}...` : 'MISSING'}`);
    this.logger.log(`👤 Username: ${email}`);
    this.logger.log(`🔑 Has password: ${password ? 'YES' : 'NO'}`);
    
    if (!clientId && !clientSecret) {
      this.logger.error(`❌ getUserToken ::: Client ID and client secret are missing`);
      throw new BadRequestException(`Client ID and client secret are missing`);
    }

    // Try to decrypt client credentials, but handle plain text gracefully
    let decryptedClientId = clientId;
    let decryptedClientSecret = clientSecret;
    
    // Try to decrypt client ID
    try {
      const testDecryptedClientId = await this.commonService.decryptString(clientId);
      if (testDecryptedClientId && '' !== testDecryptedClientId.trim()) {
        decryptedClientId = testDecryptedClientId;
        this.logger.log(`🔓 Client ID was encrypted and decrypted successfully`);
      } else {
        // If decryption returns empty string, it's likely plain text
        this.logger.log(`🔓 Client ID appears to be plain text, using as is`);
        decryptedClientId = clientId;
      }
    } catch (error) {
      // If decryption fails, assume it's plain text
      this.logger.log(`🔓 Client ID decryption failed, using as plain text`);
      decryptedClientId = clientId;
    }
    
    // Try to decrypt client secret
    try {
      const testDecryptedClientSecret = await this.commonService.decryptString(clientSecret);
      if (testDecryptedClientSecret && '' !== testDecryptedClientSecret.trim()) {
        decryptedClientSecret = testDecryptedClientSecret;
        this.logger.log(`🔓 Client Secret was encrypted and decrypted successfully`);
      } else {
        // If decryption returns empty string, it's likely plain text
        this.logger.log(`🔓 Client Secret appears to be plain text, using as is`);
        decryptedClientSecret = clientSecret;
      }
    } catch (error) {
      // If decryption fails, assume it's plain text
      this.logger.log(`🔓 Client Secret decryption failed, using as plain text`);
      decryptedClientSecret = clientSecret;
    }

    // Try to decrypt password, but handle plain text gracefully
    let decryptedPassword = password;
    try {
      const testDecryptedPassword = await this.commonService.decryptPassword(password);
      if (testDecryptedPassword && '' !== testDecryptedPassword.trim()) {
        decryptedPassword = testDecryptedPassword;
        this.logger.log(`🔓 Password was encrypted and decrypted successfully`);
      } else {
        // If decryption returns empty string, it's likely plain text
        this.logger.log(`🔓 Password appears to be plain text, using as is`);
        decryptedPassword = password;
      }
    } catch (error) {
      // If decryption fails, assume it's plain text
      this.logger.log(`🔓 Password decryption failed, using as plain text`);
      decryptedPassword = password;
    }

    payload.client_id = decryptedClientId;
    payload.client_secret = decryptedClientSecret;
    payload.username = email;
    payload.password = decryptedPassword;

    this.logger.log(`📦 Payload prepared:`, {
      grant_type: payload.grant_type,
      client_id: payload.client_id ? `${payload.client_id.substring(0, 8)}...` : 'MISSING',
      client_secret: payload.client_secret ? `${payload.client_secret.substring(0, 8)}...` : 'MISSING',
      username: payload.username,
      password: payload.password ? '[REDACTED]' : 'MISSING'
    });

    this.logger.log(`🔍 Decrypted Client ID: ${decryptedClientId}`);
    this.logger.log(`🔍 Decrypted Client Secret: ${decryptedClientSecret ? `${decryptedClientSecret.substring(0, 8)}...` : 'MISSING'}`);

    if (
      'password' !== payload.grant_type ||
      !payload.client_id ||
      !payload.client_secret ||
      !payload.username ||
      !payload.password
    ) {
      this.logger.error(`❌ Invalid inputs while getting token:`, {
        grant_type_valid: 'password' === payload.grant_type,
        has_client_id: Boolean(payload.client_id),
        has_client_secret: Boolean(payload.client_secret),
        has_username: Boolean(payload.username),
        has_password: Boolean(payload.password)
      });
      throw new Error('Invalid inputs while getting token.');
    }

    const strURL = await this.keycloakUrlService.GetSATURL(process.env.KEYCLOAK_REALM);
    this.logger.log(`🌐 getToken URL: ${strURL}`);
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    try {
      this.logger.log(`🚀 Making request to Keycloak for token...`);
      const tokenResponse = await this.commonService.httpPost(
        await this.keycloakUrlService.GetSATURL(process.env.KEYCLOAK_REALM),
        qs.stringify(payload),
        config
      );
      
      this.logger.log(`✅ Token received successfully from Keycloak`);
      return tokenResponse;
    } catch (error) {
      this.logger.error(`❌ Token request failed:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }

  async getAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
    try {
      const payload = new accessTokenPayloadDto();
      if (!clientId && !clientSecret) {
        this.logger.error(`getAccessToken ::: Client ID and client secret are missing`);
        throw new BadRequestException(`Client ID and client secret are missing`);
      }

      // clientId is stored as plain text, only clientSecret is encrypted
      const decryptClientSecret = await this.commonService.decryptPassword(clientSecret);

      payload.client_id = clientId; // Use plain text clientId
      payload.client_secret = decryptClientSecret; // Use decrypted clientSecret

      payload.grant_type = 'refresh_token';
      payload.refresh_token = refreshToken;

      if (
        'refresh_token' !== payload.grant_type ||
        !payload.client_id ||
        !payload.client_secret ||
        !payload.refresh_token
      ) {
        throw new Error('Invalid inputs while getting token.');
      }

      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      const tokenResponse = await this.commonService.httpPost(
        await this.keycloakUrlService.GetSATURL(process.env.KEYCLOAK_REALM),
        qs.stringify(payload),
        config
      );

      return tokenResponse;
    } catch (error) {
      this.logger.error(`Error in getAccessToken ${JSON.stringify(error)}`);
      throw error;
    }
  }

  async getAccessTokenHolder(refreshToken: string) {
    const payload = new accessTokenPayloadDto();
    payload.grant_type = 'refresh_token';
    payload.client_id = process.env.KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_ID;
    payload.refresh_token = refreshToken;
    payload.client_secret = process.env.KEYCLOAK_MANAGEMENT_ADEYA_CLIENT_SECRET;

    this.logger.log(`access Token for holderPayload: ${JSON.stringify(payload)}`);

    if (
      'refresh_token' !== payload.grant_type ||
      !payload.client_id ||
      !payload.client_secret ||
      !payload.refresh_token
    ) {
      throw new Error('Bad Request');
    }

    const strURL = await this.keycloakUrlService.GetSATURL('credebl-platform');
    this.logger.log(`getToken URL: ${strURL}`);
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const tokenResponse = await this.commonService.httpPost(
      await this.keycloakUrlService.GetSATURL('credebl-platform'),
      qs.stringify(payload),
      config
    );

    this.logger.debug(`ClientRegistrationService token ${JSON.stringify(tokenResponse)}`);
    return tokenResponse;
  }

  async getClientRedirectUrl(clientId: string, token: string) {
    const realmName = process.env.KEYCLOAK_REALM;

    // Check if clientId needs decryption or is already plaintext
    let decryptClientId;
    try {
      // Try to decrypt first (in case it's encrypted)
      decryptClientId = await this.commonService.decryptPassword(clientId);
      this.logger.debug(`🔓 Successfully decrypted clientId for Keycloak API call`);
    } catch (error) {
      // If decryption fails, assume it's already plaintext
      decryptClientId = clientId;
      this.logger.debug(`📝 Using plaintext clientId for Keycloak API call: ${clientId}`);
    }

    const redirectUrls = await this.commonService.httpGet(
      await this.keycloakUrlService.GetClientURL(realmName, decryptClientId),
      this.getAuthHeader(token)
    );

    this.logger.debug(`redirectUrls ${JSON.stringify(redirectUrls)}`);

    return redirectUrls;
  }

  async getUserInfoByUserId(userId: string, token: string) {
    const realmName = process.env.KEYCLOAK_REALM;

    const userInfo = await this.commonService.httpGet(
      await this.keycloakUrlService.GetUserInfoURL(realmName, userId),
      this.getAuthHeader(token)
    );

    this.logger.debug(`userInfo ${JSON.stringify(userInfo)}`);

    return userInfo;
  }
}
