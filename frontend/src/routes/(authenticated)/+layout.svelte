<!--
  Authenticated Layout - Zero Readiness Gate
  
  This layout ensures Zero.js is fully initialized before rendering
  any data-dependent pages, eliminating loading flashes.
  
  Two-stage loading architecture:
  1. Stage 1 (here): "Connecting to data..." - Zero initialization
  2. Stage 2 (pages): "Loading jobs..." - Data loading
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { initZero, getZeroState } from '$lib/zero';
  import { authService } from '$lib/api/auth';
  import { setCurrentUser } from '$lib/auth/current-user';
  import { backgroundRefresh } from '$lib/auth/background-refresh';
  import AppLoading from '$lib/components/AppLoading.svelte';
  import { debugAuth } from '$lib/utils/debug';
  import Toast from '$lib/components/ui/Toast.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';
  import { initializeStores } from '$lib/stores/initializeStores';

  let { children } = $props();

  type ZeroState = 'checking' | 'unauthenticated' | 'initializing' | 'ready' | 'error';

  let zeroState = $state<ZeroState>('checking');
  let errorMessage = $state<string | null>(null);
  let retryCount = $state(0);
  const maxRetries = 3;

  onMount(async () => {
    if (!browser) return;

    // Initialize store connections before anything else
    initializeStores();

    try {
      // Stage 1: Check authentication first
      zeroState = 'checking';

      const isAuthenticated = await authService.checkAuth();

      if (!isAuthenticated) {
        zeroState = 'unauthenticated';

        // Build return URL for post-login redirect
        const returnTo = encodeURIComponent($page.url.pathname + $page.url.search);
        await goto(`/login?return_to=${returnTo}`, { replaceState: true });
        return;
      }

      // Stage 1.5: Fetch and set current user for mutators
      try {
        const userData = await authService.getCurrentUser();
        console.log('[Auth Layout] User data structure:', userData);
        console.log('[Auth Layout] User attributes:', userData.attributes);

        // The user data comes in JSON:API format with nested attributes
        // We need to pass the full user object with ID at the top level
        const currentUserData = {
          id: userData.id,
          ...userData.attributes,
        };

        setCurrentUser(currentUserData);
        debugAuth('Current user set:', currentUserData);
      } catch (error) {
        debugAuth.error('Failed to fetch current user:', error);
        // Don't fail completely, but user attribution may not work
      }

      // Stage 2: Initialize Zero client
      zeroState = 'initializing';

      await initZero();

      // Verify Zero is actually ready
      const state = getZeroState();
      if (!state.isInitialized || state.initializationState !== 'success') {
        throw new Error('Zero client initialization incomplete');
      }

      zeroState = 'ready';

      // Stage 3: Start background token refresh
      try {
        await backgroundRefresh.start();
        debugAuth('[Authenticated Layout] Background refresh started');
      } catch (error) {
        debugAuth.error('[Authenticated Layout] Failed to start background refresh:', error);
        // Don't fail the whole layout if background refresh fails
        // The existing 401 retry logic will handle token expiration
      }
    } catch (error) {
      console.error('🏗️ [Authenticated Layout] Initialization failed:', error);

      // Retry logic for transient failures
      if (retryCount < maxRetries) {
        retryCount++;
        debugAuth(`[Authenticated Layout] Retrying (${retryCount}/${maxRetries}) in 2s...`);

        setTimeout(() => {
          // Reset state and retry
          zeroState = 'checking';
          errorMessage = null;
          // onMount will re-run the initialization
          window.location.reload();
        }, 2000);
        return;
      }

      // Max retries exceeded
      zeroState = 'error';
      errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    }
  });

  function handleRetry() {
    retryCount = 0;
    zeroState = 'checking';
    errorMessage = null;
    window.location.reload();
  }

  // Clean up background refresh on component destroy
  onDestroy(() => {
    if (browser) {
      backgroundRefresh.stop();
      debugAuth('[Authenticated Layout] Background refresh stopped');
    }
  });

  // Debug info for development
  $effect(() => {
    if (browser && typeof window !== 'undefined') {
      (window as any).authLayoutDebug = {
        zeroState,
        errorMessage,
        retryCount,
        getZeroState,
        retry: handleRetry,
        backgroundRefresh: {
          status: backgroundRefresh.isActive() ? 'active' : 'inactive',
          sessionInfo: backgroundRefresh.getSessionInfo(),
          service: backgroundRefresh,
        },
      };
    }
  });
</script>

<!-- Zero Readiness Gate UI -->
{#if zeroState === 'checking'}
  <AppLoading message="Verifying authentication..." />
{:else if zeroState === 'unauthenticated'}
  <!-- Show nothing while redirecting to login -->
  <AppLoading message="Redirecting to login..." />
{:else if zeroState === 'initializing'}
  <AppLoading message="Connecting to data..." />
{:else if zeroState === 'error'}
  <div class="error-state">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h1 class="error-title">Connection Failed</h1>
      <p class="error-message">
        {errorMessage || 'Unable to connect to the data service'}
      </p>
      <div class="error-actions">
        <button class="button button--primary" onclick={handleRetry}> Try Again </button>
        <button class="button button--secondary" onclick={() => goto('/login')}>
          Back to Login
        </button>
      </div>
      {#if retryCount > 0}
        <p class="error-retry-info">
          Retry attempt: {retryCount}/{maxRetries}
        </p>
      {/if}
    </div>
  </div>
{:else if zeroState === 'ready'}
  <!-- Zero is ready - render protected content -->
  {@render children()}
{/if}

<!-- Global toast notifications -->
{#if toastStore.currentToast}
  <Toast
    message={toastStore.currentToast.message}
    type={toastStore.currentToast.type}
    duration={toastStore.currentToast.duration}
    onDismiss={() => toastStore.dismiss(toastStore.currentToast.id)}
  />
{/if}

<style>
  .error-state {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-black, #000);
    padding: 20px;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 24px;
  }

  .error-title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    margin-bottom: 16px;
  }

  .error-message {
    font-size: 16px;
    color: var(--text-secondary, #c7c7cc);
    margin-bottom: 32px;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-bottom: 16px;
  }

  .error-retry-info {
    font-size: 14px;
    color: var(--text-tertiary, #8e8e93);
    opacity: 0.8;
  }

  .button {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    transition: all 0.15s ease;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .button--primary {
    background-color: var(--accent-blue, #00a3ff);
    color: white;
  }

  .button--primary:hover {
    background-color: var(--accent-blue-hover, #0089e0);
  }

  .button--secondary {
    background-color: var(--bg-secondary, #1c1c1d);
    color: var(--text-primary, #f2f2f7);
    border: 1px solid var(--border-primary, #38383a);
  }

  .button--secondary:hover {
    background-color: var(--bg-tertiary, #3a3a3c);
  }
</style>
