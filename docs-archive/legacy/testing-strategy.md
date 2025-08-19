# bŏs Testing Strategy

## Overview

This document defines the testing approach for the bŏs project. We use a two-pronged testing strategy:
- **Playwright** for UI/integration tests
- **Minitest** for unit tests (models, controllers, services)

## Quick Reference

**UI Tests (Playwright):**
- Location: `test/playwright/`
- Run: `bundle exec ruby test/playwright/clients_test.rb`

**Unit Tests (Minitest):**
- Models: `test/models/`
- Controllers: `test/controllers/`
- Run: `bundle exec rails test`

**All Tests:**
- Run: `bundle exec rails test:all`

## Testing Philosophy

### Two-Layer Testing Approach

1. **Unit Tests (Minitest)** - Fast, focused tests
   - Model validations and business logic
   - Controller request/response cycles
   - Service objects and concerns
   - Database queries and scopes

2. **Integration Tests (Playwright)** - Full-stack tests
   - User workflows and interactions
   - JavaScript behavior (Stimulus)
   - Phlex component rendering
   - End-to-end scenarios

### When to Write Tests
- **Always**: After implementing new features
- **Always**: When fixing bugs (regression tests)
- **Always**: When modifying existing functionality
- **Before**: Major refactoring efforts

## Minitest (Unit Tests)

### Model Tests
```ruby
# test/models/client_test.rb
require "test_helper"

class ClientTest < ActiveSupport::TestCase
  test "valid client with all attributes" do
    client = Client.new(
      name: "Test Corp",
      code: "TEST",
      status: "active"
    )
    assert client.valid?
  end
  
  test "requires name" do
    client = Client.new(code: "TEST")
    assert_not client.valid?
    assert_includes client.errors[:name], "can't be blank"
  end
  
  test "requires unique code" do
    existing = clients(:acme) # fixture
    client = Client.new(name: "New Corp", code: existing.code)
    assert_not client.valid?
    assert_includes client.errors[:code], "has already been taken"
  end
  
  test "active scope returns only active clients" do
    # Create test data
    active_client = clients(:acme)
    inactive_client = clients(:inactive)
    
    # Test scope
    active_clients = Client.active
    assert_includes active_clients, active_client
    assert_not_includes active_clients, inactive_client
  end
  
  test "normalizes name before save" do
    client = Client.create!(
      name: "  test corp  ",
      code: "TEST"
    )
    assert_equal "Test Corp", client.name
  end
  
  test "cascades delete to associated records" do
    client = clients(:acme)
    job_count = client.jobs.count
    
    assert_difference ["Client.count", "Job.count"], [-1, -job_count] do
      client.destroy
    end
  end
end
```

### Controller Tests
```ruby
# test/controllers/clients_controller_test.rb
require "test_helper"

class ClientsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @client = clients(:acme)
    @admin = users(:admin)
    @technician = users(:technician)
  end
  
  test "requires authentication" do
    get clients_url
    assert_redirected_to login_url
  end
  
  test "GET index with authentication" do
    sign_in_as(@admin)
    get clients_url
    
    assert_response :success
    assert_select "h1", "Clients"
  end
  
  test "GET show displays client details" do
    sign_in_as(@admin)
    get client_url(@client)
    
    assert_response :success
    assert_match @client.name, response.body
  end
  
  test "POST create with valid params" do
    sign_in_as(@admin)
    
    assert_difference("Client.count") do
      post clients_url, params: {
        client: {
          name: "New Client",
          code: "NEW",
          status: "active"
        }
      }
    end
    
    assert_redirected_to client_url(Client.last)
    follow_redirect!
    assert_match "Client was successfully created", response.body
  end
  
  test "POST create with invalid params" do
    sign_in_as(@admin)
    
    assert_no_difference("Client.count") do
      post clients_url, params: {
        client: { name: "" }
      }
    end
    
    assert_response :unprocessable_entity
  end
  
  test "technicians cannot create clients" do
    sign_in_as(@technician)
    
    post clients_url, params: {
      client: { name: "New", code: "NEW" }
    }
    
    assert_response :forbidden
  end
  
  private
  
  def sign_in_as(user)
    post login_url, params: {
      email: user.email,
      password: "password"
    }
  end
end
```

