import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZERO_SERVER_CONFIG } from '../zero-config';

// Mock window.location for testing
const mockLocation = {
  port: '',
  protocol: 'http:',
  hostname: 'localhost',
};

describe('ZERO_SERVER_CONFIG', () => {
  beforeEach(() => {
    // Reset window.location mock before each test
    vi.stubGlobal('window', {
      location: mockLocation,
    });

    // Reset to default values
    mockLocation.port = '';
    mockLocation.protocol = 'http:';
    mockLocation.hostname = 'localhost';
  });

  describe('getServerUrl()', () => {
    it('should connect to port 4850 in test environment', () => {
      mockLocation.port = '6173'; // Test frontend port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4850');
    });

    it('should connect to port 4848 in development environment', () => {
      mockLocation.port = '5173'; // Dev frontend port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should fallback to port 4848 for unknown ports', () => {
      mockLocation.port = '3000'; // Unknown port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should fallback to port 4848 for empty port', () => {
      mockLocation.port = ''; // Empty port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should use HTTPS protocol when frontend uses HTTPS', () => {
      mockLocation.protocol = 'https:';
      mockLocation.port = '6173';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('https://localhost:4850');
    });

    it('should work with custom hostnames', () => {
      mockLocation.hostname = 'test.example.com';
      mockLocation.port = '6173';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://test.example.com:4850');
    });

    it('should preserve protocol for development environment', () => {
      mockLocation.protocol = 'https:';
      mockLocation.port = '5173';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('https://localhost:4848');
    });

    it('should handle production-like port numbers', () => {
      mockLocation.port = '80'; // HTTP default port
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://localhost:4848');
    });

    it('should handle alternative test port scenarios', () => {
      // Test with port 6173 (test environment)
      mockLocation.port = '6173';
      mockLocation.hostname = '127.0.0.1';
      mockLocation.protocol = 'http:';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('http://127.0.0.1:4850');
    });

    it('should handle alternative development port scenarios', () => {
      // Test with port 5173 (development environment)
      mockLocation.port = '5173';
      mockLocation.hostname = '0.0.0.0';
      mockLocation.protocol = 'https:';
      expect(ZERO_SERVER_CONFIG.getServerUrl()).toBe('https://0.0.0.0:4848');
    });
  });

  describe('getTokenEndpoint()', () => {
    it('should return correct token endpoint', () => {
      expect(ZERO_SERVER_CONFIG.getTokenEndpoint()).toBe('/api/v1/zero/token');
    });

    it('should return consistent token endpoint regardless of environment', () => {
      // Test endpoint is the same across different environments
      mockLocation.port = '6173';
      const testEndpoint = ZERO_SERVER_CONFIG.getTokenEndpoint();

      mockLocation.port = '5173';
      const devEndpoint = ZERO_SERVER_CONFIG.getTokenEndpoint();

      mockLocation.port = '3000';
      const fallbackEndpoint = ZERO_SERVER_CONFIG.getTokenEndpoint();

      expect(testEndpoint).toBe('/api/v1/zero/token');
      expect(devEndpoint).toBe('/api/v1/zero/token');
      expect(fallbackEndpoint).toBe('/api/v1/zero/token');
      expect(testEndpoint).toBe(devEndpoint);
      expect(devEndpoint).toBe(fallbackEndpoint);
    });
  });

  describe('environment detection logic', () => {
    it('should correctly identify test environment', () => {
      mockLocation.port = '6173';
      const url = ZERO_SERVER_CONFIG.getServerUrl();
      expect(url).toContain(':4850');
    });

    it('should correctly identify development environment', () => {
      mockLocation.port = '5173';
      const url = ZERO_SERVER_CONFIG.getServerUrl();
      expect(url).toContain(':4848');
    });

    it('should handle edge cases for port detection', () => {
      // Test various edge cases
      const testCases = [
        { port: '6173', expectedZeroPort: '4850', environment: 'test' },
        { port: '5173', expectedZeroPort: '4848', environment: 'development' },
        { port: '', expectedZeroPort: '4848', environment: 'fallback' },
        { port: '0', expectedZeroPort: '4848', environment: 'fallback' },
        { port: '80', expectedZeroPort: '4848', environment: 'fallback' },
        { port: '443', expectedZeroPort: '4848', environment: 'fallback' },
        { port: '8080', expectedZeroPort: '4848', environment: 'fallback' },
      ];

      testCases.forEach(({ port, expectedZeroPort }) => {
        mockLocation.port = port;
        const url = ZERO_SERVER_CONFIG.getServerUrl();
        expect(url).toContain(`:${expectedZeroPort}`);
      });
    });
  });

  describe('configuration consistency', () => {
    it('should have valid timeout values', () => {
      expect(ZERO_SERVER_CONFIG.CONNECT_TIMEOUT).toBeGreaterThan(0);
      expect(ZERO_SERVER_CONFIG.REQUEST_TIMEOUT).toBeGreaterThan(0);
      expect(ZERO_SERVER_CONFIG.KEEPALIVE_INTERVAL).toBeGreaterThan(0);

      // Reasonable timeout ranges
      expect(ZERO_SERVER_CONFIG.CONNECT_TIMEOUT).toBeLessThan(60000); // < 1 minute
      expect(ZERO_SERVER_CONFIG.REQUEST_TIMEOUT).toBeLessThan(120000); // < 2 minutes
    });

    it('should have sensible timeout relationships', () => {
      // Connection timeout should be less than request timeout
      expect(ZERO_SERVER_CONFIG.CONNECT_TIMEOUT).toBeLessThan(ZERO_SERVER_CONFIG.REQUEST_TIMEOUT);

      // Keepalive should be reasonable
      expect(ZERO_SERVER_CONFIG.KEEPALIVE_INTERVAL).toBeGreaterThan(
        ZERO_SERVER_CONFIG.CONNECT_TIMEOUT
      );
    });
  });

  describe('URL construction validation', () => {
    it('should construct valid URLs', () => {
      const testCases = [
        { protocol: 'http:', hostname: 'localhost', port: '6173' },
        { protocol: 'https:', hostname: 'example.com', port: '5173' },
        { protocol: 'http:', hostname: '127.0.0.1', port: '6173' },
        { protocol: 'https:', hostname: '0.0.0.0', port: '5173' },
      ];

      testCases.forEach(({ protocol, hostname, port }) => {
        mockLocation.protocol = protocol;
        mockLocation.hostname = hostname;
        mockLocation.port = port;

        const url = ZERO_SERVER_CONFIG.getServerUrl();

        // Should be a valid URL
        expect(() => new URL(url)).not.toThrow();

        // Should contain expected components
        expect(url).toContain(protocol);
        expect(url).toContain(hostname);
      });
    });

    it('should handle special characters in hostname', () => {
      mockLocation.hostname = 'test-host.example.com';
      mockLocation.port = '6173';

      const url = ZERO_SERVER_CONFIG.getServerUrl();
      expect(url).toBe('http://test-host.example.com:4850');
      expect(() => new URL(url)).not.toThrow();
    });
  });
});
