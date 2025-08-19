# System Tests

This directory is reserved for future system-level tests that may require 
root-level Playwright configuration.

## Current Test Architecture

### Rails API Tests (Ruby)
- **Location**: `test/models/`, `test/controllers/`, `test/integration/`
- **Purpose**: Test Rails API endpoints, business logic, data models
- **Run with**: `rake test` or `rails test`

### Frontend UI Tests (TypeScript/Svelte)
- **Location**: `frontend/tests/`
- **Purpose**: Test UI components, user interactions, frontend logic
- **Run with**: `cd frontend && npm test`
- **Config**: `frontend/playwright.config.ts`

### TaskList Specific Tests
- **Rails API**: `rake test:tasklist:api`
- **Frontend UI**: `rake test:tasklist:frontend`
- **All**: `rake test:tasklist:all`

## Archived Tests

Ruby Playwright tests that expected Rails views have been moved to:
`test/archived_playwright_tests/`

These tests were incompatible with our API-only Rails + Svelte frontend architecture.