# EP-0008: Reactive UI State Management & Component Coordination

## Executive Summary

Create a comprehensive UI state management layer that eliminates loading flashes, provides seamless component coordination, and delivers predictable reactive behavior across the application. This epic addresses the visual inconsistencies, state synchronization issues, and component coordination challenges identified in recent development while maintaining developer-friendly patterns.

**Core Focus**: Building on the ReactiveRecord V2 foundation to create a unified UI state management system that coordinates multiple reactive queries, manages visual transitions, and provides consistent loading states across all components.

## Core Architectural Pillars

### 1. **Unified Visual State Coordination**
Eliminate loading flashes and visual inconsistencies through intelligent transition management that coordinates between multiple reactive queries and provides smooth UI experiences.

### 2. **Component State Synchronization** 
Provide seamless state sharing between components through reactive patterns that automatically update dependent components when shared state changes.

### 3. **Predictable Loading States**
Implement a five-state loading system (idle, loading, loaded, error, empty) that provides consistent behavior across all UI components and eliminates unpredictable state transitions.

### 4. **Cross-Component Data Coordination**
Enable intelligent data sharing between components that automatically handles dependencies, prevents duplicate queries, and maintains data consistency.

### 5. **Performance-Optimized State Management**
Leverage reactive patterns and intelligent caching to minimize unnecessary re-renders, optimize query coordination, and provide responsive UI experiences.

---

## 🎯 **Phase 1: Visual State Coordination Engine (Week 1)**

### Problem Being Solved
Recent UI development has revealed loading flashes, inconsistent loading states, and unpredictable visual transitions when navigating between components or updating data. Components often show brief flickers or loading states during what should be seamless transitions.

### Visual State Coordinator Architecture

```typescript
/**
 * Central coordinator for managing visual state transitions across components
 * Prevents flashes, coordinates loading states, and provides smooth UX
 */
class VisualStateCoordinator {
  private transitionRegistry = new Map<string, ComponentTransition>();
  private flashPrevention = new FlashPreventionEngine();
  private stateHistory = new ComponentStateHistory();

  /**
   * Register a component for coordinated state management
   */
  registerComponent(
    componentId: string,
    config: {
      queryIds: string[];
      loadingStrategy: 'immediate' | 'delayed' | 'coordinated';
      flashPrevention: boolean;
      dependencies?: string[];
    }
  ): ComponentStateManager {
    
    const manager = new ComponentStateManager(componentId, config, this);
    this.transitionRegistry.set(componentId, {
      manager,
      config,
      lastTransition: null,
      dependents: new Set()
    });

    // Register dependencies
    if (config.dependencies) {
      config.dependencies.forEach(depId => {
        const dependent = this.transitionRegistry.get(depId);
        if (dependent) {
          dependent.dependents.add(componentId);
        }
      });
    }

    return manager;
  }

  /**
   * Coordinate state transitions across dependent components
   */
  coordinateTransition(
    componentId: string,
    newState: ComponentState,
    context: TransitionContext
  ): VisualTransitionPlan {
    
    const transition = this.transitionRegistry.get(componentId);
    if (!transition) {
      throw new Error(`Component ${componentId} not registered for coordination`);
    }

    // Analyze flash risk
    const flashRisk = this.flashPrevention.analyzeTransition(
      componentId,
      transition.lastTransition,
      newState,
      context
    );

    // Create transition plan
    const plan: VisualTransitionPlan = {
      componentId,
      targetState: newState,
      flashPrevention: flashRisk.requiresPrevention,
      coordinatedComponents: [],
      delayStrategy: this.determineDelayStrategy(flashRisk, transition.config),
      visualEffects: this.planVisualEffects(newState, context)
    };

    // Coordinate with dependent components
    if (transition.dependents.size > 0) {
      plan.coordinatedComponents = this.planDependentTransitions(
        componentId,
        newState,
        transition.dependents
      );
    }

    // Record transition
    transition.lastTransition = {
      state: newState,
      timestamp: Date.now(),
      context,
      plan
    };

    return plan;
  }

  /**
   * Execute coordinated transition plan
   */
  async executeTransition(plan: VisualTransitionPlan): Promise<TransitionResult> {
    const results: ComponentTransitionResult[] = [];

    // Handle flash prevention
    if (plan.flashPrevention) {
      await this.flashPrevention.preventFlash(plan.componentId, plan.delayStrategy);
    }

    // Execute main component transition
    const mainResult = await this.executeComponentTransition(
      plan.componentId,
      plan.targetState,
      plan.visualEffects
    );
    results.push(mainResult);

    // Execute coordinated component transitions
    if (plan.coordinatedComponents.length > 0) {
      const coordinatedResults = await Promise.all(
        plan.coordinatedComponents.map(coordPlan =>
          this.executeComponentTransition(
            coordPlan.componentId,
            coordPlan.targetState,
            coordPlan.visualEffects
          )
        )
      );
      results.push(...coordinatedResults);
    }

    return {
      success: results.every(r => r.success),
      results,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
      visualEffectsApplied: plan.visualEffects
    };
  }
}
```

### Flash Prevention Engine

```typescript
/**
 * Specialized engine for preventing loading flashes and visual inconsistencies
 */
class FlashPreventionEngine {
  private flashHistory = new Map<string, FlashEvent[]>();
  private preventionTimers = new Map<string, number>();

  /**
   * Analyze transition for flash risk
   */
  analyzeTransition(
    componentId: string,
    lastTransition: ComponentTransition | null,
    newState: ComponentState,
    context: TransitionContext
  ): FlashRiskAssessment {
    
    const history = this.flashHistory.get(componentId) || [];
    
    // Check for rapid state changes
    const rapidChanges = this.detectRapidStateChanges(history, newState);
    
    // Check for navigation-induced flashes
    const navigationFlash = this.detectNavigationFlash(lastTransition, newState, context);
    
    // Check for data-loading flashes
    const dataFlash = this.detectDataLoadingFlash(lastTransition, newState);

    return {
      requiresPrevention: rapidChanges || navigationFlash || dataFlash,
      riskLevel: this.calculateRiskLevel(rapidChanges, navigationFlash, dataFlash),
      preventionStrategy: this.selectPreventionStrategy(rapidChanges, navigationFlash, dataFlash),
      recommendedDelay: this.calculateOptimalDelay(history, newState)
    };
  }

  /**
   * Prevent flash using selected strategy
   */
  async preventFlash(
    componentId: string,
    strategy: DelayStrategy
  ): Promise<void> {
    
    switch (strategy.type) {
      case 'hold_previous_content':
        await this.holdPreviousContent(componentId, strategy.duration);
        break;
        
      case 'fade_transition':
        await this.applyFadeTransition(componentId, strategy.duration);
        break;
        
      case 'skeleton_overlay':
        await this.applySkeletonOverlay(componentId, strategy.duration);
        break;
        
      case 'coordinated_delay':
        await this.coordinatedDelay(componentId, strategy.duration);
        break;
    }
  }

  /**
   * Detect rapid state changes that cause visual instability
   */
  private detectRapidStateChanges(
    history: FlashEvent[],
    newState: ComponentState
  ): boolean {
    
    if (history.length < 2) return false;
    
    const recent = history.slice(-3);
    const timeWindow = 200; // 200ms window
    
    // Check for loading -> loaded -> loading pattern
    const hasRapidToggle = recent.length >= 3 &&
      recent[0].state === 'loading' &&
      recent[1].state === 'loaded' &&
      recent[2].state === 'loading' &&
      (recent[2].timestamp - recent[0].timestamp) < timeWindow;
    
    return hasRapidToggle;
  }

  /**
   * Detect navigation-induced flashes
   */
  private detectNavigationFlash(
    lastTransition: ComponentTransition | null,
    newState: ComponentState,
    context: TransitionContext
  ): boolean {
    
    return context.trigger === 'navigation' &&
           lastTransition?.state === 'loaded' &&
           newState === 'loading' &&
           context.expectedDuration < 100; // Quick navigation
  }
}
```

