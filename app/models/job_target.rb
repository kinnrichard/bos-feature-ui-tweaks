class JobTarget < ApplicationRecord
  belongs_to :job

  # Polymorphic association for the target
  belongs_to :target, polymorphic: true

  # Validations
  validates :target_type, presence: true, inclusion: { in: %w[Device Person] }
  validates :instance_number, presence: true, numericality: { greater_than_or_equal_to: 1 }
  validates :job_id, uniqueness: {
    scope: [ :target_type, :target_id, :instance_number ],
    message: "already has this target with the same instance number"
  }

  validate :target_belongs_to_job_client

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :devices, -> { where(target_type: "Device") }
  scope :people, -> { where(target_type: "Person") }

  # Default values
  after_initialize :set_defaults, if: :new_record?

  private

  def set_defaults
    self.status ||= "active"
    self.instance_number ||= 1
  end

  def target_belongs_to_job_client
    return unless job && target

    unless target.client_id == job.client_id
      errors.add(:target, "must belong to the job's client")
    end
  end
end
