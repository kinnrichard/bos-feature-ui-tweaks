# Critical Areas Test Plan for bŏs

## Overview

This test plan focuses on testing critical business logic and error-prone areas that are unlikely to change during upcoming development. The goal is to catch bugs and ensure core functionality remains stable while allowing flexibility for UI and feature changes.

## Test Priority Matrix

| Priority | Area | Reason | Test Type |
|----------|------|--------|-----------|
| P0 | TaskSortingService | Core algorithm, complex logic | Unit |
| P0 | Task model state/validations | Business rules won't change | Unit |
| P0 | Job model state machine | Core business logic | Unit |
| P0 | ActivityLog tracking | Audit trail critical | Integration |
| P1 | Task reordering endpoints | Complex, error-prone | Integration |
| P1 | Authorization checks | Security critical | Integration |
| P1 | ScheduledDateTime validation | Complex date/time logic | Unit |
| P2 | Client uniqueness/normalization | Data integrity | Unit |
| P2 | N+1 query prevention | Performance | Integration |

## Detailed Test Plans

### P0: TaskSortingService Tests

**File:** `test/services/task_sorting_service_test.rb`

```ruby
class TaskSortingServiceTest < ActiveSupport::TestCase
  # Test Categories:
  
  # 1. Basic Sorting
  test "sorts tasks by position within same status"
  test "maintains position gaps for future insertions"
  test "handles tasks with nil positions"
  
  # 2. Status Change Sorting
  test "moves completed tasks to end when resort enabled"
  test "keeps completed tasks in place when resort disabled"
  test "moves in_progress tasks to top of pending"
  test "preserves relative order within same status"
  
  # 3. Reordering Operations
  test "reorders task to new position in same status"
  test "reorders task when changing status"
  test "handles moving to position 0"
  test "handles moving to last position"
  
  # 4. Edge Cases
  test "handles empty task list"
  test "handles single task"
  test "handles duplicate positions (data corruption)"
  test "handles very large position numbers"
  
  # 5. Subtask Handling
  test "maintains subtask positions when parent moves"
  test "sorts subtasks independently from parent tasks"
  test "handles nested subtask reordering"
  
  # 6. Concurrent Updates
  test "handles race conditions with optimistic locking"
  test "recovers from position conflicts"
end
```

### P0: Task Model Tests

**File:** `test/models/task_test.rb`

```ruby
class TaskTest < ActiveSupport::TestCase
  # 1. Validations
  test "requires job association"
  test "requires title"
  test "validates status inclusion"
  test "validates position is positive integer"
  
  # 2. State Transitions
  test "transitions from pending to in_progress"
  test "transitions from in_progress to completed"
  test "cannot transition from completed to pending"
  test "tracks completed_at timestamp"
  test "tracks completed_by user"
  
  # 3. Scopes
  test "pending scope returns only pending tasks"
  test "completed scope returns only completed tasks"
  test "ordered scope sorts by position"
  
  # 4. Callbacks
  test "sets default position on create"
  test "updates parent job on status change"
  test "logs activity on create/update/destroy"
  test "updates subtasks_count counter cache"
  
  # 5. Business Logic
  test "calculates completion percentage"
  test "determines if overdue based on job due date"
  test "prevents deletion of task with subtasks"
  
  # 6. Associations
  test "belongs to job"
  test "belongs to assigned user (optional)"
  test "has many subtasks"
  test "destroys subtasks when parent destroyed"
end
```

### P0: Job Model Tests

**File:** `test/models/job_test.rb`

