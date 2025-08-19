/**
 * Polymorphic Query System - Usage Examples
 * 
 * Comprehensive examples showing how to use the polymorphic query system
 * for efficient querying of polymorphic relationships.
 * 
 * Examples include:
 * - Basic ChainableQuery usage
 * - Advanced QueryBuilder patterns
 * - Caching optimization
 * - Reactive queries for Svelte 5
 * - Integration with existing model patterns
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Query Examples
 */

import {
  createPolymorphicQuery,
  createNotableQuery,
  createLoggableQuery,
  PolymorphicQueryBuilder,
  createNotableQueryBuilder,
  createOptimizedPolymorphicQuery,
  polymorphicQueryCache,
  executeCachedQuery,
  warmPolymorphicCache,
  createReactivePolymorphicQuery
  // useReactivePolymorphicQuery
} from './query-system';
import type { BaseModelConfig } from '../../models/base/types';
import type { NoteData } from '../../models/types/note-data';
import type { ActivityLogData } from '../../models/types/activity-log-data';

// Example model configurations
const noteConfig: BaseModelConfig = {
  tableName: 'notes',
  supportsDiscard: true,
  primaryKey: 'id'
};

const activityLogConfig: BaseModelConfig = {
  tableName: 'activity_logs',
  supportsDiscard: false,
  primaryKey: 'id'
};

/**
 * EXAMPLE 1: Basic ChainableQuery Usage
 */
export async function basicQueryExamples() {
  console.warn('=== Basic ChainableQuery Examples ===');

  // Create a basic polymorphic query for notes
  const noteQuery = createNotableQuery<NoteData>(noteConfig);

  // Get all notes
  const allNotes = await noteQuery.all();
  console.warn(`Total notes: ${allNotes.length}`);

  // Get notes for specific target type (e.g., only Job notes)
  const jobNotes = await noteQuery
    .forTargetType('Job')
    .all();
  console.warn(`Job notes: ${jobNotes.length}`);

  // Get notes for specific target
  const specificJobNotes = await noteQuery
    .forTargetType('Job')
    .forTargetId(123)
    .all();
  console.warn(`Notes for Job #123: ${specificJobNotes.length}`);

  // Chain with regular query methods
  const recentJobNotes = await noteQuery
    .forTargetType('Job')
    .orderBy('created_at', 'desc')
    .limit(10)
    .all();
  console.warn(`Recent job notes: ${recentJobNotes.length}`);

  // Get notes with polymorphic targets included
  const notesWithTargets = await noteQuery
    .forTargetType(['Job', 'Task'])
    .includePolymorphicTargets()
    .all();
  console.warn(`Notes with targets: ${notesWithTargets.length}`);

  // Multiple polymorphic types
  const multiTypeQuery = createPolymorphicQuery<NoteData>(noteConfig)
    .forPolymorphicType(['notable', 'loggable'])
    .all();
  console.warn(`Multi-type results: ${(await multiTypeQuery).length}`);
}

/**
 * EXAMPLE 2: Advanced QueryBuilder Usage
 */
