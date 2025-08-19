# Zero Schema Generator - Polymorphic Integration

## Overview

The Zero Schema Generator provides automated discovery and integration of Rails polymorphic associations with the Zero.js polymorphic tracking system (EP-0035). This system eliminates the need for manual polymorphic relationship management by automatically generating TypeScript models with dynamic polymorphic capabilities.

## Features

- **Automated Discovery**: Scans Rails models and database to discover all polymorphic associations
- **YAML Configuration**: Persists discovered types in `config/zero_polymorphic_types.yml`
- **Dynamic Generation**: Generates TypeScript models using `declarePolymorphicRelationships` API
- **Single Source of Truth**: Rails database schema drives all polymorphic relationships
- **Statistics Tracking**: Monitors usage patterns and relationship health
- **STI Support**: Handles Single Table Inheritance patterns correctly

## Quick Start

### 1. Discover Polymorphic Types

```bash
# Discover all polymorphic associations from database
rails runner "ZeroSchemaGenerator::PolymorphicIntrospector.new.discover_polymorphic_types"
```

This command will:
- Scan all Rails models for polymorphic associations
- Query the database for actual polymorphic type values
- Generate statistics and usage patterns
- Create/update `config/zero_polymorphic_types.yml`

### 2. Generate Models

When you run the standard model generation:

```bash
rails generate zero:active_models
```

The generator will now automatically:
- Read the polymorphic configuration
- Include `declarePolymorphicRelationships` calls in generated models
- Set up proper TypeScript imports
- Generate both regular and reactive model variants

### 3. Use Generated Models

Generated models integrate seamlessly with the polymorphic tracking system:

```typescript
// Generated note.ts
import { declarePolymorphicRelationships } from '../zero/polymorphic';

export const Note = createActiveRecord<NoteData>(NoteConfig);

// Automatically generated polymorphic declarations
declarePolymorphicRelationships({
  tableName: 'notes',
  belongsTo: {
    notable: {
      typeField: 'notable_type',
      idField: 'notable_id',
      allowedTypes: ['task'] // From discovered database types
    }
  }
});
```

## Configuration File Structure

The `config/zero_polymorphic_types.yml` file contains comprehensive polymorphic association data:

```yaml
# Auto-generated configuration
:metadata:
  :generated_at: '2025-08-06T12:21:25-04:00'
  :rails_environment: development
  :database_adapter: PostgreSQL
  :schema_version: '20250806135650'

:statistics:
  :total_associations: 7
  :total_types: 7
  :associations_with_data: 4
  :sti_patterns: []

:polymorphic_associations:
  notes.notable:
    :table: notes
    :association: notable
    :type_column: notable_type
    :id_column: notable_id
    :discovered_types:
    - Task
    :mapped_tables:
    - tasks
    :statistics:
      :total_records: 62
      :unique_types: 1
      :last_seen: '2025-08-04T12:13:12Z'
      :first_seen: '2022-01-12T02:58:32Z'
```

## Core Components

### PolymorphicIntrospector

The main discovery engine that analyzes your Rails application:

```ruby
introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new

# Discover all polymorphic associations
config = introspector.discover_polymorphic_types

# Export to YAML
result = introspector.export_to_yaml(config)

# Generate discovery report
report = introspector.generate_discovery_report(config)
puts report
```

**Key Methods:**
- `discover_polymorphic_types` - Main discovery method
- `export_to_yaml(config, path)` - Export configuration to file
- `generate_discovery_report(config)` - Create human-readable report

### PolymorphicConfigLoader

Service for loading and processing the YAML configuration during model generation:

```ruby
loader = Zero::Generators::PolymorphicConfigLoader.new

# Check if table has polymorphic associations
loader.has_polymorphic_associations?('notes') # => true

# Get associations for a table
associations = loader.polymorphic_associations_for_table('notes')

# Generate TypeScript imports and static blocks
import_stmt = loader.polymorphic_import_statement('notes')
static_block = loader.polymorphic_static_block('notes')
```

## Manual Configuration

### Adding Custom Types

You can manually add polymorphic types to the configuration:

```yaml
:polymorphic_associations:
  notes.notable:
    :discovered_types:
    - Task
    - CustomType  # Manually added
    :mapped_tables:
    - tasks
    - custom_types
```

### Excluding Types

Create manual overrides to exclude discovered types:

```yaml
:polymorphic_associations:
  notes.notable:
    :discovered_types:
    - Task
    # Job excluded manually even if found in database
    :excluded_types:
    - Job
```

## Model Generation Integration

The polymorphic system integrates with the existing model generation workflow:

