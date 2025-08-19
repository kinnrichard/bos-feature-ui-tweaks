/**
 * Polymorphic Tracking System - Main Entry Point
 * 
 * Core polymorphic tracking system for managing dynamic polymorphic
 * associations in the frontend. Provides a complete solution for:
 * 
 * - Tracking polymorphic relationship types and their valid targets
 * - Integration with existing RelationshipRegistry infrastructure
 * - Dynamic discovery of polymorphic patterns from schema
 * - Type-safe configuration management
 * - Helper utilities for common operations
 * 
 * Usage:
 * ```typescript
 * import { initializePolymorphicSystem, getPolymorphicTracker } from './polymorphic';
 * 
 * // Initialize the system
 * await initializePolymorphicSystem();
 * 
 * // Use the tracker
 * const tracker = getPolymorphicTracker();
 * const validTargets = tracker.getValidTargets('loggable');
 * ```
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

// Core system exports
export { PolymorphicTracker, getPolymorphicTracker, initializePolymorphicTracking } from './tracker';
export { 
  PolymorphicRegistry, 
  getPolymorphicRegistry, 
  initializePolymorphicRegistry,
  registerModelRelationshipsWithPolymorphic,
  type PolymorphicRelationshipMetadata 
} from './registry';

// Discovery system exports
export { 
  PolymorphicDiscovery, 
  discoverPolymorphicRelationships,
  autoDiscoverAndConfigure,
  getPolymorphicPatterns,
  createPolymorphicDiscovery
} from './discovery';

// Utility exports
export { 
  PolymorphicUtils,
  RelationshipNamer,
  TypeConverter,
  PolymorphicValidator,
  ConfigUtils,
  IntegrationUtils,
  PolymorphicDebugUtils,
  isPolymorphicRelationshipName,
  createPolymorphicRelationshipName,
  validatePolymorphicTarget
} from './utils';

// Type exports
export type {
  PolymorphicType,
  PolymorphicTargetMetadata,
  PolymorphicAssociationConfig,
  PolymorphicConfig,
  PolymorphicDiscoveryResult,
  PolymorphicTrackingOptions,
  PolymorphicValidationResult
} from './types';

// System initialization
import { initializePolymorphicTracking } from './tracker';
import { initializePolymorphicRegistry } from './registry';
import { debugDatabase } from '../../utils/debug';

/**
 * Initialize the complete polymorphic tracking system
 */
export async function initializePolymorphicSystem(): Promise<void> {
  try {
    debugDatabase('Initializing polymorphic tracking system');

    // Initialize core tracker
    await initializePolymorphicTracking();

    // Initialize registry integration
    await initializePolymorphicRegistry();

    debugDatabase('Polymorphic tracking system initialized successfully');
  } catch (error) {
    debugDatabase.error('Failed to initialize polymorphic tracking system', { error });
    throw error;
  }
}

/**
 * System health check
 */
export async function validatePolymorphicSystem(): Promise<{
  healthy: boolean;
  errors: string[];
  warnings: string[];
}> {
  const { PolymorphicDebugUtils } = await import('./utils');
  const result = await PolymorphicDebugUtils.validateSystem();
  return {
    healthy: result.trackerValid && result.registryValid,
    errors: result.errors,
    warnings: result.warnings
  };
}

/**
 * Get system configuration summary
 */
export async function getPolymorphicSystemSummary(): Promise<{
  associations: number;
  targets: number;
  activeTargets: number;
  inactiveTargets: number;
}> {
  const tracker = (await import('./tracker')).getPolymorphicTracker();
  const config = tracker.getConfig();
  
  if (!config) {
    return { associations: 0, targets: 0, activeTargets: 0, inactiveTargets: 0 };
  }

  const { ConfigUtils } = await import('./utils');
  const summary = ConfigUtils.getConfigSummary(config);
  
  return {
    associations: summary.totalAssociations,
    targets: summary.totalTargets,
    activeTargets: summary.activeTargets,
    inactiveTargets: summary.inactiveTargets
  };
}

