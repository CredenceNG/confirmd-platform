# Agent Provisioning Service Guide

## Overview

The Agent Provisioning Service is a microservice responsible for spinning up and managing credential agent instances in the ConfirmD platform. It supports multiple agent types and deployment environments, with primary focus on AFJ (Aries Framework JavaScript) agents using Credo-TS.

## Architecture

### Service Structure

```
apps/agent-provisioning/
├── AFJ/
│   ├── port-file/           # Port management files
│   ├── scripts/             # Agent deployment scripts
│   ├── agent-config/        # Generated agent configurations
│   ├── endpoints/           # Agent endpoint files
│   └── token/               # Agent authentication tokens
├── src/
│   ├── agent-provisioning.controller.ts
│   ├── agent-provisioning.service.ts
│   ├── agent-provisioning.module.ts
│   ├── interface/
│   │   └── agent-provisioning.interfaces.ts
│   └── main.ts
└── test/
```

### Core Components

#### 1. AgentProvisioningController

- **Purpose**: Handles incoming NATS messages for agent provisioning
- **Message Pattern**: `{ cmd: 'wallet-provisioning' }`
- **Method**: `walletProvision(payload: IWalletProvision)`

#### 2. AgentProvisioningService

- **Purpose**: Core business logic for agent provisioning
- **Responsibilities**:
  - Execute shell scripts for agent deployment
  - Manage agent configuration files
  - Handle different agent types (AFJ, ACA-PY)
  - File system operations for agent artifacts

#### 3. Agent Scripts

Multiple deployment scripts for different environments:

- `start_agent.sh` - Local development agent deployment
- `docker_start_agent.sh` - Docker-based agent deployment
- `start_agent_ecs.sh` - AWS ECS deployment
- `fargate.sh` - AWS Fargate deployment
- `on_premises_agent.sh` - On-premises deployment

## Agent Types and Deployment Modes

### Supported Agent Types

#### 1. AFJ (Aries Framework JavaScript) - Primary Support

- **Framework**: Credo-TS (formerly AFJ)
- **Container**: Docker-based deployment
- **Configuration**: JSON-based agent configuration
- **Protocols**: DIDComm v1, v2 support

#### 2. ACA-PY (Aries Cloud Agent Python) - Future Support

- **Status**: TODO - Not yet implemented
- **Framework**: Hyperledger Aries Cloud Agent Python

### Deployment Environments

#### 1. Local Development

- **Script**: `start_agent.sh`
- **Use Case**: Development and testing
- **Requirements**: Docker, local PostgreSQL

#### 2. Docker Deployment

- **Script**: `docker_start_agent.sh`
- **Use Case**: Containerized local deployment
- **Output**: Docker Compose files

#### 3. AWS ECS Deployment

- **Script**: `start_agent_ecs.sh`
- **Use Case**: Production AWS deployment
- **Requirements**: ECS cluster, task definitions

#### 4. AWS Fargate Deployment

- **Script**: `fargate.sh`
- **Use Case**: Serverless container deployment
- **Requirements**: Fargate cluster, ALB, EFS

#### 5. On-Premises Deployment

- **Script**: `on_premises_agent.sh`
- **Use Case**: Self-hosted environments
- **Features**: Interactive configuration prompts

## Environment Variables and Configuration

### Core Environment Variables

#### Agent Provisioning Service

```bash
# NATS Configuration
AGENT_PROVISIONING_NKEY_SEED=                    # NATS authentication seed

# Agent Scripts and Paths
AFJ_AGENT_SPIN_UP=                               # Path to agent spin-up script
AFJ_AGENT_ENDPOINT_PATH=                         # Path for agent endpoint files
AFJ_AGENT_TOKEN_PATH=                            # Path for agent token files

# External Services
SCHEMA_FILE_SERVER_URL=                          # Schema file server URL
AGENT_HOST=                                      # Agent host configuration
```

#### AWS Configuration (for cloud deployments)

```bash
# AWS Account and Resources
AWS_ACCOUNT_ID=                                  # AWS account ID
S3_BUCKET_ARN=                                   # S3 bucket for agent artifacts
CLUSTER_NAME=                                    # ECS/Fargate cluster name
TESKDEFINITION_FAMILY=                           # ECS task definition family

# VPC and Networking (Fargate)
VPC_ID=                                          # VPC ID for Fargate deployment
ECS_SUBNET_ID=                                   # Subnet for ECS tasks
ALB_SUBNET_ID_ONE=                               # ALB subnet 1
ALB_SUBNET_ID_TWO=                               # ALB subnet 2
EFS_SECURITY_GROUP_ID=                           # EFS security group
DB_SECURITY_GROUP_ID=                            # Database security group

# EFS Configuration
FILESYSTEMID=                                    # EFS file system ID
ACCESSPOINTID=                                   # EFS access point ID

# Load Balancer
ALB_SECURITY_GROUP_ID=                           # ALB security group
ADMIN_TG_ARN=                                    # Admin target group ARN
INBOUND_TG_ARN=                                  # Inbound target group ARN

# Regions and Staging
AWS_PUBLIC_REGION=                               # AWS region
STAGE=                                           # Deployment stage (dev/prod)
```

