# Webhook Failure Handling Documentation

## Overview
This document explains how the platform handles webhook delivery failures when sending events to org apps.

## Core Principle: Fail Gracefully, Don't Block Others

**Key Behavior**: If one app has a misconfigured webhook URL, it does NOT prevent other apps from receiving webhooks.

## How It Works

### 1. Parallel Delivery with Promise.allSettled()

```typescript
const deliveryPromises = orgApps.map((app) => this.sendWebhookToApp(app, payload));
const results = await Promise.allSettled(deliveryPromises);
```

**What this means**:
- All apps receive webhooks **in parallel**
- Each delivery is **independent**
- One failure doesn't affect others
- Platform gets a summary of all results

### 2. Individual App Failure Handling

```typescript
try {
  // Attempt delivery
  const response = await fetch(app.webhookUrl, { ... });

  if (response.ok) {
    // Success - track in database
    await this.trackDelivery({ deliveryStatus: 'delivered', ... });
  } else {
    // HTTP error - track failure
    await this.trackDelivery({ deliveryStatus: 'failed', ... });
  }
} catch (error) {
  // Network error, timeout, invalid URL - track failure
  await this.trackDelivery({ deliveryStatus: 'failed', ... });
  // Don't throw - continue with other apps
}
```

## Example Scenarios

### Scenario 1: One App with Bad URL

**Setup**:
```
Organization: ACME Corp
Apps:
  ✅ Mobile App    - https://mobile.acme.com/webhook
  ❌ Test App     - https://invalid-url-12345.com/webhook
  ✅ Dashboard    - https://dashboard.acme.com/webhook
```

**When proof request webhook is sent**:
```
🔍 Processing proof webhook...
📤 Sending to 3 apps in parallel...

  App 1 (Mobile App):
    ✅ HTTP 200 OK
    📝 Tracked as 'delivered' in webhook_deliveries

  App 2 (Test App):
    ❌ Network error: getaddrinfo ENOTFOUND invalid-url-12345.com
    📝 Tracked as 'failed' in webhook_deliveries
    ⚠️  Logged error but continuing...

  App 3 (Dashboard):
    ✅ HTTP 200 OK
    📝 Tracked as 'delivered' in webhook_deliveries

✅ Webhook delivery completed: 2 successful, 1 failed
```

**Result**: Mobile App and Dashboard receive the webhook, Test App fails but doesn't block others.

### Scenario 2: App Returns HTTP Error

**Setup**:
```
Apps:
  ✅ App A - Responds with 200 OK
  ❌ App B - Responds with 503 Service Unavailable
  ✅ App C - Responds with 200 OK
```

**Result**:
```
App A: ✅ Delivered (tracked as 'delivered')
App B: ❌ Failed with HTTP 503 (tracked as 'failed')
App C: ✅ Delivered (tracked as 'delivered')

Summary: 2 successful, 1 failed
```

### Scenario 3: App Times Out

**Setup**:
```
Apps:
  ✅ App A - Responds quickly
  ❌ App B - Takes 60+ seconds (timeout)
  ✅ App C - Responds quickly
```

**Result**:
```
App A: ✅ Delivered immediately
App C: ✅ Delivered immediately
App B: ❌ Times out after 60s (tracked as 'failed')

Summary: 2 successful, 1 failed
```

## Delivery Tracking in Database

Every webhook delivery attempt is now tracked in `webhook_deliveries` table:

```sql
SELECT
  app_id,
  event_type,
  delivery_status,
  http_status,
  error_message,
  create_date_time,
  delivered_at
FROM webhook_deliveries
WHERE app_id = 'your-app-id'
ORDER BY create_date_time DESC;
```

### Example Records

**Successful Delivery**:
```json
{
  "id": "uuid-1",
  "appId": "app-123",
  "eventType": "Proof",
  "deliveryStatus": "delivered",
  "httpStatus": 200,
  "responseBody": "{\"success\": true}",
  "errorMessage": null,
  "attemptCount": 1,
  "deliveredAt": "2025-11-05T10:30:00Z"
}
```

