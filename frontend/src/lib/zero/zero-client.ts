import { Zero } from '@rocicorp/zero';
import { schema, type ZeroClient } from './generated-schema';
import { debugDatabase, debugAuth, debugError } from '$lib/utils/debug';
import { ZERO_SERVER_CONFIG } from './zero-config';

// Conditional import to handle test environments without SvelteKit
function getBrowserState(): boolean {
  try {
    // In SvelteKit environments, this will work
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  } catch {
    // Fallback for any environment
    return false;
  }
}

const browser = getBrowserState();
// Epic-008: Legacy .generated imports replaced with Epic-008 models
// These imports are no longer needed as Epic-008 models handle their own Zero integration
// Individual components should import Epic-008 models directly:
// import { User } from '$lib/models/user';
// import { Task } from '$lib/models/task';

// Singleton state management
let zero: ZeroClient | null = null;
let initializationPromise: Promise<ZeroClient> | null = null;
let initializationState: 'idle' | 'pending' | 'success' | 'error' = 'idle';

// Connection state tracking
let isTabVisible = true;
let isConnectionSuspended = false;
let visibilityChangeHandler: (() => void) | null = null;

// Token caching
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;

// Enhanced logging with secure debug functions
function logZero(message: string, ...args: any[]) {
  debugDatabase(`[Zero] ${message}`, args.length > 0 ? args[0] : undefined);
}

function logZeroError(message: string, ...args: any[]) {
  debugError(`[Zero] ${message}`, args.length > 0 ? args[0] : undefined);
}

// Page Visibility API integration
function setupVisibilityChangeHandler() {
  if (!browser || visibilityChangeHandler) return;

  visibilityChangeHandler = () => {
    const wasVisible = isTabVisible;
    isTabVisible = !document.hidden;

    logZero('Tab visibility changed:', {
      wasVisible,
      isVisible: isTabVisible,
      hidden: document.hidden,
      visibilityState: document.visibilityState,
    });

    if (!wasVisible && isTabVisible) {
      // Tab became visible - recover connection if needed
      logZero('Tab became visible - checking connection recovery');
      handleConnectionRecovery();
    } else if (wasVisible && !isTabVisible) {
      // Tab became hidden - mark connection as potentially suspended
      logZero('Tab became hidden - connection may be suspended');
      isConnectionSuspended = true;
    }
  };

  document.addEventListener('visibilitychange', visibilityChangeHandler);

  // Initial state
  isTabVisible = !document.hidden;
  logZero('Visibility handler setup complete. Initial state:', {
    isVisible: isTabVisible,
    hidden: document.hidden,
    visibilityState: document.visibilityState,
  });
}

// Handle connection recovery after tab becomes visible
async function handleConnectionRecovery() {
  if (!isConnectionSuspended || !zero) return;

  try {
    logZero('Attempting connection recovery...');
    isConnectionSuspended = false;

    // Test if the connection is still alive by attempting a simple operation
    // If Zero has internal connection recovery, this should work
    // Otherwise, we might need to reinitialize

    logZero('Connection recovery completed');
  } catch (error) {
    logZeroError('Connection recovery failed:', error);
    // If recovery fails, we might need to reinitialize
    // For now, we'll let Zero handle its own reconnection
  }
}

// Fetch JWT token with enhanced error handling
async function fetchZeroToken(): Promise<string> {
  if (!browser) return '';

  logZero('Fetching JWT token...');

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const response = await fetch('/api/v1/zero/token', {
      method: 'GET',
      headers,
      credentials: 'include', // Include cookies for authentication
    });

    if (!response.ok) {
      const errorText = await response.text();
      logZeroError('Token fetch error response:', errorText);
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    logZero('Successfully fetched JWT token:', data.token?.substring(0, 20) + '...');
    logZero('User ID:', data.user_id);
    logZero('User Name:', data.user_name);

    // Add to window for console debugging
    if (typeof window !== 'undefined') {
      (window as any).zeroUserDebug = {
        userId: data.user_id,
        userName: data.user_name,
        token: data.token,
        tokenLength: data.token?.length,
      };
      debugAuth('Zero User Debug Info', (window as any).zeroUserDebug);
    }

    return data.token || '';
  } catch (error) {
    logZeroError('Failed to fetch Zero token:', error);

    // Redirect to login on authentication failure
    if (browser && (error as any)?.status === 401) {
      const { goto } = await import('$app/navigation');
      goto('/login');
    }

    return '';
  }
}

