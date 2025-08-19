# Problem Statement

## Current State Analysis

**Schema Drift Identified:**
- Rails uses UUID primary keys, Zero schema has redundant `id` + `uuid` fields
- Type mismatches: Rails integer enums vs Zero string enums
- Missing tables: `activity_logs`, `contact_methods`, `job_targets`, etc.
- Polymorphic association mismatch: Rails `notable_type/notable_id` vs Zero `job_id`
- Field inconsistencies: Rails `clients` missing `email/phone`, Zero has them

**Manual Maintenance Pain Points:**
- 15+ tables requiring continuous synchronization
- Complex relationships (self-referential, polymorphic-like patterns)
- JSONB column handling inconsistencies
- Type conversion errors between Rails and Zero

## Business Impact

- **Development Velocity**: Schema updates require dual maintenance
- **Data Consistency Risk**: Schema drift leads to runtime errors
- **Team Cognitive Load**: Developers must maintain mental mapping between systems
- **Migration Complexity**: Growing schema makes manual updates exponentially harder
