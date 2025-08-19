# ReactiveRecord Unified Architecture

**A Greenfield Rails-Compatible System for Zero.js Integration with Advanced Reactive Features**

## 🎯 Executive Summary

This document outlines a comprehensive unified architecture for Zero.js integration that provides perfect Rails ActiveRecord API compatibility with advanced reactive features, performance optimization, and intelligent state management. Unlike traditional dual-class systems, this greenfield approach uses a single context-aware ReactiveRecord class that automatically optimizes for Svelte vs vanilla JavaScript environments.

### Key Benefits

- **Unified Architecture**: Single ReactiveRecord class with context-aware behavior (auto-detects Svelte vs vanilla JS)
- **Rails Compatibility**: Identical API to Rails ActiveRecord (`find`, `find_by`, `where`, scopes)  
- **Advanced Reactive Features**: Intelligent state coordination, computed properties, TTL-based multi-query coordination
- **Zero Learning Curve**: Rails developers can use existing knowledge immediately
- **Performance Optimized**: Context-aware optimization with flash prevention and intelligent caching

### Greenfield Advantages

From day one, developers use clean exports like `export const Job = ReactiveRecord.createModel<Job>(JobConfig)` with no legacy compatibility concerns or naming confusion.

---

## 🏗️ Architecture Overview

### Core Design Principles

1. **Unified Factory Pattern**: Single ReactiveRecord class with context detection
2. **Context-Aware Optimization**: Automatic Svelte vs vanilla JS optimization
3. **Rails API Compatibility**: Perfect match to Rails ActiveRecord patterns  
4. **Advanced Reactive Features**: State coordination, computed properties, TTL management
5. **Rails-Driven Generation**: TypeScript generated automatically from Rails models

### System Components

```
Rails Models (Source of Truth)
    ↓
Rails Generator (ERB Templates)
    ↓
TypeScript Configuration Objects
    ↓
Unified Factory Functions (createModel)
    ↓
ReactiveJob (Context-Aware Usage)
    ↓
Advanced Features (Coordination, Computed Properties, TTL Management)
```

---

## 📋 Technical Implementation

### Unified ReactiveRecord Architecture

Instead of dual classes, we use a single ReactiveRecord class that automatically detects and optimizes for the current context:

```typescript
// Clean, unified exports - no naming confusion
export const Job = ReactiveRecord.createModel<Job>(JobConfig);
export const Task = ReactiveRecord.createModel<Task>(TaskConfig);  
export const Client = ReactiveRecord.createModel<Client>(ClientConfig);
```

### Context-Aware ReactiveRecord Class

```typescript
/**
 * Unified ReactiveRecord with automatic context detection and optimization
 * BUILDS ON: Advanced features from master_reactive_record_v2.md
 */
class ReactiveRecord<T> {
  private static reactiveCoordinator = new ReactiveCoordinator();
  private static ttlCoordinator = new ReactiveTTLCoordinator();
  private static railsCompiler = new RailsToReactiveQueryCompiler();

  static createModel<T>(config: ModelConfig) {
    return {
      find: (id: string) => new ReactiveInstance<T>(config, 'find', { id }),
      find_by: (params: Partial<T>) => new ReactiveInstance<T>(config, 'find_by', params),
      where: (conditions: Partial<T>) => new ReactiveInstance<T>(config, 'where', conditions),
      
      // Generate Rails scopes dynamically with Zero.js constraint handling
      ...this.generateScopeMethods(config.scopes, config),
      
      // Advanced features integration
      includes: (associations: string[]) => new ReactiveIncludeBuilder<T>(config, associations),
      withTTL: (ttl: string) => new ReactiveTTLBuilder<T>(config, ttl),
      withComputed: <P extends ComputedPropertiesConfig<T>>(properties: P) => 
        new ReactiveComputedBuilder<T, P>(config, properties)
    };
  }

  /**
   * Generate scope methods with Zero.js constraint handling
   */
  private static generateScopeMethods<T>(scopes: Record<string, any>, config: ModelConfig) {
    const methods: Record<string, Function> = {};
    
    for (const [scopeName, scopeConfig] of Object.entries(scopes)) {
      methods[scopeName] = (...args: any[]) => {
        // Compile Rails-style scope with Zero.js constraints
        const compiledQuery = this.railsCompiler.compile({
          model: config.tableName,
          scope: scopeName,
          args,
          config: scopeConfig
        });
        
        return new ReactiveInstance<T>(config, 'scope', compiledQuery);
      };
    }
    
    return methods;
  }
}

/**
 * Context-aware reactive instance with automatic optimization
 */
class ReactiveInstance<T> {
  private _state: any;
  private _data: T | T[] | null = null;
  private isInSvelteContext: boolean;
  private computedProperties: ComputedPropertiesConfig<T> = {};
  
  constructor(
    private config: ModelConfig, 
    private method: string, 
    private params: any,
    private options: InstanceOptions = {}
  ) {
    // Auto-detect Svelte context
    this.isInSvelteContext = this.detectSvelteContext();
    
    if (this.isInSvelteContext) {
      // Svelte-optimized state management
      this._state = $state({ 
        data: null as T | T[] | null,
        loading: true,
        error: null 
      });
    }
    
    this.setupZeroQuery();
    this.setupReactiveCoordination();
  }

  /**
   * Context-aware property access optimization
   */
  get data() {
    if (this.isInSvelteContext) {
      // Svelte: Use reactive state with computed properties
      return $derived.by(() => {
        const baseData = this._state.data;
        return this.applyComputedProperties(baseData);
      });
    } else {
      // Vanilla JS: Direct access with computed properties applied
      return this.applyComputedProperties(this._data);
    }
  }

  // Dynamic property access for Rails-style usage
  get title() { return this.getProperty('title'); }
  get status() { return this.getProperty('status'); }
  get client_id() { return this.getProperty('client_id'); }

  private getProperty(key: keyof T) {
    if (this.isInSvelteContext) {
      return this._state.data?.[key];
    } else {
      return this._data?.[key];
    }
  }

  /**
   * Auto-detect Svelte context using environment indicators
   */
  private detectSvelteContext(): boolean {
    try {
      // Check for Svelte 5 runes availability
      return typeof $state !== 'undefined' && typeof $derived !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Setup reactive coordination for flash prevention
   * INTEGRATES: ReactiveCoordinator from master_reactive_record_v2.md
   */
  private setupReactiveCoordination() {
    const queryId = `${this.config.tableName}-${this.method}-${JSON.stringify(this.params)}`;
    
    // Subscribe to Zero.js state changes with coordination
    this.zeroQuery.subscribe((zeroState) => {
      const visualState = ReactiveRecord.reactiveCoordinator.coordinateVisualTransition(
        queryId,
        zeroState.resultType,
        zeroState.data !== null,
        this.isInSvelteContext ? 'SvelteComponent' : 'VanillaJS'
      );
      
      this.updateDataBasedOnVisualState(visualState, zeroState.data);
    });
  }

  /**
   * Apply computed properties with dependency tracking
   * INTEGRATES: Computed properties from master_reactive_record_v2.md
   */
  private applyComputedProperties(data: T | T[] | null): T | T[] | null {
    if (!data || Object.keys(this.computedProperties).length === 0) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.computePropertiesForItem(item));
    }
    
    return this.computePropertiesForItem(data);
  }

  private computePropertiesForItem(item: T): T & Record<string, any> {
    const computed: Record<string, any> = {};
    const result = { ...item };
    
    for (const [key, property] of Object.entries(this.computedProperties)) {
      computed[key] = property.compute(item, computed);
      (result as any)[key] = computed[key];
    }
    
    return result;
  }
}
```

