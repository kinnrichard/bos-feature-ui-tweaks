---
issue_id: ISS-0004
epic_id: EP-0001
title: Clean up Unused CSS Selectors
description: Identify and remove unused CSS selectors from the codebase to reduce bundle size and improve maintainability
status: backlog
priority: low
assignee: unassigned
created_date: 2025-07-19T17:00:00.000Z
updated_date: 2025-07-19T17:00:00.000Z
estimated_tokens: 800
actual_tokens: 0
ai_context:
  - css-cleanup
  - frontend-optimization
  - technical-debt
  - bundle-size
related_tasks: []
sync_status: local
tags:
  - frontend
  - css
  - cleanup
  - technical-debt
  - optimization
dependencies: []
---

# Issue: Clean up Unused CSS Selectors

## Description
**As a** developer maintaining the frontend codebase,
**I want** to identify and remove unused CSS selectors,
**So that** we can reduce bundle size, improve CSS maintainability, and ensure cleaner stylesheets.

## Acceptance Criteria

1. **CSS Audit and Analysis**
   - Audit all CSS/SCSS files in the codebase
   - Identify unused selectors using appropriate tools
   - Generate report of unused CSS by file
   - Calculate potential bundle size reduction

2. **Cleanup Implementation**
   - Remove identified unused selectors from:
     - `frontend/src/app.css`
     - `app/assets/stylesheets/**/*.scss`
     - Component-specific stylesheets, including Svelte
   - Preserve selectors that may be dynamically used
   - Maintain critical styles for third-party integrations

3. **Tool Integration**
   - Implement PurgeCSS or similar tool for ongoing maintenance
   - Configure to work with Svelte components
   - Set up safelist for dynamic classes
   - Integrate into build process

4. **Testing and Validation**
   - Visual regression testing of all major UI components
   - Verify no styling breaks in production build
   - Test dynamic styling scenarios
   - Confirm bundle size reduction metrics

5. **Documentation**
   - Document CSS cleanup process
   - Create guidelines for preventing unused CSS
   - Update style guide with best practices
   - Add tooling configuration documentation

## Technical Details

### Areas to Focus
- Legacy Bootstrap/Rails CSS in `app/assets/stylesheets/`
- Unused utility classes
- Deprecated component styles
- Old responsive breakpoint styles
- Vendor prefixes no longer needed

### Tools to Consider
- PurgeCSS for automated removal
- CSS Stats for analysis
- Chrome DevTools Coverage tab
- PostCSS plugins for optimization

### Safelist Considerations
- Dynamically generated classes (status colors, etc.)
- Third-party library classes
- Classes used in JavaScript/Svelte
- Server-rendered content styles

## Benefits
- Reduced CSS bundle size (estimated 30-50% reduction)
- Improved CSS maintainability
- Faster page load times
- Cleaner codebase
- Easier to find and update styles

## Risks
- Accidentally removing dynamically used styles
- Breaking third-party component styling
- Missing edge case scenarios

## Notes
- This is a technical debt reduction task
- Should be done after major feature work is stable
- Can be done incrementally by module
- Consider setting up automated CSS usage monitoring