#### Agent Configuration

```bash
# Protocols and Endpoints
AGENT_WEBSOCKET_PROTOCOL=                        # WebSocket protocol (ws/wss)
AGENT_URL=                                       # Base agent URL
AGENT_INBOUND_URL=                               # Agent inbound endpoint URL
```

## Required External Dependencies

### 1. Docker Environment

- **Requirement**: Docker Engine installed and running
- **Purpose**: Container deployment for agents
- **Version**: Docker Compose v3 support required

### 2. PostgreSQL Database

- **Requirement**: PostgreSQL instance for wallet storage
- **Configuration**:
  - Host: `walletStorageHost`
  - Port: `walletStoragePort`
  - User: `walletStorageUser`
  - Password: `walletStoragePassword`

### 3. NATS Message Broker

- **Requirement**: NATS server for microservice communication
- **Configuration**: Configured via `getNatsOptions()`
- **Security**: NKEY-based authentication

### 4. AWS Services (for cloud deployment)

- **ECS/Fargate**: Container orchestration
- **VPC**: Network isolation
- **EFS**: Shared file system for agent configurations
- **ALB**: Load balancing for agent endpoints
- **S3**: Artifact storage

### 5. Indy Ledger Networks

Supported ledger networks:

- **No ledger**: For testing without blockchain
- **Polygon**: Polygon blockchain
- **bcovrin:testnet**: BCovrin test network
- **indicio:testnet**: Indicio test network
- **indicio:demonet**: Indicio demo network
- **indicio:mainnet**: Indicio main network

## Agent Provisioning Process

### 1. Request Flow

```typescript
interface IWalletProvision {
  orgId: string; // Organization ID
  externalIp: string; // External IP for agent
  walletName: string; // Wallet identifier
  walletPassword: string; // Wallet encryption password
  seed: string; // Cryptographic seed
  webhookEndpoint: string; // Webhook URL for agent events
  walletStorageHost: string; // Database host
  walletStoragePort: string; // Database port
  walletStorageUser: string; // Database user
  walletStoragePassword: string; // Database password
  containerName: string; // Container identifier
  agentType: AgentType; // AFJ or ACAPY
  protocol: string; // Communication protocol
  credoImage: string; // Docker image for Credo-TS
  tenant: boolean; // Multi-tenancy support
  inboundEndpoint: string; // Agent inbound endpoint
  indyLedger: string; // Ledger configuration
}
```

### 2. Port Management

- **Admin Port**: Starting from 8001, auto-incremented
- **Inbound Port**: Starting from 9001, auto-incremented
- **Port Files**:
  - `last-admin-port.txt`: Tracks last used admin port
  - `last-inbound-port.txt`: Tracks last used inbound port

### 3. Configuration Generation

#### Agent Configuration File

```json
{
  "label": "Agent Label",
  "walletConfig": {
    "id": "wallet_id",
    "key": "wallet_password",
    "storage": {
      "type": "postgres_storage",
      "config": {
        "url": "postgresql://user:pass@host:port/db"
      }
    }
  },
  "endpoints": ["http://external_ip:inbound_port"],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "logger": {
    "level": "info"
  },
  "indyLedgers": [...],
  "webhookUrl": "webhook_endpoint"
}
```

#### Docker Compose Generation

- **Service Definition**: Agent container configuration
- **Volume Mounts**: Persistent storage for agent data
- **Network Configuration**: Port mappings and networking
- **Environment Variables**: Runtime configuration

### 4. Deployment Execution

#### Script Execution Flow

1. **Port Allocation**: Determine available ports
2. **Configuration Generation**: Create agent config files
3. **Container Deployment**: Execute deployment scripts
4. **Endpoint Registration**: Save agent endpoints
5. **Token Generation**: Create authentication tokens

#### File Artifacts Created

- **Agent Config**: `{orgId}_{containerName}.json`
- **Endpoint File**: Contains agent admin endpoint
- **Token File**: Contains agent authentication token
- **Docker Compose**: Container orchestration file

## API Interface

### NATS Message Pattern

#### Request

```typescript
// Message Pattern
{ cmd: 'wallet-provisioning' }

// Payload
{
  orgId: "org-uuid",
  externalIp: "192.168.1.100",
  walletName: "org-wallet",
  walletPassword: "secure-password",
  seed: "000000000000000000000000000000000000000000000000",
  webhookEndpoint: "https://api.platform.com/webhooks",
  walletStorageHost: "postgres.internal",
  walletStoragePort: "5432",
  walletStorageUser: "wallet_user",
  walletStoragePassword: "db_password",
  containerName: "agent-container",
  agentType: "AFJ",
  protocol: "https",
  credoImage: "ghcr.io/hyperledger/credo-ts:latest",
  tenant: false,
  inboundEndpoint: "https://agent.platform.com",
  indyLedger: "[\"indicio:testnet\"]"
}
```

#### Response

