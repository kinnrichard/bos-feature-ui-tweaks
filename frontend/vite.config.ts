import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode
  const env = loadEnv(mode, process.cwd(), '');

  // Determine API target based on environment
  const apiTarget = env.PUBLIC_API_URL
    ? env.PUBLIC_API_URL.replace('/api/v1', '')
    : 'http://localhost:3000';

  console.log(`[Vite] Mode: ${mode}, API Target: ${apiTarget}`);

  return {
    plugins: [tailwindcss(), sveltekit()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // Ensure environment variables are available during build
    define: {
      // These will be available at build time
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(
        env.PUBLIC_API_URL || 'http://localhost:3000/api/v1'
      ),
    },
  };
});
