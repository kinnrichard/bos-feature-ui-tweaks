# frozen_string_literal: true

# CacheInvalidation provides a declarative DSL for complex cache invalidation scenarios
#
# Usage:
#   class Task < ApplicationRecord
#     include CacheInvalidation
#
#     # Simple invalidation
#     invalidates_cache_for :job
#
#     # Conditional invalidation
#     invalidates_cache_for :job, if: :affects_job_display?
#
#     # Multiple targets
#     invalidates_cache_for :job, :client
#
#     # Custom callback timing
#     invalidates_cache_for :job, on: [:create, :update, :destroy]
#
#     # Through associations
#     invalidates_cache_for :client, through: :job
#   end

module CacheInvalidation
  extend ActiveSupport::Concern

  included do
    class_attribute :cache_invalidation_rules, default: []
  end

  class_methods do
    # Declare cache invalidation rules
    #
    # @param targets [Symbol, Array<Symbol>] The models/associations to invalidate
    # @param options [Hash] Configuration options
    # @option options [Symbol, Array<Symbol>] :on Callbacks to trigger on (:create, :update, :destroy)
    # @option options [Symbol, Proc] :if Condition for when to invalidate
    # @option options [Symbol, Proc] :unless Condition for when NOT to invalidate
    # @option options [Symbol] :through Association to traverse to reach target
    # @option options [Symbol] :method Custom method to call for invalidation
    def invalidates_cache_for(*targets, **options)
      # Normalize targets
      targets = Array(targets).flatten.map(&:to_sym)

      # Default options
      options = {
        on: [ :create, :update, :destroy ],
        if: nil,
        unless: nil,
        through: nil,
        method: :touch
      }.merge(options)

      # Store the rule
      rule = CacheInvalidationRule.new(targets, options)
      self.cache_invalidation_rules += [ rule ]

      # Set up callbacks
      Array(options[:on]).each do |callback_type|
        callback_method = case callback_type
        when :create then :after_create
        when :update then :after_update
        when :destroy then :after_destroy
        else callback_type
        end

        send(callback_method) do
          rule.execute(self)
        end
      end
    end

    # Show all cache invalidation rules for this model
    def cache_invalidation_summary
      return "No cache invalidation rules defined" if cache_invalidation_rules.empty?

      cache_invalidation_rules.map.with_index do |rule, index|
        "#{index + 1}. #{rule.summary}"
      end.join("\n")
    end
  end

  # Instance methods
  def invalidate_cache_for(*targets)
    targets.each do |target|
      case target
      when Symbol
        # Try to find association or method
        if respond_to?(target)
          obj = send(target)
          obj&.touch if obj&.respond_to?(:touch)
        end
      when ActiveRecord::Base
        target.touch
      end
    end
  end

  # Debugging method to see what would be invalidated
  def cache_invalidation_preview
    self.class.cache_invalidation_rules.map do |rule|
      targets = rule.resolve_targets(self)
      conditions_met = rule.conditions_met?(self)

      {
        rule: rule.summary,
        targets: targets.map { |t| "#{t.class.name}##{t.id}" },
        will_execute: conditions_met
      }
    end
  end
end

# Internal class to represent a cache invalidation rule
class CacheInvalidationRule
  attr_reader :targets, :options

  def initialize(targets, options)
    @targets = targets
    @options = options
  end

  def execute(record)
    return unless conditions_met?(record)

    resolved_targets = resolve_targets(record)
    invalidate_targets(resolved_targets)
  end

  def conditions_met?(record)
    # Check :if condition
    if options[:if]
      condition = options[:if]
      return false unless evaluate_condition(record, condition)
    end

    # Check :unless condition
    if options[:unless]
      condition = options[:unless]
      return false if evaluate_condition(record, condition)
    end

    true
  end

  def resolve_targets(record)
    targets.flat_map do |target|
      resolve_single_target(record, target)
    end.compact
  end

  def summary
    target_list = targets.join(", ")
    conditions = []
    conditions << "if: #{options[:if]}" if options[:if]
    conditions << "unless: #{options[:unless]}" if options[:unless]
    conditions << "through: #{options[:through]}" if options[:through]
    conditions << "on: #{Array(options[:on]).join(', ')}"

    condition_str = conditions.empty? ? "" : " (#{conditions.join(', ')})"
    "Invalidates #{target_list}#{condition_str}"
  end

  private

  def resolve_single_target(record, target)
    if options[:through]
      # Navigate through association first
      intermediate = record.send(options[:through])
      return nil unless intermediate

      if intermediate.respond_to?(target)
        intermediate.send(target)
      else
        intermediate
      end
    else
      # Direct association or method
      record.send(target) if record.respond_to?(target)
    end
  end

  def invalidate_targets(targets)
    targets.each do |target|
      case options[:method]
      when :touch
        target.touch if target.respond_to?(:touch)
      when Symbol
        target.send(options[:method]) if target.respond_to?(options[:method])
      when Proc
        options[:method].call(target)
      end
    end
  end

  def evaluate_condition(record, condition)
    case condition
    when Symbol
      record.send(condition)
    when Proc
      record.instance_eval(&condition)
    else
      !!condition
    end
  end
end
