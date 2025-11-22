import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBinaryPath, getBinaryName } from './binary-resolver.js';
import { BinaryNotFoundError } from '../errors.js';

describe('binary-resolver', () => {
  describe('getBinaryName', () => {
    let originalPlatform: string;
    let originalArch: string;

    beforeEach(() => {
      originalPlatform = process.platform;
      originalArch = process.arch;
    });

    afterEach(() => {
      // Restore original values
      Object.defineProperty(process, 'platform', { value: originalPlatform });
      Object.defineProperty(process, 'arch', { value: originalArch });
    });

    it('should return Windows binary name on win32', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      expect(getBinaryName()).toBe('pomerium-cli-windows-amd64.exe');
    });

    it('should return macOS Intel binary name on darwin x64', () => {
      vi.spyOn(os, 'platform').mockReturnValue('darwin');
      vi.spyOn(os, 'arch').mockReturnValue('x64');
      expect(getBinaryName()).toBe('pomerium-cli-darwin-amd64');
    });

    it('should return macOS ARM binary name on darwin arm64', () => {
      vi.spyOn(os, 'platform').mockReturnValue('darwin');
      vi.spyOn(os, 'arch').mockReturnValue('arm64');
      expect(getBinaryName()).toBe('pomerium-cli-darwin-arm64');
    });

    it('should return Linux binary name on linux', () => {
      vi.spyOn(os, 'platform').mockReturnValue('linux');
      expect(getBinaryName()).toBe('pomerium-cli-linux-amd64');
    });

    it('should throw error for unsupported platform', () => {
      vi.spyOn(os, 'platform').mockReturnValue('freebsd' as NodeJS.Platform);
      expect(() => getBinaryName()).toThrow('Unsupported platform: freebsd');
    });
  });

  describe('resolveBinaryPath', () => {
    it('should resolve custom path if provided and exists', () => {
      const customPath = '/custom/path/to/pomerium-cli';
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = resolveBinaryPath(customPath);

      expect(result).toBe(path.resolve(customPath));
      expect(fs.existsSync).toHaveBeenCalledWith(customPath);
    });

    it('should throw BinaryNotFoundError if custom path does not exist', () => {
      const customPath = '/nonexistent/path/to/pomerium-cli';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() => resolveBinaryPath(customPath)).toThrow(BinaryNotFoundError);
      expect(() => resolveBinaryPath(customPath)).toThrow(
        `Pomerium CLI binary not found at: ${customPath}`
      );
    });

    it('should auto-detect binary path based on platform', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = resolveBinaryPath();

      expect(result).toContain('pomerium-cli-windows-amd64.exe');
      expect(result).toContain('bin');
    });

    it('should throw BinaryNotFoundError if auto-detected path does not exist', () => {
      vi.spyOn(os, 'platform').mockReturnValue('win32');
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      expect(() => resolveBinaryPath()).toThrow(BinaryNotFoundError);
    });

    it('should resolve path relative to module location', () => {
      vi.spyOn(os, 'platform').mockReturnValue('linux');
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const result = resolveBinaryPath();

      // Path should go up two levels (../../bin/) from src/utils/
      expect(result).toContain('bin');
      expect(result).toContain('pomerium-cli-linux-amd64');
    });
  });
});
