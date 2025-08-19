# STORY-EP37-003: Write Characterization Tests for Current Behavior

**Story ID**: STORY-EP37-003  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Testing  
**Points**: 5  
**Priority**: P0 - Critical Path  
**Status**: Open  
**Dependencies**: None (can run in parallel with STORY-EP37-001, STORY-EP37-002)  

## User Story

**As a** developer refactoring the generation system  
**I want** comprehensive characterization tests capturing current behavior  
**So that** I can refactor with confidence knowing functionality is preserved  

## Background

Per Sandi Metz's refactoring approach:
> "Write characterization tests FIRST - they're your safety net"

The current system has tests, but they mock heavily and don't capture actual output. We need tests that:
- Capture exact TypeScript output for various model types
- Record file operations and their sequence
- Document edge cases and special behaviors
- Serve as regression tests during refactoring

## Acceptance Criteria

### Test Coverage Criteria
- [ ] Capture output for simple model (no relationships)
- [ ] Capture output for model with belongs_to
- [ ] Capture output for model with has_many
- [ ] Capture output for polymorphic relationships
- [ ] Capture output for STI models
- [ ] Capture output for models with custom types
- [ ] Capture batch generation behavior
- [ ] Capture error handling scenarios

### Output Verification Criteria
- [ ] Generated TypeScript matches current output exactly
- [ ] File paths and naming conventions preserved
- [ ] Import statements correct
- [ ] Index files generated properly
- [ ] Prettier formatting applied correctly

### Edge Case Criteria
- [ ] Reserved word handling (class, interface, etc.)
- [ ] Special characters in table names
- [ ] Empty schema handling
- [ ] Missing relationship targets
- [ ] Circular relationships

## Technical Design

```ruby
# test/lib/generators/zero/active_models/characterization_test.rb
require "test_helper"

class GeneratorCharacterizationTest < ActiveSupport::TestCase
  def setup
    @output_dir = Rails.root.join("tmp", "test_generation")
    FileUtils.rm_rf(@output_dir)
    FileUtils.mkdir_p(@output_dir)
  end

  def teardown
    FileUtils.rm_rf(@output_dir)
  end

  test "generates simple model without relationships" do
    # Capture current behavior exactly
    schema = create_schema_for(:users, {
      id: :bigint,
      email: :string,
      name: :string,
      created_at: :datetime,
      updated_at: :datetime
    })

    result = generate_model("users", schema)
    
    assert_file_content "users.ts", <<~TYPESCRIPT
      // Auto-generated from Rails schema
      import { BaseModel } from './base-model';
      
      export interface UserData {
        id: number;
        email: string;
        name: string;
        created_at: string;
        updated_at: string;
      }
      
      export class User extends BaseModel {
        static tableName = 'users';
        
        declare id: number;
        declare email: string;
        declare name: string;
        declare created_at: string;
        declare updated_at: string;
      }
    TYPESCRIPT
  end

  test "generates model with belongs_to relationship" do
    schema = create_schema_for(:posts, {
      id: :bigint,
      title: :string,
      user_id: :bigint
    })

    result = generate_model("posts", schema, relationships: {
      belongs_to: [{ name: "user", foreign_key: "user_id" }]
    })

    assert_file_content "posts.ts", <<~TYPESCRIPT
      // Includes belongs_to relationship
      import { User } from './user';
      
      export class Post extends BaseModel {
        static tableName = 'posts';
        
        declare user_id: number;
        declare user?: User;
      }
    TYPESCRIPT
  end

  test "generates model with polymorphic relationship" do
    schema = create_schema_for(:notes, {
      id: :bigint,
      content: :text,
      notable_type: :string,
      notable_id: :bigint
    })

    result = generate_model("notes", schema, relationships: {
      belongs_to: [{
        name: "notable",
        polymorphic: true,
        types: ["Job", "Task", "Client"]
      }]
    })

    assert_file_content "notes.ts", <<~TYPESCRIPT
      // Polymorphic relationships
      export class Note extends BaseModel {
        declare notable_type: string;
        declare notable_id: number;
        declare notableJob?: Job;
        declare notableTask?: Task;
        declare notableClient?: Client;
      }
    TYPESCRIPT
  end

  test "handles reserved TypeScript keywords" do
    schema = create_schema_for(:classes, {
      id: :bigint,
      interface: :string,
      export: :string
    })

    result = generate_model("classes", schema)

    assert_file_content "classes.ts", <<~TYPESCRIPT
      export class Class_ extends BaseModel {
        static tableName = 'classes';
        
        declare interface_: string;
        declare export_: string;
      }
    TYPESCRIPT
  end

  test "generates index files correctly" do
    generate_models(["users", "posts", "comments"])
    
    assert_file_content "index.ts", <<~TYPESCRIPT
      export { User } from './user';
      export { Post } from './post';
      export { Comment } from './comment';
    TYPESCRIPT
  end

  test "applies Prettier formatting" do
    # Generate with intentionally bad formatting
    unformatted = generate_with_formatting_disabled
    formatted = generate_with_formatting_enabled
    
    refute_equal unformatted, formatted
    assert formatted.include?("// Prettier formatted")
  end

  private

  def generate_model(table, schema, relationships: {})
    coordinator = GenerationCoordinator.new(
      { output: @output_dir },
      MockShell.new
    )
    coordinator.generate_model_set(table, schema)
  end

  def assert_file_content(filename, expected)
    path = File.join(@output_dir, filename)
    assert File.exist?(path), "File #{filename} should exist"
    
    actual = File.read(path)
    # Normalize whitespace for comparison
    assert_equal normalize(expected), normalize(actual)
  end

  def normalize(content)
    content.strip.gsub(/\s+/, " ").gsub(/\n\s*/, "\n")
  end
end
```

## Implementation Steps

1. **Set up test infrastructure** (1 hour)
   - Create test directory structure
   - Set up file system isolation
   - Create test helpers

2. **Capture simple model generation** (1 hour)
   - Users, posts, comments tables
   - Various data types
   - Verify exact output format

3. **Capture relationship generation** (1.5 hours)
   - belongs_to, has_many, has_one
   - Polymorphic relationships
   - Self-referential relationships

4. **Capture edge cases** (1.5 hours)
   - Reserved words
   - Special characters
   - Empty/nil scenarios
   - Missing associations

5. **Capture file operations** (1 hour)
   - Directory creation
   - File writing sequence
   - Index file generation
   - Prettier integration

6. **Document discovered behaviors** (30 min)
   - Create behavior catalog
   - Note surprising findings
   - Document implicit rules

## Testing Requirements

### File System Tests
- Verify exact file paths created
- Check file permissions
- Validate directory structure

### Content Tests
- Exact TypeScript output
- Import statements
- Class definitions
- Type declarations

### Sequence Tests
- Order of operations
- Dependency resolution
- Error handling flow

## Definition of Done

- [ ] Tests capture all current behaviors
- [ ] Tests run without mocking file system
- [ ] Edge cases documented and tested
- [ ] Test output matches production exactly
- [ ] Tests can detect any regression
- [ ] Behavior catalog documented
- [ ] Tests reviewed and approved

## Notes

- These tests are temporary - will be replaced after refactoring
- Focus on capturing behavior, not testing correctness
- Document any bugs found - don't fix them yet
- Keep tests independent and fast
- Use real file system, not mocks