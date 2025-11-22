import { describe, it, expect } from 'vitest';
import {
  PomeriumTunnel,
  PomeriumError,
  ConnectionTimeoutError,
  BinaryNotFoundError,
  ProcessExitError,
  ProcessStartError,
  AuthenticationError,
} from './index.js';
import type { PomeriumTunnelConfig, TunnelState } from './index.js';

describe('Public API exports', () => {
  describe('PomeriumTunnel class', () => {
    it('should export PomeriumTunnel class', () => {
      expect(PomeriumTunnel).toBeDefined();
      expect(typeof PomeriumTunnel).toBe('function');
    });

    it('should be instantiable with config', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(tunnel).toBeInstanceOf(PomeriumTunnel);
    });

    it('should have start method', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(typeof tunnel.start).toBe('function');
    });

    it('should have stop method', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(typeof tunnel.stop).toBe('function');
    });

    it('should have getState method', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(typeof tunnel.getState).toBe('function');
    });

    it('should have isConnected method', () => {
      const tunnel = new PomeriumTunnel({
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      });

      expect(typeof tunnel.isConnected).toBe('function');
    });
  });

  describe('Error class exports', () => {
    it('should export PomeriumError', () => {
      expect(PomeriumError).toBeDefined();
      const error = new PomeriumError('test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('PomeriumError');
      expect(error.message).toBe('test error');
    });

    it('should export ConnectionTimeoutError', () => {
      expect(ConnectionTimeoutError).toBeDefined();
      const error = new ConnectionTimeoutError(60000);
      expect(error).toBeInstanceOf(PomeriumError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConnectionTimeoutError');
      expect(error.message).toContain('60000');
    });

    it('should export BinaryNotFoundError', () => {
      expect(BinaryNotFoundError).toBeDefined();
      const error = new BinaryNotFoundError('/path/to/binary');
      expect(error).toBeInstanceOf(PomeriumError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('BinaryNotFoundError');
      expect(error.message).toContain('/path/to/binary');
    });

    it('should export ProcessExitError', () => {
      expect(ProcessExitError).toBeDefined();
      const error = new ProcessExitError(1);
      expect(error).toBeInstanceOf(PomeriumError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProcessExitError');
      expect(error.exitCode).toBe(1);
    });

    it('should export ProcessStartError', () => {
      expect(ProcessStartError).toBeDefined();
      const error = new ProcessStartError('Failed to start');
      expect(error).toBeInstanceOf(PomeriumError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProcessStartError');
      expect(error.message).toContain('Failed to start');
    });

    it('should export AuthenticationError', () => {
      expect(AuthenticationError).toBeDefined();
      const error = new AuthenticationError('Auth failed');
      expect(error).toBeInstanceOf(PomeriumError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toContain('Auth failed');
    });
  });

  describe('Type exports', () => {
    it('should allow PomeriumTunnelConfig type to be used', () => {
      const config: PomeriumTunnelConfig = {
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
      };

      expect(config.targetHost).toBe('tcp+https://example.com:443');
      expect(config.listenPort).toBe(8443);
    });

    it('should allow PomeriumTunnelConfig with all optional fields', () => {
      const config: PomeriumTunnelConfig = {
        targetHost: 'tcp+https://example.com:443',
        listenPort: 8443,
        cliPath: '/custom/path',
        onAuthRequired: async () => {},
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 3000,
        connectionTimeout: 120000,
        onConnected: () => {},
        onDisconnected: () => {},
        onReconnecting: () => {},
        onReconnectFailed: () => {},
        onError: () => {},
      };

      expect(config).toBeDefined();
    });

    it('should allow TunnelState type to be used', () => {
      const state: TunnelState = {
        connected: false,
        reconnecting: false,
        reconnectAttempts: 0,
      };

      expect(state.connected).toBe(false);
      expect(state.reconnecting).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
    });
  });

  describe('Package metadata', () => {
    it('should have correct module structure', () => {
      // Verify main exports are available
      expect(PomeriumTunnel).toBeDefined();
      expect(PomeriumError).toBeDefined();

      // Verify error hierarchy
      const error = new ConnectionTimeoutError(1000);
      expect(error instanceof PomeriumError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });
  });
});
