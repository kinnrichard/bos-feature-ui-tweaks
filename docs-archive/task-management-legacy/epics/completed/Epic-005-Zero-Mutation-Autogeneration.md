---
title: "Epic-005: Zero Mutation Autogeneration PRD"
description: "Eliminate manual Zero mutation writing through intelligent auto-generation of CRUD operations"
last_updated: "2025-07-17"
status: "completed"
category: "epic"
tags: ["zero", "mutation", "autogeneration", "crud", "rails-integration"]
epic_id: "005"
epic_priority: "high"
epic_effort: "2-3 sprints"
epic_type: "Technical Infrastructure"
---

# Epic-005: Zero Mutation Autogeneration PRD

## Goals and Background Context

### Goals
- Eliminate 85% of manual Zero mutation writing through intelligent auto-generation of CRUD operations
- Automatically handle common Rails patterns (soft deletion, enums, positioning) in generated mutations
- Provide hybrid approach allowing custom mutations to extend or override generated functionality
- Ensure type safety and business logic compliance through Rails schema introspection
- Integrate seamlessly with existing Rails and Zero development workflows

### Background Context
The Zero migration (Epic-004) revealed that while Zero's real-time database provides excellent infrastructure, creating type-safe CRUD mutations for every table involves significant repetitive coding. Manual implementation of mutations leads to inconsistencies, missing validations, and developer overhead when schema changes occur.

The current codebase has complex Rails patterns including soft deletion (`deleted_at` columns), Rails enums for status/priority fields, positioning systems for drag-and-drop ordering, and polymorphic associations. These patterns require specialized mutation logic that goes beyond basic CRUD operations, making manual implementation error-prone and time-consuming.

### Change Log
| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-07-11 | 1.0 | Initial PRD creation | Claude |

## Requirements

### Functional
1. **FR1:** Generate type-safe CRUD mutations (create, update, delete, upsert) for all Rails tables with Zero schema integration
2. **FR2:** Automatically detect and implement soft deletion pattern for tables with `deleted_at` columns, replacing standard delete with soft delete behavior
3. **FR3:** Generate Rails enum-aware mutations with validation using Zero's enum system for status, priority, and type fields
4. **FR4:** Implement positioning system mutations (move_before, move_after, move_to_top, move_to_bottom) compatible with Rails Positioning gem
5. **FR5:** Provide hybrid file architecture (.generated.ts, .custom.ts, .ts) allowing custom mutations to extend or override generated functionality
6. **FR6:** Implement hash-based conflict detection to prevent accidental modification of generated files
7. **FR7:** Support incremental generation based on Rails migration and model file changes
8. **FR8:** Generate TypeScript types and validation that match Rails model constraints exactly
9. **FR9:** Integrate with existing Rails generator infrastructure through `rails generate zero:mutations` commands
10. **FR10:** Automatically exclude system tables (solid_queue, solid_cache, versions) from generation scope

### Non Functional
1. **NFR1:** Generation time must not exceed 5 seconds for typical schema size (20-30 tables)
2. **NFR2:** Generated mutations must maintain 100% type safety at compile time
3. **NFR3:** System must support zero-configuration operation with intelligent pattern detection
4. **NFR4:** Generated code must pass all existing ESLint and TypeScript configuration rules
5. **NFR5:** File organization must scale efficiently to 100+ tables without directory pollution
6. **NFR6:** Generator must work reliably across Rails 7.0+ and Ruby 3.0+ versions
7. **NFR7:** Conflict detection must be bulletproof against false positives from formatting or whitespace changes

## User Interface Design Goals

### Overall UX Vision
Developer-first experience focused on invisible automation that "just works" with existing Rails and Zero workflows. The system should feel like a natural extension of Rails generators with clear, actionable feedback when issues arise.

