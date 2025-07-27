# Hot Reloading Setup and Role Update Testing

## Hot Reloading Setup

You've successfully set up hot reloading with the development Docker Compose configuration. This means:

1. Any changes you make to the source code files will be automatically reflected in the running services
2. No need to rebuild containers or restart services when you make code changes
3. Volume mappings are active for all key source code directories

## How Hot Reloading Works

The development Docker Compose file uses volume mounts to bind your local source code directories to the containers:

```yaml
volumes:
  - ./apps/organization:/app/apps/organization
  - ./libs:/app/libs
  - ./package.json:/app/package.json
  - ./nest-cli.json:/app/nest-cli.json
  - ./tsconfig.json:/app/tsconfig.json
  - ./tsconfig.build.json:/app/tsconfig.build.json
```

This means when you edit files locally, the changes are immediately available inside the container.

## Verifying Fixes for User Role Update Issue

Your fix for the user role update issue is already deployed in the API Gateway service. To test:

1. **Using Postman or another API client:**
   - Endpoint: `PUT https://platform.confamd.com/orgs/{orgId}/user-roles/{userId}`
   - Header: `Authorization: Bearer <your-token>`
   - Body:
     ```json
     {
       "orgRoleId": ["role-id-here"]
     }
     ```

2. **Using the debug script:**
   If you have valid credentials, update the script with:
   ```javascript
   // In debug-role-error.js
   const USERNAME = 'your-valid-username';
   const PASSWORD = process.env.USER_PASSWORD || 'your-default-password';
   ```

## Making Additional Changes

If you need to make any additional changes to fix the user role update issue:

1. Edit the source code files directly
2. Hot reloading will automatically apply the changes
3. No need to rebuild or restart containers
4. Test the endpoint again to verify the fix

## Important Files for the Role Update Fix

1. **API Gateway Service:**
   - `/apps/api-gateway/src/organization/organization.service.ts` (updateUserRoles method)

2. **Organization Service:**
   - `/apps/organization/src/organization.service.ts` (updateUserClientRoles method)

3. **Client Registration Service:**
   - `/libs/client-registration/src/client-registration.service.ts` (getManagementToken methods)

## Checking Container Logs

To check logs for specific services:

```bash
# Check API Gateway logs
docker logs confirmd-platform-api-gateway-1

# Check Organization service logs
docker logs confirmd-platform-organization-1

# Follow logs in real time
docker logs -f confirmd-platform-organization-1
```

## Testing with Frontend

Once your backend fix is working correctly, you should be able to update user roles through the frontend application without encountering 500 errors.

Remember to check server logs if you still experience issues, as they will provide detailed information about what's happening during role updates.
