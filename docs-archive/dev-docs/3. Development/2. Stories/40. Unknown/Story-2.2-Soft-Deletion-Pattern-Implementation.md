# Story 2.2: Soft Deletion Pattern Implementation

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** CRUD Generation with Built-in Patterns

## User Story
As a developer,
I want the generator to automatically implement soft deletion for tables with `deleted_at` columns,
so that the standard `delete()` method safely archives records instead of permanently removing them.

## Acceptance Criteria
1. **Generated `delete()` mutation performs soft deletion** (sets `deleted_at` timestamp) for tables with `deleted_at` columns
2. Generates `restore()` mutation to undelete soft-deleted records (sets `deleted_at` to null)
3. **All queries automatically exclude deleted records** (`WHERE deleted_at IS NULL`)
4. Query helpers include `includeDeleted: true` option when archived records are explicitly needed
5. Generated relationships automatically exclude deleted records from joins and associations
6. Soft delete via `delete()` updates both `deleted_at` and `updated_at` timestamps
7. Restore mutations clear `deleted_at` and update `updated_at` timestamp
8. TypeScript types indicate when records may be soft-deleted vs. permanently available
9. Generated code includes clear documentation that `delete()` performs soft deletion
10. **Hard deletion requires custom implementation** - generator doesn't provide permanent deletion methods

## Technical Notes
- `delete()` method performs soft deletion automatically
- Query exclusion of deleted records by default
- Hard deletion requires custom implementation only
- Clear TypeScript typing for soft-deleted records

## Definition of Done
- [ ] Delete mutation performs soft deletion for tables with deleted_at
- [ ] Restore mutation implemented for undeleting records
- [ ] All queries automatically exclude deleted records
- [ ] includeDeleted query helper option working
- [ ] Relationships automatically exclude deleted records
- [ ] Soft delete updates both deleted_at and updated_at
- [ ] Restore clears deleted_at and updates updated_at
- [ ] TypeScript types indicate soft-deletion status
- [ ] Clear documentation about soft deletion behavior
- [ ] Hard deletion not provided automatically