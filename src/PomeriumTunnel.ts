import { spawn, ChildProcess, execSync } from 'node:child_process';
import os from 'node:os';
import type { PomeriumTunnelConfig, TunnelState } from './types.js';
import {
  ConnectionTimeoutError,
  ProcessExitError,
  ProcessStartError,
  AuthenticationError,
} from './errors.js';
import { resolveBinaryPath } from './utils/binary-resolver.js';
import { getBrowserSuppressCommand } from './utils/browser-suppressor.js';
import { testLocalConnection } from './utils/connection-tester.js';

/**
 * Manages a Pomerium tunnel connection
 *
 * @example
 * ```typescript
 * const tunnel = new PomeriumTunnel({
 *   targetHost: 'tcp+https://db.corp.pomerium.io:5432',
 *   listenPort: 5432,
 * });
 *
 * await tunnel.start();
 * console.log('Tunnel connected!');
 * await tunnel.stop();
 * ```
 */
export class PomeriumTunnel {
  private config: PomeriumTunnelConfig & {
    autoReconnect: boolean;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    connectionTimeout: number;
    onConnected: () => void;
    onDisconnected: () => void;
    onReconnecting: (attempt: number) => void;
    onReconnectFailed: () => void;
    onError: (error: Error) => void;
  };
  private process: ChildProcess | null = null;
  private state: TunnelState = {
    connected: false,
    reconnecting: false,
    reconnectAttempts: 0,
  };
  private startPromise: Promise<void> | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shuttingDown = false;
  private signalHandlers: Map<NodeJS.Signals, NodeJS.SignalsListener> = new Map();

  constructor(config: PomeriumTunnelConfig) {
    // Merge config with defaults
    this.config = {
      targetHost: config.targetHost,
      listenPort: config.listenPort,
      cliPath: config.cliPath,
      onAuthRequired: config.onAuthRequired,
      autoReconnect: config.autoReconnect ?? false,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 0,
      reconnectDelay: config.reconnectDelay ?? 5000,
      connectionTimeout: config.connectionTimeout ?? 60000,
      onConnected: config.onConnected ?? (() => {}),
      onDisconnected: config.onDisconnected ?? (() => {}),
      onReconnecting: config.onReconnecting ?? (() => {}),
      onReconnectFailed: config.onReconnectFailed ?? (() => {}),
      onError: config.onError ?? (() => {}),
    };
  }