```ruby
class JobTest < ActiveSupport::TestCase
  # 1. Validations
  test "requires client association"
  test "requires created_by user"
  test "requires title"
  test "validates status values"
  test "validates priority values"
  
  # 2. State Machine
  test "starts in open status"
  test "transitions open -> in_progress"
  test "transitions in_progress -> completed"
  test "transitions any -> cancelled"
  test "prevents invalid transitions"
  
  # 3. Date/Time Handling
  test "parses due_on and due_time correctly"
  test "handles timezone conversions"
  test "calculates overdue status"
  test "validates start date before due date"
  
  # 4. Associations & Callbacks
  test "has many tasks"
  test "has many technicians through assignments"
  test "logs activity on status change"
  test "updates client last_activity timestamp"
  
  # 5. Business Logic
  test "calculates task completion percentage"
  test "determines next action needed"
  test "auto-completes when all tasks done"
  test "prevents deletion with active tasks"
  
  # 6. Scopes & Queries
  test "active scope excludes completed/cancelled"
  test "overdue scope uses due dates correctly"
  test "assigned_to scope filters by technician"
end
```

### P0: ActivityLog Integration Tests

**File:** `test/integration/activity_log_test.rb`

```ruby
class ActivityLogTest < ActionDispatch::IntegrationTest
  # 1. Automatic Logging
  test "logs client creation with user and timestamp"
  test "logs job updates with changed attributes"
  test "logs task completion with user attribution"
  test "logs deletion with preserved record data"
  
  # 2. Metadata Storage
  test "stores changes in JSONB metadata field"
  test "preserves original values on update"
  test "handles complex nested attributes"
  test "sanitizes sensitive data (passwords)"
  
  # 3. Associations
  test "links logs to correct user"
  test "maintains client association for related records"
  test "maintains job association when applicable"
  
  # 4. Querying
  test "filters logs by date range"
  test "filters logs by user"
  test "filters logs by action type"
  test "filters logs by resource type"
  
  # 5. Data Integrity
  test "preserves logs when user deleted"
  test "preserves logs when related record deleted"
  test "handles polymorphic associations correctly"
end
```

### P1: Task Reordering Integration Tests

**File:** `test/integration/task_reordering_test.rb`

```ruby
class TaskReorderingTest < ActionDispatch::IntegrationTest
  # 1. Single Task Reorder
  test "reorders task within same status via PATCH"
  test "returns updated positions in response"
  test "maintains position uniqueness"
  test "handles invalid position gracefully"
  
  # 2. Bulk Reorder
  test "reorders multiple tasks via bulk endpoint"
  test "validates all task IDs belong to same job"
  test "rolls back on partial failure"
  test "maintains relative order of unspecified tasks"
  
  # 3. Cross-Status Reorder
  test "allows reorder when changing status"
  test "applies resort rules based on user preference"
  test "updates timestamps appropriately"
  
  # 4. Concurrent Updates
  test "handles simultaneous reorder requests"
  test "uses optimistic locking to prevent conflicts"
  test "returns appropriate error on conflict"
  
  # 5. Performance
  test "reorders 50+ tasks efficiently"
  test "uses single transaction for bulk updates"
  test "returns minimal JSON response"
end
```

### P1: Authorization Integration Tests

**File:** `test/integration/authorization_test.rb`

```ruby
class AuthorizationTest < ActionDispatch::IntegrationTest
  # 1. Authentication
  test "redirects to login when not authenticated"
  test "allows access after login"
  test "maintains session across requests"
  test "clears session on logout"
  
  # 2. Role-Based Access
  test "owner can manage all resources"
  test "admin cannot manage users"
  test "member can only edit assigned jobs"
  test "member cannot delete any resources"
  
  # 3. Resource Authorization
  test "prevents viewing other companies' clients"
  test "prevents editing unassigned jobs"
  test "allows viewing shared resources"
  test "validates ownership before deletion"
  
  # 4. API Authorization
  test "returns 401 for unauthenticated API requests"
  test "returns 403 for unauthorized API requests"
  test "includes error message in JSON response"
  
  # 5. Edge Cases
  test "handles deleted user's resources"
  test "handles permission changes mid-session"
  test "prevents privilege escalation"
end
```

