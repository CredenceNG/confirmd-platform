#!/bin/bash

# Non-interactive version of on_premises_agent.sh
# This script can be run without user prompts by setting environment variables
# or passing command line arguments

START_TIME=$(date +%s)

# Function to get variable value from environment or command line args
get_var() {
    local var_name=$1
    local default_value=$2
    local env_value=$(eval "echo \$$var_name")
    
    if [ -n "$env_value" ]; then
        echo "$env_value"
    else
        echo "$default_value"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ORGANIZATION_ID)
            ORGANIZATION_ID="$2"
            shift 2
            ;;
        --WALLET_NAME)
            WALLET_NAME="$2"
            shift 2
            ;;
        --WALLET_PASSWORD)
            WALLET_PASSWORD="$2"
            shift 2
            ;;
        --RANDOM_SEED)
            RANDOM_SEED="$2"
            shift 2
            ;;
        --WEBHOOK_HOST)
            WEBHOOK_HOST="$2"
            shift 2
            ;;
        --WALLET_STORAGE_HOST)
            WALLET_STORAGE_HOST="$2"
            shift 2
            ;;
        --WALLET_STORAGE_PORT)
            WALLET_STORAGE_PORT="$2"
            shift 2
            ;;
        --WALLET_STORAGE_USER)
            WALLET_STORAGE_USER="$2"
            shift 2
            ;;
        --WALLET_STORAGE_PASSWORD)
            WALLET_STORAGE_PASSWORD="$2"
            shift 2
            ;;
        --AGENT_NAME)
            AGENT_NAME="$2"
            shift 2
            ;;
        --PROTOCOL)
            PROTOCOL="$2"
            shift 2
            ;;
        --TENANT)
            TENANT="$2"
            shift 2
            ;;
        --CREDO_IMAGE)
            CREDO_IMAGE="$2"
            shift 2
            ;;
        --INDY_LEDGER)
            INDY_LEDGER="$2"
            shift 2
            ;;
        --INBOUND_ENDPOINT)
            INBOUND_ENDPOINT="$2"
            shift 2
            ;;
        *)
            echo "Unknown parameter: $1"
            exit 1
            ;;
    esac
done

# Set defaults from environment variables if not provided via command line
ORGANIZATION_ID=$(get_var "ORGANIZATION_ID" "")
WALLET_NAME=$(get_var "WALLET_NAME" "")
WALLET_PASSWORD=$(get_var "WALLET_PASSWORD" "")
RANDOM_SEED=$(get_var "RANDOM_SEED" "")
WEBHOOK_HOST=$(get_var "WEBHOOK_HOST" "")
WALLET_STORAGE_HOST=$(get_var "WALLET_STORAGE_HOST" "localhost")
WALLET_STORAGE_PORT=$(get_var "WALLET_STORAGE_PORT" "5432")
WALLET_STORAGE_USER=$(get_var "WALLET_STORAGE_USER" "postgres")
WALLET_STORAGE_PASSWORD=$(get_var "WALLET_STORAGE_PASSWORD" "")
AGENT_NAME=$(get_var "AGENT_NAME" "")
PROTOCOL=$(get_var "PROTOCOL" "http")
TENANT=$(get_var "TENANT" "false")
CREDO_IMAGE=$(get_var "CREDO_IMAGE" "ghcr.io/credebl/adeya-agent:latest")
INDY_LEDGER=$(get_var "INDY_LEDGER" "")
INBOUND_ENDPOINT=$(get_var "INBOUND_ENDPOINT" "")

# Validate required parameters
if [ -z "$ORGANIZATION_ID" ]; then
    echo "Error: ORGANIZATION_ID is required"
    echo "Set it via environment variable or --ORGANIZATION_ID argument"
    exit 1
fi

if [ -z "$WALLET_NAME" ]; then
    echo "Error: WALLET_NAME is required"
    echo "Set it via environment variable or --WALLET_NAME argument"
    exit 1
fi

if [ -z "$WALLET_PASSWORD" ]; then
    echo "Error: WALLET_PASSWORD is required"
    echo "Set it via environment variable or --WALLET_PASSWORD argument"
    exit 1
fi

