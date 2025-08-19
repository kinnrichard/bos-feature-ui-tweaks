# STORY-EP37-010: Implement Strangler Fig Migration

**Story ID**: STORY-EP37-010  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Migration  
**Points**: 5  
**Priority**: P0 - Critical Path  
**Status**: Open  
**Dependencies**: STORY-EP37-001 through STORY-EP37-009 (All refactoring complete)  

## User Story

**As a** developer migrating to the new pipeline architecture  
**I want** gradual migration using the strangler fig pattern  
**So that** the system remains functional throughout the refactoring  

## Background

Following Sandi Metz's incremental approach:
- Keep old GenerationCoordinator working
- Route specific operations through new pipeline
- Gradually migrate functionality
- Remove old code only when proven

This ensures zero downtime and easy rollback.

## Acceptance Criteria

### Implementation Criteria
- [ ] Create adapter layer between old and new systems
- [ ] Feature flag to control which system is used
- [ ] Gradual migration path documented
- [ ] Both systems can run in parallel
- [ ] Metrics to compare both systems

### Migration Criteria
- [ ] Phase 1: New pipeline handles single table generation
- [ ] Phase 2: New pipeline handles batch generation
- [ ] Phase 3: New pipeline becomes default
- [ ] Phase 4: Old system removed after validation period

### Validation Criteria
- [ ] Output identical between systems
- [ ] Performance metrics captured
- [ ] Error rates monitored
- [ ] Rollback procedure tested

## Technical Design

### Migration Adapter
```ruby
# lib/generators/zero/active_models/migration_adapter.rb
module Zero
  module Generators
    class MigrationAdapter
      def initialize(options, shell)
        @options = options
        @shell = shell
        @use_new_pipeline = feature_flag_enabled?
        
        if @use_new_pipeline
          @executor = build_new_pipeline
        else
          @executor = build_old_coordinator
        end
        
        # Always build both for comparison in canary mode
        if canary_mode?
          @new_pipeline = build_new_pipeline
          @old_coordinator = build_old_coordinator
        end
      end

      def execute
        if canary_mode?
          run_canary_comparison
        else
          @executor.execute
        end
      end

      private

      def feature_flag_enabled?
        ENV["USE_NEW_GENERATION_PIPELINE"] == "true" ||
          @options[:use_new_pipeline] ||
          Rails.configuration.x.use_new_generation_pipeline
      end

      def canary_mode?
        ENV["GENERATION_CANARY_MODE"] == "true" ||
          @options[:canary_mode]
      end

      def build_new_pipeline
        require_relative "pipeline/generation_pipeline"
        Pipeline::GenerationPipeline.new(
          options: @options,
          shell: @shell
        )
      end

      def build_old_coordinator
        require_relative "generation_coordinator"
        GenerationCoordinator.new(@options, @shell)
      end

      def run_canary_comparison
        # Run both systems and compare
        old_result = capture_result { @old_coordinator.execute }
        new_result = capture_result { @new_pipeline.execute }
        
        comparison = compare_results(old_result, new_result)
        log_comparison(comparison)
        
        # Return result from active system
        @use_new_pipeline ? new_result[:result] : old_result[:result]
      end

      def capture_result
        start_time = Time.current
        result = yield
        {
          result: result,
          duration: Time.current - start_time,
          memory: current_memory_usage
        }
      rescue => e
        { error: e, duration: Time.current - start_time }
      end

      def compare_results(old_result, new_result)
        {
          output_identical: compare_output(old_result, new_result),
          performance_diff: {
            time: new_result[:duration] - old_result[:duration],
            memory: new_result[:memory] - old_result[:memory]
          },
          errors: {
            old: old_result[:error],
            new: new_result[:error]
          }
        }
      end

      def compare_output(old_result, new_result)
        return false if old_result[:error] || new_result[:error]
        
        # Compare generated files
        old_files = extract_files(old_result[:result])
        new_files = extract_files(new_result[:result])
        
        old_files == new_files
      end

      def log_comparison(comparison)
        Rails.logger.info("Generation Canary Comparison:")
        Rails.logger.info("  Output Identical: #{comparison[:output_identical]}")
        Rails.logger.info("  Time Diff: #{comparison[:performance_diff][:time]}s")
        Rails.logger.info("  Memory Diff: #{comparison[:performance_diff][:memory]}MB")
        
        if !comparison[:output_identical]
          Rails.logger.warn("  OUTPUT MISMATCH DETECTED")
        end
      end
    end
  end
end
```

