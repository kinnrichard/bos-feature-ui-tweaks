# Story 3.3: Developer Warning and Resolution System

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Hybrid File Management & Conflict Detection

## User Story
As a developer,
I want clear guidance when conflicts are detected,
so that I can resolve them quickly and maintain both generated and custom functionality.

## Acceptance Criteria
1. Error messages include specific function names, file locations, and clear recovery instructions
2. Generator suggests resolution strategies: move changes to custom file or restore generated file
3. Error messages include examples showing proper custom file implementation patterns
4. Generator provides `--force` flag to regenerate despite errors (for emergency recovery only)
5. Recovery guidance includes code examples for moving accidentally placed custom logic
6. Error output integrates with existing Rails logging and console output patterns
7. Resolution process updates the manifest file with new hashes after successful regeneration
8. Clear distinction between errors (must fix) and info messages (expected behavior)
9. Standard error handling that works consistently for all developers

## Technical Notes
- Clear error messages with specific file locations and recovery instructions
- Integration with Rails logging patterns
- --force flag for emergency recovery scenarios only
- Standard error handling approach for consistency

## Definition of Done
- [ ] Error messages include function names and file locations
- [ ] Resolution strategies suggested (move to custom vs restore)
- [ ] Examples showing proper custom file patterns
- [ ] --force flag implemented for emergency recovery
- [ ] Code examples for moving accidentally placed logic
- [ ] Integration with Rails logging and console patterns
- [ ] Manifest file updated after successful resolution
- [ ] Clear distinction between errors and info messages
- [ ] Consistent error handling across all scenarios