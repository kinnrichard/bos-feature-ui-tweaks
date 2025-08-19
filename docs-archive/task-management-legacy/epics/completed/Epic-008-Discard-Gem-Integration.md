# Epic-008: Discard Gem Integration with Reactive UI Controls

## Goals and Background Context

### Goals
- Replace custom soft deletion with Rails discard gem patterns for full Rails API parity
- Implement bandwidth-efficient reactive querying with `job.tasks.kept` and `job.tasks.all` switching
- Add user controls for optionally viewing discarded tasks without performance penalty
- Ensure JavaScript-idiomatic method naming while maintaining Rails conventions
- Achieve seamless integration between Rails discard gem and Zero.js reactive queries

### Background Context
The current codebase uses custom soft deletion with `deleted_at` columns and manual default scopes. The Rails backend has been migrated to use the `discard` gem with `include Discard::Model`, but the frontend still uses the old patterns. This creates API inconsistency and a task deletion persistence issue where discarded tasks reappear after page refresh.

The discard gem follows a different pattern than our custom implementation: `Post.all` includes discarded records (no default filtering), requiring explicit use of `Post.kept` to exclude discarded records. This change requires updating the frontend to match this behavior while providing efficient reactive querying and optional UI controls for viewing discarded tasks.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-07-13 | 1.0 | Initial Epic creation for discard gem integration | Claude |

## Epic Overview
Transform the frontend to match Rails discard gem behavior exactly, with efficient reactive querying and user controls for viewing discarded records. This epic addresses the current task deletion persistence issue while implementing a comprehensive discard system.

## User Stories

### Story 1: Update Schema and Column References
**As a developer, I want the frontend schema to use `discarded_at` instead of `deleted_at` to match Rails.**

**Business Value**: Ensures API consistency between Rails backend and frontend, eliminating confusion and potential bugs from schema mismatches.

**Acceptance Criteria:**
- [ ] Zero.js schema uses `discarded_at` column instead of `deleted_at`
- [ ] All generated TypeScript interfaces reference `discarded_at`
- [ ] Schema introspector detects `include Discard::Model` in Rails models
- [ ] Column type mapping is correct (number().optional())
- [ ] Generated schema file has no references to `deleted_at`

**Technical Tasks:**
- Update `lib/zero_schema_generator/rails_schema_introspector.rb` to detect `discarded_at` columns
- Update pattern detection to recognize `include Discard::Model` in Rails models
- Regenerate Zero.js schema with `rails zero:generate_schema`
- Verify generated `frontend/src/lib/zero/generated-schema.ts` has correct column name
- Update any hardcoded references to `deleted_at` in schema-related code

### Story 2: Update Mutation Generator for Discard Patterns
**As a developer, I want generated mutations to use discard terminology and behavior.**

**Business Value**: Provides Rails-compatible discard methods in the frontend, enabling seamless transition from custom soft deletion to industry-standard discard patterns.

**Acceptance Criteria:**
- [ ] Functions named `discardTask()` and `undiscardTask()` instead of `deleteTask()` and `restoreTask()`
- [ ] Mutations update `discarded_at` field instead of `deleted_at`
- [ ] Generated scopes: `all` (no filter), `kept` (filters discarded), `discarded` (only discarded)
- [ ] Instance methods use discard terminology (`discard`, `undiscard`)
- [ ] Generated JSDoc comments use discard terminology
- [ ] Mutation validation uses `discarded_at` field

**Technical Tasks:**
- Update `lib/zero_schema_generator/mutation_generator.rb` to use discard naming
- Update soft deletion logic to use `discarded_at` instead of `deleted_at`
- Generate three scopes with correct filtering logic: `all`, `kept`, `discarded`
- Update instance method names in generated classes (`delete` → `discard`)
- Update `lib/zero_schema_generator/mutation_config.rb` default naming configuration
- Update mutation templates to use discard terminology in documentation

### Story 3: Update Record Instance Base Class
**As a developer, I want instance methods to follow JavaScript conventions with discard terminology.**

**Business Value**: Provides intuitive, JavaScript-idiomatic API that matches Rails functionality while following frontend conventions (Promise-based, no exclamation marks).

