/**
 * Example: Automated Google SSO authentication using Puppeteer
 *
 * This example shows how to automate Google SSO login using Puppeteer.
 * The browser will run in headless mode, suitable for CI/CD pipelines.
 *
 * Requirements:
 *   npm install puppeteer
 *
 * Environment variables:
 *   GOOGLE_EMAIL - Your Google email
 *   GOOGLE_PASSWORD - Your Google password
 *
 * Note: If you have 2FA enabled, you'll need to handle that flow as well.
 */

import puppeteer from 'puppeteer';
import { PomeriumTunnel } from 'connect-pomerium';

async function main() {
  // Validate environment variables
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.error('❌ Please set GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables');
    process.exit(1);
  }

  const tunnel = new PomeriumTunnel({
    targetHost: 'tcp+https://redis.corp.pomerium.io:6379',
    listenPort: 6379,

    // Automated authentication handler
    onAuthRequired: async (authUrl) => {
      console.log('🔐 Authenticating via Google SSO...');

      const browser = await puppeteer.launch({
        headless: true, // Run in headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Required for some CI environments
      });

      try {
        const page = await browser.newPage();

        // Navigate to the auth URL
        await page.goto(authUrl, { waitUntil: 'networkidle0' });

        // Google email step
        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.type('input[type="email"]', process.env.GOOGLE_EMAIL!);
        await page.click('#identifierNext');

        // Wait for password step
        await page.waitForSelector('input[type="password"]', {
          visible: true,
          timeout: 10000,
        });
        await page.type('input[type="password"]', process.env.GOOGLE_PASSWORD!);
        await page.click('#passwordNext');

        // Wait for authentication to complete
        // This waits for navigation to indicate successful auth
        await page.waitForNavigation({
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        console.log('✅ Google SSO authentication successful');
      } catch (error) {
        console.error('❌ Google SSO authentication failed:', error);
        throw error;
      } finally {
        await browser.close();
      }
    },

    // Optional: Connection lifecycle hooks
    onConnected: () => {
      console.log('✅ Tunnel connected!');
      console.log('Access Redis at localhost:6379');
    },

    onError: (error) => {
      console.error('❌ Tunnel error:', error.message);
    },
  });

  try {
    console.log('Starting Pomerium tunnel...');
    await tunnel.start();

    // Your automation code here
    // For example: Connect to Redis via the tunnel
    console.log('\nTunnel is ready for use!');
    console.log('Example: redis-cli -h localhost -p 6379');

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
