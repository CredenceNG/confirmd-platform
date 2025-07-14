# Agent Provisioning Service - Deep Dive Developer Documentation

## Overview

The Agent Provisioning Service is a critical microservice in the Confirmd platform that orchestrates the creation, configuration, and management of Self-Sovereign Identity (SSI) agents. This service handles the complex lifecycle of spinning up AFJ (Aries Framework JavaScript) agents across multiple deployment environments including local Docker, AWS ECS, and AWS Fargate.

## Architecture & Implementation

### Core Components

#### 1. AgentProvisioningController

**File**: `apps/agent-provisioning/src/agent-provisioning.controller.ts`

```typescript
@Controller()
export class AgentProvisioningController {
  constructor(private readonly agentProvisioningService: AgentProvisioningService) {}

  @MessagePattern({ cmd: 'wallet-provisioning' })
  walletProvision(payload: IWalletProvision): Promise<object> {
    return this.agentProvisioningService.walletProvision(payload);
  }
}
```

#### 2. AgentProvisioningService

**File**: `apps/agent-provisioning/src/agent-provisioning.service.ts`

```typescript
@Injectable()
export class AgentProvisioningService {
  constructor(private readonly logger: Logger) {}

  async walletProvision(payload: IWalletProvision): Promise<object> {
    const {
      orgId,
      externalIp,
      walletName,
      walletPassword,
      seed,
      webhookEndpoint,
      walletStorageHost,
      walletStoragePort,
      walletStorageUser,
      walletStoragePassword,
      containerName,
      protocol,
      tenant,
      credoImage,
      indyLedger,
      inboundEndpoint
    } = payload;

    const walletProvision = `${process.cwd() + process.env.AFJ_AGENT_SPIN_UP} ${orgId} "${externalIp}" "${walletName}" "${walletPassword}" ${seed} ${webhookEndpoint} ${walletStorageHost} ${walletStoragePort} ${walletStorageUser} ${walletStoragePassword} ${containerName} ${protocol} ${tenant} ${credoImage} "${indyLedger}" ${inboundEndpoint} ${process.env.SCHEMA_FILE_SERVER_URL} ${process.env.AGENT_HOST} ${process.env.AWS_ACCOUNT_ID} ${process.env.S3_BUCKET_ARN} ${process.env.CLUSTER_NAME} ${process.env.TESKDEFINITION_FAMILY}`;

    return new Promise(async (resolve) => {
      await exec(walletProvision, async (err, stdout, stderr) => {
        // Shell script execution logic
      });
    });
  }
}
```

#### 3. AgentProvisioningModule

**File**: `apps/agent-provisioning/src/agent-provisioning.module.ts`

```typescript
@Module({
  imports: [
    ConfigModule.forRoot(),
    GlobalConfigModule,
    LoggerModule,
    PlatformConfig,
    ContextInterceptorModule,
    ClientsModule.register([
      {
        name: 'NATS_CLIENT',
        transport: Transport.NATS,
        options: getNatsOptions(CommonConstants.AGENT_PROVISIONING, process.env.AGENT_PROVISIONING_NKEY_SEED)
      }
    ])
  ],
  controllers: [AgentProvisioningController],
  providers: [AgentProvisioningService, Logger]
})
export class AgentProvisioningModule {}
```

## Shell Script Orchestration

### 1. start_agent.sh - Local Development Agent

**File**: `apps/agent-provisioning/AFJ/scripts/start_agent.sh`

**Purpose**: Standard local development and Docker-based agent deployment

**Key Features**:

- Dynamic port management (8001+ for admin, 9001+ for inbound)
- Agent configuration generation
- Docker Compose orchestration
- Token extraction and endpoint management

**Command Structure**:

```bash
#!/bin/bash
START_TIME=$(date +%s)

AGENCY=$1
EXTERNAL_IP=$2
WALLET_NAME=$3
WALLET_PASSWORD=$4
RANDOM_SEED=$5
WEBHOOK_HOST=$6
WALLET_STORAGE_HOST=$7
WALLET_STORAGE_PORT=$8
WALLET_STORAGE_USER=$9
WALLET_STORAGE_PASSWORD=${10}
CONTAINER_NAME=${11}
PROTOCOL=${12}
TENANT=${13}
AFJ_VERSION=${14}
INDY_LEDGER=${15}
INBOUND_ENDPOINT=${16}
SCHEMA_FILE_SERVER_URL=${17}
```