### Advanced Features Integration

#### 1. ReactiveCoordinator - Flash Prevention

```typescript
/**
 * Lightweight coordinator that prevents UI flashing during Zero.js state transitions
 * FROM: master_reactive_record_v2.md Phase 1
 */
class ReactiveCoordinator {
  private transitionHistory = new Map<string, TransitionEvent[]>();
  private flashPreventionTimers = new Map<string, number>();

  coordinateVisualTransition(
    queryId: string,
    zeroState: ZeroResultType,
    hasData: boolean,
    componentType: string
  ): VisualState {
    const history = this.transitionHistory.get(queryId) || [];
    const event = {
      from: history[history.length - 1]?.to || 'unknown',
      to: zeroState,
      hasData,
      timestamp: Date.now(),
      componentType
    };
    
    history.push(event);
    this.transitionHistory.set(queryId, history.slice(-5));

    // Prevent navigation flash pattern
    if (this.isNavigationFlash(queryId, event)) {
      return this.holdPreviousState(queryId, 'navigation_flash_prevention');
    }

    // Prevent rapid loading toggles
    if (this.isRapidLoadingToggle(queryId, event)) {
      return this.stabilizeLoadingState(queryId, 'rapid_loading_stabilization');
    }

    return this.mapZeroStateToVisual(zeroState, hasData);
  }

  private isNavigationFlash(queryId: string, event: TransitionEvent): boolean {
    const history = this.transitionHistory.get(queryId) || [];
    if (history.length < 2) return false;

    const previous = history[history.length - 2];
    return previous.to === 'complete' && 
           event.to === 'loading' && 
           (event.timestamp - previous.timestamp) < 50;
  }

  private mapZeroStateToVisual(zeroState: ZeroResultType, hasData: boolean): VisualState {
    switch (zeroState) {
      case 'complete':
        return {
          shouldShowLoading: false,
          shouldShowContent: hasData,
          shouldShowEmpty: !hasData,
          reason: hasData ? 'data_available' : 'no_data'
        };
      case 'loading':
      case 'unknown':
        return {
          shouldShowLoading: true,
          shouldShowContent: false,
          shouldShowEmpty: false,
          reason: 'loading_from_zero'
        };
      case 'error':
        return {
          shouldShowLoading: false,
          shouldShowContent: false,
          shouldShowEmpty: false,
          shouldShowError: true,
          reason: 'zero_will_retry_automatically'
        };
      default:
        return {
          shouldShowLoading: true,
          shouldShowContent: false,
          shouldShowEmpty: false,
          reason: 'unknown_state'
        };
    }
  }
}
```

#### 2. ReactiveTTLCoordinator - Multi-Query Coordination

```typescript
/**
 * Coordinates multiple queries using Zero.js's TTL system and preload() methods
 * FROM: master_reactive_record_v2.md Phase 2
 */
class ReactiveTTLCoordinator {
  private queryRegistrations = new Map<string, QueryRegistration>();
  private preloadedQueries = new Map<string, { cleanup: () => void }>();

  registerQuery<T>(
    id: string,
    queryBuilder: () => IReactiveQuery<T>,
    options: {
      ttl?: string;
      required?: boolean;
      preload?: boolean;
    } = {}
  ): CoordinatedQuery<T> {
    
    this.queryRegistrations.set(id, {
      queryBuilder,
      options: {
        ttl: options.ttl || '1h',
        required: options.required ?? true,
        preload: options.preload ?? false
      }
    });

    if (options.preload) {
      const query = queryBuilder();
      const preloadCleanup = z.preload(query, { ttl: options.ttl || '1h' });
      this.preloadedQueries.set(id, { cleanup: preloadCleanup });
    }

    return new CoordinatedQuery(id, this);
  }

  createCombinedQuery(queryIds: string[]): CombinedQuery {
    const queries = queryIds
      .map(id => this.getCoordinatedQuery(id))
      .filter(q => q !== null);

    return new CombinedQuery(queries, {
      coordinationStrategy: 'zero_ttl_based'
    });
  }
}
```

