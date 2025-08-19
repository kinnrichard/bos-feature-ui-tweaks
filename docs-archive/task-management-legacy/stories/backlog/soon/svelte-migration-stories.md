# Svelte Migration User Stories

## Overview
This document breaks down the Svelte migration into implementable user stories, organized by sprint.

## Story Point Scale
- **1 point**: ~4 hours
- **2 points**: ~1 day  
- **3 points**: ~2-3 days
- **5 points**: ~1 week
- **8 points**: ~1.5 weeks

---
## ✅ COMPLETED STORIES (Sprint 1 - Foundation)

### SVELTE-001: Rails API Configuration - ✅ COMPLETED
**Status**: COMPLETED  
**Implementation**: Full JSON API with `/api/v1` namespace, proper error handling, CORS configuration, and health check endpoint.

### SVELTE-002: Secure JWT Authentication System - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: JWT authentication with httpOnly cookies, proper auth endpoints, CSRF protection, and frontend auth service.

### SVELTE-003: Svelte Project Setup - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: Complete SvelteKit project with TypeScript, Tailwind CSS, ESLint, Prettier, and Playwright testing.

### SVELTE-004: API Client with Auth - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: Robust API client with automatic auth handling, request/response interceptors, and proper error handling.

### SVELTE-005: Job List View - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: Job list view with proper loading states, error handling, and responsive design.

### SVELTE-006: Job Detail View - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: Job detail view with task display, client information, and proper error handling.

### SVELTE-007: Drag & Drop Task Reordering - ✅ COMPLETED  
**Status**: COMPLETED  
**Implementation**: Native drag & drop with API integration, optimistic updates, and touch support.

---

## 🚧 IN PROGRESS STORIES

### First sprint that's unfinished

### SVELTE-UX-001: Loading States & Skeleton Screens
**Points**: 2  
**Type**: UI/UX  
**Priority**: High  
**Depends on**: SVELTE-005

**As a** user  
**I want** clear loading feedback  
**So that** I understand the app is working

**Acceptance Criteria:**
- [ ] Skeleton screens for all major components
- [ ] Loading indicators for async operations
- [ ] Progress bars for long operations
- [ ] Optimistic UI updates
- [ ] Loading state management with stores
- [ ] Prevent layout shift during loading
- [ ] Accessibility: proper ARIA states

**Implementation Pattern:**
```svelte
<!-- lib/components/LoadingBoundary.svelte -->
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import type { ComponentType } from 'svelte';
  
  export let query: ReturnType<typeof createQuery>;
  export let skeleton: ComponentType | undefined = undefined;
</script>

{#if $query.isLoading}
  {#if skeleton}
    <svelte:component this={skeleton} />
  {:else}
    <div class="animate-pulse">
      <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div class="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  {/if}
{:else if $query.error}
  <div role="alert" class="error-state">
    <p>Failed to load data</p>
    <button on:click={() => $query.refetch()}>
      Try again
    </button>
  </div>
{:else}
  <slot data={$query.data} />
{/if}

<!-- Usage -->
<LoadingBoundary {query} skeleton={JobCardSkeleton}>
  {#snippet children({ data })}
    <JobCard job={data} />
  {/snippet}
</LoadingBoundary>
```

---

### SVELTE-UX-002: Error Boundaries & Recovery
**Points**: 3  
**Type**: UI/UX  
**Priority**: High  
**Depends on**: SVELTE-003

**As a** user  
**I want** graceful error handling  
**So that** I can recover from problems without losing work

**Acceptance Criteria:**
- [ ] Global error boundary at app level
- [ ] Component-level error boundaries
- [ ] User-friendly error messages
- [ ] Retry mechanisms for failed operations
- [ ] Error logging to backend
- [ ] Offline vs online error differentiation
- [ ] Form validation with field-level errors
- [ ] Toast notifications for transient errors

