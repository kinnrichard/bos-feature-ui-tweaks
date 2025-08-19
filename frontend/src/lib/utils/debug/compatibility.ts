import {
  createEnhancedDebugger,
  DEBUG_NAMESPACES,
  getCategoryDebugSystem,
  isDebugEnabled,
  type EnhancedDebugFunction,
  type NetworkDebugFunction,
  type DataDebugFunction,
  type UIDebugFunction,
  type BusinessDebugFunction,
  type MonitorDebugFunction,
  type SystemDebugFunction,
} from './core';

/**
 * Backward Compatibility Layer for the 6-Category Debug System
 *
 * This module ensures 100% API compatibility with the existing 19 debug functions
 * while providing seamless integration with the new category-based system.
 *
 * Features:
 * - All 19 legacy debug functions work unchanged
 * - New category system operates in parallel
 * - Performance optimizations with lazy loading
 * - Enhanced browser helpers with category navigation
 * - TypeScript support with deprecation warnings
 */

/**
 * Legacy debug function mappings - maintains exact API compatibility
 * These functions continue to work exactly as before while internally
 * using the enhanced debug system with security redaction.
 *
 * NOTE: These are not exported directly to avoid conflicts.
 * They are exported through the namespaces.ts module.
 */

// Core system debug functions (maintained for backward compatibility)
const debugAPI = createEnhancedDebugger(DEBUG_NAMESPACES.API);
const debugAuth = createEnhancedDebugger(DEBUG_NAMESPACES.AUTH);
const debugSecurity = createEnhancedDebugger(DEBUG_NAMESPACES.SECURITY);
const debugReactive = createEnhancedDebugger(DEBUG_NAMESPACES.REACTIVE);
const debugState = createEnhancedDebugger(DEBUG_NAMESPACES.STATE);
const debugComponent = createEnhancedDebugger(DEBUG_NAMESPACES.COMPONENT);
const debugCache = createEnhancedDebugger(DEBUG_NAMESPACES.CACHE);

// Data and persistence debug functions (maintained for backward compatibility)
const debugDatabase = createEnhancedDebugger(DEBUG_NAMESPACES.DATABASE);
const debugWebSocket = createEnhancedDebugger(DEBUG_NAMESPACES.WEBSOCKET);
const debugValidation = createEnhancedDebugger(DEBUG_NAMESPACES.VALIDATION);

// Performance and monitoring debug functions (maintained for backward compatibility)
const debugPerformance = createEnhancedDebugger(DEBUG_NAMESPACES.PERFORMANCE);
const debugError = createEnhancedDebugger(DEBUG_NAMESPACES.ERROR);

// User interface debug functions (maintained for backward compatibility)
const debugNavigation = createEnhancedDebugger(DEBUG_NAMESPACES.NAVIGATION);
const debugNotification = createEnhancedDebugger(DEBUG_NAMESPACES.NOTIFICATION);

// Business logic debug functions (maintained for backward compatibility)
const debugWorkflow = createEnhancedDebugger(DEBUG_NAMESPACES.WORKFLOW);
const debugSearch = createEnhancedDebugger(DEBUG_NAMESPACES.SEARCH);
const debugUpload = createEnhancedDebugger(DEBUG_NAMESPACES.UPLOAD);
const debugExport = createEnhancedDebugger(DEBUG_NAMESPACES.EXPORT);
const debugIntegration = createEnhancedDebugger(DEBUG_NAMESPACES.INTEGRATION);

/**
 * Legacy debug functions collection (backward compatibility)
 * All 19 functions with .warn() and .error() methods
 * Exported for use by namespaces.ts
 */
export const legacyDebugFunctions = {
  // Core system functions
  debugAPI,
  debugAuth,
  debugSecurity,
  debugReactive,
  debugState,
  debugComponent,
  debugCache,

  // Data and persistence functions
  debugDatabase,
  debugWebSocket,
  debugValidation,

  // Performance and monitoring functions
  debugPerformance,
  debugError,

  // User interface functions
  debugNavigation,
  debugNotification,

  // Business logic functions
  debugWorkflow,
  debugSearch,
  debugUpload,
  debugExport,
  debugIntegration,
} as const;

/**
 * Backward Compatibility Layer Class
 * Manages the transition between legacy and category systems
 */
export class BackwardCompatibilityLayer {
  private static instance: BackwardCompatibilityLayer | null = null;
  private categorySystem = getCategoryDebugSystem();

  /**
   * Get singleton instance of BackwardCompatibilityLayer
   */
  static getInstance(): BackwardCompatibilityLayer {
    if (!BackwardCompatibilityLayer.instance) {
      BackwardCompatibilityLayer.instance = new BackwardCompatibilityLayer();
    }
    return BackwardCompatibilityLayer.instance;
  }

  /**
   * Get legacy debug functions (19 functions for backward compatibility)
   */
  getLegacyFunctions() {
    return legacyDebugFunctions;
  }

  /**
   * Get category debug functions (6 categories with sub-namespaces)
   */
  getCategoryFunctions() {
    return this.categorySystem.getAllCategories();
  }

  /**
   * Check if legacy mode is preferred
   * Returns true if only legacy namespaces are enabled
   */
  isLegacyModePreferred(): boolean {
    const legacyNamespaces = Object.values(DEBUG_NAMESPACES);
    const categoryNamespaces = [
      'bos:network',
      'bos:data',
      'bos:ui',
      'bos:business',
      'bos:monitor',
      'bos:system',
    ];

    // Check if any category namespaces are enabled
    const categoryEnabled = categoryNamespaces.some((ns) => isDebugEnabled(ns));

    // Check if any legacy namespaces are enabled
    const legacyEnabled = legacyNamespaces.some((ns) => isDebugEnabled(ns));

    // Prefer legacy mode if legacy is enabled but categories are not
    return legacyEnabled && !categoryEnabled;
  }