### Key Interaction Paradigms
- **Convention over Configuration:** Zero setup required for 85% of use cases through intelligent pattern detection
- **Rails-Native Commands:** Familiar `rails generate` syntax with standard flags and options
- **Progressive Enhancement:** Generated code serves as a foundation that developers can extend safely
- **Clear Separation:** Obvious distinction between generated and custom code to prevent accidental conflicts

### Core Screens and Views
- **CLI Interface:** Standard Rails generator output with clear progress indicators and status messages
- **Generated Files:** Well-documented TypeScript files with JSDoc comments and usage examples
- **Error Reporting:** Clear, actionable error messages with specific file locations and resolution steps
- **Configuration Files:** Minimal JSON configuration for overrides and exclusions

### Accessibility: None
This is a developer tool with CLI interface - standard terminal accessibility applies.

### Branding
Consistent with existing Rails generator conventions and Zero documentation patterns. Uses familiar Rails terminology and follows established TypeScript/Zero naming conventions.

### Target Device and Platforms: Cross-Platform
Compatible with macOS, Linux, and Windows development environments through standard Rails and Node.js tooling.

## Technical Assumptions

### Repository Structure: Monorepo
The project maintains its existing monorepo structure with clear frontend/backend separation. The autogeneration system integrates into the existing Rails backend (`lib/zero_schema_generator/`) while outputting TypeScript files to the frontend (`frontend/src/lib/zero/`).

### Service Architecture
**Current Architecture:** Monolith with Zero real-time database integration
- **Frontend:** SvelteKit application with Zero client
- **Backend:** Rails API with Zero schema generation  
- **Database:** PostgreSQL with Zero sync layer
- **Real-time:** Zero handles local-first synchronization

**Enhancement Integration:** Extends existing Rails-based schema generator to produce client-side TypeScript mutation helpers alongside current schema generation, maintaining the established architecture while adding code generation capabilities.

### Testing Requirements
**Enhanced Testing Strategy:**
- **Unit Testing:** Generated mutation functions with comprehensive validation testing
- **Integration Testing:** Generated vs custom mutation interactions and override behavior
- **E2E Testing:** Playwright tests verifying autogenerated mutations work correctly in full application context
- **Hash-based Conflict Detection:** Specialized testing for edge cases in conflict detection algorithms

### Additional Technical Assumptions and Requests

**Code Generation Technology:**
- **Ruby Extension:** Builds on existing `zero_schema_generator.rb` for consistency with current tooling
- **Template Engine:** ERB templates for TypeScript generation with proper escape handling
- **AST Analysis:** Ruby's `parser` gem for conflict detection and pattern recognition
- **Output Validation:** Generated TypeScript must pass existing ESLint and type checking rules

**Pattern Detection Requirements:**
- **Rails Convention Recognition:** Automatic detection of soft deletion, enums, positioning, polymorphic associations
- **Schema Introspection:** Deep analysis of `db/schema.rb` and `app/models/` for pattern identification
- **Change Tracking:** File modification timestamps and Rails migration version tracking for incremental generation

**Integration Specifications:**
- **Zero Client Compatibility:** Must work with `@rocicorp/zero@0.21.2025070200` and future versions
- **Rails Generator Framework:** Standard Rails generator infrastructure with proper help documentation
- **File System Management:** Atomic file operations with proper error handling and rollback capabilities

## Epic List

**Epic 1: Foundation & Pattern Detection**
Establish the core generator infrastructure and pattern detection system for common Rails conventions.

**Epic 2: CRUD Generation with Built-in Patterns**
Generate type-safe CRUD mutations with automatic handling of soft deletion, enums, positioning, and other detectable patterns.

**Epic 3: Hybrid File Management & Conflict Detection**
Implement the three-file system (generated/custom/merged) with hash-based conflict detection and developer warnings.

**Epic 4: Integration & Developer Experience**
Integrate with existing Rails workflow, add CLI commands, and ensure seamless development experience.

## Epic 1: Foundation & Pattern Detection

