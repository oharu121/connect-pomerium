# connect-pomerium

[![npm version](https://badge.fury.io/js/connect-pomerium.svg)](https://badge.fury.io/js/connect-pomerium)
![License](https://img.shields.io/npm/l/connect-pomerium)
![Types](https://img.shields.io/npm/types/connect-pomerium)
![NPM Downloads](https://img.shields.io/npm/dw/connect-pomerium)

> Automate Pomerium tunnel creation for testing, CI/CD, and automation

`connect-pomerium` is a lightweight TypeScript/JavaScript library that simplifies the creation and management of [Pomerium](https://www.pomerium.com/) tunnels. It's designed specifically for **automation scenarios** where you need programmatic access to Pomerium-protected services without manual browser interaction.

## Requirements

- **Node.js** 20.0.0 or higher
- **Pomerium CLI** v0.29.0 or later ([Download](https://github.com/pomerium/cli/releases))

> **Note:** This library requires pomerium-cli v0.29.0+ which uses JSON logging. If you're using an older CLI version, please use `connect-pomerium@1.x` instead.

## Features

- 🚀 **Zero runtime dependencies** - Lean and fast
- 🔐 **Flexible authentication** - Manual browser auth or automated (Playwright, Puppeteer, etc.)
- 🔄 **Auto-reconnect support** - Configurable reconnection for long-running processes
- 🎯 **TypeScript-first** - Full type safety and IntelliSense support
- 🖥️ **Cross-platform** - Works on Windows, macOS (Intel & ARM), and Linux
- 📦 **Bundled binaries** - Pomerium CLI included, no external dependencies
- 🎨 **Lifecycle hooks** - Monitor connection state with callbacks
- ⚡ **Simple API** - Get started with just 3 lines of code

## Installation

```bash
npm install connect-pomerium
```

## Quick Start

### Basic Usage (Manual Auth)

```typescript
import { PomeriumTunnel } from 'connect-pomerium';

const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://db.corp.pomerium.io:5432',
  listenPort: 5432,
});

await tunnel.start(); // Browser opens for auth
console.log('Connected! Access your service at localhost:5432');

// Your automation code here...

await tunnel.stop();
```

### Automated Auth (Playwright Example)

```typescript
import { chromium } from 'playwright';
import { PomeriumTunnel } from 'connect-pomerium';

const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://api.corp.pomerium.io:443',
  listenPort: 8443,

  onAuthRequired: async (authUrl) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(authUrl);
    await page.fill('#username', process.env.USERNAME!);
    await page.fill('#password', process.env.PASSWORD!);
    await page.click('button[type="submit"]');

    await browser.close();
  },
});

await tunnel.start(); // No browser popup, fully automated
```

## Configuration Options

```typescript
interface PomeriumTunnelConfig {
  // Required
  targetHost: string;           // Pomerium target (e.g., 'tcp+https://host:port')
  listenPort: number;            // Local port to listen on

  // Optional
  cliPath?: string;              // Custom path to Pomerium CLI binary
  onAuthRequired?: (url: string) => Promise<void>; // Auth handler
  autoReconnect?: boolean;       // Enable auto-reconnect (default: false)
  maxReconnectAttempts?: number; // Max reconnection attempts (default: 0 = infinite)
  reconnectDelay?: number;       // Delay between retries in ms (default: 5000)
  connectionTimeout?: number;    // Connection timeout in ms (default: 60000)

  // Lifecycle hooks
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: (attempt: number) => void;
  onReconnectFailed?: () => void;
  onError?: (error: Error) => void;

  // NEW in v2.0.0
  onLog?: (log: PomeriumLogEntry) => void;  // Access raw CLI logs
  logLevel?: 'debug' | 'info' | 'warn' | 'error'; // CLI log level (default: 'info')
}
```

## API Reference

### `PomeriumTunnel`

#### `constructor(config: PomeriumTunnelConfig)`

Creates a new tunnel instance with the specified configuration.

#### `async start(): Promise<void>`

Starts the tunnel and waits for connection establishment. If `onAuthRequired` is provided, the browser will be suppressed and your callback will handle authentication. Otherwise, Pomerium will open the browser for manual login.

**Throws:**
- `ConnectionTimeoutError` - If connection times out
- `ProcessStartError` - If the Pomerium process fails to start
- `ProcessExitError` - If the process exits unexpectedly

#### `async stop(): Promise<void>`

Stops the tunnel and cleans up resources.

#### `getState(): TunnelState`

Returns the current tunnel state.

```typescript
interface TunnelState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
}
```

#### `isConnected(): boolean`

Returns `true` if the tunnel is currently connected.

## Examples

The `examples/` directory contains complete working examples:

1. **[01-basic-manual-auth.ts](examples/01-basic-manual-auth.ts)** - Simple usage with manual browser authentication
2. **[02-okta-playwright.ts](examples/02-okta-playwright.ts)** - Automated Okta login using Playwright
3. **[03-google-puppeteer.ts](examples/03-google-puppeteer.ts)** - Automated Google SSO using Puppeteer
4. **[04-ci-cd-auto-reconnect.ts](examples/04-ci-cd-auto-reconnect.ts)** - CI/CD usage with auto-reconnect

To run an example:

```bash
# Install dependencies for the example
npm install playwright  # or puppeteer

# Run the example
npx tsx examples/02-okta-playwright.ts
```

## Use Cases

### CI/CD Pipelines

Run integration tests against Pomerium-protected services:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://staging-api.corp.pomerium.io:443',
  listenPort: 8443,
  autoReconnect: true,
  maxReconnectAttempts: 5,
  onAuthRequired: async (url) => {
    // Use service account credentials
    await automateLogin(url);
  },
});

await tunnel.start();
await runIntegrationTests();
await tunnel.stop();
```

### Local Development

Access remote databases or services during development:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://prod-db.corp.pomerium.io:5432',
  listenPort: 5432,
});

await tunnel.start(); // Manual auth in browser
// Now connect to localhost:5432 with your database client
```

### Automated Scripts

Build automation tools that interact with protected services:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://admin-api.corp.pomerium.io:443',
  listenPort: 8443,
  onAuthRequired: automateAuth,
});

await tunnel.start();
await performAdminTasks();
await tunnel.stop();
```

## Authentication

### Manual Authentication (Default)

If you don't provide `onAuthRequired`, Pomerium will open your default browser for authentication. This is the simplest approach for local development.

### Automated Authentication

For CI/CD and automation, provide an `onAuthRequired` callback. The library supports any browser automation tool:

#### With Playwright

```bash
npm install playwright
```

```typescript
onAuthRequired: async (authUrl) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(authUrl);
  // Your auth logic...
  await browser.close();
}
```

#### With Puppeteer

```bash
npm install puppeteer
```

```typescript
onAuthRequired: async (authUrl) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(authUrl);
  // Your auth logic...
  await browser.close();
}
```

#### With Any Other Tool

The callback just needs to handle the authentication flow. You can use any tool that can interact with web pages.

## Auto-Reconnect

By default, auto-reconnect is **disabled** (`autoReconnect: false`). This is intentional for automation scenarios where you want explicit control over failures.

To enable auto-reconnect:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://api.corp.pomerium.io:443',
  listenPort: 8443,
  autoReconnect: true,
  maxReconnectAttempts: 3,  // 0 = infinite
  reconnectDelay: 5000,      // 5 seconds between attempts

  onReconnecting: (attempt) => {
    console.log(`Reconnecting (${attempt}/3)...`);
  },

  onReconnectFailed: () => {
    console.error('Failed to reconnect');
    process.exit(1);
  },
});
```

## Advanced Features (v2.0.0+)

### Debug Logging

Control the verbosity of pomerium-cli logs:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://example.com:443',
  listenPort: 8443,
  logLevel: 'debug', // Options: 'debug', 'info', 'warn', 'error'
});
```

### Access Raw Logs

Get access to structured log entries from pomerium-cli:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://example.com:443',
  listenPort: 8443,
  onLog: (log) => {
    // Log is a structured object with: level, message, component, etc.
    console.log(`[${log.level.toUpperCase()}] ${log.message}`);

    // Access additional fields
    if (log.component) console.log(`  Component: ${log.component}`);
    if (log.error) console.error(`  Error: ${log.error}`);
    if (log['auth-url']) console.log(`  Auth URL: ${log['auth-url']}`);
  },
});
```