**Failed Delivery (HTTP Error)**:
```json
{
  "id": "uuid-2",
  "appId": "app-456",
  "eventType": "Proof",
  "deliveryStatus": "failed",
  "httpStatus": 503,
  "responseBody": "Service Unavailable",
  "errorMessage": "HTTP 503: Service Unavailable",
  "attemptCount": 1,
  "deliveredAt": null
}
```

**Failed Delivery (Network Error)**:
```json
{
  "id": "uuid-3",
  "appId": "app-789",
  "eventType": "Proof",
  "deliveryStatus": "failed",
  "httpStatus": null,
  "responseBody": null,
  "errorMessage": "getaddrinfo ENOTFOUND invalid-url.com",
  "attemptCount": 1,
  "deliveredAt": null
}
```

## Monitoring Failed Deliveries

### Query Recent Failures

```sql
-- Get all failed deliveries in last 24 hours
SELECT
  wa.name as app_name,
  wd.event_type,
  wd.http_status,
  wd.error_message,
  wd.create_date_time
FROM webhook_deliveries wd
JOIN org_apps wa ON wa.id = wd.app_id
WHERE
  wd.delivery_status = 'failed'
  AND wd.create_date_time > NOW() - INTERVAL '24 hours'
ORDER BY wd.create_date_time DESC;
```

### Query App Failure Rate

```sql
-- Get success/failure rate per app
SELECT
  wa.name as app_name,
  wa.webhook_url,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN wd.delivery_status = 'delivered' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN wd.delivery_status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(
    (SUM(CASE WHEN wd.delivery_status = 'delivered' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100,
    2
  ) as success_rate
FROM webhook_deliveries wd
JOIN org_apps wa ON wa.id = wd.app_id
WHERE wd.create_date_time > NOW() - INTERVAL '7 days'
GROUP BY wa.id, wa.name, wa.webhook_url
ORDER BY success_rate ASC;
```

### Query Apps with Consistent Failures

```sql
-- Find apps failing consistently (last 10 attempts)
WITH recent_deliveries AS (
  SELECT
    app_id,
    delivery_status,
    ROW_NUMBER() OVER (PARTITION BY app_id ORDER BY create_date_time DESC) as rn
  FROM webhook_deliveries
)
SELECT
  wa.name,
  wa.webhook_url,
  COUNT(*) as recent_attempts,
  COUNT(CASE WHEN rd.delivery_status = 'failed' THEN 1 END) as recent_failures
FROM recent_deliveries rd
JOIN org_apps wa ON wa.id = rd.app_id
WHERE rd.rn <= 10
GROUP BY wa.id, wa.name, wa.webhook_url
HAVING COUNT(CASE WHEN rd.delivery_status = 'failed' THEN 1 END) >= 8
ORDER BY recent_failures DESC;
```

## Logs to Check

### Successful Delivery
```
📤 Sending webhook to app: Mobile Wallet (app-123)
🌐 URL: https://mobile.acme.com/webhook
📨 OUTBOUND_WEBHOOK_PAYLOAD: {"type":"Proof",...}
✅ Webhook delivered successfully to Mobile Wallet
📬 Response: {"success":true}
📝 Delivery tracked: delivered to app app-123
```

### Failed Delivery
```
📤 Sending webhook to app: Test App (app-456)
🌐 URL: https://invalid-url.com/webhook
📨 OUTBOUND_WEBHOOK_PAYLOAD: {"type":"Proof",...}
❌ Failed to send webhook to Test App: getaddrinfo ENOTFOUND
📝 Delivery tracked: failed to app app-456
```

### Delivery Summary
```
✅ Webhook delivery completed: 2 successful, 1 failed
```

## What Happens to Failed Webhooks