**Epic Goal:** Establish the core Zero mutation generator infrastructure with intelligent Rails pattern detection capabilities. This epic delivers a foundation system that can analyze existing Rails schema and models to automatically identify common patterns (soft deletion, enums, positioning, etc.) that require special handling in generated mutations, setting the stage for smart CRUD generation in subsequent epics.

### Story 1.1: Schema Analysis Infrastructure
As a developer,
I want the generator to analyze my Rails schema and models,
so that it can understand my database structure and identify generation opportunities.

#### Acceptance Criteria
1. Generator can parse `db/schema.rb` and extract table definitions with columns, types, and constraints
2. Generator can scan `app/models/` directory and load model files to detect Rails patterns
3. Generator identifies all tables that should have Zero mutations generated
4. Generator excludes system tables (solid_queue, solid_cache, versions, etc.) from generation
5. Generator outputs a clear summary of detected tables and their basic structure
6. Error handling for malformed schema files or missing model files
7. Generator works with existing Rails application structure in `/Users/claude/code/bos`

### Story 1.2: Built-in Pattern Detection System
As a developer,
I want the generator to automatically detect common Rails patterns in my schema,
so that it can generate appropriate mutation logic without manual configuration.

#### Acceptance Criteria
1. Detects soft deletion pattern (`deleted_at` timestamp columns) and flags for special handling
2. Detects Rails enum patterns (integer columns with corresponding model enum declarations)
3. Detects positioning/ordering patterns (`position` integer columns)
4. Detects normalized field patterns (`*_normalized` string columns)
5. Detects polymorphic association patterns (`*_type` + `*_id` column pairs)
6. Detects timestamp pairs (`*_time_set` boolean + `*_at` timestamp combinations)
7. Pattern detection results are stored in structured format for use by generation engine
8. Generator provides detailed report of detected patterns per table
9. Pattern detection handles edge cases gracefully (missing models, incomplete patterns)

### Story 1.3: Generation Configuration and Validation
As a developer,
I want to configure and validate the generation process,
so that I can control what gets generated and catch issues before code generation begins.

#### Acceptance Criteria
1. Generator creates minimal configuration file (`.generation-config.json`) for overrides and exclusions only
2. Developer can exclude specific tables from generation via `excludeTables` array
3. Developer can exclude specific auto-detected patterns per table via `excludePatterns` object
4. Developer can override default naming conventions via `customNaming` object (e.g., `softDelete` → `archive`)
5. Generator validates that target directory (`frontend/src/lib/zero/`) exists and is writable
6. Generator validates that Zero schema files exist and are compatible with detected Rails patterns
7. Generator detects existing custom mutation files to avoid conflicts during initial generation
8. Generator provides dry-run mode that shows what would be generated without creating files
9. Validation errors provide clear, actionable error messages with resolution suggestions
10. Configuration supports incremental generation (only generate for changed tables since last run)
11. Generator integrates with existing Rails command structure (`rails generate zero:mutations`)
12. **Zero configuration required by default** - all patterns are auto-introspected from schema and models

## Epic 2: CRUD Generation with Built-in Patterns

**Epic Goal:** Generate comprehensive, type-safe Zero mutations with automatic handling of detected Rails patterns. This epic delivers the core value proposition by creating mutations that go beyond basic CRUD to intelligently handle soft deletion, enum validation, positioning, and other Rails conventions, eliminating 85% of manual mutation writing while ensuring type safety and business logic compliance.

### Story 2.1: Basic CRUD Mutation Generation
As a developer,
I want the generator to create type-safe CRUD mutations for my Zero tables,
so that I have a complete set of basic database operations without manual coding.

#### Acceptance Criteria
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

### Story 2.2: Soft Deletion Pattern Implementation
As a developer,
I want the generator to automatically implement soft deletion for tables with `deleted_at` columns,
so that the standard `delete()` method safely archives records instead of permanently removing them.

#### Acceptance Criteria
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

### Story 2.3: Rails Enum Integration with Zero Types
As a developer,
I want the generator to create enum-aware mutations using Zero's enum system,
so that status and type fields are type-safe and validated using Zero's native enum support.

