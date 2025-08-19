# Story 2.4: Positioning System Integration

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** CRUD Generation with Built-in Patterns

## User Story
As a developer,
I want the generator to automatically handle positioning using Rails Positioning gem conventions,
so that drag-and-drop ordering works correctly with familiar Rails method names.

## Acceptance Criteria
1. Generates `move_before(target_id)` mutation for repositioning records before another record
2. Generates `move_after(target_id)` mutation for repositioning records after another record  
3. Generates `move_to_top()` mutation for moving records to first position
4. Generates `move_to_bottom()` mutation for moving records to last position
5. Generated positioning logic respects scoping (e.g., position within job_id or parent_id)
6. Positioning mutations handle edge cases (invalid targets, empty lists, self-references)
7. Generated mutations use the same method names and behavior as Rails Positioning gem
8. Position updates are atomic and work seamlessly with Zero's real-time synchronization
9. Generated mutations include proper validation for positioning boundaries and scoping
10. Positioning logic automatically manages gap insertion and position recalculation

## Technical Notes
- Rails Positioning gem compatibility with same method names
- Atomic updates compatible with Zero's real-time sync
- Scoping support for hierarchical positioning
- Automatic gap management and position recalculation

## Definition of Done
- [ ] move_before(target_id) mutation generation working
- [ ] move_after(target_id) mutation generation working
- [ ] move_to_top() mutation generation working
- [ ] move_to_bottom() mutation generation working
- [ ] Positioning logic respects scoping (job_id, parent_id)
- [ ] Edge case handling (invalid targets, empty lists, self-references)
- [ ] Method names match Rails Positioning gem exactly
- [ ] Atomic updates work with Zero real-time sync
- [ ] Proper validation for positioning boundaries and scoping
- [ ] Automatic gap insertion and position recalculation