/**
 * Example: CI/CD usage with auto-reconnect and error handling
 *
 * This example demonstrates how to use connect-pomerium in a CI/CD pipeline
 * with automatic reconnection and proper error handling.
 *
 * Features:
 * - Auto-reconnect on connection loss
 * - Maximum retry attempts
 * - Lifecycle hooks for monitoring
 * - Graceful failure handling
 *
 * Requirements:
 *   npm install playwright (or your preferred auth automation tool)
 */

import { chromium } from 'playwright';
import { PomeriumTunnel } from 'connect-pomerium';

/**
 * Simulates running integration tests that require the tunnel
 */
async function runIntegrationTests(): Promise<void> {
  console.log('\n🧪 Running integration tests...');

  // Simulate test execution
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('✅ All tests passed!');
}

/**
 * Automates service account login (customize for your auth provider)
 */
async function automateServiceAccountLogin(authUrl: string): Promise<void> {
  console.log('🔐 Authenticating with service account...');

  // Use service account credentials from environment
  const serviceUser = process.env.SERVICE_ACCOUNT_USER;
  const servicePass = process.env.SERVICE_ACCOUNT_PASS;

  if (!serviceUser || !servicePass) {
    throw new Error('SERVICE_ACCOUNT_USER and SERVICE_ACCOUNT_PASS must be set');
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(authUrl);

    // Customize this for your auth provider (Okta, Google, etc.)
    await page.waitForSelector('#username', { timeout: 10000 });
    await page.fill('#username', serviceUser);
    await page.fill('#password', servicePass);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ timeout: 30000 });

    console.log('✅ Service account authentication successful');
  } finally {
    await browser.close();
  }
}

async function main() {
  const tunnel = new PomeriumTunnel({
    targetHost: 'tcp+https://staging-api.corp.pomerium.io:443',
    listenPort: 8443,

    // Enable auto-reconnect for long-running CI jobs
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 5000, // 5 seconds between retries

    // Connection timeout (60 seconds)
    connectionTimeout: 60000,

    // Automated authentication
    onAuthRequired: async (authUrl) => {
      await automateServiceAccountLogin(authUrl);
    },

    // Lifecycle hooks for monitoring
    onConnected: () => {
      console.log('✅ Tunnel connected');
    },

    onDisconnected: () => {
      console.warn('⚠️  Tunnel disconnected');
    },

    onReconnecting: (attempt) => {
      console.warn(`⚠️  Connection lost. Reconnecting (attempt ${attempt}/5)...`);
    },

    onReconnectFailed: () => {
      console.error('❌ Failed to reconnect after 5 attempts');
      console.error('CI job will fail');
      process.exit(1); // Fail the CI job
    },

    onError: (error) => {
      console.error('❌ Tunnel error:', error.message);
    },
  });

  try {
    console.log('🚀 Starting Pomerium tunnel for CI/CD...');
    await tunnel.start();

    // Run your integration tests
    await runIntegrationTests();

    console.log('\n✅ CI/CD pipeline completed successfully!');

  } catch (error) {
    console.error('\n❌ CI/CD pipeline failed:', error);
    process.exit(1); // Exit with error code for CI
  } finally {
    // Always clean up the tunnel
    await tunnel.stop();
    console.log('Tunnel stopped.');
  }
}

// Handle unexpected termination signals
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, cleaning up...');
  process.exit(0);
});

main();
