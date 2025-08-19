---
issue_id: ISS-0003
epic_id: EP-0001
title: Legacy Pattern Cleanup and Component Migration
description: Remove all legacy factory patterns and migrate components to use Epic-008 patterns exclusively for consistent Rails-like architecture
status: completed
priority: medium
assignee: unassigned
created_date: 2025-07-19T14:40:00.000Z
updated_date: 2025-07-19T16:30:00.000Z
estimated_tokens: 1200
actual_tokens: 0
ai_context:
  - legacy-cleanup
  - component-migration
  - epic-008
  - refactoring
related_tasks: []
sync_status: local
tags:
  - frontend
  - refactoring
  - cleanup
dependencies:
  - ISS-0002
original_story_id: 008.3
---

# Issue: Legacy Pattern Cleanup and Component Migration

## Description
**As a** developer working with the Epic-008 simplified architecture,
**I want** all legacy patterns removed and components migrated to use Epic-008 patterns exclusively,
**So that** the codebase has consistent Rails-like patterns without confusing multiple ways to accomplish the same task.

## Acceptance Criteria

1. **Remove Legacy Factory Patterns**
   - Delete entire `frontend/src/lib/record-factory/` directory (Epic-007 legacy)
   - Remove TaskInstance usage from all components
   - Remove `createTaskInstance` function calls throughout codebase
   - Clean up factory pattern imports and dependencies

2. **Migrate TaskList Component**
   - Update `frontend/src/lib/components/jobs/TaskList.svelte` to use Epic-008 patterns
   - Replace `createTaskInstance` calls with `Task.find()` or `ReactiveTask.find()`
   - Update imports to use Epic-008 model classes
   - Ensure reactive behavior works correctly with new patterns

3. **Automated Codebase Migration**
   - Run automated scripts to find and replace old patterns
   - Update import statements throughout codebase
   - Replace factory function calls with Epic-008 method calls
   - Verify no old patterns remain in codebase

4. **Testing and Validation**
   - Run full test suite to ensure no functionality is broken
   - Update tests that depend on old patterns
   - Verify performance is maintained or improved
   - Test UI components function correctly with new patterns

5. **Documentation and Training**
   - Update any internal documentation referencing old patterns
   - Create migration guide for future developers
   - Document new Epic-008 import and usage patterns
   - Remove references to deprecated patterns

## Tasks
(To be created as separate task items)

## Dependencies
- ISS-0002 (Epic-008 Model Generation)
- All Epic-008 base classes must be implemented

## Notes
- This is a cleanup task to remove technical debt
- Must be careful not to break existing functionality
- Automated scripts can help with bulk migration
- Test coverage is critical during migration