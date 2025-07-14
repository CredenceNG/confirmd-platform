#!/bin/bash

echo "=== Frontend Error Diagnosis and Fixes ==="
echo

echo "1. Testing API Gateway Authentication..."
curl -s http://localhost:5000/users/profile | jq . 2>/dev/null || echo "No authentication - frontend likely not logged in"

echo
echo "2. Available Organizations:"
docker-compose -f docker-compose-dev.yml exec postgres psql -U postgres -d credebl -c "SELECT id, name, \"orgSlug\" FROM organisation;" 2>/dev/null | grep -v "WARN"

echo
echo "3. Users with Organization Roles:"
docker-compose -f docker-compose-dev.yml exec postgres psql -U postgres -d credebl -c "SELECT u.email, orgr.name as role_name, o.name as org_name FROM user_org_roles ur JOIN \"user\" u ON ur.\"userId\" = u.id JOIN org_roles orgr ON ur.\"orgRoleId\" = orgr.id JOIN organisation o ON ur.\"orgId\" = o.id;" 2>/dev/null | grep -v "WARN"

echo
echo "4. Required Actions:"
echo "   a) Frontend needs to authenticate as admin@getconfirmd.com"
echo "   b) Or create additional users with organization roles"
echo "   c) Fix frontend API endpoint configuration to use correct ports"
echo "   d) Configure static file serving for org logos"

echo
echo "5. Missing Static Files - Org Logos:"
echo "   Expected: /uploads/org-logos/orgLogo-*.png"
echo "   Solution: Configure nginx to serve static files or API Gateway to handle uploads"
