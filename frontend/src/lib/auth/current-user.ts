/**
 * Current user management for Zero.js mutations
 * Provides access to the authenticated user for attribution and authorization
 */

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  [key: string]: any;
}

let currentUser: CurrentUser | null = null;

/**
 * Set the current authenticated user
 * Should be called after successful authentication
 */
export function setCurrentUser(user: CurrentUser | null): void {
  currentUser = user;
  
  // Also set on globalThis for broader access
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).currentUser = user;
  }
}

/**
 * Get the current authenticated user
 * Returns null if no user is authenticated
 */
export function getCurrentUser(): CurrentUser | null {
  return currentUser;
}

/**
 * Clear the current user (logout)
 */
export function clearCurrentUser(): void {
  setCurrentUser(null);
}

/**
 * Check if a user is currently authenticated
 */
export function isAuthenticated(): boolean {
  return currentUser !== null;
}

/**
 * Require an authenticated user or throw an error
 * Useful for operations that must have user attribution
 */
export function requireUser(): CurrentUser {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user available');
  }
  return user;
}