### Gradual Migration Strategy
```ruby
# lib/generators/zero/active_models/active_models_generator.rb
class ActiveModelsGenerator < Rails::Generators::Base
  def generate_models
    # Phase 1: Use adapter for migration
    adapter = MigrationAdapter.new(options, self)
    result = adapter.execute
    
    # Phase 2: Monitor and validate
    track_migration_metrics(result)
    
    # Phase 3: Switch default after validation
    # Phase 4: Remove old code after stability period
  end

  private

  def track_migration_metrics(result)
    Metrics.track("generation.completed", {
      pipeline: ENV["USE_NEW_GENERATION_PIPELINE"] ? "new" : "old",
      duration: result[:duration],
      models_generated: result[:models_count]
    })
  end
end
```

### Migration Phases

#### Phase 1: Canary Testing (Week 1)
```bash
# Run 10% of generations through new pipeline
GENERATION_CANARY_MODE=true rails generate zero:active_models

# Monitor comparison logs
tail -f log/development.log | grep "Canary Comparison"
```

#### Phase 2: Gradual Rollout (Week 2)
```ruby
# config/initializers/generation_pipeline.rb
Rails.configuration.x.use_new_generation_pipeline = 
  case Rails.env
  when "development"
    true  # All dev uses new pipeline
  when "staging"
    Random.rand < 0.5  # 50% on staging
  when "production"
    Random.rand < 0.1  # 10% on production
  end
```

#### Phase 3: Full Migration (Week 3)
```ruby
# Make new pipeline default
Rails.configuration.x.use_new_generation_pipeline = true

# Keep old code for emergency rollback
```

#### Phase 4: Cleanup (Week 4+)
```ruby
# After stability period, remove old code
# 1. Delete GenerationCoordinator
# 2. Delete ServiceRegistry
# 3. Delete old FileManager
# 4. Remove migration adapter
```

## Implementation Steps

1. **Create MigrationAdapter** (1 hour)
   - Feature flag support
   - Canary mode implementation
   - Result comparison logic

2. **Update generator entry point** (30 min)
   - Use MigrationAdapter
   - Add metrics tracking
   - Support rollback

3. **Implement comparison logic** (1 hour)
   - File content comparison
   - Performance metrics
   - Error tracking

4. **Add monitoring** (45 min)
   - Metrics collection
   - Logging improvements
   - Dashboard setup

5. **Create rollout plan** (30 min)
   - Document phases
   - Create runbooks
   - Define success criteria

6. **Test migration scenarios** (1.5 hours)
   - Test canary mode
   - Test rollback
   - Test gradual rollout

## Testing Requirements

### Unit Tests
```ruby
RSpec.describe MigrationAdapter do
  describe "feature flag" do
    it "uses old system by default"
    it "uses new system when flag enabled"
    it "supports canary mode"
  end

  describe "canary comparison" do
    it "runs both systems"
    it "compares output"
    it "logs differences"
    it "returns active system result"
  end
end
```

### Integration Tests
```ruby
it "produces identical output with both systems" do
  old_result = GenerationCoordinator.new(options).execute
  new_result = GenerationPipeline.new(options).execute
  
  expect(normalize(new_result)).to eq(normalize(old_result))
end
```

## Definition of Done

- [ ] MigrationAdapter implemented
- [ ] Feature flags working
- [ ] Canary mode functional
- [ ] Comparison metrics logged
- [ ] Rollback tested
- [ ] Documentation complete
- [ ] Runbooks created

## Success Metrics

- Output 100% identical between systems
- New pipeline within 10% of old performance
- Zero errors during migration
- Successful rollback demonstrated
- 2 weeks stable before cleanup

## Notes

- This is the safety net for the entire refactoring
- Take time to get comparison logic right
- Monitor closely during rollout
- Keep old code until absolutely certain