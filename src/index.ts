/**
 * connect-pomerium - Automate Pomerium tunnel creation for testing, CI/CD, and automation
 * @packageDocumentation
 */

export { PomeriumTunnel } from './PomeriumTunnel.js';
export type { PomeriumTunnelConfig, TunnelState } from './types.js';
export {
  PomeriumError,
  ConnectionTimeoutError,
  BinaryNotFoundError,
  ProcessExitError,
  ProcessStartError,
  AuthenticationError,
} from './errors.js';
export type { PomeriumLogEntry } from './utils/log-parser.js';
export { parsePomeriumLog, extractAuthUrl } from './utils/log-parser.js';