### Component State Manager

```typescript
/**
 * Individual component state manager that integrates with the visual coordinator
 */
class ComponentStateManager {
  private currentState: ComponentState = 'idle';
  private stateSubscribers = new Set<StateSubscriber>();
  private visualEffects = new VisualEffectsEngine();

  constructor(
    private componentId: string,
    private config: ComponentConfig,
    private coordinator: VisualStateCoordinator
  ) {}

  /**
   * Transition to new state with coordination
   */
  async transitionTo(
    newState: ComponentState,
    context: TransitionContext = {}
  ): Promise<void> {
    
    if (newState === this.currentState) return;

    // Plan coordinated transition
    const plan = this.coordinator.coordinateTransition(
      this.componentId,
      newState,
      { ...context, currentState: this.currentState }
    );

    // Execute transition
    const result = await this.coordinator.executeTransition(plan);
    
    if (result.success) {
      this.currentState = newState;
      this.notifySubscribers(newState, result);
    } else {
      console.warn(`Transition to ${newState} failed for ${this.componentId}`, result);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateSubscriber): () => void {
    this.stateSubscribers.add(callback);
    return () => this.stateSubscribers.delete(callback);
  }

  /**
   * Get current visual state for rendering
   */
  getVisualState(): ComponentVisualState {
    return {
      state: this.currentState,
      isLoading: this.currentState === 'loading',
      hasError: this.currentState === 'error',
      isEmpty: this.currentState === 'empty',
      isLoaded: this.currentState === 'loaded',
      showContent: this.currentState === 'loaded',
      showSkeleton: this.shouldShowSkeleton(),
      showPlaceholder: this.shouldShowPlaceholder()
    };
  }

  private shouldShowSkeleton(): boolean {
    return this.currentState === 'loading' && 
           this.config.loadingStrategy !== 'immediate';
  }

  private shouldShowPlaceholder(): boolean {
    return this.currentState === 'empty' ||
           (this.currentState === 'loading' && this.config.loadingStrategy === 'immediate');
  }
}
```

---

## 🎯 **Phase 2: Component State Synchronization (Week 2)**

### Problem Being Solved
Components often need to share state or react to changes in other components, but current implementations require manual coordination, leading to inconsistent state, missed updates, and complex dependency management.

### Reactive State Synchronization Engine

```typescript
/**
 * Engine for synchronizing state between components using reactive patterns
 */
class ReactiveStateSynchronizer {
  private stateStore = new ReactiveStateStore();
  private synchronizationRules = new Map<string, SyncRule[]>();
  private dependencyGraph = new ComponentDependencyGraph();

  /**
   * Register component for state synchronization
   */
  registerSyncComponent(
    componentId: string,
    config: {
      providedState?: string[];
      subscribedState?: string[];
      syncRules?: SyncRule[];
      bidirectional?: boolean;
    }
  ): SyncComponentManager {
    
    // Register provided state
    if (config.providedState) {
      config.providedState.forEach(stateKey => {
        this.stateStore.registerProvider(stateKey, componentId);
      });
    }

    // Register subscribed state
    if (config.subscribedState) {
      config.subscribedState.forEach(stateKey => {
        this.stateStore.registerSubscriber(stateKey, componentId);
        this.dependencyGraph.addDependency(componentId, stateKey);
      });
    }

    // Register sync rules
    if (config.syncRules) {
      this.synchronizationRules.set(componentId, config.syncRules);
    }

    return new SyncComponentManager(componentId, config, this);
  }

  /**
   * Propagate state change to synchronized components
   */
  async propagateStateChange(
    sourceComponent: string,
    stateKey: string,
    newValue: any,
    context: StateChangeContext
  ): Promise<PropagationResult> {
    
    const affectedComponents = this.dependencyGraph.getAffectedComponents(stateKey);
    const propagationPlan = this.createPropagationPlan(
      sourceComponent,
      stateKey,
      newValue,
      affectedComponents,
      context
    );

    // Execute propagation with batching for performance
    const results = await this.executePropagationPlan(propagationPlan);
    
    return {
      sourceComponent,
      stateKey,
      affectedComponents: affectedComponents.length,
      successfulUpdates: results.filter(r => r.success).length,
      failedUpdates: results.filter(r => !r.success).length,
      propagationTime: results.reduce((sum, r) => sum + r.duration, 0)
    };
  }

  /**
   * Create optimized propagation plan
   */
  private createPropagationPlan(
    sourceComponent: string,
    stateKey: string,
    newValue: any,
    affectedComponents: string[],
    context: StateChangeContext
  ): PropagationPlan {
    
    // Group components by update priority
    const highPriority = affectedComponents.filter(id => 
      this.getComponentPriority(id) === 'high'
    );
    
    const normalPriority = affectedComponents.filter(id => 
      this.getComponentPriority(id) === 'normal'
    );

    // Check for circular dependencies
    const circularDeps = this.dependencyGraph.detectCircularDependencies(
      sourceComponent,
      affectedComponents
    );

    return {
      stateKey,
      newValue,
      batches: [
        { components: highPriority, priority: 'high', delay: 0 },
        { components: normalPriority, priority: 'normal', delay: 5 }
      ],
      circularDependencies: circularDeps,
      context
    };
  }
}
```

### Reactive State Store

