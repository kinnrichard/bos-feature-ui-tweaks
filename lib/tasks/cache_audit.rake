# frozen_string_literal: true

namespace :cache do
  desc "Audit models for missing cache invalidation (touch relationships)"
  task audit: :environment do
    puts "🧪 Cache Invalidation Audit"
    puts "=" * 50

    issues = []
    recommendations = []

    # Get all models that inherit from ApplicationRecord
    models = ApplicationRecord.descendants.reject(&:abstract_class?)

    models.each do |model|
      # Skip models that don't have touchable concern
      next unless model.include?(Touchable)

      model.reflect_on_all_associations(:belongs_to).each do |association|
        association_name = association.name.to_s
        parent_class = association.class_name.safe_constantize rescue nil

        # Skip if parent class doesn't exist or isn't touchable
        next unless parent_class
        next if association.options[:polymorphic]

        # Check if this association should probably touch but doesn't
        should_touch = should_association_touch?(association_name, parent_class)
        has_touch = association.options[:touch] == true

        if should_touch && !has_touch
          issues << {
            model: model.name,
            association: association_name,
            parent: parent_class.name,
            severity: determine_severity(association_name, parent_class)
          }
        end

        # Check for explicit touch: false that might be problematic
        if association.options[:touch] == false && should_touch
          recommendations << {
            model: model.name,
            association: association_name,
            parent: parent_class.name,
            message: "Explicitly disabled touch - verify this is intentional"
          }
        end
      end
    end

    # Report findings
    if issues.empty?
      puts "✅ No cache invalidation issues found!"
    else
      puts "❌ Found #{issues.count} potential cache invalidation issues:"
      puts

      # Group by severity
      issues.group_by { |issue| issue[:severity] }.each do |severity, group|
        puts "#{severity_emoji(severity)} #{severity.upcase} (#{group.count}):"
        group.each do |issue|
          puts "   #{issue[:model]}##{issue[:association]} -> #{issue[:parent]}"
          puts "     Fix: Add `touch: true` to belongs_to :#{issue[:association]}"
        end
        puts
      end
    end

    if recommendations.any?
      puts "💡 Recommendations (#{recommendations.count}):"
      recommendations.each do |rec|
        puts "   #{rec[:model]}##{rec[:association]}: #{rec[:message]}"
      end
      puts
    end

    # Show models with touchable_config
    configured_models = models.select { |m| m.touchable_options.present? }
    if configured_models.any?
      puts "⚙️  Models with custom touchable configuration:"
      configured_models.each do |model|
        puts "   #{model.name}: #{model.touchable_options}"
      end
      puts
    end

    puts "📊 Audit Summary:"
    puts "   Total models: #{models.count}"
    puts "   Models with belongs_to: #{models.count { |m| m.reflect_on_all_associations(:belongs_to).any? }}"
    puts "   Potential issues: #{issues.count}"
    puts "   Recommendations: #{recommendations.count}"
  end

  desc "Show all touch relationships in the application"
  task relationships: :environment do
    puts "🔗 Touch Relationships Mapping"
    puts "=" * 50

    ApplicationRecord.descendants.reject(&:abstract_class?).each do |model|
      touch_associations = model.reflect_on_all_associations(:belongs_to)
                               .select { |assoc| assoc.options[:touch] }

      if touch_associations.any?
        puts "#{model.name}:"
        touch_associations.each do |assoc|
          puts "   #{assoc.name} -> #{assoc.class_name} (touch: true)"
        end
        puts
      end
    end
  end

  desc "Test cache invalidation for a specific model"
  task :test, [ :model_name, :id ] => :environment do |t, args|
    model_name = args[:model_name]
    record_id = args[:id]

    unless model_name && record_id
      puts "Usage: rails cache:test[ModelName,record_id]"
      puts "Example: rails cache:test[Task,123]"
      exit 1
    end

    model_class = model_name.constantize
    record = model_class.find(record_id)

    puts "🧪 Testing cache invalidation for #{model_name}##{record_id}"
    puts "=" * 50

    # Test each touch relationship
    record.class.reflect_on_all_associations(:belongs_to).each do |assoc|
      next unless assoc.options[:touch]

      parent = record.send(assoc.name)
      next unless parent

      puts "Testing #{assoc.name} -> #{parent.class.name}##{parent.id}"
      original_time = parent.updated_at

      # Make a small change to trigger touch
      record.touch
      parent.reload

      if parent.updated_at > original_time
        puts "   ✅ SUCCESS: Parent touched (#{original_time} -> #{parent.updated_at})"
      else
        puts "   ❌ FAILED: Parent not touched"
      end
    end
  end

  private

  def should_association_touch?(association_name, parent_class)
    # Check if the parent is a cacheable model that should be touched
    cacheable_models = %w[Job Client User Person Task]

    # Direct match
    return true if cacheable_models.include?(parent_class.name)

    # Pattern match (e.g., assigned_to pointing to User)
    cacheable_models.any? do |cacheable|
      association_name.include?(cacheable.downcase) ||
        parent_class.name == cacheable
    end
  end

  def determine_severity(association_name, parent_class)
    case parent_class.name
    when "Job"
      "critical"  # Job is the main cache entity
    when "Client", "User"
      "high"      # Major entities that affect display
    when "Task", "Person"
      "medium"    # Secondary entities
    else
      "low"       # Other associations
    end
  end

  def severity_emoji(severity)
    case severity
    when "critical" then "🚨"
    when "high" then "⚠️"
    when "medium" then "🔶"
    when "low" then "ℹ️"
    else "❓"
    end
  end
end
