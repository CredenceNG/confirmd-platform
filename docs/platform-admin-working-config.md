docker run -d \
 --name "f856e3a4-b09c-4356-82de-b105594eec43_platform-admin" \
 --network confirmd-platform_default \
 -p 8002:8002 \
 -p 9002:9002 \
 -v /Users/itopa/projects/confirmd-platform/apps/agent-provisioning/AFJ/agent-config/f856e3a4-b09c-4356-82de-b105594eec43_Platform-admin.json:/app/config.json \
 -e AFJ_REST_LOG_LEVEL=1 \
 confirmd-credo-controller:local \
 start --config /app/config.json

Platform Admin Container Successfully Restored
Container Status: Running and fully functional

Configuration Used:

Image: confirmd-credo-controller:local (correct local image)
Container Name: f856e3a4-b09c-4356-82de-b105594eec43_platform-admin
Network: confirmd-platform_default
Ports: 8002:8002 (admin API), 9002:9002 (agent endpoint)
Configuration File: Uses the documented working configuration format
Key Success Indicators:

✅ Container Running: Up for 4 minutes, stable
✅ Agent API Responding: HTTP 200 on /agent endpoint
✅ Multi-tenancy Endpoint: HTTP 401 (auth required, as expected)
✅ Wallet Initialized: Platform-admin wallet opened successfully
✅ Storage Ready: Agent storage up to date
✅ Transport Started: HTTP inbound/outbound transports operational
✅ API Token Generated: Authentication system working
Working Configuration Format: The key was using the correct configuration format as documented in CREDO_CONTROLLER_SETUP.md, which includes:

Proper wallet URL format (confirmd-platform-postgres-1:5432)
Correct database connection parameters
Appropriate timeout and connection settings
Proper Indy ledger configuration
The platform admin container has been successfully restored to its pre-Cloudflare working state and is now ready for frontend connectivity testing!
