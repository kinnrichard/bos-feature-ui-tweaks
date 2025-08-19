<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center bg-primary">
	<div class="text-center max-w-md">
		<h1 class="text-6xl font-bold text-red-500 mb-4">{$page.status}</h1>
		<h2 class="text-2xl font-semibold text-primary mb-2">
			{$page.status === 404 ? 'Page Not Found' : 'Error'}
		</h2>
		<p class="text-secondary mb-8">
			{$page.error?.message || 'An unexpected error occurred'}
		</p>
		<a
			href="/"
			class="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-fast"
		>
			Go Home
		</a>
	</div>
</div>
