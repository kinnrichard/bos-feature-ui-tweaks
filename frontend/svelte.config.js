import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  // Disable accessibility warnings during early development
  // TODO: Re-enable these warnings before production deployment
  onwarn: (warning, handler) => {
    // Ignore all accessibility warnings for now
    if (warning.code.startsWith('a11y-')) {
      return;
    }
    // Handle all other warnings normally
    handler(warning);
  },

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      $components: 'src/components',
      $stores: 'src/stores',
      $api: 'src/lib/api',
      $utils: 'src/lib/utils',
      $types: 'src/types',
    },
  },
};

export default config;
