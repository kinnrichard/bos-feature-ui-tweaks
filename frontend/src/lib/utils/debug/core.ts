import debug from 'debug';
import { securityRedactor } from './redactor';

/**
 * Core debug functionality module
 * Provides secure debug logging with automatic data redaction
 */

/**
 * Enhanced debug function interface with multiple log levels
 */
export interface EnhancedDebugFunction {
  // Info level (existing functionality)
  (message: string, data?: unknown): void;

  // Warning level (new)
  warn(message: string, data?: unknown): void;

  // Error level (new)
  error(message: string, data?: unknown): void;

  // Properties
  enabled: boolean;
  namespace: string;
}

/**
 * Legacy secure debug function type (for backward compatibility)
 */
export type SecureDebugFunction = (message: string, data?: unknown) => void;

/**
 * Shared debug namespace class - eliminates code duplication
 */
class DebugNamespace {
  private infoFn: debug.Debugger;
  private warnFn: debug.Debugger;
  private errorFn: debug.Debugger;
  public namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.infoFn = debug(namespace);
    this.warnFn = debug(`${namespace}:warn`);
    this.errorFn = debug(`${namespace}:error`);
  }

  /**
   * Log info level message with security redaction
   */
  log = (message: string, data?: unknown): void => {
    if (!this.infoFn.enabled) return;
    this.secureLog(this.infoFn, message, data);
  };

  /**
   * Log warning level message with security redaction
   */
  warn = (message: string, data?: unknown): void => {
    if (!this.warnFn.enabled) return;
    this.secureLog(this.warnFn, `⚠️ ${message}`, data);
  };

  /**
   * Log error level message with security redaction
   */
  error = (message: string, data?: unknown): void => {
    if (!this.errorFn.enabled) return;
    this.secureLog(this.errorFn, `❌ ${message}`, data);
  };

  /**
   * Shared secure logging implementation
   */
  private secureLog(debugFn: debug.Debugger, message: string, data?: unknown): void {
    if (data) {
      try {
        // Redact sensitive data before logging
        const redactedData = securityRedactor(data);
        debugFn(message, redactedData);
      } catch (error) {
        // Fallback to basic logging if redaction fails
        debugFn(message, '[REDACTION_ERROR]');
        if (import.meta.env.DEV) {
          debugFn('Debug redaction failed:', error);
        }
      }
    } else {
      debugFn(message);
    }
  }

  /**
   * Check if info level debugging is enabled
   */
  get enabled(): boolean {
    return this.infoFn.enabled;
  }
}

/**
 * Create enhanced debug function with multiple log levels (DRY implementation)
 *
 * @param namespace - The debug namespace (e.g., 'bos:api')
 * @returns Enhanced debug function with .warn() and .error() methods
 */
export function createEnhancedDebugger(namespace: string): EnhancedDebugFunction {
  const debugNamespace = new DebugNamespace(namespace);

  // Create callable function that maintains current API
  const debugFn = (message: string, data?: unknown) => debugNamespace.log(message, data);

  // Add enhanced methods
  debugFn.warn = debugNamespace.warn;
  debugFn.error = debugNamespace.error;
  debugFn.enabled = debugNamespace.enabled;
  debugFn.namespace = namespace;

  return debugFn as EnhancedDebugFunction;
}

/**
 * Create a secure debug function for a specific namespace (legacy compatibility)
 *
 * @param namespace - The debug namespace (e.g., 'bos:api')
 * @returns A secure debug function that automatically redacts sensitive data
 * @deprecated Use createEnhancedDebugger for new code
 */
export function createSecureDebugger(namespace: string): SecureDebugFunction {
  const enhanced = createEnhancedDebugger(namespace);
  return enhanced as SecureDebugFunction;
}

/**
 * Create multiple enhanced debug functions at once
 *
 * @param namespaces - Array of namespace strings
 * @returns Object with enhanced debug functions keyed by namespace
 */