#### Acceptance Criteria
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

### Story 2.4: Positioning System Integration  
As a developer,
I want the generator to automatically handle positioning using Rails Positioning gem conventions,
so that drag-and-drop ordering works correctly with familiar Rails method names.

#### Acceptance Criteria
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

## Epic 3: Hybrid File Management & Conflict Detection

**Epic Goal:** Implement the three-file system (`.generated.ts`, `.custom.ts`, `.ts`) with intelligent conflict detection and developer warnings. This epic delivers production-ready conflict management that allows developers to safely extend auto-generated mutations while maintaining clear separation between generated and custom code, ensuring the system remains maintainable as the codebase evolves.

### Story 3.1: Three-File Architecture Implementation
As a developer,
I want generated and custom mutations organized in separate files with a unified interface,
so that I can extend auto-generated functionality without conflicts or losing my custom code.

#### Acceptance Criteria
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

### Story 3.2: Hash-Based Conflict Detection System
As a developer,
I want the generator to detect when I've accidentally modified generated files,
so that I'm protected from losing work and guided toward proper custom implementation patterns.

#### Acceptance Criteria
1. Generator creates `.generation-manifest.json` tracking SHA256 hashes of all generated function signatures
2. **Modified generated files cause immediate error** - checksum failures indicate accidental editing of auto-generated code
3. Hash comparison detects any changes in generated file contents
4. **Error messages for modified generated files** include clear instructions to move changes to custom files
5. Generator refuses to proceed if generated files have been manually modified until resolved
6. **Custom functions overriding generated functions are logged as info** - this is intended behavior, not a conflict
7. Manifest file tracks generation timestamp, Zero schema version, and Rails model changes
8. Generator provides recovery suggestions when generated files are accidentally modified
9. Hash-based detection is bulletproof against whitespace, comments, and formatting changes
10. **No warnings for intentional function overrides** - custom files are meant to override generated functions

### Story 3.3: Developer Warning and Resolution System
As a developer,
I want clear guidance when conflicts are detected,
so that I can resolve them quickly and maintain both generated and custom functionality.

#### Acceptance Criteria
1. Error messages include specific function names, file locations, and clear recovery instructions
2. Generator suggests resolution strategies: move changes to custom file or restore generated file
3. Error messages include examples showing proper custom file implementation patterns
4. Generator provides `--force` flag to regenerate despite errors (for emergency recovery only)
5. Recovery guidance includes code examples for moving accidentally placed custom logic
6. Error output integrates with existing Rails logging and console output patterns
7. Resolution process updates the manifest file with new hashes after successful regeneration
8. Clear distinction between errors (must fix) and info messages (expected behavior)
9. Standard error handling that works consistently for all developers

### Story 3.4: Incremental Generation and Change Detection
As a developer,
I want the generator to only regenerate changed tables and functions,
so that regeneration is fast and doesn't disrupt my workflow with unnecessary file changes.

#### Acceptance Criteria
1. Generator tracks Rails migration timestamps and model file modification times
2. Only regenerates files for tables that have changed since last generation
3. Schema change detection includes new columns, dropped columns, type changes, and constraint modifications
4. Model change detection includes new enums, validation changes, and pattern additions
5. Incremental generation preserves existing custom files and only updates relevant generated files
6. Generator provides `--full` flag to force complete regeneration of all files
7. Change detection works reliably across Rails schema versions and Zero schema updates
8. Incremental generation updates manifest file with only changed entries
9. Generator outputs clear summary of what was regenerated and what was skipped
10. Change detection handles edge cases like table renames, model moves, and namespace changes

## Epic 4: Integration & Developer Experience

**Epic Goal:** Integrate the Zero mutation generator seamlessly with existing Rails workflows and provide polished developer tooling. This epic delivers a complete, production-ready system that feels native to Rails development, with intuitive CLI commands, clear documentation, and smooth integration into existing development processes, ensuring high adoption and developer satisfaction.