export async function advancedQueryBuilderExamples() {
  console.warn('=== Advanced QueryBuilder Examples ===');

  // Create a query builder for notable relationships
  const builder = createNotableQueryBuilder<NoteData>(noteConfig);

  // Configure complex query options
  const complexQuery = await builder
    .withOptions({
      includeTargets: true,
      targetTypes: ['Job', 'Task', 'Client'],
      groupByTargetType: true,
      orderByTargetType: 'asc',
      batchSize: 50
    })
    .withAggregation({
      fields: ['id'],
      functions: ['count'],
      groupByTargetType: true
    })
    .build();

  const results = await complexQuery.all();
  console.warn(`Complex query results: ${results.length}`);

  // Analyze query performance
  const queryPlan = await builder.analyzeQueryPlan();
  console.warn('Query plan:', {
    estimatedCost: queryPlan.estimatedCost,
    optimizations: queryPlan.optimizations,
    joinStrategy: queryPlan.joinStrategy
  });

  // Execute aggregation query
  const aggregationResults = await builder.executeAggregation();
  console.warn('Aggregation results:', aggregationResults);

  // Batch execution for multiple target types
  const batchExecutor = PolymorphicQueryBuilder.createBatchExecutor<NoteData>(
    noteConfig,
    'notable'
  );

  const batchResults = await batchExecutor.executeForTargets(['Job', 'Task', 'Client']);
  console.warn('Batch results by target type:', {
    jobs: batchResults.Job?.length || 0,
    tasks: batchResults.Task?.length || 0,
    clients: batchResults.Client?.length || 0
  });

  // Execute with counts
  const countsResults = await batchExecutor.executeWithCounts(['Job', 'Task']);
  console.warn('Results with counts:', {
    jobCount: countsResults.Job?.count || 0,
    taskCount: countsResults.Task?.count || 0
  });
}

/**
 * EXAMPLE 3: Caching and Optimization
 */
export async function cachingExamples() {
  console.warn('=== Caching and Optimization Examples ===');

  // Basic cached execution
  const noteQuery = createNotableQuery<NoteData>(noteConfig)
    .forTargetType('Job')
    .limit(20);

  const cachedResults = await executeCachedQuery(noteQuery);
  console.warn(`Cached results: ${cachedResults.length}`);

  // Execute again to see cache hit
  const cachedAgain = await executeCachedQuery(noteQuery);
  console.warn(`Cached again: ${cachedAgain.length}`);

  // Check cache metrics
  const metrics = polymorphicQueryCache.getMetrics();
  console.warn('Cache metrics:', {
    hitRatio: metrics.hitRatio,
    hits: metrics.hits,
    misses: metrics.misses,
    size: metrics.size
  });

  // Warm cache with common queries
  await warmPolymorphicCache(noteConfig, 'notable', ['Job', 'Task', 'Client']);
  console.warn('Cache warmed for common note queries');

  // Manual cache invalidation
  const invalidationEvent = polymorphicQueryCache.invalidate({
    tables: ['notes'],
    polymorphicTypes: ['notable']
  });
  console.warn(`Invalidated ${invalidationEvent.keys.length} cache entries`);

  // Create optimized query with analysis
  const optimizedQuery = await createOptimizedPolymorphicQuery({
    config: noteConfig,
    polymorphicType: 'notable',
    targetTypes: ['Job'],
    includeTargets: true,
    batchSize: 100,
    analyzeFirst: true
  });

  const optimizedResults = await optimizedQuery.all();
  console.warn(`Optimized results: ${optimizedResults.length}`);
}

/**
 * EXAMPLE 4: Reactive Queries for Svelte 5
 */
export async function reactiveQueryExamples() {
  console.warn('=== Reactive Query Examples ===');

  // Create a reactive query
  const reactiveNotes = createReactivePolymorphicQuery<NoteData>(
    noteConfig,
    'notable',
    { targetType: 'Job' },
    {
      refreshInterval: 30000, // 30 seconds
      staleTime: 60000, // 1 minute
      enableOptimistic: true,
      refreshOnFocus: true
    }
  );

  // Subscribe to changes
  const subscription = reactiveNotes.subscribe((state) => {
    console.warn('Reactive state changed:', {
      dataCount: state.data.length,
      loading: state.loading,
      error: state.error?.message,
      lastRefresh: new Date(state.lastRefresh).toISOString()
    });
  });

  // Wait for initial load
  await new Promise(resolve => setTimeout(resolve, 100));

  // Update conditions (triggers re-query)
  reactiveNotes.updateConditions({
    targetType: 'Task',
    targetId: 456
  });

  // Add optimistic update
  reactiveNotes.addOptimistic({
    id: 'temp-1',
    content: 'Optimistic note',
    notable_type: 'Task',
    notable_id: 456,
    created_at: new Date().toISOString()
  } as NoteData);

  // Refresh manually
  await reactiveNotes.refresh();

  // Clean up
  subscription.unsubscribe();
  reactiveNotes.destroy();
}

