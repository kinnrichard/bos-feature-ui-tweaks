# EP-XXXX: People Management Feature

## Overview
Implement a comprehensive people management system within the client context, allowing users to view, add, and manage people associated with each client. This feature includes listing people alphabetically with search and filtering capabilities, showing their group affiliations when applicable, and providing an intuitive interface for adding new people with dynamic contact method entry.

## Business Value
- Enables users to manage contacts and personnel associated with each client
- Provides quick access to people's roles and departmental affiliations
- Streamlines contact information management with smart detection
- Maintains consistency with existing UI patterns for better user adoption
- Supports efficient searching and filtering for clients with many contacts

## Requirements

### 1. People Listing Page (`/clients/[id]/people`)

#### Page Structure
- **Page Title**: "People at {client.name}" - dynamically show client's name
- **Layout**: Use existing AppLayout component with toolbar integration
- **Search & Filter Bar**: Implement the same search and filter system used on `/clients` page
  - Search by name, title, and contact methods
  - Maintain consistent UI/UX with client search functionality

#### Filtering Requirements
- **Default View**: Only show active people (is_active = true)
- **Active/All Toggle**: Allow users to view inactive people when needed
- **Department Filter** (conditional):
  ```typescript
  // Only show if client has department groups
  if (client.peopleGroups.some(group => group.is_department)) {
    // Display department dropdown filter
    // Options: "All Departments" + list of department groups
  }
  ```

#### Empty States
- **No people exist**: "No people yet" with prominent "Add Person" button
- **No active people** (but inactive exist): "No active people" with hint to toggle filter
- **No search results**: "No people match your search"

#### List Display
- Sort people alphabetically by name (default)
- Each person card shows:
  ```
  [person.circle.fill.svg] {Person Name}
                           {Title}                    {Groups}*
  
  * Groups only shown if client.peopleGroups.length > 0
  ```
- **Icon**: Use existing `/icons/person.circle.fill.svg`
- **Name**: Bold, primary text color
- **Title**: Shown below name in smaller, muted text (if exists)
- **Groups** (conditional display):
  - Only show group badges if client has people groups
  - If person belongs to department groups (is_department=true), only show department groups
  - If person has no department groups, show all groups
  - Display as small, pill-shaped badges
  - Hide entire groups section if client has no people groups

#### Data Requirements
- Fetch people filtered by client_id
- Include peopleGroups relationship for group display
- Filter by is_active = true by default
- Order by name ascending
- Support search across name, title, and contact methods

### 2. Add Person Form (`/clients/[id]/people/new`)

#### Form Fields
1. **Name** (required)
   - Text input with validation
   - Validation: Stripped name (after trim()) must be at least 2 characters
   - Error message: "Name must be at least 2 characters"
   - Max length: 255 characters
   - Apply trim() before validation and saving

2. **Title** (conditional)
   - Only show for business clients (client_type === 'business')
   - Optional field even when shown
   - Placeholder: "e.g., Owner, Manager, Assistant"

3. **Contact Methods** (dynamic)
   - Start with one empty field
   - Placeholder: "Email, phone, or address"
   - Auto-detect type on blur/change:
     - Email: Validate format, lowercase
     - Phone: Format as (XXX) XXX-XXXX
     - Address: Free text
   - Add new empty field when:
     - User enters data and presses Tab
     - User enters data and presses Enter
   - Each field has remove button (except when only one exists)

#### Form Behavior
- Follow existing client form patterns for edit/save/cancel
- Use SegmentedControl for any toggle states
- Maintain consistent styling with new client form
- Show validation errors inline
- Disable save button until name validation passes

### 3. Toolbar Integration

#### Update Toolbar.svelte
- Detect when on people page: `$page.route.id === '/(authenticated)/clients/[id]/people'`
- Add "Add Person" button to pageActions when on people listing
- Button properties:
  - Label: "Add Person"
  - Icon: `/icons/plus.svg`
  - Action: Navigate to `/clients/${currentClientId}/people/new`
  - Test ID: `add-person-button`

### 4. Navigation Integration

#### Client Detail Page Updates
- Add navigation option to view people
- Consider adding to client page sidebar or as a prominent link
- Maintain context of current client

## Technical Implementation