**Error Boundary Implementation:**
```svelte
<!-- routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  $: error = $page.error;
  $: isOffline = !navigator.onLine;
</script>

<div class="error-page">
  <h1>
    {#if error?.code === 404}
      We couldn’t find that page
    {:else if isOffline}
      You’re not connected to the Internet
    {:else}
      Something went wrong
    {/if}
  </h1>
  
  <p class="error-message">
    {error?.message || 'An unexpected error occurred'}
  </p>
  
  <div class="error-actions">
    {#if isOffline}
      <button on:click={() => window.location.reload()}>
        Try Again
      </button>
    {:else}
      <button on:click={() => goto('/')}>
        Go Home
      </button>
      <button on:click={() => window.location.reload()}>
        Try Again
      </button>
    {/if}
  </div>
  
  {#if import.meta.env.DEV}
    <details class="error-stack">
      <summary>Technical Details</summary>
      <pre>{error?.stack}</pre>
    </details>
  {/if}
</div>

<!-- Component Error Boundary -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  
  const error = writable<Error | null>(null);
  
  onMount(() => {
    window.addEventListener('error', (event) => {
      error.set(new Error(event.message));
      event.preventDefault();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      error.set(new Error(event.reason));
      event.preventDefault();
    });
  });
</script>
```

---

### SVELTE-009: Responsive Dropdown Menus
**Points**: 5  
**Type**: UI Enhancement  
**Priority**: Medium  

**As a** user  
**I want** device-appropriate dropdown menus  
**So that** the interface feels native to Apple platforms

**Acceptance Criteria:**
- [ ] Desktop and Tablet (>= 768px): macOS-style popup menus with selected item positioning
- [ ] Mobile (< 768px): Native select elements for better UX
- [ ] Smooth transitions between breakpoints
- [ ] Keyboard navigation on desktop (arrow keys, Enter, Escape)
- [ ] Touch-optimized tap targets on tablet (min 44px)
- [ ] Focus trap for accessibility
- [ ] ARIA labels and roles
- [ ] Preserve selection state across responsive changes

**Implementation Pattern:**
```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { mediaQuery } from '$lib/stores/media';
  
  const isDesktop = mediaQuery('(min-width: 1024px)');
  const isTablet = mediaQuery('(min-width: 768px) and (max-width: 1023px)');
  
  export let options: SelectOption[];
  export let value: string;
  export let label: string;
</script>

{#if $isDesktop}
  <PopupMenu {options} bind:value {label} />
{:else if $isTablet}
  <ActionSheet {options} bind:value {label} />
{:else}
  <div class="native-select">
    <label for={label} class="sr-only">{label}</label>
    <select id={label} bind:value class="form-select">
      {#each options as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>
{/if}
```

**Desktop Styles:**
```css
/* macOS-style popup */
.popup-menu {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  position: fixed; /* Avoid scrollable container issues */
}

/* Tablet action sheet */
.action-sheet {
  background: white;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}
```

---

## Sprint 3: Offline Support (24 points)

### SVELTE-010: Service Worker Setup
**Points**: 3  
**Type**: Technical  
**Priority**: High  

**As a** developer  
**I want** to implement a service worker  
**So that** the app works offline

**Acceptance Criteria:**
- [ ] Service worker registration
- [ ] Cache app shell on install
- [ ] Cache static assets
- [ ] Skip waiting on update
- [ ] Update notification to users

---

### SVELTE-011: Offline Read Capability with Error Recovery
**Points**: 5  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-010  

**As a** field technician  
**I want** to reliably access jobs offline with corruption protection  
**So that** I can work without internet and recover from data issues

**Acceptance Criteria:**
- [ ] IndexedDB schema with version tracking
- [ ] Corruption detection on database open
- [ ] Force-online recovery mode for corrupted data
- [ ] Storage quota monitoring (no artificial limits)
- [ ] Persistent storage request for iOS Safari
- [ ] API responses cached with ETags
- [ ] Cache invalidation strategy
- [ ] Offline indicator with connectivity quality
- [ ] Data freshness timestamps
- [ ] Automatic cleanup of stale data (>30 days)

