# TaskList Testing Framework

This document describes the comprehensive testing framework built for the TaskList component. The framework provides robust tools for testing all TaskList functionality before and during the planned refactoring.

## Overview

The TaskList testing framework includes:

- **Comprehensive test infrastructure** with database seeding and test data management
- **Page Object Models** for clean test organization
- **Specialized test helpers** for TaskList-specific operations
- **Multiple test suites** covering different aspects of functionality
- **Rake tasks** for convenient test execution
- **CI/CD ready** configuration

## Quick Start

```bash
# Run all TaskList tests
rake test:tasklist

# Run specific test suite
rake test:tasklist:comprehensive
rake test:tasklist:focused
rake test:tasklist:regression

# Debug mode (visual browser)
rake test:tasklist:debug

# Quick smoke test
rake test:tasklist:smoke
```

## Test Infrastructure

### Test Environment Management

The `TestEnvironment` module (`test/test_environment.rb`) provides:

- Database setup and teardown
- Test data seeding and verification
- User management for different roles
- Browser configuration
- Debugging utilities

### Test Data System

#### Database Seeding (`db/test_seeds.rb`)
Comprehensive test data including:
- 5+ test users with different roles
- Multiple clients with realistic data
- Jobs with various scenarios (simple, complex, hierarchical, large)
- 60+ tasks with different statuses and relationships

#### Enhanced Fixtures
Updated fixtures in `test/fixtures/` with:
- Realistic client data with full attributes
- Jobs designed for specific testing scenarios
- Tasks with hierarchical relationships and mixed statuses

### TaskList-Specific Helpers

#### TaskListTestHelpers (`test/support/tasklist_test_helpers.rb`)
400+ lines of specialized helpers for:
- Authentication and navigation
- Task creation and interaction
- Status management
- Drag & drop operations
- Hierarchy management
- Keyboard navigation
- Selection and multi-select
- Filtering and search
- Assertions and validation

#### TaskListPage Object Model (`test/support/page_objects/task_list_page.rb`)
500+ lines providing high-level interface for:
- Element getters and selectors
- Task interaction methods
- Creation and editing operations
- Status management
- Drag & drop functionality
- Hierarchy operations
- Selection management
- Keyboard navigation
- Filtering and search
- Debugging utilities

## Test Suites

### 1. Comprehensive Test Suite (`test/playwright/tasklist_comprehensive_test.rb`)

**Purpose**: Complete functional testing of all TaskList features

**Coverage**:
- Basic functionality (loading, creation, editing)
- Status management (all status transitions)
- Selection and multi-select operations
- Drag & drop (reordering and nesting)
- Hierarchy management (expand/collapse)
- Keyboard navigation
- Filtering and search
- Error handling and edge cases
- Performance testing
- Integration testing
- Accessibility basics

### 2. Focused Feature Tests (`test/playwright/tasklist_focused_tests.rb`)

**Purpose**: Deep testing of specific features and edge cases

**Coverage**:
- Task creation with various input methods
- Special characters and long titles
- Inline task creation
- Status cycling through all states
- Batch status changes
- Precise drag & drop positioning
- Visual feedback during interactions
- Full keyboard navigation workflows
- Edit mode edge cases
- Complex search scenarios
- Filter combinations
- Performance stress testing
- Error recovery scenarios

### 3. Regression Test Suite (`test/playwright/tasklist_regression_test.rb`)

**Purpose**: Critical functionality protection during refactoring

**Coverage**:
- Core functionality preservation
- Loading with various data scenarios
- Selection mechanism integrity
- Drag & drop functionality
- Status management reliability
- UI stability during interactions
- Data persistence across reloads
- Integration with different user roles
- Compatibility with various job statuses

## Database Management

### Rake Tasks (`lib/tasks/test_db.rake`)

```bash
# Setup and seed test database
rake test:db:setup
# OR: rake db:test:seed

# Reset and reseed
rake test:db:reset
# OR: rake db:test:reset

# Quick setup (faster for repeated use)
rake db:test:quick_setup

# Verify test data
rake test:db:verify
# OR: rake db:test:verify

# Check status
rake db:test:status
```

### Test Data Scenarios

The framework provides predefined test scenarios:

- **`:empty`** - Jobs with no tasks (for creation testing)
- **`:simple`** - Basic jobs with few tasks (for basic functionality)
- **`:complex`** - Jobs with hierarchical tasks (for hierarchy testing)
- **`:mixed_status`** - Jobs with tasks in various statuses
- **`:large`** - Jobs with many tasks (for performance testing)

## Running Tests

### Basic Commands

```bash
# All TaskList tests
rake test:tasklist:all

# Individual suites
rake test:tasklist:comprehensive
rake test:tasklist:focused
rake test:tasklist:regression

# Specific test method
rake test:tasklist:specific[tasklist_comprehensive_test,task_creation]
```

### Debug Mode

```bash
# Visual browser mode
rake test:tasklist:debug

# With environment variables
DEBUG=true PLAYWRIGHT_HEADFUL=true rake test:tasklist:comprehensive
```