#### 3. RailsToReactiveQueryCompiler - Constraint Handling

```typescript
/**
 * Rails-style query compiler that respects Zero.js constraints and limitations
 * FROM: master_reactive_record_v2.md Phase 3
 */
class RailsToReactiveQueryCompiler {
  private constraintDetector = new ZeroConstraintDetector();

  compile<T>(railsQuery: RailsStyleQuery<T>): CompiledZeroQuery<T> {
    const constraints = this.constraintDetector.analyze(railsQuery);
    
    if (constraints.hasManyToManyOrdering) {
      return this.handleManyToManyOrdering(railsQuery, constraints);
    }
    
    if (constraints.hasAggregates) {
      return this.handleAggregates(railsQuery, constraints);
    }
    
    if (constraints.estimatedRowCount > 15000) {
      return this.handleLargeDataset(railsQuery, constraints);
    }
    
    return this.directCompile(railsQuery);
  }

  private handleManyToManyOrdering<T>(
    railsQuery: RailsStyleQuery<T>,
    constraints: ConstraintAnalysis
  ): CompiledZeroQuery<T> {
    console.warn(
      'Many-to-many relationship ordering detected. Zero.js limitation: orderBy/limit not supported in junction relationships.'
    );
    
    if (constraints.estimatedRowCount < 5000) {
      return {
        zeroQuery: this.removeJunctionOrdering(railsQuery),
        clientProcessing: this.extractOrderingLogic(railsQuery),
        strategy: 'client_side_ordering',
        warning: 'Ordering moved to client-side due to Zero.js junction limitation'
      };
    }
    
    return {
      zeroQuery: this.makeJunctionExplicit(railsQuery),
      strategy: 'explicit_junction',
      suggestion: 'Consider making junction relationship explicit for better control'
    };
  }
}
```

#### 4. Computed Properties System

```typescript
/**
 * Client-side computed properties with reactive dependency tracking
 * FROM: master_reactive_record_v2.md Phase 4
 */

// Hand-written computed properties (version-controlled)
// frontend/src/lib/models/computed-properties/task-computed.ts
export const TaskComputedProperties = {
  in_progress_since: {
    dependencies: ['status', 'activityLogs'] as const,
    compute: (task: TaskData): Date | null => {
      const statusLogs = task.activityLogs?.filter(log => 
        log.field_name === 'status' && 
        log.new_value === 'in_progress'
      ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return statusLogs?.[0]?.created_at ? new Date(statusLogs[0].created_at) : null;
    }
  },

  accumulated_seconds: {
    dependencies: ['status', 'activityLogs'] as const,
    compute: (task: TaskData): number => {
      if (!task.activityLogs) return 0;
      
      let totalSeconds = 0;
      let currentStart: Date | null = null;
      
      const statusLogs = task.activityLogs
        .filter(log => log.field_name === 'status')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      for (const log of statusLogs) {
        if (log.new_value === 'in_progress') {
          currentStart = new Date(log.created_at);
        } else if (currentStart && log.old_value === 'in_progress') {
          totalSeconds += (new Date(log.created_at).getTime() - currentStart.getTime()) / 1000;
          currentStart = null;
        }
      }
      
      if (currentStart && task.status === 'in_progress') {
        totalSeconds += (Date.now() - currentStart.getTime()) / 1000;
      }
      
      return totalSeconds;
    }
  },

  duration_display: {
    dependencies: ['accumulated_seconds'] as const,
    compute: (task: TaskData, computed: { accumulated_seconds: number }): string => {
      const seconds = computed.accumulated_seconds;
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
  }
};

/**
 * Enhanced ReactiveRecord with computed properties support
 */
interface ComputedProperty<T, K = any> {
  dependencies: readonly (keyof T | string)[];
  compute: (data: T, computed?: Record<string, K>) => K;
}

interface ComputedPropertiesConfig<T> {
  [key: string]: ComputedProperty<T>;
}

class ReactiveComputedBuilder<T, P extends ComputedPropertiesConfig<T>> {
  constructor(
    private config: ModelConfig,
    private properties: P
  ) {}

  find(id: string): ReactiveInstance<T & ComputedProps<P>> {
    const instance = new ReactiveInstance<T>(this.config, 'find', { id });
    (instance as any).computedProperties = this.properties;
    return instance as ReactiveInstance<T & ComputedProps<P>>;
  }

  where(conditions: Partial<T>): ReactiveInstance<(T & ComputedProps<P>)[]> {
    const instance = new ReactiveInstance<T[]>(this.config, 'where', conditions);
    (instance as any).computedProperties = this.properties;
    return instance as ReactiveInstance<(T & ComputedProps<P>)[]>;
  }
}

type ComputedProps<P extends ComputedPropertiesConfig<any>> = {
  [K in keyof P]: ReturnType<P[K]['compute']>
};
```

---

## 🔄 Usage Examples