**Error Recovery Implementation:**
```typescript
class OfflineStorage {
  private db: Dexie;
  private readonly DB_VERSION = 1;
  
  async initialize() {
    try {
      this.db = new Dexie('bos_offline');
      this.db.version(this.DB_VERSION).stores({
        jobs: 'id, updated_at, synced_at',
        tasks: 'id, job_id, updated_at',
        sync_meta: 'key, value'
      });
      
      await this.db.open();
      await this.validateIntegrity();
    } catch (error) {
      if (this.isCorruption(error)) {
        await this.handleCorruption();
      }
      throw error;
    }
  }
  
  private async handleCorruption() {
    // Block app usage until online
    const modal = await showBlockingModal({
      title: 'Offline Data Corrupted',
      message: 'Your offline data needs to be restored. Please connect to the internet.',
      showWhenOnline: ['Restore Data'],
      cannotDismiss: true
    });
    
    await modal.waitForOnline();
    await this.resetAndResync();
  }
  
  private async monitorQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      const percentUsed = (usage! / quota!) * 100;
      
      if (percentUsed > 90) {
        await this.cleanupOldData();
      }
    }
  }
}
```

---

### SVELTE-012: Offline Write Queue with Field-Level Sync
**Points**: 8  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-011  

**As a** field technician  
**I want** changes saved while offline with intelligent conflict resolution  
**So that** no critical data is lost when multiple technicians work on the same job

**Acceptance Criteria:**
- [ ] Queue individual field changes in IndexedDB with operation history
- [ ] Track changes at field level, not entity level
- [ ] Support GUID-based entity IDs throughout the sync system
- [ ] Visual indicator showing number of queued changes per entity
- [ ] Three-way merge using common ancestor when syncing
- [ ] Field-specific conflict resolution strategies:
  - Status fields: priority-based (in_progress > completed > scheduled)
  - Notes: append both with attribution timestamps
  - Boolean tasks: OR merge (any true wins)
  - Arrays (parts_used, technicians): union without duplicates
  - Numeric fields: configurable (max, sum, or manual)
- [ ] Conflict resolution UI for manual review when needed
- [ ] Background sync with exponential backoff on failure
- [ ] Success/failure notifications with conflict summary
- [ ] Manual sync button with progress indicator
- [ ] Maintain sync history for debugging/audit trail

**Technical Requirements:**
```typescript
interface SyncOperation {
  id: string;  // GUID
  entityId: string;  // GUID of job/task/etc
  entityType: 'job' | 'task' | 'technician_note';
  timestamp: number;
  userId: string;  // GUID
  deviceId: string;
  operation: 'set' | 'append' | 'delete' | 'array_add' | 'array_remove';
  fieldPath: string[];  // e.g., ['tasks', taskGuid, 'completed']
  previousValue: any;  // For undo/conflict detection
  newValue: any;
  baseVersion: string;  // ETag or version GUID
}

interface ConflictResolution {
  strategy: 'auto' | 'manual';
  rule: 'priority' | 'append' | 'union' | 'max' | 'sum';
  requiresNotification: boolean;
}
```

**API Endpoints:**
- `POST /api/v1/sync/operations` - Submit operation batch
- `GET /api/v1/sync/conflicts/:entityId` - Get unresolved conflicts
- `POST /api/v1/sync/conflicts/:entityId/resolve` - Submit manual resolution

**Example Sync Payload:**
```json
{
  "operations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "entityId": "job-550e8400-e29b-41d4-a716-446655440000",
      "entityType": "job",
      "operation": "set",
      "fieldPath": ["status"],
      "previousValue": "scheduled",
      "newValue": "in_progress",
      "timestamp": 1234567890,
      "baseVersion": "etag-abc123"
    }
  ],
  "deviceId": "device-550e8400-e29b-41d4-a716-446655440002",
  "userId": "user-550e8400-e29b-41d4-a716-446655440003"
}
```

---

### SVELTE-013: PWA Manifest & Install
**Points**: 2  
**Type**: Feature  
**Priority**: Medium  
**Depends on**: SVELTE-010  

**As a** user  
**I want** to install the app on my device  
**So that** it feels like a native application

**Acceptance Criteria:**
- [ ] Web app manifest with icons
- [ ] Install prompt on supported browsers
- [ ] Splash screen configuration
- [ ] Status bar styling
- [ ] Orientation lock to portrait

---

### SVELTE-013A: Conflict Resolution UI
**Points**: 3  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-012  

**As a** technician  
**I want** a clear interface to resolve sync conflicts  
**So that** I can make informed decisions about conflicting changes

