# Error Handling & Validation

## Schema Validation Pipeline

```ruby
class SchemaValidator
  def validate_generated_schema(zero_schema, rails_schema)
    validations = [
      validate_table_completeness(zero_schema, rails_schema),
      validate_type_consistency(zero_schema, rails_schema),
      validate_relationship_integrity(zero_schema, rails_schema),
      validate_constraint_preservation(zero_schema, rails_schema)
    ]
    
    ValidationReport.new(validations)
  end
  
  private
  
  def validate_table_completeness(zero_schema, rails_schema)
    expected_tables = rails_schema.tables.reject { |t| excluded_table?(t.name) }
    actual_tables = zero_schema.tables
    
    missing = expected_tables - actual_tables
    extra = actual_tables - expected_tables
    
    {
      status: missing.empty? && extra.empty? ? :pass : :warn,
      missing_tables: missing,
      extra_tables: extra
    }
  end
end
```

## Migration Safety Checks

```ruby
class MigrationSafetyChecker
  def check_breaking_changes(old_schema, new_schema)
    breaking_changes = []
    
    # Check for removed tables
    removed_tables = old_schema.tables.keys - new_schema.tables.keys
    breaking_changes += removed_tables.map { |t| "Removed table: #{t}" }
    
    # Check for column type changes
    type_changes = detect_type_changes(old_schema, new_schema)
    breaking_changes += type_changes
    
    # Check for relationship changes
    relationship_changes = detect_relationship_changes(old_schema, new_schema)
    breaking_changes += relationship_changes
    
    BreakingChangeReport.new(breaking_changes)
  end
end
```
