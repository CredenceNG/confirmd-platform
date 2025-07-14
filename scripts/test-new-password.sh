#!/bin/bash

# Test authentication with new password
echo "Testing authentication with new password: PlatformAdmin123!"

curl -X POST "https://manager.credence.ng/realms/confirmd-bench/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-admin" \
  -d "username=admin@getconfirmd.com" \
  -d "password=PlatformAdmin123!" \
  -d "scope=openid" \
  -w "\nHTTP Status: %{http_code}\n"

echo -e "\n\nIf successful, we should see an access_token in the response above."
