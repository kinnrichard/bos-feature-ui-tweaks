
## Sprint 1: Foundation (14 points)

### SVELTE-001: Rails API Configuration
**Points**: 3  
**Type**: Technical  
**Priority**: Critical  

**As a** developer  
**I want** to configure Rails for API-only mode with best practices  
**So that** we can serve JSON responses efficiently and securely

**Acceptance Criteria:**
- [ ] Add `config.api_only = true` to application.rb
- [ ] Install and configure `rack-cors` gem with strict origin control
- [ ] Set up `/api/v1` namespace with versioning strategy
- [ ] Create BaseController with consistent error handling
- [ ] Implement health check endpoint at `/api/v1/health`
- [ ] Configure JSON serialization with `jsonapi-serializer`
- [ ] Add ETag support for caching
- [ ] Implement rate limiting with `rack-attack`
- [ ] Add request ID tracking for debugging
- [ ] Configure strong parameters globally

**Technical Implementation:**
```ruby
# app/controllers/api/v1/base_controller.rb
class Api::V1::BaseController < ActionController::API
  include ActionController::HttpAuthentication::Token::ControllerMethods
  
  before_action :set_request_id
  
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable_entity
  rescue_from ActionController::ParameterMissing, with: :bad_request
  
  private
  
  def not_found(exception)
    render json: { error: exception.message }, status: :not_found
  end
  
  def unprocessable_entity(exception)
    render json: { 
      error: "Validation failed",
      details: exception.record.errors.full_messages 
    }, status: :unprocessable_entity
  end
  
  def set_request_id
    response.headers['X-Request-ID'] = request.request_id
  end
end
```

**CORS Configuration:**
```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch('FRONTEND_URL', 'http://localhost:5173')
    resource '/api/*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options],
      credentials: true,
      max_age: 86400
  end
end
```

---

### SVELTE-002: Secure JWT Authentication System
**Points**: 5  
**Type**: Technical  
**Priority**: Critical  
**Depends on**: SVELTE-001  

**As a** developer  
**I want** to implement secure JWT authentication with refresh token rotation  
**So that** the SPA can authenticate safely without XSS vulnerabilities

**Acceptance Criteria:**
- [ ] POST `/api/v1/auth/login` returns tokens via httpOnly cookies
- [ ] Implement refresh token rotation (new refresh token on each use)
- [ ] POST `/api/v1/auth/refresh` validates and rotates refresh token
- [ ] POST `/api/v1/auth/logout` revokes entire refresh token family
- [ ] Store refresh tokens with device fingerprinting
- [ ] Implement CSRF protection for cookie-based auth
- [ ] Add rate limiting to auth endpoints
- [ ] Log suspicious auth patterns (multiple devices, geographic anomalies)
- [ ] Implement secure password reset flow with time-limited tokens

**Security Implementation:**
```ruby
# app/controllers/api/v1/auth_controller.rb
class Api::V1::AuthController < Api::V1::BaseController
  skip_before_action :authenticate_request, only: [:login, :refresh]
  
  def login
    user = User.find_by(email: params[:email])
    
    if user&.authenticate(params[:password])
      access_token = generate_access_token(user)
      refresh_token = generate_refresh_token(user)
      
      # Store tokens in httpOnly cookies
      cookies[:access_token] = {
        value: access_token,
        httponly: true,
        secure: Rails.env.production?,
        same_site: :strict,
        expires: 15.minutes.from_now
      }
      
      cookies[:refresh_token] = {
        value: refresh_token,
        httponly: true,
        secure: Rails.env.production?,
        same_site: :strict,
        expires: 7.days.from_now
      }
      
      render json: { data: { user: UserSerializer.new(user) } }
    else
      render json: { error: 'Invalid credentials' }, status: :unauthorized
    end
  end
  
  private
  
  def generate_refresh_token(user)
    # Implement token family tracking
    family_id = SecureRandom.uuid
    jti = SecureRandom.uuid
    
    user.refresh_tokens.create!(
      jti: jti,
      family_id: family_id,
      expires_at: 7.days.from_now,
      device_fingerprint: request.user_agent
    )
    
    JWT.encode(
      { sub: user.id, jti: jti, family: family_id },
      Rails.application.credentials.secret_key_base
    )
  end
end
```

**Frontend Cookie Handling:**
```typescript
// lib/api/auth.ts
export class AuthService {
  async login(email: string, password: string) {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCSRFToken() // CSRF protection
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  }
}
```

---

### SVELTE-003: Svelte Project Setup with Best Practices
**Points**: 3  
**Type**: Technical  
**Priority**: Critical  