```typescript
{
  agentEndPoint: "http://192.168.1.100:8001",  // Admin API endpoint
  agentToken: "bearer-token-string"            // Authentication token
}
```

## Error Handling and Troubleshooting

### Common Issues

#### 1. Port Conflicts

- **Symptom**: Agent fails to start with port binding errors
- **Solution**: Check port availability and restart with different ports
- **Prevention**: Proper port file management and cleanup

#### 2. Database Connection Failures

- **Symptom**: Wallet storage errors during agent startup
- **Solution**: Verify PostgreSQL connectivity and credentials
- **Debug**: Check network connectivity and database logs

#### 3. Script Execution Failures

- **Symptom**: Shell script errors in agent provisioning
- **Solution**: Verify script permissions and dependencies
- **Debug**: Check script output in service logs

#### 4. Configuration File Issues

- **Symptom**: Agent fails to start with configuration errors
- **Solution**: Validate JSON configuration syntax
- **Debug**: Check generated configuration files

### Logging and Monitoring

#### Service Logs

```typescript
// Key log patterns
this.logger.log(`shell script output: ${stdout}`);
this.logger.log(`shell script error: ${stderr}`);
this.logger.error(`[walletProvision] - error in wallet provision: ${JSON.stringify(error)}`);
```

#### File System Checks

- **Endpoint Files**: Verify agent endpoint file creation
- **Token Files**: Confirm authentication token generation
- **Configuration Files**: Validate agent configuration syntax

## Security Considerations

### 1. Wallet Security

- **Encryption**: Wallet passwords used for encryption at rest
- **Seeds**: Cryptographic seeds for deterministic key generation
- **Storage**: Secure PostgreSQL storage with proper access controls

### 2. Network Security

- **Endpoints**: Proper firewall configuration for agent ports
- **TLS**: HTTPS/WSS protocols for production deployments
- **Authentication**: Token-based authentication for agent APIs

### 3. Container Security

- **Images**: Use trusted Credo-TS images
- **Isolation**: Proper container isolation and resource limits
- **Secrets**: Secure handling of database credentials and tokens

## Performance and Scaling

### 1. Resource Requirements

- **CPU**: Moderate CPU requirements per agent
- **Memory**: ~512MB-1GB per agent instance
- **Storage**: PostgreSQL storage for wallet data
- **Network**: Bandwidth for DIDComm message processing

### 2. Scaling Strategies

- **Horizontal**: Multiple agent instances per organization
- **Load Balancing**: ALB for traffic distribution (cloud deployments)
- **Database**: Separate databases per tenant/organization
- **Caching**: Redis caching for frequently accessed data

### 3. Monitoring Metrics

- **Agent Health**: Admin API health checks
- **Response Times**: Agent provisioning duration
- **Resource Usage**: Container CPU/memory utilization
- **Error Rates**: Failed provisioning attempts

## Development and Testing

### 1. Local Development Setup

```bash
# Prerequisites
docker --version
docker-compose --version
psql --version

# Environment setup
export AFJ_AGENT_SPIN_UP="/apps/agent-provisioning/AFJ/scripts/start_agent.sh"
export AFJ_AGENT_ENDPOINT_PATH="/apps/agent-provisioning/AFJ/endpoints/"
export AFJ_AGENT_TOKEN_PATH="/apps/agent-provisioning/AFJ/token/"

# Start local PostgreSQL
docker run -d --name postgres-wallet \
  -e POSTGRES_DB=wallets \
  -e POSTGRES_USER=wallet_user \
  -e POSTGRES_PASSWORD=wallet_pass \
  -p 5432:5432 postgres:13
```

### 2. Testing Agent Provisioning

```typescript
// Test payload
const testPayload: IWalletProvision = {
  orgId: 'test-org-001',
  externalIp: '127.0.0.1',
  walletName: 'test-wallet',
  walletPassword: 'test-password',
  seed: '000000000000000000000000000000000000000000000000',
  webhookEndpoint: 'http://localhost:3000/webhooks',
  walletStorageHost: 'localhost',
  walletStoragePort: '5432',
  walletStorageUser: 'wallet_user',
  walletStoragePassword: 'wallet_pass',
  containerName: 'test-agent',
  agentType: AgentType.AFJ,
  protocol: 'http',
  credoImage: 'ghcr.io/hyperledger/credo-ts:latest',
  tenant: false,
  inboundEndpoint: 'http://localhost:9001',
  indyLedger: '[]'
};
```

## Future Enhancements

### 1. ACA-PY Support

- Complete ACA-PY agent implementation
- Python-based agent deployment scripts
- ACA-PY specific configuration management

### 2. Enhanced Monitoring

- Prometheus metrics integration
- Health check endpoints
- Performance monitoring dashboards

### 3. Multi-Tenancy

- Enhanced tenant isolation
- Per-tenant resource management
- Tenant-specific configuration options

### 4. Auto-Scaling

- Dynamic agent scaling based on load
- Container orchestration improvements
- Resource optimization algorithms

---

_Last Updated: July 7, 2025_
_Version: 1.0_