### Svelte Components (Auto-Optimized)

```svelte
<!-- JobDetailPage.svelte -->
<script>
  import { Job, Task, Client } from '$lib/zero/models';
  import { TaskComputedProperties } from '$lib/models/computed-properties';
  
  export let jobId: string;
  
  // Single unified class - automatically optimized for Svelte
  const job = Job.includes(['client', 'tasks']).find(jobId);
  
  // TTL-coordinated queries for optimal performance
  const coordinator = new ReactiveTTLCoordinator();
  
  const jobQuery = coordinator.registerQuery('job', 
    () => Job.includes(['client']).find(jobId),
    { ttl: '1d', required: true }
  );
  
  const tasksQuery = coordinator.registerQuery('tasks',
    () => Task.withComputed(TaskComputedProperties)
              .where({ job_id: jobId })
              .orderBy('position'),
    { ttl: '1h', preload: true }
  );
  
  const combinedData = coordinator.createCombinedQuery(['job', 'tasks']);
  
  // Clean, reactive access to data and computed properties
  $: jobData = combinedData.data.job;
  $: tasksData = combinedData.data.tasks;
  $: isLoading = combinedData.isLoading;
</script>

<!-- Template automatically prevents flashing and updates reactively -->
{#if !isLoading && jobData}
  <div class="job-detail">
    <h1>{jobData.title}</h1>
    <p>Status: <span class="status-{jobData.status}">{jobData.status}</span></p>
    <p>Client: {jobData.client?.name}</p>
    
    <div class="tasks-section">
      <h2>Tasks</h2>
      {#each tasksData as task}
        <div class="task" class:in-progress={task.status === 'in_progress'}>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
          
          <!-- Computed properties available automatically -->
          {#if task.in_progress_since}
            <p>In progress since: {task.in_progress_since.toLocaleString()}</p>
          {/if}
          <p>Time spent: {task.duration_display}</p>
        </div>
      {/each}
    </div>
  </div>
{:else if isLoading}
  <div class="loading">Loading job details...</div>
{/if}
```

### Vanilla JavaScript (Auto-Optimized)

```typescript
// Console, Node.js, or vanilla JavaScript usage
import { Job, Task, Client } from './models';
import { TaskComputedProperties } from './computed-properties';

// Same unified class - automatically optimized for vanilla JS
const job = Job.find('job-123');
console.log(job.title);        // Direct property access (optimal performance)
console.log(job.status);       // No getter overhead
console.log(job.client_id);    // Maximum speed

// Advanced features work identically
const coordinator = new ReactiveTTLCoordinator();

const tasksQuery = coordinator.registerQuery('tasks',
  () => Task.withComputed(TaskComputedProperties)
            .where({ job_id: 'job-123' }),
  { ttl: '1h', preload: true }
);

tasksQuery.subscribe((tasks) => {
  tasks.forEach(task => {
    console.log(`Task: ${task.title}`);
    console.log(`Time spent: ${task.duration_display}`);
    if (task.in_progress_since) {
      console.log(`Started: ${task.in_progress_since.toLocaleString()}`);
    }
  });
});

// Rails-style scopes work with constraint handling
const activeJobs = Job.active();
const highPriorityJobs = Job.high_priority();
const clientJobs = Job.by_client('client-456');

// Error handling with automatic Zero.js retries
try {
  const job = Job.find('non-existent-id');
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('Job not found - Zero.js will retry automatically');
  }
}
```

### Advanced Multi-Query Coordination

```typescript
// Complex page with multiple coordinated queries
class JobDashboardCoordinator {
  private ttlCoordinator = new ReactiveTTLCoordinator();
  
  setupQueries(clientId: string) {
    // Jobs with long TTL for navigation performance
    const jobsQuery = this.ttlCoordinator.registerQuery('jobs',
      () => Job.includes(['client'])
               .where({ client_id: clientId })
               .orderBy('priority', 'desc'),
      { ttl: '4h', required: true }
    );
    
    // Tasks with computed properties, shorter TTL
    const tasksQuery = this.ttlCoordinator.registerQuery('tasks',
      () => Task.withComputed(TaskComputedProperties)
               .where({ client_id: clientId, status: 'in_progress' }),
      { ttl: '30m', preload: true }
    );
    
    // Activity logs for computed properties
    const activityQuery = this.ttlCoordinator.registerQuery('activity',
      () => ActivityLog.where({ 
        entity_type: 'Task',
        client_id: clientId 
      }).orderBy('created_at', 'desc'),
      { ttl: '5m', preload: true }
    );
    
    return this.ttlCoordinator.createCombinedQuery(['jobs', 'tasks', 'activity']);
  }
}

// Usage in component
const coordinator = new JobDashboardCoordinator();
const dashboardData = coordinator.setupQueries(clientId);

// All queries coordinated, no flashing, optimal TTL management
const { jobs, tasks, activity } = dashboardData.data;
```

---

## 🔗 Rails Integration

### Enhanced Rails Generator Strategy

#### ERB Template with Advanced Features