### Parse Logs Manually

You can also parse pomerium-cli logs yourself:

```typescript
import { parsePomeriumLog, extractAuthUrl, type PomeriumLogEntry } from 'connect-pomerium';

// Parse JSON log line
const logEntry = parsePomeriumLog('{"level":"info","message":"connected"}');
if (logEntry) {
  console.log(logEntry.level, logEntry.message);
}

// Extract auth URL from plain text
const url = extractAuthUrl('Your browser has been opened to visit:\n\nhttps://auth.example.com\n');
console.log(url); // "https://auth.example.com"
```

## Troubleshooting

### Version Compatibility

If you see log parsing errors or connection issues:

1. **Check your pomerium-cli version:**
   ```bash
   pomerium-cli --version
   ```

2. **If < v0.29.0:**
   - Update to v0.29.0+ from https://github.com/pomerium/cli/releases
   - OR use `connect-pomerium@1.x`: `npm install connect-pomerium@1.0.1`

3. **If already v0.29.0+** and still having issues, please [open an issue](https://github.com/oharu121/connect-pomerium/issues)

### Binary Not Found

If you see `BinaryNotFoundError`, the Pomerium CLI binary might not be accessible. You can provide a custom path:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: '...',
  listenPort: 8443,
  cliPath: '/custom/path/to/pomerium-cli',
});
```

### Connection Timeout

If connections timeout frequently, increase the timeout:

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: '...',
  listenPort: 8443,
  connectionTimeout: 120000, // 2 minutes
});
```

