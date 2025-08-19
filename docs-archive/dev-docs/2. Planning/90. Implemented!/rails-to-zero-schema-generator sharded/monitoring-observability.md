# Monitoring & Observability

## Generation Metrics

```ruby
class GenerationMetrics
  def self.track_generation(duration:, tables_count:, relationships_count:)
    StatsD.timing('zero_schema.generation.duration', duration)
    StatsD.gauge('zero_schema.generation.tables_count', tables_count)
    StatsD.gauge('zero_schema.generation.relationships_count', relationships_count)
  end
  
  def self.track_validation_failure(error_type:, error_count:)
    StatsD.increment('zero_schema.validation.failure', tags: ["type:#{error_type}"])
    StatsD.gauge('zero_schema.validation.error_count', error_count)
  end
end
```

## Health Checks

```ruby
class SchemaHealthChecker
  def self.check_schema_sync
    last_generation = File.mtime(ZeroConfig.schema_path)
    last_migration = File.mtime('db/schema.rb')
    
    if last_migration > last_generation
      { status: :warning, message: 'Zero schema may be out of sync' }
    else
      { status: :healthy, message: 'Schema in sync' }
    end
  end
end
```