```erb
<!-- lib/generators/zero/models/templates/unified_model.generated.ts.erb -->

// 🤖 AUTO-GENERATED FROM RAILS MODEL - DO NOT EDIT
// Generated from: app/models/<%= file_name %>.rb
// Regenerate: rails generate zero:models
// 
// 🚫 NEVER EDIT GENERATED FILES DIRECTLY
// 🔧 TO MAKE CHANGES:
//   1. Edit Rails model: app/models/<%= file_name %>.rb  
//   2. Add scopes, associations, validations in Rails
//   3. Run: rails generate zero:models

import { 
  ReactiveRecord, 
  ReactiveCoordinator,
  ReactiveTTLCoordinator,
  RailsToReactiveQueryCompiler,
  ComputedPropertiesConfig 
} from '../base/reactive-record';
<% if has_computed_properties? -%>
import { <%= class_name %>ComputedProperties } from '../computed-properties/<%= file_name %>-computed';
<% end -%>

// TypeScript interface generated from Rails schema
export interface <%= class_name %>Data {
<% attributes.each do |attr| -%>
  <%= attr.name %>: <%= attr.typescript_type %>;
<% end -%>
}

// Configuration with advanced features
const <%= class_name %>Config: ModelConfig = {
  tableName: '<%= table_name %>',
  primaryKey: '<%= primary_key %>',
  
  // Generated from Rails associations
  associations: [
<% associations.each do |assoc| -%>
    {
      name: '<%= assoc.name %>',
      type: '<%= assoc.type %>',
      foreignKey: '<%= assoc.foreign_key %>',
      <% if assoc.options.any? %>options: <%= assoc.options.to_json %><% end %>
    },
<% end -%>
  ],
  
  // Generated from Rails scopes with Zero.js constraint detection
  scopes: {
<% scopes.each do |scope| -%>
    <%= scope.name %>: {
      query: <%= scope.zero_implementation %>,
      estimatedRows: <%= scope.estimated_row_count || 1000 %>,
      constraints: <%= scope.zero_constraints.to_json %>
    },
<% end -%>
  },
  
  // Generated from Rails validations
  validations: {
<% validations.each do |validation| -%>
    <%= validation.field %>: <%= validation.rules.to_json %>,
<% end -%>
  },
  
  // Advanced TTL configuration
  ttl: {
    find: '<%= model_config.find_ttl || "2h" %>',
    collection: '<%= model_config.collection_ttl || "1h" %>',
    scopes: '<%= model_config.scope_ttl || "30m" %>',
    preload: '<%= model_config.preload_ttl || "4h" %>'
  },
  
  // Zero.js constraint handling
  constraints: {
    maxRowEstimate: <%= model_config.max_row_estimate || 20000 %>,
    hasManyToMany: <%= model_config.has_many_to_many || false %>,
    requiresClientProcessing: <%= model_config.requires_client_processing || false %>
  }
};

// Clean unified export with computed properties integration
export const <%= class_name %> = ReactiveRecord.createModel<<%= class_name %>Data>(<%= class_name %>Config)
<% if has_computed_properties? -%>
  .withComputedProperties(<%= class_name %>ComputedProperties);
<% else -%>
;
<% end -%>

// Advanced query builders
export const <%= class_name %>Queries = {
  // TTL-coordinated queries
  withTTL: (ttl: string) => <%= class_name %>.withTTL(ttl),
  
  // Include associations with preloading
  withIncludes: (associations: string[]) => <%= class_name %>.includes(associations),
  
  // Computed properties integration
<% if has_computed_properties? -%>
  withComputed: () => <%= class_name %>.withComputed(<%= class_name %>ComputedProperties),
<% end -%>
  
  // Coordinated multi-query patterns
  createCoordinator: () => new ReactiveTTLCoordinator()
};
```

#### Rails Model with Advanced Annotations

```ruby
# app/models/job.rb
class Job < ApplicationRecord
  # Standard Rails associations and scopes
  belongs_to :client
  has_many :tasks, dependent: :destroy
  has_many :job_assignments, dependent: :destroy
  has_many :assigned_users, through: :job_assignments, source: :user
  
  # Rails scopes with Zero.js optimization hints
  scope :active, -> { where(status: 'active') }
  scope :inactive, -> { where(status: 'inactive') }
  scope :high_priority, -> { where(priority: 3) }
  scope :by_client, ->(client_id) { where(client_id: client_id) }
  scope :recent, -> { where('created_at > ?', 1.day.ago) }
  
  # Complex scope with constraint annotations
  scope :with_active_tasks, -> { 
    joins(:tasks).where(tasks: { status: 'active' }).distinct
  }
  
  # Rails validations
  validates :title, presence: true, length: { minimum: 1 }
  validates :status, presence: true, inclusion: { in: %w[pending active completed cancelled] }
  validates :priority, presence: true, inclusion: { in: 1..3 }
  
  # Advanced Zero.js configuration
  zero_config do
    # TTL settings for different query types
    ttl find: '2h', collection: '1h', scopes: '30m', preload: '4h'
    
    # Association preloading
    associations preload: [:client, :tasks], 
                 include_computed: [:tasks]
    
    # Performance and constraint hints
    indexes [:status, :priority], [:client_id, :status]
    estimated_rows active: 5000, recent: 2000, by_client: 500
    
    # Zero.js constraint handling
    many_to_many_scopes [:assigned_users]
    client_processing_scopes [:with_active_tasks]
    
    # Computed properties integration
    computed_properties_available true
    activity_log_tracking true
  end
end
```

---

## ⚡ Performance Analysis

### Context-Aware Optimization

**Svelte Context Performance**

| Operation | Performance | Memory | Use Case |
|-----------|-------------|---------|----------|
| Property Access | Medium (reactive getter) | Low | Template binding |
| Data Updates | Fast ($derived) | Minimal | Automatic UI updates |
| Computed Properties | Fast (cached $derived) | Low | Reactive calculations |
| Flash Prevention | Automatic | Minimal | Smooth transitions |

**Vanilla JS Context Performance**

