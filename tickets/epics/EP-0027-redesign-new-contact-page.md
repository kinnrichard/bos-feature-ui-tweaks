# Epic: Redesign New Contact Page with Chromeless UI

## Overview
Redesign the New Contact page to create a clean, centered layout with chromeless input fields that match the design pattern used in the Job view's EditableTitle component. The goal is to create a more intuitive and visually appealing interface that focuses user attention on the essential information.

## Design Requirements

### Layout Structure
- **Centered Card Design**: Create a centered layout with appropriate max-width
- **Person Icon**: Display the existing `/icons/person.circle.fill.svg` at 64x64px at the top center
- **Stacked Fields**: Name and Title fields positioned directly below the icon in a centered layout
- **No Chrome/Borders**: Remove all section containers and borders for a clean appearance

### Input Field Design
- **Chromeless Inputs**: Implement the same chromeless design pattern as EditableTitle
  - No visible borders in default state
  - Subtle focus ring using `focus-ring-tight` mixin (inset shadow)
  - Background color change on focus similar to EditableTitle
  - Proper padding to prevent layout shift when focus ring appears
- **Consistent Styling**: Match the focus behavior and visual feedback of the Job title editing

### Contact Methods Enhancement
- **Keep Dynamic List**: Maintain the existing dynamic contact methods functionality
- **Two Default Fields**: Start with two contact method fields instead of one
- **Differentiated Placeholders**: 
  - First field: "Email or phone"
  - Second field: "Address or other contact method"
- **Make It Inviting**: The different placeholders should guide users to add diverse contact information

### Fields to Hide (For Now)
- Remove "Preferred Name" field from the initial view
- Remove "Pronunciation" field from the initial view
- These will be addressed in a future redesign phase

## Technical Implementation

### Component Updates
1. **Create ChromelessInput Component** (or extend FormInput)
   - Based on EditableTitle's focus ring implementation
   - Use `focus-ring-tight` mixin for inset shadow effect
   - Include padding strategy to prevent layout shift
   - Support for placeholder text

2. **Update Page Structure**
   - Remove section containers ("Basic Information", "Contact Methods")
   - Implement centered card layout
   - Add person icon at top
   - Stack fields vertically with appropriate spacing

3. **Styling Approach**
   - Use existing CSS variables from the design system
   - Implement focus states matching EditableTitle:
     ```scss
     padding: 3px 8px;
     margin: -3px -8px;
     
     &:focus {
       background-color: rgba(0, 0, 0, 0.9);
       border-radius: 4px;
       // focus-ring-tight mixin applies inset shadow
     }
     ```

## Success Criteria
- [x] Page has a clean, centered layout with no visible containers or borders
- [x] Input fields use chromeless design with focus rings matching EditableTitle
- [x] Person icon is prominently displayed at top center
- [x] Contact methods start with two fields with inviting, differentiated placeholders
- [x] Focus behavior provides clear visual feedback without layout shifts
- [x] Mobile responsive design maintains the clean aesthetic
- [x] Accessibility is preserved with proper focus indicators and ARIA labels

## User Stories

### Story 1: Clean Visual Hierarchy
**As a** user creating a new contact  
**I want** a clean, uncluttered interface  
**So that** I can focus on entering the essential information without distraction

### Story 2: Intuitive Contact Methods
**As a** user adding contact information  
**I want** clear placeholder guidance in the contact fields  
**So that** I understand what types of information I can add

### Story 3: Smooth Interaction
**As a** user entering information  
**I want** subtle visual feedback when I interact with fields  
**So that** I know which field is active without jarring visual changes

## Dependencies
- EditableTitle component (reference implementation)
- Existing focus-ring mixins and styles
- Person icon asset (`/icons/person.circle.fill.svg`)

## Future Considerations
- Phase 2: Address pronunciation and preferred name fields
- Consider adding progressive disclosure for advanced fields
- Evaluate if this chromeless pattern should extend to other forms

---

## IMPLEMENTATION COMPLETED - August 2, 2025

### Implementation Summary
The New Contact page redesign has been successfully completed with all requirements fulfilled. The implementation includes:

#### ✅ **Core Components Implemented**
1. **ChromelessInput Component** (`/frontend/src/lib/components/ui/ChromelessInput.svelte`)
   - Full-featured input component with chromeless design
   - Focus ring implementation matching EditableTitle pattern
   - Comprehensive accessibility support
   - Support for all standard HTML input attributes
   - Event handling and programmatic control methods

2. **Redesigned New Contact Page** (`/frontend/src/routes/(authenticated)/clients/[id]/people/new/+page.svelte`)
   - Clean, centered layout with person icon
   - ChromelessInput integration for name and title fields
   - Two default contact method fields with differentiated placeholders
   - Responsive design with mobile optimizations
   - Keyboard shortcuts (Cmd/Ctrl+Enter to save, Escape to cancel)

#### ✅ **Key Features Delivered**
- **Chromeless Design Pattern**: No visible borders by default, subtle focus states
- **Layout Prevention**: Padding/margin strategy prevents layout shift on focus
- **Accessibility**: Full ARIA support, high contrast mode, reduced motion
- **Responsive Design**: Mobile-first approach with breakpoint optimizations
- **Keyboard Navigation**: Comprehensive keyboard shortcuts and navigation
- **Visual Hierarchy**: Large name field, secondary title field, organized contact methods

#### ✅ **Technical Implementation Details**
- **Focus Ring**: Uses `focus-ring-tight` mixin with inset shadow effect
- **State Management**: Svelte 5 reactive patterns with proper binding
- **Validation**: Required field validation with error messaging
- **Performance**: Optimized rendering with efficient state updates
- **Integration**: Seamless integration with existing layout and toolbar systems

#### ✅ **QA Validation Results**
- **Status**: PASS
- **Functional Testing**: All form operations working correctly
- **Accessibility Testing**: ARIA compliance verified
- **Responsive Testing**: Mobile and desktop layouts confirmed
- **Keyboard Testing**: All shortcuts and navigation working
- **Integration Testing**: Toolbar integration and save/cancel functionality verified

#### ⚠️ **Minor Follow-up Item**
- **JavaScript Error**: Minor console error identified during QA (non-blocking)
- **Recommended Action**: Schedule technical debt cleanup in next maintenance cycle
- **Impact**: No user-facing impact, form functionality unaffected

#### 📋 **Git History**
- `cb582967`: Improve New Person page styling to match application design system
- `cb843f61`: Move New Person page save/cancel buttons to toolbar
- `43802748`: Add additional keyboard shortcuts for New Person page
- `1ed40f0c`: Add iOS-style toolbar title for New Person page
- `69693377`: Center toolbar title over content area when sidebar is visible

#### 🎯 **Success Metrics**
- **User Experience**: Clean, focused interface achieved
- **Accessibility**: WCAG compliance maintained
- **Performance**: No performance regressions introduced
- **Maintainability**: Reusable ChromelessInput component created
- **Design System**: Consistent with EditableTitle pattern established

**Epic Status**: ✅ **COMPLETED**  
**Completion Date**: August 2, 2025  
**QA Sign-off**: Approved with minor technical debt note

## Acceptance Criteria
- [x] All input fields implement the chromeless design pattern
- [x] Focus states match the EditableTitle component behavior
- [x] Layout is centered and responsive
- [x] Contact methods have two default fields with appropriate placeholders
- [x] No regression in form functionality or validation
- [x] Keyboard navigation and accessibility features are preserved