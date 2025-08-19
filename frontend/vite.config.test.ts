import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(() => {
  // Force test mode environment loading
  const env = loadEnv('test', process.cwd(), '');

  // Test-specific API target - FORCE test Rails port 4000
  const apiTarget = 'http://localhost:4000'; // Always use test port in test config

  console.log(`[Vite Test] API Target: ${apiTarget}`);
  console.log(`[Vite Test] PUBLIC_API_URL: ${env.PUBLIC_API_URL}`);

  return {
    plugins: [sveltekit()],
    server: {
      port: 6173, // Test frontend port
      strictPort: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Ensure test environment variables are embedded during build
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(
        'http://localhost:4000/api/v1' // FORCE test API URL
      ),
      'import.meta.env.PUBLIC_APP_NAME': JSON.stringify(env.PUBLIC_APP_NAME || 'bŏs'),
      'import.meta.env.PUBLIC_APP_VERSION': JSON.stringify(env.PUBLIC_APP_VERSION || '0.0.1'),
    },
    // Test-specific build options for proper client-side rendering
    build: {
      sourcemap: true,
      minify: false, // Easier debugging in tests
      target: 'es2020', // Modern browser target for better debugging
    },
    // Preview configuration to serve client-side build only
    preview: {
      port: 6173, // Test frontend port
      strictPort: false,
      // Ensure we serve the client build, not server chunks
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
    // Ensure proper client-side mode for tests
    mode: 'test',
  };
});