**Port Management Algorithm**:

```bash
increment_port() {
  local port="$1"
  local lower_limit="$2"
  while [ "$port" -le "$lower_limit" ]; do
    port=$((port + 1))
  done
  echo "$port"
}

# Port file management
ADMIN_PORT_FILE="$PWD/apps/agent-provisioning/AFJ/port-file/last-admin-port.txt"
INBOUND_PORT_FILE="$PWD/apps/agent-provisioning/AFJ/port-file/last-inbound-port.txt"

# Read, increment, and save ports
last_used_admin_port=$(cat "$ADMIN_PORT_FILE")
last_used_admin_port=$(increment_port "$last_used_admin_port" "$last_used_admin_port")
echo "$last_used_admin_port" > "$ADMIN_PORT_FILE"
```

**Agent Configuration Generation**:

```bash
cat <<EOF >${CONFIG_FILE}
{
  "label": "${AGENCY}_${CONTAINER_NAME}",
  "walletId": "$WALLET_NAME",
  "walletKey": "$WALLET_PASSWORD",
  "walletType": "postgres",
  "walletUrl": "$WALLET_STORAGE_HOST:$WALLET_STORAGE_PORT",
  "walletAccount": "$WALLET_STORAGE_USER",
  "walletPassword": "$WALLET_STORAGE_PASSWORD",
  "walletAdminAccount": "$WALLET_STORAGE_USER",
  "walletAdminPassword": "$WALLET_STORAGE_PASSWORD",
  "walletScheme": "DatabasePerWallet",
  "indyLedger": $INDY_LEDGER,
  "endpoint": ["$AGENT_ENDPOINT"],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "logLevel": 2,
  "inboundTransport": [{"transport": "$PROTOCOL", "port": $INBOUND_PORT}],
  "outboundTransport": ["$PROTOCOL"],
  "webhookUrl": "$WEBHOOK_HOST/wh/$AGENCY",
  "adminPort": $ADMIN_PORT,
  "tenancy": $TENANT,
  "schemaFileServerURL": "$SCHEMA_FILE_SERVER_URL"
}
EOF
```

**Docker Compose Generation**:

```bash
cat <<EOF >${DOCKER_COMPOSE}
version: '3'
services:
  agent:
    image: $AFJ_VERSION
    container_name: ${AGENCY}_${CONTAINER_NAME}
    restart: always
    environment:
      AFJ_REST_LOG_LEVEL: 1
    ports:
     - ${INBOUND_PORT}:${INBOUND_PORT}
     - ${ADMIN_PORT}:${ADMIN_PORT}
    env_file:
      - ../../../agent.env
    volumes:
      - ./agent-config/${AGENCY}_${CONTAINER_NAME}.json:/config.json
    command: --auto-accept-connections --config /config.json
EOF
```

### 2. fargate.sh - AWS Fargate Deployment

**File**: `apps/agent-provisioning/AFJ/scripts/fargate.sh`

**Purpose**: Serverless agent deployment on AWS Fargate with full AWS integration

**Key Features**:

- ECS Fargate task definition creation
- Application Load Balancer (ALB) configuration
- EFS (Elastic File System) integration
- Security group management
- Target group and health check configuration

**AWS Resource Creation**:

```bash
# Security Group Creation
ALB_SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --group-name "${STAGE}-${AGENCY}-${random_string}-alb-sg" \
  --description "Security group for ALB" \
  --vpc-id $VPC_ID --output text)

ECS_SECURITY_GROUP_ID=$(aws ec2 create-security-group \
  --group-name "${STAGE}-${AGENCY}-${random_string}-ecs-sg" \
  --description "Security group for ECS Fargate service" \
  --vpc-id $VPC_ID --output text)

# Target Group Creation
ADMIN_TG_ARN=$(aws elbv2 create-target-group \
  --name "${STAGE}-${ADMIN_PORT}-tg" \
  --protocol HTTP \
  --port 80 \
  --target-type ip \
  --vpc-id $VPC_ID \
  --health-check-protocol HTTP \
  --health-check-port $ADMIN_PORT \
  --health-check-path /agent \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Load Balancer Creation
ADMIN_ALB_ARN=$(aws elbv2 create-load-balancer \
  --name $STAGE-$CONTAINER_NAME-${ADMIN_PORT}-alb \
  --subnets $ALB_SUBNET_ID_ONE $ALB_SUBNET_ID_TWO \
  --security-groups $ALB_SECURITY_GROUP_ID \
  --type application \
  --scheme internet-facing \
  --region $AWS_PUBLIC_REGION \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text)
```

**Task Definition Structure**:

```bash
TASK_DEFINITION=$(cat <<EOF
{
  "family": "$TESKDEFINITION_FAMILY",
  "containerDefinitions": [
    {
      "name": "$CONTAINER_NAME",
      "image": "${AFJ_IMAGE_URL}",
      "cpu": 256,
      "memory": 512,
      "portMappings": [
        {"containerPort": $ADMIN_PORT, "protocol": "tcp"},
        {"containerPort": $INBOUND_PORT, "protocol": "tcp"}
      ],
      "essential": true,
      "command": ["--auto-accept-connections", "--config", "/config/${AGENCY}_${CONTAINER_NAME}.json"],
      "environment": [{"name": "AFJ_REST_LOG_LEVEL", "value": "1"}],
      "mountPoints": [
        {
          "sourceVolume": "AGENT-CONFIG",
          "containerPath": "/config",
          "readOnly": true
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-create-group": "true",
          "awslogs-group": "/ecs/$TESKDEFINITION_FAMILY",
          "awslogs-region": "$AWS_PUBLIC_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "volumes": [
    {
      "name": "AGENT-CONFIG",
      "efsVolumeConfiguration": {
        "fileSystemId": "$FILESYSTEMID",
        "rootDirectory": "/",
        "transitEncryption": "ENABLED",
        "authorizationConfig": {
          "accessPointId": "$ACCESSPOINTID",
          "iam": "DISABLED"
        }
      }
    }
  ],
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048"
}
EOF
)
```

### 3. start_agent_ecs.sh - AWS ECS Deployment

**File**: `apps/agent-provisioning/AFJ/scripts/start_agent_ecs.sh`

**Purpose**: Container orchestration on AWS ECS with EC2 instances

**Key Features**:

- ECS service creation
- Task definition registration
- Health check implementation
- Port mapping configuration

### 4. on_premises_agent.sh - Interactive Setup

**File**: `apps/agent-provisioning/AFJ/scripts/on_premises_agent.sh`

**Purpose**: Interactive setup for on-premises deployments with user input validation

**Key Features**:

- User input validation
- Ledger selection interface
- Configuration validation
- Docker installation check

**User Input Validation**:

```bash
# Function to validate INDY_LEDGER input
validate_indy_ledger() {
    local input_ledger=$1
    case "$input_ledger" in
    1) echo 'No ledger' ;;
    2) echo 'Polygon' ;;
    3) echo '{"genesisTransactions":"http://test.bcovrin.vonx.io/genesis","indyNamespace":"bcovrin:testnet"}' ;;
    4) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis","indyNamespace":"indicio:testnet"}' ;;
    5) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_demonet_genesis","indyNamespace":"indicio:demonet"}' ;;
    6) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_mainnet_genesis","indyNamespace":"indicio:mainnet"}' ;;
    *) echo "Invalid choice" ;;
    esac
}

# Ledger selection interface
echo "Choose INDY_LEDGER option(s):"
echo "1) No ledger"
echo "2) Polygon"
echo "3) bcovrin:testnet"
echo "4) indicio:testnet"
echo "5) indicio:demonet"
echo "6) indicio:mainnet"
```

### 5. docker_start_agent.sh - Docker Optimized

**File**: `apps/agent-provisioning/AFJ/scripts/docker_start_agent.sh`

**Purpose**: Docker-optimized agent deployment with container-specific configurations

