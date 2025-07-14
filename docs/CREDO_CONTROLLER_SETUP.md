# Credo Controller Configuration for Confirmd Platform

This directory contains the customized Credo Controller setup for the Confirmd Platform.

## Local Build

To build the local customized version:

```bash
# Build the local image
docker build -f Dockerfiles/Dockerfile.credo-controller -t confirmd-credo-controller:local .

# Test the image
docker run --rm confirmd-credo-controller:local --help
```

## ✅ WORKING CONFIGURATION - CONFIRMED FUNCTIONAL

Based on successful testing with the Confirmd Platform, here's the verified working configuration:

### Successful Agent Provisioning

The following configuration was successfully tested and is running:

**Agent ID**: `f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin`

**Working Configuration**:

```json
{
  "label": "f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin",
  "walletId": "platform-admin",
  "walletKey": "U2FsdGVkX19l6w/PpuicnGBYThBHolzF27oN0JwfWkc=",
  "walletType": "postgres",
  "walletUrl": "confirmd-platform-postgres-1:5432",
  "walletAccount": "postgres",
  "walletPassword": "postgres",
  "walletAdminAccount": "postgres",
  "walletAdminPassword": "postgres",
  "walletScheme": "DatabasePerWallet",
  "walletConnectTimeout": 30,
  "walletMaxConnections": 10,
  "walletIdleTimeout": 300,
  "endpoint": ["http://f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin:9002"],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "logLevel": 2,
  "inboundTransport": [{ "transport": "http", "port": 9002 }],
  "outboundTransport": ["http"],
  "indyLedger": [
    {
      "genesisTransactions": "https://raw.githubusercontent.com/bcgov/von-network/main/BCovrin/genesis_test",
      "indyNamespace": "bcovrin:testnet"
    }
  ],
  "webhookUrl": "http://confirmd-platform-api-gateway-1:4321/wh/f856e3a4-b09c-4356-82de-b105594eec43",
  "adminPort": 8002,
  "tenancy": true
}
```

**Successful Docker Command**:

```bash
docker run -d \
  --name "f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin" \
  --network confirmd-platform_default \
  -p 8002:8002 \
  -p 9002:9002 \
  -v /path/to/agent-config.json:/app/config.json \
  -e AFJ_REST_LOG_LEVEL=1 \
  confirmd-credo-controller:local \
  start --config /app/config.json
```

**Verified Functionality**:

- ✅ Multi-tenancy endpoint: `POST /multi-tenancy/create-tenant`
- ✅ Swagger documentation: `/docs/`
- ✅ PostgreSQL wallet storage
- ✅ Indy ledger integration
- ✅ Webhook notifications

## Configuration Options

The Credo Controller supports various configuration options:

### Required Parameters

- `--label`: Agent label/identifier
- `--wallet-id`: Database wallet identifier
- `--wallet-key`: Wallet encryption key
- `--wallet-type`: Wallet type (postgres, sqlite, etc.)
- `--wallet-url`: Database connection URL
- `--wallet-scheme`: Database scheme
- `--wallet-account`: Database username
- `--wallet-password`: Database password
- `--wallet-admin-account`: Database admin username
- `--wallet-admin-password`: Database admin password
- `--admin-port`: REST API admin port

### Optional Parameters

- `--endpoint`: Agent endpoint URLs
- `--indy-ledger`: Indy ledger configuration
- `--webhook-url`: Webhook endpoint for events
- `--tenancy`: Enable multi-tenancy support
- `--auto-accept-connections`: Auto-accept connection requests
- `--auto-accept-credentials`: Auto-accept credential offers
- `--auto-accept-proofs`: Auto-accept proof requests

## Example Usage

### Development Mode

