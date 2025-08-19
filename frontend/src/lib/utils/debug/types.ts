/**
 * TypeScript definitions for the Enhanced Debug System
 * Provides comprehensive typing for both legacy and category systems
 */

import type {
  EnhancedDebugFunction,
  NetworkDebugFunction,
  DataDebugFunction,
  UIDebugFunction,
  BusinessDebugFunction,
  MonitorDebugFunction,
  SystemDebugFunction,
  CategoryDebugFunction,
} from './core';

import type { LegacyDebugFunctions, EnhancedDebugSystem } from './compatibility';

/**
 * Complete debug system interface combining all functionality
 */
export interface BosDebugSystem {
  // 6-Category System (NEW)
  debugNetwork: NetworkDebugFunction;
  debugData: DataDebugFunction;
  debugUI: UIDebugFunction;
  debugBusiness: BusinessDebugFunction;
  debugMonitor: MonitorDebugFunction;
  debugSystem: SystemDebugFunction;

  // Legacy Functions (19 total - maintained for backward compatibility)
  debugAPI: EnhancedDebugFunction;
  debugAuth: EnhancedDebugFunction;
  debugSecurity: EnhancedDebugFunction;
  debugReactive: EnhancedDebugFunction;
  debugState: EnhancedDebugFunction;
  debugComponent: EnhancedDebugFunction;
  debugCache: EnhancedDebugFunction;
  debugDatabase: EnhancedDebugFunction;
  debugWebSocket: EnhancedDebugFunction;
  debugValidation: EnhancedDebugFunction;
  debugPerformance: EnhancedDebugFunction;
  debugError: EnhancedDebugFunction;
  debugNavigation: EnhancedDebugFunction;
  debugNotification: EnhancedDebugFunction;
  debugWorkflow: EnhancedDebugFunction;
  debugSearch: EnhancedDebugFunction;
  debugUpload: EnhancedDebugFunction;
  debugExport: EnhancedDebugFunction;
  debugIntegration: EnhancedDebugFunction;

  // System utilities
  enhancedDebugSystem: EnhancedDebugSystem;
  categoryDebugFunctions: {
    debugNetwork: NetworkDebugFunction;
    debugData: DataDebugFunction;
    debugUI: UIDebugFunction;
    debugBusiness: BusinessDebugFunction;
    debugMonitor: MonitorDebugFunction;
    debugSystem: SystemDebugFunction;
  };
}

/**
 * Browser debug helper interface
 */
export interface BrowserDebugHelper {
  enable: (namespaces: string) => void;
  disable: () => void;
  status: () => void;
  list: () => void;

  // Category-specific helpers
  categories: () => void;
  enableCategory: (category: string) => void;
  disableCategory: (category: string) => void;
  legacy: () => void;
  migration: () => void;
  validate: () => void;
}

/**
 * Debug system configuration options
 */
export interface DebugSystemConfig {
  enableSecurity: boolean;
  enablePerformanceOptimizations: boolean;
  enableCategorySystem: boolean;
  enableLegacyCompatibility: boolean;
  enableBrowserHelpers: boolean;
}

/**
 * Category system configuration
 */
export interface CategorySystemConfig {
  network: {
    namespace: string;
    subNamespaces: {
      api: string;
      auth: string;
      security: string;
      integration: string;
      websocket: string;
    };
  };
  data: {
    namespace: string;
    subNamespaces: {
      database: string;
      cache: string;
      validation: string;
      reactive: string;
      state: string;
    };
  };
  ui: {
    namespace: string;
    subNamespaces: {
      component: string;
      navigation: string;
      notification: string;
    };
  };
  business: {
    namespace: string;
    subNamespaces: {
      workflow: string;
      search: string;
      upload: string;
      export: string;
    };
  };
  monitor: {
    namespace: string;
    subNamespaces: {
      performance: string;
      error: string;
    };
  };
  system: {
    namespace: string;
    subNamespaces: {
      framework: string;
      development: string;
    };
  };
}

/**
 * Performance metrics interface
 */
export interface DebugPerformanceMetrics {
  legacyFunctionCount: number;
  categoryFunctionCount: number;
  totalFunctionCount: number;
  memoryOptimized: boolean;
  securityRedactionEnabled: boolean;
  lazyLoadingEnabled: boolean;
}

/**
 * Migration recommendations interface
 */
export interface MigrationRecommendations {
  legacy: string[];
  category: string[];
  mixed: string[];
}

/**
 * Debug system validation results
 */
export interface ValidationResults {
  backwardCompatibility: boolean;
  categorySystemOperational: boolean;
  performanceOptimized: boolean;
  securityRedactionWorking: boolean;
  browserHelpersAvailable: boolean;
  overallHealth: 'excellent' | 'good' | 'warning' | 'error';
}

/**
 * Debug namespace patterns
 */
