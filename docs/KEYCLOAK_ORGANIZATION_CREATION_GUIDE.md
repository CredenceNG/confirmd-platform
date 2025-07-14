# Keycloak Organization Creation Guide

## Overview

This document outlines the complete process of organization creation by platform administrators, including Keycloak integration, database requirements, and troubleshooting steps.

## Key Learnings from Production Debugging

### 1. Organization Creation Flow

The organization creation process follows this sequence:

1. **Organization Data Validation**
   - Name uniqueness check (returns 409 Conflict if duplicate)
   - Required fields validation
   - User authentication verification

2. **Logo Upload Process**
   - **S3 Storage**: Used when `AWS_ORG_LOGO_BUCKET_NAME` is configured
   - **Local Storage Fallback**: Automatically used when S3 is not configured
   - Local logos stored in: `./uploads/org-logos/`
   - Accessible via: `/uploads/orgLogo-[timestamp].png`

3. **Database Organization Creation**
   - Organization record created in `organization` table
   - Returns organization ID for subsequent operations

4. **Keycloak Integration Phase**
   - Management token acquisition
   - Keycloak client creation
   - Organization roles creation
   - Owner role assignment

### 2. Keycloak Integration Architecture

#### Management Client Authentication

- **Platform Admin Users**: Use dedicated management client from environment variables
- **Regular Users**: Use individual user client credentials
- **Environment Variables Required**:
  ```
  KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
  KEYCLOAK_MANAGEMENT_CLIENT_SECRET=[encrypted_secret]
  ```

#### Client Creation Process

```typescript
// Organization becomes a Keycloak client
const clientPayload = {
  clientId: organizationId,
  name: organizationName,
  enabled: true,
  clientAuthenticatorType: 'client-secret'
  // ... other client configuration
};
```

#### Role Management

Five standard roles are created for each organization:

- `owner` - Full organization control
- `admin` - Administrative privileges
- `issuer` - Credential issuance rights
- `verifier` - Credential verification rights
- `member` - Basic organization membership

### 3. Critical Database Dependencies

#### Organization Roles Table

**CRITICAL**: The `org_roles` table must be properly seeded before organization creation.

```sql
-- Required org_roles entries
INSERT INTO org_roles (id, name, description, created_by, created_date, last_changed_by, last_changed_date, deleted_at) VALUES
('08211ee6-263e-4e97-adb4-51f8438cbadb', 'owner', 'Owner of the organization', '1', NOW(), '1', NOW(), NULL),
('1671ade4-4c5e-4e84-8d5c-4f79e5068c4b', 'admin', 'Admin of the organization', '1', NOW(), '1', NOW(), NULL),
('2e5d4e1a-9b8c-4d3e-8f7a-1b2c3d4e5f6g', 'issuer', 'Issuer in the organization', '1', NOW(), '1', NOW(), NULL),
('3f6e5d2b-ac9d-4e4f-9g8b-2c3d4e5f6g7h', 'verifier', 'Verifier in the organization', '1', NOW(), '1', NOW(), NULL),
('4g7f6e3c-bd0e-4f5g-ah9c-3d4e5f6g7h8i', 'member', 'Member of the organization', '1', NOW(), '1', NOW(), NULL);
```

**Error if missing**: `Cannot read properties of null (reading 'name')`

### 4. Static File Serving Configuration

Organization logos are served through Express static middleware:

```typescript
// In apps/api-gateway/src/main.ts
app.use(express.static('uploadedFiles/org-logo')); // Legacy path
app.use('/uploads', express.static('uploads')); // New path for local storage
```

### 5. Environment Configuration

#### Required Environment Variables

```bash
# Keycloak Configuration
KEYCLOAK_DOMAIN=https://manager.credence.ng
KEYCLOAK_REALM=confirmd-bench
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=[encrypted_secret]

# AWS Configuration (Optional - triggers S3 usage)
AWS_ORG_LOGO_BUCKET_NAME=  # Empty = local storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Platform Configuration
PLATFORM_NAME=ConfirmD Platform
API_GATEWAY_PORT=3000
API_GATEWAY_HOST=0.0.0.0
```

### 6. Troubleshooting Common Issues

