/* eslint-disable no-console */
import { getEnabledNamespaces, getCategoryDebugSystem, CATEGORY_CONFIG } from './core';
import { getCompatibilityLayer } from './compatibility';

/**
 * Browser-specific debug helpers module
 * Provides development tools and browser console integration
 */

/**
 * Enhanced browser debug helper interface with category support
 */
interface BrowserDebugHelper {
  enable: (namespaces: string) => void;
  disable: () => void;
  status: () => void;
  list: () => void;

  // Category-specific helpers (NEW)
  categories: () => void;
  enableCategory: (category: string) => void;
  disableCategory: (category: string) => void;
  legacy: () => void;
  migration: () => void;
  validate: () => void;
}

/**
 * Create enhanced browser debug helper functions with category support
 */
function createBrowserDebugHelper(): BrowserDebugHelper {
  const categorySystem = getCategoryDebugSystem();
  const compatibilityLayer = getCompatibilityLayer();

  return {
    enable: (namespaces: string) => {
      localStorage.debug = namespaces;
      console.log(`🐛 Debug enabled for: ${namespaces}`);
      console.log('🔄 Refresh the page to see debug output');
      console.log(
        '💡 Enhanced features: All debug functions now have .warn() and .error() methods'
      );
      console.log('   Example: debugAPI.warn("message", data) or debugAPI.error("message", data)');
      console.log('🎯 New: Category system available - use bosDebug.categories() to explore');
    },

    disable: () => {
      localStorage.removeItem('debug');
      console.log('🐛 Debug disabled. Refresh the page.');
    },

    status: () => {
      const current = localStorage.debug;
      if (current) {
        console.log(`🐛 Debug enabled: ${current}`);
        const enabled = getEnabledNamespaces();
        if (enabled.length > 0) {
          console.log('🎯 Active namespaces:', enabled);
        }

        // Show category status
        const enabledCategories = categorySystem.getEnabledCategories();
        if (enabledCategories.length > 0) {
          console.log('📁 Active categories:', enabledCategories);
        }

        // Show compatibility mode
        if (compatibilityLayer.isLegacyModePreferred()) {
          console.log('🔄 Running in legacy compatibility mode');
        }
      } else {
        console.log('🐛 Debug disabled');
      }
    },

    list: () => {
      console.log('🐛 Available debug namespaces (19 total) - Enhanced with .warn/.error methods:');
      console.log('');
      console.log('📦 Core System:');
      console.log('   bos:api - API requests and responses (secure)');
      console.log('   bos:auth - Authentication operations (secure)');
      console.log('   bos:security - Security-related operations (secure)');
      console.log('   bos:reactive - Svelte reactive statements');
      console.log('   bos:state - Component state changes');
      console.log('   bos:component - General component debugging');
      console.log('   bos:cache - Cache and data synchronization');
      console.log('');
      console.log('💾 Data & Persistence:');
      console.log('   bos:database - Database queries and transactions (secure)');
      console.log('   bos:websocket - WebSocket communication (secure)');
      console.log('   bos:validation - Form and data validation');
      console.log('');
      console.log('⚡ Performance & Monitoring:');
      console.log('   bos:performance - Performance metrics and timing');
      console.log('   bos:error - Error handling and recovery');
      console.log('');
      console.log('🎨 User Interface:');
      console.log('   bos:navigation - Routing and page transitions');
      console.log('   bos:notification - Alerts and messages');
      console.log('');
      console.log('🏢 Business Logic:');
      console.log('   bos:workflow - Business process flows');
      console.log('   bos:search - Search operations');
      console.log('   bos:upload - File upload operations (secure)');
      console.log('   bos:export - Data export operations');
      console.log('   bos:integration - Third-party integrations (secure)');
      console.log('');
      console.log('💡 Basic Examples:');
      console.log('   bosDebug.enable("bos:*") - Enable all debugging');
      console.log('   bosDebug.enable("bos:api,bos:auth") - Enable specific namespaces');
      console.log('   bosDebug.enable("bos:*,-bos:cache") - Enable all except cache');
      console.log('');
      console.log('🎯 Level-based Controls:');
      console.log('   bosDebug.enable("bos:api:warn") - Enable API warnings only');
      console.log('   bosDebug.enable("bos:*:error") - Enable all error levels');
      console.log('   bosDebug.enable("bos:auth:*") - Enable auth at all levels');
      console.log('');
      console.log('🔧 Enhanced Usage:');
      console.log('   debugAPI("info message", data) - Info level');
      console.log('   debugAPI.warn("warning message", data) - Warning level');
      console.log('   debugAPI.error("error message", data) - Error level');
      console.log('');
      console.log('📁 NEW: Category System (use bosDebug.categories() for details)');
    },

    // NEW: Category-specific helpers
    categories: () => {
      console.log('📁 6-Category Debug System - NEW in Epic 016:');
      console.log('');
      console.log('🌐 debugNetwork - Network operations');
      console.log('   Sub-namespaces: api, auth, security, integration, websocket');
      console.log('   Usage: debugNetwork.api("API call", data)');
      console.log('   Enable: bosDebug.enableCategory("network")');
      console.log('');
      console.log('💾 debugData - Data management');
      console.log('   Sub-namespaces: database, cache, validation, reactive, state');
      console.log('   Usage: debugData.database("Query", { sql, duration })');
      console.log('   Enable: bosDebug.enableCategory("data")');
      console.log('');
      console.log('🎨 debugUI - User interface');
      console.log('   Sub-namespaces: component, navigation, notification');
      console.log('   Usage: debugUI.component("Render", { name, props })');
      console.log('   Enable: bosDebug.enableCategory("ui")');
      console.log('');
      console.log('🏢 debugBusiness - Business logic');
      console.log('   Sub-namespaces: workflow, search, upload, export');
      console.log('   Usage: debugBusiness.workflow("Step", { process, status })');
      console.log('   Enable: bosDebug.enableCategory("business")');
      console.log('');
      console.log('📊 debugMonitor - Monitoring & performance');
      console.log('   Sub-namespaces: performance, error');
      console.log('   Usage: debugMonitor.performance("Metric", { duration })');
      console.log('   Enable: bosDebug.enableCategory("monitor")');
      console.log('');
      console.log('⚙️ debugSystem - System & framework');
      console.log('   Sub-namespaces: framework, development');
      console.log('   Usage: debugSystem.framework("Debug", { component })');
      console.log('   Enable: bosDebug.enableCategory("system")');
      console.log('');
      console.log('💡 Category Examples:');
      console.log('   bosDebug.enable("bos:network") - Enable all network debugging');
      console.log('   bosDebug.enable("bos:data,bos:ui") - Enable data and UI categories');
      console.log('   bosDebug.enable("bos:network:api") - Enable only network API debugging');
    },

    enableCategory: (category: string) => {
      const config = (CATEGORY_CONFIG as Record<string, unknown>)[category];
      if (!config) {
        console.error(`❌ Unknown category: ${category}`);
        console.log('Available categories: network, data, ui, business, monitor, system');
        return;
      }

      const current = localStorage.debug || '';
      const newNamespace = config.namespace;

      // Add category namespace to current debug setting
      const namespaces = current ? `${current},${newNamespace}` : newNamespace;
      localStorage.debug = namespaces;

      console.log(`📁 Category enabled: ${category} (${newNamespace})`);
      console.log('🔄 Refresh the page to see debug output');
      console.log(`💡 Sub-namespaces available: ${Object.keys(config.subNamespaces).join(', ')}`);
    },

    disableCategory: (category: string) => {
      const config = (CATEGORY_CONFIG as Record<string, unknown>)[category];
      if (!config) {
        console.error(`❌ Unknown category: ${category}`);
        return;
      }

      const current = localStorage.debug || '';
      const namespaceToRemove = config.namespace;

      // Remove category namespace from current debug setting
      const namespaces = current
        .split(',')
        .filter((ns: string) => ns.trim() !== namespaceToRemove)
        .join(',');

      if (namespaces) {
        localStorage.debug = namespaces;
      } else {
        localStorage.removeItem('debug');
      }

      console.log(`📁 Category disabled: ${category} (${namespaceToRemove})`);
      console.log('🔄 Refresh the page to apply changes');
    },

    legacy: () => {
      console.log('🔄 Legacy Debug Functions (19 total) - 100% Backward Compatible:');
      console.log('');
      const legacyFunctions = compatibilityLayer.getLegacyFunctions();
      const functionNames = Object.keys(legacyFunctions);

      functionNames.forEach((name, index) => {
        const func = (legacyFunctions as Record<string, { namespace: string }>)[name];
        console.log(
          `${String(index + 1).padStart(2, ' ')}. ${name} - namespace: ${func.namespace}`
        );
      });

      console.log('');
      console.log('💡 All legacy functions have enhanced capabilities:');
      console.log('   - .warn() method for warning level logging');
      console.log('   - .error() method for error level logging');
      console.log('   - Automatic security redaction');
      console.log('   - TypeScript support');
      console.log('');
      console.log('📈 Performance metrics:');
      const metrics = compatibilityLayer.getPerformanceMetrics();
      console.log(`   Legacy functions: ${metrics.legacyFunctionCount}`);
      console.log(`   Category functions: ${metrics.categoryFunctionCount}`);
      console.log(`   Memory optimized: ${metrics.memoryOptimized}`);
    },

    migration: () => {
      console.log('🔄 Migration Guide - Legacy to Category System:');
      console.log('');
      const recommendations = compatibilityLayer.getMigrationRecommendations();

      console.log('📋 Legacy Approach (continues to work):');
      recommendations.legacy.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });

      console.log('');
      console.log('📁 Category Approach (new recommended):');
      recommendations.category.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });

      console.log('');
      console.log('🔧 Mixed Approach (gradual transition):');
      recommendations.mixed.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });

      console.log('');
      console.log('🎯 Migration Examples:');
      console.log('');
      console.log('   // Before (still works)');
      console.log('   import { debugAPI, debugAuth } from "./debug";');
      console.log('   debugAPI("Request", { url });');
      console.log('   debugAuth("Login", { userId });');
      console.log('');
      console.log('   // After (new approach)');
      console.log('   import { debugNetwork } from "./debug";');
      console.log('   debugNetwork.api("Request", { url });');
      console.log('   debugNetwork.auth("Login", { userId });');
    },

    validate: () => {
      console.log('🔍 Debug System Validation:');
      console.log('');

      // Validate backward compatibility
      const isCompatible = compatibilityLayer.validateBackwardCompatibility();
      console.log(`✅ Backward compatibility: ${isCompatible ? 'PASSED' : 'FAILED'}`);

      // Validate category system
      const categoryEnabled = categorySystem.isAnyCategoryEnabled();
      console.log(`📁 Category system: ${categoryEnabled ? 'ACTIVE' : 'INACTIVE'}`);

      // Show performance metrics
      const metrics = compatibilityLayer.getPerformanceMetrics();
      console.log(`📊 Performance: ${metrics.memoryOptimized ? 'OPTIMIZED' : 'NOT OPTIMIZED'}`);

      console.log('');
      console.log('📋 System Status:');
      console.log(`   Legacy functions available: ${metrics.legacyFunctionCount}`);
      console.log(`   Category functions available: ${metrics.categoryFunctionCount}`);
      console.log(`   Total functions: ${metrics.totalFunctionCount}`);

      if (isCompatible && metrics.memoryOptimized) {
        console.log('');
        console.log('🎉 Debug system is fully operational and optimized!');
      } else {
        console.log('');
        console.log('⚠️ Debug system has issues - check console for errors');
      }
    },
  };
}

