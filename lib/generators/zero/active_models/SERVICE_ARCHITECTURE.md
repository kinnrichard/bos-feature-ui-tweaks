# Zero ActiveModels Generator - Service Architecture Documentation

## Overview

The Zero ActiveModels Generator has been completely refactored to implement a professional service architecture with excellent separation of concerns, dependency injection, and optimized performance. This document outlines the complete service architecture and its implementation.

## Architecture Principles

### 1. Single Responsibility Principle
Each service has a focused, well-defined responsibility:
- **SchemaService**: Schema extraction and filtering
- **ConfigurationService**: Configuration management and validation
- **FileManager**: File operations and semantic comparison
- **TemplateRenderer**: ERB template rendering with caching
- **TypeMapper**: Rails to TypeScript type mapping
- **RelationshipProcessor**: Rails relationship processing
- **ServiceRegistry**: Service lifecycle and dependency management
- **GenerationCoordinator**: Workflow orchestration

### 2. Dependency Injection
Services receive their dependencies through constructor injection, managed by the ServiceRegistry.

### 3. Interface Segregation
Each service exposes only the methods relevant to its consumers.

### 4. Inversion of Control
The GenerationCoordinator doesn't instantiate services directly; it uses the ServiceRegistry for service management.

## Service Catalog

### Core Services

#### 1. **ServiceRegistry** 
*Service lifecycle and dependency management*

**Location**: `lib/generators/zero/active_models/service_registry.rb`

**Responsibilities**:
- Service initialization with proper dependency injection
- Service lifecycle management (start, stop, cleanup)
- Dependency resolution and circular dependency detection
- Health monitoring and service status reporting
- Performance optimization through service reuse
- Configuration propagation to all services

**Key Methods**:
- `get_service(service_name)` - Lazy service initialization
- `health_check()` - Comprehensive health monitoring
- `aggregate_service_statistics()` - Performance metrics aggregation
- `shutdown_all_services()` - Graceful shutdown

**Dependencies**: None (root service)

#### 2. **ConfigurationService**
*Comprehensive configuration management*

**Location**: `lib/generators/zero/active_models/configuration_service.rb`

**Responsibilities**:
- Configuration loading from files and defaults
- Environment-specific configuration management
- Configuration validation and error reporting
- Dynamic configuration updates and persistence
- Configuration schema enforcement

**Key Methods**:
- `excluded_tables()` - Get excluded table list
- `enable_prettier?()` - Check if Prettier is enabled
- `enable_template_caching?()` - Check template caching status
- `update_config(key, value)` - Update configuration values
- `validate_configuration!()` - Validate current configuration

**Dependencies**: None

**Configuration Features**:
- Environment-specific overrides (development, production, test)
- Validation with detailed error messages
- YAML file persistence
- Performance optimizations per environment

#### 3. **SchemaService**
*Schema extraction and filtering*

**Location**: `lib/generators/zero/active_models/schema_service.rb`

**Responsibilities**:
- Schema data extraction and caching
- Table filtering and exclusion logic
- Schema validation and integrity checking
- Pattern detection aggregation
- Performance optimization for repeated operations

**Key Methods**:
- `extract_filtered_schema(options)` - Extract and filter schema
- `schema_for_table(table_name)` - Get specific table schema
- `detect_patterns_for_table(table_name)` - Pattern detection
- `available_tables(options)` - Get available table list
- `validate_tables_exist(table_names)` - Table existence validation

**Dependencies**: `:configuration`

**Features**:
- Schema caching for performance
- Comprehensive filtering options
- Pattern detection integration
- Health monitoring

#### 4. **FileManager**
*File operations with semantic comparison*

**Location**: `lib/generators/zero/active_models/file_manager.rb`

**Responsibilities**:
- Content normalization and semantic comparison
- Smart file creation with change detection
- Prettier formatting integration
- Directory management
- File operation statistics

**Key Methods**:
- `write_with_formatting(path, content)` - Write with formatting
- `ensure_directory_exists(path)` - Directory creation
- `statistics()` - File operation metrics
- `semantic_comparison_enabled?()` - Check comparison settings

**Dependencies**: `:configuration`