```typescript
/**
 * Central store for managing shared reactive state
 */
class ReactiveStateStore {
  private state = new Map<string, StateEntry>();
  private subscribers = new Map<string, Set<StateSubscriber>>();
  private providers = new Map<string, string>();

  /**
   * Set state value and notify subscribers
   */
  setState<T>(key: string, value: T, providerId: string): void {
    const currentProvider = this.providers.get(key);
    
    if (currentProvider && currentProvider !== providerId) {
      console.warn(`State key ${key} already has provider ${currentProvider}, ignoring update from ${providerId}`);
      return;
    }

    const previousValue = this.state.get(key)?.value;
    
    this.state.set(key, {
      value,
      providerId,
      timestamp: Date.now(),
      version: (this.state.get(key)?.version || 0) + 1
    });

    // Notify subscribers if value changed
    if (previousValue !== value) {
      this.notifySubscribers(key, value, previousValue, providerId);
    }
  }

  /**
   * Get current state value
   */
  getState<T>(key: string): T | undefined {
    return this.state.get(key)?.value;
  }

  /**
   * Subscribe to state changes
   */
  subscribe<T>(
    key: string,
    subscriber: StateSubscriber<T>,
    subscriberId: string
  ): () => void {
    
    let keySubscribers = this.subscribers.get(key);
    if (!keySubscribers) {
      keySubscribers = new Set();
      this.subscribers.set(key, keySubscribers);
    }

    const wrappedSubscriber = {
      ...subscriber,
      subscriberId
    };

    keySubscribers.add(wrappedSubscriber);

    // Immediately notify with current value if available
    const currentEntry = this.state.get(key);
    if (currentEntry) {
      subscriber.onStateChange(currentEntry.value, undefined, currentEntry.providerId);
    }

    return () => keySubscribers?.delete(wrappedSubscriber);
  }

  /**
   * Create reactive derived state
   */
  createDerivedState<T, R>(
    sourceKeys: string[],
    deriveFn: (values: T[]) => R,
    derivedKey: string
  ): () => void {
    
    const updateDerived = () => {
      const sourceValues = sourceKeys.map(key => this.getState(key));
      
      // Only update if all source values are available
      if (sourceValues.every(v => v !== undefined)) {
        const derivedValue = deriveFn(sourceValues as T[]);
        this.setState(derivedKey, derivedValue, 'derived');
      }
    };

    // Subscribe to all source keys
    const unsubscribers = sourceKeys.map(key =>
      this.subscribe(key, {
        onStateChange: updateDerived,
        subscriberId: `derived-${derivedKey}`
      }, `derived-${derivedKey}`)
    );

    // Initial calculation
    updateDerived();

    // Return cleanup function
    return () => unsubscribers.forEach(unsub => unsub());
  }
}
```

### Sync Component Manager

```typescript  
/**
 * Manager for individual component synchronization
 */
class SyncComponentManager {
  private localState = new Map<string, any>();
  private syncSubscriptions = new Map<string, () => void>();

  constructor(
    private componentId: string,
    private config: ComponentSyncConfig,
    private synchronizer: ReactiveStateSynchronizer
  ) {
    this.setupSyncSubscriptions();
  }

  /**
   * Update local state and propagate if configured
   */
  updateState<T>(key: string, value: T, options: UpdateOptions = {}): void {
    const previousValue = this.localState.get(key);
    this.localState.set(key, value);

    // Propagate to synchronized components if this is provided state
    if (this.config.providedState?.includes(key)) {
      this.synchronizer.propagateStateChange(
        this.componentId,
        key,
        value,
        {
          previousValue,
          trigger: options.trigger || 'user_action',
          metadata: options.metadata
        }
      );
    }
  }

  /**
   * Get current synchronized state
   */
  getSyncState(): Record<string, any> {
    const syncState: Record<string, any> = {};
    
    // Include local state
    this.localState.forEach((value, key) => {
      syncState[key] = value;
    });

    // Include subscribed external state
    if (this.config.subscribedState) {
      this.config.subscribedState.forEach(key => {
        const externalValue = this.synchronizer.getState(key);
        if (externalValue !== undefined) {
          syncState[key] = externalValue;
        }
      });
    }

    return syncState;
  }

  /**
   * Setup subscriptions to external state
   */
  private setupSyncSubscriptions(): void {
    if (!this.config.subscribedState) return;

    this.config.subscribedState.forEach(stateKey => {
      const unsubscribe = this.synchronizer.subscribeToState(
        stateKey,
        (newValue, previousValue, providerId) => {
          // Apply sync rules if configured
          const syncRules = this.synchronizer.getSyncRules(this.componentId);
          const applicableRule = syncRules.find(rule => 
            rule.sourceStateKey === stateKey
          );

          if (applicableRule) {
            const transformedValue = applicableRule.transform(newValue, previousValue);
            this.localState.set(applicableRule.targetStateKey, transformedValue);
          } else {
            // Direct sync
            this.localState.set(stateKey, newValue);
          }

          // Notify component of sync update
          this.notifyComponentOfSync(stateKey, newValue, previousValue);
        },
        this.componentId
      );

      this.syncSubscriptions.set(stateKey, unsubscribe);
    });
  }
}
```

---

## 🎯 **Phase 3: Predictable Loading States (Week 3)**

### Problem Being Solved
Inconsistent loading state management across components leads to unpredictable UI behavior, unclear loading indicators, and poor user experience during data fetching operations.

### Five-State Loading System

