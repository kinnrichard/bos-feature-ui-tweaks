class User < ApplicationRecord
  include Loggable

  has_secure_password validations: false

  has_many :activity_logs
  has_many :assigned_jobs, class_name: "Job", foreign_key: "assigned_to_id"
  has_many :assigned_tasks, class_name: "Task", foreign_key: "assigned_to_id"
  has_many :job_assignments
  has_many :technician_jobs, through: :job_assignments, source: :job
  has_many :scheduled_date_time_users, dependent: :destroy
  has_many :scheduled_date_times, through: :scheduled_date_time_users
  has_many :notes, dependent: :destroy
  has_many :refresh_tokens, dependent: :destroy
  has_many :revoked_tokens, dependent: :destroy

  enum :role, {
    admin: "admin",
    technician: "technician",
    customer_specialist: "customer_specialist",
    owner: "owner"
  }

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { case_sensitive: false }, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role, presence: true
  validates :password, length: { minimum: 6 }, if: :password_required?
  validates :short_name, uniqueness: { case_sensitive: false }, allow_blank: true

  before_validation :downcase_email
  before_validation :strip_name
  before_validation :generate_short_name, on: :create

  after_save :invalidate_technicians_cache, if: :should_invalidate_technicians_cache?
  after_destroy :invalidate_technicians_cache, if: :technician?

  # Thread-safe current user storage
  thread_cattr_accessor :current_user

  def can_delete?(resource)
    case resource
    when Device, Person
      # Only owners and admins can delete devices and people
      owner? || admin?
    when Job
      # Owners and admins can delete any job
      return true if owner? || admin?

      # Other roles cannot delete jobs
      false
    else
      # Default behavior for other resources
      # Owners and admins can delete any resource
      owner? || admin?
    end
  end

  # UserDisplay integration
  def display
    @display ||= UserDisplay.new(self)
  end

  # Delegate display methods (excluding short_name which is a database column)
  delegate :initials, :avatar_color, :avatar_style, :avatar_html,
           :display_name, :display_email, :role_label,
           to: :display

  def first_name
    name.split.first if name.present?
  end

  private

  def downcase_email
    self.email = email.downcase if email.present?
  end

  def strip_name
    self.name = name.strip if name.present?
  end

  def generate_short_name
    return if short_name.present?
    return unless email.present?

    # Try email prefix first
    email_prefix = email.split("@").first.downcase
    candidate = email_prefix

    # If not unique, try with incremental numbers
    counter = 1
    while User.where.not(id: id).exists?(short_name: candidate)
      candidate = "#{email_prefix}#{counter}"
      counter += 1

      # If we've tried too many times, use the full email
      if counter > 10
        candidate = email.downcase
        break
      end
    end

    self.short_name = candidate
  end

  def password_required?
    new_record? || password.present?
  end

  def should_invalidate_technicians_cache?
    technician? || (saved_change_to_role? && role_before_last_save == "technician")
  end

  def invalidate_technicians_cache
    Rails.cache.delete("available_technicians_data")
  end
end