### Concern Tests
```ruby
# test/models/concerns/fx_checksum_test.rb
require "test_helper"

class FxChecksumTest < ActiveSupport::TestCase
  class TestModel < ApplicationRecord
    self.table_name = "unique_ids"
    include FxChecksum
  end
  
  setup do
    @model = TestModel.new
  end
  
  test "checksum calculation with simple input" do
    result = @model.checksum("hello world")
    assert_equal 5, result
  end
  
  test "checksum calculation consistency" do
    input = "test string"
    checksum1 = @model.checksum(input)
    checksum2 = @model.checksum(input)
    assert_equal checksum1, checksum2
  end
  
  test "checksum with special characters" do
    result = @model.checksum("!@#$%^&*()")
    assert_kind_of Integer, result
    assert result >= 0
    assert result <= 9
  end
end
```

### Service Object Tests
```ruby
# test/services/job_scheduler_test.rb
require "test_helper"

class JobSchedulerTest < ActiveSupport::TestCase
  setup do
    @client = clients(:acme)
    @technician = users(:technician)
  end
  
  test "schedules job for future date" do
    scheduler = JobScheduler.new(
      client: @client,
      technician: @technician,
      date: 1.week.from_now
    )
    
    assert_difference "Job.count" do
      job = scheduler.schedule
      assert job.persisted?
      assert_equal @client, job.client
      assert_equal @technician, job.assigned_to
    end
  end
  
  test "prevents double booking" do
    # Create existing job
    existing = create_job_for(@technician, 1.day.from_now)
    
    # Try to book same time
    scheduler = JobScheduler.new(
      client: @client,
      technician: @technician,
      date: existing.scheduled_at
    )
    
    assert_no_difference "Job.count" do
      assert_raises(JobScheduler::DoubleBookingError) do
        scheduler.schedule
      end
    end
  end
end
```

## Playwright Tests (UI/Integration)

### Basic Test Structure
```ruby
# test/playwright/clients_test.rb
require "test_helper"

class ClientsTest < PlaywrightTest
  test "complete client management workflow" do
    # Login
    login_as(users(:admin))
    
    # Create client
    visit clients_path
    click_button "New Client"
    
    within_modal do
      fill_in "Name", with: "Test Corp"
      fill_in "Code", with: "TEST"
      click_button "Create Client"
    end
    
    # Verify creation
    assert_text "Client was successfully created"
    assert_selector "h1", text: "Test Corp"
    
    # Edit client
    click_link "Edit"
    fill_in "Address", with: "123 New Street"
    click_button "Update Client"
    
    # Verify update
    assert_text "Client was successfully updated"
    assert_text "123 New Street"
  end
end
```

### Testing Stimulus Controllers
```ruby
test "filtering clients with search" do
  # Create test data
  create(:client, name: "Apple Inc")
  create(:client, name: "Microsoft Corp")
  create(:client, name: "Applied Materials")
  
  login_as(@admin)
  visit clients_path
  
  # Test Stimulus controller behavior
  fill_in "Search clients", with: "app"
  
  # Wait for debounced search
  sleep 0.5
  
  # Verify filtered results
  assert_selector ".job-card-inline", count: 2
  assert_text "Apple Inc"
  assert_text "Applied Materials"
  assert_no_text "Microsoft Corp"
end
```

### Testing Dropdown Interactions
```ruby
test "selecting client status from dropdown" do
  login_as(@admin)
  visit edit_client_path(@client)
  
  # Open dropdown
  within ".status-dropdown" do
    click_button "Select Status"
    
    # Verify dropdown opened
    assert_selector ".dropdown-menu:not(.hidden)"
    
    # Select option
    click_link "Inactive"
  end
  
  # Verify selection
  assert_field "Status", with: "inactive"
end
```

### Testing Drag and Drop
```ruby
test "reordering tasks with drag and drop" do
  job = jobs(:website_redesign)
  task1 = create(:task, job: job, position: 1, title: "First")
  task2 = create(:task, job: job, position: 2, title: "Second")
  
  login_as(@admin)
  visit job_path(job)
  
  # Perform drag and drop
  task1_element = find(".task-item", text: "First")
  task2_element = find(".task-item", text: "Second")
  
  # Drag task1 after task2
  drag_element(task1_element, to: task2_element, position: :after)
  
  # Wait for position update
  sleep 0.5
  
  # Verify new order in UI
  task_items = all(".task-item")
  assert_equal "Second", task_items[0].text
  assert_equal "First", task_items[1].text
  
  # Verify database update
  assert_equal 2, task1.reload.position
  assert_equal 1, task2.reload.position
end
```

## Test Helpers - What Are They?