### P1: ScheduledDateTime Validation Tests

**File:** `test/models/scheduled_date_time_test.rb`

```ruby
class ScheduledDateTimeTest < ActiveSupport::TestCase
  # 1. Basic Validations
  test "requires scheduled_date"
  test "requires schedulable association"
  test "requires scheduled_type"
  test "allows nil scheduled_time"
  
  # 2. Date/Time Logic
  test "validates date is not in past (for new records)"
  test "allows past dates for existing records"
  test "handles daylight saving transitions"
  test "preserves timezone information"
  
  # 3. Business Rules
  test "prevents overlapping appointments"
  test "validates appointment duration"
  test "handles recurring schedules"
  test "calculates next occurrence"
  
  # 4. User Assignments
  test "assigns multiple users to schedule"
  test "prevents duplicate user assignments"
  test "handles user removal from schedule"
  test "notifies assigned users (future)"
  
  # 5. Polymorphic Associations
  test "works with Job schedulable"
  test "works with Task schedulable"
  test "maintains referential integrity"
end
```

## Test Implementation Strategy

### Phase 1: Core Business Logic (Week 1)
1. TaskSortingService - Complete unit test suite
2. Task model - Validations and state transitions
3. Job model - State machine and validations

### Phase 2: Data Integrity (Week 2)
1. ActivityLog - Tracking and querying
2. Authorization - Security testing
3. Client uniqueness - Data validation

### Phase 3: Complex Features (Week 3)
1. Task reordering endpoints
2. ScheduledDateTime validation
3. Performance testing for N+1 queries

## Test Data Factories

Create factories for consistent test data:

```ruby
# test/factories/jobs.rb
FactoryBot.define do
  factory :job do
    association :client
    association :created_by, factory: :user
    title { "Fix Server Issue" }
    status { 0 } # open
    priority { 2 } # normal
    
    trait :with_tasks do
      after(:create) do |job|
        create_list(:task, 3, job: job)
      end
    end
    
    trait :in_progress do
      status { 1 }
    end
    
    trait :completed do
      status { 5 }
      completed_at { Time.current }
    end
  end
end
```

## Test Helpers

Create shared test helpers:

```ruby
# test/test_helper.rb
class ActiveSupport::TestCase
  # Helper to sign in user for integration tests
  def sign_in_as(user)
    post login_path, params: { 
      email: user.email, 
      password: 'password' 
    }
  end
  
  # Helper to assert activity was logged
  def assert_activity_logged(action, resource)
    log = ActivityLog.last
    assert_equal action, log.action
    assert_equal resource, log.loggable
  end
  
  # Helper to create job with standard setup
  def create_job_with_tasks(task_count: 3)
    job = create(:job, :with_tasks)
    job.tasks.each_with_index do |task, index|
      task.update!(position: (index + 1) * 10)
    end
    job
  end
end
```

## Success Criteria

- [ ] All P0 tests passing
- [ ] All P1 tests passing  
- [ ] No reduction in existing test coverage
- [ ] Tests run in < 30 seconds
- [ ] Clear test failure messages
- [ ] No flaky tests

## Excluded from Current Plan

These areas will be tested after major changes are complete:

- UI component rendering tests
- Detailed controller response format tests
- View-specific behavior tests
- CSS/styling tests
- JavaScript unit tests (Stimulus controllers)
- Full end-to-end workflows (covered by Playwright)

## Monitoring Test Health

1. **Run tests before each commit**
   ```bash
   rails test:models
   rails test:services  
   rails test:integration
   ```

2. **Monitor test performance**
   ```bash
   rails test --profile
   ```

3. **Check for test interdependencies**
   ```bash
   rails test --random
   ```

4. **Measure coverage (optional)**
   ```bash
   # Add simplecov gem
   rails test
   open coverage/index.html
   ```

This plan provides comprehensive coverage of critical business logic while maintaining flexibility for upcoming changes.