### Before (Manual)
```typescript
export class Note extends BaseModel {
  static tableName = 'notes';
  
  // Hardcoded relationships
  notableJob?: Job;
  notableTask?: Task;
  notableClient?: Client;
}
```

### After (Automated)
```typescript
export const Note = createActiveRecord<NoteData>(NoteConfig);

// Dynamic polymorphic relationships
declarePolymorphicRelationships({
  tableName: 'notes',
  belongsTo: {
    notable: {
      typeField: 'notable_type',
      idField: 'notable_id',
      allowedTypes: ['task'] // From YAML config
    }
  }
});
```

## Commands and Scripts

### Discovery Commands

```bash
# Basic discovery
rails runner "ZeroSchemaGenerator::PolymorphicIntrospector.new.discover_polymorphic_types"

# Discovery with custom output path
rails runner "
  introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new
  config = introspector.discover_polymorphic_types
  introspector.export_to_yaml(config, 'config/custom_polymorphic.yml')
"

# Generate discovery report
rails runner "
  introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new
  config = introspector.discover_polymorphic_types
  puts introspector.generate_discovery_report(config)
"
```

### Configuration Management

```bash
# Load and validate configuration
rails runner "
  loader = Zero::Generators::PolymorphicConfigLoader.new
  puts 'Configuration loaded:' + loader.loaded?.to_s
  puts 'Summary:' + loader.summary.to_json
"

# List tables with polymorphic associations
rails runner "
  loader = Zero::Generators::PolymorphicConfigLoader.new
  puts 'Tables with polymorphic associations:'
  loader.tables_with_polymorphic_associations.each { |table| puts '  ' + table }
"

# Get polymorphic associations for specific table
rails runner "
  loader = Zero::Generators::PolymorphicConfigLoader.new
  associations = loader.polymorphic_associations_for_table('notes')
  puts associations.to_json
"
```

### Model Generation

```bash
# Generate all models (includes polymorphic declarations)
rails generate zero:active_models

# Generate specific model
rails generate zero:active_model Note

# Generate with verbose output
VERBOSE=1 rails generate zero:active_models
```

## Advanced Usage

### Custom Model Discovery

For applications with non-standard model patterns, you can customize the discovery process:

```ruby
class CustomPolymorphicIntrospector < ZeroSchemaGenerator::PolymorphicIntrospector
  private

  def discover_models
    # Custom logic to discover models
    # Override the default model discovery
    super + additional_models
  end
end
```

### Conditional Generation

Control polymorphic generation based on environment or feature flags:

```ruby
# In your configuration
ZeroSchemaGenerator.configure do |config|
  config.enable_polymorphic_generation = Rails.env.production?
  config.polymorphic_config_path = 'config/polymorphic_production.yml'
end
```

### Integration with CI/CD

Add polymorphic discovery to your deployment pipeline:

```bash
#!/bin/bash
# deploy.sh

echo "Discovering polymorphic types..."
rails runner "
  introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new
  config = introspector.discover_polymorphic_types
  result = introspector.export_to_yaml(config)
  puts \"✅ Exported #{result[:associations_count]} associations, #{result[:types_count]} types\"
"

echo "Generating models with polymorphic support..."
rails generate zero:active_models

echo "Running polymorphic integration tests..."
rails test:integration test/integration/polymorphic_model_generation_test.rb
```

## Testing

### Running Tests

```bash
# Test polymorphic config loader
rails test test/lib/generators/zero/active_models/polymorphic_config_loader_test.rb

# Test integration
rails test test/integration/polymorphic_model_generation_test.rb

# Test specific polymorphic functionality
rails test -n test_generated_models_include_polymorphic_declarations
```

### Test Your Configuration

```ruby
# In Rails console or test
loader = Zero::Generators::PolymorphicConfigLoader.new

# Verify configuration loads
assert loader.loaded?
assert loader.config_data.present?

# Test specific associations
associations = loader.polymorphic_associations_for_table('notes')
assert associations.any?

# Test generated content
import_stmt = loader.polymorphic_import_statement('notes')
static_block = loader.polymorphic_static_block('notes')
assert static_block.include?('declarePolymorphicRelationships')
```

## Troubleshooting

### Common Issues

#### 1. Configuration File Not Found
**Error**: `Configuration file not found`
**Solution**: Run discovery first:
```bash
rails runner "ZeroSchemaGenerator::PolymorphicIntrospector.new.discover_polymorphic_types"
```

#### 2. Missing Polymorphic Declarations in Generated Models
**Problem**: Models don't include `declarePolymorphicRelationships` calls
**Check**:
1. Configuration file exists: `ls -la config/zero_polymorphic_types.yml`
2. Table has polymorphic associations in config
3. Generator is using latest version

