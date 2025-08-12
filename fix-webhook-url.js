#!/usr/bin/env node

/**
 * Script to fix webhook URL configuration in org_agents table
 * This updates the webhook URL to point to the centralized webhook receiver
 */

const { PrismaClient } = require('@prisma/client');

async function fixWebhookUrl() {
  const prisma = new PrismaClient();

  try {
    console.log('🔧 Starting webhook URL fix...');

    // Check current webhook URLs
    console.log('\n📊 Current webhook URLs in database:');
    const currentAgents = await prisma.org_agents.findMany({
      select: {
        id: true,
        orgId: true,
        tenantId: true,
        webhookUrl: true
      }
    });

    currentAgents.forEach((agent) => {
      console.log('  - Agent ' + agent.id + ': ' + (agent.webhookUrl || 'NOT SET'));
    });

    // Update webhook URLs to point to centralized webhook receiver
    // Using public URL so mobile wallets can reach the webhook endpoint
    const newWebhookUrl = 'https://platform.confirmd.com/webhooks';

    console.log('\n🔄 Updating webhook URLs to: ' + newWebhookUrl);

    const updateResult = await prisma.org_agents.updateMany({
      data: {
        webhookUrl: newWebhookUrl
      }
    });

    console.log('✅ Updated ' + updateResult.count + ' agent webhook URLs');

    // Verify the update
    console.log('\n✔️  Verification - Updated webhook URLs:');
    const updatedAgents = await prisma.org_agents.findMany({
      select: {
        id: true,
        orgId: true,
        tenantId: true,
        webhookUrl: true
      }
    });

    updatedAgents.forEach((agent) => {
      console.log('  - Agent ' + agent.id + ': ' + agent.webhookUrl);
    });

    console.log('\n🎉 Webhook URL fix completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Restart the Credo Controller to apply new webhook URLs');
    console.log('  2. Test credential acceptance on mobile wallet');
    console.log('  3. Mobile wallet should now be able to accept credentials');
  } catch (error) {
    console.error('❌ Error fixing webhook URLs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixWebhookUrl()
  .then(() => {
    console.log('\n🏁 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
