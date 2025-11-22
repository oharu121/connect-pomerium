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
  let mockProcess: EventEmitter & { kill: ReturnType<typeof vi.fn>; stderr: EventEmitter };
  let spawn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock child process
    mockProcess = new EventEmitter();
    mockProcess.kill = vi.fn();
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

      // Simulate connection established
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        '/mock/path/to/pomerium-cli',
        ['tcp', 'tcp+https://db.example.com:5432', '--listen', ':5432']
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);

      await startPromise;

      expect(spawn).toHaveBeenCalledWith(
        '/mock/path/to/pomerium-cli',
        expect.arrayContaining(['--browser-cmd', 'true'])
      );
    });

    it('should not suppress browser when onAuthRequired is not provided', async () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://api.example.com:443',
        listenPort: 8443,
      });

      const startPromise = tunnel.start();

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit(
          'data',
          Buffer.from('Please authenticate: https://auth.example.com/login')
        );
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stderr.emit('data', Buffer.from('connection closed'));

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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stderr.emit('data', Buffer.from('connection closed'));

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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);
      await startPromise;

      // Clear spawn mock to track reconnection
      vi.mocked(spawn).mockClear();

      // Simulate connection loss
      mockProcess.stderr.emit('data', Buffer.from('connection closed'));

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
        mockProcess.stderr.emit('data', Buffer.from('connection established'));
      }, 10);
      await startPromise;

      // Simulate connection loss
      mockProcess.stderr.emit('data', Buffer.from('connection closed'));

      // Wait for reconnection attempts to start
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have attempted reconnection at least once
      expect(onReconnecting).toHaveBeenCalled();
      // Verify reconnection was attempted with attempt number
      expect(onReconnecting.mock.calls[0][0]).toBeGreaterThan(0);
    });
  });
});
