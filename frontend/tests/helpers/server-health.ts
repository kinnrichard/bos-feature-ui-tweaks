/**
 * Server Health Monitoring for Test Suite
 *
 * Ensures all required servers are running and healthy before tests execute.
 * Helps identify "zombie server" issues where old processes are still running.
 */

import { execSync } from 'child_process';

interface ServerConfig {
  name: string;
  port: number;
  healthEndpoint?: string;
  expectedResponse?: string | RegExp;
}

const TEST_SERVERS: ServerConfig[] = [
  {
    name: 'Rails API',
    port: 4000,
    healthEndpoint: '/api/v1/health',
    expectedResponse: /ok|healthy/i,
  },
  {
    name: 'Zero.js Cache',
    port: 4850,
    healthEndpoint: '/',
    expectedResponse: /zero|cache|ok/i, // Zero.js returns "OK" from dispatcher
  },
  {
    name: 'Zero.js WebSocket',
    port: 4851,
    // No health endpoint - just check if port is open
  },
  {
    name: 'Frontend Dev Server',
    port: 6173,
    healthEndpoint: '/',
    expectedResponse: /<!doctype html>/i, // Case insensitive for Vite's lowercase DOCTYPE
  },
];

export class ServerHealthMonitor {
  /**
   * Check if all required test servers are running and healthy
   */
  static async validateAllServers(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // eslint-disable-next-line no-console
    console.log('🔍 Validating test server health...');

    for (const server of TEST_SERVERS) {
      try {
        const isHealthy = await this.checkServerHealth(server);
        if (!isHealthy) {
          issues.push(`${server.name} (port ${server.port}) is not responding correctly`);
        } else {
          // eslint-disable-next-line no-console
          console.log(`✅ ${server.name} (port ${server.port}) is healthy`);
        }
      } catch (error) {
        issues.push(`${server.name} (port ${server.port}) is not accessible: ${error.message}`);
      }
    }

    if (issues.length > 0) {
      console.error('❌ Server health issues detected:');
      issues.forEach((issue) => console.error(`  - ${issue}`));
      console.error('\n💡 Try running: bin/testkill && bin/test-servers');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Check if a specific server is healthy
   */
  private static async checkServerHealth(server: ServerConfig): Promise<boolean> {
    try {
      // First check if port is listening
      const portOpen = await this.isPortOpen(server.port);
      if (!portOpen) {
        console.error(`❌ ${server.name} port ${server.port} is not open`);
        return false;
      }

      // If health endpoint specified, check it
      if (server.healthEndpoint) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`http://localhost:${server.port}${server.healthEndpoint}`, {
            signal: controller.signal,
            headers: { 'User-Agent': 'test-health-check' },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.error(`❌ ${server.name} health endpoint returned ${response.status}`);
            return false;
          }

          if (server.expectedResponse) {
            const text = await response.text();
            // eslint-disable-next-line no-console
            console.log(`🔍 ${server.name} response: ${text.substring(0, 200)}...`);

            if (typeof server.expectedResponse === 'string') {
              const matches = text.includes(server.expectedResponse);
              if (!matches) {
                console.error(
                  `❌ ${server.name} response doesn't contain expected string: "${server.expectedResponse}"`
                );
              }
              return matches;
            } else {
              const matches = server.expectedResponse.test(text);
              if (!matches) {
                console.error(
                  `❌ ${server.name} response doesn't match expected pattern: ${server.expectedResponse}`
                );
              }
              return matches;
            }
          }
        } finally {
          clearTimeout(timeoutId);
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ ${server.name} health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if a port is open
   */
  private static async isPortOpen(port: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        await fetch(`http://localhost:${port}`, {
          signal: controller.signal,
          headers: { 'User-Agent': 'test-health-check' },
        });
        clearTimeout(timeoutId);
        return true; // Port is open if we get any response (even 404, 500, etc.)
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      // Port is open if we get any response, even HTTP errors
      // Only connection refused means port is closed
      if (error.name === 'AbortError') {
        console.error(`⏱️ Port ${port} check timed out`);
        return false;
      }

      const isConnectionRefused =
        error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed');

      if (isConnectionRefused) {
        console.error(`🔌 Port ${port} connection refused`);
        return false;
      }

      // Other errors (like HTTP errors) mean port is open but server had issues
      console.error(`⚠️ Port ${port} responded with error: ${error.message}`);
      return true;
    }
  }

  /**
   * Wait for servers to become healthy (useful after starting servers)
   */
  static async waitForServersHealthy(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const { healthy } = await this.validateAllServers();
      if (healthy) {
        return true;
      }

      console.log('⏳ Waiting for servers to become healthy...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return false;
  }

  /**
   * Kill all processes on test server ports (simple, effective approach like bin/testkill)
   */
  static async killZombieServers(): Promise<void> {
    // Skip cleanup if explicitly disabled
    if (process.env.SKIP_ZOMBIE_CLEANUP === 'true') {
      // eslint-disable-next-line no-console
      console.log('⏭️ Zombie server cleanup skipped (SKIP_ZOMBIE_CLEANUP=true)');
      return;
    }

    // eslint-disable-next-line no-console
    console.log('🧹 Cleaning up all test server processes...');

    let killedAny = false;

    for (const server of TEST_SERVERS) {
      try {
        // Find ALL processes listening on this port (like bin/testkill does)
        const pids = execSync(`lsof -ti tcp:${server.port} 2>/dev/null || true`, {
          encoding: 'utf8',
        }).trim();

        if (pids) {
          const pidList = pids.split('\n').filter((pid) => pid.trim());
          // eslint-disable-next-line no-console
          console.log(
            `🎯 Found ${server.name} on port ${server.port} (PIDs: ${pidList.join(', ')})`
          );

          // Kill each process immediately with SIGKILL (like bin/testkill)
          for (const pid of pidList) {
            try {
              // Check if process still exists
              execSync(`kill -0 ${pid} 2>/dev/null`);
              // eslint-disable-next-line no-console
              console.log(`   ⚡ Killing process ${pid}...`);
              execSync(`kill -9 ${pid} 2>/dev/null`);
              // eslint-disable-next-line no-console
              console.log(`   ✅ Process ${pid} killed`);
              killedAny = true;
            } catch {
              // Process already gone or couldn't kill - that's fine
              // eslint-disable-next-line no-console
              console.log(`   ❌ Process ${pid} already gone or protected`);
            }
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(`   ✨ No ${server.name} found on port ${server.port}`);
        }
      } catch {
        // No processes found on this port - that's fine
        // eslint-disable-next-line no-console
        console.log(`   ✨ No processes found on port ${server.port}`);
      }
    }

    if (killedAny) {
      // eslint-disable-next-line no-console
      console.log('💀 Test server processes killed successfully!');
    } else {
      // eslint-disable-next-line no-console
      console.log('🎉 No test server processes were running');
    }
  }
}
