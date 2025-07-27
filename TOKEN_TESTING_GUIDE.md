# Token Generation for Testing

This documentation explains how to use the token generation scripts for backend and frontend testing.

## Overview

Two scripts are available to help with generating authentication tokens:

1. `get-fresh-token.js` - A flexible script for generating tokens for API testing
2. `frontend-token.js` - A specialized script for frontend integration testing

## Backend API Testing

For backend API testing, use the `get-fresh-token.js` script:

```bash
node get-fresh-token.js <password>
```

This will generate a JWT token that you can use for authenticated API requests.

### Options

- `--frontend`: Format the output specifically for frontend testing
- `--save`: Save the configuration to a file (automatically enables frontend mode)

Example:

```bash
node get-fresh-token.js Pass@123 --frontend --save
```

## Frontend Integration Testing

For frontend testing, use the dedicated `frontend-token.js` script:

```bash
node frontend-token.js <password>
```

This script:

1. Generates a fresh token with the platform-admin client
2. Creates a configuration file (`frontend-test-auth.json`) that can be used in frontend tests
3. Provides detailed output formatted for frontend integration

### Frontend Integration Example

```javascript
// In your frontend test setup
import authConfig from './frontend-test-auth.json';

// Set up axios with authentication
axios.defaults.headers.common['Authorization'] = `Bearer ${authConfig.auth.accessToken}`;

// Use Keycloak configuration
const keycloakConfig = {
  url: authConfig.keycloak.url,
  realm: authConfig.keycloak.realm,
  clientId: authConfig.keycloak.clientId
};

// You can also access user information
const userEmail = authConfig.user.email;
const userRoles = authConfig.user.roles;
```

## Troubleshooting

If you encounter token generation issues:

1. Verify your Keycloak server is running and accessible
2. Confirm the correct username and password
3. Check that the client is configured for password grant type
4. Ensure the user exists in Keycloak and has the appropriate roles
5. Check the network connectivity between your environment and Keycloak

## Environment Variables

Instead of passing the password directly, you can set the `USER_PASSWORD` environment variable:

```bash
export USER_PASSWORD=Pass@123
node get-fresh-token.js
```

This is useful for CI/CD pipelines or when you want to avoid exposing the password in your command history.
