// Authentication configuration with environment variable support
export const AUTH_CONFIG = {
  // Refresh interval in minutes (default: 10 minutes)
  REFRESH_INTERVAL_MINUTES: Number(import.meta.env.VITE_AUTH_REFRESH_INTERVAL_MINUTES) || 10,

  // Maximum idle time in hours before forcing re-authentication (default: 24 hours)
  MAX_IDLE_HOURS: Number(import.meta.env.VITE_AUTH_MAX_IDLE_HOURS) || 24,

  // Maximum absolute session duration in hours (default: 744 hours / 31 days)
  MAX_SESSION_HOURS: Number(import.meta.env.VITE_AUTH_MAX_SESSION_HOURS) || 744,

  // Backend cookie expiration in minutes (should be 2-3x refresh interval)
  COOKIE_EXPIRATION_MINUTES: Number(import.meta.env.VITE_AUTH_COOKIE_EXPIRATION_MINUTES) || 30,
};

// Export individual values for convenience
export const REFRESH_INTERVAL_MINUTES = AUTH_CONFIG.REFRESH_INTERVAL_MINUTES;
export const MAX_IDLE_HOURS = AUTH_CONFIG.MAX_IDLE_HOURS;
export const MAX_SESSION_HOURS = AUTH_CONFIG.MAX_SESSION_HOURS;
export const COOKIE_EXPIRATION_MINUTES = AUTH_CONFIG.COOKIE_EXPIRATION_MINUTES;