**Debug**:
```ruby
loader = Zero::Generators::PolymorphicConfigLoader.new
puts "Loaded: #{loader.loaded?}"
puts "Tables: #{loader.tables_with_polymorphic_associations}"
puts "Associations: #{loader.polymorphic_associations_for_table('your_table')}"
```

#### 3. Database Connection Errors During Discovery
**Error**: `ActiveRecord::StatementInvalid`
**Solution**: 
1. Check database is running and accessible
2. Run `rails db:migrate` to ensure schema is up to date
3. Check database permissions

#### 4. STI Types Not Detected Correctly
**Problem**: Single Table Inheritance types not properly mapped
**Solution**: Check the STI patterns in the discovery report:
```ruby
introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new
config = introspector.discover_polymorphic_types
puts introspector.generate_discovery_report(config)
# Look for "STI PATTERNS:" section
```

#### 5. Generated TypeScript Has Import Errors
**Error**: `Cannot resolve module '../zero/polymorphic'`
**Solution**: Ensure EP-0035 polymorphic tracking system is installed:
1. Check `frontend/src/lib/zero/polymorphic/` exists
2. Verify `declarePolymorphicRelationships` is exported
3. Update import paths if needed

### Debugging Discovery Process

Enable detailed logging:
```ruby
Rails.logger.level = :debug

introspector = ZeroSchemaGenerator::PolymorphicIntrospector.new
config = introspector.discover_polymorphic_types
```

Check discovered data:
```ruby
# Inspect raw configuration
pp config[:polymorphic_associations]

# Check specific association
association_key = 'notes.notable'
pp config[:polymorphic_associations][association_key.to_sym]
```

### Performance Considerations

For large databases, discovery may take time. Optimize by:

1. **Limiting Model Scope**: Override `discover_models` to scan only relevant models
2. **Database Indexing**: Ensure polymorphic type columns are indexed
3. **Caching Results**: Store configuration and regenerate only when needed

```sql
-- Add indexes for polymorphic columns
CREATE INDEX idx_notes_notable_type ON notes(notable_type);
CREATE INDEX idx_activity_logs_loggable_type ON activity_logs(loggable_type);
```

## Migration Guide

### From Hardcoded to Discovered Types

1. **Backup Current Models**: Save your existing generated models
2. **Run Discovery**: Generate the polymorphic configuration
3. **Compare Output**: Check differences between old and new generated models
4. **Test Integration**: Run your test suite to ensure compatibility
5. **Deploy Gradually**: Update models incrementally if needed

### Migrating Existing Polymorphic Code

**Before**:
```typescript
// Manual polymorphic relationship
export class Note {
  notableJob?: Job;
  notableTask?: Task;
  
  getNotable(): Job | Task | null {
    // Manual logic
  }
}
```

**After**:
```typescript
// Generated polymorphic relationship
declarePolymorphicRelationships({
  tableName: 'notes',
  belongsTo: {
    notable: {
      typeField: 'notable_type',
      idField: 'notable_id',
      allowedTypes: ['job', 'task']
    }
  }
});

// Use polymorphic tracker API
const notable = PolymorphicTracker.query('notes', noteId).belongsTo('notable');
```

## Integration with EP-0035

This system is designed to work seamlessly with the Zero.js Polymorphic Tracking System:

- **Generated models** automatically call `declarePolymorphicRelationships`
- **Discovered types** become `allowedTypes` in the polymorphic system
- **Database statistics** inform the tracking system about usage patterns
- **STI patterns** are properly mapped to table names

For more details on using the polymorphic tracking APIs, see the [EP-0035 documentation](../frontend/src/lib/zero/polymorphic/).

## Contributing

### Adding New Discovery Features

1. Extend `PolymorphicIntrospector` with new detection logic
2. Update YAML structure to include new data
3. Modify `PolymorphicConfigLoader` to process new data
4. Add tests for new functionality

### Improving Generation Templates

1. Update template generation in `PolymorphicConfigLoader#polymorphic_static_block`
2. Test with various association patterns
3. Ensure TypeScript type safety
4. Validate integration with polymorphic tracking system

---

This documentation covers the complete polymorphic integration system. For specific implementation details, see the source code and tests in:

- `lib/zero_schema_generator/polymorphic_introspector.rb`
- `lib/generators/zero/active_models/polymorphic_config_loader.rb`
- `test/lib/generators/zero/active_models/polymorphic_config_loader_test.rb`
- `test/integration/polymorphic_model_generation_test.rb`