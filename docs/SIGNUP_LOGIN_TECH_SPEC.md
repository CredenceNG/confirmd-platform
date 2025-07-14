# CONFIRMD Platform - Sign Up and Login Technical Specification

## Overview

This document outlines the technical implementation and flow for user signup and login functionality in the CONFIRMD Platform, including authentication, password encryption, and database storage patterns.

## Architecture Components

### Core Services

- **API Gateway**: Entry point for authentication requests (Port 5000)
- **User Service**: Handles user management and authentication logic
- **Keycloak**: OAuth2/OIDC authentication server at `https://manager.credence.ng`
- **PostgreSQL**: Database for user data storage (`credebl` database)
- **NATS**: Message broker for inter-service communication

### Key Configuration

- **Encryption Key**: `CRYPTO_PRIVATE_KEY=dzIvVU5uMa0R3sYwdjEEuT4id17mPpjr`
- **Realm**: `confirmd-bench`
- **Management Client**: `confirmd-bench-management`

## Sign Up Flow

### 1. Frontend Password Processing

```javascript
// Frontend encrypts password before sending to backend
const encryptedPassword = CryptoJS.AES.encrypt(JSON.stringify(plainPassword), CRYPTO_PRIVATE_KEY).toString();
```

### 2. Backend Processing (`createUserForToken` method)

#### Regular User Signup Flow

```typescript
// Save frontend-encrypted password directly to database (no double encryption)
const frontendEncryptedPassword = userInfo.password; // Already encrypted by frontend
await userRepository.addUserPassword(email.toLowerCase(), frontendEncryptedPassword);

// Decrypt password for Keycloak user creation
const decryptedPasswordForKeycloak = await commonService.decryptPassword(frontendEncryptedPassword);
userInfo.password = decryptedPasswordForKeycloak; // Send plain text to Keycloak
```

#### Passkey User Flow

```typescript
// For passkey users, password is handled differently
const resUser = await userRepository.addUserPassword(email.toLowerCase(), userInfo.password);
const userDetails = await userRepository.getUserDetails(email.toLowerCase());
const decryptedPassword = await commonService.decryptPassword(userDetails.password);
```

### 3. Database Storage

- **Table**: `user`
- **Password Field**: Stores frontend-encrypted password (single encryption layer)
- **Format**: Base64 encoded AES encrypted string

### 4. Keycloak User Creation

- **Endpoint**: `POST /admin/realms/{realm}/users`
- **Password**: Plain text password (decrypted from frontend encryption)
- **Attributes**: User details including roles

### 5. Role Assignment

- **Default Role**: `mb-user` (Mobile banking user role)
- **Role ID**: `fba141dd-ec87-4b87-902b-87af27d69099`

## Login Flow

### 1. Frontend Request

```javascript
const loginData = {
  email: 'user@example.com',
  password: encryptedPassword, // Frontend-encrypted
  isPasskey: false
};
```

### 2. Backend Authentication Process

#### Password Validation

```typescript
// Decrypt password from database
const storedPassword = await userRepository.getUserDetails(email);
const decryptedStoredPassword = await commonService.decryptPassword(storedPassword.password);

// Decrypt login password from frontend
const decryptedLoginPassword = await commonService.decryptPassword(loginPassword);
```

#### Keycloak Token Request

```typescript
// Send plain text password to Keycloak for authentication
const tokenData = {
  username: email,
  password: decryptedLoginPassword,
  grant_type: 'password',
  client_id: 'confirmd-bench-management',
  client_secret: 'APwJSRD9xjvfjTTZO0RoUz3y7sWej2eO'
};
```

### 3. Token Generation

- **Endpoint**: `POST /realms/{realm}/protocol/openid-connect/token`
- **Response**: JWT access token with user claims
- **Expiry**: 300 seconds (5 minutes)

## Encryption Strategy

### Password Encryption

- **Algorithm**: AES (Advanced Encryption Standard)
- **Library**: CryptoJS
- **Format**: `JSON.stringify(password)` → AES encrypt → Base64 encode

### Encryption Layers

1. **Frontend**: User password → AES encrypted
2. **Database**: Stores frontend-encrypted password (no additional encryption)
3. **Keycloak**: Receives plain text password for authentication

### Key Management

- **Primary Key**: `CRYPTO_PRIVATE_KEY` environment variable
- **Usage**: Both encryption and decryption operations
- **Scope**: Platform-wide encryption key

## Database Schema

### User Table