### Current Behavior (v1.0)
- ❌ **No automatic retry** - Failed webhooks are logged and tracked but NOT retried
- ✅ **Logged in database** - All attempts tracked in `webhook_deliveries` table
- ✅ **Doesn't block other apps** - Other apps receive webhooks successfully
- ⚠️ **No admin notification** - Org admins are not notified of failures

### Future Enhancements (Planned)

1. **Automatic Retry with Exponential Backoff**
   ```
   Attempt 1: Immediate
   Attempt 2: After 1 minute
   Attempt 3: After 5 minutes
   Attempt 4: After 15 minutes
   Attempt 5: After 1 hour
   ```

2. **Dead Letter Queue**
   - After max retries, move to DLQ for manual inspection
   - Admin can manually retry from DLQ

3. **Admin Notifications**
   - Email/slack alert when app fails consistently
   - Dashboard showing app health

4. **Automatic App Disabling**
   - Disable app webhook after N consecutive failures
   - Prevent continued waste of resources

## Best Practices for App Developers

### 1. Implement Proper Error Handling
```javascript
app.post('/webhook', async (req, res) => {
  try {
    // Acknowledge receipt immediately
    res.status(200).json({ success: true });

    // Process webhook asynchronously
    await processWebhookAsync(req.body);
  } catch (error) {
    // Log error but still return 200 (already acked)
    console.error('Webhook processing error:', error);
  }
});
```

### 2. Respond Quickly
- Return HTTP 200 within 5 seconds
- Process heavy logic asynchronously
- Don't wait for database operations before responding

### 3. Validate Webhook Secret
```javascript
const apiKey = req.headers['x-api-key'];
if (apiKey !== process.env.WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

### 4. Handle Duplicate Webhooks
- Use `threadId` or `id` to track processed webhooks
- Implement idempotency

### 5. Monitor Your Endpoint
- Set up alerts for 5xx errors
- Monitor response times
- Check webhook success rate

## Troubleshooting

### Problem: App Not Receiving Webhooks

**Check**:
1. Is app `isActive = true`?
   ```sql
   SELECT name, is_active FROM org_apps WHERE id = 'your-app-id';
   ```

2. Check delivery attempts:
   ```sql
   SELECT * FROM webhook_deliveries
   WHERE app_id = 'your-app-id'
   ORDER BY create_date_time DESC LIMIT 10;
   ```

3. Check webhook URL is correct:
   ```sql
   SELECT name, webhook_url FROM org_apps WHERE id = 'your-app-id';
   ```

4. Test webhook URL manually:
   ```bash
   curl -X POST https://your-app.com/webhook \
     -H "Content-Type: application/json" \
     -H "x-api-key: your-secret" \
     -d '{"type":"Proof","data":{}}'
   ```

### Problem: All Deliveries Failing

**Possible Causes**:
- DNS issue with webhook URL
- SSL certificate expired
- App server down
- Firewall blocking platform IP
- Webhook URL changed but not updated in database

**Resolution**:
1. Verify URL is accessible from platform
2. Check SSL certificate validity
3. Update webhook URL if changed
4. Whitelist platform IP addresses if needed

### Problem: Intermittent Failures

**Possible Causes**:
- Network instability
- App server overloaded
- Rate limiting
- Timeouts due to slow processing

**Resolution**:
1. Increase app server capacity
2. Optimize webhook processing
3. Return 200 immediately, process async
4. Add proper logging to identify bottlenecks

## Related Files

- `apps/api-gateway/src/webhook/webhook-delivery.service.ts` - Main delivery logic
- `libs/prisma-service/prisma/schema.prisma` - Database schema
- `apps/api-gateway/src/webhook/webhook-receiver.service.ts` - Webhook routing

## Support

For issues with webhook delivery:
1. Check `webhook_deliveries` table for delivery history
2. Review platform logs for detailed error messages
3. Test webhook URL manually
4. Verify network connectivity
5. Check app server logs
