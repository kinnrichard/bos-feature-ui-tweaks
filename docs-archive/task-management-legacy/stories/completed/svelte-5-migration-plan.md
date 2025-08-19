# Svelte 4 to 5 Migration Plan

## Executive Summary

This document outlines the migration strategy from Svelte 4.2.19 to Svelte 5.35.4 for the BOS frontend application. This migration is **separate and prerequisite** to the PWA migration stories outlined in `svelte-migration-stories.md`.

**Timeline**: 2-3 weeks  
**Risk Level**: Medium (mitigated by backwards compatibility)  
**Impact**: Foundation upgrade enabling better PWA feature implementation

## Current State Analysis

### Dependencies
- **Svelte**: 4.2.19 → **Target**: 5.35.4 (latest stable)
- **SvelteKit**: 2.0.0 → **Target**: 2.22.2 (latest stable)
- **Vite Plugin**: 3.0.0 → **Target**: 5.1.0 (latest stable)

### Codebase Inventory
- **37 Svelte components** across UI, layout, and feature categories
- **4 custom stores** using writable/derived patterns
- **Comprehensive Playwright testing** (unit, integration, e2e)
- **Full TypeScript support** with strict mode
- **Third-party libraries**: @melt-ui/svelte, @tanstack/svelte-query (both Svelte 5 compatible)

### Complexity Assessment
- **Low Risk**: Basic components, styling, build configuration
- **Medium Risk**: Store migration, event handling, most component logic  
- **High Risk**: TaskList.svelte (complex drag-and-drop), third-party integration testing

## Migration Strategy

### Why Svelte 5 First?

1. **De-risked Foundation**: Provides better primitives for complex state management needed in PWA features
2. **Cleaner Implementation**: Runes will simplify conflict resolution and offline sync logic
3. **Better Performance**: 30-40% bundle size reduction, improved reactivity
4. **Isolated Testing**: Framework upgrade can be thoroughly tested separately from new features

### Phase 1: Environment & Dependencies (1-2 days)

#### Tasks
1. **Update package.json dependencies**
   ```json
   {
     "svelte": "^5.35.4",
     "@sveltejs/kit": "^2.22.2", 
     "@sveltejs/vite-plugin-svelte": "^5.1.0"
   }
   ```

2. **Verify third-party compatibility**
   - ✅ @melt-ui/svelte: Supports `^3.0.0 || ^4.0.0 || ^5.0.0-next.118`
   - ✅ @tanstack/svelte-query: Supports `^3.54.0 || ^4.0.0 || ^5.0.0`

3. **Install dependencies and run initial build**

#### Success Criteria
- [ ] Dependencies updated successfully
- [ ] Project builds without errors
- [ ] Development server starts
- [ ] Third-party libraries load correctly

### Phase 2: Store Migration (2-3 days)

#### Store-by-Store Migration Plan

**1. taskFilter.ts** (Complexity: Medium)
- Convert `writable()` filter state to `$state()`
- Convert `derived()` filtered results to `$derived()`
- Update filter action patterns

**2. layout.ts** (Complexity: Low)
- Migrate sidebar state management
- Convert viewport/responsive states

**3. taskSelection.ts** (Complexity: High)
- Complex multi-select logic with optimistic updates
- Convert selection state and operations
- Maintain keyboard navigation patterns

**4. popover.ts** (Complexity: Medium)
- Popover positioning and state
- Focus management patterns

#### Migration Pattern Example
```typescript
// Before (Svelte 4)
import { writable, derived } from 'svelte/store';

export const filter = writable('all');
export const filteredJobs = derived(
  [jobs, filter], 
  ([$jobs, $filter]) => $jobs.filter(...)
);

// After (Svelte 5)
let filter = $state('all');
let filteredJobs = $derived(jobs.filter(job => 
  filter === 'all' ? true : job.status === filter
));
```

#### Success Criteria
- [ ] All 4 stores migrated to runes
- [ ] Store functionality verified through testing
- [ ] No regression in state management behavior
- [ ] Performance benchmarks maintained or improved

### Phase 3: Component Migration (4-5 days)

#### Automated Migration
1. **Run official migration tool**:
   ```bash
   npx sv migrate svelte-5
   ```

2. **Expected changes**:
   - `let` declarations → `$state()` where appropriate
   - `$:` reactive statements → `$derived()` or `$effect()`
   - Component prop patterns updated

#### Manual Review Categories

**Simple Components (11 components - 1 day)**
- FormInput, FormSelect, ErrorMessage, UserAvatar, etc.
- Minimal state, straightforward patterns
- Automated migration likely sufficient

**Medium Components (24 components - 2 days)**  
- AppLayout, Sidebar, JobCard, JobDetailView, etc.
- Some reactive logic, event handling
- May need manual refinement of runes usage

**Complex Components (2 components - 1-2 days)**
- **TaskList.svelte**: 28,000+ tokens, drag-and-drop, multi-select
- **FilterPopover**: Complex state management
- Requires careful migration and extensive testing

#### Specific Migration Tasks

**Event Handling Updates (2 components)**
```typescript
// Before: createEventDispatcher
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();

// After: Callback props
interface Props {
  onStatusChange?: (status: string) => void;
}
```