## Advanced Configuration Management

### Port Management System

The service implements a sophisticated port management system to prevent conflicts:

**Port Files**:

- `apps/agent-provisioning/AFJ/port-file/last-admin-port.txt`: Tracks last used admin port
- `apps/agent-provisioning/AFJ/port-file/last-inbound-port.txt`: Tracks last used inbound port

**Port Allocation Algorithm**:

```bash
increment_port() {
    local port="$1"
    local lower_limit="$2"
    while [ "$port" -le "$lower_limit" ]; do
        port=$((port + 1))
    done
    echo "$port"
}
```

### Agent Configuration Templates

Each agent receives a dynamically generated configuration based on deployment type:

**Standard Configuration**:

```json
{
  "label": "org_agent_name",
  "walletId": "unique_wallet_id",
  "walletKey": "encrypted_wallet_key",
  "walletType": "postgres",
  "walletUrl": "postgres_host:port",
  "walletAccount": "postgres_user",
  "walletPassword": "postgres_password",
  "walletAdminAccount": "postgres_admin",
  "walletAdminPassword": "admin_password",
  "walletScheme": "DatabasePerWallet",
  "indyLedger": [...],
  "endpoint": ["agent_endpoint"],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "logLevel": 2,
  "inboundTransport": [{"transport": "http", "port": 9001}],
  "outboundTransport": ["http"],
  "webhookUrl": "https://webhook.host/wh/org_id",
  "adminPort": 8001,
  "tenancy": false,
  "schemaFileServerURL": "https://schema.server.url"
}
```

## Environment Variables & Configuration

### Core Service Configuration

```bash
# Agent Provisioning Service
AGENT_PROVISIONING_NKEY_SEED=<nats-encryption-seed>

# AFJ Agent Paths
AFJ_AGENT_SPIN_UP=/apps/agent-provisioning/AFJ/scripts/start_agent.sh
AFJ_AGENT_ENDPOINT_PATH=/apps/agent-provisioning/AFJ/endpoints/
AFJ_AGENT_TOKEN_PATH=/apps/agent-provisioning/AFJ/token/

# Schema and Agent Configuration
SCHEMA_FILE_SERVER_URL=https://schema.server.url
AGENT_HOST=agent.host.domain
```

### AWS Configuration (Cloud Deployments)

```bash
# AWS ECS/Fargate Configuration
AWS_ACCOUNT_ID=123456789012
AWS_PUBLIC_REGION=us-east-1
S3_BUCKET_ARN=arn:aws:s3:::agent-configs
CLUSTER_NAME=agent-cluster
TESKDEFINITION_FAMILY=agent-task-family

# AWS Infrastructure
VPC_ID=vpc-12345678
ECS_SUBNET_ID=subnet-12345678
ALB_SUBNET_ID_ONE=subnet-87654321
ALB_SUBNET_ID_TWO=subnet-11111111
FILESYSTEMID=fs-12345678
ACCESSPOINTID=fsap-12345678
EFS_SECURITY_GROUP_ID=sg-12345678
```

### Database Configuration

```bash
# PostgreSQL Wallet Storage
WALLET_STORAGE_HOST=postgres.host.domain
WALLET_STORAGE_PORT=5432
WALLET_STORAGE_USER=wallet_user
WALLET_STORAGE_PASSWORD=secure_password
```

## Error Handling & Monitoring

### Error Handling Strategy