```typescript
/**
 * Comprehensive loading state management with predictable transitions
 */
type LoadingState = 'idle' | 'loading' | 'loaded' | 'error' | 'empty';

interface LoadingStateTransition {
  from: LoadingState;
  to: LoadingState;
  trigger: LoadingTrigger;
  isValid: boolean;
  requiresConfirmation?: boolean;
}

type LoadingTrigger = 
  | 'initial_load'
  | 'refresh'
  | 'user_action' 
  | 'data_change'
  | 'error_recovery'
  | 'manual_reset';

class PredictableLoadingManager {
  private stateTransitionRules = new Map<string, TransitionRule[]>();
  private componentStates = new Map<string, ComponentLoadingState>();
  private transitionHistory = new Map<string, StateTransition[]>();

  /**
   * Register component for predictable loading management
   */
  registerComponent(
    componentId: string,
    config: {
      initialState?: LoadingState;
      allowedTransitions?: LoadingStateTransition[];
      autoTransitions?: AutoTransitionRule[];
      loadingTimeout?: number;
      retryPolicy?: RetryPolicy;
    }
  ): LoadingComponentManager {
    
    const defaultTransitions = this.getDefaultTransitions();
    const allowedTransitions = config.allowedTransitions || defaultTransitions;
    
    this.stateTransitionRules.set(componentId, 
      this.compileTransitionRules(allowedTransitions)
    );

    const initialState: ComponentLoadingState = {
      current: config.initialState || 'idle',
      previous: null,
      timestamp: Date.now(),
      context: { trigger: 'initial_load' },
      retryCount: 0,
      errorDetails: null
    };

    this.componentStates.set(componentId, initialState);
    this.transitionHistory.set(componentId, []);

    return new LoadingComponentManager(componentId, config, this);
  }

  /**
   * Execute state transition with validation
   */
  async transitionState(
    componentId: string,
    targetState: LoadingState,
    trigger: LoadingTrigger,
    context: TransitionContext = {}
  ): Promise<TransitionResult> {
    
    const currentState = this.componentStates.get(componentId);
    if (!currentState) {
      throw new Error(`Component ${componentId} not registered`);
    }

    // Validate transition
    const validation = this.validateTransition(
      componentId,
      currentState.current,
      targetState,
      trigger
    );

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        currentState: currentState.current,
        attemptedState: targetState
      };
    }

    // Execute transition
    const transition: StateTransition = {
      from: currentState.current,
      to: targetState,
      trigger,
      timestamp: Date.now(),
      context,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Apply pre-transition hooks
      await this.executePreTransitionHooks(componentId, transition);

      // Update state
      const newState: ComponentLoadingState = {
        current: targetState,
        previous: currentState.current,
        timestamp: Date.now(),
        context: { trigger, ...context },
        retryCount: trigger === 'error_recovery' ? currentState.retryCount + 1 : 0,
        errorDetails: targetState === 'error' ? context.error : null
      };

      this.componentStates.set(componentId, newState);

      // Record transition
      transition.duration = Date.now() - startTime;
      const history = this.transitionHistory.get(componentId) || [];
      history.push(transition);
      this.transitionHistory.set(componentId, history.slice(-10)); // Keep last 10

      // Apply post-transition hooks
      await this.executePostTransitionHooks(componentId, transition);

      // Check for auto-transitions
      this.scheduleAutoTransitions(componentId, newState);

      return {
        success: true,
        currentState: targetState,
        previousState: currentState.current,
        duration: transition.duration
      };

    } catch (error) {
      return {
        success: false,
        error: error as Error,
        currentState: currentState.current,
        attemptedState: targetState
      };
    }
  }

  /**
   * Get default transition rules
   */
  private getDefaultTransitions(): LoadingStateTransition[] {
    return [
      // From idle
      { from: 'idle', to: 'loading', trigger: 'initial_load', isValid: true },
      { from: 'idle', to: 'loading', trigger: 'user_action', isValid: true },
      
      // From loading
      { from: 'loading', to: 'loaded', trigger: 'data_change', isValid: true },
      { from: 'loading', to: 'empty', trigger: 'data_change', isValid: true },
      { from: 'loading', to: 'error', trigger: 'data_change', isValid: true },
      
      // From loaded
      { from: 'loaded', to: 'loading', trigger: 'refresh', isValid: true },
      { from: 'loaded', to: 'loading', trigger: 'user_action', isValid: true },
      { from: 'loaded', to: 'error', trigger: 'data_change', isValid: true },
      
      // From error
      { from: 'error', to: 'loading', trigger: 'error_recovery', isValid: true },
      { from: 'error', to: 'idle', trigger: 'manual_reset', isValid: true },
      
      // From empty
      { from: 'empty', to: 'loading', trigger: 'refresh', isValid: true },
      { from: 'empty', to: 'loading', trigger: 'user_action', isValid: true },
      { from: 'empty', to: 'loaded', trigger: 'data_change', isValid: true }
    ];
  }

  /**
   * Validate state transition
   */
  private validateTransition(
    componentId: string,
    fromState: LoadingState,
    toState: LoadingState,
    trigger: LoadingTrigger
  ): TransitionValidation {
    
    const rules = this.stateTransitionRules.get(componentId);
    if (!rules) {
      return { isValid: false, error: new Error('No transition rules found') };
    }

    const applicableRule = rules.find(rule => 
      rule.from === fromState && 
      rule.to === toState && 
      rule.trigger === trigger
    );

    if (!applicableRule) {
      return { 
        isValid: false, 
        error: new Error(`Invalid transition: ${fromState} -> ${toState} (${trigger})`) 
      };
    }

    // Check transition history for rapid cycling
    const history = this.transitionHistory.get(componentId) || [];
    const recentTransitions = history.slice(-5);
    const hasRapidCycling = this.detectRapidCycling(recentTransitions, fromState, toState);

    if (hasRapidCycling) {
      return {
        isValid: false,
        error: new Error('Rapid state cycling detected - transition blocked for stability')
      };
    }

    return { isValid: true };
  }

  /**
   * Detect rapid cycling between states
   */
  private detectRapidCycling(
    transitions: StateTransition[],
    fromState: LoadingState,
    toState: LoadingState
  ): boolean {
    
    if (transitions.length < 4) return false;

    const timeWindow = 1000; // 1 second
    const recentWindow = transitions.filter(t => 
      Date.now() - t.timestamp < timeWindow
    );

    // Check for oscillation between two states
    const stateSequence = recentWindow.map(t => `${t.from}->${t.to}`);
    const currentTransition = `${fromState}->${toState}`;
    const reverseTransition = `${toState}->${fromState}`;

    const hasOscillation = stateSequence.filter(seq => 
      seq === currentTransition || seq === reverseTransition
    ).length >= 3;

    return hasOscillation;
  }
}
```

### Loading Component Manager

```typescript
/**
 * Individual component loading state manager
 */
class LoadingComponentManager {
  private loadingTimeout: number | null = null;
  private autoTransitionTimers = new Map<string, number>();

  constructor(
    private componentId: string,
    private config: LoadingComponentConfig,
    private manager: PredictableLoadingManager
  ) {}

  /**
   * Start loading with timeout handling
   */
  async startLoading(
    trigger: LoadingTrigger = 'user_action',
    options: { timeout?: number; context?: any } = {}
  ): Promise<void> {
    
    const result = await this.manager.transitionState(
      this.componentId,
      'loading',
      trigger,
      options.context
    );

    if (!result.success) {
      throw result.error || new Error('Failed to start loading');
    }

    // Setup timeout if configured
    const timeout = options.timeout || this.config.loadingTimeout;
    if (timeout) {
      this.loadingTimeout = setTimeout(() => {
        this.handleLoadingTimeout();
      }, timeout);
    }
  }

  /**
   * Complete loading with data
   */
  async completeLoading(
    data: any,
    context: any = {}
  ): Promise<void> {
    
    this.clearLoadingTimeout();

    const targetState = this.determineCompletionState(data);
    
    await this.manager.transitionState(
      this.componentId,
      targetState,
      'data_change',
      { data, ...context }
    );
  }

  /**
   * Handle loading error
   */
  async handleError(
    error: Error,
    context: any = {}
  ): Promise<void> {
    
    this.clearLoadingTimeout();

    await this.manager.transitionState(
      this.componentId,
      'error',
      'data_change',
      { error, ...context }
    );

    // Schedule retry if policy configured
    if (this.config.retryPolicy) {
      this.scheduleRetry(error);
    }
  }

  /**
   * Get current loading state for UI
   */
  getLoadingState(): ComponentLoadingState {
    return this.manager.getComponentState(this.componentId);
  }

  /**
   * Get UI display flags
   */
  getDisplayFlags(): LoadingDisplayFlags {
    const state = this.getLoadingState();
    
    return {
      showLoading: state.current === 'loading',
      showContent: state.current === 'loaded',
      showError: state.current === 'error',
      showEmpty: state.current === 'empty',
      showSkeleton: state.current === 'loading' && this.shouldShowSkeleton(),
      showSpinner: state.current === 'loading' && this.shouldShowSpinner(),
      isRetrying: state.retryCount > 0,
      canRetry: this.canRetry(state)
    };
  }

  private determineCompletionState(data: any): LoadingState {
    if (data === null || data === undefined) {
      return 'empty';
    }
    
    if (Array.isArray(data) && data.length === 0) {
      return 'empty';
    }
    
    if (typeof data === 'object' && Object.keys(data).length === 0) {
      return 'empty';
    }
    
    return 'loaded';
  }

  private shouldShowSkeleton(): boolean {
    // Show skeleton for longer loading operations
    return this.config.loadingTimeout ? this.config.loadingTimeout > 500 : false;
  }

  private shouldShowSpinner(): boolean {
    // Show spinner for shorter operations
    return !this.shouldShowSkeleton();
  }
}
```

---