#### Issue 1: "Cannot read properties of null (reading 'name')"

**Cause**: Missing org_roles in database
**Solution**:

1. Check `org_roles` table: `SELECT * FROM org_roles;`
2. Run seed script or manually insert roles
3. Restart organization service

#### Issue 2: S3 Upload Failures

**Cause**: Missing/invalid AWS credentials
**Solution**:

1. Set `AWS_ORG_LOGO_BUCKET_NAME=""` to use local storage
2. Or configure proper AWS credentials
3. System automatically falls back to local storage

#### Issue 3: Keycloak Client Creation Failures

**Cause**: Invalid management token or insufficient permissions
**Solution**:

1. Verify management client exists in Keycloak
2. Check management client permissions
3. Ensure realm configuration is correct

#### Issue 4: Duplicate Organization Names

**Behavior**: Returns 409 Conflict (working as expected)
**Solution**: Use unique organization names

### 7. Logging and Monitoring

#### Key Log Messages to Monitor

**Success Indicators**:

```
✅ Organization created in database
✅ Keycloak client created successfully
✅ All organization roles created successfully
✅ Owner role assigned successfully
🎉 === ORGANIZATION CREATION COMPLETED SUCCESSFULLY ===
```

**Warning Indicators**:

```
AWS_ORG_LOGO_BUCKET_NAME is not configured. Using local file storage
```

**Error Indicators**:

```
❌ === ORGANIZATION CREATION FAILED ===
❌ KEYCLOAK REGISTRATION FAILED
Cannot read properties of null (reading 'name')
```

### 8. Development vs Production Considerations

#### Development Environment

- Local file storage preferred for logos
- Simplified Keycloak setup
- Database seeding required

#### Production Environment

- S3 storage recommended for logos
- Proper SSL certificates for Keycloak
- Database migrations handle seeding
- Monitoring and alerting for failures

### 9. Security Considerations

#### Keycloak Client Security

- Each organization gets its own Keycloak client
- Client secrets are encrypted in database
- Role-based access control enforced
- Management client has restricted permissions

#### File Upload Security

- Logo files validated for type and size
- Stored in isolated directories
- Served through controlled static routes

### 10. Performance Optimization

#### Keycloak Operations

- Management tokens are cached (5-minute expiry)
- Batch role creation for efficiency
- Async operations where possible

#### Database Operations

- Proper indexing on organization names
- Transaction management for consistency
- Connection pooling for performance

## Quick Reference Commands

### Check Database State

```sql
-- Check org_roles
SELECT * FROM org_roles;

-- Check recent organizations
SELECT id, name, created_date FROM organization ORDER BY created_date DESC LIMIT 10;

-- Check user organizations
SELECT o.name, uo.role FROM organization o
JOIN user_org_roles uo ON o.id = uo.orgId
WHERE uo.userId = '[user_id]';
```

### Test Organization Creation

```bash
# Test with curl
curl -X POST http://localhost:3000/api/v1/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "name": "Test Org",
    "description": "Test Organization",
    "logo": "[base64_image_data]"
  }'
```

### Check Local Logo Storage

```bash
# Check uploaded logos
ls -la uploads/org-logos/

# Test logo accessibility
curl http://localhost:3000/uploads/org-logos/[logo_filename]
```

## Maintenance Tasks

### Regular Maintenance

1. **Monitor Keycloak Token Expiry**: Management tokens expire every 5 minutes
2. **Check Database Seeding**: Ensure org_roles are always present
3. **Logo Storage Cleanup**: Implement cleanup for unused logos
4. **Keycloak Client Monitoring**: Monitor for failed client creations

### Emergency Procedures

1. **Keycloak Unavailable**: Organization creation will fail - implement retry logic
2. **Database Corruption**: Have org_roles backup and restore procedure
3. **Storage Full**: Monitor disk space for local logo storage

## Conclusion

The organization creation process is now fully functional with proper error handling, fallback mechanisms, and comprehensive logging. The key success factors are:

1. Proper database seeding (org_roles)
2. Correct Keycloak configuration
3. Appropriate environment variables
4. Robust error handling and logging

This documentation should serve as a reference for future maintenance and troubleshooting of the organization creation system.