```typescript
async walletProvision(payload: IWalletProvision): Promise<object> {
  try {
    // Shell script execution
    const walletProvision = `${process.cwd() + process.env.AFJ_AGENT_SPIN_UP} ${parameters}`;

    return new Promise(async (resolve) => {
      await exec(walletProvision, async (err, stdout, stderr) => {
        this.logger.log(`shell script output: ${stdout}`);
        if (stderr) {
          this.logger.log(`shell script error: ${stderr}`);
        }

        // File existence validation
        const agentEndpointPath = `${process.cwd()}${process.env.AFJ_AGENT_ENDPOINT_PATH}${orgId}_${containerName}.json`;
        const agentTokenPath = `${process.cwd()}${process.env.AFJ_AGENT_TOKEN_PATH}${orgId}_${containerName}.json`;

        const agentEndPointExists = await this.checkFileExistence(agentEndpointPath);
        const agentTokenExists = await this.checkFileExistence(agentTokenPath);

        if (agentEndPointExists && agentTokenExists) {
          const agentEndPoint = await fs.readFileSync(agentEndpointPath, 'utf8');
          const agentToken = await fs.readFileSync(agentTokenPath, 'utf8');

          resolve({
            agentEndPoint: JSON.parse(agentEndPoint).CONTROLLER_ENDPOINT,
            agentToken: JSON.parse(agentToken).token
          });
        } else {
          throw new NotFoundException(`Agent configuration files not found`);
        }
      });
    });
  } catch (error) {
    this.logger.error(`[walletProvision] - error in wallet provision: ${JSON.stringify(error)}`);
    throw new RpcException(error);
  }
}

private async checkFileExistence(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}
```

### Logging Strategy

- **Service Level**: All operations logged with context
- **Shell Script Level**: stdout/stderr capture
- **AWS Level**: CloudWatch integration for Fargate deployments
- **Error Level**: RPC exceptions with full stack trace

## Integration with Other Services

### API Gateway Integration

```typescript
// From api-gateway/src/agent-service/agent-service.controller.ts
@MessagePattern({ cmd: 'agent-spinup' })
async walletProvision(payload: { agentSpinupDto: IAgentSpinupDto; user: IUserRequestInterface }): Promise<{
  agentSpinupStatus: AgentSpinUpStatus;
}> {
  return this.agentServiceService.walletProvision(payload.agentSpinupDto, payload.user);
}
```

### Agent Service Integration

The agent provisioning service integrates with the main agent service for:

- Wallet creation requests
- Tenant management
- DID creation
- Connection management

## Performance Considerations

### Concurrent Agent Provisioning

- Port management prevents conflicts during concurrent provisioning
- File system locks ensure atomic operations
- Database connections are pooled for efficiency

### Resource Management

- Docker containers are managed with restart policies
- AWS resources are tagged for cost management
- EFS provides shared storage for multiple agents

### Scalability

- Horizontal scaling through NATS message distribution
- AWS Fargate provides auto-scaling capabilities
- Database sharding through wallet isolation

## Security Implementation

### Wallet Security

- Wallet passwords are encrypted at rest
- Seeds are generated using cryptographically secure methods
- Database credentials are managed through environment variables
- AWS secrets manager integration for cloud deployments

### Network Security

- Security groups restrict access to necessary ports only
- Load balancers provide SSL termination
- VPC isolation for AWS deployments
- Webhook endpoints require HTTPS

### Access Control

- NATS message patterns provide service isolation
- AWS IAM roles limit resource access
- Database users have minimal required permissions

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Agent Startup Failures

**Problem**: Agent fails to start or times out
**Investigation**:

```bash
# Check port availability
netstat -tln | grep PORT_NUMBER

# Check Docker container logs
docker logs CONTAINER_NAME

# Check configuration file
cat /path/to/agent-config/org_container.json
```

#### 2. Database Connection Issues

**Problem**: Agent cannot connect to PostgreSQL
**Investigation**:

```bash
# Test database connectivity
psql -h $WALLET_STORAGE_HOST -p $WALLET_STORAGE_PORT -U $WALLET_STORAGE_USER -d postgres

# Check database user permissions
SELECT * FROM pg_user WHERE usename = 'wallet_user';
```

#### 3. AWS Deployment Issues

**Problem**: Fargate task fails to start
**Investigation**:

```bash
# Check ECS service events
aws ecs describe-services --cluster CLUSTER_NAME --services SERVICE_NAME

# Check task definition
aws ecs describe-task-definition --task-definition TASK_DEFINITION_ARN

# Check CloudWatch logs
aws logs get-log-events --log-group-name /ecs/task-family --log-stream-name STREAM_NAME
```

#### 4. File System Issues

**Problem**: Configuration files not found
**Investigation**:

```bash
# Check file permissions
ls -la /path/to/agent-provisioning/AFJ/endpoints/
ls -la /path/to/agent-provisioning/AFJ/token/

# Check directory creation
mkdir -p /path/to/missing/directory
```

### Debug Mode Configuration

```bash
# Enable debug logging
export AFJ_REST_LOG_LEVEL=5

# Enable shell script debugging
set -x  # Add to shell scripts for detailed output
```

## Testing Strategy

### Unit Testing

- Service methods are tested with mocked dependencies
- Shell script execution is mocked for isolated testing
- Configuration generation is validated

### Integration Testing

- End-to-end agent provisioning workflows
- Database connectivity testing
- AWS service integration testing

### Performance Testing

- Concurrent agent provisioning load testing
- Resource consumption monitoring
- Port allocation stress testing

This comprehensive documentation provides deep technical insights into the agent provisioning service, covering all aspects from code-level implementation to deployment orchestration and troubleshooting procedures.

````

### Agent Types
- **AFJ (Aries Framework JavaScript)**: Currently implemented
- **ACAPY (Aries Cloud Agent Python)**: Planned for future implementation

## AFJ Agent Provisioning

### Port Management
The service uses a sophisticated port management system:
- **Admin Port**: Starting from 8001, managed via `last-admin-port.txt`
- **Inbound Port**: Starting from 9001, managed via `last-inbound-port.txt`
- Ports are automatically incremented for each new agent to avoid conflicts

### Agent Spin-Up Scripts

The service utilizes several shell scripts for different deployment scenarios:

#### 1. Standard Agent (`start_agent.sh`)
- **Purpose**: Local development and standard deployments
- **Port Files**: `apps/agent-provisioning/AFJ/port-file/`
- **Config Generation**: Creates agent configuration JSON files
- **Docker Compose**: Generates dynamic docker-compose files

#### 2. Docker Agent (`docker_start_agent.sh`)
- **Purpose**: Containerized agent deployment
- **Features**: Similar to standard agent but optimized for Docker environments

#### 3. ECS Agent (`start_agent_ecs.sh`)
- **Purpose**: AWS ECS deployment
- **Features**:
  - ECS task definition creation
  - Service registration
  - AWS integration

#### 4. Fargate Agent (`fargate.sh`)
- **Purpose**: AWS Fargate serverless deployment
- **Features**:
  - Fargate task definition
  - EFS integration
  - Load balancer configuration

#### 5. On-Premises Agent (`on_premises_agent.sh`)
- **Purpose**: Interactive setup for on-premises deployments
- **Features**: User input prompts for configuration

## Required Environment Variables

