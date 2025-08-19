/**
 * Enhanced Debug System - Main Entry Point (Epic 016)
 *
 * This module provides a comprehensive, secure debug logging system with:
 * - 6-Category Debug System with sub-namespace methods
 * - 100% backward compatibility with existing functions
 * - Automatic security redaction of sensitive data
 * - Enhanced browser helpers with category navigation
 * - Performance optimizations with lazy loading
 * - TypeScript support with proper typing
 *
 * NEW: 6-Category System Usage:
 *
 * Category-based debugging (NEW approach):
 * import { debugNetwork, debugData, debugUI } from './debug';
 * debugNetwork.api('API request', { url, method });
 * debugData.database('Query executed', { sql, duration });
 * debugUI.component('Component rendered', { name, props });
 *
 * Legacy debugging (continues to work unchanged):
 * import { debugAPI, debugAuth, debugComponent } from './debug';
 * debugAPI('API request', { url, method });
 * debugAuth('User login', { userId });
 * debugComponent('Component rendered', { name, props });
 *
 * Environment Configuration:
 *
 * Enable all debugging (both legacy and category):
 * DEBUG=bos:* npm run dev
 *
 * Enable specific categories:
 * DEBUG=bos:network,bos:data npm run dev
 *
 * Enable specific sub-namespaces:
 * DEBUG=bos:network:api,bos:data:database npm run dev
 *
 * Enable all except specific namespaces:
 * DEBUG=bos:*,-bos:cache npm run dev
 *
 * Browser Console Usage:
 * localStorage.debug = 'bos:*'        // Enable all
 * localStorage.debug = 'bos:network'  // Enable network category
 * localStorage.debug = 'bos:api'      // Enable legacy API function
 * // Then refresh the page
 *
 * Enhanced Browser Helpers:
 * bosDebug.categories()         // Explore 6-category system
 * bosDebug.enableCategory('network')  // Enable network category
 * bosDebug.legacy()            // Show all 19 legacy functions
 * bosDebug.migration()         // Migration guide
 * bosDebug.validate()          // System health check
 *
 * Security Features:
 * - All debug functions automatically redact sensitive data
 * - Passwords, tokens, CSRF headers, and auth data are filtered
 * - Enhanced security redaction with batch processing
 * - Safe to use in production environments with debug enabled
 *
 * Performance Features:
 * - Lazy loading for category system
 * - Singleton pattern for memory efficiency
 * - Caching for repeated debug function creation
 * - Optimized security redaction processing
 */

// Re-export all public APIs
export * from './namespaces';
export * from './core';
export * from './browser';
export * from './compatibility';
export * from './types';
export { createSecurityRedactor, securityRedactor } from './redactor';

// Initialize browser helpers
import { initializeBrowserDebugHelpers } from './browser';
initializeBrowserDebugHelpers();

// Export default for convenience
export { debugAPI as default } from './namespaces';