## 🎯 **Phase 4: Cross-Component Data Coordination (Week 4)**

### Problem Being Solved
Components often need to share data or coordinate around the same data sources, leading to duplicate queries, inconsistent data, and complex manual coordination between components that display related information.

### Data Coordination Engine

```typescript
/**
 * Engine for coordinating data sharing and synchronization between components
 */
class DataCoordinationEngine {
  private dataRegistry = new Map<string, DataSource>();
  private componentSubscriptions = new Map<string, Set<ComponentSubscription>>();
  private coordinationRules = new Map<string, DataCoordinationRule[]>();
  private queryDeduplication = new QueryDeduplicationCache();

  /**
   * Register a data source for coordination
   */
  registerDataSource(
    sourceId: string,
    config: {
      queryBuilder: () => any;
      cacheKey: string;
      dependencies?: string[];
      invalidationRules?: InvalidationRule[];
      refreshStrategy?: 'immediate' | 'debounced' | 'scheduled';
      shareScope?: 'global' | 'route' | 'component_tree';
    }
  ): DataSourceManager {
    
    const dataSource: DataSource = {
      id: sourceId,
      config,
      subscribers: new Set(),
      lastFetch: null,
      data: null,
      error: null,
      isLoading: false,
      refreshCount: 0
    };

    this.dataRegistry.set(sourceId, dataSource);

    // Setup dependencies
    if (config.dependencies) {
      config.dependencies.forEach(depId => {
        this.addDataDependency(sourceId, depId);
      });
    }

    return new DataSourceManager(sourceId, this);
  }

  /**
   * Subscribe component to data source with coordination
   */
  subscribeComponent(
    componentId: string,
    dataSourceId: string,
    options: {
      onDataChange?: (data: any) => void;
      onError?: (error: Error) => void;
      onLoadingChange?: (isLoading: boolean) => void;
      localTransforms?: DataTransform[];
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): DataSubscription {
    
    const dataSource = this.dataRegistry.get(dataSourceId);
    if (!dataSource) {
      throw new Error(`Data source ${dataSourceId} not found`);
    }

    const subscription: ComponentSubscription = {
      componentId,
      dataSourceId,
      options,
      subscriptionTime: Date.now(),
      isActive: true
    };

    // Add to data source subscribers
    dataSource.subscribers.add(subscription);

    // Add to component subscriptions
    let componentSubs = this.componentSubscriptions.get(componentId);
    if (!componentSubs) {
      componentSubs = new Set();
      this.componentSubscriptions.set(componentId, componentSubs);
    }
    componentSubs.add(subscription);

    // If data is already available, notify immediately
    if (dataSource.data !== null) {
      this.notifySubscription(subscription, dataSource);
    } else if (!dataSource.isLoading) {
      // Trigger data fetch if not already loading
      this.fetchDataSource(dataSourceId);
    }

    return new DataSubscription(subscription, this);
  }

  /**
   * Coordinate data refresh across components
   */
  async refreshDataSource(
    sourceId: string,
    trigger: RefreshTrigger,
    context: RefreshContext = {}
  ): Promise<RefreshResult> {
    
    const dataSource = this.dataRegistry.get(sourceId);
    if (!dataSource) {
      throw new Error(`Data source ${sourceId} not found`);
    }

    // Check if refresh is needed based on strategy
    const shouldRefresh = this.shouldRefreshData(dataSource, trigger, context);
    if (!shouldRefresh.refresh) {
      return {
        sourceId,
        skipped: true,
        reason: shouldRefresh.reason,
        data: dataSource.data
      };
    }

    // Apply refresh strategy
    switch (dataSource.config.refreshStrategy) {
      case 'debounced':
        return this.debouncedRefresh(sourceId, trigger, context);
      
      case 'scheduled':
        return this.scheduledRefresh(sourceId, trigger, context);
      
      case 'immediate':
      default:
        return this.immediateRefresh(sourceId, trigger, context);
    }
  }

  /**
   * Immediate refresh implementation
   */
  private async immediateRefresh(
    sourceId: string,
    trigger: RefreshTrigger,
    context: RefreshContext
  ): Promise<RefreshResult> {
    
    const dataSource = this.dataRegistry.get(sourceId)!;
    
    // Set loading state
    dataSource.isLoading = true;
    dataSource.error = null;
    this.notifyLoadingChange(sourceId, true);

    try {
      const startTime = Date.now();
      
      // Execute query with deduplication
      const queryKey = `${sourceId}-${JSON.stringify(context.params || {})}`;
      const data = await this.queryDeduplication.executeQuery(
        queryKey,
        () => dataSource.config.queryBuilder()
      );

      // Update data source
      dataSource.data = data;
      dataSource.lastFetch = Date.now();
      dataSource.refreshCount++;
      dataSource.isLoading = false;

      // Notify all subscribers
      this.notifyDataChange(sourceId, data);
      this.notifyLoadingChange(sourceId, false);

      // Trigger dependent refreshes
      await this.refreshDependentSources(sourceId, trigger);

      return {
        sourceId,
        success: true,
        data,
        duration: Date.now() - startTime,
        refreshCount: dataSource.refreshCount
      };

    } catch (error) {
      dataSource.error = error as Error;
      dataSource.isLoading = false;

      this.notifyError(sourceId, error as Error);
      this.notifyLoadingChange(sourceId, false);

      return {
        sourceId,
        success: false,
        error: error as Error,
        refreshCount: dataSource.refreshCount
      };
    }
  }

  /**
   * Notify all subscribers of data change
   */
  private notifyDataChange(sourceId: string, data: any): void {
    const dataSource = this.dataRegistry.get(sourceId);
    if (!dataSource) return;

    dataSource.subscribers.forEach(subscription => {
      if (subscription.isActive && subscription.options.onDataChange) {
        // Apply local transforms if configured
        let transformedData = data;
        if (subscription.options.localTransforms) {
          transformedData = subscription.options.localTransforms.reduce(
            (acc, transform) => transform(acc),
            data
          );
        }

        subscription.options.onDataChange(transformedData);
      }
    });
  }

  /**
   * Create coordinated query that combines multiple data sources
   */
  createCoordinatedQuery(
    queryId: string,
    sourceIds: string[],
    config: {
      combineStrategy?: 'merge' | 'array' | 'custom';
      customCombiner?: (sources: Record<string, any>) => any;
      refreshTogether?: boolean;
      invalidateTogether?: boolean;
    } = {}
  ): CoordinatedQuery {
    
    const coordinatedQuery = new CoordinatedQuery(queryId, sourceIds, config, this);
    
    // Register coordination rules
    if (config.refreshTogether) {
      this.addCoordinationRule(queryId, {
        type: 'refresh_together',
        sourceIds,
        trigger: 'any_source_refresh'
      });
    }

    if (config.invalidateTogether) {
      this.addCoordinationRule(queryId, {
        type: 'invalidate_together',
        sourceIds,
        trigger: 'any_source_invalidation'
      });
    }

    return coordinatedQuery;
  }
}
```

### Coordinated Query

