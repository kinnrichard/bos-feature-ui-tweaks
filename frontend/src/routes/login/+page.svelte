<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authService } from '$lib/api/auth';
  import type { ApiError } from '$lib/types/api';
  import ProgressSpinner from '$lib/components/ui/ProgressSpinner.svelte';

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Get return_to parameter for redirect after login
  const returnTo = $derived($page.url.searchParams.get('return_to') || '/jobs');

  async function handleSubmit() {
    // Prevent double-submit
    if (loading) return;

    if (!email || !password) {
      error = 'Please enter both email and password';
      return;
    }

    loading = true;
    error = null;

    try {
      await authService.login({ email, password });

      // Login successful, redirect to return_to or default
      goto(returnTo);
    } catch (err) {
      console.error('Login failed:', err);

      if (err && typeof err === 'object' && 'message' in err) {
        const apiError = err as ApiError;

        // Special handling for rate limiting
        if (apiError.code === 'RATE_LIMITED' || apiError.status === 429) {
          error = 'Too many login attempts. Please wait a moment and try again.';
        } else {
          error = apiError.message;
        }
      } else {
        error = 'Login failed. Please try again.';
      }
    } finally {
      loading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

<svelte:head>
  <title>Sign In - bŏs</title>
</svelte:head>

<div class="auth-container">
  <div class="auth-box">
    <!-- Logo section -->
    <div class="auth-logo">
      <div class="logo-placeholder">
        <h1 class="logo-text">bŏs</h1>
      </div>
    </div>

    <h1 class="auth-title">Sign In</h1>

    <!-- Error message -->
    {#if error}
      <div class="alert alert-error" role="alert">
        {error}
      </div>
    {/if}

    <!-- Login form -->
    <form
      class="auth-form"
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit(e);
      }}
    >
      <div class="form-group">
        <label for="email" class="form-label">Email</label>
        <input
          type="email"
          id="email"
          bind:value={email}
          class="form-input"
          placeholder="your@email.com"
          required
          disabled={loading}
          onkeydown={handleKeydown}
        />
      </div>

      <div class="form-group">
        <label for="password" class="form-label">Password</label>
        <input
          type="password"
          id="password"
          bind:value={password}
          class="form-input"
          placeholder="••••••••"
          required
          disabled={loading}
          onkeydown={handleKeydown}
        />
      </div>

      <button
        type="submit"
        class="button button--primary button--full-width submit-button"
        disabled={loading}
      >
        {#if loading}
          <ProgressSpinner size="small" />
          Signing In...
        {:else}
          Sign In
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-black, #000);
    padding: 20px;
  }

  .auth-box {
    width: 100%;
    max-width: 400px;
    background-color: var(--bg-primary, #1c1c1e);
    border: 1px solid var(--border-primary, #38383a);
    border-radius: 12px;
    padding: 48px 40px;
    box-shadow: var(--shadow-xl, 0 20px 60px rgba(0, 0, 0, 0.5));
  }

  .auth-logo {
    text-align: center;
    margin-bottom: 32px;
  }

  .logo-placeholder {
    display: inline-block;
    padding: 16px 24px;
    background: linear-gradient(
      135deg,
      var(--accent-blue, #00a3ff),
      var(--accent-blue-hover, #0089e0)
    );
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 163, 255, 0.3);
  }

  .logo-text {
    font-size: 24px;
    font-weight: 700;
    color: white;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .auth-title {
    font-size: 28px;
    font-weight: 600;
    color: var(--text-primary, #f2f2f7);
    text-align: center;
    margin-bottom: 32px;
  }

  .alert {
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 24px;
    font-size: 14px;
  }

  .alert-error {
    background-color: rgba(255, 59, 48, 0.1);
    border: 1px solid rgba(255, 59, 48, 0.3);
    color: #ff3b30;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary, #c7c7cc);
    font-size: 14px;
    font-weight: 500;
  }

  .form-input {
    width: 100%;
    padding: 12px 16px;
    background-color: var(--bg-secondary, #1c1c1d);
    border: 1px solid var(--border-primary, #38383a);
    border-radius: 8px;
    color: var(--text-primary, #f2f2f7);
    font-size: 16px;
    outline: none;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .form-input::placeholder {
    color: var(--text-tertiary, #8e8e93);
  }

  .form-input:focus {
    border-color: var(--accent-blue, #00a3ff);
    background-color: var(--bg-tertiary, #3a3a3c);
    box-shadow: 0 0 0 3px rgba(0, 163, 255, 0.1);
  }

  .form-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .submit-button {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    margin-top: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .submit-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Progress spinner styling and animation handled by ProgressSpinner component */

  /* Responsive adjustments */
  @media (max-width: 480px) {
    .auth-box {
      padding: 32px 24px;
      margin: 16px;
    }

    .auth-title {
      font-size: 24px;
    }

    .form-input {
      font-size: 16px; /* Prevent zoom on iOS */
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .auth-box {
      border-width: 2px;
    }

    .form-input {
      border-width: 2px;
    }

    .form-input:focus {
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .form-input {
      transition: none;
    }

    /* Progress spinner reduced motion handled by ProgressSpinner component */
  }
</style>
