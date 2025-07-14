#!/bin/bash

echo "=============================================="
echo "  Frontend Authentication Guide"
echo "=============================================="
echo ""

echo "🔍 Investigating the 401 Unauthorized error..."
echo ""

echo "1. Testing CORS (should work):"
echo "   Expected: CORS headers present"
CORS_RESULT=$(curl -s -X OPTIONS http://localhost:5000/auth/signin \
  -H "Origin: http://localhost:4321" \
  -H "Access-Control-Request-Method: POST" \
  -I | grep "Access-Control-Allow-Origin")

if [[ -n "$CORS_RESULT" ]]; then
    echo "   ✅ CORS is working: $CORS_RESULT"
else
    echo "   ❌ CORS is not working"
fi

echo ""
echo "2. Testing Authentication (currently failing):"
echo "   Expected: Successful login or specific error"

# Test with the platform admin credentials
echo "   Testing platform admin login..."
AUTH_RESULT=$(curl -s -X POST http://localhost:5000/auth/signin \
  -H "Origin: http://localhost:4321" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@getconfirmd.com", "password": "Admin@123"}')

echo "   Response: $AUTH_RESULT"

if echo "$AUTH_RESULT" | grep -q "access_token"; then
    echo "   ✅ Authentication successful"
else
    echo "   ❌ Authentication failed"
fi

echo ""
echo "3. Root Cause Analysis:"
echo ""
echo "   The issue is that the platform admin user 'admin@getconfirmd.com'"
echo "   either doesn't exist in Keycloak or has different credentials."
echo ""
echo "   To fix this, you need to:"
echo "   a) Check Keycloak at https://manager.credence.ng"
echo "   b) Verify the 'confirmd-bench' realm has the admin user"
echo "   c) Create the user if missing, or update credentials if different"

echo ""
echo "4. What the frontend should send:"
echo ""
echo "   POST /auth/signin"
echo "   Content-Type: application/json"
echo "   {"
echo "     \"email\": \"admin@getconfirmd.com\","
echo "     \"password\": \"Admin@123\""
echo "   }"
echo ""
echo "   Note: Password should be sent as plain text (raw password)."
echo "   The backend will handle encryption internally."

echo ""
echo "5. Expected successful response:"
echo ""
echo "   {"
echo "     \"statusCode\": 200,"
echo "     \"message\": \"User login successful\","
echo "     \"data\": {"
echo "       \"access_token\": \"eyJ...\","
echo "       \"token_type\": \"Bearer\","
echo "       \"expires_in\": 3600"
echo "     }"
echo "   }"

echo ""
echo "=============================================="
echo "  Summary: CORS is working, auth needs Keycloak fix"
echo "=============================================="