```typescript
/**
 * Query that coordinates multiple data sources
 */
class CoordinatedQuery {
  private subscriptions = new Map<string, DataSubscription>();
  private combinedData: any = null;
  private loadingStates = new Map<string, boolean>();
  private errors = new Map<string, Error>();
  private subscribers = new Set<CoordinatedQuerySubscriber>();

  constructor(
    private queryId: string,
    private sourceIds: string[],
    private config: CoordinatedQueryConfig,
    private engine: DataCoordinationEngine
  ) {
    this.initializeSubscriptions();
  }

  /**
   * Subscribe to coordinated query updates
   */
  subscribe(subscriber: CoordinatedQuerySubscriber): () => void {
    this.subscribers.add(subscriber);

    // Immediately notify with current state
    subscriber.onUpdate(this.getCombinedState());

    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Get current combined state
   */
  getCombinedState(): CoordinatedQueryState {
    const isLoading = Array.from(this.loadingStates.values()).some(loading => loading);
    const hasError = this.errors.size > 0;
    const isEmpty = this.combinedData === null || 
                   (Array.isArray(this.combinedData) && this.combinedData.length === 0);

    return {
      data: this.combinedData,
      isLoading,
      hasError,
      isEmpty,
      errors: Array.from(this.errors.values()),
      sourceStates: this.getSourceStates()
    };
  }

  /**
   * Refresh all coordinated sources
   */
  async refresh(trigger: RefreshTrigger = 'user_action'): Promise<void> {
    const refreshPromises = this.sourceIds.map(sourceId =>
      this.engine.refreshDataSource(sourceId, trigger)
    );

    await Promise.all(refreshPromises);
  }

  /**
   * Initialize subscriptions to all data sources
   */
  private initializeSubscriptions(): void {
    this.sourceIds.forEach(sourceId => {
      const subscription = this.engine.subscribeComponent(
        this.queryId,
        sourceId,
        {
          onDataChange: (data) => this.handleSourceDataChange(sourceId, data),
          onError: (error) => this.handleSourceError(sourceId, error),
          onLoadingChange: (isLoading) => this.handleSourceLoadingChange(sourceId, isLoading)
        }
      );

      this.subscriptions.set(sourceId, subscription);
    });
  }

  /**
   * Handle data change from individual source
   */
  private handleSourceDataChange(sourceId: string, data: any): void {
    // Clear error for this source
    this.errors.delete(sourceId);

    // Update combined data
    this.updateCombinedData();

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Update combined data using configured strategy
   */
  private updateCombinedData(): void {
    const sourceData: Record<string, any> = {};
    
    this.sourceIds.forEach(sourceId => {
      const subscription = this.subscriptions.get(sourceId);
      if (subscription) {
        sourceData[sourceId] = subscription.getCurrentData();
      }
    });

    switch (this.config.combineStrategy) {
      case 'merge':
        this.combinedData = Object.assign({}, ...Object.values(sourceData));
        break;
        
      case 'array':
        this.combinedData = Object.values(sourceData);
        break;
        
      case 'custom':
        if (this.config.customCombiner) {
          this.combinedData = this.config.customCombiner(sourceData);
        } else {
          this.combinedData = sourceData;
        }
        break;
        
      default:
        this.combinedData = sourceData;
    }
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    const currentState = this.getCombinedState();
    this.subscribers.forEach(subscriber => {
      subscriber.onUpdate(currentState);
    });
  }
}
```

### Query Deduplication Cache

```typescript
/**
 * Cache for deduplicating identical queries
 */
class QueryDeduplicationCache {
  private activeQueries = new Map<string, Promise<any>>();
  private resultCache = new Map<string, CachedResult>();
  private readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Execute query with deduplication
   */
  async executeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    
    // Check if query is already in progress
    const activeQuery = this.activeQueries.get(queryKey);
    if (activeQuery) {
      return activeQuery;
    }

    // Check cache
    const cached = this.resultCache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    // Execute new query
    const queryPromise = queryFn();
    this.activeQueries.set(queryKey, queryPromise);

    try {
      const result = await queryPromise;
      
      // Cache result
      this.resultCache.set(queryKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } finally {
      // Clean up active query
      this.activeQueries.delete(queryKey);
    }
  }

  /**
   * Invalidate cached results
   */
  invalidate(pattern?: string): void {
    if (pattern) {
      // Invalidate matching keys
      const keysToDelete = Array.from(this.resultCache.keys())
        .filter(key => key.includes(pattern));
      
      keysToDelete.forEach(key => {
        this.resultCache.delete(key);
      });
    } else {
      // Clear all cache
      this.resultCache.clear();
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, cached] of this.resultCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.resultCache.delete(key);
      }
    }
  }
}
```

---

## 🎯 **Phase 5: Performance-Optimized State Management (Week 5)**

### Problem Being Solved
State management operations can become performance bottlenecks with frequent updates, large component trees, and complex reactive calculations. Need to optimize for minimal re-renders, efficient updates, and responsive UI.

### Performance-Optimized State Engine

```typescript
/**
 * High-performance state management with optimized updates and minimal re-renders
 */
class PerformanceOptimizedStateEngine {
  private updateBatcher = new UpdateBatcher();
  private renderOptimizer = new RenderOptimizer();
  private memoryManager = new StateMemoryManager();
  private performanceMonitor = new StatePerformanceMonitor();

  /**
   * Register component for performance-optimized state management
   */
  registerOptimizedComponent(
    componentId: string,
    config: {
      updateStrategy?: 'immediate' | 'batched' | 'throttled' | 'debounced';
      renderOptimization?: 'shallow' | 'deep' | 'custom';
      memoryManagement?: 'auto' | 'manual';
      performanceTracking?: boolean;
      updateThreshold?: number; // milliseconds
      batchSize?: number;
    }
  ): OptimizedComponentManager {
    
    const manager = new OptimizedComponentManager(componentId, config, this);
    
    // Setup performance monitoring
    if (config.performanceTracking) {
      this.performanceMonitor.trackComponent(componentId, config);
    }

    // Configure memory management
    if (config.memoryManagement === 'auto') {
      this.memoryManager.autoManageComponent(componentId);
    }

    return manager;
  }

  /**
   * Execute optimized state update
   */
  async updateState(
    componentId: string,
    updates: StateUpdate[],
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    
    const startTime = performance.now();
    const config = this.getComponentConfig(componentId);

    // Apply update strategy
    let result: UpdateResult;
    
    switch (config.updateStrategy) {
      case 'batched':
        result = await this.updateBatcher.batchUpdate(componentId, updates, options);
        break;
        
      case 'throttled':
        result = await this.throttledUpdate(componentId, updates, options);
        break;
        
      case 'debounced':
        result = await this.debouncedUpdate(componentId, updates, options);
        break;
        
      case 'immediate':
      default:
        result = await this.immediateUpdate(componentId, updates, options);
        break;
    }

    // Track performance
    const duration = performance.now() - startTime;
    this.performanceMonitor.recordUpdate(componentId, {
      duration,
      updateCount: updates.length,
      strategy: config.updateStrategy,
      renderOptimization: config.renderOptimization
    });

    return result;
  }

  /**
   * Immediate update with render optimization
   */
  private async immediateUpdate(
    componentId: string,
    updates: StateUpdate[],
    options: UpdateOptions
  ): Promise<UpdateResult> {
    
    const config = this.getComponentConfig(componentId);
    
    // Apply render optimization
    const optimizedUpdates = this.renderOptimizer.optimizeUpdates(
      updates,
      config.renderOptimization
    );

    // Execute updates
    const results = await Promise.all(
      optimizedUpdates.map(update => this.executeUpdate(componentId, update))
    );

    // Check for memory cleanup
    if (config.memoryManagement === 'auto') {
      this.memoryManager.checkCleanup(componentId);
    }

    return {
      componentId,
      updatesProcessed: optimizedUpdates.length,
      originalUpdateCount: updates.length,
      optimizationApplied: optimizedUpdates.length !== updates.length,
      results
    };
  }
}
```