**Acceptance Criteria:**
- [ ] Modal/drawer UI that shows conflicts side-by-side
- [ ] Display field name, both values, timestamps, and who made each change
- [ ] Preview of what the merged result will look like
- [ ] Options to: accept theirs, accept mine, or manually edit
- [ ] Bulk actions for multiple conflicts of same type
- [ ] Explanation of why conflict occurred
- [ ] Ability to view full entity context while resolving
- [ ] Save resolution preferences for future (e.g., "always take mine for notes")
- [ ] Logging of all sync conflicts to the server so we can consider different architecture in the future and reduce sync errors.

**UI Example:**
```
┌─────────────────────────────────────────┐
│ Sync Conflict: Job #550e8400...0000     │
├─────────────────────────────────────────┤
│ Status Field:                           │
│ ┌─────────────┐  ┌─────────────┐       │
│ │ Your Change │  │Their Change │       │
│ │ in_progress │  │ completed   │       │
│ │ 10:30 AM    │  │ 10:45 AM    │       │
│ └─────────────┘  └─────────────┘       │
│                                         │
│ ⚠️ Keeping "in_progress" - safety rule  │
│                                         │
│ Notes Field:                            │
│ [✓] Append both (recommended)           │
│ [ ] Keep mine only                      │
│ [ ] Keep theirs only                    │
├─────────────────────────────────────────┤
│ [Review All] [Accept Recommendations]   │
└─────────────────────────────────────────┘
```

---

### SVELTE-013B: iOS Safari PWA Compatibility
**Points**: 3  
**Type**: Technical  
**Priority**: High  
**Depends on**: SVELTE-010, SVELTE-011

**As a** iPad user  
**I want** the PWA to work reliably on iOS Safari  
**So that** I can use the app offline without issues

**Acceptance Criteria:**
- [ ] Service Worker keep-alive mechanism for iOS
- [ ] Detect and handle iOS storage eviction
- [ ] Request persistent storage on iOS
- [ ] Handle iOS-specific IndexedDB quirks
- [ ] Background sync fallback for iOS
- [ ] Home screen installation prompt
- [ ] iOS-specific viewport and status bar handling
- [ ] Handle iOS audio/video autoplay restrictions
- [ ] Test on iOS 17+ Safari

**iOS-Specific Implementation:**
```typescript
// service-worker.ts
class IOSCompatibleServiceWorker {
  private keepAliveInterval?: number;
  
  constructor() {
    if (this.isIOS()) {
      // iOS kills service workers after ~30 seconds
      this.startKeepAlive();
      this.setupIOSHandlers();
    }
  }
  
  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }
  
  private startKeepAlive() {
    // Ping every 20 seconds to prevent iOS from killing SW
    this.keepAliveInterval = setInterval(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'keepalive' });
        });
      });
    }, 20000);
  }
  
  private setupIOSHandlers() {
    // iOS-specific background sync fallback
    self.addEventListener('message', event => {
      if (event.data.type === 'sync-on-visibility') {
        this.performSync();
      }
    });
  }
}

// Client-side iOS handling
class IOSPWAHandler {
  async requestPersistentStorage() {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const isPersisted = await navigator.storage.persist();
      
      if (!isPersisted && this.isIOS()) {
        // Show iOS-specific instructions
        this.showAddToHomeScreenPrompt();
      }
    }
  }
  
  private showAddToHomeScreenPrompt() {
    if (!window.matchMedia('(display-mode: standalone)').matches) {
      showModal({
        title: 'Install for Offline Access',
        content: `
          <p>For reliable offline access on your iPad:</p>
          <ol>
            <li>Tap the Share button <img src="/icons/ios-share.svg" alt="share"></li>
            <li>Select "Add to Home Screen"</li>
            <li>Tap "Add"</li>
          </ol>
        `,
        image: '/images/ios-install-guide.png'
      });
    }
  }
}
```

---

### SVELTE-014: Data Sync Optimization with Intermittent Connectivity
**Points**: 5  
**Type**: Technical  
**Priority**: Medium  
**Depends on**: SVELTE-012  

**As a** technician  
**I want** efficient sync that handles poor connectivity  
**So that** the app remains usable in areas with spotty coverage

**Acceptance Criteria:**
- [ ] Connectivity quality monitoring (latency-based)
- [ ] Adaptive sync strategies based on connection speed
- [ ] Incremental sync with resumable uploads
- [ ] Compression for payloads over 1MB
- [ ] Retry with exponential backoff (max 5 attempts)
- [ ] Sync progress with pause/resume capability
- [ ] Reduced data mode for slow connections
- [ ] Priority queue for critical updates
- [ ] Batch operations to reduce requests