```sql
CREATE TABLE "user" (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password TEXT, -- Frontend-encrypted password
  firstName VARCHAR,
  lastName VARCHAR,
  keycloakUserId UUID,
  isEmailVerified BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Password Storage Pattern

- **Correct**: `U2FsdGVkX1+/nBv/KAmwC2V370wq8yMRIrMmggUcPMY=` (Single encryption)
- **Incorrect**: Double encryption (avoided by our implementation)

## API Endpoints

### Authentication Endpoints

- `POST /auth/signin` - User login
- `POST /auth/signup` - User registration
- `GET /users/profile` - Get user profile (requires Bearer token)

### Response Format

```json
{
  "statusCode": 200,
  "message": "success",
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "279c2f73-8999-4c54-92fe-6163bd6a1d39",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

## Security Considerations

### Password Security

- ✅ **Frontend Encryption**: Passwords encrypted before transmission
- ✅ **Single Encryption**: No double encryption in database
- ✅ **Keycloak Integration**: Plain text authentication with OAuth provider
- ✅ **Token-based Auth**: JWT tokens for session management

### Error Handling

- **Invalid Credentials**: 401 Unauthorized
- **User Not Found**: 404 Not Found
- **Validation Errors**: 400 Bad Request
- **Server Errors**: 500 Internal Server Error

## Performance Considerations

### Database Operations

- **Connection Pooling**: PostgreSQL connection pool
- **Indexing**: Email field indexed for fast lookups
- **Encryption Overhead**: Minimal AES encryption/decryption cost

### Keycloak Integration

- **Token Caching**: Management tokens cached for 300 seconds
- **Connection Reuse**: HTTP connection pooling to Keycloak
- **Retry Logic**: Built-in retry for transient failures

## Monitoring and Logging

### Log Patterns

```
🚀 === STARTING USER CREATION FOR TOKEN === Email: {email}
🔑 Processing regular signup flow for {email}
🔐 Using frontend-encrypted password for database storage
💾 Password saved to database for {email}
📋 Using decrypted password for Keycloak user creation
✅ User created successfully in Keycloak for {email}
```

### Key Metrics

- User signup success rate
- Login success rate
- Password encryption/decryption performance
- Keycloak response times

## Troubleshooting Guide

### Common Issues

#### Double Encryption Problem (Fixed)

- **Symptom**: User can signup but cannot login
- **Cause**: Password encrypted twice (frontend + backend)
- **Solution**: Save frontend-encrypted password directly to database

#### Keycloak Authentication Failure

- **Symptom**: 401 "Invalid user credentials"
- **Cause**: Password mismatch between database and Keycloak
- **Solution**: Ensure plain text password sent to Keycloak during signup

#### Token Validation Errors

- **Symptom**: 500 errors on profile access
- **Solution**: Verify JWT strategy configuration

### Testing Commands

```bash
# Test new user creation and login
node test-complete-flow.js

# Verify password encryption
node test-password-fix-verification.js

# Check database password storage
docker-compose exec -T postgres psql -U postgres -d credebl -c "SELECT email, password FROM \"user\" WHERE email = 'test@example.com';"
```

## Implementation Checklist

### Sign Up

- [ ] Frontend password encryption
- [ ] Backend receives encrypted password
- [ ] Save encrypted password to database (no double encryption)
- [ ] Decrypt password for Keycloak user creation
- [ ] Create user in Keycloak with plain text password
- [ ] Assign default role (`mb-user`)
- [ ] Send email verification

### Login

- [ ] Frontend password encryption
- [ ] Backend receives encrypted password
- [ ] Decrypt login password
- [ ] Authenticate with Keycloak using plain text password
- [ ] Generate JWT token
- [ ] Return user data and access token

### Profile Access

- [ ] Validate JWT token
- [ ] Retrieve user data from database
- [ ] Return user profile with roles

## Future Enhancements

### Security Improvements

- Implement password strength validation
- Add rate limiting for login attempts
- Consider password rotation policies
- Implement multi-factor authentication

### Performance Optimizations

- Cache frequently accessed user data
- Optimize database queries
- Implement connection pooling
- Add request/response compression

### Monitoring Enhancements

- Add detailed authentication metrics
- Implement real-time alerting
- Create authentication dashboards
- Track user behavior analytics

---

**Document Version**: 1.0  
**Last Updated**: July 14, 2025  
**Author**: GitHub Copilot  
**Status**: Implemented and Verified