  /**
   * Starts the Pomerium tunnel
   * @returns A promise that resolves when the tunnel is connected
   * @throws {ConnectionTimeoutError} If connection establishment times out
   * @throws {ProcessStartError} If the process fails to start
   * @throws {ProcessExitError} If the process exits unexpectedly
   */
  public async start(): Promise<void> {
    // If an operation is already in progress, wait for it to complete
    if (this.startPromise) {
      return this.startPromise;
    }

    // If already connected, resolve immediately
    if (this.state.connected) {
      return Promise.resolve();
    }

    // Start a new connection
    this.startPromise = this.initProcess();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  /**
   * Stops the Pomerium tunnel
   */
  public async stop(): Promise<void> {
    this.shuttingDown = true;
    this.state.reconnecting = false;

    // Clear any pending reconnect
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Remove signal handlers
    this.removeSignalHandlers();

    // Kill the process
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Reset state
    this.state.connected = false;
    this.state.reconnectAttempts = 0;
    this.startPromise = null;
    this.shuttingDown = false;
  }

  /**
   * Gets the current state of the tunnel
   * @returns The current tunnel state
   */
  public getState(): Readonly<TunnelState> {
    return { ...this.state };
  }

  /**
   * Checks if the tunnel is currently connected
   * @returns True if connected, false otherwise
   */
  public isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Initializes and spawns the Pomerium process
   */
  private async initProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Resolve binary path
        const binaryPath = resolveBinaryPath(this.config.cliPath);

        // On macOS, ensure the binary is executable and not quarantined
        if (os.platform() === 'darwin') {
          try {
            execSync(`chmod +x "${binaryPath}"`);
            execSync(`xattr -d com.apple.quarantine "${binaryPath}" 2>/dev/null || true`);
          } catch (err) {
            // Ignore errors (file might not have quarantine attribute)
          }
        }

        // Build command arguments
        const args = ['tcp', this.config.targetHost];

        // If onAuthRequired is provided, suppress browser and handle auth via callback
        if (this.config.onAuthRequired) {
          args.push('--browser-cmd', getBrowserSuppressCommand());
        }

        args.push('--listen', `:${this.config.listenPort}`);

        // Spawn the process
        this.process = spawn(binaryPath, args);

        let connectionEstablished = false;

        // Handle stderr (Pomerium outputs logs to stderr)
        this.process.stderr?.on('data', async (chunk) => {
          const message = chunk.toString();
          console.log(message); // Log for debugging

          // Check if listening
          if (message.includes('listening on')) {
            // Test connection for validation
            testLocalConnection(this.config.listenPort).catch((err) => {
              console.error(`Local connection test failed: ${err.message}`);
            });
          }

          // Extract auth URL and invoke callback if provided
          if (message.includes('https')) {
            const match = message.match(/https?:\/\/[^\s]+/g);
            if (match && match[0] && this.config.onAuthRequired) {
              try {
                await this.config.onAuthRequired(match[0]);
              } catch (err) {
                const authError = new AuthenticationError(
                  err instanceof Error ? err.message : String(err)
                );
                this.config.onError?.(authError);
                // Don't reject here, wait for process to handle auth failure
              }
            }
          }

          // Check if connection is established
          if (message.includes('connection established') && !connectionEstablished) {
            connectionEstablished = true;
            this.state.connected = true;
            this.state.reconnecting = false;
            this.state.reconnectAttempts = 0;

            // Clear connection timeout
            if (this.connectionTimeout) {
              clearTimeout(this.connectionTimeout);
              this.connectionTimeout = null;
            }

            // Setup signal handlers for graceful shutdown
            this.setupSignalHandlers();

            // Invoke connected callback
            this.config.onConnected?.();

            resolve();
          }

          // Handle connection closed (for reconnection)
          if (message.includes('connection closed') && this.state.connected) {
            this.state.connected = false;
            this.config.onDisconnected?.();

            // Attempt reconnection if enabled and not shutting down
            if (this.config.autoReconnect && !this.shuttingDown) {
              this.attemptReconnect();
            }
          }
        });

        // Handle process close
        this.process.on('close', (code) => {
          if (code !== 0 && !connectionEstablished && !this.shuttingDown) {
            const error = new ProcessExitError(code ?? -1);
            this.config.onError?.(error);
            reject(error);
          } else if (code === 0 && !connectionEstablished && !this.shuttingDown) {
            const error = new ProcessExitError(0);
            this.config.onError?.(error);
            reject(error);
          }

          // If connection was established and process closed unexpectedly
          if (connectionEstablished && !this.shuttingDown) {
            this.state.connected = false;
            this.config.onDisconnected?.();

            if (this.config.autoReconnect) {
              this.attemptReconnect();
            }
          }
        });

        // Handle process error
        this.process.on('error', (err) => {
          const error = new ProcessStartError(err.message);
          this.config.onError?.(error);
          reject(error);
        });

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (!connectionEstablished) {
            this.process?.kill();
            const error = new ConnectionTimeoutError(this.config.connectionTimeout);
            this.config.onError?.(error);
            reject(error);
          }
        }, this.config.connectionTimeout);

        // Clear timeout on process close or error
        this.process.once('close', () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
        });
        this.process.once('error', () => {
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }
        });
      } catch (err) {
        const error = new ProcessStartError(
          err instanceof Error ? err.message : String(err)
        );
        this.config.onError?.(error);
        reject(error);
      }
    });
  }

  /**
   * Attempts to reconnect the tunnel
   */
  private attemptReconnect(): void {
    // Check if we've exceeded max attempts (0 = infinite)
    if (
      this.config.maxReconnectAttempts > 0 &&
      this.state.reconnectAttempts >= this.config.maxReconnectAttempts
    ) {
      this.config.onReconnectFailed?.();
      return;
    }

    this.state.reconnecting = true;
    this.state.reconnectAttempts++;

    this.config.onReconnecting?.(this.state.reconnectAttempts);

    // Schedule reconnection
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.start();
      } catch (err) {
        // If reconnection fails, try again
        if (this.config.autoReconnect && !this.shuttingDown) {
          this.attemptReconnect();
        }
      }
    }, this.config.reconnectDelay);
  }

  /**
   * Sets up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      const handler: NodeJS.SignalsListener = () => {
        this.stop().then(() => {
          process.exit(0);
        });
      };

      process.on(signal, handler);
      this.signalHandlers.set(signal, handler);
    }
  }

  /**
   * Removes signal handlers
   */
  private removeSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers) {
      process.off(signal, handler);
    }
    this.signalHandlers.clear();
  }
}