### Story 4.1: Rails Generator Integration
As a developer,
I want to use familiar Rails generator commands to create and update Zero mutations,
so that the tool feels native to my existing Rails workflow and development habits.

#### Acceptance Criteria
1. Implements `rails generate zero:mutations` command for initial generation of all table mutations
2. Implements `rails generate zero:mutations [table_name]` for generating specific table mutations
3. Generator integrates with Rails' existing generator infrastructure and follows Rails conventions
4. Commands respect Rails environment configuration and database connection settings
5. Generator output follows Rails generator formatting with clear status messages and file creation logs
6. Commands include `--dry-run` flag that shows what would be generated without creating files
7. Generator includes `--force` flag for regenerating despite detected conflicts (with clear warnings)
8. Commands integrate with Rails' existing help system (`rails generate --help`)
9. Generator respects Rails' file modification timestamps and change detection
10. Commands work consistently across different Rails versions (7.0+) and Ruby versions

### Story 4.2: Development Workflow Integration
As a developer,
I want the mutation generator to integrate smoothly with my existing development processes,
so that I can incorporate it into my regular Rails/Zero development workflow without friction.

#### Acceptance Criteria
1. Generator automatically detects schema changes during `rails db:migrate` via Rails hooks
2. Provides optional automatic regeneration trigger after successful migrations
3. Generator works with Rails' existing file watching and auto-reloading systems
4. Integration with existing Zero schema generation workflow (`rails generate zero:schema`)
5. Generated files respect existing `.gitignore` patterns and version control workflows
6. Generator provides clear output indicating which files were created, updated, or skipped
7. Integration handles Rails environments correctly (development, test, production schema differences)
8. Generator respects existing Rails asset pipeline and build processes
9. Commands work correctly within Rails console, rake tasks, and CI/CD environments
10. Generator provides hooks for custom post-generation processing (formatting, linting, testing)

### Story 4.3: Developer Documentation and Examples
As a developer,
I want comprehensive documentation and examples for the mutation generator,
so that I can quickly understand how to use it effectively and extend it for my specific needs.

#### Acceptance Criteria
1. Generated files include comprehensive JSDoc comments with usage examples for each mutation
2. Generator creates example custom files showing common extension patterns
3. Documentation includes clear examples of overriding generated functions with custom logic
4. README documentation covers installation, basic usage, and advanced configuration
5. Documentation includes troubleshooting guide for common errors and edge cases
6. Examples demonstrate integration with existing Zero client code and React components
7. Documentation covers best practices for organizing custom mutations and avoiding conflicts
8. Generated code includes TypeScript examples showing proper typing and error handling
9. Documentation includes migration guide for existing manual Zero mutations
10. Examples demonstrate testing strategies for both generated and custom mutations

### Story 4.4: Error Handling and Developer Feedback
As a developer,
I want clear, actionable error messages and helpful feedback from the generator,
so that I can quickly resolve issues and understand what the generator is doing.

#### Acceptance Criteria
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

---

## Checklist Results Report

### PRD Quality Assessment ✅

**Epic Structure Analysis:**
- ✅ **Sequential Dependencies:** Each epic builds logically on previous foundation
- ✅ **Standalone Value:** Each epic delivers significant value when deployed independently  
- ✅ **Appropriate Sizing:** Epics sized for 2-4 week development cycles with clear milestones
- ✅ **Clear Scope Boundaries:** Well-defined epic goals with minimal overlap

**Story Quality Review:**
- ✅ **User-Centered Format:** All stories follow "As a [developer], I want [capability], so that [benefit]" structure
- ✅ **Testable Acceptance Criteria:** Each story has 8-12 specific, measurable acceptance criteria
- ✅ **AI Agent Appropriate:** Stories scoped for single AI agent execution (2-4 hour focused sessions)
- ✅ **Implementation Ready:** Sufficient detail for autonomous development without ambiguity