/**
 * EXAMPLE 5: Svelte Component Usage
 */
export function svelteComponentExample() {
  // This would be used inside a Svelte component
  const exampleSvelteCode = `
    <script lang="ts">
      import { useReactivePolymorphicQuery, cleanupReactiveQuery } from '$lib/zero/polymorphic';
      import { onDestroy } from 'svelte';
      
      export let jobId: number;
      
      // Create reactive query hook
      const { data, loading, error, refresh, updateConditions } = useReactivePolymorphicQuery(
        \`job-notes-\${jobId}\`,
        noteConfig,
        'notable',
        { targetType: 'Job', targetId: jobId },
        { refreshInterval: 30000 }
      );
      
      // Cleanup on component destroy
      onDestroy(() => {
        cleanupReactiveQuery(\`job-notes-\${jobId}\`);
      });
      
      // Handle job change
      $: if (jobId) {
        updateConditions({ targetType: 'Job', targetId: jobId });
      }
    </script>
    
    <div class="notes-section">
      {#if $loading}
        <div class="loading">Loading notes...</div>
      {:else if $error}
        <div class="error">Error: {$error.message}</div>
      {:else if $data.length === 0}
        <div class="empty">No notes found</div>
      {:else}
        <div class="notes">
          {#each $data as note (note.id)}
            <div class="note">
              <p>{note.content}</p>
              <small>Created: {note.created_at}</small>
            </div>
          {/each}
        </div>
      {/if}
      
      <button onclick={refresh}>Refresh Notes</button>
    </div>
  `;

  console.warn('=== Svelte Component Example ===');
  console.warn(exampleSvelteCode);
}

/**
 * EXAMPLE 6: Integration with Existing Models
 */
export async function modelIntegrationExamples() {
  console.warn('=== Model Integration Examples ===');

  // This shows how the query system integrates with existing ActiveRecord/ReactiveRecord models
  const integrationExample = `
    // In your Note model class:
    class Note extends ActiveRecord<NoteData> {
      // Standard ActiveRecord methods work
      static async findByJob(jobId: number): Promise<Note[]> {
        const query = createNotableQuery<NoteData>(Note.config)
          .forTargetType('Job')
          .forTargetId(jobId);
        
        const data = await executeCachedQuery(query);
        return data.map(noteData => new Note(noteData));
      }
      
      // Create reactive query for component usage
      static createReactiveQueryForJob(jobId: number): ReactivePolymorphicQuery<NoteData> {
        return createReactivePolymorphicQuery<NoteData>(
          Note.config,
          'notable',
          { targetType: 'Job', targetId: jobId },
          { refreshInterval: 30000 }
        );
      }
      
      // Get all notes for this job using polymorphic query
      async getRelatedNotes(): Promise<Note[]> {
        if (!this.notable_type || !this.notable_id) return [];
        
        const query = createNotableQuery<NoteData>(Note.config)
          .forTargetType(this.notable_type)
          .forTargetId(this.notable_id)
          .where({ id: { neq: this.id } }); // Exclude self
        
        const data = await query.all();
        return data.map(noteData => new Note(noteData));
      }
    }
    
    // Usage in components:
    const jobNotes = await Note.findByJob(123);
    const reactiveQuery = Note.createReactiveQueryForJob(123);
  `;

  console.warn(integrationExample);
}

/**
 * EXAMPLE 7: Activity Log Queries
 */
