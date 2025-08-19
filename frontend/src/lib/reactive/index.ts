/**
 * ReactiveRecord v2 - Phase 1 Core Implementation
 *
 * This module provides the core functionality for ReactiveRecord v2 with:
 * - 5-state lifecycle management (initializing → loading → hydrating → ready → error)
 * - Flash prevention through intelligent state transitions
 * - VisualState interface for clean UI integration
 * - Backward compatibility with existing ReactiveRecord API
 * - Zero.js integration with automatic query reuse
 */

// Core coordinator and state management
export {
  ReactiveCoordinator,
  createReactiveCoordinator,
  type CoordinatorState,
  type VisualState,
  type CoordinatorConfig,
} from './coordinator';

// Integration utilities and adapters
export {
  withCoordinator,
  ReactiveQueryAdapter,
  ReactiveQueryFactory,
  MigrationUtils,
  DevUtils,
  TypeGuards,
  type EnhancedReactiveQuery,
} from './integration';

// Factory functions for enhanced reactive records
export {
  EnhancedReactiveRecord,
  EnhancedReactiveScopedQuery,
  createEnhancedReactiveRecord,
  upgradeReactiveRecord,
  ReactiveRecordFactory,
  FactoryDevUtils,
} from './factory';

// Re-export ReactiveView component
export { default as ReactiveView } from './ReactiveView.svelte';

/**
 * Quick start examples for common usage patterns
 */
export const QuickStart = {
  /**
   * Basic usage - wrap existing ReactiveRecord
   *
   * @example
   * ```typescript
   * import { ReactiveRecordFactory } from '$lib/reactive';
   *
   * const ReactiveJob = ReactiveRecordFactory.create({
   *   tableName: 'jobs',
   *   className: 'Job'
   * });
   *
   * // Use exactly like before, but with flash prevention
   * const job = ReactiveJob.find('job-id');
   * $: data = job.data; // No more flashing!
   * ```
   */
  basic: ReactiveRecordFactory.create,

  /**
   * Navigation usage - optimized for page transitions
   *
   * @example
   * ```typescript
   * import { ReactiveRecordFactory } from '$lib/reactive';
   *
   * const ReactiveJob = ReactiveRecordFactory.createForNavigation({
   *   tableName: 'jobs',
   *   className: 'Job'
   * });
   *
   * // Optimized for fast navigation between pages
   * const jobs = ReactiveJob.kept().all();
   * ```
   */
  navigation: ReactiveRecordFactory.createForNavigation,

  /**
   * Initial load usage - optimized for first page load
   *
   * @example
   * ```typescript
   * import { ReactiveRecordFactory } from '$lib/reactive';
   *
   * const ReactiveJob = ReactiveRecordFactory.createForInitialLoad({
   *   tableName: 'jobs',
   *   className: 'Job'
   * });
   *
   * // Optimized for initial page loads with longer timeouts
   * const jobs = ReactiveJob.all().all();
   * ```
   */
  initialLoad: ReactiveRecordFactory.createForInitialLoad,
};

/**
 * Migration guide for upgrading existing code
 */
export const MigrationGuide = {
  /**
   * Step 1: Replace ReactiveRecord creation
   *
   * Before:
   * ```typescript
   * import { createReactiveRecord } from '$lib/models/base/reactive-record';
   * const ReactiveJob = createReactiveRecord({ tableName: 'jobs', className: 'Job' });
   * ```
   *
   * After:
   * ```typescript
   * import { ReactiveRecordFactory } from '$lib/reactive';
   * const ReactiveJob = ReactiveRecordFactory.create({ tableName: 'jobs', className: 'Job' });
   * ```
   */
  step1: 'Replace createReactiveRecord with ReactiveRecordFactory.create',

  /**
   * Step 2: Use ReactiveView for complex components
   *
   * Before:
   * ```svelte
   * <script>
   *   const jobs = ReactiveJob.kept().all();
   * </script>
   *
   * {#if jobs.isLoading}
   *   <div>Loading...</div>
   * {:else if jobs.error}
   *   <div>Error: {jobs.error.message}</div>
   * {:else if jobs.blank}
   *   <div>No jobs found</div>
   * {:else}
   *   {#each jobs.data as job}
   *     <JobCard {job} />
   *   {/each}
   * {/if}
   * ```
   *
   * After:
   * ```svelte
   * <script>
   *   import { ReactiveView } from '$lib/reactive';
   *   const jobs = ReactiveJob.kept().all();
   * </script>
   *
   * <ReactiveView query={jobs} strategy="progressive">
   *   {#snippet content({ data })}
   *     {#each data as job}
   *       <JobCard {job} />
   *     {/each}
   *   {/snippet}
   * </ReactiveView>
   * ```
   */
  step2: 'Use ReactiveView component for declarative state handling',

  /**
   * Step 3: Leverage visual state for advanced UX
   *
   * ```typescript
   * const enhancedQuery = ReactiveQueryFactory.create(jobs);
   * const visualState = enhancedQuery.getVisualState();
   *
   * // Access advanced state information
   * console.log(visualState.state);        // 'ready', 'loading', etc.
   * console.log(visualState.isFresh);      // Is data current?
   * console.log(visualState.isInitialLoad); // First load?
   * ```
   */
  step3: 'Use visual state for advanced UX patterns',
};

/**
 * Performance optimization tips
 */
export const PerformanceTips = {
  /**
   * Use appropriate factory methods for context
   */
  context:
    'Use ReactiveRecordFactory.createForNavigation() for page transitions, createForInitialLoad() for first loads',

  /**
   * Leverage stale data preservation
   */
  staleData: 'Enable preserveStaleData for smooth transitions between related views',

  /**
   * Monitor state transitions in development
   */
  debugging: 'Use DevUtils.monitorStateTransitions() to debug performance issues',

  /**
   * Optimize TTL values
   */
  ttl: 'Set appropriate TTL values based on data freshness requirements',
};

/**
 * Default export for convenience
 */
export default {
  ReactiveRecordFactory,
  ReactiveQueryFactory,
  MigrationUtils,
  QuickStart,
  MigrationGuide,
  PerformanceTips,
};