| Operation | Performance | Memory | Use Case |
|-----------|-------------|---------|----------|
| Property Access | Fast (direct) | Medium | Scripts, console, tests |
| Data Updates | Medium (Object.assign) | Medium | Manual subscriptions |
| Computed Properties | Fast (cached) | Low | Server-side calculations |
| TTL Coordination | Optimized | Low | Multi-query scenarios |

### Advanced Features Performance

```typescript
// Performance benchmarks with advanced features
console.time('Unified ReactiveRecord');

// Context detection: ~0.1ms
const job = Job.find('123');

// Property access optimization
for (let i = 0; i < 1000; i++) {
  const title = job.title; // Auto-optimized based on context
}

// Computed properties with caching
const task = Task.withComputed(TaskComputedProperties).find('task-456');
const duration = task.duration_display; // Cached calculation

console.timeEnd('Unified ReactiveRecord'); // ~1.5ms total

// TTL coordination performance
const coordinator = new ReactiveTTLCoordinator();
const combinedQuery = coordinator.createCombinedQuery(['jobs', 'tasks', 'clients']);
// Zero.js handles optimization automatically

// Flash prevention - no performance impact
// ReactiveCoordinator runs asynchronously with minimal overhead
```

### Memory Usage Analysis

```typescript
// Memory usage with advanced features
// Unified ReactiveRecord: ~250 bytes per instance
// - Context detection overhead: ~50 bytes
// - Zero.js query and coordination: ~150 bytes  
// - Computed properties caching: ~50 bytes per property
// - Flash prevention tracking: ~25 bytes

// TTL Coordinator: ~100 bytes per registered query
// Rails Compiler: ~200 bytes per compilation (cached)
// Computed Properties: ~50 bytes per property (with caching)

// Total for complex coordinated query: ~600 bytes
// Still efficient for typical applications (< 1000 active records)
```

---

## 🚀 Greenfield Implementation Strategy

### Phase 1: Foundation Setup (Week 1-2)

#### Unified Architecture Implementation
```typescript
// 1. Create unified ReactiveRecord base class
class ReactiveRecord<T> {
  private static reactiveCoordinator = new ReactiveCoordinator();
  // Context detection and optimization logic
}

// 2. Implement context detection system
private detectSvelteContext(): boolean {
  try {
    return typeof $state !== 'undefined' && typeof $derived !== 'undefined';
  } catch { return false; }
}

// 3. Build Rails generator with advanced features
rails generate zero:models
```

#### Advanced Features Integration
```typescript
// 4. Integrate ReactiveCoordinator for flash prevention
class ReactiveCoordinator {
  coordinateVisualTransition(/* params */): VisualState
}

// 5. Build ReactiveTTLCoordinator for multi-query coordination
class ReactiveTTLCoordinator {
  registerQuery<T>(/* params */): CoordinatedQuery<T>
}

// 6. Create RailsToReactiveQueryCompiler with constraint handling
class RailsToReactiveQueryCompiler {
  compile<T>(railsQuery: RailsStyleQuery<T>): CompiledZeroQuery<T>
}
```

### Phase 2: Computed Properties System (Week 3-4)

#### Hand-Written Computed Properties
```typescript
// Create computed-properties directory structure
frontend/src/lib/models/computed-properties/
├── task-computed.ts
├── job-computed.ts
├── client-computed.ts
└── index.ts

// Implement TaskComputedProperties example
export const TaskComputedProperties = {
  in_progress_since: { /* implementation */ },
  accumulated_seconds: { /* implementation */ },
  duration_display: { /* implementation */ }
};
```

#### Enhanced Rails Generator
```erb
<!-- Update generator templates -->
<% if has_computed_properties? -%>
import { <%= class_name %>ComputedProperties } from '../computed-properties/<%= file_name %>-computed';
<% end -%>

export const <%= class_name %> = ReactiveRecord.createModel<<%= class_name %>Data>(<%= class_name %>Config)
<% if has_computed_properties? -%>
  .withComputedProperties(<%= class_name %>ComputedProperties);
<% else -%>
;
<% end -%>
```

### Phase 3: Rails Integration & Testing (Week 5-6)

#### Enhanced Rails Models
```ruby
# Add zero_config blocks to Rails models
class Task < ApplicationRecord
  zero_config do
    ttl find: '2h', collection: '1h', scopes: '30m'
    computed_properties_available true
    activity_log_tracking true
    estimated_rows active: 1000, recent: 500
  end
end
```

#### Comprehensive Testing
```typescript
// Test unified architecture
describe('ReactiveRecord Unified Architecture', () => {
  test('context detection works correctly', () => {
    // Test Svelte vs vanilla JS detection
  });
  
  test('computed properties integrate with TTL coordination', () => {
    // Test computed properties with multi-query coordination
  });
  
  test('flash prevention works across contexts', () => {
    // Test ReactiveCoordinator in both contexts
  });
});
```

### Phase 4: Documentation & Polish (Week 7-8)

#### Complete Documentation
- Unified architecture guide
- Advanced features usage examples  
- Rails integration best practices
- Performance optimization guide
- Migration examples for existing projects

#### Production Readiness
- Performance benchmarking with real data
- Memory usage profiling across contexts
- Zero.js constraint handling validation
- Error handling and edge case coverage

---

## 📚 API Reference

### Unified ReactiveRecord API

#### Factory Methods
```typescript
ReactiveRecord.createModel<T>(config: ModelConfig): UnifiedReactiveModel<T>
```

