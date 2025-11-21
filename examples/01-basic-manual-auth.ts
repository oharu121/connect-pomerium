/**
 * Example: Basic usage with manual browser authentication
 *
 * This example demonstrates the simplest way to use connect-pomerium.
 * When authentication is required, Pomerium will open a browser window
 * for you to manually log in.
 *
 * No additional dependencies required.
 */

import { PomeriumTunnel } from 'connect-pomerium';

async function main() {
  // Create a tunnel instance
  const tunnel = new PomeriumTunnel({
    targetHost: 'tcp+https://db.corp.pomerium.io:5432',
    listenPort: 5432,
  });

  try {
    console.log('Starting Pomerium tunnel...');
    console.log('A browser window will open for authentication.');

    // Start the tunnel (browser will open automatically for auth)
    await tunnel.start();

    console.log('✅ Tunnel connected!');
    console.log('You can now access your service at localhost:5432');

    // Your automation code here...
    // For example: Connect to database, make API calls, etc.

    // Keep the tunnel open for 30 seconds (for demonstration)
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Failed to establish tunnel:', error);
    process.exit(1);
  } finally {
    // Always clean up
    await tunnel.stop();
    console.log('Tunnel stopped.');
  }
}

main();