export function createEnhancedDebuggers(
  namespaces: string[]
): Record<string, EnhancedDebugFunction> {
  const debuggers: Record<string, EnhancedDebugFunction> = {};

  for (const namespace of namespaces) {
    debuggers[namespace] = createEnhancedDebugger(namespace);
  }

  return debuggers;
}

/**
 * Create multiple secure debug functions at once (legacy compatibility)
 *
 * @param namespaces - Array of namespace strings
 * @returns Object with debug functions keyed by namespace
 * @deprecated Use createEnhancedDebuggers for new code
 */
export function createSecureDebuggers(namespaces: string[]): Record<string, SecureDebugFunction> {
  const debuggers: Record<string, SecureDebugFunction> = {};

  for (const namespace of namespaces) {
    debuggers[namespace] = createSecureDebugger(namespace);
  }

  return debuggers;
}

/**
 * Check if debug is enabled for a specific namespace
 *
 * @param namespace - The debug namespace to check
 * @returns True if debug is enabled for the namespace
 */
export function isDebugEnabled(namespace: string): boolean {
  return debug(namespace).enabled;
}

/**
 * Check if warning level debug is enabled for a specific namespace
 *
 * @param namespace - The debug namespace to check
 * @returns True if warning debug is enabled for the namespace
 */
export function isWarningEnabled(namespace: string): boolean {
  return debug(`${namespace}:warn`).enabled;
}

/**
 * Check if error level debug is enabled for a specific namespace
 *
 * @param namespace - The debug namespace to check
 * @returns True if error debug is enabled for the namespace
 */
export function isErrorEnabled(namespace: string): boolean {
  return debug(`${namespace}:error`).enabled;
}

/**
 * All debug namespaces (DRY constant)
 */
export const DEBUG_NAMESPACES = {
  // Core system namespaces
  API: 'bos:api',
  AUTH: 'bos:auth',
  SECURITY: 'bos:security',
  REACTIVE: 'bos:reactive',
  STATE: 'bos:state',
  COMPONENT: 'bos:component',
  CACHE: 'bos:cache',

  // Data and persistence namespaces
  DATABASE: 'bos:database',
  WEBSOCKET: 'bos:websocket',
  VALIDATION: 'bos:validation',

  // Performance and monitoring namespaces
  PERFORMANCE: 'bos:performance',
  ERROR: 'bos:error',

  // User interface namespaces
  NAVIGATION: 'bos:navigation',
  NOTIFICATION: 'bos:notification',
  ANIMATION: 'bos:animation',

  // Business logic namespaces
  WORKFLOW: 'bos:workflow',
  SEARCH: 'bos:search',
  UPLOAD: 'bos:upload',
  EXPORT: 'bos:export',
  INTEGRATION: 'bos:integration',
} as const;

/**
 * Get all currently enabled debug namespaces
 *
 * @returns Array of enabled namespace strings
 */
export function getEnabledNamespaces(): string[] {
  const enabledNamespaces: string[] = [];

  // Check all BOS namespaces (DRY - using constant)
  const commonNamespaces = Object.values(DEBUG_NAMESPACES);

  for (const namespace of commonNamespaces) {
    if (isDebugEnabled(namespace)) {
      enabledNamespaces.push(namespace);
    }
  }

  return enabledNamespaces;
}

// =============================================================================
// 6-CATEGORY DEBUG SYSTEM - NEW IMPLEMENTATION
// =============================================================================

/**
 * Category debug function interface with sub-namespace methods
 */
export interface CategoryDebugFunction extends EnhancedDebugFunction {
  // Sub-namespace methods will be added dynamically based on category
  readonly category?: string;
}

/**
 * Network category debug interface
 */
export interface NetworkDebugFunction extends CategoryDebugFunction {
  api: EnhancedDebugFunction;
  auth: EnhancedDebugFunction;
  security: EnhancedDebugFunction;
  integration: EnhancedDebugFunction;
  websocket: EnhancedDebugFunction;
}

/**
 * Data category debug interface
 */
