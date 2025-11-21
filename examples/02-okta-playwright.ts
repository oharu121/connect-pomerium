/**
 * Example: Automated Okta authentication using Playwright
 *
 * This example shows how to automate Okta login using Playwright.
 * The browser will run in headless mode, making it suitable for CI/CD.
 *
 * Requirements:
 *   npm install playwright
 *
 * Environment variables:
 *   OKTA_USERNAME - Your Okta username
 *   OKTA_PASSWORD - Your Okta password
 */

import { chromium } from 'playwright';
import { PomeriumTunnel } from 'connect-pomerium';

async function main() {
  // Validate environment variables
  if (!process.env.OKTA_USERNAME || !process.env.OKTA_PASSWORD) {
    console.error('❌ Please set OKTA_USERNAME and OKTA_PASSWORD environment variables');
    process.exit(1);
  }

  const tunnel = new PomeriumTunnel({
    targetHost: 'tcp+https://api.corp.pomerium.io:443',
    listenPort: 8443,

    // Automated authentication handler
    onAuthRequired: async (authUrl) => {
      console.log('🔐 Authenticating via Okta...');

      const browser = await chromium.launch({
        headless: true, // Run in headless mode
      });

      try {
        const page = await browser.newPage();

        // Navigate to the auth URL
        await page.goto(authUrl);

        // Wait for Okta login form to load
        await page.waitForSelector('#okta-signin-username', { timeout: 10000 });

        // Fill in credentials
        await page.fill('#okta-signin-username', process.env.OKTA_USERNAME!);
        await page.fill('#okta-signin-password', process.env.OKTA_PASSWORD!);

        // Submit the form
        await page.click('#okta-signin-submit');

        // Wait for redirect back to Pomerium (indicates successful auth)
        await page.waitForURL(/pomerium\.io/, { timeout: 30000 });

        console.log('✅ Okta authentication successful');
      } catch (error) {
        console.error('❌ Okta authentication failed:', error);
        throw error;
      } finally {
        await browser.close();
      }
    },

    // Optional: Connection lifecycle hooks
    onConnected: () => {
      console.log('✅ Tunnel connected!');
      console.log('Access your service at localhost:8443');
    },

    onError: (error) => {
      console.error('❌ Tunnel error:', error.message);
    },
  });

  try {
    console.log('Starting Pomerium tunnel...');
    await tunnel.start();

    // Your automation code here
    // For example: Make API calls via the tunnel
    console.log('\nTunnel is ready for use!');
    console.log('Example: fetch("http://localhost:8443/api/data")');

    // Keep the tunnel open for 60 seconds (for demonstration)
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Failed to establish tunnel:', error);
    process.exit(1);
  } finally {
    await tunnel.stop();
    console.log('Tunnel stopped.');
  }
}

main();