if [ -z "$RANDOM_SEED" ]; then
    echo "Error: RANDOM_SEED is required (must be exactly 32 characters)"
    echo "Set it via environment variable or --RANDOM_SEED argument"
    exit 1
fi

# Validate RANDOM_SEED length
if [ ${#RANDOM_SEED} -ne 32 ]; then
    echo "Error: RANDOM_SEED must be exactly 32 characters."
    echo "Current length: ${#RANDOM_SEED}"
    exit 1
fi

if [ -z "$WEBHOOK_HOST" ]; then
    echo "Error: WEBHOOK_HOST is required"
    echo "Set it via environment variable or --WEBHOOK_HOST argument"
    exit 1
fi

if [ -z "$AGENT_NAME" ]; then
    echo "Error: AGENT_NAME is required"
    echo "Set it via environment variable or --AGENT_NAME argument"
    exit 1
fi

echo "Configuration:"
echo "  ORGANIZATION_ID: $ORGANIZATION_ID"
echo "  WALLET_NAME: $WALLET_NAME"
echo "  RANDOM_SEED: ${RANDOM_SEED:0:8}... (32 chars)"
echo "  WEBHOOK_HOST: $WEBHOOK_HOST"
echo "  AGENT_NAME: $AGENT_NAME"
echo "  PROTOCOL: $PROTOCOL"
echo "  TENANT: $TENANT"
echo "  CREDO_IMAGE: $CREDO_IMAGE"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Function to validate INDY_LEDGER input against the provided options
validate_indy_ledger() {
    local input_ledger=$1
    case "$input_ledger" in
    1) echo 'No ledger' ;; # Option for "no ledger"
    2) echo 'Polygon' ;;   # Option for "polygon"
    3) echo '{"genesisTransactions":"http://test.bcovrin.vonx.io/genesis","indyNamespace":"bcovrin:testnet"}' ;;
    4) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis","indyNamespace":"indicio:testnet"}' ;;
    5) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_demonet_genesis","indyNamespace":"indicio:demonet"}' ;;
    6) echo '{"genesisTransactions":"https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_mainnet_genesis","indyNamespace":"indicio:mainnet"}' ;;
    *) echo "Invalid choice" ;;
    esac
}

# Use default ledger if not specified
if [ -z "$INDY_LEDGER" ]; then
    INDY_LEDGER="3"  # Default to bcovrin:testnet
fi

INDY_LEDGER_FORMATTED=$(validate_indy_ledger "$INDY_LEDGER")

if [ "$INDY_LEDGER_FORMATTED" = "Invalid choice" ]; then
    echo "Error: Invalid INDY_LEDGER choice: $INDY_LEDGER"
    echo "Valid options: 1 (No ledger), 2 (Polygon), 3 (bcovrin:testnet), 4 (indicio:testnet), 5 (indicio:demonet), 6 (indicio:mainnet)"
    exit 1
fi

echo "  INDY_LEDGER: $INDY_LEDGER_FORMATTED"

# Continue with the rest of the agent setup...
# (The rest of the original script logic would go here)
echo "Agent configuration validated. Ready to proceed with Docker container creation."

# For now, just print the docker command that would be executed
echo ""
echo "Docker command to execute:"
echo "docker run -d --name agent-${ORGANIZATION_ID} \\"
echo "  -e ORGANIZATION_ID=\"$ORGANIZATION_ID\" \\"
echo "  -e WALLET_NAME=\"$WALLET_NAME\" \\"
echo "  -e WALLET_PASSWORD=\"$WALLET_PASSWORD\" \\"
echo "  -e RANDOM_SEED=\"$RANDOM_SEED\" \\"
echo "  -e WEBHOOK_HOST=\"$WEBHOOK_HOST\" \\"
echo "  -e AGENT_NAME=\"$AGENT_NAME\" \\"
echo "  -e PROTOCOL=\"$PROTOCOL\" \\"
echo "  -e TENANT=\"$TENANT\" \\"
echo "  -e INDY_LEDGER='$INDY_LEDGER_FORMATTED' \\"
echo "  $CREDO_IMAGE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo ""
echo "Script completed in ${DURATION} seconds."