export interface DataDebugFunction extends CategoryDebugFunction {
  database: EnhancedDebugFunction;
  cache: EnhancedDebugFunction;
  validation: EnhancedDebugFunction;
  reactive: EnhancedDebugFunction;
  state: EnhancedDebugFunction;
}

/**
 * UI category debug interface
 */
export interface UIDebugFunction extends CategoryDebugFunction {
  component: EnhancedDebugFunction;
  navigation: EnhancedDebugFunction;
  notification: EnhancedDebugFunction;
  animation: EnhancedDebugFunction;
}

/**
 * Business category debug interface
 */
export interface BusinessDebugFunction extends CategoryDebugFunction {
  workflow: EnhancedDebugFunction;
  search: EnhancedDebugFunction;
  upload: EnhancedDebugFunction;
  export: EnhancedDebugFunction;
}

/**
 * Monitor category debug interface
 */
export interface MonitorDebugFunction extends CategoryDebugFunction {
  performance: EnhancedDebugFunction;
  error: EnhancedDebugFunction;
}

/**
 * System category debug interface
 */
export interface SystemDebugFunction extends CategoryDebugFunction {
  framework: EnhancedDebugFunction;
  development: EnhancedDebugFunction;
}

/**
 * Category debug system configuration
 */
export const CATEGORY_CONFIG = {
  network: {
    namespace: 'bos:network',
    subNamespaces: {
      api: DEBUG_NAMESPACES.API,
      auth: DEBUG_NAMESPACES.AUTH,
      security: DEBUG_NAMESPACES.SECURITY,
      integration: DEBUG_NAMESPACES.INTEGRATION,
      websocket: DEBUG_NAMESPACES.WEBSOCKET,
    },
  },
  data: {
    namespace: 'bos:data',
    subNamespaces: {
      database: DEBUG_NAMESPACES.DATABASE,
      cache: DEBUG_NAMESPACES.CACHE,
      validation: DEBUG_NAMESPACES.VALIDATION,
      reactive: DEBUG_NAMESPACES.REACTIVE,
      state: DEBUG_NAMESPACES.STATE,
    },
  },
  ui: {
    namespace: 'bos:ui',
    subNamespaces: {
      component: DEBUG_NAMESPACES.COMPONENT,
      navigation: DEBUG_NAMESPACES.NAVIGATION,
      notification: DEBUG_NAMESPACES.NOTIFICATION,
      animation: DEBUG_NAMESPACES.ANIMATION,
    },
  },
  business: {
    namespace: 'bos:business',
    subNamespaces: {
      workflow: DEBUG_NAMESPACES.WORKFLOW,
      search: DEBUG_NAMESPACES.SEARCH,
      upload: DEBUG_NAMESPACES.UPLOAD,
      export: DEBUG_NAMESPACES.EXPORT,
    },
  },
  monitor: {
    namespace: 'bos:monitor',
    subNamespaces: {
      performance: DEBUG_NAMESPACES.PERFORMANCE,
      error: DEBUG_NAMESPACES.ERROR,
    },
  },
  system: {
    namespace: 'bos:system',
    subNamespaces: {
      framework: 'bos:framework',
      development: 'bos:development',
    },
  },
} as const;

/**
 * Create a category debug function with sub-namespace methods
 */
function createCategoryDebugFunction<T extends CategoryDebugFunction>(
  categoryNamespace: string,
  subNamespaces: Record<string, string>
): T {
  // Create the main category debug function
  const categoryDebugFn = createEnhancedDebugger(categoryNamespace);

  // Add sub-namespace methods
  for (const [subName, subNamespace] of Object.entries(subNamespaces)) {
    (categoryDebugFn as Record<string, unknown>)[subName] = createEnhancedDebugger(subNamespace);
  }

  return categoryDebugFn as T;
}

/**
 * CategoryDebugSystem - Core implementation of the 6-category debug system
 */
export class CategoryDebugSystem {
  private static instance: CategoryDebugSystem | null = null;
  private _debugNetwork: NetworkDebugFunction;
  private _debugData: DataDebugFunction;
  private _debugUI: UIDebugFunction;
  private _debugBusiness: BusinessDebugFunction;
  private _debugMonitor: MonitorDebugFunction;
  private _debugSystem: SystemDebugFunction;

