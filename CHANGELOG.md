# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