**Acceptance Criteria:**
- [ ] `task.discard()` method returns Promise<boolean>, throws on failure
- [ ] `task.undiscard()` method returns Promise<boolean>, throws on failure  
- [ ] `task.discarded` getter returns boolean
- [ ] `task.kept` getter returns boolean (!discarded)
- [ ] `task.discardedAt` getter returns timestamp or null
- [ ] Methods follow JavaScript Promise conventions for error handling
- [ ] No exclamation mark methods (JavaScript-idiomatic, not Ruby-style)

**Technical Tasks:**
- Update `frontend/src/lib/record-factory/record-instance.ts` base class
- Replace `delete()` → `discard()` method implementation
- Replace `restore()` → `undiscard()` method implementation
- Add `discarded` getter that checks `discarded_at` field
- Add `kept` getter that returns `!this.discarded`
- Add `discardedAt` getter that returns timestamp or null
- Update property references from `deleted_at` to `discarded_at`
- Ensure proper error handling with meaningful error messages

### Story 4: Update ModelFactory Scoping (No Default Filtering)
**As a developer, I want ModelFactory to match Rails discard gem behavior exactly.**

**Business Value**: Ensures consistent behavior between Rails and frontend queries, preventing unexpected results and maintaining Rails conventions.

**Acceptance Criteria:**
- [ ] `Task.all` includes discarded records (no default filtering, matching Rails)
- [ ] `Task.kept` excludes discarded records (`discarded_at IS NULL`)
- [ ] `Task.discarded` shows only discarded records (`discarded_at IS NOT NULL`)
- [ ] Association queries (job.tasks) include discarded by default
- [ ] Scoped queries (job.tasks.kept) filter properly and efficiently
- [ ] No performance regression from default behavior change

**Technical Tasks:**
- Update `lib/generators/zero/factory_models/factory_models_generator.rb` scoping behavior
- Ensure default queries include discarded records (remove automatic filtering)
- Generate proper scope methods on model classes with correct SQL filtering
- Test association scoping behavior to ensure `job.tasks.kept` works correctly
- Update any existing code that assumes default filtering of discarded records
- Verify reactive query performance with new scoping approach

### Story 5: Implement Reactive Task Filtering with UI Controls
**As a user, I want to view discarded tasks optionally without wasting bandwidth.**

**Business Value**: Provides user control over viewing discarded tasks while optimizing bandwidth by only loading needed data, improving both user experience and application performance.

**Acceptance Criteria:**
- [ ] Default view shows only kept tasks using `job.tasks.kept` (bandwidth efficient)
- [ ] Task filter popover has "Deleted" checkbox, unchecked by default
- [ ] Checking "Deleted" switches to show all tasks using `job.tasks.all`
- [ ] Switching between views is reactive and efficient (separate Zero.js queries)
- [ ] Bandwidth is optimized - only loads discarded tasks when requested
- [ ] UI state persists during component updates but resets on page reload
- [ ] Clear visual indication when deleted tasks are being shown

**Technical Tasks:**
- Add "Deleted" checkbox to existing task filter popover component
- Implement reactive state management for `showDeleted` toggle using Svelte 5 `$state`
- Use `$derived` to reactively switch between `job.tasks.kept` and `job.tasks.all`
- Test reactive query switching behavior with Zero.js
- Verify bandwidth efficiency using browser network monitoring
- Style the "Deleted" checkbox to match existing filter design
- Add visual indicator (badge/label) when deleted tasks are visible

### Story 6: Update Task List Component
**As a user, I want task deletion to use the new discard API and persist correctly.**

**Business Value**: Fixes the current task deletion persistence issue while providing consistent, reliable task discard functionality that works across page reloads.

**Acceptance Criteria:**
- [ ] Task deletion uses `task.discard()` instead of `task.delete()`
- [ ] Discarded tasks disappear from default view immediately (optimistic update)
- [ ] Discarded tasks persist across page refreshes (database persistence)
- [ ] Error handling works properly for failed discard operations
- [ ] Loading states and animations work correctly with new API
- [ ] Multiple task deletion (batch operations) works with discard API
- [ ] Undo functionality works if implemented

**Technical Tasks:**
- Update `frontend/src/lib/components/jobs/TaskList.svelte` to use `task.discard()`
- Remove manual UI filtering since reactive queries handle filtering automatically
- Test discard persistence by deleting tasks and refreshing page
- Implement proper error handling for discard failures with user feedback
- Verify optimistic updates work correctly with new reactive queries
- Update batch deletion operations to use discard API
- Test animation timing with new discard methods

### Story 7: Regenerate All Models and Test
**As a developer, I want all generated files to use the new discard patterns consistently.**

