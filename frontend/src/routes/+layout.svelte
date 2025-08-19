<script lang="ts">
	import '../app.css';
	import { createZeroContext } from '$lib/zero-context.svelte';

	// Create Zero context for the entire app
	// Note: Zero initialization is now handled in (authenticated)/+layout.svelte
	// This ensures Zero only initializes for authenticated users who need it
	const zero = createZeroContext();
</script>

<slot />