### Update Batcher

```typescript
/**
 * Batches state updates for optimal performance
 */
class UpdateBatcher {
  private pendingBatches = new Map<string, BatchedUpdate>();
  private batchTimers = new Map<string, number>();
  private readonly BATCH_DELAY = 16; // ~60fps

  /**
   * Add update to batch
   */
  async batchUpdate(
    componentId: string,
    updates: StateUpdate[],
    options: UpdateOptions
  ): Promise<UpdateResult> {
    
    return new Promise((resolve, reject) => {
      // Get or create batch
      let batch = this.pendingBatches.get(componentId);
      if (!batch) {
        batch = {
          componentId,
          updates: [],
          callbacks: [],
          startTime: Date.now()
        };
        this.pendingBatches.set(componentId, batch);
      }

      // Add updates to batch
      batch.updates.push(...updates);
      batch.callbacks.push({ resolve, reject, options });

      // Schedule batch execution
      this.scheduleBatchExecution(componentId);
    });
  }

  /**
   * Schedule batch execution with debouncing
   */
  private scheduleBatchExecution(componentId: string): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(componentId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new execution
    const timer = setTimeout(() => {
      this.executeBatch(componentId);
    }, this.BATCH_DELAY);

    this.batchTimers.set(componentId, timer as any);
  }

  /**
   * Execute batched updates
   */
  private async executeBatch(componentId: string): Promise<void> {
    const batch = this.pendingBatches.get(componentId);
    if (!batch) return;

    // Clean up
    this.pendingBatches.delete(componentId);
    this.batchTimers.delete(componentId);

    try {
      // Deduplicate updates by key
      const deduplicatedUpdates = this.deduplicateUpdates(batch.updates);
      
      // Execute updates
      const results = await this.executeBatchedUpdates(componentId, deduplicatedUpdates);
      
      // Resolve all callbacks
      batch.callbacks.forEach(callback => {
        callback.resolve({
          componentId,
          updatesProcessed: deduplicatedUpdates.length,
          originalUpdateCount: batch.updates.length,
          batchDuration: Date.now() - batch.startTime,
          results
        });
      });

    } catch (error) {
      // Reject all callbacks
      batch.callbacks.forEach(callback => {
        callback.reject(error);
      });
    }
  }

  /**
   * Deduplicate updates by key, keeping the latest value
   */
  private deduplicateUpdates(updates: StateUpdate[]): StateUpdate[] {
    const updateMap = new Map<string, StateUpdate>();
    
    updates.forEach(update => {
      updateMap.set(update.key, update);
    });

    return Array.from(updateMap.values());
  }

  /**
   * Execute deduplicated batch updates
   */
  private async executeBatchedUpdates(
    componentId: string,
    updates: StateUpdate[]
  ): Promise<UpdateExecutionResult[]> {
    
    // Group updates by type for optimal execution order
    const groups = this.groupUpdatesByType(updates);
    const results: UpdateExecutionResult[] = [];

    // Execute in optimal order: deletes, updates, inserts
    for (const [type, typeUpdates] of groups) {
      const typeResults = await Promise.all(
        typeUpdates.map(update => this.executeUpdate(componentId, update))
      );
      results.push(...typeResults);
    }

    return results;
  }

  /**
   * Group updates by type for execution optimization
   */
  private groupUpdatesByType(updates: StateUpdate[]): Map<string, StateUpdate[]> {
    const groups = new Map<string, StateUpdate[]>();
    const order = ['delete', 'update', 'insert', 'other'];

    updates.forEach(update => {
      const type = update.type || 'other';
      let group = groups.get(type);
      if (!group) {
        group = [];
        groups.set(type, group);
      }
      group.push(update);
    });

    // Return in execution order
    const orderedGroups = new Map<string, StateUpdate[]>();
    order.forEach(type => {
      const group = groups.get(type);
      if (group && group.length > 0) {
        orderedGroups.set(type, group);
      }
    });

    return orderedGroups;
  }
}
```

### Render Optimizer

```typescript
/**
 * Optimizes state updates to minimize re-renders
 */
class RenderOptimizer {
  private changeDetector = new ChangeDetector();
  private dependencyTracker = new DependencyTracker();

  /**
   * Optimize updates to minimize renders
   */
  optimizeUpdates(
    updates: StateUpdate[],
    strategy: RenderOptimizationStrategy
  ): StateUpdate[] {
    
    switch (strategy) {
      case 'shallow':
        return this.shallowOptimization(updates);
        
      case 'deep':
        return this.deepOptimization(updates);
        
      case 'custom':
        return this.customOptimization(updates);
        
      default:
        return updates;
    }
  }

  /**
   * Shallow optimization - only check top-level changes
   */
  private shallowOptimization(updates: StateUpdate[]): StateUpdate[] {
    return updates.filter(update => {
      const currentValue = this.getCurrentValue(update.key);
      return !this.changeDetector.shallowEqual(currentValue, update.value);
    });
  }

  /**
   * Deep optimization - check deep equality
   */
  private deepOptimization(updates: StateUpdate[]): StateUpdate[] {
    return updates.filter(update => {
      const currentValue = this.getCurrentValue(update.key);
      return !this.changeDetector.deepEqual(currentValue, update.value);
    });
  }

  /**
   * Custom optimization using dependency tracking
   */
  private customOptimization(updates: StateUpdate[]): StateUpdate[] {
    // Build dependency graph
    const affectedComponents = new Set<string>();
    
    updates.forEach(update => {
      const dependents = this.dependencyTracker.getDependents(update.key);
      dependents.forEach(component => affectedComponents.add(component));
    });

    // Only process updates that affect rendered components
    return updates.filter(update => {
      const dependents = this.dependencyTracker.getDependents(update.key);
      return dependents.some(component => 
        affectedComponents.has(component) && this.isComponentActive(component)
      );
    });
  }

  /**
   * Create memoized state selector
   */
  createMemoizedSelector<T, R>(
    selector: (state: T) => R,
    dependencies: string[] = []
  ): MemoizedSelector<T, R> {
    
    let memoizedResult: R;
    let lastDependencyValues: any[] = [];
    let lastState: T;

    return {
      select: (state: T): R => {
        // Check if dependencies changed
        const currentDependencyValues = dependencies.map(dep => 
          this.getDependencyValue(state, dep)
        );

        const dependenciesChanged = !this.changeDetector.shallowEqual(
          lastDependencyValues,
          currentDependencyValues
        );

        const stateChanged = !this.changeDetector.shallowEqual(lastState, state);

        if (dependenciesChanged || stateChanged || memoizedResult === undefined) {
          memoizedResult = selector(state);
          lastDependencyValues = currentDependencyValues;
          lastState = state;
        }

        return memoizedResult;
      },
      invalidate: () => {
        memoizedResult = undefined as any;
        lastDependencyValues = [];
        lastState = undefined as any;
      }
    };
  }
}
```

