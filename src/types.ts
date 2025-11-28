/**
 * Configuration options for PomeriumTunnel
 */
export interface PomeriumTunnelConfig {
  /**
   * The target host to connect to via Pomerium
   * @example 'tcp+https://db.corp.pomerium.io:5432'
   */
  targetHost: string;

  /**
   * The local port to listen on
   * @example 5432
   */
  listenPort: number;

  /**
   * Optional: Custom path to the Pomerium CLI binary
   * If not provided, the bundled binary will be used based on the platform
   * @example '/usr/local/bin/pomerium-cli'
   */
  cliPath?: string;

  /**
   * Optional: Callback to handle authentication when required
   * If provided, browser will be suppressed and this callback will be invoked with the auth URL
   * If not provided, Pomerium CLI will open the browser for manual authentication
   * @example async (authUrl) => { await automateOktaLogin(authUrl); }
   */
  onAuthRequired?: (authUrl: string) => Promise<void>;

  /**
   * Optional: Enable automatic reconnection on connection loss
   * @default false
   */
  autoReconnect?: boolean;

  /**
   * Optional: Maximum number of reconnection attempts
   * Set to 0 for infinite attempts (only applies if autoReconnect is true)
   * @default 0
   */
  maxReconnectAttempts?: number;

  /**
   * Optional: Delay in milliseconds between reconnection attempts
   * @default 5000
   */
  reconnectDelay?: number;

  /**
   * Optional: Timeout in milliseconds for connection establishment
   * @default 60000
   */
  connectionTimeout?: number;

  /**
   * Optional: Callback invoked when tunnel connection is established
   */
  onConnected?: () => void;

  /**
   * Optional: Callback invoked when tunnel connection is lost
   */
  onDisconnected?: () => void;

  /**
   * Optional: Callback invoked when reconnection is being attempted
   * @param attempt The current reconnection attempt number
   */
  onReconnecting?: (attempt: number) => void;

  /**
   * Optional: Callback invoked when all reconnection attempts have failed
   */
  onReconnectFailed?: () => void;

  /**
   * Optional: Callback invoked when an error occurs
   * @param error The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Optional: Callback to receive raw log entries from pomerium-cli
   * Useful for debugging or custom log handling (requires pomerium-cli v0.29.0+)
   * @param log The parsed JSON log entry
   * @example (log) => { console.log('[CLI]', log.level, log.message); }
   */
  onLog?: (log: import('./utils/log-parser.js').PomeriumLogEntry) => void;

  /**
   * Optional: Log level for pomerium-cli output (via LOG_LEVEL environment variable)
   * @default 'info'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Optional: Enable debug logging (pomerium-cli stderr output)
   * @default false
   */
  debug?: boolean;
}

/**
 * Represents the current state of the tunnel
 */
export interface TunnelState {
  /**
   * Whether the tunnel is currently connected
   */
  connected: boolean;

  /**
   * Whether the tunnel is attempting to reconnect
   */
  reconnecting: boolean;

  /**
   * Number of reconnection attempts made
   */
  reconnectAttempts: number;
}
