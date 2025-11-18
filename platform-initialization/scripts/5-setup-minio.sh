#!/bin/bash

# Script 5: Setup MinIO Storage
# Creates required S3 buckets for file storage

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  MinIO Storage Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Configuration from .env or defaults
MINIO_CONTAINER="${MINIO_CONTAINER:-confirmd-platform-minio}"
MINIO_ACCESS_KEY="${AWS_S3_STOREOBJECT_ACCESS_KEY:-dev-access-key}"
MINIO_SECRET_KEY="${AWS_S3_STOREOBJECT_SECRET_KEY:-dev-secret-key}"
BUCKET_NAME="${AWS_S3_STOREOBJECT_BUCKET:-confirmd-dev-bucket}"

# Check if MinIO container is running
if ! docker ps | grep -q "$MINIO_CONTAINER"; then
    echo "❌ Error: MinIO container is not running"
    echo "   Please start services with: docker compose up -d"
    exit 1
fi

echo "✅ MinIO container is running"
echo ""

# Configure MinIO alias
echo "🔧 Configuring MinIO client..."
docker exec "$MINIO_CONTAINER" mc alias set myminio http://localhost:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" 2>&1 | grep -v "mc: <ERROR>" || true

# Check if bucket exists
echo "🔍 Checking if bucket '$BUCKET_NAME' exists..."
if docker exec "$MINIO_CONTAINER" mc ls myminio/ 2>&1 | grep -q "$BUCKET_NAME"; then
    echo "✅ Bucket '$BUCKET_NAME' already exists"
else
    echo "📦 Creating bucket '$BUCKET_NAME'..."
    docker exec "$MINIO_CONTAINER" mc mb "myminio/$BUCKET_NAME"
    echo "✅ Bucket created successfully"
fi

# Set public download policy for QR codes and images
echo "🔓 Setting public download policy..."
docker exec "$MINIO_CONTAINER" mc anonymous set download "myminio/$BUCKET_NAME"
echo "✅ Public download policy set"

# Verify bucket
echo ""
echo "🔍 Verifying bucket setup..."
docker exec "$MINIO_CONTAINER" mc ls myminio/

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ MinIO storage setup completed successfully!"
echo "   Bucket: $BUCKET_NAME"
echo "   Access: Public download enabled"
echo "═══════════════════════════════════════════════════════════"
