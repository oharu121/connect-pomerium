import { describe, it, expect } from 'vitest';
import { parsePomeriumLog, extractAuthUrl, PomeriumLogEntry } from './log-parser.js';

describe('parsePomeriumLog', () => {
  it('should parse valid JSON log entry', () => {
    const line =
      '{"level":"info","component":"tunnel","addr":"[::]:8443","time":"2025-11-23T00:43:55+09:00","message":"started tcp listener"}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe('info');
    expect(result?.message).toBe('started tcp listener');
    expect(result?.component).toBe('tunnel');
    expect(result?.addr).toBe('[::]:8443');
    expect(result?.time).toBe('2025-11-23T00:43:55+09:00');
  });

  it('should parse connection lifecycle events', () => {
    const testCases: Array<{ line: string; expected: Partial<PomeriumLogEntry> }> = [
      {
        line: '{"level":"info","message":"connecting"}',
        expected: { level: 'info', message: 'connecting' },
      },
      {
        line: '{"level":"info","message":"connected"}',
        expected: { level: 'info', message: 'connected' },
      },
      {
        line: '{"level":"error","error":"connection timeout","message":"disconnected"}',
        expected: { level: 'error', message: 'disconnected', error: 'connection timeout' },
      },
    ];

    for (const { line, expected } of testCases) {
      const result = parsePomeriumLog(line);
      expect(result).not.toBeNull();
      expect(result?.level).toBe(expected.level);
      expect(result?.message).toBe(expected.message);
      if (expected.error) {
        expect(result?.error).toBe(expected.error);
      }
    }
  });

  it('should parse auth required event with URL', () => {
    const line =
      '{"level":"info","auth-url":"https://authenticate.example.com/oauth/start","message":"auth required"}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe('info');
    expect(result?.message).toBe('auth required');
    expect(result?.['auth-url']).toBe('https://authenticate.example.com/oauth/start');
  });

  it('should parse signal event', () => {
    const line =
      '{"level":"error","signal":"interrupt","time":"2025-11-23T00:44:15+09:00","message":"caught signal, quitting..."}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe('error');
    expect(result?.message).toBe('caught signal, quitting...');
    expect(result?.signal).toBe('interrupt');
  });

  it('should parse error logs with error field', () => {
    const line =
      '{"level":"error","component":"tunnel","error":"connection refused","message":"error serving local connection"}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe('error');
    expect(result?.message).toBe('error serving local connection');
    expect(result?.error).toBe('connection refused');
    expect(result?.component).toBe('tunnel');
  });

  it('should parse protocol selection logs', () => {
    const testCases = [
      {
        line: '{"level":"info","component":"pick-tcp-tunneler","message":"tls not enabled, using http1"}',
        message: 'tls not enabled, using http1',
      },
      {
        line: '{"level":"info","component":"pick-tcp-tunneler","message":"using http3"}',
        message: 'using http3',
      },
    ];

    for (const { line, message } of testCases) {
      const result = parsePomeriumLog(line);
      expect(result).not.toBeNull();
      expect(result?.component).toBe('pick-tcp-tunneler');
      expect(result?.message).toBe(message);
    }
  });

  it('should handle log entries with additional fields', () => {
    const line =
      '{"level":"warn","component":"http3tunneler","max_datagram_payload_size":1200,"datagram_size":1300,"message":"datagram exceeded max datagram payload size and was dropped"}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.level).toBe('warn');
    expect(result?.component).toBe('http3tunneler');
    expect(result?.max_datagram_payload_size).toBe(1200);
    expect(result?.datagram_size).toBe(1300);
  });

  it('should return null for invalid JSON', () => {
    const invalidLines = [
      'not json at all',
      '{incomplete json',
      '{"level":"info"', // incomplete
      '',
      '   ', // whitespace
    ];

    for (const line of invalidLines) {
      const result = parsePomeriumLog(line);
      expect(result).toBeNull();
    }
  });

  it('should return null for JSON without required fields', () => {
    const invalidLogs = [
      '{"level":"info"}', // missing message
      '{"message":"test"}', // missing level
      '{}', // empty object
      '[]', // array
      'null', // null
      '123', // number
      '"string"', // string
    ];

    for (const line of invalidLogs) {
      const result = parsePomeriumLog(line);
      expect(result).toBeNull();
    }
  });

  it('should handle multiline log chunk', () => {
    const chunk = `{"level":"info","message":"connecting"}
{"level":"info","message":"connected"}
{"level":"error","message":"disconnected"}`;

    const lines = chunk.split('\n');
    const results = lines.map((line) => parsePomeriumLog(line));

    expect(results[0]?.message).toBe('connecting');
    expect(results[1]?.message).toBe('connected');
    expect(results[2]?.message).toBe('disconnected');
  });

  it('should preserve unknown fields for future compatibility', () => {
    const line = '{"level":"info","message":"test","custom_field":"value","nested":{"data":"test"}}';
    const result = parsePomeriumLog(line);

    expect(result).not.toBeNull();
    expect(result?.custom_field).toBe('value');
    expect(result?.nested).toEqual({ data: 'test' });
  });
});

describe('extractAuthUrl', () => {
  it('should extract HTTPS URL from plain text', () => {
    const line = 'Your browser has been opened to visit:\n\nhttps://auth.example.com/oauth/start\n\n';
    const result = extractAuthUrl(line);

    expect(result).toBe('https://auth.example.com/oauth/start');
  });

  it('should extract HTTP URL from plain text', () => {
    const line = 'Please visit: http://localhost:8080/auth';
    const result = extractAuthUrl(line);

    expect(result).toBe('http://localhost:8080/auth');
  });

  it('should extract URL with query parameters', () => {
    const line =
      'Auth URL: https://authenticate.corp.com/oauth/start?redirect_uri=https%3A%2F%2Fapp.com&state=abc123';
    const result = extractAuthUrl(line);

    expect(result).toBe(
      'https://authenticate.corp.com/oauth/start?redirect_uri=https%3A%2F%2Fapp.com&state=abc123'
    );
  });

  it('should extract first URL if multiple are present', () => {
    const line = 'Visit https://first.com or https://second.com';
    const result = extractAuthUrl(line);

    expect(result).toBe('https://first.com');
  });

  it('should return null if no URL is present', () => {
    const invalidLines = [
      'No URL here',
      '',
      '   ',
      'http:/incomplete',
      'not a url: htp://wrong.com',
    ];

    for (const line of invalidLines) {
      const result = extractAuthUrl(line);
      expect(result).toBeNull();
    }
  });

  it('should handle URL at start of line', () => {
    const line = 'https://auth.example.com followed by text';
    const result = extractAuthUrl(line);

    expect(result).toBe('https://auth.example.com');
  });

  it('should handle URL at end of line', () => {
    const line = 'Text before URL: https://auth.example.com';
    const result = extractAuthUrl(line);

    expect(result).toBe('https://auth.example.com');
  });

  it('should stop at whitespace and newlines', () => {
    const line = 'URL: https://example.com\n\nMore text';
    const result = extractAuthUrl(line);

    expect(result).toBe('https://example.com');
  });

  it('should handle real browser message format', () => {
    const realMessage = `
Your browser has been opened to visit:

https://authenticate.pomerium.io/.pomerium/api/v1/login?pomerium_redirect_uri=https%3A%2F%2Fverify.pomerium.com%2F

`;
    const result = extractAuthUrl(realMessage);

    expect(result).not.toBeNull();
    expect(result).toContain('https://authenticate.pomerium.io');
    expect(result).toContain('pomerium_redirect_uri');
  });
});
