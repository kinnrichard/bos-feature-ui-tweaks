# Consolidate Priority Label Functions

**Issue Type**: Code Maintenance/UI Consistency  
**Priority**: Medium  
**Created**: 2025-07-31  
**Related To**: dry-up-priority-lookups.md (follow-up issue)

## Problem Description

Priority labels are displayed inconsistently across the application, particularly in activity logs where "very_high" appears as "Very_high" instead of the proper "Very High". While the backend JobPriority.rb model has authoritative label definitions, there's no centralized function in the frontend to retrieve these properly formatted labels.

## Current State

### Backend Source of Truth
- **JobPriority.rb** defines proper labels:
  - `critical` → "Critical"
  - `very_high` → "Very High" ✅
  - `high` → "High"
  - `normal` → "Normal"
  - `low` → "Low"
  - `proactive_followup` → "Proactive Follow-up"

### Frontend Inconsistencies
1. **ActivityLogList.svelte** (Line 174)
   - Uses manual string manipulation: `${newPriority?.charAt(0)?.toUpperCase() + newPriority?.slice(1)}`
   - Results in "Very_high" instead of "Very High" ❌

2. **PriorityBadge.svelte** (Lines 40-45)
   - Has special case handling for specific priorities
   - Hardcoded label logic instead of centralized function

3. **JobPriorityButton.svelte** (Lines 26-49)
   - Contains hardcoded priority labels in `availablePriorities` array
   - Duplicates label definitions from backend

4. **emoji.ts** (Line 241)
   - `getJobPriorityWithEmoji` uses simple string replacement
   - Doesn't handle special cases like "very_high" → "Very High"

## Solution Requirements

### 1. Create Centralized Label Mapping
Add to `emoji.ts`:
```typescript
const JOB_PRIORITY_LABELS: Record<string, string> = {
  critical: "Critical",
  very_high: "Very High",
  high: "High", 
  normal: "Normal",
  low: "Low",
  proactive_followup: "Proactive Follow-up"
};
```

### 2. Add Label Retrieval Function
```typescript
export function getJobPriorityLabel(priority: string | null | undefined): string {
  if (!priority) return "Unknown";
  return JOB_PRIORITY_LABELS[priority] || priority.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
```

### 3. Update Affected Components

#### ActivityLogList.svelte
Replace line 174:
```typescript
// OLD:
return `marked ${loggableTypeEmoji} ${loggableName} as ${priorityEmoji} ${newPriority?.charAt(0)?.toUpperCase() + newPriority?.slice(1)} Priority`;

// NEW:
return `marked ${loggableTypeEmoji} ${loggableName} as ${priorityEmoji} ${getJobPriorityLabel(newPriority)} Priority`;
```

#### PriorityBadge.svelte
Replace special case handling (lines 40-45) with:
```typescript
const label = $derived(() => {
  if (!showLabel) return '';
  return type === 'job' 
    ? getJobPriorityLabel(priority)
    : priority.charAt(0).toUpperCase() + priority.slice(1);
});
```

#### JobPriorityButton.svelte
Update `availablePriorities` to use centralized labels:
```typescript
const availablePriorities = [
  { id: 'title', value: 'title', label: 'Job Priority', header: true },
  ...Object.entries(JOB_PRIORITY_LABELS).map(([key, label]) => ({
    id: key,
    value: key,
    label: label,
    icon: EMOJI_MAPPINGS.jobPriorities[key]
  }))
];
```

#### getJobPriorityWithEmoji function
Update to use the new label function:
```typescript
export function getJobPriorityWithEmoji(priority: string | number | null | undefined): string {
  if (priority === null || priority === undefined) return 'Unknown';
  const priorityString = typeof priority === 'number' ? getJobPriorityString(priority) : priority;
  const emoji = getJobPriorityEmoji(priority);
  const label = getJobPriorityLabel(priorityString);
  return emoji ? `${emoji} ${label}` : label;
}
```

## Files Requiring Changes

1. `/frontend/src/lib/config/emoji.ts`
   - Add `JOB_PRIORITY_LABELS` constant
   - Add `getJobPriorityLabel` function
   - Update `getJobPriorityWithEmoji` function
   - Export new label mapping for use in other components

2. `/frontend/src/lib/components/logs/ActivityLogList.svelte`
   - Import `getJobPriorityLabel`
   - Update line 174 to use proper label function

3. `/frontend/src/lib/components/ui/PriorityBadge.svelte`
   - Import `getJobPriorityLabel`
   - Replace special case logic with centralized function

4. `/frontend/src/lib/components/layout/JobPriorityButton.svelte`
   - Import `JOB_PRIORITY_LABELS`
   - Refactor `availablePriorities` to use centralized labels

## Acceptance Criteria

- [ ] Single source of truth for priority labels in frontend (`JOB_PRIORITY_LABELS`)
- [ ] Activity logs display "Very High" instead of "Very_high"
- [ ] All priority labels match backend JobPriority.rb format exactly
- [ ] No hardcoded priority label logic in individual components
- [ ] `getJobPriorityLabel` function available for all components
- [ ] All existing priority display functionality continues to work
- [ ] TypeScript types properly handle the new functions
- [ ] No regression in priority emoji display

## Testing Requirements

1. **Activity Log Priority Changes**
   - Change job priority to "very_high"
   - Verify activity log shows "‼️ Very High Priority"
   - Test all priority levels for proper formatting

2. **Component Consistency**
   - Verify PriorityBadge shows correct labels
   - Verify JobPriorityButton dropdown shows correct labels
   - Ensure all components display consistent formatting

3. **Edge Cases**
   - Test with null/undefined priorities
   - Test with invalid priority values
   - Verify fallback behavior

## Technical Notes

- The backend JobPriority.rb is the authoritative source for label formatting
- This consolidation follows the DRY principle established in the priority lookup refactoring
- Consider adding unit tests for the new `getJobPriorityLabel` function
- Future enhancement: Consider fetching priority definitions from the backend API

## Benefits

1. **Consistency**: All components display priorities identically
2. **Maintainability**: Single place to update priority labels
3. **Correctness**: Matches backend formatting exactly
4. **Reduced Duplication**: Eliminates hardcoded labels across components
5. **Better UX**: Users see properly formatted priority names everywhere

## Related Issues

- **dry-up-priority-lookups.md**: This issue is a follow-up to complete the consolidation work