**Connectivity Handling:**
```typescript
// lib/services/connectivity-monitor.ts
export class ConnectivityMonitor {
  private status = writable<ConnectionStatus>('online');
  private latencyThreshold = { slow: 2000, very_slow: 5000 };
  
  async checkQuality(): Promise<ConnectionQuality> {
    const start = performance.now();
    try {
      const response = await fetch('/api/v1/ping', {
        signal: AbortSignal.timeout(10000)
      });
      const latency = performance.now() - start;
      
      if (latency > this.latencyThreshold.very_slow) {
        return 'very_slow';
      } else if (latency > this.latencyThreshold.slow) {
        return 'slow';
      }
      return 'good';
    } catch {
      return 'offline';
    }
  }
  
  enableReducedDataMode() {
    // Configure svelte-query for minimal refetching
    queryClient.setDefaultOptions({
      queries: {
        staleTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    });
    
    // Tell API to send minimal data
    apiClient.setDefaultHeaders({
      'X-Reduced-Data-Mode': 'true'
    });
  }
}

// Rails API optimization
class Api::V1::JobsController < Api::V1::BaseController
  def index
    jobs = current_user.jobs.active
    
    if reduced_data_mode?
      # Send only essential fields
      render json: jobs, 
             each_serializer: JobSummarySerializer,
             fields: { job: [:id, :title, :status, :updated_at] }
    else
      render json: jobs, include: ['tasks', 'client', 'technicians']
    end
  end
  
  private
  
  def reduced_data_mode?
    request.headers['X-Reduced-Data-Mode'] == 'true'
  end
end
```

---

## Sprint 4: Polish & Migration (18 points)

### SVELTE-015: Performance Optimization with Lazy Loading
**Points**: 3  
**Type**: Technical  
**Priority**: Medium  

**As a** user  
**I want** fast initial load and responsive interactions  
**So that** the app feels instant even on slower connections

**Acceptance Criteria:**
- [ ] Code splitting by route using SvelteKit
- [ ] Lazy load heavy components (charts, maps, etc.)
- [ ] Image optimization with next-gen formats (WebP, AVIF)
- [ ] Preload critical routes on hover/tap
- [ ] Virtual scrolling for long lists
- [ ] Web font optimization with font-display
- [ ] Service worker precaching strategy
- [ ] Lighthouse score > 90 on all metrics
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1

**Implementation Examples:**
```typescript
// routes/+layout.ts - Preload on hover
export const load = async () => {
  return {
    prefetch: 'hover' // Preload routes on hover
  };
};

// Lazy load heavy components
<script lang="ts">
  import { onMount } from 'svelte';
  
  let ChartComponent: any;
  
  onMount(async () => {
    // Only load chart library when needed
    const module = await import('$lib/components/heavy/Chart.svelte');
    ChartComponent = module.default;
  });
</script>

{#if ChartComponent}
  <svelte:component this={ChartComponent} {data} />
{:else}
  <div class="chart-skeleton" aria-busy="true">
    Loading chart...
  </div>
{/if}

// Virtual scrolling for lists
import VirtualList from '@tanstack/svelte-virtual';

<VirtualList
  height={600}
  itemCount={jobs.length}
  itemSize={80}
  overscan={5}
>
  {#snippet children({ index, style })}
    <div {style}>
      <JobCard job={jobs[index]} />
    </div>
  {/snippet}
</VirtualList>
```

---

### SVELTE-TEST-001: Component Testing Setup
**Points**: 2  
**Type**: Testing  
**Priority**: High  
**Depends on**: SVELTE-003

**As a** developer  
**I want** component-level testing infrastructure  
**So that** I can test UI components in isolation

**Acceptance Criteria:**
- [ ] Configure Vitest with Svelte support
- [ ] Set up @testing-library/svelte
- [ ] Create test utilities for common patterns
- [ ] Mock Svelte stores and context
- [ ] Configure coverage reporting (min 80%)
- [ ] Add component test examples
- [ ] Set up visual regression testing with Playwright

