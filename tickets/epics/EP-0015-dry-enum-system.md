# EP-0015: DRY Enum System - YAML to Ruby & TypeScript

**Epic Type**: Technical Debt / Architecture Enhancement
**Priority**: High
**Created**: 2025-07-31
**Status**: Cancelled
**Estimated Effort**: 3-4 weeks

## Executive Summary

Implement a DRY (Don't Repeat Yourself) enum system that eliminates duplication between Ruby and TypeScript by using YAML configuration files as the single source of truth for all enum metadata (labels, emoji, sort order).

## Problem Statement

Currently, enum metadata is duplicated across multiple locations:
- Ruby value objects (`JobPriority`, `JobStatus`, etc.) define labels, emojis, colors
- TypeScript/Svelte files manually duplicate these same values
- Changes require updates in multiple places, increasing maintenance burden
- Risk of drift between Ruby and TypeScript implementations
- No systematic approach for new enums

### Current Pain Points
1. **Duplication**: Same emoji/label data maintained in 3+ places
2. **Inconsistency**: Frontend uses simple string manipulation vs backend's proper labels
3. **Manual Sync**: No automated way to keep frontend/backend in sync
4. **Scattered Logic**: Priority/status logic spread across many components

## Vision & Goals

### Vision
Create a configuration-driven enum system where YAML files serve as the single source of truth for all enum metadata, with automatic generation of both Ruby value objects and TypeScript classes that mirror each other's APIs.

### Goals
1. **Single Source of Truth**: YAML configuration for all enum metadata
2. **API Parity**: TypeScript classes that mirror Ruby value object APIs
3. **Zero Manual Sync**: Automatic generation on both sides
4. **Type Safety**: Maintain full type safety in both languages
5. **UI Simplification**: Generic components for enum-based UI elements

## Success Metrics

- ✅ All enum metadata defined in YAML files
- ✅ Zero duplicate enum definitions
- ✅ 100% generated code for enum value objects
- ✅ Reduced Svelte component code by ~50% for enum popovers
- ✅ New enums can be added by creating YAML + running generator

## Technical Architecture

### 1. YAML Configuration Structure
```yaml
# config/enums/job/priority.yml
job_priority:
  critical:
    label: "Critical"
    emoji: "🔥"
    sort_order: 1
  very_high:
    label: "Very High"
    emoji: "‼️"
    sort_order: 2
  # ... etc
```

### 2. Ruby Generation
- Generate value object classes from YAML at boot time or via rake task
- Maintain exact same API as current value objects
- Located in `app/models/enums/` (generated)

### 3. TypeScript Generation
- Extend Rails Zero generator to create TypeScript enum classes
- Mirror Ruby API: `new JobPriority('very_high').withEmoji()`
- Located in `frontend/src/lib/models/enums/` (generated)

### 4. Rails Zero Generator Enhancement
- Add enum metadata extraction to introspector
- Generate TypeScript classes with full metadata
- Include in standard generation workflow

### 5. UI Component Architecture
- Generic `EnumPopoverButton` component
- Works with any enum class that follows the pattern
- Replaces individual priority/status popover components

## Implementation Stories

### Story 1: Create YAML Enum Configuration System
**Priority**: Must Have
**Effort**: 3 points

Create the YAML configuration structure and initial enum files.

**Tasks**:
- Create `config/enums/` directory structure
- Define YAML schema for enum metadata
- Create initial YAML files for existing enums:
  - `job_priority.yml`
  - `job_status.yml`
  - `task_status.yml`
- Document YAML structure and conventions

**Acceptance Criteria**:
- [ ] All existing enum values captured in YAML
- [ ] YAML structure supports all current metadata
- [ ] Schema documented in `config/enums/README.md`

---

### Story 2: Enhance Rails Zero Generator for Enums
**Priority**: Must Have
**Effort**: 5 points

Extend the Rails Zero generator to detect and process enum metadata.

**Tasks**:
- Add enum metadata detection to `RailsSchemaIntrospector`
- Create `EnumMetadataExtractor` class
- Integrate with existing generator workflow
- Add configuration options for enum generation

**Acceptance Criteria**:
- [ ] Generator detects enum columns with value objects
- [ ] Extracts metadata from Ruby value objects
- [ ] Includes enum metadata in generation output
- [ ] Configuration option to enable/disable enum generation

---

### Story 3: Generate Ruby Value Objects from YAML
**Priority**: Must Have
**Effort**: 5 points

Create Ruby generator that creates value objects from YAML configuration.

**Tasks**:
- Create `EnumGenerator` Ruby class
- Generate value objects matching current API
- Add rake task: `rails enums:generate:ruby`
- Integrate with Rails boot process (optional)

**Acceptance Criteria**:
- [ ] Generated Ruby classes match current API exactly
- [ ] All tests pass with generated classes
- [ ] Generation is idempotent
- [ ] Clear marking of generated files

---

### Story 4: Generate TypeScript Enum Classes
**Priority**: Must Have
**Effort**: 5 points

Generate TypeScript classes that mirror Ruby value objects.

**Tasks**:
- Extend Zero generator to create enum classes
- Generate TypeScript with identical API to Ruby
- Create base `EnumValue` interface/class
- Add generation to `rails zero:generate_schema`

**Acceptance Criteria**:
- [ ] TypeScript API mirrors Ruby: `.label`, `.emoji`, `.withEmoji()`
- [ ] Full type safety maintained
- [ ] Static methods work: `.all()`, `.forSelect()`
- [ ] Generated files clearly marked

---

### Story 5: Create Generic Enum UI Components
**Priority**: Must Have
**Effort**: 3 points

Build reusable Svelte components for enum-based UI.

**Tasks**:
- Create `EnumPopoverButton.svelte` generic component
- Create `EnumSelect.svelte` for form selects
- Create `EnumBadge.svelte` for display
- Add TypeScript generics for type safety

**Acceptance Criteria**:
- [ ] Components work with any enum following the pattern
- [ ] Type safety maintained with generics
- [ ] Accessibility features preserved
- [ ] Existing functionality maintained

---

### Story 6: Migrate Existing Enums
**Priority**: Must Have
**Effort**: 8 points

Migrate all existing enum implementations to new system.

**Tasks**:
- Replace hardcoded `JobPriority` with generated version
- Replace hardcoded `JobStatus` with generated version
- Replace hardcoded `TaskStatus` with generated version
- Update all imports and references
- Remove old hardcoded enum files

**Acceptance Criteria**:
- [ ] All enums use generated classes
- [ ] No duplicate enum definitions remain
- [ ] All tests pass
- [ ] No functional regressions

---

### Story 7: Update All Svelte Views
**Priority**: Must Have
**Effort**: 8 points

Update all Svelte components to use new enum system.

**Tasks**:
- Replace `JobPriorityButton` with generic component
- Replace `JobStatusButton` with generic component
- Update `ActivityLogList` to use enum classes
- Thoroughly search project for
- Update all other enum displays
- Remove hardcoded emoji mappings

**Acceptance Criteria**:
- [ ] All enum displays use new system
- [ ] No hardcoded labels or emojis
- [ ] Components use proper TypeScript enum classes
- [ ] Reduced component code complexity

---

## Technical Considerations

### File Structure
```
config/
  enums/
    job_priority.yml
    job_status.yml
    task_status.yml
    README.md

app/models/
  enums/            # Generated Ruby
    job_priority.rb
    job_status.rb

frontend/src/lib/
  models/
    enums/          # Generated TypeScript
      JobPriority.ts
      JobStatus.ts
      base/
        EnumValue.ts

  components/
    enums/          # Generic components
      EnumPopoverButton.svelte
      EnumSelect.svelte
      EnumBadge.svelte
```

### Generation Workflow
1. Developer modifies YAML file
2. Run `rails enums:generate` (generates both Ruby & TypeScript)
3. Or automatic generation during `rails zero:generate_schema`
4. Commit generated files to version control

### Testing Strategy
- Unit tests for generators
- Integration tests for generated code
- UI tests for enum components
- Regression tests for existing functionality

### Migration Strategy
1. Phase 1: Set up infrastructure (Stories 1-5)
2. Phase 2: Migrate one enum as proof of concept
3. Phase 3: Migrate remaining enums (Story 6)
4. Phase 4: Update all UI components (Story 7)

## Risks & Mitigations

### Risks
1. **Breaking Changes**: Generated code might not match existing API
   - *Mitigation*: Extensive testing, careful API design

2. **Performance**: Loading YAML at runtime could impact boot time
   - *Mitigation*: Generate at build time, not runtime

3. **Complexity**: Adding generation step to workflow
   - *Mitigation*: Integrate with existing Zero generator

4. **Type Safety**: Losing type safety in generation
   - *Mitigation*: Strong TypeScript types, generic constraints

## Dependencies
- Rails Zero generator infrastructure
- YAML parsing libraries
- Existing enum value objects as reference

## Future Enhancements
1. **Enum Validation**: Add Rails validations based on YAML
2. **I18n Support**: Integrate with Rails I18n for labels
3. **Enum Documentation**: Auto-generate enum documentation
4. **GraphQL Integration**: Generate GraphQL enum types
5. **Enum Migrations**: Track enum value changes over time

## Definition of Done
- [ ] All enum metadata defined in YAML files
- [ ] Ruby value objects generated from YAML
- [ ] TypeScript classes generated with matching API
- [ ] All UI components use generated enums
- [ ] No duplicate enum definitions remain
- [ ] Documentation updated
- [ ] All tests passing
- [ ] Performance benchmarks acceptable

## References
- Current JobPriority implementation: `/app/models/job_priority.rb`
- Current TypeScript enums: `/frontend/src/lib/config/emoji.ts`
- Rails Zero generator: `/lib/zero_schema_generator/`
- Related issue: `/tickets/issues/consolidate-priority-labels.md`
