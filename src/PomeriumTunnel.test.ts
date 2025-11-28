import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PomeriumTunnel } from './PomeriumTunnel.js';
import {
  ConnectionTimeoutError,
  ProcessExitError,
  ProcessStartError,
} from './errors.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock utilities
vi.mock('./utils/binary-resolver.js', () => ({
  resolveBinaryPath: vi.fn(() => '/mock/path/to/pomerium-cli'),
}));

vi.mock('./utils/browser-suppressor.js', () => ({
  getBrowserSuppressCommand: vi.fn(() => 'true'),
}));

vi.mock('./utils/connection-tester.js', () => ({
  testLocalConnection: vi.fn(() => Promise.resolve()),
}));

describe('PomeriumTunnel', () => {
  let mockProcess: EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };
  let spawn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock child process
    mockProcess = new EventEmitter();
    mockProcess.kill = vi.fn();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();

    // Mock spawn to return our mock process
    const { spawn: spawnMock } = await import('node:child_process');
    spawn = spawnMock;
    vi.mocked(spawn).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with required config', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(tunnel).toBeInstanceOf(PomeriumTunnel);
      expect(tunnel.isConnected()).toBe(false);
    });

    it('should apply default config values', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      const state = tunnel.getState();
      expect(state.connected).toBe(false);
      expect(state.reconnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
    });
  });

  describe('start', () => {
    it('should spawn Pomerium process with correct arguments', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://db.example.com:5432',
        listenPort: 5432,
      });

      // Start tunnel but don't wait for connection
      const startPromise = tunnel.start();

      // Simulate connection established (JSON format from v0.29.0+)
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        '/mock/path/to/pomerium-cli',
        ['tcp', 'tcp+https://db.example.com:5432', '--listen', ':5432'],
        expect.objectContaining({ env: expect.any(Object) })
      );
    });

    it('should suppress browser when onAuthRequired is provided', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onAuthRequired: vi.fn(),
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        '/mock/path/to/pomerium-cli',
        expect.arrayContaining(['--browser-cmd', 'true']),
        expect.objectContaining({ env: expect.any(Object) })
      );
    });

    it('should not suppress browser when onAuthRequired is not provided', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await startPromise;

      const spawnArgs = spawn.mock.calls[0][1];
      expect(spawnArgs).not.toContain('--browser-cmd');
    });

    it('should invoke onAuthRequired callback when auth URL is detected', async () => {
      const onAuthRequired = vi.fn().mockResolvedValue(undefined);
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onAuthRequired,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        // Auth required in JSON format (v0.29.0+)
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            '{"level":"info","auth-url":"https://auth.example.com/login","message":"auth required"}\n'
          )
        );
        // Then connection established
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await startPromise;

      expect(onAuthRequired).toHaveBeenCalledWith('https://auth.example.com/login');
    });

    it('should invoke onConnected callback when connection is established', async () => {
      const onConnected = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onConnected,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await startPromise;

      expect(onConnected).toHaveBeenCalled();
      expect(tunnel.isConnected()).toBe(true);
    });

    it('should timeout if connection is not established', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        connectionTimeout: 100, // Short timeout for testing
      });

      await expect(tunnel.start()).rejects.toThrow(ConnectionTimeoutError);
    });

    it('should reject if process exits with error code', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);

      await expect(startPromise).rejects.toThrow(ProcessExitError);
    });

    it('should be idempotent - multiple calls wait for same operation', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise1 = tunnel.start();
      const startPromise2 = tunnel.start();
      const startPromise3 = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);

      await Promise.all([startPromise1, startPromise2, startPromise3]);

      // Should only spawn once
      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should resolve immediately if already connected', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      // First connection
      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      // Second call should resolve immediately
      const start2 = await tunnel.start();
      expect(start2).toBeUndefined();
      expect(spawn).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('stop', () => {
    it('should kill the process', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      await tunnel.stop();

      expect(mockProcess.kill).toHaveBeenCalled();
      expect(tunnel.isConnected()).toBe(false);
    });

    it('should reset connection state', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      await tunnel.stop();

      const state = tunnel.getState();
      expect(state.connected).toBe(false);
      expect(state.reconnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should be safe to call multiple times', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      await tunnel.stop();
      await tunnel.stop();
      await tunnel.stop();

      // Should not throw
      expect(mockProcess.kill).not.toHaveBeenCalled(); // No process to kill
    });
  });

  describe('getState', () => {
    it('should return current tunnel state', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const state = tunnel.getState();

      expect(state).toEqual({
        connected: false,
        reconnecting: false,
        reconnectAttempts: 0,
      });
    });

    it('should reflect connected state after connection', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      const state = tunnel.getState();
      expect(state.connected).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      expect(tunnel.isConnected()).toBe(false);
    });

    it('should return true after connection established', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      expect(tunnel.isConnected()).toBe(true);
    });

    it('should return false after stop', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      await tunnel.stop();

      expect(tunnel.isConnected()).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    it('should invoke onError when error occurs', async () => {
      const onError = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onError,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed to start'));
      }, 10);

      await expect(startPromise).rejects.toThrow(ProcessStartError);
      expect(onError).toHaveBeenCalled();
    });

    it('should invoke onDisconnected when connection is lost', async () => {
      const onDisconnected = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onDisconnected,
        autoReconnect: false,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stdout.emit(
        'data',
        Buffer.from('{"level":"error","message":"disconnected","time":"2025-11-23T00:44:15+09:00"}\n')
      );

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onDisconnected).toHaveBeenCalled();
    });
  });

  describe('auto-reconnect', () => {
    it('should not reconnect by default when connection is lost', async () => {
      const onReconnecting = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        onReconnecting,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stdout.emit(
        'data',
        Buffer.from('{"level":"error","message":"disconnected","time":"2025-11-23T00:44:15+09:00"}\n')
      );

      // Wait for potential reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onReconnecting).not.toHaveBeenCalled();
    });

    it('should reconnect when autoReconnect is enabled', async () => {
      const onReconnecting = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        autoReconnect: true,
        reconnectDelay: 50, // Short delay for testing
        onReconnecting,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      // Clear spawn mock to track reconnection
      vi.mocked(spawn).mockClear();

      // Simulate connection loss
      mockProcess.stdout.emit(
        'data',
        Buffer.from('{"level":"error","message":"disconnected","time":"2025-11-23T00:44:15+09:00"}\n')
      );

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onReconnecting).toHaveBeenCalledWith(1);
    });

    it('should respect maxReconnectAttempts', async () => {
      const onReconnectFailed = vi.fn();
      const onReconnecting = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 50,
        onReconnectFailed,
        onReconnecting,
      });

      const startPromise = tunnel.start();
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected","time":"2025-11-23T00:43:55+09:00"}\n')
        );
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stdout.emit(
        'data',
        Buffer.from('{"level":"error","message":"disconnected","time":"2025-11-23T00:44:15+09:00"}\n')
      );

      // Wait for reconnection attempts to start
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have attempted reconnection at least once
      expect(onReconnecting).toHaveBeenCalled();
      // Verify reconnection was attempted with attempt number
      expect(onReconnecting.mock.calls[0][0]).toBeGreaterThan(0);
    });
  });

  describe('JSON log parsing (v0.29.0+)', () => {
    it('should handle multiple JSON log entries in single chunk', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        // Simulate multiple log entries in one chunk
        const multiLineLog = [
          '{"level":"info","component":"tunnel","addr":"[::]:8443","message":"started tcp listener"}',
          '{"level":"info","message":"connecting"}',
          '{"level":"info","message":"connected"}',
        ].join('\n');

        mockProcess.stdout.emit('data', Buffer.from(multiLineLog + '\n'));
      }, 10);

      await startPromise;
      expect(tunnel.isConnected()).toBe(true);
    });

    it('should handle plain text fallback for auth URL', async () => {
      const onAuthRequired = vi.fn(async () => {});
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
        onAuthRequired,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        // Simulate plain text browser message (not JSON)
        mockProcess.stdout.emit(
          'data',
          Buffer.from('Your browser has been opened to visit:\n\nhttps://auth.example.com/oauth/start\n\n')
        );
        // Then connection
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;
      expect(onAuthRequired).toHaveBeenCalledWith('https://auth.example.com/oauth/start');
    });

    it('should extract listener address from JSON log', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            '{"level":"info","component":"tunnel","addr":"[::]:8443","message":"started tcp listener"}\n'
          )
        );
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;
      expect(tunnel.isConnected()).toBe(true);
    });

    it('should handle empty lines in log output', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        // Simulate output with empty lines
        mockProcess.stdout.emit(
          'data',
          Buffer.from('\n{"level":"info","message":"connected"}\n\n')
        );
      }, 10);

      await startPromise;
      expect(tunnel.isConnected()).toBe(true);
    });

    it('should pass logLevel to CLI via environment variable', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
        logLevel: 'debug',
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({ LOG_LEVEL: 'debug' }),
        })
      );
    });

    it('should invoke onLog callback for each log entry', async () => {
      const onLog = vi.fn();
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
        onLog,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            '{"level":"info","component":"tunnel","addr":"[::]:8443","message":"started tcp listener"}\n'
          )
        );
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;

      expect(onLog).toHaveBeenCalledTimes(2);
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'started tcp listener',
          component: 'tunnel',
        })
      );
      expect(onLog).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'connected',
        })
      );
    });

    it('should not log stderr by default (debug: false)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('some stderr output'));
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should log stderr when debug: true', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
        debug: true,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('some stderr output'));
        mockProcess.stdout.emit(
          'data',
          Buffer.from('{"level":"info","message":"connected"}\n')
        );
      }, 10);

      await startPromise;

      expect(consoleErrorSpy).toHaveBeenCalledWith('[pomerium-cli stderr]:', 'some stderr output');
      consoleErrorSpy.mockRestore();
    });
  });
});
