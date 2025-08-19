class TaskSerializer < ApplicationSerializer
  set_type :tasks

  attributes :title, :status, :position, :subtasks_count, :parent_id,
             :position_finalized, :repositioned_to_top, :repositioned_after_id

  timestamp_attributes :created_at, :updated_at

  # Relationships
  belongs_to :job
  belongs_to :assigned_to, serializer: :user, if: proc { |task| task.assigned_to.present? }
  belongs_to :parent, serializer: :task, if: proc { |task| task.parent.present? }

  has_many :subtasks, serializer: :task
  has_many :notes

  # Computed attributes
  attribute :status_label do |task|
    task.status&.humanize&.titleize
  end

  attribute :is_completed do |task|
    task.successfully_completed?
  end

  attribute :is_root_task do |task|
    task.parent_id.nil?
  end

  attribute :can_have_subtasks do |task|
    !task.successfully_completed? && !task.cancelled?
  end
end