**Test Example:**
```typescript
// lib/components/JobCard.test.ts
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { vi } from 'vitest';
import JobCard from './JobCard.svelte';
import { jobsStore } from '$lib/stores/jobs';
import { createMockJob } from '$lib/test-utils';

describe('JobCard', () => {
  it('updates optimistically on status change', async () => {
    const job = createMockJob({ status: 'scheduled' });
    const { getByRole, getByText } = render(JobCard, {
      props: { job }
    });
    
    // Mock failed API call
    const updateSpy = vi.spyOn(api, 'updateJob')
      .mockRejectedValueOnce(new Error('Network error'));
    
    // Change status
    const statusButton = getByRole('button', { name: /status/i });
    await fireEvent.click(statusButton);
    await fireEvent.click(getByText('In Progress'));
    
    // Verify optimistic update
    expect(getByText('In Progress')).toBeInTheDocument();
    
    // Wait for rollback
    await waitFor(() => {
      expect(getByText('Scheduled')).toBeInTheDocument();
    });
    
    expect(updateSpy).toHaveBeenCalledWith(job.id, {
      status: 'in_progress'
    });
  });
});
```

---

### SVELTE-TEST-002: API Contract Testing
**Points**: 3  
**Type**: Testing  
**Priority**: High  
**Depends on**: SVELTE-001, SVELTE-004

**As a** developer  
**I want** API contract tests between frontend and backend  
**So that** we catch breaking changes early

**Acceptance Criteria:**
- [ ] Set up contract testing framework (Pact or similar)
- [ ] Define contracts for all API endpoints
- [ ] Generate TypeScript types from contracts
- [ ] Validate request/response schemas
- [ ] Test error scenarios and edge cases
- [ ] Integrate with CI pipeline
- [ ] Document contract testing workflow

**Contract Example:**
```ruby
# spec/contracts/jobs_api_spec.rb
RSpec.describe "Jobs API Contract" do
  include_context "api contract test"
  
  describe "GET /api/v1/jobs" do
    it "returns paginated jobs" do
      get "/api/v1/jobs", headers: auth_headers
      
      expect(response).to match_json_schema("jobs/index")
      expect(json_response).to include(
        "data" => array_including(
          hash_including(
            "id" => match(/^job-[0-9a-f-]+$/),
            "type" => "job",
            "attributes" => hash_including(
              "title" => kind_of(String),
              "status" => be_in(%w[scheduled in_progress completed])
            )
          )
        ),
        "meta" => hash_including("total", "page", "per_page")
      )
    end
  end
  
  describe "PATCH /api/v1/jobs/:id" do
    it "validates field-level updates" do
      patch "/api/v1/jobs/#{job.id}", 
        params: { operations: [
          { op: "replace", path: "/status", value: "in_progress" }
        ]},
        headers: auth_headers
        
      expect(response).to have_http_status(:ok)
      expect(json_response["data"]["attributes"]["status"]).to eq("in_progress")
    end
  end
end
```

---

### SVELTE-017: E2E Testing Suite
**Points**: 5  
**Type**: Testing  
**Priority**: High  

**As a** developer  
**I want** comprehensive E2E tests  
**So that** we ensure feature parity

**Acceptance Criteria:**
- [ ] Playwright test setup
- [ ] Critical path coverage
- [ ] Offline scenario tests
- [ ] Cross-browser testing
- [ ] CI/CD integration

---

## Backlog (Future Sprints)

### SVELTE-018: Push Notifications
**Points**: 5  
**Type**: Feature  
**Priority**: Low  



---

## Dependencies Graph

```
SVELTE-001 (Rails API)
    ↓
SVELTE-002 (JWT Auth)
    ↓
SVELTE-003 (Svelte Setup) → SVELTE-004 (API Client)
                                    ↓
                            SVELTE-005 (Job List)
                                    ↓
                            SVELTE-006 (Job Detail)
                                    ↓
                            SVELTE-007 (Drag & Drop)

SVELTE-010 (Service Worker) → SVELTE-011 (Offline Read) → SVELTE-012 (Offline Write) → SVELTE-013A (Conflict UI)
```

---

## Risk Mitigation

1. **Feature Parity**: Run both systems in parallel initially
2. **Data Loss**: Comprehensive backup before migration
3. **Performance**: Monitor Core Web Vitals continuously
4. **Browser Support**: Progressive enhancement fallbacks