**Features**:
- Semantic content comparison (ignores timestamps)
- Automatic Prettier integration
- Performance statistics
- Comprehensive error handling

#### 5. **TemplateRenderer**
*ERB template rendering with caching*

**Location**: `lib/generators/zero/active_models/template_renderer.rb`

**Responsibilities**:
- Template existence validation with helpful error messages
- Centralized context building and variable management
- Performance metrics and optional template caching
- Development-mode template reloading
- Comprehensive error handling with debugging support

**Key Methods**:
- `render(template_name, context)` - Render ERB template
- `validate_template_exists!(template_name)` - Template validation
- `statistics()` - Performance metrics
- `clear_cache!()` - Cache management

**Dependencies**: `:configuration`

**Features**:
- Template caching with development reloading
- Performance metrics and cache hit ratios
- Comprehensive error messages
- Template discovery and validation

#### 6. **TypeMapper**
*Rails to TypeScript type mapping*

**Location**: `lib/generators/zero/active_models/type_mapper.rb`

**Responsibilities**:
- Rails column type to TypeScript type conversion
- Enhanced enum handling with validation
- Support for custom type mappings
- Extensible architecture for different deployment scenarios

**Key Methods**:
- `map_rails_type_to_typescript(rails_type, column)` - Type mapping
- `enum_type(column)` - Generate enum types
- `supported_rails_types()` - Get supported types
- `handles_unknown_types?()` - Unknown type handling

**Dependencies**: `:configuration`

**Features**:
- Comprehensive type mapping
- Enum support with validation
- Custom type overrides
- Unknown type handling

#### 7. **RelationshipProcessor**
*Rails relationship processing*

**Location**: `lib/generators/zero/active_models/relationship_processor.rb`

**Responsibilities**:
- Processing Rails model relationships
- Eliminating duplication in relationship iteration and validation logic
- Generating TypeScript relationship properties
- Creating relationship documentation and imports

**Key Methods**:
- `process_all()` - Process all relationship types
- `each_relationship(&block)` - Iterate through relationships
- Generated outputs: properties, imports, exclusions, documentation, registration

**Dependencies**: `:schema` (via factory pattern)

**Features**:
- Comprehensive relationship processing
- TypeScript property generation
- Import and documentation generation
- Factory pattern for per-use instantiation

### Orchestration Service

#### 8. **GenerationCoordinator**
*Workflow orchestration*

**Location**: `lib/generators/zero/active_models/generation_coordinator.rb`

**Responsibilities**:
- Schema extraction and filtering coordination
- Service initialization and dependency management
- Generation workflow orchestration across multiple tables
- Error handling and progress reporting coordination
- Results compilation and statistics aggregation

**Key Methods**:
- `execute()` - Main workflow orchestration
- `generate_model_set(table, schema_data)` - Generate model files
- `compile_results(generation_result, start_time)` - Results compilation

**Dependencies**: Uses ServiceRegistry for all service access

**Features**:
- Complete workflow orchestration
- ServiceRegistry integration
- Comprehensive error handling
- Performance statistics

## Service Dependencies

```
ServiceRegistry (root)
├── ConfigurationService (no dependencies)
├── SchemaService → ConfigurationService
├── FileManager → ConfigurationService  
├── TemplateRenderer → ConfigurationService
├── TypeMapper → ConfigurationService
└── RelationshipProcessor → SchemaService (factory pattern)

GenerationCoordinator → ServiceRegistry (uses all services)
```

## Dependency Resolution Order

1. **ConfigurationService** - Loads configuration and environment settings
2. **SchemaService** - Initializes with configuration-based caching settings
3. **FileManager** - Configures with output directories and formatting options
4. **TemplateRenderer** - Sets up with caching and error handling preferences
5. **TypeMapper** - Initializes with custom type mappings from configuration
6. **RelationshipProcessor** - Factory created per-use with schema dependencies

## Service Lifecycle Management

### Initialization
- Services are lazily initialized through ServiceRegistry
- Dependencies are resolved automatically
- Circular dependency detection prevents initialization loops
- Configuration is propagated to all dependent services

### Health Monitoring
- Each service implements health checking where applicable
- ServiceRegistry aggregates health status across all services
- Performance metrics are collected and aggregated
- Error tracking and reporting

