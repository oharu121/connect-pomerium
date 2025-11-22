import { describe, it, expect, vi } from 'vitest';
import os from 'node:os';
import { getBrowserSuppressCommand } from './browser-suppressor.js';

describe('browser-suppressor', () => {
  describe('getBrowserSuppressCommand', () => {
    it('should return "cmd /c exit" for Windows', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      expect(getBrowserSuppressCommand()).toBe('cmd /c exit');
    });

    it('should return "true" for macOS', () => {
      vi.spyOn(os, 'platform').mockReturnValue('darwin');
      expect(getBrowserSuppressCommand()).toBe('true');
    });

    it('should return "true" for Linux', () => {
      vi.spyOn(os, 'platform').mockReturnValue('linux');
      expect(getBrowserSuppressCommand()).toBe('true');
    });

    it('should return "true" for any Unix-like system', () => {
      vi.spyOn(os, 'platform').mockReturnValue('freebsd' as NodeJS.Platform);
      expect(getBrowserSuppressCommand()).toBe('true');
    });

    it('should consistently return the same value for the same platform', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      const first = getBrowserSuppressCommand();
      const second = getBrowserSuppressCommand();
      expect(first).toBe(second);
    });
  });
});
