/**
 * Base error class for all Pomerium-related errors
 */
export class PomeriumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PomeriumError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when connection establishment times out
 */
export class ConnectionTimeoutError extends PomeriumError {
  constructor(timeout: number) {
    super(`Connection establishment timed out after ${timeout}ms`);
    this.name = 'ConnectionTimeoutError';
  }
}

/**
 * Error thrown when the Pomerium CLI binary cannot be found
 */
export class BinaryNotFoundError extends PomeriumError {
  constructor(path: string) {
    super(`Pomerium CLI binary not found at: ${path}`);
    this.name = 'BinaryNotFoundError';
  }
}

/**
 * Error thrown when the Pomerium process exits unexpectedly
 */
export class ProcessExitError extends PomeriumError {
  public readonly exitCode: number;

  constructor(code: number) {
    super(`Pomerium process exited with code ${code}`);
    this.name = 'ProcessExitError';
    this.exitCode = code;
  }
}

/**
 * Error thrown when the Pomerium process fails to start
 */
export class ProcessStartError extends PomeriumError {
  constructor(message: string) {
    super(`Failed to start Pomerium process: ${message}`);
    this.name = 'ProcessStartError';
  }
}

/**
 * Error thrown when authentication callback fails
 */
export class AuthenticationError extends PomeriumError {
  constructor(message: string) {
    super(`Authentication failed: ${message}`);
    this.name = 'AuthenticationError';
  }
}