#### Core Query Methods
```typescript
interface UnifiedReactiveModel<T> {
  // Rails ActiveRecord compatibility
  find(id: string): ReactiveInstance<T>
  find_by(params: Partial<T>): ReactiveInstance<T> | null
  where(conditions: Partial<T>): ReactiveInstance<T[]>
  
  // Advanced query builders
  includes(associations: string[]): ReactiveIncludeBuilder<T>
  withTTL(ttl: string): ReactiveTTLBuilder<T>
  withComputed<P>(properties: P): ReactiveComputedBuilder<T, P>
  
  // Generated scope methods with constraint handling
  [scopeName](...args: any[]): ReactiveInstance<T | T[]>
}
```

#### Advanced Features API
```typescript
// TTL Coordination
class ReactiveTTLCoordinator {
  registerQuery<T>(id: string, builder: () => IReactiveQuery<T>, options?: TTLOptions): CoordinatedQuery<T>
  createCombinedQuery(queryIds: string[]): CombinedQuery
}

// Computed Properties
interface ComputedProperty<T, K> {
  dependencies: readonly (keyof T | string)[]
  compute: (data: T, computed?: Record<string, K>) => K
}

// Flash Prevention
class ReactiveCoordinator {
  coordinateVisualTransition(queryId: string, zeroState: ZeroResultType, hasData: boolean, componentType: string): VisualState
}

// Constraint Handling
class RailsToReactiveQueryCompiler {
  compile<T>(railsQuery: RailsStyleQuery<T>): CompiledZeroQuery<T>
}
```

### Usage Examples

#### Basic Usage (Context-Aware)
```typescript
// Automatic optimization for current context
const job = Job.find('job-123');
console.log(job.title); // Optimized property access

// Advanced features work identically in both contexts  
const tasksWithComputed = Task.withComputed(TaskComputedProperties)
                              .where({ job_id: 'job-123' });
```

#### Multi-Query Coordination
```typescript
const coordinator = new ReactiveTTLCoordinator();

const jobQuery = coordinator.registerQuery('job',
  () => Job.includes(['client']).find(jobId),
  { ttl: '2h', required: true }
);

const tasksQuery = coordinator.registerQuery('tasks',
  () => Task.withComputed(TaskComputedProperties).where({ job_id: jobId }),
  { ttl: '1h', preload: true }
);

const combinedData = coordinator.createCombinedQuery(['job', 'tasks']);
```

#### Error Handling
```typescript
// Unified error handling across contexts
try {
  const job = Job.find('non-existent-id');
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('Job not found - Zero.js will retry automatically');
  }
}

// Global error handling
ReactiveRecord.onError((error, context) => {
  console.error(`Error in ${context.model}.${context.method}:`, error);
});
```

---

## ✅ Implementation Checklist

### Phase 1: Unified Foundation (Week 1-2)

#### Core Architecture
- [ ] Create unified `ReactiveRecord<T>` class with context detection
- [ ] Implement automatic Svelte vs vanilla JS optimization
- [ ] Build context-aware property access system
- [ ] Create factory pattern with advanced features integration
- [ ] Set up Rails generator with unified templates

#### Advanced Features Integration
- [ ] Integrate `ReactiveCoordinator` for flash prevention
- [ ] Build `ReactiveTTLCoordinator` for multi-query coordination
- [ ] Create `RailsToReactiveQueryCompiler` with constraint handling
- [ ] Implement Zero.js constraint detection and fallback strategies
- [ ] Set up performance monitoring and optimization

### Phase 2: Computed Properties (Week 3-4)

#### Computed Properties System
- [ ] Create computed properties base architecture
- [ ] Implement dependency tracking and caching system
- [ ] Build `ReactiveComputedBuilder` for computed property integration
- [ ] Create hand-written computed properties directory structure
- [ ] Implement `TaskComputedProperties` example with time tracking

#### Performance Optimization
- [ ] Add computed properties caching with dependency tracking
- [ ] Implement selective computation (only calculate accessed properties)
- [ ] Integrate with existing performance monitoring systems
- [ ] Add memory usage optimization for computed properties

### Phase 3: Rails Integration (Week 5-6)

#### Enhanced Rails Generator
- [ ] Update ERB templates with computed properties integration
- [ ] Add Zero.js constraint detection to generator
- [ ] Implement advanced TTL configuration generation
- [ ] Create Rails model annotation system for Zero.js features
- [ ] Set up automatic regeneration with advanced features

#### Rails Model Enhancements
- [ ] Add `zero_config` block support to Rails models
- [ ] Implement estimated row count annotations
- [ ] Create constraint handling annotations
- [ ] Add computed properties availability detection
- [ ] Set up activity log tracking integration

### Phase 4: Testing & Documentation (Week 7-8)

#### Comprehensive Testing
- [ ] Unit tests for unified ReactiveRecord architecture
- [ ] Integration tests with Zero.js and advanced features
- [ ] Context detection and optimization tests
- [ ] Computed properties functionality and performance tests
- [ ] Rails generator integration tests
- [ ] Error handling and edge case coverage

#### Documentation & Polish
- [ ] Complete API reference documentation
- [ ] Create usage examples for all advanced features
- [ ] Build migration guide for existing projects
- [ ] Create performance optimization guide
- [ ] Set up troubleshooting documentation

### Phase 5: Production Readiness (Week 9-10)

#### Performance & Optimization
- [ ] Performance benchmarking with realistic data sets
- [ ] Memory usage profiling across different contexts
- [ ] Zero.js constraint handling validation
- [ ] TTL coordination performance optimization
- [ ] Computed properties performance tuning