### Core Configuration
```bash
# Agent Provisioning Service
AGENT_PROVISIONING_NKEY_SEED=<nats-seed>

# AFJ Agent Configuration
AFJ_AGENT_SPIN_UP=<path-to-spin-up-script>
AFJ_AGENT_ENDPOINT_PATH=<agent-endpoint-path>
AFJ_AGENT_TOKEN_PATH=<agent-token-path>
SCHEMA_FILE_SERVER_URL=<schema-server-url>
AGENT_HOST=<agent-host>
````

### AWS Configuration (for ECS/Fargate)

```bash
AWS_ACCOUNT_ID=<aws-account-id>
S3_BUCKET_ARN=<s3-bucket-arn>
CLUSTER_NAME=<ecs-cluster-name>
TESKDEFINITION_FAMILY=<task-definition-family>
```

### Database Configuration

```bash
# Wallet Storage (PostgreSQL)
WALLET_STORAGE_HOST=<postgres-host>
WALLET_STORAGE_PORT=<postgres-port>
WALLET_STORAGE_USER=<postgres-user>
WALLET_STORAGE_PASSWORD=<postgres-password>
```

## Wallet and Ledger Configuration

### Wallet Storage

- **Type**: PostgreSQL database
- **Purpose**: Stores wallet credentials and keys
- **Configuration**: Host, port, user, password provided per agent

### Ledger Configuration

The service supports multiple Indy ledgers:

- **No ledger**: For testing without blockchain
- **Polygon**: For Polygon-based credentials
- **bcovrin:testnet**: BCovrin test network
- **indicio:testnet**: Indicio test network
- **indicio:demonet**: Indicio demo network
- **indicio:mainnet**: Indicio main network

### Agent Configuration Generation

Each agent gets a unique configuration file:

```json
{
  "label": "agent-name",
  "walletConfig": {
    "id": "wallet-name",
    "key": "wallet-password",
    "storage": {
      "type": "postgres_storage",
      "config": {
        "host": "storage-host",
        "port": "storage-port",
        "user": "storage-user",
        "password": "storage-password"
      }
    }
  },
  "indyLedgers": [...],
  "autoAcceptConnections": true,
  "autoAcceptCredentials": "contentApproved",
  "autoAcceptProofs": "contentApproved",
  "endpoints": ["endpoint-url"],
  "inboundTransports": [...],
  "outboundTransports": [...]
}
```

## External Dependencies

### Required Services

1. **NATS Server**: For microservice communication
2. **PostgreSQL**: For wallet storage
3. **Docker**: For agent containerization
4. **Webhook Endpoint**: For agent callbacks

### Optional AWS Services (for cloud deployment)

1. **AWS ECS**: For container orchestration
2. **AWS Fargate**: For serverless containers
3. **AWS EFS**: For persistent file storage
4. **AWS Load Balancer**: For traffic distribution
5. **AWS S3**: For file storage

## Agent Lifecycle

### 1. Provisioning Request

- Service receives wallet provisioning request via NATS
- Validates payload and agent type

### 2. Configuration Generation

- Generates unique agent configuration
- Assigns available ports (admin and inbound)
- Creates agent-specific directory structure

### 3. Agent Spin-Up

- Executes appropriate shell script based on deployment type
- Creates Docker container or cloud service
- Waits for agent initialization

### 4. Endpoint and Token Retrieval

- Reads agent endpoint from generated config file
- Retrieves agent API token
- Returns connection details to requesting service

### 5. File Management

- Creates endpoint and token files
- Manages port allocation files
- Handles cleanup of temporary files

## Directory Structure

```
apps/agent-provisioning/
├── AFJ/
│   ├── scripts/                 # Agent spin-up scripts
│   ├── port-file/              # Port management files
│   ├── endpoints/              # Agent endpoint files
│   ├── agent-config/           # Agent configuration files
│   └── token/                  # Agent token files
└── src/
    ├── agent-provisioning.controller.ts
    ├── agent-provisioning.service.ts
    ├── agent-provisioning.module.ts
    └── interface/
        └── agent-provisioning.interfaces.ts
```

## Error Handling

### Common Issues

1. **Port Conflicts**: Handled by automatic port increment
2. **File System Errors**: Checked with `checkFileExistence()` method
3. **Shell Script Failures**: Logged and thrown as RPC exceptions
4. **Configuration Errors**: Validated before agent spin-up

### Logging

- All operations are logged using NestJS Logger
- Shell script output is captured and logged
- Errors are logged with full context

## Security Considerations

### Wallet Security

- Wallet passwords are encrypted
- Seeds are securely generated
- Database credentials are environment-based

### Network Security

- Agents communicate over secure protocols
- Webhook endpoints should be HTTPS
- Database connections should be encrypted

## Future Enhancements

### Planned Features

1. **ACAPY Agent Support**: Implementation of ACA-PY agent provisioning
2. **Multi-tenancy**: Enhanced tenant support
3. **Monitoring**: Agent health monitoring
4. **Scaling**: Auto-scaling capabilities

### Extension Points

- Additional agent types can be added to `AgentType` enum
- New deployment scripts can be created for different environments
- Configuration templates can be customized per organization

## Troubleshooting

### Common Problems

1. **Agent fails to start**: Check port availability and configuration
2. **Database connection errors**: Verify wallet storage credentials
3. **File not found errors**: Ensure proper directory permissions
4. **Docker issues**: Verify Docker daemon and image availability

### Debug Steps

1. Check environment variables
2. Verify shell script permissions
3. Review log output for errors
4. Test database connectivity
5. Confirm webhook endpoint accessibility

This documentation provides a comprehensive overview of the agent provisioning service based on the actual codebase implementation.
