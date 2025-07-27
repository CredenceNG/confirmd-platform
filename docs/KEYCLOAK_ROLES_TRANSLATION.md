# Keycloak Roles Translation to Application

## Overview

Based on my investigation, here's how Keycloak roles are translated to the application roles:

## **1. JWT Token Structure**

When a user logs in, Keycloak issues a JWT token with the following role-related fields:

```json
{
  "realm_access": {
    "roles": ["mb-user", "offline_access", "uma_authorization", "default-roles-confirmd-bench"]
  },
  "resource_access": {
    "account": {
      "roles": ["manage-account", "manage-account-links", "view-profile"]
    },
    "f856e3a4-b09c-4356-82de-b105594eec43": {
      "roles": ["owner", "admin", "issuer", "verifier", "holder"]
    }
  }
}
```

## **2. Role Translation Flow**

### **A. JWT Strategy Processing**

- Location: `apps/api-gateway/src/authz/jwt.strategy.ts`
- The JWT strategy extracts roles from the token
- It looks up the user in the database using `payload.sub` (Keycloak user ID)
- Returns user object with both JWT payload and database user info

### **B. Organization Roles (from Keycloak)**

- **Source**: `resource_access[orgId].roles` in JWT token
- **Usage**: In `OrgRolesGuard` for endpoint authorization
- **Examples**: `owner`, `admin`, `issuer`, `verifier`, `holder`, `platform_admin`

### **C. Platform Roles (from Database)**

- **Source**: `user_role_mapping` table with `user_role` lookup
- **Usage**: In profile response and platform-level permissions
- **Examples**: `DEFAULT_USER`, `HOLDER`

## **3. Role Assignment Process**

### **Organization Role Assignment**

1. When user joins organization → `organization.service.ts` calls:

   ```typescript
   this.clientRegistrationService.createUserClientRole(
     orgDetails.idpId, // Organization's Keycloak client ID
     token,
     keycloakUserId,
     payload // Role data
   );
   ```

2. This creates Keycloak client-specific roles in `resource_access[orgId]`

3. Simultaneously stores in database: `user_org_roles` table

### **Platform Role Assignment**

1. During user creation → assigns platform roles to database:

   ```typescript
   await this.userRepository.storeUserRole(userId, defaultUserRoleId);
   ```

2. These roles are NOT synced to Keycloak (they're application-specific)

## **4. Authorization Flow**

### **Endpoint Protection**

```typescript
@Roles(OrgRoles.OWNER, OrgRoles.ADMIN)
@UseGuards(AuthGuard('jwt'), OrgRolesGuard)
async someEndpoint() {
  // Protected endpoint
}
```

### **Role Checking Logic**

1. **OrgRolesGuard** checks:
   - JWT `resource_access[orgId].roles` (Keycloak roles)
   - Database `userOrgRoles` (fallback/verification)

2. **Platform Admin Check**:
   ```typescript
   if (requiredRolesNames.includes(OrgRoles.PLATFORM_ADMIN)) {
     const isPlatformAdmin = user.userOrgRoles.find((orgDetails) => orgDetails.orgRole.name === 'platform_admin');
   }
   ```

## **5. Profile Response**

The user profile now includes both:

```json
{
  "userOrgRoles": [
    {
      "orgRole": { "name": "holder" },
      "organisation": { "name": "Test Org" }
    }
  ],
  "user_role_mapping": [
    {
      "user_role": { "role": "DEFAULT_USER" }
    }
  ]
}
```

## **6. Key Differences**

| Aspect            | Organization Roles       | Platform Roles       |
| ----------------- | ------------------------ | -------------------- |
| **Storage**       | Keycloak + Database      | Database Only        |
| **Scope**         | Organization-specific    | Platform-wide        |
| **JWT Field**     | `resource_access[orgId]` | Not in JWT           |
| **Examples**      | owner, admin, issuer     | DEFAULT_USER, HOLDER |
| **Authorization** | OrgRolesGuard            | Custom logic         |

## **7. Current Implementation Status**

✅ **Working:**

- Organization roles synced to Keycloak
- JWT token contains org-specific roles
- Profile response shows both role types
- Authorization guards work correctly

❌ **Limitations:**

- Platform roles not in JWT (by design)
- No realm-level role mapping for platform roles
- Platform roles are purely application-level

## **8. Authentication Flow Summary**

1. **Login** → Keycloak issues JWT with `resource_access` containing org roles
2. **JWT Strategy** → Extracts user info and merges with JWT payload
3. **Authorization** → Guards check both JWT roles and database roles
4. **Profile** → Returns both organizational and platform roles from database

This architecture separates concerns: Keycloak handles organization-specific authorization while the application manages platform-level permissions internally.
