import net from 'node:net';

/**
 * Tests if a local port is accepting connections.
 * This is used for debugging and validation purposes.
 *
 * @param port The port number to test
 * @param host The host to test (default: 'localhost')
 * @returns A promise that resolves if connection succeeds, rejects if it fails
 *
 * @example
 * try {
 *   await testLocalConnection(5432);
 *   console.log('Port 5432 is accepting connections');
 * } catch (error) {
 *   console.error('Port 5432 is not accepting connections');
 * }
 */
export function testLocalConnection(
  port: number,
  host: string = 'localhost'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host });

    socket.on('connect', () => {
      socket.end();
      resolve();
    });

    socket.on('error', (err) => {
      reject(err);
    });

    // Timeout after 5 seconds
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('Connection test timed out'));
    });
  });
}