export type DebugNamespacePattern =
  | 'bos:*' // All namespaces
  | 'bos:network' // Network category
  | 'bos:data' // Data category
  | 'bos:ui' // UI category
  | 'bos:business' // Business category
  | 'bos:monitor' // Monitor category
  | 'bos:system' // System category
  | 'bos:api' // Legacy API namespace
  | 'bos:auth' // Legacy auth namespace
  | 'bos:network:api' // Specific sub-namespace
  | 'bos:data:database' // Specific sub-namespace
  | string; // Custom pattern

/**
 * Debug level types
 */
export type DebugLevel = 'info' | 'warn' | 'error';

/**
 * Debug message with metadata
 */
export interface DebugMessage {
  namespace: string;
  level: DebugLevel;
  message: string;
  data?: any;
  timestamp: Date;
  redacted: boolean;
}

/**
 * Security redaction configuration
 */
export interface SecurityRedactionConfig {
  sensitivePatterns: string[];
  redactionText: string;
  strictMode: boolean;
  logRedactionErrors: boolean;
}

// =============================================================================
// DEPRECATION WARNINGS FOR TYPESCRIPT
// =============================================================================

/**
 * @deprecated Use createEnhancedDebuggers instead. Will be removed in v2.0.0
 */
export interface LegacyDebugFactory {
  createSecureDebugger: (namespace: string) => (message: string, data?: any) => void;
  createSecureDebuggers: (
    namespaces: string[]
  ) => Record<string, (message: string, data?: any) => void>;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract namespace string from debug function
 */
export type ExtractNamespace<T> = T extends { namespace: infer N } ? N : never;

/**
 * Check if debug function has warn method
 */
export type HasWarnMethod<T> = T extends { warn: (...args: any[]) => any } ? true : false;

/**
 * Check if debug function has error method
 */
export type HasErrorMethod<T> = T extends { error: (...args: any[]) => any } ? true : false;

/**
 * Union of all category function types
 */
export type AnyCategoryFunction =
  | NetworkDebugFunction
  | DataDebugFunction
  | UIDebugFunction
  | BusinessDebugFunction
  | MonitorDebugFunction
  | SystemDebugFunction;

/**
 * Union of all debug function types (legacy + category)
 */
export type AnyDebugFunction = EnhancedDebugFunction | AnyCategoryFunction;

/**
 * Category names as literal type
 */
export type CategoryName = 'network' | 'data' | 'ui' | 'business' | 'monitor' | 'system';

/**
 * Legacy function names as literal type
 */
export type LegacyFunctionName =
  | 'debugAPI'
  | 'debugAuth'
  | 'debugSecurity'
  | 'debugReactive'
  | 'debugState'
  | 'debugComponent'
  | 'debugCache'
  | 'debugDatabase'
  | 'debugWebSocket'
  | 'debugValidation'
  | 'debugPerformance'
  | 'debugError'
  | 'debugNavigation'
  | 'debugNotification'
  | 'debugWorkflow'
  | 'debugSearch'
  | 'debugUpload'
  | 'debugExport'
  | 'debugIntegration';

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

declare global {
  interface Window {
    bosDebug?: BrowserDebugHelper;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface ProcessEnv {
      DEBUG?: string;
    }
  }
}

// =============================================================================
// MODULE DECLARATIONS
// =============================================================================

declare module 'debug' {
  interface Debugger {
    enabled: boolean;
    namespace: string;
  }
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Core types from other modules
  EnhancedDebugFunction,
  NetworkDebugFunction,
  DataDebugFunction,
  UIDebugFunction,
  BusinessDebugFunction,
  MonitorDebugFunction,
  SystemDebugFunction,
  CategoryDebugFunction,
  LegacyDebugFunctions,
  EnhancedDebugSystem,
};

// =============================================================================
// USAGE EXAMPLES AS TYPES
// =============================================================================

/**
 * Type-safe usage examples for IDE autocompletion
 */
export interface DebugUsageExamples {
  legacy: {
    basic: 'debugAPI("Request completed", { url, status })';
    withWarning: 'debugAPI.warn("Request slow", { url, duration })';
    withError: 'debugAPI.error("Request failed", { url, error })';
  };
  category: {
    basic: 'debugNetwork("Network activity", { type })';
    subNamespace: 'debugNetwork.api("API call", { endpoint })';
    withWarning: 'debugNetwork.api.warn("API slow", { duration })';
    withError: 'debugNetwork.api.error("API failed", { error })';
  };
  browser: {
    enableAll: 'localStorage.debug = "bos:*"';
    enableCategory: 'localStorage.debug = "bos:network"';
    enableSpecific: 'localStorage.debug = "bos:network:api"';
    enableMultiple: 'localStorage.debug = "bos:network,bos:data"';
  };
}

/**
 * Version information
 */
export interface DebugSystemVersion {
  epic: '016';
  version: '2.0.0';
  features: [
    '6-category-system',
    'backward-compatibility',
    'enhanced-browser-helpers',
    'performance-optimizations',
    'typescript-definitions',
  ];
}
