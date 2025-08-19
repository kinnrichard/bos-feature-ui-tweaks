# Technical Architecture

## Core Components

### 1. Rails Schema Introspector

**Responsibility:** Extract complete schema information from Rails database

```ruby
class RailsSchemaIntrospector
  def extract_schema
    {
      tables: extract_tables,
      relationships: extract_relationships,
      indexes: extract_indexes,
      constraints: extract_constraints
    }
  end
  
  private
  
  def extract_tables
    ActiveRecord::Base.connection.tables.map do |table_name|
      next if excluded_table?(table_name)
      
      {
        name: table_name,
        columns: extract_columns(table_name),
        primary_key: extract_primary_key(table_name),
        foreign_keys: extract_foreign_keys(table_name)
      }
    end.compact
  end
  
  def excluded_table?(table_name)
    EXCLUDED_TABLES.include?(table_name)
  end
end
```

**Excluded Tables:**
- `solid_*` (Rails background job infrastructure)
- `refresh_tokens`, `revoked_tokens` (auth infrastructure)
- `unique_ids` (Rails-specific infrastructure)

### 2. Type Mapping Engine

**Responsibility:** Convert Rails column types to Zero column types

```ruby
class TypeMapper
  TYPE_MAPPINGS = {
    # UUID handling
    uuid: -> { 'string()' },
    
    # Rails enum to Zero string
    integer: ->(column) { 
      if enum_column?(column)
        'string()'  # Rails enums become Zero strings
      else
        'number()'
      end
    },
    
    # JSONB support
    jsonb: -> { 'json()' },
    
    # Temporal types
    datetime: -> { 'string()' },  # ISO 8601 strings
    date: -> { 'string()' },
    time: -> { 'string()' },
    
    # Standard types
    string: -> { 'string()' },
    text: -> { 'string()' },
    boolean: -> { 'boolean()' },
    decimal: -> { 'number()' }
  }.freeze
  
  def map_column(column)
    mapper = TYPE_MAPPINGS[column.type]
    return 'string()' unless mapper
    
    result = mapper.call(column)
    result += '.optional()' if column.null
    result
  end
end
```

### 3. Relationship Analyzer

**Responsibility:** Convert Rails associations to Zero relationships

```ruby
class RelationshipAnalyzer
  def analyze_model_relationships(model_class)
    {
      belongs_to: extract_belongs_to(model_class),
      has_many: extract_has_many(model_class),
      has_one: extract_has_one(model_class),
      polymorphic: extract_polymorphic(model_class)
    }
  end
  
  private
  
  def extract_belongs_to(model_class)
    model_class.reflections.select { |_, r| r.belongs_to? }.map do |name, reflection|
      {
        name: name,
        foreign_key: reflection.foreign_key,
        target_table: reflection.table_name,
        optional: reflection.options[:optional] || false
      }
    end
  end
  
  # Handle polymorphic associations specially
  def extract_polymorphic(model_class)
    model_class.reflections.select { |_, r| r.polymorphic? }.map do |name, reflection|
      {
        name: name,
        type_column: "#{name}_type",
        id_column: "#{name}_id",
        strategy: :polymorphic_union  # How to handle in Zero
      }
    end
  end
end
```

### 4. Zero Schema Generator

**Responsibility:** Generate Zero TypeScript schema from Rails schema

```ruby
class ZeroSchemaGenerator
  def generate_schema(rails_schema)
    tables = generate_tables(rails_schema[:tables])
    relationships = generate_relationships(rails_schema[:relationships])
    
    template = ERB.new(ZERO_SCHEMA_TEMPLATE)
    template.result(binding)
  end
  
  private
  
  def generate_table(table_info)
    columns = table_info[:columns].map { |col| generate_column(col) }
    
    <<~TYPESCRIPT
      const #{table_info[:name].singularize} = table('#{table_info[:name]}')
        .columns({
          #{columns.join(",\n    ")}
        })
        .primaryKey('#{table_info[:primary_key]}');
    TYPESCRIPT
  end
  
  def generate_column(column)
    zero_type = TypeMapper.new.map_column(column)
    "#{column[:name]}: #{zero_type}"
  end
end
```

## Schema Template System

```typescript
// Generated Zero Schema Template
import { 
  createSchema, 
  table, 
  string, 
  number, 
  boolean, 
  json,
  relationships
} from '@rocicorp/zero';

<% tables.each do |table| %>
// <%= table[:name].humanize %> table
<%= generate_table(table) %>
<% end %>

<% relationships.each do |rel| %>
// <%= rel[:name] %> relationships
<%= generate_relationship(rel) %>
<% end %>

// Create the complete schema
export const schema = createSchema({
  tables: [
    <%= table_names.join(",\n    ") %>
  ],
  relationships: [
    <%= relationship_names.join(",\n    ") %>
  ],
});

export type ZeroClient = Zero<typeof schema>;
```