### Authentication Fails

If automated authentication fails:
1. Check your credentials are correct
2. Verify the auth flow by running with manual auth first
3. Add error handling in your `onAuthRequired` callback
4. Check Pomerium CLI logs (they're output to console by default)

### macOS Quarantine

On macOS, if the binary is quarantined by Gatekeeper, the library automatically removes the quarantine attribute. If you still have issues, manually run:

```bash
xattr -d com.apple.quarantine bin/pomerium-cli-darwin-*
```

## Platform Support

| Platform | Architecture | Binary Included |
|----------|-------------|-----------------|
| Windows  | x64         | ✅              |
| macOS    | x64 (Intel) | ✅              |
| macOS    | arm64 (M1+) | ✅              |
| Linux    | x64         | ✅              |

## TypeScript Support

This library is written in TypeScript and provides full type definitions. All configuration options, methods, and errors are fully typed.

```typescript
import type { PomeriumTunnelConfig, TunnelState } from 'connect-pomerium';
```

## Error Handling

The library exports custom error classes for different failure scenarios:

```typescript
import {
  PomeriumError,           // Base error class
  ConnectionTimeoutError,  // Connection establishment timeout
  BinaryNotFoundError,     // Pomerium CLI binary not found
  ProcessExitError,        // Process exited unexpectedly
  ProcessStartError,       // Failed to start process
  AuthenticationError,     // Authentication callback failed
} from 'connect-pomerium';

try {
  await tunnel.start();
} catch (error) {
  if (error instanceof ConnectionTimeoutError) {
    console.error('Connection timed out');
  } else if (error instanceof AuthenticationError) {
    console.error('Auth failed');
  }
}
```

## FAQ

### Why no Playwright/Puppeteer dependency?

We keep the library dependency-free so you can choose your own browser automation tool (or none at all). This keeps the package size small (~10MB with binaries) instead of bloated (~200MB with Playwright).

### Should I use auto-reconnect?

**For CI/CD**: Usually no. You want explicit failures so you can debug issues.
**For long-running processes**: Yes. Enable it with reasonable retry limits.
**For local development**: Depends on your workflow.

### Can I create multiple tunnels?

Yes! Create multiple `PomeriumTunnel` instances with different ports:

```typescript
const dbTunnel = new PomeriumTunnel({ targetHost: '...', listenPort: 5432 });
const apiTunnel = new PomeriumTunnel({ targetHost: '...', listenPort: 8443 });

await Promise.all([dbTunnel.start(), apiTunnel.start()]);
```

### Is this a replacement for Pomerium?

No. This library is specifically for **automation scenarios** (testing, CI/CD, scripts). For production Pomerium deployments, use the official Pomerium installation methods.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
npm run format
```

### Validate Package Exports

```bash
npm run check:exports
```

## Release Workflow

This package uses automated publishing via GitHub Actions.

### Creating a Release

1. **Make your changes** and commit them
2. **Update the version:**
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```
3. **Push the changes and tags:**
   ```bash
   git push && git push --tags
   ```
4. **Package automatically publishes to npm** 🎉

## License

MIT © oharu121

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Issues

If you encounter any issues, please report them at [GitHub Issues](https://github.com/oharu121/connect-pomerium/issues).

## Support

- **Issues**: [GitHub Issues](https://github.com/oharu121/connect-pomerium/issues)
- **Pomerium Docs**: [pomerium.com/docs](https://www.pomerium.com/docs/)