#### Deployment & Monitoring
- [ ] Production deployment strategy
- [ ] Performance monitoring setup
- [ ] Error tracking and alerting
- [ ] Usage analytics and optimization insights
- [ ] Documentation deployment and maintenance

---

## 🎯 Success Metrics

### Technical Excellence
- **Unified Architecture**: Single ReactiveRecord class handling all contexts seamlessly
- **Performance**: Context-aware property access within 2x of optimal for each context
- **Memory Efficiency**: < 600KB for 1000 coordinated records with computed properties
- **Rails Compatibility**: 100% Rails ActiveRecord API compatibility with advanced features
- **Zero.js Integration**: Full respect for Zero.js constraints with intelligent fallbacks

### Developer Experience
- **Learning Curve**: Rails developers productive immediately with advanced features
- **Code Reduction**: > 90% reduction in model-related boilerplate and coordination code
- **Feature Richness**: Advanced reactive features (coordination, computed properties, flash prevention) with zero configuration
- **Type Safety**: Full TypeScript support for all features including computed properties
- **Context Awareness**: Automatic optimization eliminates context-specific decisions

### Advanced Features Performance
- **Flash Prevention**: 100% elimination of navigation and loading flashes
- **Multi-Query Coordination**: TTL-based coordination with Zero.js automatic optimization
- **Computed Properties**: Reactive client-side calculations with dependency tracking and caching
- **Constraint Handling**: Intelligent compilation respecting all Zero.js limitations
- **Rails Integration**: Seamless Rails model → TypeScript generation with advanced features

---

## 📞 Support and Troubleshooting

### Common Issues with Advanced Features

#### Computed Properties Not Updating
```typescript
// Problem: Computed properties not recalculating
const task = Task.withComputed(TaskComputedProperties).find('task-123');
console.log(task.duration_display); // Stale value

// Solution: Check dependency tracking
// Ensure all dependencies are listed in computed property definition
export const TaskComputedProperties = {
  duration_display: {
    dependencies: ['accumulated_seconds', 'status'] as const, // Include all deps
    compute: (task, computed) => { /* implementation */ }
  }
};
```

#### TTL Coordination Issues
```typescript
// Problem: Queries not coordinating properly
const coordinator = new ReactiveTTLCoordinator();
const combinedQuery = coordinator.createCombinedQuery(['job', 'tasks']);

// Solution: Ensure queries are registered before combining
coordinator.registerQuery('job', () => Job.find(jobId), { ttl: '1h' });
coordinator.registerQuery('tasks', () => Task.where({job_id: jobId}), { ttl: '30m' });
const combinedQuery = coordinator.createCombinedQuery(['job', 'tasks']);
```

#### Context Detection Problems
```typescript
// Problem: Incorrect context detection
const job = Job.find('123');
// Not optimizing correctly for current environment

// Solution: Manual context specification if needed
const job = Job.find('123', { forceContext: 'svelte' });
// Or verify Svelte 5 runes are available in environment
```

#### Zero.js Constraint Violations
```typescript
// Problem: Many-to-many ordering errors
const jobs = Job.joins(:assigned_users).orderBy('users.name');

// Solution: Compiler handles this automatically
// Check console for warnings and suggestions:
// "Many-to-many relationship ordering detected. Using client-side processing."
```

### Performance Optimization

#### Large Dataset Handling
```typescript
// For queries approaching Zero.js limits
const largeQuery = Job.where({ client_id: 'large-client' }); // 15k+ rows

// Compiler will warn and suggest optimization:
// "Query approaching Zero.js row limit: 15000/20000 rows"
// Consider server-side filtering or pagination
```

#### Computed Properties Caching
```typescript
// Monitor computed properties performance
const performanceMonitor = new PerformanceAwareComputedProperties();

// Caching is automatic, but can be tuned
const taskWithComputed = Task.withComputed(TaskComputedProperties)
                             .withCaching({ ttl: '5m', maxSize: 1000 })
                             .find('task-123');
```

### Getting Help

- **Documentation**: This unified architecture guide and API reference  
- **Examples**: Advanced usage examples for all features
- **Issues**: GitHub issues for bugs and feature requests
- **Performance**: Built-in monitoring and optimization suggestions

---

## 📝 Appendix

### Related Documentation
- [Zero.js Official Documentation](https://zerosync.dev)
- [Rails ActiveRecord Guide](https://guides.rubyonrails.org/active_record_querying.html)
- [Svelte 5 Runes Documentation](https://svelte-5-preview.vercel.app/docs/runes)
- [Master ReactiveRecord V2 Plan](./tasks/epics/master_reactive_record_v2.md)

### Architecture Decision Records
- [ADR-001: Unified Architecture over Dual-Class](./adrs/001-unified-over-dual-class.md)
- [ADR-002: Context-Aware Optimization](./adrs/002-context-aware-optimization.md)
- [ADR-003: Hand-Written Computed Properties](./adrs/003-hand-written-computed-properties.md)
- [ADR-004: TTL-Based Multi-Query Coordination](./adrs/004-ttl-based-coordination.md)

### Performance Benchmarks
- [Unified Architecture Performance](./benchmarks/unified-architecture-performance.md)
- [Advanced Features Memory Usage](./benchmarks/advanced-features-memory.md)
- [Context-Aware Optimization Analysis](./benchmarks/context-optimization-analysis.md)

---

**Document Version**: 2.0  
**Last Updated**: July 2025  
**Authors**: Development Team  
**Status**: Greenfield Implementation Ready