/**
 * Quick access to common polymorphic types
 */
export const POLYMORPHIC_TYPES = {
  NOTABLE: 'notable' as const,
  LOGGABLE: 'loggable' as const,
  SCHEDULABLE: 'schedulable' as const,
  TARGET: 'target' as const,
  PARSEABLE: 'parseable' as const
} as const;

/**
 * Common polymorphic field patterns
 */
export const POLYMORPHIC_FIELDS = {
  notable: { id: 'notable_id', type: 'notable_type' },
  loggable: { id: 'loggable_id', type: 'loggable_type' },
  schedulable: { id: 'schedulable_id', type: 'schedulable_type' },
  target: { id: 'target_id', type: 'target_type' },
  parseable: { id: 'parseable_id', type: 'parseable_type' }
} as const;

/**
 * Default configuration version
 */
export const POLYMORPHIC_CONFIG_VERSION = '1.0.0';

/**
 * Model integration exports (Epic-008 Phase 2)
 */
export {
  polymorphicModelIntegration,
  type PolymorphicRelationshipMetadata as ModelPolymorphicRelationshipMetadata
} from './model-integration';

export {
  declarePolymorphicRelationships,
  belongsToPolymorphic,
  hasManyPolymorphic,
  createPolymorphicIncludes,
  extractPolymorphicInfo,
  createPolymorphicConditions,
  validatePolymorphicValues,
  migrateToPolymorphic,
  isPolymorphicBelongsTo,
  isPolymorphicHasMany,
  isPolymorphicRelationship,
  capitalize,
  type ModelPolymorphicConfig,
  type PolymorphicQueryResult as ModelPolymorphicQueryResult
} from './model-helpers';

export {
  polymorphicSchemaGenerator
} from './schema-generator';

export {
  polymorphicMigration,
  migrateTableToPolymorphic,
  type MigrationAnalysis,
  type PolymorphicPattern,
  type MigrationOptions
} from './migration';

// Core polymorphic registry (from model integration)
export {
  polymorphicRegistry,
  type PolymorphicConfig as CorePolymorphicConfig,
  type PolymorphicFieldDefinition
} from './model-integration';

// Query System Exports (Epic-008 Phase 3 - Query System)
export {
  ChainableQuery,
  PolymorphicQuery,
  createPolymorphicQuery,
  createNotableQuery,
  createLoggableQuery,
  createSchedulableQuery,
  createTargetQuery,
  createParseableQuery,
  type PolymorphicConditions,
  type PolymorphicEagerLoadConfig
} from './query-system';

export {
  PolymorphicQueryBuilder,
  createNotableQueryBuilder,
  createLoggableQueryBuilder,
  createSchedulableQueryBuilder,
  createTargetQueryBuilder,
  createParseableQueryBuilder,
  createOptimizedPolymorphicQuery,
  type PolymorphicQueryOptions,
  type PolymorphicJoinConfig,
  type PolymorphicAggregationConfig,
  type PolymorphicQueryPlan
} from './query-builder';

export {
  PolymorphicQueryCache,
  PolymorphicCacheKeyGenerator,
  polymorphicQueryCache,
  executeCachedQuery,
  executeCachedQueries,
  warmPolymorphicCache,
  type PolymorphicCacheConfig,
  type CacheEntry,
  type CacheInvalidationEvent,
  type CacheMetrics
} from './query-cache';

export {
  ReactivePolymorphicQuery,
  ReactivePolymorphicQueryStore,
  reactivePolymorphicQueryStore,
  createReactivePolymorphicQuery,
  createReactiveNotableQuery,
  createReactiveLoggableQuery,
  createReactiveSchedulableQuery,
  createReactiveTargetQuery,
  createReactiveParseableQuery,
  useReactivePolymorphicQuery,
  cleanupReactiveQuery,
  type ReactiveQueryState,
  type ReactiveQueryOptions,
  type ReactiveQuerySubscription
} from './reactive-queries';

/**
 * Re-export for convenience
 */
export { debugDatabase as polymorphicDebugLogger };