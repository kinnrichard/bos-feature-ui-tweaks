class FrontConversation < ApplicationRecord
  # Associations
  has_many :front_messages, dependent: :destroy
  has_many :front_conversation_tags, dependent: :destroy
  has_many :front_tags, through: :front_conversation_tags
  has_many :front_conversation_inboxes, dependent: :destroy
  has_many :front_inboxes, through: :front_conversation_inboxes
  has_many :front_conversation_tickets, dependent: :destroy
  has_many :front_tickets, through: :front_conversation_tickets

  belongs_to :assignee, class_name: "FrontTeammate", optional: true
  belongs_to :recipient_contact, class_name: "FrontContact", optional: true

  # Association with ContactMethod via normalized handle matching
  belongs_to :matched_contact, -> { where("contact_type IN ('phone', 'email')") },
             class_name: "ContactMethod",
             primary_key: "normalized_value",
             foreign_key: "recipient_handle",
             optional: true

  # Direct join table associations
  has_many :people_front_conversations, class_name: "PersonFrontConversation", dependent: :destroy
  has_many :people, through: :people_front_conversations

  has_many :clients_front_conversations, class_name: "ClientFrontConversation", dependent: :destroy
  has_many :clients, through: :clients_front_conversations

  # Validations
  validates :front_id, presence: true, uniqueness: true
  validates :status, presence: true

  # Scopes
  scope :unassigned, -> { where(status: "unassigned") }
  scope :assigned, -> { where(status: "assigned") }
  scope :archived, -> { where(status: "archived") }
  scope :open, -> { where(status_category: "open") }
  scope :recent, -> { order(created_at_timestamp: :desc) }
  scope :needs_message_sync, -> {
    left_joins(:front_messages)
      .where.not(last_message_front_id: nil)
      .where("NOT EXISTS (
        SELECT 1 FROM front_messages
        WHERE front_messages.front_conversation_id = front_conversations.id
        AND front_messages.front_id = front_conversations.last_message_front_id
      )")
  }
  scope :with_client_data, -> { includes(matched_contact: { person: :client }) }

  # Class methods for bulk operations
  def self.download_all_messages(batch_size: 100)
    results = { total: 0, success: 0, failed: 0, errors: [] }

    find_each(batch_size: batch_size) do |conversation|
      begin
        result = conversation.download_messages
        results[:total] += 1

        if result[:success]
          results[:success] += 1
        else
          results[:failed] += 1
          results[:errors] << {
            conversation_id: conversation.front_id,
            error: result[:error] || "Unknown error"
          }
        end
      rescue => e
        results[:failed] += 1
        results[:errors] << {
          conversation_id: conversation.front_id,
          error: e.message
        }
      end
    end

    results
  end

  def self.sync_outdated_messages(batch_size: 100)
    needs_message_sync.find_each(batch_size: batch_size).map(&:sync_messages_if_needed)
  end

  # Helper methods
  def created_time
    Time.at(created_at_timestamp) if created_at_timestamp
  end

  def waiting_since_time
    Time.at(waiting_since_timestamp) if waiting_since_timestamp
  end

  def primary_inbox
    front_inboxes.first
  end

  # Sync methods
  def download_messages
    raise ArgumentError, "Cannot download messages without front_id" if front_id.blank?

    service = FrontSync::MessageSyncService.new

    Rails.logger.tagged("FrontConversation##{id}") do
      Rails.logger.info "Downloading messages for conversation #{front_id}"

      # Use the public method which takes an array
      result = service.sync_for_conversations([ front_id ])

      # Log the outcome
      if result[:failed] > 0
        Rails.logger.warn "Message sync completed with errors: #{result[:failed]} failed"
      else
        Rails.logger.info "Message sync successful: #{result[:created]} new, #{result[:updated]} updated"
      end

      # Return a structured response
      {
        success: result[:failed] == 0,
        conversation_id: front_id,
        messages: {
          created: result[:created],
          updated: result[:updated],
          failed: result[:failed],
          errors: result[:errors],
          total: front_messages.reload.count
        },
        timestamp: Time.current
      }
    end
  rescue => e
    Rails.logger.error "Failed to download messages for conversation #{front_id}: #{e.message}"
    {
      success: false,
      conversation_id: front_id,
      error: e.message,
      timestamp: Time.current
    }
  end

  # Check if messages need updating based on last_message_front_id
  def messages_need_update?
    return true if front_messages.empty? && last_message_front_id.present?
    return false if last_message_front_id.blank?

    # Check if we have the last message
    !front_messages.exists?(front_id: last_message_front_id)
  end

  # Download messages only if needed
  def sync_messages_if_needed
    return { success: true, skipped: true, reason: "Already up to date" } unless messages_need_update?

    download_messages
  end
end