### State Performance Monitor

```typescript
/**
 * Monitors state management performance and provides optimization insights
 */
class StatePerformanceMonitor {
  private componentMetrics = new Map<string, ComponentMetrics>();
  private performanceThresholds = {
    updateDuration: 16, // 16ms for 60fps
    batchSize: 50,
    memoryUsage: 10 * 1024 * 1024 // 10MB
  };

  /**
   * Track component performance
   */
  trackComponent(componentId: string, config: ComponentConfig): void {
    this.componentMetrics.set(componentId, {
      componentId,
      config,
      updateCount: 0,
      totalUpdateTime: 0,
      averageUpdateTime: 0,
      slowUpdates: 0,
      memoryUsage: 0,
      lastUpdate: Date.now(),
      performanceIssues: []
    });
  }

  /**
   * Record update performance
   */
  recordUpdate(componentId: string, updateData: UpdatePerformanceData): void {
    const metrics = this.componentMetrics.get(componentId);
    if (!metrics) return;

    // Update metrics
    metrics.updateCount++;
    metrics.totalUpdateTime += updateData.duration;
    metrics.averageUpdateTime = metrics.totalUpdateTime / metrics.updateCount;
    metrics.lastUpdate = Date.now();

    // Check for slow updates
    if (updateData.duration > this.performanceThresholds.updateDuration) {
      metrics.slowUpdates++;
      
      metrics.performanceIssues.push({
        type: 'slow_update',
        timestamp: Date.now(),
        data: updateData,
        severity: this.calculateSeverity(updateData.duration, this.performanceThresholds.updateDuration)
      });
    }

    // Check memory usage
    const memoryUsage = this.estimateComponentMemoryUsage(componentId);
    metrics.memoryUsage = memoryUsage;
    
    if (memoryUsage > this.performanceThresholds.memoryUsage) {
      metrics.performanceIssues.push({
        type: 'high_memory_usage',
        timestamp: Date.now(),
        data: { memoryUsage, threshold: this.performanceThresholds.memoryUsage },
        severity: 'high'
      });
    }

    // Cleanup old performance issues
    this.cleanupOldIssues(metrics);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(componentId?: string): PerformanceSummary {
    if (componentId) {
      const metrics = this.componentMetrics.get(componentId);
      return metrics ? this.createComponentSummary(metrics) : null;
    }

    // Global summary
    const allMetrics = Array.from(this.componentMetrics.values());
    
    return {
      totalComponents: allMetrics.length,
      totalUpdates: allMetrics.reduce((sum, m) => sum + m.updateCount, 0),
      averageUpdateTime: this.calculateGlobalAverage(allMetrics),
      slowUpdates: allMetrics.reduce((sum, m) => sum + m.slowUpdates, 0),
      totalMemoryUsage: allMetrics.reduce((sum, m) => sum + m.memoryUsage, 0),
      performanceIssues: this.aggregatePerformanceIssues(allMetrics),
      recommendations: this.generateRecommendations(allMetrics)
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(metrics: ComponentMetrics[]): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    metrics.forEach(metric => {
      // Slow update recommendations
      if (metric.slowUpdates > metric.updateCount * 0.1) { // More than 10% slow updates
        recommendations.push({
          componentId: metric.componentId,
          type: 'update_optimization',
          severity: 'medium',
          message: `Consider batching updates or optimizing update logic. ${metric.slowUpdates}/${metric.updateCount} updates are slow.`,
          suggestedActions: [
            'Enable batched update strategy',
            'Review update complexity',
            'Consider memoization for expensive calculations'
          ]
        });
      }

      // Memory usage recommendations
      if (metric.memoryUsage > this.performanceThresholds.memoryUsage * 0.8) {
        recommendations.push({
          componentId: metric.componentId,
          type: 'memory_optimization',
          severity: 'high',
          message: `High memory usage detected: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
          suggestedActions: [
            'Enable automatic memory management',
            'Review state cleanup logic',
            'Consider state normalization'
          ]
        });
      }
    });

    return recommendations;
  }
}
```

---

## 🔥 **Implementation Timeline (Updated)**

### **Week 1: Visual State Coordination Engine**
- Implement `VisualStateCoordinator` with flash prevention
- Build `FlashPreventionEngine` for detecting and preventing UI flashes
- Create `ComponentStateManager` for individual component coordination
- Integrate with existing components and test flash elimination

### **Week 2: Component State Synchronization**  
- Build `ReactiveStateSynchronizer` for cross-component state sharing
- Implement `ReactiveStateStore` with derived state capabilities
- Create `SyncComponentManager` for individual component sync management
- Add bidirectional synchronization and conflict resolution

### **Week 3: Predictable Loading States**
- Implement `PredictableLoadingManager` with five-state system
- Build transition validation and rapid cycling detection
- Create `LoadingComponentManager` with timeout and retry handling
- Add comprehensive loading state UI components

### **Week 4: Cross-Component Data Coordination**
- Build `DataCoordinationEngine` for shared data sources
- Implement `CoordinatedQuery` for multi-source data combining
- Create `QueryDeduplicationCache` for performance optimization
- Add data dependency tracking and invalidation rules

### **Week 5: Performance-Optimized State Management**
- Implement `PerformanceOptimizedStateEngine` with batching
- Build `UpdateBatcher` for optimal update coordination
- Create `RenderOptimizer` with memoization and change detection
- Add `StatePerformanceMonitor` with recommendations engine

### **Week 6: Integration & Polish**
- Create unified API that combines all state management capabilities
- Build migration tools for existing components
- Add comprehensive testing suite and performance benchmarks
- Create documentation and usage examples

---

## 🎯 **Critical Success Factors**

### 1. **Visual Consistency**
- Eliminate all loading flashes and visual inconsistencies
- Provide smooth transitions between states
- Ensure predictable loading behavior across all components

### 2. **Performance Excellence**  
- Minimize re-renders through intelligent update batching
- Optimize memory usage with automatic cleanup
- Provide sub-16ms update performance for responsive UI

### 3. **Developer Experience**
- Simple, intuitive APIs that feel natural to use
- Comprehensive debugging and monitoring tools
- Clear migration path from existing state management

### 4. **Scalability**
- Handle complex component trees with many interdependencies
- Support high-frequency updates without performance degradation
- Efficient memory management for long-running applications

### 5. **Reliability**
- Robust error handling and recovery mechanisms
- Predictable state transitions with validation
- Comprehensive testing coverage for all coordination scenarios

This epic creates a comprehensive UI state management foundation that eliminates visual inconsistencies, provides seamless component coordination, and delivers exceptional performance while maintaining developer-friendly patterns that integrate naturally with existing ReactiveRecord architecture.