  constructor() {
    // Create category debug functions with sub-namespaces
    this._debugNetwork = createCategoryDebugFunction<NetworkDebugFunction>(
      CATEGORY_CONFIG.network.namespace,
      CATEGORY_CONFIG.network.subNamespaces
    );

    this._debugData = createCategoryDebugFunction<DataDebugFunction>(
      CATEGORY_CONFIG.data.namespace,
      CATEGORY_CONFIG.data.subNamespaces
    );

    this._debugUI = createCategoryDebugFunction<UIDebugFunction>(
      CATEGORY_CONFIG.ui.namespace,
      CATEGORY_CONFIG.ui.subNamespaces
    );

    this._debugBusiness = createCategoryDebugFunction<BusinessDebugFunction>(
      CATEGORY_CONFIG.business.namespace,
      CATEGORY_CONFIG.business.subNamespaces
    );

    this._debugMonitor = createCategoryDebugFunction<MonitorDebugFunction>(
      CATEGORY_CONFIG.monitor.namespace,
      CATEGORY_CONFIG.monitor.subNamespaces
    );

    this._debugSystem = createCategoryDebugFunction<SystemDebugFunction>(
      CATEGORY_CONFIG.system.namespace,
      CATEGORY_CONFIG.system.subNamespaces
    );
  }

  /**
   * Get singleton instance of CategoryDebugSystem
   */
  static getInstance(): CategoryDebugSystem {
    if (!CategoryDebugSystem.instance) {
      CategoryDebugSystem.instance = new CategoryDebugSystem();
    }
    return CategoryDebugSystem.instance;
  }

  /**
   * Network category debug function
   * Includes: api, auth, security, integration, websocket
   */
  get debugNetwork(): NetworkDebugFunction {
    return this._debugNetwork;
  }

  /**
   * Data category debug function
   * Includes: database, cache, validation, reactive, state
   */
  get debugData(): DataDebugFunction {
    return this._debugData;
  }

  /**
   * UI category debug function
   * Includes: component, navigation, notification
   */
  get debugUI(): UIDebugFunction {
    return this._debugUI;
  }

  /**
   * Business category debug function
   * Includes: workflow, search, upload, export
   */
  get debugBusiness(): BusinessDebugFunction {
    return this._debugBusiness;
  }

  /**
   * Monitor category debug function
   * Includes: performance, error
   */
  get debugMonitor(): MonitorDebugFunction {
    return this._debugMonitor;
  }

  /**
   * System category debug function
   * Includes: framework, development
   */
  get debugSystem(): SystemDebugFunction {
    return this._debugSystem;
  }

  /**
   * Get all category debug functions
   */
  getAllCategories() {
    return {
      debugNetwork: this._debugNetwork,
      debugData: this._debugData,
      debugUI: this._debugUI,
      debugBusiness: this._debugBusiness,
      debugMonitor: this._debugMonitor,
      debugSystem: this._debugSystem,
    };
  }

  /**
   * Check if any category is enabled
   */
  isAnyCategoryEnabled(): boolean {
    return Object.values(CATEGORY_CONFIG).some((config) => isDebugEnabled(config.namespace));
  }

  /**
   * Get all enabled categories
   */
  getEnabledCategories(): string[] {
    return Object.entries(CATEGORY_CONFIG)
      .filter(([_, config]) => isDebugEnabled(config.namespace))
      .map(([category]) => category);
  }
}

/**
 * Performance optimized category debug system with lazy loading
 */
let categorySystemInstance: CategoryDebugSystem | null = null;

/**
 * Get category debug system instance (lazy loaded)
 */
export function getCategoryDebugSystem(): CategoryDebugSystem {
  if (!categorySystemInstance) {
    categorySystemInstance = CategoryDebugSystem.getInstance();
  }
  return categorySystemInstance;
}
