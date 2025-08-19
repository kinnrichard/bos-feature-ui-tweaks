# STORY-EP17-002: Audit and Migrate Remaining ZeroDataView Usage

**Epic**: EP-0017 - ZeroDataView to ReactiveView Migration  
**Status**: 📋 Ready  
**Priority**: Medium  
**Estimate**: 2 points  
**Created**: 2025-08-01  
**Depends On**: STORY-EP17-001  

## Description

As a developer, I want to identify and migrate all remaining uses of ZeroDataView to ReactiveView so that we can fully standardize on ReactiveView and eventually remove the legacy component.

## Current State

Based on initial audit, ZeroDataView is used in:
1. `/routes/(authenticated)/jobs/+page.svelte` (being handled in STORY-EP17-001)
2. `/routes/(authenticated)/clients/[id]/jobs/+page.svelte` - Client-specific jobs page
3. `/lib/components/data/ZeroDataView.svelte` - The component itself

## Acceptance Criteria

- [ ] Complete audit of all ZeroDataView usage in codebase
- [ ] Migrate client jobs page to ReactiveView
- [ ] Verify no other hidden usages exist
- [ ] All migrated pages maintain current functionality
- [ ] Progressive loading implemented where beneficial
- [ ] All tests pass

## Technical Details

### Audit Approach

1. **Search for imports**:
   ```bash
   grep -r "import.*ZeroDataView" --include="*.svelte" --include="*.ts"
   ```

2. **Search for component usage**:
   ```bash
   grep -r "<ZeroDataView" --include="*.svelte"
   ```

### Migration: Client Jobs Page

File: `/frontend/src/routes/(authenticated)/clients/[id]/jobs/+page.svelte`

This page likely has similar structure to main jobs page but filtered by client. Apply same migration pattern:

1. Replace ZeroDataView import with ReactiveView
2. Update component usage with proper snippets
3. Maintain client-specific filtering
4. Test with various client contexts

### Documentation Update

Update any documentation that references ZeroDataView to use ReactiveView examples instead.

## Testing

1. **Manual Testing**:
   - Test client jobs page with different clients
   - Verify empty states (no jobs for client)
   - Test progressive loading behavior
   - Ensure navigation between pages works smoothly

2. **Automated Tests**:
   - Run existing test suite
   - Add tests for client-specific job filtering if missing

## Definition of Done

- [ ] Complete audit performed and documented
- [ ] All ZeroDataView usages migrated
- [ ] No regressions in functionality
- [ ] Tests updated and passing
- [ ] Code reviewed
- [ ] Ready to deprecate ZeroDataView

## Notes

- After this story, we can create a final story to remove ZeroDataView component
- Consider if any patterns emerged that should be documented for future container components
- Verify performance characteristics remain consistent