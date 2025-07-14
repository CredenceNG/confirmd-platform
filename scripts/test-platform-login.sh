#!/bin/bash

echo "Testing platform admin login through API Gateway..."

# Test the platform admin login endpoint
curl -X POST "http://localhost:5000/auth/signin" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@getconfirmd.com",
    "password": "PlatformAdmin123!"
  }' \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n\nTesting CORS preflight..."
curl -X OPTIONS "http://localhost:5000/auth/signin" \
  -H "Origin: http://localhost:4321" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

echo -e "\n\nDone. Check the responses above for any errors."
