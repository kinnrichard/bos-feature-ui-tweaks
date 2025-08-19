# Story 1.2: Built-in Pattern Detection System

**Epic:** Epic-005: Zero Mutation Autogeneration  
**Epic Goal:** Foundation & Pattern Detection

## User Story
As a developer,
I want the generator to automatically detect common Rails patterns in my schema,
so that it can generate appropriate mutation logic without manual configuration.

## Acceptance Criteria
1. Detects soft deletion pattern (`deleted_at` timestamp columns) and flags for special handling
2. Detects Rails enum patterns (integer columns with corresponding model enum declarations)
3. Detects positioning/ordering patterns (`position` integer columns)
4. Detects normalized field patterns (`*_normalized` string columns)
5. Detects polymorphic association patterns (`*_type` + `*_id` column pairs)
6. Detects timestamp pairs (`*_time_set` boolean + `*_at` timestamp combinations)
7. Pattern detection results are stored in structured format for use by generation engine
8. Generator provides detailed report of detected patterns per table
9. Pattern detection handles edge cases gracefully (missing models, incomplete patterns)

## Technical Notes
- Zero-configuration pattern recognition
- Structured storage of detected patterns for generation engine
- Must handle edge cases and incomplete patterns gracefully
- Integration with existing Rails model conventions

## Definition of Done
- [ ] Soft deletion pattern detection working
- [ ] Rails enum pattern detection working
- [ ] Positioning pattern detection working
- [ ] Normalized field pattern detection working
- [ ] Polymorphic association pattern detection working
- [ ] Timestamp pair pattern detection working
- [ ] Structured pattern storage implemented
- [ ] Detailed pattern reporting available
- [ ] Edge case handling implemented