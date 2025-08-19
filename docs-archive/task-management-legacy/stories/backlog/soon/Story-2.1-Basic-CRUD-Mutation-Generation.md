# Story 2.1: Basic CRUD Mutation Generation

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** CRUD Generation with Built-in Patterns

## User Story
As a developer,
I want the generator to create type-safe CRUD mutations for my Zero tables,
so that I have a complete set of basic database operations without manual coding.

## Acceptance Criteria
1. Generates `create()` mutation with proper TypeScript typing from Zero schema
2. Generates `update()` mutation with partial typing and proper ID validation
3. Generates `delete()` mutation with ID validation and proper return types
4. Generates `upsert()` mutation combining create/update logic with conflict resolution
5. All generated mutations include proper UUID validation for ID fields
6. Generated mutations handle required field validation based on schema constraints
7. Generated mutations include JSDoc comments with usage examples
8. Generated mutations use consistent naming conventions matching Zero client patterns
9. Generated TypeScript types are exported for use in application code
10. Error handling includes descriptive error messages for validation failures
11. Generated mutations work with existing Zero client configuration and authentication

## Technical Notes
- Type-safe TypeScript generation from Zero schema
- UUID validation for all ID fields
- Integration with Zero client patterns and authentication
- Comprehensive JSDoc documentation with examples

## Definition of Done
- [ ] Create mutation generation working with proper typing
- [ ] Update mutation generation working with partial typing
- [ ] Delete mutation generation working with ID validation
- [ ] Upsert mutation generation working with conflict resolution
- [ ] UUID validation implemented for all ID fields
- [ ] Required field validation based on schema constraints
- [ ] JSDoc comments with usage examples included
- [ ] Consistent naming conventions matching Zero patterns
- [ ] TypeScript types exported for application use
- [ ] Descriptive error messages for validation failures
- [ ] Integration with existing Zero client working