**Lifecycle Hook Migration (4 components)**
```typescript
// Before: afterUpdate
import { afterUpdate } from 'svelte';
afterUpdate(() => { /* ... */ });

// After: $effect
$effect(() => {
  // Effect logic here
});
```

**Custom Actions (6 components)**
- Review `use:` directive implementations
- Ensure compatibility with Svelte 5 action API
- Test touch/mouse event handling

#### Success Criteria
- [ ] All 37 components migrated
- [ ] Automated migration tool executed successfully
- [ ] Manual fixes applied where needed
- [ ] Component functionality verified
- [ ] No TypeScript errors
- [ ] Drag-and-drop still functional
- [ ] Multi-select behavior preserved

### Phase 4: Testing & Validation (3-4 days)

#### Test Suite Updates
1. **Playwright Test Compatibility**
   - Run existing test suite against Svelte 5
   - Update any test patterns that rely on Svelte 4 behavior
   - Verify component selectors and interactions

2. **Unit Test Updates**  
   - Update component tests for new reactivity patterns
   - Test store behavior with runes
   - Verify mock and spy patterns still work

#### Critical Feature Validation
1. **TaskList Functionality**
   - Drag and drop operations
   - Multi-select with keyboard
   - Optimistic updates
   - Touch device support

2. **Real-time Reactivity**
   - API data updates
   - Store state changes
   - Component re-rendering patterns

3. **Performance Testing**
   - Bundle size comparison
   - Runtime performance benchmarks
   - Memory usage analysis
   - Core Web Vitals metrics

#### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)  
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS 17+)
- [ ] Chrome Mobile (Android)

#### Success Criteria
- [ ] All Playwright tests passing
- [ ] No performance regressions  
- [ ] Bundle size reduced by 20%+
- [ ] Cross-browser compatibility maintained
- [ ] No accessibility regressions

### Phase 5: Documentation & Deployment (1 day)

#### Documentation Updates
1. **Developer Documentation**
   - Update component examples for Svelte 5 patterns
   - Document new runes usage in stores
   - Migration lessons learned

2. **Architecture Documentation**
   - Update state management patterns
   - Document performance improvements
   - New development guidelines

#### Deployment Checklist
- [ ] Staging deployment successful
- [ ] Production deployment plan ready
- [ ] Rollback strategy confirmed
- [ ] Monitoring alerts configured
- [ ] Performance monitoring setup

## Risk Mitigation

### Technical Risks
1. **Component Breaking Changes**
   - *Mitigation*: Incremental migration with testing at each step
   - *Fallback*: Svelte 5 supports mixing old/new syntax

2. **Third-party Library Issues**  
   - *Mitigation*: Both major libraries verified compatible
   - *Fallback*: Version pinning and gradual updates

3. **Performance Regressions**
   - *Mitigation*: Continuous benchmarking during migration
   - *Fallback*: Performance profiling and optimization

### Project Risks
1. **Timeline Pressure**
   - *Mitigation*: Conservative 3-week estimate with buffer
   - *Fallback*: Phased deployment if needed

2. **User Impact**
   - *Mitigation*: Comprehensive testing before deployment
   - *Fallback*: Feature flags for gradual rollout

## Success Metrics

### Technical Metrics
- [ ] **Bundle Size**: 30%+ reduction from Svelte 5 optimizations
- [ ] **Test Coverage**: Maintain 90%+ coverage
- [ ] **Performance**: No regressions in Core Web Vitals
- [ ] **TypeScript**: Zero type errors

### Functional Metrics  
- [ ] **Feature Parity**: All existing functionality preserved
- [ ] **User Experience**: No UX regressions
- [ ] **Compatibility**: Works across all supported browsers
- [ ] **Stability**: No new runtime errors

## Post-Migration Benefits

### Immediate Benefits
- Smaller bundle size and better performance
- Latest Svelte ecosystem compatibility
- Better development experience with explicit reactivity

### Future Benefits (for PWA Migration)
- **Better State Management**: Runes provide cleaner patterns for complex offline sync logic
- **Improved Reactivity**: Simpler implementation of conflict resolution UI
- **Performance Foundation**: Better baseline for PWA features
- **Developer Productivity**: Modern patterns for new feature development

## Relationship to PWA Migration Stories

This migration is **prerequisite** to the PWA features outlined in `svelte-migration-stories.md`:

### Stories That Benefit from Svelte 5
- **SVELTE-012**: Offline write queue - complex state management easier with runes
- **SVELTE-013A**: Conflict resolution UI - reactive patterns cleaner with runes  
- **SVELTE-UX-001**: Loading states - simpler state management
- **SVELTE-014**: Data sync optimization - better performance baseline

### Timeline Integration
1. **Complete Svelte 5 migration** (this plan) - 3 weeks
2. **Resume PWA migration stories** - 8+ weeks with improved foundation

This sequence minimizes risk and provides a more maintainable foundation for the complex PWA features ahead.

## Conclusion

The Svelte 4 to 5 migration provides essential foundation improvements that will simplify and improve the subsequent PWA feature development. By completing this migration first, we ensure a stable, performant, and modern platform for delivering the advanced offline capabilities outlined in the broader migration stories.