### Models & Data Structure
```typescript
// Person model includes:
interface PersonData {
  id: string;
  name: string;
  title?: string;
  is_active: boolean;
  client_id: string;
  peopleGroups?: PeopleGroupData[];
  contactMethods?: ContactMethodData[];
  created_at: Date;
  updated_at: Date;
}

// PeopleGroup model includes:
interface PeopleGroupData {
  id: string;
  name: string;
  is_department: boolean;
  client_id: string;
}

// Validation helper
function validatePersonName(name: string): boolean {
  return name.trim().length >= 2;
}
```

### Routing Structure
```
/clients/[id]/people/+page.svelte          # List all people for client
/clients/[id]/people/new/+page.svelte      # Add new person form
/clients/[id]/people/[personId]/+page.svelte  # View/edit person (future)
```

### State Management
- Use ReactiveQuery for data fetching
- Implement proper loading and error states
- Handle empty states gracefully
- Maintain filter state in URL parameters for shareability

### Search Implementation
- Reuse search components from `/clients` page
- Index searchable fields: name, title, contact methods
- Debounce search input (300ms)
- Maintain search state across navigation

### Styling Guidelines
- Follow existing dark theme with CSS variables
- Maintain consistent spacing and typography
- Ensure responsive design for mobile devices
- Use existing UI components (FormInput, SegmentedControl, etc.)
- Match search/filter styling from clients page

## Acceptance Criteria

1. **People Listing**
   - [ ] Shows "People at {client name}" as page title
   - [ ] Default view shows only active people
   - [ ] Search functionality matches /clients implementation
   - [ ] Active/All toggle works correctly
   - [ ] Department filter appears only when client has department groups
   - [ ] Lists people alphabetically
   - [ ] Shows person icon, name, title (if exists)
   - [ ] Groups only display when client has people groups
   - [ ] Groups display logic correctly filters departments
   - [ ] Empty states show appropriate messages
   - [ ] Search works across name, title, and contact methods

2. **Add Person Form**
   - [ ] Name field is required and validates properly
   - [ ] Name validation requires minimum 2 characters after trim
   - [ ] Validation error shows inline
   - [ ] Title field only shows for business clients
   - [ ] Contact methods start with one field
   - [ ] New fields auto-add when data entered + Tab/Enter
   - [ ] Contact type auto-detection works correctly
   - [ ] Phone numbers format properly
   - [ ] Remove buttons work (except for single field)
   - [ ] Form saves successfully and redirects to people list
   - [ ] Save button disabled until validation passes

3. **Toolbar Integration**
   - [ ] "Add Person" button appears on people listing page
   - [ ] Button navigates to correct new person form
   - [ ] Button styling matches other toolbar actions

4. **Navigation**
   - [ ] Users can navigate from client detail to people list
   - [ ] Breadcrumb or back navigation maintains context
   - [ ] Filter state persists in URL parameters

## Security & Permissions
- Implement role-based access control for viewing/editing people
- Ensure users can only access people for clients they have permission to view
- Log all create/update/delete operations for audit trail
- Sanitize all user input before saving

## Performance Considerations
- Implement pagination for clients with >50 people
- Lazy load contact methods and groups data
- Index database columns used for search
- Cache department group lists for filtering

## Future Enhancements
- Edit existing person details
- Bulk operations (activate/deactivate multiple people)
- Advanced search with filters by group, contact type
- Export people list (CSV, Excel)
- Import people from CSV/contacts
- Group management interface
- Person detail page with activity history
- Duplicate person detection and merging
- Primary contact designation
- Contact method preferences
- Relationship types between people

## Dependencies
- Existing Person, ContactMethod, and PeopleGroup models
- Current UI component library
- Search/filter components from /clients page
- Reactive query system
- Existing routing patterns

## Testing Requirements
- Unit tests for name validation logic
- Unit tests for group display conditional logic
- Unit tests for department filter visibility
- Integration tests for search functionality
- Integration tests for contact method auto-detection
- E2E tests for full add person flow with validation
- E2E tests for filtering and search combinations
- Accessibility testing for screen readers
- Mobile responsive testing for search/filter UI

## Design Mockups
[To be added - following existing Faultless design patterns]

## Timeline Estimate
- People listing page with search/filter: 6-8 hours
- Conditional group/department display: 2-3 hours
- Add person form with validation: 6-8 hours
- Toolbar and navigation integration: 2-3 hours
- Testing and refinements: 4-5 hours
- Total: 20-27 hours