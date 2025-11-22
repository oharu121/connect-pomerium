# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-23

### Breaking Changes

**⚠️ REQUIRES pomerium-cli v0.29.0 or later** (released March 2024)

This release adds full support for the new JSON logging format introduced in pomerium-cli v0.29.0. Older CLI versions (< v0.29.0) are no longer supported.

**What you need to do:**
- Update your pomerium-cli to v0.29.0 or later from https://github.com/pomerium/cli/releases
- OR stay on `connect-pomerium@1.x` (not recommended)

**Good news:** Your code requires **no changes**! The public API remains unchanged.

### Technical Changes

- Changed internal log parsing from plain text to JSON format (zerolog)
- Now listens to stdout instead of stderr for CLI logs (matches v0.29.0+ behavior)
- More reliable connection state detection via structured logs
- Better error message extraction from JSON log entries

### Added

- ✨ **`onLog` callback** - Access raw log entries from pomerium-cli for debugging or custom handling
- ✨ **`logLevel` config** - Control CLI log verbosity (`debug`, `info`, `warn`, `error`)
- 📦 New exports: `PomeriumLogEntry` type, `parsePomeriumLog()`, `extractAuthUrl()` utilities
- 🧪 Enhanced test coverage with 6 new tests for JSON parsing edge cases

### Fixed

- ✅ Log parsing now works correctly with pomerium-cli v0.29.0+
- ✅ Proper detection of connection states (`connected`, `disconnected`, `auth required`)
- ✅ Reliable extraction of structured data (addresses, error details, auth URLs)
- ✅ Handles multiple JSON log entries in single chunk
- ✅ Graceful fallback to plain text for browser auth messages

### Migration Guide

#### If using pomerium-cli < v0.29.0:

**Option 1 (Recommended):** Update pomerium-cli
```bash
# Download v0.29.0+ from GitHub releases
# https://github.com/pomerium/cli/releases

# Verify version
pomerium-cli --version
# Should show v0.29.0 or higher
```

**Option 2:** Stay on connect-pomerium v1.x
```bash
npm install connect-pomerium@1.0.1
```

#### Code Changes

**None required!** Your existing code works as-is:
```typescript
// This still works exactly the same
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://example.com:443',
  listenPort: 8443,
});
await tunnel.start();
```

#### New Optional Features

```typescript
const tunnel = new PomeriumTunnel({
  targetHost: 'tcp+https://example.com:443',
  listenPort: 8443,

  // NEW: Control CLI log level
  logLevel: 'debug',

  // NEW: Access raw logs for debugging
  onLog: (log) => {
    console.log(`[${log.level}] ${log.message}`);
    if (log.error) console.error('Error details:', log.error);
  },
});
```

## [1.0.1]

### Fixed
- Fixed binary path resolution when package is installed as a dependency - the Pomerium CLI binary is now correctly located at `node_modules/connect-pomerium/bin/` instead of incorrectly attempting to find it at `node_modules/bin/`

## [1.0.0] - 2025-01-23

### Added
- Initial release
- Automated Pomerium tunnel creation for testing, CI/CD, and automation
- Cross-platform support (Windows, macOS, Linux)
- TypeScript support with full type definitions
- Headless browser suppression utilities
- Support for custom TCP connections and browser URLs