**Business Value**: Ensures system-wide consistency and eliminates technical debt from mixed deletion patterns, providing a solid foundation for future development.

**Acceptance Criteria:**
- [ ] All model files regenerated with discard patterns
- [ ] All mutation files use discard terminology and `discarded_at` field
- [ ] Task model specifically has all discard methods and scopes
- [ ] Generated TypeScript types are correct and consistent
- [ ] No references to old `deleted_at` terminology remain in generated files
- [ ] All tests pass with new discard patterns
- [ ] Build process completes without errors

**Technical Tasks:**
- Run `rails generate zero:factory_models` to regenerate model configurations
- Run `rails zero:generate_mutations` to regenerate all mutation files
- Verify generated files in `frontend/src/lib/zero/` have correct patterns
- Update any manual references to old terminology in application code
- Run full test suite to verify functionality
- Update any failing tests to use new discard API
- Verify TypeScript compilation succeeds
- Check for any remaining `deleted_at` references and update them

## Epic Definition of Done
- [ ] All user stories completed and acceptance criteria met
- [ ] Frontend API matches Rails discard gem behavior exactly (`Task.all` includes discarded)
- [ ] Task discard/undiscard works and persists correctly across page reloads
- [ ] UI allows optional viewing of discarded tasks with clear controls
- [ ] Bandwidth is optimized (only loads discarded tasks when requested)
- [ ] All tests pass and build process completes successfully
- [ ] No breaking changes to existing functionality
- [ ] Performance is maintained or improved
- [ ] Documentation is updated to reflect new discard patterns
- [ ] Generated code follows consistent patterns and naming conventions

## Technical Architecture

### Key Components
1. **Schema Layer**: `generated-schema.ts` with `discarded_at` column
2. **Mutation Layer**: Generated discard functions (`discardTask`, `undiscardTask`)
3. **Model Layer**: Scoped queries (`Task.all`, `Task.kept`, `Task.discarded`)
4. **Instance Layer**: JavaScript-idiomatic methods (`task.discard()`, getters)
5. **UI Layer**: Reactive filtering with bandwidth optimization

### Data Flow
```
User clicks delete → task.discard() → Zero.js mutation → Database update → 
Reactive query update → UI reflects change (task disappears from kept view)
```

### Reactive Query Strategy
```typescript
// Bandwidth efficient - only loads needed data
let showDeleted = $state(false);
const tasks = $derived(showDeleted ? job.tasks.all : job.tasks.kept);
```

## Risk Assessment
**Medium Risk Epic**

### Technical Risks
- **Schema Migration Risk**: Changing column references could break existing queries
- **Generated Code Risk**: Updates to generators could introduce regressions
- **Performance Risk**: Need to verify reactive query switching doesn't cause performance issues
- **Integration Risk**: Coordination between multiple system layers required

### Mitigation Strategies
- Comprehensive testing at each layer before moving to next story
- Backup of existing generated files before regeneration
- Performance monitoring during reactive query implementation
- Incremental rollout with ability to rollback individual changes

## Estimated Effort
**Epic Size: Large (10-14 story points)**

### Story Breakdown
- Story 1 (Schema): 2 points - Straightforward schema changes
- Story 2 (Mutations): 3 points - Complex generator updates
- Story 3 (Instances): 2 points - Method updates and testing
- Story 4 (Scoping): 2 points - Model factory configuration
- Story 5 (UI Controls): 3 points - New UI component work
- Story 6 (Task List): 2 points - Component updates and testing
- Story 7 (Testing): 1 point - Verification and cleanup

## Dependencies
- ✅ Rails discard gem installed and configured
- ✅ Task model updated with `include Discard::Model`
- ✅ Database migration from `deleted_at` to `discarded_at` completed
- ✅ Zero.js infrastructure and reactive queries functional
- ✅ Existing mutation generation system operational

## Success Metrics
- Task deletion persistence issue resolved (no tasks reappearing after refresh)
- Bandwidth usage reduced for default task loading (only kept tasks)
- User can optionally view discarded tasks with single UI control
- Zero failing tests related to task deletion/soft deletion
- Generated code consistency across all models with discard patterns

## Future Considerations
- Extend discard patterns to other models (Jobs, Clients, etc.) as needed
- Consider implementing discard/undiscard audit trails
- Evaluate bulk discard operations for efficiency
- Assess integration with offline-first capabilities of Zero.js