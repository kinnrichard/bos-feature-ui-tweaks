# STORY-EP37-011: Performance Optimization and Benchmarks

**Story ID**: STORY-EP37-011  
**Epic**: EP-0037 (ReactiveRecord Generation Refactoring)  
**Type**: Optimization  
**Points**: 3  
**Priority**: P2 - Nice to Have  
**Status**: Open  
**Dependencies**: STORY-EP37-010 (Migration complete)  

## User Story

**As a** developer using the new pipeline  
**I want** performance equal to or better than the old system  
**So that** refactoring doesn't degrade user experience  

## Background

Following Sandi's principle: "Make it work, make it right, THEN make it fast"

Now that the pipeline works and is right, we can optimize:
- Measure current performance
- Identify bottlenecks
- Optimize hot paths
- Consider parallel execution

## Acceptance Criteria

### Performance Criteria
- [ ] Generation time within 10% of old system
- [ ] Memory usage reduced by 20%
- [ ] Support for parallel stage execution
- [ ] Batch operations optimized
- [ ] Caching where appropriate

### Measurement Criteria
- [ ] Benchmarks for all operations
- [ ] Performance regression tests
- [ ] Memory profiling complete
- [ ] Bottlenecks identified and addressed

### Documentation Criteria
- [ ] Performance guide created
- [ ] Optimization decisions documented
- [ ] Benchmark results published

## Technical Design

### Performance Benchmarking Suite
```ruby
# test/benchmarks/generation_benchmark.rb
require "benchmark/ips"
require "memory_profiler"

class GenerationBenchmark
  def self.run
    puts "ReactiveRecord Generation Performance Benchmark"
    puts "=" * 50
    
    benchmark_single_model
    benchmark_batch_generation
    benchmark_large_schema
    memory_profile
  end

  def self.benchmark_single_model
    puts "\n1. Single Model Generation"
    
    Benchmark.ips do |x|
      x.config(time: 5, warmup: 2)
      
      x.report("Old System") do
        old_coordinator.generate_single("users")
      end
      
      x.report("New Pipeline") do
        new_pipeline.generate_single("users")
      end
      
      x.compare!
    end
  end

  def self.benchmark_batch_generation
    puts "\n2. Batch Generation (50 models)"
    
    tables = generate_test_tables(50)
    
    Benchmark.ips do |x|
      x.report("Old System") do
        old_coordinator.generate_batch(tables)
      end
      
      x.report("New Pipeline") do
        new_pipeline.generate_batch(tables)
      end
      
      x.report("New Pipeline (Parallel)") do
        new_pipeline.generate_batch_parallel(tables)
      end
      
      x.compare!
    end
  end

  def self.memory_profile
    puts "\n3. Memory Usage Profile"
    
    report = MemoryProfiler.report do
      new_pipeline.generate_batch(generate_test_tables(20))
    end
    
    puts "Total allocated: #{report.total_allocated_memsize / 1024.0 / 1024.0} MB"
    puts "Total retained: #{report.total_retained_memsize / 1024.0 / 1024.0} MB"
    
    puts "\nTop 5 memory allocations:"
    report.allocated_memory_by_class.sort_by(&:last).reverse[0..4].each do |klass, size|
      puts "  #{klass}: #{size / 1024.0} KB"
    end
  end
end
```

### Parallel Stage Execution
```ruby
# lib/generators/zero/active_models/pipeline/parallel_pipeline.rb
module Zero
  module Generators
    module Pipeline
      class ParallelPipeline < Pipeline
        def execute(initial_context)
          # Identify parallelizable stages
          parallel_groups = group_parallel_stages(@stages)
          
          parallel_groups.reduce(initial_context) do |context, group|
            if group.size == 1
              # Single stage, run normally
              execute_stage(group.first, context)
            else
              # Multiple stages, run in parallel
              execute_parallel(group, context)
            end
          end
        end

        private

        def group_parallel_stages(stages)
          # Group stages that can run in parallel
          groups = []
          current_group = []
          
          stages.each do |stage|
            if stage.can_parallelize?
              current_group << stage
            else
              groups << current_group if current_group.any?
              groups << [stage]
              current_group = []
            end
          end
          
          groups << current_group if current_group.any?
          groups
        end

        def execute_parallel(stages, context)
          results = Parallel.map(stages, in_threads: stages.size) do |stage|
            execute_stage(stage, context)
          end
          
          # Merge results
          merge_contexts(context, results)
        end

        def merge_contexts(base_context, parallel_results)
          # Combine metadata from parallel executions
          merged_metadata = parallel_results.reduce({}) do |meta, result|
            meta.merge(result.metadata)
          end
          
          base_context.with_metadata(merged_metadata)
        end
      end
    end
  end
end
```

