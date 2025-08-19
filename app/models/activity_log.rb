class ActivityLog < ApplicationRecord
  include PolymorphicUuidSupport

  belongs_to :user
  belongs_to :loggable, polymorphic: true, optional: true
  belongs_to :client, optional: true
  belongs_to :job, optional: true

  validates :action, presence: true

  # For easier querying
  scope :recent, -> { order(created_at: :desc) }
  scope :for_user, ->(user) { where(user: user) }
  scope :for_loggable, ->(loggable) { where(loggable: loggable) }
  scope :for_client, ->(client) { where(client: client) }

  # Generate human-readable log messages
  def message
    activity_type = ActivityType.find(action)

    case action
    when "created"
      "#{activity_type&.past_tense || action} #{loggable_type_emoji} #{loggable_name}"
    when "viewed"
      "#{activity_type&.past_tense || action} #{loggable_type_emoji} #{loggable_name}"
    when "renamed"
      "#{activity_type&.past_tense || action} #{metadata['old_name']} to #{metadata['name']}"
    when "updated"
      if metadata["changes"].present?
        # Filter out unimportant attributes
        filtered_changes = metadata["changes"].reject { |field, _|
          [ "position", "lock_version", "reordered_at", "parent_id" ].include?(field)
        }

        if filtered_changes.any?
          # Handle special field changes
          if filtered_changes.keys == [ "priority" ]
            # Priority changes
            old_priority = filtered_changes["priority"][0]
            new_priority = filtered_changes["priority"][1]
            priority_emoji = get_priority_emoji(new_priority)
            "marked #{loggable_type_emoji} #{loggable_name} as #{priority_emoji} #{new_priority.capitalize} Priority"
          elsif filtered_changes.keys == [ "assigned_to_id" ]
            # Assignment changes
            old_id = filtered_changes["assigned_to_id"][0]
            new_id = filtered_changes["assigned_to_id"][1]
            if new_id.blank?
              "unassigned #{loggable_type_emoji} #{loggable_name}"
            else
              if user = User.find_by(id: new_id)
                "assigned #{loggable_type_emoji} #{loggable_name} to #{user.name}"
              else
                "assigned #{loggable_type_emoji} #{loggable_name} to user ##{new_id}"
              end
            end
          else
            # Format other changes
            changes_text = filtered_changes.map { |field, values|
              format_field_change(field, values)
            }.join(", ")
            "#{activity_type&.past_tense || action} #{loggable_name}: #{changes_text}"
          end
        else
          # If only unimportant fields were changed, return nil to hide this log
          nil
        end
      else
        "#{activity_type&.past_tense || action} #{loggable_name}"
      end
    when "deleted"
      "#{activity_type&.past_tense || action} #{loggable_type_emoji} #{loggable_name}"
    when "assigned"
      "#{activity_type&.past_tense || action} #{loggable_type_emoji} #{loggable_name} to #{metadata['assigned_to']}"
    when "unassigned"
      "#{activity_type&.past_tense || action} #{metadata['unassigned_from']} from #{loggable_type_emoji} #{loggable_name}"
    when "status_changed"
      status_emoji = get_status_emoji(metadata["new_status"])
      "set #{loggable_type_emoji} #{loggable_name} to #{status_emoji} #{metadata['new_status_label']}"
    when "added"
      "#{activity_type&.past_tense || action} #{loggable_type_emoji} #{loggable_name} to #{metadata['parent_type']} #{metadata['parent_name']}"
    when "logged_in"
      "#{activity_type&.past_tense || 'signed into'} bŏs"
    when "logged_out"
      "#{activity_type&.past_tense || 'signed out of'} bŏs"
    else
      "#{activity_type&.icon || '•••'} #{action} #{loggable_name}"
    end
  end

  def loggable_type_emoji
    case loggable_type
    when "Client"
      loggable&.business? ? "🏢" : "🏠"
    when "Job"
      "💼"
    when "Task"
      "☑️"
    when "Person"
      "👤"
    else
      ""
    end
  end

  def activity_type_icon
    ActivityType.find(action)&.icon || "•••"
  end

  def loggable_name
    return "no metadata" if not metadata

    return metadata["name"] if metadata["name"].present?

    case loggable_type
    when "Client"
      loggable&.name || "Unknown Client"
    when "Job"
      loggable&.title || "Unknown Job"
    when "Task"
      loggable&.title || "Unknown Task"
    when "Person"
      person_name = (loggable&.name || "Unknown Person")
      "#{person_name} #{with_client_loggable_name}"
    else
      loggable_type
    end
  end

  private

  def with_client_loggable_name
    "with #{client_loggable_name}"
  end

  def client_loggable_name
    c = loggable.client
    e = c&.business? ? "🏢" : "🏠"
    "#{e} #{c.name}"
  end

  def get_status_emoji(status)
    # Try TaskStatus first, then JobStatus
    TaskStatus.find(status)&.emoji || JobStatus.find(status)&.emoji || ""
  end

  def get_priority_emoji(priority)
    # Use JobPriority for jobs, fallback to JobPriority for other types as well
    # since JobPriority is now the single source of truth
    JobPriority.find(priority)&.emoji || ""
  end

  def format_field_change(field, values)
    old_value = values[0]
    new_value = values[1]

    case field
    when "scheduled_date", "due_on", "start_on"
      # Format dates nicely
      old_formatted = old_value.present? ? Date.parse(old_value.to_s).strftime("%B %-d, %Y") : "none"
      new_formatted = new_value.present? ? Date.parse(new_value.to_s).strftime("%B %-d, %Y") : "none"
      "#{field.humanize.downcase} from #{old_formatted} to #{new_formatted}"
    when "scheduled_time", "due_time", "start_time"
      # Format times nicely
      old_formatted = old_value.present? ? Time.parse(old_value.to_s).strftime("%-I:%M %p") : "none"
      new_formatted = new_value.present? ? Time.parse(new_value.to_s).strftime("%-I:%M %p") : "none"
      "#{field.humanize.downcase} from #{old_formatted} to #{new_formatted}"
    when "person_id"
      # Show person names instead of IDs
      old_person = old_value.present? ? Person.find_by(id: old_value)&.name : "none"
      new_person = new_value.present? ? Person.find_by(id: new_value)&.name : "none"
      "assigned to #{new_person}" + (old_person != "none" ? " (was #{old_person})" : "")
    else
      # Default formatting
      "#{field.humanize.downcase} from '#{old_value}' to '#{new_value}'"
    end
  end
end