```bash
docker run -p 3000:3000 \
  confirmd-credo-controller:local \
  start \
  --label "Confirmd-Agent" \
  --wallet-id "confirmd-wallet" \
  --wallet-key "test-key-123" \
  --wallet-type "postgres" \
  --wallet-url "postgres://localhost:5432/confirmd" \
  --wallet-scheme "DatabasePerWallet" \
  --wallet-account "postgres" \
  --wallet-password "password" \
  --wallet-admin-account "postgres" \
  --wallet-admin-password "password" \
  --admin-port 3000 \
  --endpoint "http://localhost:3000" \
  --tenancy true \
  --auto-accept-connections true
```

### Production Mode with Configuration File

Create a configuration file `credo-config.json`:

```json
{
  "label": "Confirmd-Production-Agent",
  "walletId": "confirmd-prod-wallet",
  "walletKey": "${WALLET_KEY}",
  "walletType": "postgres",
  "walletUrl": "${DATABASE_URL}",
  "walletScheme": "DatabasePerWallet",
  "walletAccount": "${DB_USER}",
  "walletPassword": "${DB_PASSWORD}",
  "walletAdminAccount": "${DB_ADMIN_USER}",
  "walletAdminPassword": "${DB_ADMIN_PASSWORD}",
  "adminPort": 3000,
  "endpoint": ["${AGENT_ENDPOINT}"],
  "tenancy": true,
  "autoAcceptConnections": false,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "webhookUrl": "${WEBHOOK_URL}",
  "indyLedger": [
    {
      "id": "bcovrin-test-net",
      "genesisUrl": "http://test.bcovrin.vonx.io/genesis"
    }
  ]
}
```

Run with config file:

```bash
docker run -p 3000:3000 \
  -v $(pwd)/credo-config.json:/app/config.json:ro \
  -e WALLET_KEY="secure-wallet-key" \
  -e DATABASE_URL="postgres://user:pass@db:5432/confirmd" \
  confirmd-credo-controller:local \
  start --config /app/config.json
```

## Integration with Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  credo-controller:
    image: confirmd-credo-controller:local
    build:
      context: .
      dockerfile: Dockerfiles/Dockerfile.credo-controller
    ports:
      - '3000:3000'
    environment:
      - WALLET_KEY=${WALLET_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - AGENT_ENDPOINT=${AGENT_ENDPOINT}
      - WEBHOOK_URL=${WEBHOOK_URL}
    command: >
      start
      --label "Confirmd-Agent"
      --wallet-id "confirmd-wallet"
      --wallet-key "${WALLET_KEY}"
      --wallet-type "postgres"
      --wallet-url "${DATABASE_URL}"
      --wallet-scheme "DatabasePerWallet"
      --wallet-account "${DB_USER}"
      --wallet-password "${DB_PASSWORD}"
      --wallet-admin-account "${DB_USER}"
      --wallet-admin-password "${DB_PASSWORD}"
      --admin-port 3000
      --endpoint "${AGENT_ENDPOINT}"
      --webhook-url "${WEBHOOK_URL}"
      --tenancy true
      --auto-accept-connections false
      --auto-accept-credentials "contentApproved"
      --auto-accept-proofs "contentApproved"
    depends_on:
      - postgres
    networks:
      - confirmd-network

  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: confirmd
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - confirmd-network

volumes:
  postgres_data:

networks:
  confirmd-network:
    driver: bridge
```

## API Endpoints

Once running, the following endpoints are available:

- `GET /health` - Health check
- `GET /connections` - List connections
- `POST /connections/create-invitation` - Create connection invitation
- `GET /credentials` - List credentials
- `POST /credentials/issue` - Issue credential
- `GET /proofs` - List proof requests
- `POST /proofs/request` - Request proof

## Customizations

The local version includes:

1. **Multi-tenancy support**: Enable multiple wallets per agent
2. **PostgreSQL integration**: Production-ready database support
3. **Webhook integration**: Real-time event notifications
4. **Health checks**: Container health monitoring
5. **Security enhancements**: Proper secrets management

## Next Steps

1. **Configure ledger networks**: Add your preferred Indy ledger networks
2. **Set up webhooks**: Configure webhook endpoints for your platform
3. **Add custom plugins**: Extend the controller with custom functionality
4. **Monitor and scale**: Set up monitoring and scaling for production use