### Optimized Stages
```ruby
# Optimization 1: Lazy Loading
class SchemaAnalysisStage < Stage
  def process(context)
    # Only load schemas for requested tables
    tables = lazy_load_tables(context)
    # Process...
  end

  private

  def lazy_load_tables(context)
    return enum_for(:lazy_load_tables, context) unless block_given?
    
    tables_to_process.each do |table|
      yield load_table_schema(table)
    end
  end
end

# Optimization 2: Caching
class TypeMapper
  def initialize
    @cache = {}
  end

  def typescript_type_for(rails_type, column_name = nil)
    cache_key = "#{rails_type}:#{column_name}"
    @cache[cache_key] ||= compute_type(rails_type, column_name)
  end
end

# Optimization 3: Batch File Operations
class FileWriter
  def write_batch(files)
    # Group by directory to minimize syscalls
    files.group_by { |f| File.dirname(f[:path]) }.each do |dir, group|
      ensure_directory_exists(dir)
      
      # Write all files in directory at once
      group.each { |file| write_file_direct(file) }
    end
  end
end
```

### Performance Configuration
```ruby
# config/generation_performance.yml
development:
  parallel_stages: false
  cache_schemas: false
  batch_size: 10

staging:
  parallel_stages: true
  cache_schemas: true
  batch_size: 50

production:
  parallel_stages: true
  cache_schemas: true
  batch_size: 100
  memory_limit_mb: 500
```

## Implementation Steps

1. **Create benchmark suite** (1 hour)
   - Set up benchmark framework
   - Create test scenarios
   - Establish baseline metrics

2. **Profile current performance** (45 min)
   - Run benchmarks on old system
   - Identify bottlenecks
   - Document baseline

3. **Implement parallel execution** (1 hour)
   - Create ParallelPipeline
   - Identify parallelizable stages
   - Test parallel execution

4. **Add caching layer** (45 min)
   - Cache type mappings
   - Cache schema lookups
   - Cache formatted content

5. **Optimize hot paths** (45 min)
   - Lazy loading
   - Batch operations
   - Reduce allocations

6. **Validate improvements** (30 min)
   - Run benchmarks
   - Compare results
   - Document improvements

## Testing Requirements

### Performance Tests
```ruby
RSpec.describe "Performance" do
  it "generates single model within time limit" do
    expect {
      pipeline.generate("users")
    }.to perform_under(100).ms
  end

  it "uses less memory than old system" do
    expect {
      pipeline.generate_batch(tables)
    }.to allocate_less_than(old_system)
  end

  it "supports parallel execution" do
    parallel_time = measure { parallel_pipeline.execute }
    serial_time = measure { pipeline.execute }
    
    expect(parallel_time).to be < (serial_time * 0.7)
  end
end
```

## Definition of Done

- [ ] Benchmarks implemented
- [ ] Performance measured
- [ ] Optimizations applied
- [ ] Parallel execution working
- [ ] Performance goals met
- [ ] Documentation complete

## Performance Targets

### Single Model Generation
- Old System: ~50ms
- New Pipeline Target: ≤55ms
- New Pipeline Actual: ___

### Batch Generation (50 models)
- Old System: ~2000ms
- New Pipeline Target: ≤2000ms
- Parallel Pipeline Target: ≤1400ms

### Memory Usage
- Old System: ~100MB for 50 models
- New Pipeline Target: ≤80MB

## Notes

- Don't optimize prematurely
- Measure everything
- Focus on real bottlenecks
- Keep code readable despite optimizations