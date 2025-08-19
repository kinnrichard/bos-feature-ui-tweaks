---
issue_id: ISS-0012
title: Implement Homepage with Faultless Search
description: Create a homepage for logged-in users with centered search input for finding clients
status: completed
priority: high
assignee: unassigned
created_date: 2025-07-20T00:00:00.000Z
updated_date: 2025-07-21T18:35:00.000Z
estimated_hours: 8
actual_hours: 8
tags:
  - frontend
  - ui
  - search
  - homepage
epic_id: null
sprint: null
completion_percentage: 100
---

# ISS-0012: Implement Homepage with Faultless Search

## Description
Create a homepage for logged-in users at the root path (`/`) that features a centered search input for finding clients. The homepage will replace the current redirect to `/jobs` and serve as the central navigation point for the application.

## Requirements

### Functional Requirements
1. **Route Configuration**
   - Use `/` as the homepage route
   - Replace current redirect from `/` to `/jobs`
   - Maintain authentication wrapper

2. **Search Functionality**
   - Centered search input with placeholder text "Search"
   - NO Real-time search; wait for the user to press Return. This is for privacy reasons in case the user has someone looking over their shoulder.
   - Despite no real-time search, use ReactiveQuery to preload all Clients, so that way our client app can filter without delay once the user presses Return
   - Search by client name
   - After pressing Return, navigate to a results page with search input at top

3. **Design Requirements**
   - Minimal, clean design following existing dark theme
   - Hero-style search: large, prominent centered search input
   - Search input includes a rounded blue "Search" button with white text, right-aligned inside the search box
   - Button styling should match the default button in modal dialog boxes
   - Use existing UI components and styles for consistency
   - Follow established design patterns from job listing pages

4. **Navigation**
   - No new sidebar navigation item required to go to home page; use the existing logo
   - When on the homepage, sidebar shows "Clients" and "Jobs" as clickable links
   - Users click logo to return to homepage
   - Homepage serves as central hub for application navigation

5. **Search Results Page**
   - Search input remains at the top of the results page
   - Results displayed as list items showing client name only
   - Show all matching results (no pagination)
   - Below the last result, include a "New Client" item inline with search results
   - Empty state shows only the "New Client" item
   - No recent searches or suggested searches
   - No additional hints or feedback beyond the Search button

### Technical Requirements
1. **Component Structure**
   - Create new homepage component at `frontend/src/routes/(authenticated)/+page.svelte`
   - Implement proper component hierarchy and separation of concerns

2. **State Management**
   - Handle search state and results
   - Integrate with existing client data stores if available
   - Implement debounced search for performance

3. **API Integration**
   - Implement client search API endpoint if not existing
   - Handle loading, error, and empty states
   - Optimize search queries for performance

## Implementation Details

### File Structure
```
frontend/src/routes/(authenticated)/
├── +page.svelte          # Homepage component with hero search
├── +page.ts             # Page load function (if needed)
├── search/
│   ├── +page.svelte     # Search results page
│   └── +page.ts         # Search results data loading
└── components/
    └── ClientSearch.svelte  # Reusable search component
```

### Key Components
1. **Homepage Layout**
   - Hero-style centered search container
   - Large, prominent search input field
   - Rounded blue "Search" button with white text inside the input
   - Responsive design (mobile adaptation for future iteration)
   - Proper spacing and visual hierarchy

2. **Search Component**
   - Input field with placeholder "Search"
   - Blue "Search" button right-aligned within input
   - Form submission on Enter key or button click
   - Navigation to `/search` with query parameter

3. **Search Results Page**
   - Search input at top (reusing search component)
   - List view of matching clients (name only)
   - "New Client" item at bottom of results list
   - Empty state shows only "New Client" item

4. **Integration Points**
   - Update root route handler
   - Ensure authentication guards remain in place
   - Connect to client data API
   - Implement client filtering logic

## Acceptance Criteria
- [ ] Root path `/` displays homepage instead of redirecting to `/jobs`
- [ ] Hero-style search input is centered with "Search" placeholder
- [ ] Search input includes rounded blue "Search" button with white text
- [ ] Search requires pressing Return or clicking Search button (no real-time search)
- [ ] Search navigates to `/search` results page with query
- [ ] Search results page shows search input at top
- [ ] Results display as list items with client name only
- [ ] "New Client" item appears at bottom of results list
- [ ] Empty search shows only "New Client" item
- [ ] Sidebar shows "Clients" and "Jobs" as clickable links on homepage
- [ ] Design follows existing dark theme and component patterns
- [ ] Logo click navigates back to homepage
- [ ] Authentication wrapper is maintained
- [ ] ReactiveQuery preloads all clients for instant filtering
- [ ] Component follows existing code patterns and conventions

## Related Work
- Future task: Implement `/clients` and `/jobs` listing pages
- Consider reusable search component for other entities

## Technical Notes
- Use SvelteKit's routing system for homepage implementation
- Leverage existing UI components from job listing pages
- Consider using existing search patterns if available in codebase
- Ensure proper TypeScript types for client data

## Dependencies
- Existing authentication system
- Client data API or endpoint
- UI component library and theme system