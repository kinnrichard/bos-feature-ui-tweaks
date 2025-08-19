# Story 4.4: Error Handling and Developer Feedback

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Integration & Developer Experience

## User Story
As a developer,
I want clear, actionable error messages and helpful feedback from the generator,
so that I can quickly resolve issues and understand what the generator is doing.

## Acceptance Criteria
1. All error messages include specific file locations, function names, and clear resolution steps
2. Generator provides progress indicators for long-running operations (large schema analysis)
3. Error messages distinguish between recoverable issues (warnings) and blocking problems (errors)
4. Generator includes validation of Zero client compatibility and schema version matching
5. Helpful suggestions for common mistakes (wrong directory, missing Zero setup, schema mismatches)
6. Error output includes relevant context (table names, detected patterns, file paths)
7. Generator provides summary reports of what was generated, skipped, or failed
8. Integration with Rails logging system for consistent error formatting and output
9. Generator includes debug mode with verbose output for troubleshooting complex issues
10. Clear success messages that confirm generation completed and provide next steps

## Technical Notes
- Specific error messages with file locations and resolution steps
- Progress indicators for long operations
- Rails logging system integration
- Debug mode for complex troubleshooting

## Definition of Done
- [ ] Error messages include file locations, function names, resolution steps
- [ ] Progress indicators for long-running operations
- [ ] Clear distinction between warnings and blocking errors
- [ ] Zero client compatibility and schema version validation
- [ ] Helpful suggestions for common mistakes
- [ ] Error output includes relevant context (tables, patterns, paths)
- [ ] Summary reports of generated/skipped/failed items
- [ ] Integration with Rails logging system
- [ ] Debug mode with verbose output for troubleshooting
- [ ] Clear success messages with next steps