# Simple Client Page Implementation

## Epic Overview
Implement a minimal client detail page that displays the client name and type (business/residential) with emoji indicator, including edit functionality and support for new client creation.

**URL Patterns:** 
- View/Edit existing: `/clients/{id}`
- Create new: `/clients/new`

**Design:** Centered display with emoji (🏢 or 🏠) followed by client name, with toolbar-based edit controls

## User Stories

### 1. Client Detail Page Component (View Mode)
**As a** user navigating to a client URL  
**I want to** see the client's name and type clearly displayed  
**So that** I can quickly identify the client

**Acceptance Criteria:**
- [ ] Page loads at `/clients/6dede385-3463-4ef7-9b1a-fa3fa9047aa1` (example)
- [ ] Client name is displayed prominently in the center of the main area
- [ ] Business clients show 🏢 emoji before the name
- [ ] Residential clients show 🏠 emoji before the name
- [ ] No emoji shown if client type is not available
- [ ] Long client names wrap to multiple lines (no truncation)
- [ ] Sidebar navigation remains visible and functional
- [ ] "Edit" button appears in toolbar, right-aligned

### 2. Edit Mode Functionality
**As a** user wanting to modify client information  
**I want to** edit the client name and type through a controlled interface  
**So that** I can update client details safely

**Acceptance Criteria:**
- [ ] Clicking "Edit" button transitions to edit mode
- [ ] H1 client name is replaced with "Edit Client" header
- [ ] Name input field appears below header with current client name
- [ ] Type segmented control appears below name input (Business | Residential)
- [ ] Current type is pre-selected in segmented control
- [ ] "Edit" button is replaced with blue "Done" button (white text, blue background)
- [ ] Red "Cancel" button appears in left side of toolbar (white text, red background)
- [ ] Clicking "Done" saves changes and returns to view mode
- [ ] Clicking "Cancel" discards changes and returns to view mode
- [ ] NO contenteditable pattern - deliberate friction for data safety

### 3. New Client Creation
**As a** user creating a new client  
**I want to** use the same interface to add client information  
**So that** I have a consistent experience

**Acceptance Criteria:**
- [ ] `/clients/new` URL shows edit mode by default
- [ ] Header shows "New Client" instead of "Edit Client"
- [ ] Name field is empty
- [ ] Type defaults to "Residential" (or no selection)
- [ ] "Done" button creates new client and redirects to `/clients/{new-id}`
- [ ] "Cancel" button redirects to `/clients`

### 4. Toolbar Button Styling
**As a** developer implementing the UI  
**I want to** create reusable toolbar button components  
**So that** we have consistent button styling

**Acceptance Criteria:**
- [ ] Create new toolbar button component with text (not just icons)
- [ ] Style inspired by existing modal dialog buttons
- [ ] Blue button: blue background, white text
- [ ] Red button: red background, white text
- [ ] Default button: standard toolbar appearance
- [ ] Buttons have appropriate hover/active states
- [ ] Buttons are properly spaced in toolbar

### 5. Data Loading and Error Handling
**As a** user accessing the client page  
**I want to** see appropriate loading and error states  
**So that** I understand the page status

**Acceptance Criteria:**
- [ ] Reuse the data container component from `/logs` page
- [ ] Show loading state while fetching client data
- [ ] Show error state if data fetch fails
- [ ] Redirect to standard 404 page if client not found
- [ ] Client name must have minimum 2 characters after stripping whitespace
- [ ] Show validation error if name is too short
- [ ] All states handled by existing data container patterns

### 6. Accessibility Implementation
**As a** user with accessibility needs  
**I want to** access and edit client information with assistive technology  
**So that** I can use the page effectively

**Acceptance Criteria:**
- [ ] Client name is marked as H1 heading in view mode
- [ ] "Edit Client"/"New Client" is H1 in edit mode
- [ ] Form inputs have proper labels
- [ ] Segmented control is keyboard navigable
- [ ] Emoji has proper ARIA label or text alternative
- [ ] Screen readers announce mode changes
- [ ] All toolbar buttons have accessible labels
- [ ] Focus management when switching modes

## Technical Implementation Notes

### Component Structure
```jsx
// View Mode
<DataContainer>
  <Toolbar>
    <ToolbarButton align="right" onClick={enterEditMode}>Edit</ToolbarButton>
  </Toolbar>
  <MainContent>
    <CenteredBlock>
      <h1>
        {client.type === 'business' && <span aria-label="Business client">🏢</span>}
        {client.type === 'residential' && <span aria-label="Residential client">🏠</span>}
        {client.name}
      </h1>
    </CenteredBlock>
  </MainContent>
</DataContainer>

// Edit Mode
<DataContainer>
  <Toolbar>
    <ToolbarButton align="left" variant="danger" onClick={cancel}>Cancel</ToolbarButton>
    <ToolbarButton align="right" variant="primary" onClick={save}>Done</ToolbarButton>
  </Toolbar>
  <MainContent>
    <CenteredBlock>
      <h1>{isNew ? 'New Client' : 'Edit Client'}</h1>
      <FormField>
        <Label>Name:</Label>
        <Input value={name} onChange={...} />
      </FormField>
      <FormField>
        <Label>Type:</Label>
        <SegmentedControl 
          options={[
            {value: 'business', label: 'Business'},
            {value: 'residential', label: 'Residential'}
          ]}
          value={type}
          onChange={...}
        />
      </FormField>
    </CenteredBlock>
  </MainContent>
</DataContainer>
```

### Styling Requirements
- Create new ToolbarButton component with text support
- Style variants: default, primary (blue), danger (red)
- Use existing form field patterns for inputs
- Center all content in main display area
- Apply existing spacing system

### State Management
```typescript
interface ClientPageState {
  mode: 'view' | 'edit' | 'new';
  client: {
    id?: string;
    name: string;
    type: 'business' | 'residential' | null;
  };
  originalClient?: ClientData; // For cancel functionality
}
```

### Data Requirements
- GET `/api/clients/{id}` - Fetch client data
- PUT `/api/clients/{id}` - Update existing client
- POST `/api/clients` - Create new client
- Required fields: `name` (string), `type` (string: 'business' | 'residential' | null)

## Definition of Done
- [ ] View mode implemented with emoji display
- [ ] Edit mode with form controls working
- [ ] New client creation flow implemented
- [ ] Toolbar buttons styled consistently
- [ ] Save/cancel functionality working correctly
- [ ] Proper validation and error handling
- [ ] Loading/error states working correctly
- [ ] 404 redirect functioning for invalid IDs
- [ ] Accessibility requirements met
- [ ] Works consistently across supported browsers
- [ ] Code reviewed and approved
- [ ] Manually tested all flows (view, edit, create)

## Priority: Medium
**Estimated Effort:** 6-8 hours (includes edit functionality and new components)

## Dependencies
- Existing data container component from /logs
- Existing application design system
- Client API endpoints (GET, PUT, POST)
- May need to create new SegmentedControl component if not existing

## Notes
- Deliberately avoiding contenteditable pattern for data safety
- Toolbar buttons with text are new to the app - ensure consistency with modal buttons
- Client name validation: minimum 2 characters after trimming whitespace
- Database works offline - no network error handling needed for saves