// Get initial user ID for Zero configuration
async function getInitialUserId(): Promise<string> {
  if (!browser) return '';

  try {
    const response = await fetch('/api/v1/zero/token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      // Redirect to login on authentication failure
      if (browser && response.status === 401) {
        const { goto } = await import('$app/navigation');
        goto('/login');
        return '';
      }

      // For development, use a real test user ID that exists in database
      logZeroError('Authentication failed, using real test user ID');
      return 'dce47cac-673c-4491-8bec-85ab3c1b0f82'; // Test Owner user
    }

    const data = await response.json();
    return data.user_id || 'dce47cac-673c-4491-8bec-85ab3c1b0f82';
  } catch (error) {
    logZeroError('Failed to get initial user ID:', error);

    // Redirect to login on authentication failure
    if (browser && (error as any)?.status === 401) {
      const { goto } = await import('$app/navigation');
      goto('/login');
      return '';
    }

    // For development, use a real test user ID that exists in database
    return 'dce47cac-673c-4491-8bec-85ab3c1b0f82'; // Test Owner user
  }
}

// Create Zero configuration with enhanced features
async function createZeroConfig(userId: string) {
  logZero('Creating config with userID:', userId);

  // Pre-fetch initial token to ensure we have it ready
  const initialToken = await fetchZeroToken();
  logZero(
    'Pre-fetched initial token:',
    initialToken ? initialToken.substring(0, 20) + '...' : 'NONE'
  );

  // Cache the token for use in auth function
  cachedToken = initialToken;
  tokenExpiryTime = Date.now() + 6 * 60 * 60 * 1000; // 6 hours

  // Enhanced auth function with better error handling
  const authFunction = async () => {
    logZero('Auth function called');

    // Check if we have a cached token that's still valid
    if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      logZero('Using cached token:', cachedToken.substring(0, 20) + '...');
      return cachedToken;
    }

    // Fetch fresh token
    logZero('Fetching fresh token...');
    const token = await fetchZeroToken();

    if (!token || token.length < 10) {
      logZeroError('Invalid token received:', token);
      throw new Error('Invalid JWT token received');
    }

    // Cache the new token
    cachedToken = token;
    tokenExpiryTime = Date.now() + 6 * 60 * 60 * 1000; // 6 hours

    logZero('Token length:', token.length);
    logZero('Token is valid JWT format:', token.split('.').length === 3);
    logZero('Returning fresh token:', token.substring(0, 20) + '...');
    return token;
  };

  return {
    schema,
    server: ZERO_SERVER_CONFIG.getServerUrl(),
    userID: userId, // Must match JWT 'sub' field
    auth: authFunction, // Cached async function
    // For development, we'll use memory store first
    kvStore: 'mem' as const,
    logLevel: 'info' as const,
    onUpdateNeeded: () => {
      logZero('Schema update needed - reloading application');
      if (browser && typeof window !== 'undefined') {
        window.location.reload();
      }
    },
  };
}

