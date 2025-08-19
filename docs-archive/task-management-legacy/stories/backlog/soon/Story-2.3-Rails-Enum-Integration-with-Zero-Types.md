# Story 2.3: Rails Enum Integration with Zero Types

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** CRUD Generation with Built-in Patterns

## User Story
As a developer,
I want the generator to create enum-aware mutations using Zero's enum system,
so that status and type fields are type-safe and validated using Zero's native enum support.

## Acceptance Criteria
1. Detects Rails enum declarations and generates corresponding **Zero enum types**
2. Uses Zero's `z.enum()` validation instead of custom TypeScript unions
3. Generated mutations include runtime validation against Zero enum schemas
4. Status transition mutations respect business logic using Zero enum constraints
5. Generated mutations include clear error messages for invalid enum values using Zero's validation
6. Enum types integrate with Zero's existing type system and validation pipeline
7. Generated code handles enum integer storage while exposing string values via Zero enums
8. Mutations work seamlessly with Zero's enum serialization and deserialization
9. Generated validation matches Rails model validation behavior through Zero enum validation
10. Zero enum types are properly exported and reusable across the application

## Technical Notes
- Uses Zero's native `z.enum()` validation system
- Integration with Zero's type system and validation pipeline
- Handles Rails integer storage with Zero string exposure
- Must match Rails model validation behavior exactly

## Definition of Done
- [ ] Rails enum detection working with Zero enum type generation
- [ ] Zero z.enum() validation implemented instead of TypeScript unions
- [ ] Runtime validation against Zero enum schemas working
- [ ] Status transition mutations respect business logic
- [ ] Clear error messages for invalid enum values
- [ ] Integration with Zero's type system and validation
- [ ] Integer storage with string value exposure working
- [ ] Seamless enum serialization/deserialization
- [ ] Generated validation matches Rails behavior
- [ ] Zero enum types exported and reusable