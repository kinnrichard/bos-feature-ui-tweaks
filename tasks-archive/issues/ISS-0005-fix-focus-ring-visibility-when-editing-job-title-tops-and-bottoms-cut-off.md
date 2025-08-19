---
issue_id: ISS-0005
title: Fix focus ring visibility when editing Job title - tops and bottoms cut off
description: >-
  When editing a Job title input field, the blue focus ring is partially cut off at the top and bottom edges. This
  creates a poor visual experience and could impact accessibility for keyboard users who rely on focus indicators for
  navigation.


  The issue appears to be related to CSS overflow clipping, possibly due to:

  - Insufficient padding or margin around the input field

  - Line-height settings that don't account for the focus ring

  - Parent container overflow settings

  - Focus ring outline offset not properly configured


  This affects the user experience, particularly for accessibility, as focus indicators are crucial for keyboard
  navigation and WCAG compliance.
status: completed
priority: medium
assignee: claude
created_date: 2025-07-19T15:49:17.490Z
updated_date: 2025-07-19T16:51:00.000Z
estimated_tokens: 0
actual_tokens: 0
ai_context:
  - context/requirements
  - context/constraints
  - context/assumptions
  - context/dependencies
sync_status: local
related_tasks: []
related_issues: []
tags:
  - ui
  - accessibility
  - frontend
  - focus-ring
  - css
completion_percentage: 100
blocked_by: []
blocks: []
---

# Issue: Fix focus ring visibility when editing Job title - tops and bottoms cut off

## Description
When editing a Job title input field, the blue focus ring is partially cut off at the top and bottom edges. This creates a poor visual experience and could impact accessibility for keyboard users who rely on focus indicators for navigation.

The issue appears to be related to CSS overflow clipping, possibly due to:
- Positioning of sibling elements
- Insufficient padding or margin around the input field
- Line-height settings that don't account for the focus ring
- Parent container overflow settings
- Focus ring outline offset not properly configured

This affects the user experience, particularly for accessibility, as focus indicators are crucial for keyboard navigation and WCAG compliance.

## Tasks
- [x] Identify the CSS causing the focus ring clipping
- [x] Fix bottom clipping by removing background color from task list
- [x] Fix top clipping by adjusting job title padding

## Acceptance Criteria
- [x] Focus ring is fully visible on all sides when editing Job title
- [x] No clipping occurs at the top or bottom of the focus ring
- [x] The fix maintains the existing layout and styling
- [x] The solution works across different screen sizes

## Notes

### Solution Implementation

The focus ring clipping issue required three separate fixes to fully resolve:

1. **Bottom Clipping Fix**: 
   - **Root Cause**: The `.task-list` class in `TaskList.svelte` had `background-color: var(--bg-black);` which was creating a visual layer that obscured the bottom of the focus ring
   - **Fix**: Removed the background-color property from `.task-list`
   - **File**: `/Users/claude/Projects/bos/frontend/src/lib/components/jobs/TaskList.svelte`
   - **Result**: Resolved the bottom clipping issue

2. **Initial Top Clipping Fix (Partial)**:
   - **Issue**: The `.job-title` class in `JobDetailView.svelte` had asymmetric padding (`padding: 3px 5px;`) which didn't provide enough space for the focus ring at the top
   - **Fix**: Changed to uniform padding (`padding: 5px;`) to ensure consistent spacing on all sides
   - **File**: `/Users/claude/Projects/bos/frontend/src/lib/components/jobs/JobDetailView.svelte`
   - **Result**: Improved but did not fully resolve the top clipping

3. **Final Top Clipping Fix (Complete)**:
   - **Root Cause**: The h1 element was positioned at the very top edge of its scrollable container (`.job-detail-container` with `overflow-y: auto`), causing the focus ring to be clipped by the container's overflow boundary
   - **Fix**: Added top padding to the container (`padding: 24px 24px 0 24px;`) to create space between the container edge and the h1 element
   - **File**: `/Users/claude/Projects/bos/frontend/src/routes/(authenticated)/jobs/[id]/+page.svelte`
   - **Result**: Fully resolved the top clipping issue

### Technical Details

- The focus ring in this application uses the browser's default outline styling
- The root cause was the combination of `overflow-y: auto` on the parent container and the h1 being positioned at the container's edge
- When an element with a focus ring is at the edge of a scrollable container, the overflow property clips the focus ring
- The solution creates sufficient space between the container boundaries and focusable elements to prevent clipping
- All fixes maintain the original visual design while ensuring accessibility compliance

### Testing

- Tested focus ring visibility by tabbing to the Job title input field
- Verified that the focus ring displays fully on all sides without any clipping
- Confirmed that the layout and styling remain consistent with the original design
- Tested across different viewport sizes to ensure the fix works responsively