### Cleanup
- Services can be shut down gracefully in reverse dependency order
- Resources are properly cleaned up
- Cache clearing and memory management

## Performance Optimizations

### Caching Strategy
- **Schema Caching**: Enabled in development and production
- **Template Caching**: Environment-specific configuration
- **Service Reuse**: ServiceRegistry reuses initialized services
- **Semantic Comparison**: File operations use semantic comparison to avoid unnecessary writes

### Environment-Specific Optimizations
- **Development**: Template caching enabled, detailed error reporting
- **Production**: Aggressive caching, minimal error reporting
- **Test**: Caching disabled for predictable test behavior

## Error Handling

### Service-Specific Errors
- Each service defines custom error types for better debugging
- Errors include contextual information and debugging details
- Error propagation maintains stack traces and context

### Registry-Level Error Handling
- Service initialization failures are captured and reported
- Dependency resolution errors include full dependency chains
- Health check failures trigger appropriate warnings

## Configuration Management

### Configuration Sources (Priority Order)
1. Command-line options
2. Environment variables
3. Configuration files (config/zero_generator.yml)
4. Environment-specific defaults
5. System defaults

### Environment-Specific Settings

#### Development
```yaml
template_settings:
  enable_caching: true
  error_handling: detailed
performance:
  enable_template_caching: true
file_operations:
  enable_prettier: true
```

#### Production
```yaml
template_settings:
  enable_caching: true
  error_handling: minimal
performance:
  enable_template_caching: true
  cache_ttl: 7200
```

#### Test
```yaml
template_settings:
  enable_caching: false
performance:
  enable_schema_caching: false
file_operations:
  enable_prettier: false
  force_overwrite: true
```

## Integration Points

### Rails Integration
- Automatic Rails environment detection
- Rails root directory detection for file operations
- ActiveRecord model introspection
- Rails enum validation and processing

### Zero.js Integration
- TypeScript model generation
- Schema file generation for Zero.js
- Relationship mapping for Zero.js queries
- Type-safe enum generation

### Development Tools Integration
- Prettier formatting integration
- ESLint-compliant code generation
- Semantic file comparison to reduce noise
- Performance monitoring and metrics

## Best Practices Implemented

### Service Design
- Single responsibility for each service
- Dependency injection through ServiceRegistry
- Interface segregation - services expose minimal public APIs
- Error handling with service-specific error types

### Performance
- Lazy service initialization
- Comprehensive caching strategies
- Service reuse to avoid repeated initialization
- Performance metrics collection and reporting

### Maintainability
- Clear service boundaries and responsibilities
- Comprehensive documentation and error messages
- Health monitoring and diagnostics
- Configuration validation and schema enforcement

### Testing
- Services are easily mockable due to dependency injection
- Each service can be tested in isolation
- Configuration service allows test-specific settings
- ServiceRegistry enables controlled test environments

## Migration from Legacy Architecture

The refactoring maintains backward compatibility while introducing the new service architecture:

1. **Gradual Migration**: GenerationCoordinator now uses ServiceRegistry but maintains the same public interface
2. **Configuration Compatibility**: Existing configuration files continue to work
3. **Performance Improvements**: New architecture provides better performance through caching and service reuse
4. **Enhanced Error Handling**: Better error messages and debugging information
5. **Extensibility**: New services can be easily added to the registry

## Future Enhancements

The service architecture is designed to support future enhancements:

1. **Plugin System**: Additional services can be registered for extended functionality
2. **Distributed Services**: Services could be moved to separate processes if needed
3. **Configuration UI**: The ConfigurationService could support a web-based configuration interface
4. **Advanced Caching**: More sophisticated caching strategies could be implemented
5. **Service Discovery**: Dynamic service discovery for plugin architectures

## Conclusion

The refactored service architecture provides:

- **Professional separation of concerns** with focused, single-responsibility services
- **Optimized performance** through intelligent caching and service reuse
- **Comprehensive error handling** with detailed diagnostics
- **Environment-specific configuration** for optimal behavior in different contexts
- **Extensible design** that supports future enhancements
- **Maintainable codebase** with clear service boundaries and dependencies

This architecture ensures the Zero ActiveModels Generator is production-ready, performant, and maintainable for long-term use.