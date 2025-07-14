# Platform Configuration Initialization Documentation

## Overview

This document describes the required initialization processes for the CREDEBL SSI Platform, specifically focusing on the platform configuration (`platform_config` table) that must be properly set up before the platform can function correctly.

## Problem Context

The platform settings update functionality depends on the existence of a `platform_config` record in the database. When this record is missing, the `updatePlatformSettings` method fails with the error:

```
Cannot read properties of null (reading 'id')
```

This occurs because the code attempts to access `getPlatformDetails.id` when `getPlatformDetails` is `null`.

## Required Initialization Process

### 1. Database Seeding

The platform configuration is initialized through the database seeding process located in `libs/prisma-service/prisma/seed.ts`.

#### Key Function: `createPlatformConfig()`

```typescript
const createPlatformConfig = async (): Promise<void> => {
  try {
    const existPlatformAdmin = await prisma.platform_config.findMany();

    if (0 === existPlatformAdmin.length) {
      const { platformConfigData } = JSON.parse(configData);
      const platformConfig = await prisma.platform_config.create({
        data: platformConfigData
      });

      logger.log(platformConfig);
    } else {
      logger.log('Already seeding in platform config');
    }
  } catch (error) {
    logger.error('An error occurred seeding platformConfig:', error);
    throw error;
  }
};
```

#### Execution Order

The seeding process follows this order in the `main()` function:

1. `createPlatformConfig()` - Creates the platform configuration record
2. `createOrgRoles()` - Creates organization roles
3. `createAgentTypes()` - Creates agent types
4. `createPlatformUser()` - Creates platform admin user
5. `createPlatformOrganization()` - Creates platform admin organization
6. `createPlatformUserOrgRoles()` - Links platform admin user to roles
7. Additional initialization steps...

### 2. Platform Configuration Schema

The `platform_config` table has the following required columns:

```sql
Column              | Type                           | Nullable | Default
--------------------|--------------------------------|----------|----------
id                  | uuid                           | NOT NULL |
externalIp          | character varying              | NOT NULL |
username            | character varying              | NOT NULL |
sgApiKey            | character varying              | NOT NULL |
emailFrom           | character varying              | NOT NULL |
apiEndpoint         | character varying              | NOT NULL |
tailsFileServer     | character varying              | NOT NULL |
inboundEndpoint     | character varying              | NULL     |
createDateTime      | timestamp(6) with time zone    | NOT NULL | CURRENT_TIMESTAMP
createdBy           | text                           | NOT NULL | '1'::text
lastChangedDateTime | timestamp(6) with time zone    | NOT NULL | CURRENT_TIMESTAMP
lastChangedBy       | text                           | NOT NULL | '1'::text
deletedAt           | timestamp(6) without time zone | NULL     |
```

### 3. Running the Initialization

#### Development Environment

```bash
# Navigate to the prisma service directory
cd ./libs/prisma-service

# Run the database seeding
npx prisma db seed
```

#### Production Environment

The seeding process is also executed through the `seed-service` container in the Docker Compose setup:

```yaml
seed-service:
  container_name: seed-service
  image: ghcr.io/credebl/seed:latest
  env_file:
    - ./.env
  volumes:
    - $PWD/libs/prisma-service/prisma/data/credebl-master-table.json:/app/libs/prisma-service/prisma/data/credebl-master-table.json
```

### 4. Configuration Data Source

The platform configuration data is loaded from `libs/prisma-service/prisma/data/credebl-master-table.json`, which contains:

- `platformConfigData` - Default platform configuration values
- `orgRoleData` - Organization role definitions
- `agentTypeData` - Agent type definitions
- `platformAdminData` - Platform admin user data
- `platformAdminOrganizationData` - Platform admin organization data
- Other master data required for platform initialization

### 5. Environment Variables

The following environment variables are required for proper initialization:

```bash
# Platform Admin Configuration
PLATFORM_ADMIN_EMAIL=platform.admin@example.com
PLATFORM_WALLET_NAME=platform-admin
PLATFORM_WALLET_PASSWORD=encrypted_password
PLATFORM_SEED=000000000000000000000000Steward1

# Database Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/credebl"

# Platform Configuration
PLATFORM_NAME=CREDEBL
PLATFORM_URL=https://api.example.com
API_ENDPOINT=api.example.com:5000
```

### 6. Manual Recovery

If the platform configuration is missing and seeding fails, you can manually insert a record:

```sql
INSERT INTO platform_config (
    id,
    "externalIp",
    username,
    "sgApiKey",
    "emailFrom",
    "apiEndpoint",
    "tailsFileServer",
    "inboundEndpoint"
) VALUES (
    gen_random_uuid(),
    'localhost',
    'admin',
    'default-sg-key',
    'noreply@example.com',
    'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:3000'
);
```

## Platform Settings Update Flow

### 1. API Endpoint

- **Route**: `PUT /users/platform-settings`
- **Guards**: `AuthGuard("jwt")`, `OrgRolesGuard`, `UserAccessGuard`
- **Role Required**: `PLATFORM_ADMIN`

### 2. Service Layer

- **File**: `apps/user/src/user.service.ts`
- **Method**: `updatePlatformSettings()`
- Calls repository layer to update platform configuration

### 3. Repository Layer

- **File**: `apps/user/repositories/user.repository.ts`
- **Method**: `updatePlatformSettings()`
- Queries `platform_config` table using `findFirst()`
- Updates the found record with new values

### 4. Enhanced Error Handling

The repository now includes enhanced logging and error handling:

```typescript
if (!getPlatformDetails) {
  this.logger.error(`❌ Repository: No platform_config record found in database!`);
  throw new InternalServerErrorException(
    'No platform configuration found. Please create a platform configuration first.'
  );
}
```

## Troubleshooting

### Common Issues

1. **Missing platform_config record**: Run database seeding or manually insert record
2. **Authentication failures**: Ensure proper JWT token and PLATFORM_ADMIN role
3. **Database connection issues**: Verify DATABASE_URL and database availability
4. **Permission errors**: Ensure user has platform admin role in user_org_roles table

### Verification Steps

1. Check if platform_config record exists:

   ```sql
   SELECT * FROM platform_config;
   ```

2. Verify platform admin user exists:

   ```sql
   SELECT u.*, uor.*, or.name as role_name
   FROM user u
   JOIN user_org_roles uor ON u.id = uor."userId"
   JOIN org_roles or ON uor."orgRoleId" = or.id
   WHERE or.name = 'platform_admin';
   ```

3. Check seeding logs for any errors during initialization

## Best Practices

1. **Always run database seeding** after initial setup or database reset
2. **Monitor logs** during seeding process for any failures
3. **Backup platform configuration** before making changes
4. **Use environment variables** for sensitive configuration values
5. **Test platform settings endpoints** after deployment to ensure proper initialization

## Related Files

- `libs/prisma-service/prisma/seed.ts` - Database seeding logic
- `libs/prisma-service/prisma/data/credebl-master-table.json` - Master configuration data
- `apps/user/repositories/user.repository.ts` - Platform settings repository
- `apps/user/src/user.service.ts` - Platform settings service
- `apps/api-gateway/src/user/user.controller.ts` - Platform settings API endpoint
- `apps/api-gateway/src/user/dto/update-platform-settings.dto.ts` - Request DTO definition

## References

- [Prisma Database Seeding Documentation](https://www.prisma.io/docs/guides/database/seed-database)
- [NestJS Configuration Management](https://docs.nestjs.com/techniques/configuration)
- [Docker Compose Service Dependencies](https://docs.docker.com/compose/compose-file/#depends_on)
