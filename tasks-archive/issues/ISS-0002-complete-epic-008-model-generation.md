---
issue_id: ISS-0002
epic_id: EP-0001
title: Complete Epic-008 Model Generation
description: Generate properly structured Epic-008 model classes that extend ActiveRecord and ReactiveRecord base classes, replacing current hybrid re-export patterns
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-19T14:35:00.000Z
updated_date: 2025-07-19T14:35:00.000Z
estimated_tokens: 1000
actual_tokens: 0
ai_context:
  - model-generation
  - rails-generator
  - epic-008
  - typescript
related_tasks: []
sync_status: local
tags:
  - frontend
  - code-generation
  - architecture
dependencies:
  - ISS-0001
original_story_id: 008.2
---

# Issue: Complete Epic-008 Model Generation

## Description
**As a** Rails developer working with the Epic-008 architecture,
**I want** properly generated Epic-008 model classes that extend ActiveRecord and ReactiveRecord base classes,
**So that** I can use familiar Rails patterns with true class inheritance instead of hybrid re-export patterns.

## Acceptance Criteria

1. **Replace Hybrid Re-Export Pattern**
   - Remove current hybrid re-export pattern from `frontend/src/lib/models/task.ts`
   - Generate true Epic-008 classes: `Task extends ActiveRecord<TaskData>` and `ReactiveTask extends ReactiveRecord<TaskData>`
   - Eliminate confusion between Zero.js exports and Epic-008 patterns
   - Maintain backward compatibility during transition

2. **Rails Generator Execution**
   - Run `rails generate zero:active_models` to generate Epic-008 model classes
   - Generate both ActiveRecord and ReactiveRecord versions for all models
   - Ensure generated models follow Epic-008 specification exactly
   - Verify TypeScript interfaces are properly generated

3. **Model Class Implementation**
   - Generated Task class must extend ActiveRecord base class with proper configuration
   - Generated ReactiveTask class must extend ReactiveRecord base class
   - Include domain-specific methods (e.g., `isCompleted`, `complete()`, `completed()` scope)
   - Support discard gem functionality (`discard()`, `undiscard()`, `kept()`, `discarded()`)
   - Include positioning methods for acts_as_list integration

4. **Type Safety and Interface Generation**
   - Generate proper TypeScript interfaces for all model data types
   - Ensure full type safety with no `as any` casts
   - Maintain compatibility with existing Zero.js generated types
   - Support proper generic typing for base class methods

5. **Import Pattern Standardization**
   - Update barrel exports in `frontend/src/lib/models/index.ts`
   - Establish clear import patterns for reactive vs non-reactive contexts
   - Remove confusing mixed exports from hybrid pattern
   - Document new import conventions

## Tasks
(To be created as separate task items)

## Dependencies
- ISS-0001 (ReactiveRecord Base Class Implementation)
- Rails generator system
- Existing Zero.js type generation

## Notes
- This completes the Epic-008 architecture implementation
- Must ensure backward compatibility during migration
- Generator templates need to follow Epic-008 patterns exactly