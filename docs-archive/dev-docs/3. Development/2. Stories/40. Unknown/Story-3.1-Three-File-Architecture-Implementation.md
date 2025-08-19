# Story 3.1: Three-File Architecture Implementation

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Hybrid File Management & Conflict Detection

## User Story
As a developer,
I want generated and custom mutations organized in separate files with a unified interface,
so that I can extend auto-generated functionality without conflicts or losing my custom code.

## Acceptance Criteria
1. Generator creates `.generated.ts` files containing all auto-generated CRUD and pattern-based mutations
2. Generator creates `.custom.ts` files as empty templates for developer-written custom mutations
3. Generator creates main `.ts` files that export merged functionality from both generated and custom files
4. Generated files include clear header comments marking them as auto-generated with regeneration warnings
5. Custom files include helpful comments and examples for common extension patterns
6. Main export files use TypeScript module merging to combine generated and custom exports seamlessly
7. File structure follows naming convention: `users.generated.ts`, `users.custom.ts`, `users.ts`
8. Generated files are marked as read-only in IDE-compatible formats (e.g., `// @generated` comments)
9. All three file types maintain consistent TypeScript typing and Zero integration
10. Import statements in application code use the main `.ts` files for unified access to all mutations

## Technical Notes
- Three-file architecture: `.generated.ts`, `.custom.ts`, `.ts`
- TypeScript module merging for seamless export combination
- IDE-compatible read-only marking for generated files
- Consistent typing across all file types

## Definition of Done
- [ ] .generated.ts files created with auto-generated mutations
- [ ] .custom.ts files created as empty templates with examples
- [ ] Main .ts files created with merged exports
- [ ] Clear header comments marking generated files
- [ ] Helpful comments and examples in custom files
- [ ] TypeScript module merging working seamlessly
- [ ] Naming convention followed: table.generated.ts, table.custom.ts, table.ts
- [ ] Generated files marked as read-only with @generated comments
- [ ] Consistent TypeScript typing across all file types
- [ ] Application imports use main .ts files for unified access