  /**
   * Get migration recommendations for developers
   */
  getMigrationRecommendations(): {
    legacy: string[];
    category: string[];
    mixed: string[];
  } {
    return {
      legacy: [
        'Continue using existing debug functions: debugAPI, debugAuth, etc.',
        'All functions now have .warn() and .error() methods',
        'Security redaction is automatically applied',
        'No breaking changes - existing code works unchanged',
      ],
      category: [
        'New category-based approach: debugNetwork, debugData, etc.',
        'Sub-namespace methods: debugNetwork.api(), debugNetwork.auth()',
        'Organized by functional areas for better discoverability',
        'Enhanced browser helpers with category filtering',
      ],
      mixed: [
        'Both systems can be used simultaneously',
        'Legacy functions for existing code, categories for new code',
        'Gradual migration recommended over time',
        'Browser helpers support both approaches',
      ],
    };
  }

  /**
   * Validate that all legacy functions are working
   */
  validateBackwardCompatibility(): boolean {
    try {
      // Test that all 19 legacy functions exist and are callable
      const functionNames = Object.keys(legacyDebugFunctions);

      for (const funcName of functionNames) {
        const func = (legacyDebugFunctions as any)[funcName] as EnhancedDebugFunction;

        // Check that function exists
        if (typeof func !== 'function') {
          console.error(`Backward compatibility error: ${funcName} is not a function`);
          return false;
        }

        // Check that function has required properties
        if (typeof func.warn !== 'function') {
          console.error(`Backward compatibility error: ${funcName}.warn is not a function`);
          return false;
        }

        if (typeof func.error !== 'function') {
          console.error(`Backward compatibility error: ${funcName}.error is not a function`);
          return false;
        }

        if (typeof func.namespace !== 'string') {
          console.error(`Backward compatibility error: ${funcName}.namespace is not a string`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Backward compatibility validation failed:', error);
      return false;
    }
  }

  /**
   * Performance metrics for both systems
   */
  getPerformanceMetrics(): {
    legacyFunctionCount: number;
    categoryFunctionCount: number;
    totalFunctionCount: number;
    memoryOptimized: boolean;
  } {
    const legacyCount = Object.keys(legacyDebugFunctions).length;
    const categoryCount = Object.keys(this.categorySystem.getAllCategories()).length;

    return {
      legacyFunctionCount: legacyCount,
      categoryFunctionCount: categoryCount,
      totalFunctionCount: legacyCount + categoryCount,
      memoryOptimized: true, // Lazy loading and singleton patterns used
    };
  }
}

/**
 * Convenience function to get the compatibility layer instance
 */
export function getCompatibilityLayer(): BackwardCompatibilityLayer {
  return BackwardCompatibilityLayer.getInstance();
}

/**
 * Type definitions for backward compatibility
 */
export type LegacyDebugFunctions = typeof legacyDebugFunctions;

/**
 * Enhanced debug system interface combining legacy and category approaches
 */
export interface EnhancedDebugSystem {
  // Legacy functions (19 functions)
  legacy: LegacyDebugFunctions;

  // Category functions (6 categories)
  categories: {
    debugNetwork: NetworkDebugFunction;
    debugData: DataDebugFunction;
    debugUI: UIDebugFunction;
    debugBusiness: BusinessDebugFunction;
    debugMonitor: MonitorDebugFunction;
    debugSystem: SystemDebugFunction;
  };

  // Utility functions
  compatibility: BackwardCompatibilityLayer;
}

/**
 * Create the complete enhanced debug system
 */
export function createEnhancedDebugSystem(): EnhancedDebugSystem {
  const compatibility = getCompatibilityLayer();

  return {
    legacy: compatibility.getLegacyFunctions(),
    categories: compatibility.getCategoryFunctions(),
    compatibility,
  };
}

/**
 * Usage examples and migration guide
 */
export const MIGRATION_EXAMPLES = {
  legacy: {
    basic: `
// Existing code continues to work unchanged
debugAPI('Request completed', { url, status });
debugAuth('User authenticated', { userId });
debugWorkflow('Task completed', { taskId, result });
    `,
    enhanced: `
// New .warn() and .error() methods available
debugAPI.warn('Request slow', { url, duration });
debugAuth.error('Authentication failed', { error });
debugWorkflow.warn('Task retry needed', { taskId, attempt });
    `,
  },
  category: {
    basic: `
// New category-based approach
debugNetwork('Network activity', { type: 'request' });
debugData('Data processing', { operation: 'sync' });
debugUI('UI update', { component: 'nav' });
    `,
    subNamespace: `
// Sub-namespace methods for specific areas
debugNetwork.api('API call', { endpoint, method });
debugNetwork.auth('Authentication', { token: '[REDACTED]' });
debugData.database('Query executed', { sql, duration });
debugData.cache('Cache hit', { key, ttl });
    `,
  },
  mixed: `
// Both approaches work together
debugAPI('Legacy API call', { url }); // Legacy approach
debugNetwork.api('Category API call', { url }); // Category approach

// Enable in browser console:
localStorage.debug = 'bos:*'; // Enable all (both legacy and category)
localStorage.debug = 'bos:api,bos:network'; // Enable specific namespaces
  `,
} as const;
