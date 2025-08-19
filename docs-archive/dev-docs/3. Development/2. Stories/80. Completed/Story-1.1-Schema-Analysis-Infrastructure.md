# Story 1.1: Schema Analysis Infrastructure

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Foundation & Pattern Detection

## User Story
As a developer,
I want the generator to analyze my Rails schema and models,
so that it can understand my database structure and identify generation opportunities.

## Acceptance Criteria
1. Generator can parse `db/schema.rb` and extract table definitions with columns, types, and constraints
2. Generator can scan `app/models/` directory and load model files to detect Rails patterns
3. Generator identifies all tables that should have Zero mutations generated
4. Generator excludes system tables (solid_queue, solid_cache, versions, etc.) from generation
5. Generator outputs a clear summary of detected tables and their basic structure
6. Error handling for malformed schema files or missing model files
7. Generator works with existing Rails application structure in `/Users/claude/code/bos`

## Technical Notes
- Extends existing `lib/zero_schema_generator/` infrastructure
- Must handle UUID primary keys and complex Rails relationships
- Should integrate with existing Rails generator framework
- Output goes to `frontend/src/lib/zero/`

## Definition of Done
- [ ] Schema parser extracts all table definitions correctly
- [ ] Model scanner detects Rails patterns in existing models
- [ ] System tables are automatically excluded
- [ ] Clear error messages for malformed files
- [ ] Summary output shows detected structure
- [ ] Works with current Rails application structure