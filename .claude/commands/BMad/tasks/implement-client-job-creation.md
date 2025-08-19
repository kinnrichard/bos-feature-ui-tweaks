# /implement-client-job-creation Task

When this command is used, execute the following task:

# 🎯 Implementation Specification: Client Job Creation Flow

## 📋 Overview
Implement `/clients/[id]/jobs/new` route that maximizes DRY principles by reusing the existing `/jobs/[id]` view with minimal modifications for job creation mode.

---

## 🗂️ File Structure & Implementation Plan

### 1. **NEW FILE**: `/routes/(authenticated)/clients/[id]/jobs/new/+page.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ReactiveClient } from '$lib/models/reactive-client';
  import { Job } from '$lib/models/job';
  import JobDetailView from '$lib/components/jobs/JobDetailView.svelte';
  import AppLayout from '$lib/components/layout/AppLayout.svelte';
  import LoadingSkeleton from '$lib/components/ui/LoadingSkeleton.svelte';
  import { showToast } from '$lib/stores/toast';

  // Extract client ID from URL
  const clientId = $derived($page.params.id);
  
  // Query for the client (for validation and sidebar)
  const clientQuery = $derived(clientId ? ReactiveClient.find(clientId) : null);
  const client = $derived(clientQuery?.data);
  const clientLoading = $derived(clientQuery?.isLoading ?? true);
  const clientError = $derived(clientQuery?.error);
  
  // Create mock job object for new job state
  const newJob = $derived({
    id: null, // Indicates this is a new job
    title: '',
    status: 'active',
    priority: 'medium',
    client_id: clientId,
    client: client,
    tasks: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  // Page title
  const pageTitle = $derived(
    client ? `New Job for ${client.name} - bŏs` : 'New Job - bŏs'
  );

  // Handle job title save (creation)
  async function handleJobTitleSave(newTitle: string) {
    const trimmedTitle = newTitle.trim();
    
    if (!trimmedTitle) {
      showToast('Please give this job a name', 'error');
      return Promise.reject(new Error('Job title is required'));
    }
    
    try {
      const createdJob = await Job.create({
        title: trimmedTitle,
        client_id: clientId,
        status: 'active',
        priority: 'medium'
      });
      
      // Navigate to the newly created job
      goto(`/jobs/${createdJob.id}`);
      return createdJob;
    } catch (error) {
      console.error('Failed to create job:', error);
      showToast('Failed to create job. Please try again.', 'error');
      throw error;
    }
  }

  // Handle cancel action
  function handleCancel() {
    goto(`/clients/${clientId}/jobs`);
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<AppLayout currentClient={client}>
<div class="job-detail-container">
  
  <!-- Loading State -->
  {#if clientLoading}
    <div class="job-detail-loading">
      <LoadingSkeleton type="job-detail" />
    </div>

  <!-- Client Error State -->
  {:else if clientError}
    <div class="error-state">
      <div class="error-content">
        <h2>Client not found</h2>
        <p>The specified client could not be found.</p>
        <button 
          class="button button--primary"
          onclick={() => goto('/clients')}
        >
          Back to Clients
        </button>
      </div>
    </div>

  <!-- New Job Creation Interface -->
  {:else if client}
    <JobDetailView 
      job={newJob}
      keptTasks={[]}
      batchTaskDetails={undefined}
      isNewJobMode={true}
      onJobTitleSave={handleJobTitleSave}
      onCancel={handleCancel}
    />
  {/if}
</div>
</AppLayout>

<style>
  /* Reuse existing styles from /jobs/[id]/+page.svelte */
  .job-detail-container {
    padding: 3px 24px 0 24px;
    max-width: 1200px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .job-detail-loading {
    padding: 20px 0;
  }

  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 40px 20px;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-content h2 {
    color: var(--text-primary);
    margin-bottom: 12px;
    font-size: 24px;
  }

  .error-content p {
    color: var(--text-secondary);
    margin-bottom: 16px;
    line-height: 1.5;
  }

  .button {
    padding: 12px 24px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s ease;
    background: var(--accent-blue);
    color: white;
  }

  .button:hover {
    background: var(--accent-blue-hover);
  }
</style>
```

---

### 2. **MODIFY**: `JobDetailView.svelte` - Add New Job Mode Support

**Key Changes to `JobDetailView.svelte`**:

```typescript
// Add new props for creation mode
let { 
  job, 
  keptTasks = [], 
  batchTaskDetails = null,
  isNewJobMode = false,        // NEW: Indicates creation mode
  onJobTitleSave = null,       // NEW: Custom save handler for creation
  onCancel = null              // NEW: Cancel handler for creation
}: { 
  job: PopulatedJob; 
  keptTasks?: any[];
  batchTaskDetails?: any;
  isNewJobMode?: boolean;      // NEW
  onJobTitleSave?: Function;   // NEW
  onCancel?: Function;         // NEW
} = $props();

// Handle job title save - use custom handler in new job mode
async function handleJobTitleSave(newTitle: string) {
  if (isNewJobMode && onJobTitleSave) {
    return await onJobTitleSave(newTitle);
  }
  
  // Existing logic for updating existing jobs
  try {
    const { Job } = await import('$lib/models/job');
    await Job.update(jobId, { title: newTitle });
    debugComponent('Job title updated successfully', { jobId, newTitle });
  } catch (error) {
    debugComponent.error('Job title update failed', { error, jobId, newTitle });
    throw error;
  }
}

// Determine auto-focus behavior
const shouldAutoFocus = $derived(
  isNewJobMode || isUntitledJob
);
```

**Template modifications**:
```svelte
<div class="job-detail-view">
  <EditableTitle
    value={jobTitle}
    tag="h1"
    className="job-title"
    placeholder="Untitled Job"
    autoFocus={shouldAutoFocus}
    onSave={handleJobTitleSave}
  />
  
  <!-- Tasks Section -->
  <div class="tasks-section">
    <TaskList 
      tasks={job?.tasks || []} 
      keptTasks={keptTasks} 
      jobId={job?.id} 
      {batchTaskDetails}
      isNewJobMode={isNewJobMode}
    />
  </div>
</div>
```

---

### 3. **MODIFY**: `TaskList.svelte` - Add New Job Mode Support

**Key Changes to `TaskList.svelte`**:

```typescript
// Add new job mode prop
let { 
  tasks, 
  keptTasks, 
  jobId, 
  batchTaskDetails,
  isNewJobMode = false     // NEW: Hide certain UI in creation mode
} = $props();

// Conditionally show new task row and toolbar
const showNewTaskRow = $derived(!isNewJobMode);
const showToolbar = $derived(!isNewJobMode);
const showSearch = $derived(!isNewJobMode);
```

**Template modifications**:
```svelte
<!-- Conditionally render toolbar -->
{#if showToolbar}
  <div class="toolbar">
    <!-- Existing toolbar content -->
  </div>
{:else}
  <!-- Grayed out toolbar for new job mode -->
  <div class="toolbar toolbar--disabled">
    <!-- Disabled/grayed toolbar buttons -->
  </div>
{/if}

<!-- Conditionally render search -->
{#if showSearch}
  <!-- Existing search implementation -->
{:else}
  <!-- Grayed out search box -->
  <div class="search-container search-container--disabled">
    <input 
      type="text" 
      placeholder="Search tasks..." 
      disabled 
      class="search-input search-input--disabled"
    />
  </div>
{/if}

<!-- Task list content -->
{#if tasks.length === 0}
  {#if isNewJobMode}
    <!-- NEW: New job empty state -->
    <div class="empty-state empty-state--new-job">
      <div class="empty-content">
        <h3>Creating New Job</h3>
        <p>Give your job a name to get started. You can add tasks once the job is created.</p>
        {#if onCancel}
          <button 
            class="cancel-link" 
            onclick={onCancel}
          >
            Cancel
          </button>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Existing "No tasks" empty state -->
  {/if}
{:else}
  <!-- Existing task list rendering -->
{/if}

<!-- Conditionally show new task row -->
{#if showNewTaskRow && jobId}
  <!-- Existing new task row -->
{/if}
```

---

### 4. **MODIFY**: Client Jobs Page - Update New Job Link

**Update `/clients/[id]/jobs/+page.svelte`**:

```svelte
<!-- Change the existing new job links -->
<!-- FROM: -->
<a href="/jobs/new?client_id={clientId}" class="action-button action-button--small">

<!-- TO: -->
<a href="/clients/{clientId}/jobs/new" class="action-button action-button--small">
```

---

## 🎯 UI Behavior Specifications

### **New Job Creation State Differences**:

| Element | Regular Job View | New Job Creation Mode |
|---------|------------------|----------------------|
| **Job Title** | Shows existing title | Empty, auto-focused on load |
| **Toolbar Buttons** | Functional with status | Grayed out, disabled state |
| **Search Box** | Functional | Grayed out, disabled |
| **New Task Row** | Visible if jobId exists | Hidden |
| **Empty State** | "No tasks yet" | "Creating New Job" with cancel link |
| **URL** | `/jobs/[id]` | `/clients/[id]/jobs/new` |

### **Validation Flow**:

1. **Initial Load**: Title contenteditable auto-focuses
2. **Blur Without Title**: 
   - Focus returns to title field
   - Toast appears: "Please give this job a name"
   - No navigation occurs
3. **Blur With Valid Title**:
   - Job created via `Job.create()`
   - Navigate to `/jobs/[new-job-id]`
   - Standard job view behavior applies

---

## 🔄 State Management & Data Flow

### **Job Creation Flow**:

```typescript
// 1. User navigates to /clients/[id]/jobs/new
// 2. Component validates client exists (404 if not)
// 3. Mock job object created for UI rendering
const newJob = {
  id: null,                    // Signals new job mode
  title: '',                   // Empty title
  client_id: clientId,
  client: client,
  tasks: [],                   // No tasks initially
  // ... other default values
}

// 4. User types job title and blurs
// 5. handleJobTitleSave called with validation
async function handleJobTitleSave(title: string) {
  const trimmed = title.trim();
  if (!trimmed) {
    showToast('Please give this job a name', 'error');
    throw new Error('Title required');
  }
  
  // 6. Create job via ReactiveRecord
  const job = await Job.create({
    title: trimmed,
    client_id: clientId,
    status: 'active',
    priority: 'medium'
  });
  
  // 7. Navigate to standard job view
  goto(`/jobs/${job.id}`);
}
```

---

## 🔗 Routing & Navigation

### **Route Structure**:
```
/clients/[id]/jobs/new
├── Validates client exists (404 if invalid)
├── Renders JobDetailView in creation mode
└── On successful creation → goto(`/jobs/[new-id]`)
```

### **Navigation Paths**:
```
Client Jobs Page → + Button → /clients/[id]/jobs/new
                            ↓ (after title save)
                            /jobs/[new-job-id]
                            ↓ (cancel button)
                            /clients/[id]/jobs
```

---

## 🧪 Error Handling

### **Validation Scenarios**:

| Scenario | Behavior | UI Response |
|----------|----------|-------------|
| Empty title on blur | Focus title field | Toast: "Please give this job a name" |
| Invalid client ID | 404 behavior | Standard 404 page |
| Job creation failure | Stay on creation page | Toast: "Failed to create job" |
| Navigation away | No cleanup needed | View layer handles automatically |

### **ReactiveRecord Integration**:
- Uses existing `Job.create()` method
- Automatic relationship handling for client association
- Database validation rules apply (title.strip.present?)
- Local database means no network error handling needed

---

## 📱 Responsive & Accessibility

### **Focus Management**:
- Auto-focus on job title field when page loads
- Focus trap during title editing
- Keyboard navigation preserved in disabled states

### **Visual States**:
- Disabled toolbar buttons maintain visual hierarchy
- Grayed-out states use existing CSS custom properties
- Loading states reuse existing skeleton components

---

## 🚀 Implementation Priority

### **Phase 1 - Core Implementation**:
1. Create new route file: `/clients/[id]/jobs/new/+page.svelte`
2. Add `isNewJobMode` prop to `JobDetailView.svelte`
3. Update job title save handler logic
4. Implement basic new job empty state

### **Phase 2 - UI Polish**:
1. Add disabled states to toolbar and search
2. Implement proper focus management
3. Add cancel link and navigation
4. Update client jobs page button links

### **Phase 3 - Testing & Validation**:
1. Test validation flow with toast messages
2. Verify client ID validation and 404 handling  
3. Test navigation paths and state cleanup
4. Verify ReactiveRecord integration

---

This specification maximizes DRY principles by reusing 95% of the existing job view infrastructure while cleanly handling the creation mode differences through props and conditional rendering.