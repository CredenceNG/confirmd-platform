# Organization Creation Troubleshooting Checklist

## Quick Diagnostic Steps

### 1. Initial Error Assessment

- [ ] Check logs for error message pattern
- [ ] Identify where in the process failure occurs
- [ ] Note the specific error message and context

### 2. Database Health Check

```sql
-- Check if org_roles table is properly seeded
SELECT * FROM org_roles;
-- Should return 5 rows: owner, admin, issuer, verifier, member

-- Check recent organization creation attempts
SELECT id, name, created_date, client_id FROM organization
ORDER BY created_date DESC LIMIT 10;
```

### 3. Environment Configuration Check

```bash
# Check critical environment variables
echo "Keycloak Domain: $KEYCLOAK_DOMAIN"
echo "Keycloak Realm: $KEYCLOAK_REALM"
echo "Management Client ID: $KEYCLOAK_MANAGEMENT_CLIENT_ID"
echo "AWS Bucket: $AWS_ORG_LOGO_BUCKET_NAME"
```

### 4. File Storage Check

```bash
# Check local storage directory
ls -la uploads/org-logos/

# Test static file serving
curl http://localhost:3000/uploads/org-logos/[latest-logo-file]
```

### 5. Keycloak Connectivity Test

```bash
# Test management token acquisition
curl -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=confirmd-bench-management" \
  -d "client_secret=[secret]"
```

## Common Error Patterns and Solutions

### Error: "Cannot read properties of null (reading 'name')"

**Cause**: Missing org_roles in database
**Solution**:

```sql
-- Insert missing org_roles
INSERT INTO org_roles (id, name, description, created_by, created_date, last_changed_by, last_changed_date, deleted_at) VALUES
('08211ee6-263e-4e97-adb4-51f8438cbadb', 'owner', 'Owner of the organization', '1', NOW(), '1', NOW(), NULL),
('1671ade4-4c5e-4e84-8d5c-4f79e5068c4b', 'admin', 'Admin of the organization', '1', NOW(), '1', NOW(), NULL),
('2e5d4e1a-9b8c-4d3e-8f7a-1b2c3d4e5f6g', 'issuer', 'Issuer in the organization', '1', NOW(), '1', NOW(), NULL),
('3f6e5d2b-ac9d-4e4f-9g8b-2c3d4e5f6g7h', 'verifier', 'Verifier in the organization', '1', NOW(), '1', NOW(), NULL),
('4g7f6e3c-bd0e-4f5g-ah9c-3d4e5f6g7h8i', 'member', 'Member of the organization', '1', NOW(), '1', NOW(), NULL);
```

### Error: "An organization name is already exist"

**Cause**: Duplicate organization name (409 Conflict)
**Solution**: Use unique organization name (this is expected behavior)

### Error: "Unable to create client"

**Cause**: Keycloak connectivity or permission issues
**Solution**:

1. Check Keycloak service status
2. Verify management client permissions
3. Check network connectivity
4. Verify client credentials are not expired

### Error: S3 Upload Failures

**Cause**: AWS credentials or bucket configuration issues
**Solution**:

```bash
# Force local storage by clearing bucket name
export AWS_ORG_LOGO_BUCKET_NAME=""
# Or fix AWS credentials
export AWS_ACCESS_KEY_ID="[key]"
export AWS_SECRET_ACCESS_KEY="[secret]"
export AWS_REGION="us-east-1"
```

## Service Restart Procedures

### Organization Service Restart

```bash
# Using Docker Compose
docker-compose -f docker-compose-dev.yml restart organization-service

# Check service logs
docker-compose -f docker-compose-dev.yml logs -f organization-service
```

### Full Platform Restart

```bash
# Restart all services
docker-compose -f docker-compose-dev.yml down
docker-compose -f docker-compose-dev.yml up -d

# Monitor startup
docker-compose -f docker-compose-dev.yml logs -f
```

## Verification Steps

### Test Organization Creation

```bash
# Create test organization via API
curl -X POST "http://localhost:3000/api/v1/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "name": "Test Organization",
    "description": "Test organization for verification",
    "logo": "[base64_image_data]"
  }'
```

### Verify Keycloak Integration

1. Check Keycloak admin console
2. Verify client was created in correct realm
3. Verify roles were created for the client
4. Verify user was assigned owner role

### Verify File Storage

1. Check logo file exists in expected location
2. Verify file is accessible via HTTP
3. Check file permissions and ownership

## Monitoring Commands

### Real-time Log Monitoring

```bash
# Organization service logs
docker-compose -f docker-compose-dev.yml logs -f organization-service

# API Gateway logs
docker-compose -f docker-compose-dev.yml logs -f api-gateway

# Filter for organization creation
docker-compose -f docker-compose-dev.yml logs -f | grep "ORGANIZATION CREATION"
```

### Database Monitoring

```sql
-- Monitor recent organization creations
SELECT
    o.name,
    o.created_date,
    o.client_id,
    CASE WHEN o.client_id IS NOT NULL THEN 'Keycloak Integrated' ELSE 'Keycloak Pending' END as keycloak_status
FROM organization o
ORDER BY o.created_date DESC
LIMIT 10;

-- Check user-organization relationships
SELECT
    u.email,
    o.name as organization_name,
    uor.role
FROM users u
JOIN user_org_roles uor ON u.id = uor.userId
JOIN organization o ON uor.orgId = o.id
ORDER BY o.created_date DESC;
```

## Emergency Procedures

### Keycloak Service Down

1. **Immediate**: Set maintenance mode for org creation
2. **Temporary**: Organizations can be created without Keycloak (will need manual sync later)
3. **Recovery**: Implement batch sync process for pending organizations

### Database Issues

1. **Backup**: Always backup before making changes
2. **Rollback**: Have rollback procedures ready
3. **Seeding**: Keep org_roles seed data readily available

### Storage Full

1. **Cleanup**: Remove old/unused logo files
2. **Monitoring**: Implement disk space monitoring
3. **Scaling**: Consider cloud storage migration

## Success Indicators

Look for these log messages to confirm successful operation:

- ✅ Organization created in database
- ✅ Keycloak client created successfully
- ✅ All organization roles created successfully
- ✅ Owner role assigned successfully
- 🎉 === ORGANIZATION CREATION COMPLETED SUCCESSFULLY ===

## Contact Information

For escalation or additional support:

- **Primary**: Platform Administrator
- **Secondary**: DevOps Team
- **Emergency**: System Administrator

---

_Last Updated: July 7, 2025_
_Version: 1.0_
