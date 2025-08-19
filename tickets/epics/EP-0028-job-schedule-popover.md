# Epic: Replace Job Schedule Popover with Multi-Level Menu System

## Overview
Replace the existing `SchedulePriorityEditPopover` component with a new `JobSchedulePopover` that provides a more intuitive and feature-rich scheduling interface for jobs.

## Business Value
- Improved user experience for managing job schedules
- Support for multiple followup dates per job
- Consistent UI patterns across the application
- Better date/time management with visual calendar

## Current State
- Existing `SchedulePriorityEditPopover` combines schedule and priority in one form
- Uses basic HTML date/time inputs
- No support for followup dates
- Limited visual feedback for date selection

## Desired State
- Dedicated schedule popover with multi-level menu system
- Visual calendar component for date selection
- Support for start dates, due dates, and multiple followups
- Slide-over views with consistent toolbar pattern
- Clear visual hierarchy and improved usability

## Technical Architecture

### Component Structure
```
JobSchedulePopover (Main Component)
├── BasePopover (Foundation)
├── PopoverMenu (Main Menu)
│   ├── "Add a Start Date" / "Start: [Date]"
│   ├── "Add a Due Date" / "Due: [Date]"
│   └── "Add a Followup" / Followup list items
└── DateTimeEditor (Slide-over View)
    ├── Toolbar (Cancel/Title/Save)
    ├── Calendar Component
    ├── Time Picker (Optional)
    └── Remove Date Button
```

### Data Model
- **Job Model Fields:**
  - `starts_at`: DateTime field for start date
  - `start_time_set`: Boolean flag for time inclusion
  - `due_at`: DateTime field for due date  
  - `due_time_set`: Boolean flag for time inclusion
  
- **Followup Dates:**
  - Uses `ScheduledDateTime` model (polymorphic)
  - `schedulable_type`: 'Job'
  - `schedulable_id`: Job ID
  - `scheduled_type`: 'followup'
  - `scheduled_at`: DateTime value
  - `scheduled_time_set`: Boolean for time inclusion

## User Stories

### Story 1: View Job Schedule Menu
**As a** user managing jobs
**I want to** click the schedule button
**So that** I can see all scheduling options in one place

**Acceptance Criteria:**
- Clicking calendar icon opens popover menu
- Menu shows current state of all date fields
- Unset dates show "Add a [Type]" format
- Set dates show "[Type]: [Formatted Date]" format
- Menu closes when clicking outside

### Story 2: Add/Edit Start Date
**As a** user scheduling a job
**I want to** set a start date
**So that** I know when work should begin

**Acceptance Criteria:**
- Clicking "Add a Start Date" slides to date editor
- Calendar shows current month by default
- Optional time picker below calendar
- Save button updates job and returns to menu
- Cancel button returns without saving
- If due date exists, enforce start <= due

### Story 3: Add/Edit Due Date
**As a** user managing deadlines
**I want to** set a due date
**So that** I can track job completion targets

**Acceptance Criteria:**
- Clicking "Add a Due Date" slides to date editor
- Calendar allows any date selection
- Time picker optional and blank by default
- Save updates job model via Zero.js
- If start date exists, enforce due >= start

### Story 4: Manage Followup Dates
**As a** user tracking job progress
**I want to** add multiple followup dates
**So that** I can schedule check-ins and reviews

**Acceptance Criteria:**
- "Add a Followup" creates new ScheduledDateTime record
- Each followup shows in menu list
- Clicking followup allows editing
- Remove button deletes followup record
- No limit on number of followups
- Followups independent of start/due dates

### Story 5: Remove Existing Dates
**As a** user correcting schedules
**I want to** remove previously set dates
**So that** I can clear incorrect information

**Acceptance Criteria:**
- Date editor shows "Remove Date" button for existing dates
- Clicking remove clears the date field
- Returns to main menu after removal
- Properly nullifies database field

## Implementation Tasks

### Phase 1: Setup & Dependencies
- [ ] Install shadcn-svelte calendar component
- [ ] Create Calendar wrapper component with custom styling
- [ ] Add date formatting utilities for absolute dates
- [ ] Set up slide transition animations

### Phase 2: Core Components
- [ ] Create JobSchedulePopover.svelte main component
- [ ] Implement PopoverMenu integration for main view
- [ ] Create DateTimeEditor.svelte with toolbar pattern
- [ ] Add view state management and transitions
- [ ] Integrate calendar and time picker

### Phase 3: Data Integration
- [ ] Update job model date field handlers
- [ ] Implement ScheduledDateTime CRUD for followups
- [ ] Add Zero.js integration for reactive updates
- [ ] Handle time zone considerations
- [ ] Add validation for date relationships

### Phase 4: UI Polish
- [ ] Match existing popover styling patterns
- [ ] Implement keyboard navigation (arrows, enter, escape)
- [ ] Add ARIA labels and accessibility features
- [ ] Ensure mobile responsiveness
- [ ] Add loading states for async operations

### Phase 5: Integration & Testing
- [ ] Replace SchedulePriorityEditPopover in JobControlsBar
- [ ] Update any other component references
- [ ] Write unit tests for date validation
- [ ] Test with existing job data
- [ ] Verify reactive updates work correctly

## Success Metrics
- All date operations complete without errors
- Popover animations smooth (60fps)
- Date changes persist and sync via Zero.js
- Mobile users can interact with all features
- Keyboard navigation fully functional

## Dependencies
- shadcn-svelte (new dependency)
- @melt-ui/svelte (existing)
- Zero.js reactive system (existing)
- BasePopover component (existing)
- PopoverMenu component (existing)

## Risks & Mitigations
- **Risk:** Calendar library compatibility
  - **Mitigation:** Build thin wrapper to isolate dependencies
  
- **Risk:** Date/time validation complexity
  - **Mitigation:** Centralize validation logic in helpers
  
- **Risk:** Mobile calendar interaction
  - **Mitigation:** Test early on actual devices

## Design Mockup Description
1. **Main Menu State:**
   - Clean list with consistent spacing
   - Headers styled like PopoverMenu headers
   - Date items show as menu options
   - Clear visual hierarchy

2. **Date Editor State:**
   - Toolbar matches person creation page
   - Calendar takes full width
   - Time picker simple and optional
   - Remove button clearly visible

3. **Transitions:**
   - Slide left when entering date editor
   - Slide right when returning to menu
   - Maintain popover position during transition

## Notes
- Priority editing will remain separate (different popover)
- Consider future enhancement: recurring schedules
- May want to add quick date presets (Today, Tomorrow, Next Week)
- Followup notifications could be future enhancement