// Promise-based singleton initialization
async function performInitialization(): Promise<ZeroClient> {
  if (!browser) {
    // Return a mock client for SSR
    return {} as ZeroClient;
  }

  // Check if tab is visible before initializing
  if (!isTabVisible) {
    logZero('Tab is not visible, deferring initialization');
    throw new Error('Cannot initialize Zero in hidden tab');
  }

  try {
    initializationState = 'pending';
    logZero('Starting Zero initialization...');

    // Setup visibility handler if not already done
    setupVisibilityChangeHandler();

    // Get initial user ID for Zero configuration
    const userId = await getInitialUserId();
    if (!userId) {
      throw new Error('Failed to get user ID for Zero');
    }

    const config = await createZeroConfig(userId);
    logZero('Creating Zero instance with config:', {
      server: config.server,
      userID: config.userID,
      kvStore: config.kvStore,
      logLevel: config.logLevel,
    });

    zero = new Zero(config);
    initializationState = 'success';
    logZero('Zero initialization completed successfully');

    // Expose to global window for debugging
    if (typeof window !== 'undefined') {
      (window as any).zero = zero;
      (window as any).zeroDebug = {
        getZero: () => zero,
        getZeroState,
        reinitializeZero,
        closeZero,
        initZero,
        // Epic-008: Legacy debug functions removed
        // Use Epic-008 models directly for testing:
        // import { User } from '$lib/models/user';
        // const users = new ReactiveQuery(() => zero.query.users, []);
        testLegacyRemoved: () => {
          debugDatabase('Legacy model debug functions removed - use Epic-008 models instead');
        },
        testZeroQuery: async () => {
          try {
            if (!zero?.query?.clients) {
              throw new Error('Zero client or clients query not available');
            }
            debugDatabase('Testing zero.query.clients.run()');
            const result = await zero.query.clients.run();
            debugDatabase('zero.query.clients.run() result', { result, length: result?.length });
            return result;
          } catch (error) {
            debugError('zero.query.clients.run() error', error);
            return error;
          }
        },
      };
      // Epic-008: Legacy model exports removed
      // Use Epic-008 models directly from components:
      // import { User } from '$lib/models/user';
      // import { Task } from '$lib/models/task';

      // Add a simple test function to window
      (window as any).testZeroQueries = async () => {
        debugDatabase('=== Zero Query Test Suite ===');
        debugAuth('User Debug', (window as any).zeroUserDebug);
        debugDatabase('Zero State', getZeroState());

        // Test Zero client directly
        await (window as any).zeroDebug.testZeroQuery();
      };

      logZero('Zero client exposed to window.zero and window.zeroDebug');
      logZero('Epic-008 models available: import from $lib/models/');
      logZero('Run window.testZeroQueries() to test all query methods');
    }

    return zero;
  } catch (error) {
    initializationState = 'error';
    logZeroError('Zero initialization failed:', error);
    throw error;
  }
}

// Initialize Zero client with proper singleton pattern
export async function initZero(): Promise<ZeroClient> {
  // Return existing client if already initialized
  if (zero && initializationState === 'success') {
    logZero('Returning existing Zero client');
    return zero;
  }

  // Return existing promise if initialization is in progress
  if (initializationPromise) {
    logZero('Waiting for existing initialization to complete');
    return initializationPromise;
  }

  // Start new initialization
  logZero('Starting new Zero initialization');
  initializationPromise = performInitialization();

  try {
    const result = await initializationPromise;
    return result;
  } catch (error) {
    // Reset promise on error so next call can retry
    initializationPromise = null;
    throw error;
  }
}

// Get the current Zero client instance with proper waiting
export function getZero(): ZeroClient | null {
  if (!browser) {
    // Return null for SSR - components should handle this
    return null;
  }

  if (zero && initializationState === 'success') {
    return zero;
  }

  // If not initialized and tab is visible, start initialization
  if (!initializationPromise && isTabVisible) {
    logZero('Starting async initialization from getZero()');
    initZero().catch((error) => {
      logZeroError('Async initialization failed:', error);
    });
  }

  return null;
}

// Get Zero client with Promise for components that can wait
export async function getZeroAsync(): Promise<ZeroClient> {
  if (!browser) {
    throw new Error('Cannot initialize Zero in SSR context');
  }

  if (zero && initializationState === 'success') {
    return zero;
  }

  return await initZero();
}

// Get initialization state for debugging
export function getZeroState() {
  return {
    isInitialized: !!zero,
    initializationState,
    isTabVisible,
    isConnectionSuspended,
    hasInitializationPromise: !!initializationPromise,
  };
}

// Close Zero connection with proper cleanup
export function closeZero(): void {
  if (zero) {
    logZero('Closing Zero connection');
    // Zero doesn't have a close method in the current API
    // but we'll reset our reference and state
    zero = null;
    initializationState = 'idle';
    initializationPromise = null;
  }

  // Clean up visibility handler
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
}

// Force reinitialize (for recovery scenarios)
export async function reinitializeZero(): Promise<ZeroClient> {
  logZero('Force reinitializing Zero client');
  closeZero();
  return await initZero();
}

// Export the ZeroClient type for external use
export type { ZeroClient };