/**
 * Initialize browser debug helpers in development mode
 */
export function initializeBrowserDebugHelpers(): void {
  // Only initialize in browser environment and development mode
  if (typeof window === 'undefined' || !import.meta.env.DEV) {
    return;
  }

  // Create and expose debug helper
  const debugHelper = createBrowserDebugHelper();

  // @ts-expect-error - Development only window extension
  window.bosDebug = debugHelper;

  // Show available commands with enhanced category support
  console.log('🐛 Enhanced Debug Helper: window.bosDebug (Epic 016 - Category System)');
  console.log('');
  console.log('📋 Basic Commands:');
  console.log('   bosDebug.enable("bos:*") - Enable all debugging (19 namespaces + 6 categories)');
  console.log('   bosDebug.disable() - Disable all debugging');
  console.log('   bosDebug.status() - Check current debug settings');
  console.log('   bosDebug.list() - Show all available namespaces');
  console.log('');
  console.log('📁 NEW: Category Commands:');
  console.log('   bosDebug.categories() - Explore the new 6-category system');
  console.log('   bosDebug.enableCategory("network") - Enable network category');
  console.log('   bosDebug.enableCategory("data") - Enable data category');
  console.log('   bosDebug.legacy() - Show legacy functions (backward compatibility)');
  console.log('   bosDebug.migration() - Migration guide from legacy to categories');
  console.log('   bosDebug.validate() - Validate system health and compatibility');
  console.log('');
  console.log('🎯 Quick Examples:');
  console.log('   bosDebug.enable("bos:network") - Enable all network debugging');
  console.log('   bosDebug.enable("bos:data:database") - Enable only database debugging');
  console.log('   bosDebug.enable("bos:*:error") - Enable all error levels');
}

/**
 * Get debug status for display in UI
 */
export function getDebugStatus(): {
  enabled: boolean;
  namespaces: string[];
  current: string | null;
} {
  const current = typeof localStorage !== 'undefined' ? localStorage.debug : null;
  const enabled = !!current;
  const namespaces = enabled ? getEnabledNamespaces() : [];

  return {
    enabled,
    namespaces,
    current,
  };
}

/**
 * Check if we're in a browser environment
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Check if we're in development mode
 */
export function isDevelopmentMode(): boolean {
  return import.meta.env.DEV;
}
