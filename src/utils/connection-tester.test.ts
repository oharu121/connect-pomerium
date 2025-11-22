import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import { testLocalConnection } from './connection-tester.js';

describe('connection-tester', () => {
  describe('testLocalConnection', () => {
    let mockSocket: {
      on: ReturnType<typeof vi.fn>;
      setTimeout: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      // Create a mock socket with EventEmitter-like behavior
      mockSocket = {
        on: vi.fn(),
        setTimeout: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };

      vi.spyOn(net, 'connect').mockReturnValue(mockSocket as never);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should resolve when connection succeeds', async () => {
      // Simulate successful connection
      mockSocket.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      });

      await expect(testLocalConnection(5432)).resolves.toBeUndefined();
      expect(net.connect).toHaveBeenCalledWith({ port: 5432, host: 'localhost' });
      expect(mockSocket.end).toHaveBeenCalled();
    });

    it('should use custom host when provided', async () => {
      mockSocket.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      });

      await testLocalConnection(8443, '127.0.0.1');
      expect(net.connect).toHaveBeenCalledWith({ port: 8443, host: '127.0.0.1' });
    });

    it('should reject when connection fails', async () => {
      const error = new Error('Connection refused');

      mockSocket.on.mockImplementation((event: string, callback: (err: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(error), 0);
        }
        return mockSocket;
      });

      await expect(testLocalConnection(9999)).rejects.toThrow('Connection refused');
    });

    it('should reject on timeout', async () => {
      mockSocket.setTimeout.mockImplementation((_timeout: number, callback: () => void) => {
        setTimeout(callback, 0);
      });

      mockSocket.on.mockImplementation(() => {
        return mockSocket;
      });

      await expect(testLocalConnection(5432)).rejects.toThrow('Connection test timed out');
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should set timeout to 5 seconds', async () => {
      mockSocket.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      });

      await testLocalConnection(5432);
      expect(mockSocket.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function));
    });

    it('should clean up socket on successful connection', async () => {
      mockSocket.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      });

      await testLocalConnection(5432);
      expect(mockSocket.end).toHaveBeenCalled();
    });

    it('should handle different port numbers', async () => {
      mockSocket.on.mockImplementation((event: string, callback: () => void) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
        return mockSocket;
      });

      await testLocalConnection(3000);
      expect(net.connect).toHaveBeenCalledWith({ port: 3000, host: 'localhost' });

      await testLocalConnection(8080);
      expect(net.connect).toHaveBeenCalledWith({ port: 8080, host: 'localhost' });
    });
  });
});