**As a** developer  
**I want** to initialize a Svelte PWA with proper architecture  
**So that** we have a scalable foundation following Svelte conventions

**Acceptance Criteria:**
- [ ] Create SvelteKit project with TypeScript and Vite
- [ ] Configure Tailwind CSS with existing design tokens
- [ ] Set up path aliases ($lib, $components, $stores, $api)
- [ ] Configure ESLint with Svelte plugin
- [ ] Set up Prettier with Svelte plugin
- [ ] Install and configure @tanstack/svelte-query
- [ ] Set up Playwright for testing
- [ ] Configure PWA manifest and service worker
- [ ] Set up proper error boundaries
- [ ] Configure environment variables with type safety

**Project Structure:**
```
frontend/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable components
│   │   ├── stores/         # Svelte stores
│   │   ├── api/           # API client & services
│   │   ├── utils/         # Helper functions
│   │   └── types/         # TypeScript types
│   ├── routes/
│   │   ├── +layout.svelte # Root layout
│   │   ├── +error.svelte  # Error boundary
│   │   └── api/           # API routes (if needed)
│   ├── app.d.ts           # Type definitions
│   ├── app.html           # HTML template
│   └── service-worker.ts  # PWA service worker
├── static/                # Static assets
├── tests/                 # Playwright tests
└── vite.config.ts
```

**Configuration Example:**
```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      $components: '/src/lib/components',
      $stores: '/src/lib/stores',
      $api: '/src/lib/api',
      $utils: '/src/lib/utils',
      $types: '/src/lib/types'
    }
  }
});

// app.d.ts
declare global {
  namespace App {
    interface Error {
      code?: string;
      details?: unknown;
    }
    interface Locals {
      user?: User;
    }
    interface PageData {}
    interface Platform {}
  }
}
```

---

### SVELTE-004: API Client with Auth
**Points**: 3  
**Type**: Technical  
**Priority**: Critical  
**Depends on**: SVELTE-002, SVELTE-003  

**As a** developer  
**I want** a robust API client with automatic auth handling  
**So that** components can easily make authenticated requests

**Acceptance Criteria:**
- [ ] API client handles token storage
- [ ] Automatic token refresh on 401
- [ ] Request/response interceptors
- [ ] Proper error handling
- [ ] TypeScript interfaces for API responses
- [ ] Loading states management

**Example Usage:**
```javascript
const jobs = await api.get('/jobs');
await api.post('/jobs', { title: 'New Job' });
```

---

## Sprint 2: Core Features (26 points)

### SVELTE-005: Job List View
**Points**: 5  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-004  

**As a** technician  
**I want** to see my assigned jobs  
**So that** I can manage my daily work

**Acceptance Criteria:**
- [ ] Fetch jobs from `/api/v1/jobs`
- [ ] Display job cards matching current design exactly
- [ ] Show technician avatars with initials
- [ ] Loading skeleton while fetching
- [ ] Error state with retry
- [ ] Empty state when no jobs
- [ ] Responsive grid layout

**Visual Requirements:**
- Match existing card shadows, spacing, borders
- Preserve current color scheme
- Maintain hover states

---

### SVELTE-006: Job Detail View
**Points**: 3  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-005  

**As a** technician  
**I want** to view detailed job information  
**So that** I can understand the work required

**Acceptance Criteria:**
- [ ] Route to `/jobs/:id`
- [ ] Display all job fields
- [ ] Show associated tasks
- [ ] Client information panel
- [ ] Status indicators
- [ ] Actions work (drag and drop, status change)

---

### SVELTE-007: Drag & Drop Task Reordering
**Points**: 5  
**Type**: Feature  
**Priority**: High  
**Depends on**: SVELTE-006  

**As a** technician  
**I want** to reorder tasks by dragging  
**So that** I can prioritize my work efficiently

**Acceptance Criteria:**
- [ ] Smooth drag animation (60fps)
- [ ] Visual feedback during drag
- [ ] Drop zones clearly indicated
- [ ] Immediate optimistic update
- [ ] POST to `/api/v1/tasks/reorder` on drop
- [ ] Revert on server error
- [ ] Touch support for tablets

**Technical Notes:**
- Use the `svelte-dnd-action` library

---

### SVELTE-008: Multi-Select Operations
**Points**: 3  
**Type**: Feature  
**Priority**: Medium  
**Depends on**: SVELTE-005  

**As a** technician  
**I want** to select multiple jobs  
**So that** I can perform bulk operations

**Acceptance Criteria:**
- [ ] Click to select/deselect
- [ ] Shift-click for range selection
- [ ] Cmd/Ctrl-click for individual selection
- [ ] Visual selection indicator

---