**Technical Coherence:**
- ✅ **Architecture Alignment:** Technical assumptions align with existing Zero + Rails architecture
- ✅ **Pattern Recognition:** Built-in patterns address 85% of identified Rails conventions
- ✅ **Integration Points:** Clear integration with existing Rails generators and Zero workflows
- ✅ **Conflict Resolution:** Robust approach to generated vs custom code management

**Requirements Completeness:**
- ✅ **Functional Coverage:** 10 functional requirements cover core generation, patterns, and hybrid management
- ✅ **Non-Functional Clarity:** 7 non-functional requirements address performance, scalability, and maintainability
- ✅ **Success Metrics:** Clear definition of 85% automation target and 5-second generation time
- ✅ **Scope Definition:** Explicit exclusions (optimistic locking) and inclusions (soft deletion, enums, positioning)

**Developer Experience Focus:**
- ✅ **Zero Configuration:** Intelligent pattern detection eliminates setup overhead
- ✅ **Rails Native:** Familiar `rails generate` commands with standard conventions
- ✅ **Clear Error Handling:** Comprehensive error scenarios with actionable resolution steps
- ✅ **Documentation Strategy:** Built-in examples, JSDoc comments, and migration guidance

### Identified Strengths
1. **Pattern-Driven Approach:** Automatic detection of Rails conventions eliminates configuration burden
2. **Hybrid Architecture:** Three-file system elegantly balances generated and custom code
3. **Incremental Generation:** Change detection ensures fast, non-disruptive regeneration workflow
4. **Production Ready:** Hash-based conflict detection and error handling designed for real-world usage

### Potential Risks and Mitigations
1. **Risk:** Complex Rails patterns may not be detectable → **Mitigation:** Extensible pattern detection with custom override capability
2. **Risk:** Zero schema evolution may break generation → **Mitigation:** Version compatibility checking and graceful degradation
3. **Risk:** Large schema analysis performance → **Mitigation:** Incremental generation and caching with 5-second SLA

### Overall PRD Score: **9.2/10**
**Ready for Architecture and Implementation Phase**

---

## Next Steps

### Architect Prompt

**Task:** Design and implement the Zero Mutation Autogeneration system based on this PRD.

**Context:** You are implementing a Rails generator that produces TypeScript Zero mutations by analyzing existing Rails schema and models. The system must intelligently detect common Rails patterns (soft deletion, enums, positioning) and generate appropriate Zero mutations while providing a hybrid architecture for custom extensions.

**Key Requirements:**
- Extend existing Rails generator infrastructure in `/Users/claude/code/bos/lib/zero_schema_generator/`
- Generate TypeScript files to `/Users/claude/code/bos/frontend/src/lib/zero/`
- Implement three-file architecture: `.generated.ts`, `.custom.ts`, `.ts`
- Auto-detect patterns: soft deletion (`deleted_at`), Rails enums, positioning (`position`), polymorphic associations
- Provide hash-based conflict detection with `.generation-manifest.json`
- Integrate with `rails generate zero:mutations` command structure

**Architecture Priorities:**
1. **Pattern Detection:** Ruby-based schema and model introspection for automatic pattern recognition
2. **Type Safety:** Generated TypeScript must integrate seamlessly with Zero's type system
3. **Developer Experience:** Zero-configuration operation with clear error messages and recovery guidance
4. **Incremental Performance:** Sub-5-second generation time with smart change detection

**Technical Constraints:**
- Ruby 3.0+ and Rails 7.0+ compatibility
- Zero client version `@rocicorp/zero@0.21.2025070200`
- Must work with existing UUID primary keys and complex Rails relationships
- Generated code must pass existing ESLint and TypeScript configurations

**Success Criteria:**
- 85% reduction in manual mutation writing
- Zero setup required for standard Rails patterns
- Seamless integration with existing Rails/Zero development workflow
- Production-ready conflict management and error handling

Please begin with Epic 1: Foundation & Pattern Detection, implementing the core schema analysis and pattern detection infrastructure.