export async function activityLogExamples() {
  console.warn('=== Activity Log Examples ===');

  // Activity logs use the 'loggable' polymorphic type
  const logQuery = createLoggableQuery<ActivityLogData>(activityLogConfig);

  // Get activity logs for a specific job
  const jobLogs = await logQuery
    .forTargetType('Job')
    .forTargetId(123)
    .orderBy('created_at', 'desc')
    .limit(50)
    .all();
  console.warn(`Job activity logs: ${jobLogs.length}`);

  // Get logs for multiple target types
  const multiTargetLogs = await logQuery
    .forTargetType(['Job', 'Task', 'Client'])
    .orderBy('created_at', 'desc')
    .limit(100)
    .all();
  console.warn(`Multi-target logs: ${multiTargetLogs.length}`);

  // Get logs with target information included
  const logsWithTargets = await logQuery
    .forTargetType(['Job', 'Task'])
    .includePolymorphicTargets({
      targetCallback: (targetQuery, targetType) => {
        // Customize target loading based on type
        if (targetType === 'Job') {
          return targetQuery.where({ status: 'active' });
        }
        return targetQuery;
      }
    })
    .all();
  console.warn(`Logs with targets: ${logsWithTargets.length}`);

  // Use query builder for complex log analysis
  const logBuilder = new PolymorphicQueryBuilder<ActivityLogData>(
    activityLogConfig,
    'loggable'
  );

  const logAnalysis = await logBuilder
    .withOptions({
      targetTypes: ['Job', 'Task'],
      groupByTargetType: true
    })
    .withAggregation({
      fields: ['id'],
      functions: ['count'],
      groupByTargetType: true
    })
    .executeAggregation();

  console.warn('Log analysis by target type:', logAnalysis);
}

/**
 * EXAMPLE 8: Performance Testing
 */
export async function performanceExamples() {
  console.warn('=== Performance Examples ===');

  // Test query performance
  const startTime = Date.now();
  
  // Large query without cache
  const largeQuery = createNotableQuery<NoteData>(noteConfig)
    .forTargetType(['Job', 'Task', 'Client'])
    .limit(1000);
  
  const results = await largeQuery.all();
  const uncachedTime = Date.now() - startTime;
  
  // Same query with cache
  const cachedStartTime = Date.now();
  const cachedResults = await executeCachedQuery(largeQuery);
  const cachedTime = Date.now() - cachedStartTime;
  
  console.warn('Performance comparison:', {
    resultCount: results.length,
    uncachedTime: `${uncachedTime}ms`,
    cachedTime: `${cachedTime}ms`,
    improvement: `${Math.round(((uncachedTime - cachedTime) / uncachedTime) * 100)}%`
  });
  
  // Batch query performance
  const batchStartTime = Date.now();
  const batchExecutor = PolymorphicQueryBuilder.createBatchExecutor<NoteData>(
    noteConfig,
    'notable'
  );
  
  const batchResults = await batchExecutor.executeForTargets(['Job', 'Task', 'Client']);
  const batchTime = Date.now() - batchStartTime;
  
  const totalBatchResults = Object.values(batchResults).reduce(
    (sum, arr) => sum + (arr?.length || 0), 0
  );
  
  console.warn('Batch query performance:', {
    totalResults: totalBatchResults,
    batchTime: `${batchTime}ms`,
    averagePerTarget: `${Math.round(batchTime / 3)}ms`
  });
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.warn('🚀 Running Polymorphic Query System Examples');
  console.warn('=============================================');
  
  try {
    await basicQueryExamples();
    await advancedQueryBuilderExamples();
    await cachingExamples();
    await reactiveQueryExamples();
    svelteComponentExample();
    await modelIntegrationExamples();
    await activityLogExamples();
    await performanceExamples();
    
    console.warn('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
  }
}

// Export individual example functions for selective testing
export {
  basicQueryExamples,
  advancedQueryBuilderExamples,
  cachingExamples,
  reactiveQueryExamples,
  svelteComponentExample,
  modelIntegrationExamples,
  activityLogExamples,
  performanceExamples
};