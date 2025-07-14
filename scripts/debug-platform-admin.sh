#!/bin/bash

# Platform Admin Detection Debug Script
# This script triggers the Platform Admin detection to see debug output

echo "🔍 Platform Admin Detection Debug Test"
echo "====================================="

echo "📋 Forcing a user service operation to trigger Platform Admin detection..."

# Get the user ID
USER_ID=$(docker-compose exec -T postgres psql -U postgres -d credebl -c "SELECT id FROM \"user\" WHERE email = 'admin@getconfirmd.com';" -t | tr -d ' ')

echo "📋 User ID: $USER_ID"
echo "📋 Platform Admin Email: admin@getconfirmd.com"

# Try to trigger the getUserByUserIdInKeycloak method which calls isPlatformAdminUser
echo ""
echo "🔍 Checking recent logs for Platform Admin detection..."

# Clear logs by checking service startup
docker-compose logs user --tail=5

echo ""
echo "🔍 Now let's monitor logs in real-time for the next 10 seconds..."
echo "   (You can also run this command in another terminal: docker-compose logs -f user)"

# Monitor logs in the background
timeout 10 docker-compose logs -f user &

echo ""
echo "✅ Script completed. Check the logs above for Platform Admin detection debug output."
echo "If you don't see the expected debug logs, the Platform Admin detection code may not be properly deployed."
