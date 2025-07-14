# CREDEBL migration to Microservices

## Run CREDEBL Micro-services

```bash
$ npm install
```

## Creating the individual microservice mode structure as follows:

`nest generate app [my-app]`

## Starting the individual Microservices

`nest start [my-app] [--watch]`

## Creating the libraries

`nest g library [my-library]`

### library schematic prompts you for a prefix (credebl alias) for the library:

`What prefix would you like to use for the library (default: @app)? credebl`

## Available Microservices

The platform consists of the following microservices:

### Core Services

- **API Gateway** (`api-gateway`) - Main entry point, handles routing and authentication
- **User Service** (`user`) - User management and authentication
- **Organization Service** (`organization`) - Organization and invitation management
- **Agent Service** (`agent-service`) - Agent provisioning and management

### Credential Services

- **Issuance Service** (`issuance`) - Credential issuance workflows
- **Verification Service** (`verification`) - Credential verification processes
- **Connection Service** (`connection`) - Agent connection management
- **Cloud Wallet Service** (`cloud-wallet`) - Wallet operations

### Supporting Services

- **Ledger Service** (`ledger`) - Blockchain ledger interactions
- **Notification Service** (`notification`) - Email and notification handling
- **Utility Service** (`utility`) - Shared utilities and helpers
- **Geo-location Service** (`geo-location`) - Location-based services
- **Webhook Service** (`webhook`) - Webhook management

## Development Commands

### Start all services in development mode:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Start individual service:

```bash
nest start [service-name] --watch
```

### Build specific service:

```bash
nest build [service-name]
```

### Generate new app:

```bash
nest generate app [new-service-name]
```

## Production Deployment

### Using Docker Compose:

```bash
# Development build
docker-compose -f docker-compose-dev.yml up -d

# With specific compose file
docker-compose -f docker-compose-dev.yml up -d
```

### Individual Service Deployment:

```bash
# Build production image
docker build -f Dockerfiles/Dockerfile.[service-name] -t confirmd/[service-name]:latest .

# Run service
docker run -d --name [service-name] --network confirmd_network confirmd/[service-name]:latest
```

## Service Communication

### NATS Message Broker

Services communicate via NATS message patterns:

```typescript
// Example service call
const result = await this.natsClient.send('service-pattern', payload);
```

### Common Message Patterns:

- `create-organization` - Organization creation
- `send-invitation` - User invitations
- `create-connection-invitation` - Connection invitations
- `issue-credential` - Credential issuance
- `verify-presentation` - Verification requests

## Environment Configuration

### Required Environment Variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/credebl

# NATS
NATS_URL=nats://nats:4222

# Keycloak
KEYCLOAK_DOMAIN=https://manager.credence.ng/
KEYCLOAK_REALM=confirmd-bench
KEYCLOAK_MANAGEMENT_CLIENT_ID=confirmd-bench-management
KEYCLOAK_MANAGEMENT_CLIENT_SECRET=your-secret

# AWS (for file storage)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket
```

## Debugging and Troubleshooting

### Quick Health Check:

```bash
# Run the diagnostic script
./quick-500-debug.sh
```

### View Service Logs:

```bash
# All services
docker-compose -f docker-compose-dev.yml logs -f

# Specific service
docker logs -f confirmd-platform-[service-name]-1
```

### Common Issues:

1. **Service Communication Failures / RPC Exceptions**

   ```bash
   # Check NATS connectivity
   docker logs nats --tail 20

   # Restart NATS and core services
   docker-compose -f docker-compose-dev.yml restart nats api-gateway organization user
   ```

2. **500 Errors on Organization Operations**

   ```bash
   # Fix: Platform admin missing client credentials
   docker exec -it confirmd-platform-postgres-1 psql -U postgres -d credebl -c "
   UPDATE \"user\" SET
   \"clientId\" = 'U2FsdGVkX1/Pjz7acLRMfR26b8OddYLaLybj7HrO8DdJqrtcFZadiA3MaeWNw8LL',
   \"clientSecret\" = 'U2FsdGVkX18YqZjG2X6dHF+/CnR042luziiJoa+0P6AyZl1WOXU8GdkF796zMUX1'
   WHERE email = 'admin@getconfirmd.com';"

   # Restart services after DB fix
   docker-compose -f docker-compose-dev.yml restart organization user api-gateway
   ```

3. **Database Connection Issues**

   ```bash
   # Check database status
   docker exec -it confirmd-platform-postgres-1 pg_isready -U postgres

   # View database logs
   docker logs confirmd-platform-postgres-1 --tail 20
   ```

4. **Service Not Starting**

   ```bash
   # Check service dependencies
   docker-compose -f docker-compose-dev.yml ps

   # Restart specific service
   docker-compose -f docker-compose-dev.yml restart [service-name]
   ```

5. **Authentication Timeout Issues**

   ```bash
   # If getting 500 errors after login, wait for all services to fully start
   sleep 30

   # Check if services are ready
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/users/profile
   # Should return 401 (unauthorized) instead of 500 when services are ready
   ```

## Development Workflow

### Adding a New Microservice:

1. **Generate the service:**

   ```bash
   nest generate app new-service
   ```

2. **Create Dockerfile:**

   ```bash
   cp Dockerfiles/Dockerfile.template Dockerfiles/Dockerfile.new-service
   # Edit the dockerfile for your service
   ```

3. **Add to docker-compose-dev.yml:**

   ```yaml
   new-service:
     build:
       context: .
       dockerfile: Dockerfiles/Dockerfile.new-service
     networks:
       - confirmd_network
     depends_on:
       - postgres
       - nats
   ```

4. **Configure NATS patterns:**
   ```typescript
   // In new-service.controller.ts
   @MessagePattern('new-service-pattern')
   async handleRequest(payload: any) {
     return this.newService.processRequest(payload);
   }
   ```

### Testing Services:

```bash
# Unit tests
npm run test [service-name]

# E2E tests
npm run test:e2e [service-name]

# Integration tests
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Monitoring and Logs

### Centralized Logging:

```bash
# View all service logs with timestamps
docker-compose -f docker-compose-dev.yml logs -f -t

# Filter by service
docker-compose -f docker-compose-dev.yml logs -f api-gateway organization
```

### Health Monitoring:

- API Gateway health: `http://localhost:5000/health`
- Individual service health endpoints available
- NATS monitoring: `http://localhost:8222`

## Performance Optimization

### Scaling Services:

```bash
# Scale specific service
docker-compose -f docker-compose-dev.yml up -d --scale organization=3

# Load balance with nginx
# Configure nginx.conf for service load balancing
```

### Resource Monitoring:

```bash
# Monitor container resources
docker stats

# Service-specific monitoring
docker stats confirmd-platform-[service-name]-1
```

## Security Considerations

### Service-to-Service Authentication:

- NATS secured with authentication
- Internal service communication via private network
- JWT token validation at API Gateway

### Environment Security:

```bash
# Encrypt sensitive environment variables
# Use Docker secrets in production
# Implement proper RBAC for service access
```

---

**Last Updated**: July 4, 2025  
**Author**: Development Team  
**Status**: ✅ Production Ready

For troubleshooting platform admin issues, see: [Platform Admin Login Guide](docs/PLATFORM_ADMIN_LOGIN_GUIDE.md)