Test helpers are reusable methods that make your tests cleaner and DRY (Don't Repeat Yourself). They're NOT Rails view helpers (which we don't use because we use Phlex). Test helpers are methods defined in your test files or test_helper.rb that reduce duplication across tests.

### Types of Test Helpers

#### 1. Authentication Helpers
```ruby
# Instead of repeating login code in every test:
# BAD - Repetitive
test "admin can view clients" do
  post login_url, params: { email: users(:admin).email, password: "password" }
  get clients_url
  assert_response :success
end

test "admin can edit clients" do
  post login_url, params: { email: users(:admin).email, password: "password" }
  get edit_client_url(clients(:acme))
  assert_response :success
end

# GOOD - Using a test helper
def sign_in_as(user)
  post login_url, params: { email: user.email, password: "password" }
end

test "admin can view clients" do
  sign_in_as(users(:admin))
  get clients_url
  assert_response :success
end

test "admin can edit clients" do
  sign_in_as(users(:admin))
  get edit_client_url(clients(:acme))
  assert_response :success
end
```

#### 2. Factory-like Helpers
```ruby
# Instead of repeating object creation:
# BAD - Repetitive
test "filters by status" do
  Client.create!(name: "Active 1", code: "AC1", status: "active")
  Client.create!(name: "Active 2", code: "AC2", status: "active")
  Client.create!(name: "Inactive", code: "IN1", status: "inactive")
  # ... test logic
end

# GOOD - Using a test helper
def create_client(**attrs)
  defaults = {
    name: "Test Client #{SecureRandom.hex(4)}",
    code: "CLI#{SecureRandom.hex(2).upcase}",
    status: "active"
  }
  Client.create!(defaults.merge(attrs))
end

test "filters by status" do
  create_client(name: "Active 1", status: "active")
  create_client(name: "Active 2", status: "active")
  create_client(name: "Inactive", status: "inactive")
  # ... test logic
end
```

#### 3. Assertion Helpers
```ruby
# Custom assertions for common checks:
def assert_valid(record, message = nil)
  assert record.valid?, message || record.errors.full_messages.join(", ")
end

def assert_invalid(record, attribute = nil)
  assert_not record.valid?
  assert record.errors[attribute].present? if attribute
end

# Usage:
test "validates presence of name" do
  client = Client.new(code: "TEST")
  assert_invalid client, :name
end
```

#### 4. UI Interaction Helpers (Playwright)
```ruby
# Common UI patterns:
def within_modal(&block)
  within(".modal-content", &block)
end

def wait_for_turbo
  assert_no_selector "[aria-busy=true]"
end

def select_from_dropdown(value, from:)
  click_button from
  click_link value
end

# Usage:
test "creates client through modal" do
  login_as(users(:admin))
  visit clients_path
  click_button "New Client"
  
  within_modal do
    fill_in "Name", with: "Test Corp"
    select_from_dropdown "Active", from: "Status"
    click_button "Create"
  end
  
  wait_for_turbo
  assert_text "Client created successfully"
end
```

### Where to Define Test Helpers

#### 1. In test_helper.rb (Global)
```ruby
# test/test_helper.rb
class ActiveSupport::TestCase
  # Available to all tests
  def create_test_data
    # ...
  end
end

class ActionDispatch::IntegrationTest
  # Available to controller tests
  def sign_in_as(user)
    # ...
  end
end

class PlaywrightTest
  # Available to Playwright tests
  def login_as(user)
    # ...
  end
end
```

#### 2. In Specific Test Files (Local)
```ruby
# test/models/client_test.rb
class ClientTest < ActiveSupport::TestCase
  private
  
  # Only available in this test file
  def client_with_jobs(job_count: 3)
    client = create_client
    job_count.times do
      create_job(client: client)
    end
    client
  end
end
```

#### 3. In Test Support Files
```ruby
# test/support/authentication_helpers.rb
module AuthenticationHelpers
  def sign_in_as(user)
    # ...
  end
  
  def sign_out
    # ...
  end
end

# Include in test_helper.rb
class ActionDispatch::IntegrationTest
  include AuthenticationHelpers
end
```

### Benefits of Test Helpers

1. **DRY Tests**: Write setup code once, use it many times
2. **Readability**: Tests focus on what's being tested, not setup
3. **Maintainability**: Change authentication flow in one place
4. **Consistency**: Everyone uses the same patterns
5. **Speed**: Write tests faster with less boilerplate

## Testing Best Practices

### 1. Test Pyramid
```
         /\
        /UI\        <- Playwright (few, slow)
       /----\
      /Service\     <- Minitest (some, medium)
     /--------\
    /Unit Tests\    <- Minitest (many, fast)
   /------------\
```

### 2. Test Independence
```ruby
# Bad - depends on test order
test "first test" do
  @shared_var = Client.create!(name: "Test")
end

test "second test" do
  assert_equal "Test", @shared_var.name # Fails!
end

# Good - independent tests
test "first test" do
  client = Client.create!(name: "Test")
  assert_equal "Test", client.name
end

test "second test" do
  client = clients(:acme) # Use fixture
  assert_equal "Acme Corporation", client.name
end
```

### 3. Descriptive Test Names
```ruby
# Bad
test "client" do
  # ...
end

# Good
test "client with duplicate code shows validation error" do
  # ...
end
```

### 4. Arrange-Act-Assert
```ruby
test "completing job sends notification" do
  # Arrange
  job = jobs(:website_maintenance)
  job.tasks.update_all(status: "pending")
  
  # Act
  JobCompletionService.new(job).complete!
  
  # Assert
  assert job.reload.completed?
  assert_enqueued_emails 1
end
```

## Running Tests

### Minitest Only
```bash
# All unit tests
bundle exec rails test

# Specific test file
bundle exec rails test test/models/client_test.rb

# Specific test method
bundle exec rails test test/models/client_test.rb:15

# By directory
bundle exec rails test test/models/
bundle exec rails test test/controllers/
```

### Playwright Only
```bash
# All Playwright tests
bundle exec rails test test/playwright/

# Specific Playwright test
bundle exec ruby test/playwright/clients_test.rb
```

### All Tests
```bash
# Run everything
bundle exec rails test:all

# With coverage report
COVERAGE=true bundle exec rails test:all
```

### Test Watching
```bash
# Watch for changes and auto-run tests
bundle exec guard
```

## Test Data Management

### Fixtures
```yaml
# test/fixtures/clients.yml
acme:
  name: Acme Corporation
  code: ACME
  status: active
  created_at: <%= 1.year.ago %>
  
apple:
  name: Apple Inc
  code: AAPL
  status: active
  
inactive:
  name: Old Client Corp
  code: OLD
  status: inactive
```

### Dynamic Test Data
```ruby
# In tests, prefer fixtures for stability
test "filters active clients" do
  # Use fixtures
  active = [clients(:acme), clients(:apple)]
  inactive = clients(:inactive)
  
  # Or create dynamically when needed
  new_client = create_client(status: "active")
  
  results = Client.active
  assert_includes results, new_client
  assert_not_includes results, inactive
end
```

## Puppeteer Usage (Limited)

⚠️ **IMPORTANT**: Write new tests in Playwright unless you need specific Puppeteer features.

Valid reasons to use Puppeteer for NEW tests:
- Complex drag-and-drop operations that don't work reliably in Playwright
- Specific browser automation APIs only available in Puppeteer
- PDF generation testing requiring Puppeteer-specific features

When choosing between Puppeteer and Playwright:
```ruby
# Try Playwright first
test "drag and drop with playwright" do
  visit job_path(@job)
  
  # If this doesn't work reliably...
  drag_element(source, to: target)
end

# Only use Puppeteer if Playwright fails
require "puppeteer"
test "complex drag and drop with puppeteer" do
  Puppeteer.launch(headless: false) do |browser|
    page = browser.pages.first || browser.new_page
    page.goto(job_url(@job))
    
    # Puppeteer-specific drag implementation
    await page.mouse.move(source_x, source_y)
    await page.mouse.down
    await page.mouse.move(target_x, target_y)
    await page.mouse.up
  end
end
```

## Continuous Integration

### Test Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          bundler-cache: true
      
      - name: Setup test database
        run: |
          bin/rails db:create
          bin/rails db:schema:load
      
      - name: Run unit tests
        run: bin/rails test
      
      - name: Run Playwright tests
        run: |
          npx playwright install
          bin/rails test test/playwright/
```

## Remember

1. **Unit test with Minitest** for speed and isolation
2. **Integration test with Playwright** for user workflows
3. **Write tests at the right level** - don't UI test validations
4. **Keep tests fast** - mock external services in unit tests
5. **Use fixtures** for stable test data
6. **Test the behavior**, not the implementation
7. **One assertion per test** when possible
8. **Use test helpers** to reduce duplication and improve readability