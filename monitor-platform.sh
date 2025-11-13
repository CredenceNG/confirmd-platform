#!/bin/bash

# Confirmd Platform Monitoring Script
# Run this script to check the health of all platform services

echo "╔════════════════════════════════════════════════════════════════════════╗"
echo "║              CONFIRMD PLATFORM - MONITORING DASHBOARD                  ║"
echo "╚════════════════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 SERVICE STATUS:"
docker ps --filter "name=confirmd-platform" --format "  ✓ {{.Names}}: {{.Status}}" | head -15

echo ""
echo "🗄️  DATABASE MIGRATION STATUS:"
docker exec confirmd-platform-postgres-1 psql -U postgres -d credebl -c \
  "SELECT COUNT(*) as total,
          COUNT(CASE WHEN applied_steps_count > 0 THEN 1 END) as applied,
          COUNT(CASE WHEN applied_steps_count = 0 AND rolled_back_at IS NULL THEN 1 END) as failed
   FROM _prisma_migrations;" 2>&1 | grep -A2 "total"

echo ""
echo "🔍 RECENT ACTIVITY (Last 5 minutes):"
for service in agent-provisioning agent-service api-gateway organization ecosystem; do
  count=$(docker logs confirmd-platform-$service-1 --since 5m 2>&1 2>/dev/null | wc -l | xargs)
  if [ -n "$count" ]; then
    echo "  $service: $count log entries"
  fi
done

echo ""
echo "⚠️  ERROR SUMMARY (Last 10 minutes):"
errors_found=0
for service in agent-provisioning agent-service organization user issuance verification; do
  error_count=$(docker logs confirmd-platform-$service-1 --since 10m 2>&1 2>/dev/null | \
    grep -iE "error|fail" | \
    grep -vE "deprecated|wallet is already|ClsModule|WARN" | \
    wc -l | xargs)
  if [ "$error_count" -gt 0 ]; then
    echo "  ⚠ $service: $error_count errors"
    errors_found=1
  fi
done
if [ $errors_found -eq 0 ]; then
  echo "  ✓ No critical errors detected"
fi

echo ""
echo "🚀 KEY METRICS:"
echo "  Agent Provisioning: $(docker inspect confirmd-platform-agent-provisioning-1 --format='{{.State.Status}}' 2>/dev/null)"
echo "  Agent Service: $(docker inspect confirmd-platform-agent-service-1 --format='{{.State.Status}}' 2>/dev/null)"
echo "  Database: $(docker inspect confirmd-platform-postgres-1 --format='{{.State.Status}} ({{.State.Health.Status}})' 2>/dev/null)"
echo "  API Gateway: $(docker inspect confirmd-platform-api-gateway-1 --format='{{.State.Status}}' 2>/dev/null)"

echo ""
echo "📝 MIGRATION HEALTH CHECK:"
migration_errors=$(docker logs confirmd-platform-agent-provisioning-1 --since 30m 2>&1 | grep -i "P3009\|failed migration" | wc -l | xargs)
if [ "$migration_errors" -eq 0 ]; then
  echo "  ✓ No migration errors in last 30 minutes"
else
  echo "  ⚠ Found $migration_errors migration error(s) in last 30 minutes"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Last updated: $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "💡 TIP: Run 'docker-compose logs -f <service-name>' to follow logs"
echo "💡 TIP: Run 'docker-compose ps' to see all services"
