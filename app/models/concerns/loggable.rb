# frozen_string_literal: true

module Loggable
  extend ActiveSupport::Concern

  included do
    has_many :activity_logs, as: :loggable, dependent: :destroy

    after_create :log_creation
    after_update :log_update
  end

  def log_action(action, user: nil, metadata: {})
    user ||= User.current_user if defined?(User.current_user)
    return unless user

    # Ensure user exists in database before creating activity log
    return unless user.persisted?

    # Skip if activity logging is disabled (e.g., during test setup)
    return if Rails.env.test? && ENV["DISABLE_ACTIVITY_LOGGING"] == "true"

    ActivityLog.create!(
      user: user,
      action: action,
      loggable: self,
      client: associated_client,
      job: associated_job,
      metadata: metadata
    )
  end

  private

  def log_creation
    return unless User.current_user
    return if Rails.env.test? && ENV["DISABLE_ACTIVITY_LOGGING"] == "true"
    log_action("created")
  end

  def log_update
    return unless User.current_user
    return if Rails.env.test? && ENV["DISABLE_ACTIVITY_LOGGING"] == "true"
    return if saved_changes.keys == [ "updated_at" ] # Skip if only timestamp changed

    changes_data = {}
    saved_changes.except("created_at", "updated_at").each do |field, values|
      changes_data[field] = values
    end

    # Handle special cases
    if saved_changes["status"]
      log_action("status_changed", metadata: {
        old_status: saved_changes["status"][0],
        new_status: saved_changes["status"][1],
        new_status_label: status_label
      })
    elsif saved_changes["name"] && is_a?(Client)
      log_action("renamed", metadata: {
        old_name: saved_changes["name"][0]
      })
    elsif saved_changes["title"] && (is_a?(Job) || is_a?(Task))
      log_action("renamed", metadata: {
        old_name: saved_changes["title"][0]
      })
    elsif changes_data.any?
      log_action("updated", metadata: { changes: changes_data })
    end
  end

  def associated_client
    case self
    when Client
      self
    when Job, Person, Device
      client
    when Task
      job&.client
    when ScheduledDateTime
      # ScheduledDateTime uses polymorphic schedulable association
      schedulable.is_a?(Job) ? schedulable.client : nil
    when Note
      notable.respond_to?(:associated_client) ? notable.associated_client : nil
    when User
      # Users don't belong to a client
      nil
    else
      nil
    end
  end

  def associated_job
    case self
    when Job
      self
    when Task
      job
    when ScheduledDateTime
      # ScheduledDateTime uses polymorphic schedulable association
      schedulable.is_a?(Job) ? schedulable : nil
    when Note
      notable.respond_to?(:associated_job) ? notable.associated_job : nil
    when Person, Device, User
      # These don't directly belong to jobs
      nil
    else
      nil
    end
  end

  def status_label
    case self
    when Job
      JobStatus.find(status)&.label || status.humanize
    when Task
      TaskStatus.find(status)&.label || status.humanize
    else
      status.humanize if respond_to?(:status)
    end
  end
end