### CI Mode

```bash
# Headless, optimized for CI
rake test:tasklist:ci
```

### Maintenance

```bash
# Clean test artifacts
rake test:tasklist:clean

# Generate test report
rake test:tasklist:report

# Show help
rake test:tasklist:help
```

## Writing New Tests

### Using the Page Object Model

```ruby
class MyTaskListTest < ApplicationPlaywrightTestCase
  setup do
    TestEnvironment.setup_test_data!
    @task_list = TaskListPage.new(@page)
    login_as_test_user(:admin)
  end

  test "my custom test" do
    # Navigate to a job
    job = TestEnvironment.get_test_job(:simple)
    @task_list.visit_job(job)
    
    # Create a task
    @task_list.create_task("My Test Task")
    
    # Verify it exists
    assert @task_list.has_task?("My Test Task")
    
    # Change status
    @task_list.change_task_status(0, "in_progress")
    
    # Verify status change
    assert_equal "in_progress", @task_list.get_task_status(0)
  end
end
```

### Using Test Helpers Directly

```ruby
test "using helpers directly" do
  navigate_to_job(:simple)
  
  create_new_task("Helper Test Task")
  change_task_status(0, "successfully_completed")
  
  assert_task_exists("Helper Test Task")
  assert_task_has_status(0, "successfully_completed")
end
```

## Test Data Access

### Getting Test Users

```ruby
admin_user = TestEnvironment.get_test_user(:admin)
tech_user = TestEnvironment.get_test_user(:technician)
```

### Getting Test Jobs

```ruby
simple_job = TestEnvironment.get_test_job(:simple)
complex_job = TestEnvironment.get_test_job(:complex)
empty_job = TestEnvironment.get_test_job(:empty)
```

### Getting Test Credentials

```ruby
credentials = TestEnvironment.test_credentials(:admin)
# Returns: { email: "admin@bos-test.local", password: "password123" }
```

## Debugging

### Screenshots

Tests automatically take screenshots in debug mode:

```ruby
# Manual screenshot
@task_list.take_screenshot("my_debug_screenshot")

# Debug info
@task_list.print_debug_info
```

### Environment Status

```ruby
# Print comprehensive environment info
TestEnvironment.print_environment_status
```

### Debug Pause

```ruby
# Pause test for manual inspection (debug mode only)
TestEnvironment.pause_for_debug
```

## CI/CD Integration

The framework is designed for CI/CD with:

- Headless browser mode
- Parallel test execution control
- Comprehensive error reporting
- Screenshot capture on failures
- Test timing and performance metrics

### GitHub Actions Example

```yaml
- name: Run TaskList Tests
  run: |
    CI=true rake test:tasklist:ci
  env:
    RAILS_ENV: test
```

## Best Practices

### Test Organization

1. **Use descriptive test names**: `test "can create task with special characters"`
2. **Group related tests**: Keep status tests together, drag & drop tests together
3. **Use setup/teardown**: Let the framework handle environment setup
4. **Test one thing**: Each test should verify one specific behavior

### Test Data

1. **Use predefined scenarios**: Leverage `:simple`, `:complex`, etc.
2. **Don't rely on specific counts**: Tests should work with variable data
3. **Clean up when needed**: Framework handles most cleanup automatically
4. **Verify assumptions**: Check task count before complex operations

### Assertions

1. **Use specific assertions**: `assert_task_has_status` vs generic `assert`
2. **Provide clear messages**: Help with debugging when tests fail
3. **Test both positive and negative**: Verify expected behavior and error handling
4. **Use timeouts appropriately**: Allow for UI updates

### Performance

1. **Minimize page loads**: Reuse the same job when possible
2. **Use appropriate waits**: Don't use fixed sleeps unless necessary
3. **Batch operations**: Create multiple tasks at once when testing lists
4. **Clean up resources**: Let framework handle browser cleanup

## Troubleshooting

### Common Issues

1. **Test data missing**: Run `rake test:db:setup`
2. **Browser not starting**: Check Playwright installation
3. **Timeouts**: Increase timeout or check UI responsiveness
4. **Flaky tests**: Add appropriate waits and use stable selectors

### Debug Commands

```bash
# Verify test environment
rake test:db:verify

# Check test data
TestEnvironment.print_environment_status

# Run with verbose output
DEBUG=true rake test:tasklist:smoke
```

## Future Enhancements

The framework is designed to be extensible:

1. **Visual regression testing**: Screenshot comparison
2. **Performance benchmarking**: Automated performance tracking
3. **Accessibility testing**: Full WCAG compliance testing
4. **Load testing**: Multi-user scenarios
5. **API integration testing**: Backend API verification
6. **Cross-browser testing**: Multiple browser support

## Summary

This testing framework provides comprehensive coverage for the TaskList component, ensuring that:

- All functionality is thoroughly tested
- Refactoring can proceed safely
- Regressions are quickly detected
- New features can be easily tested
- The codebase remains maintainable

The framework is production-ready and provides a solid foundation for confident development and refactoring of the TaskList component.