class UserSerializer < ApplicationSerializer
  set_type :users

  attributes :name, :email, :role, :resort_tasks_on_status_change

  timestamp_attributes :created_at, :updated_at

  # Computed attributes
  attribute :initials do |user|
    user.initials
  end

  attribute :display_name do |user|
    user.display_name
  end

  attribute :avatar_color do |user|
    user.avatar_color
  end

  # Relationships
  has_many :technician_jobs, serializer: :job, if: proc { |_record, params|
    params && params[:include_jobs]
  }

  has_many :assigned_tasks, serializer: :task, if: proc { |_record, params|
    params && params[:include_tasks]
  }
end
