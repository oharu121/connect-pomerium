import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BinaryNotFoundError } from '../errors.js';

/**
 * Resolves the path to the Pomerium CLI binary
 * @param customPath Optional custom path to the binary
 * @returns Absolute path to the Pomerium CLI binary
 * @throws {BinaryNotFoundError} If the binary cannot be found
 */
export function resolveBinaryPath(customPath?: string): string {
  // If custom path is provided, validate and use it
  if (customPath) {
    if (!fs.existsSync(customPath)) {
      throw new BinaryNotFoundError(customPath);
    }
    return path.resolve(customPath);
  }

  // Auto-detect based on platform and architecture
  const platform = os.platform();
  const arch = os.arch();

  let binaryName: string;

  if (platform === 'win32') {
    binaryName = 'pomerium-cli-windows-amd64.exe';
  } else if (platform === 'darwin') {
    binaryName = arch === 'arm64'
      ? 'pomerium-cli-darwin-arm64'
      : 'pomerium-cli-darwin-amd64';
  } else if (platform === 'linux') {
    binaryName = 'pomerium-cli-linux-amd64';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Resolve path relative to this file
  // In development: src/utils/binary-resolver.ts -> ../../bin/
  // In production (compiled): dist/index.js -> ../bin/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const binPath = path.resolve(__dirname, '../bin', binaryName);

  if (!fs.existsSync(binPath)) {
    throw new BinaryNotFoundError(binPath);
  }

  return binPath;
}

/**
 * Gets the binary name for the current platform
 * Useful for testing or informational purposes
 */
export function getBinaryName(): string {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'win32') {
    return 'pomerium-cli-windows-amd64.exe';
  } else if (platform === 'darwin') {
    return arch === 'arm64'
      ? 'pomerium-cli-darwin-arm64'
      : 'pomerium-cli-darwin-amd64';
  } else if (platform === 'linux') {
    return 'pomerium-cli-linux-amd64';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}
