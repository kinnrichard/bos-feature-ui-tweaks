class JobAssignment < ApplicationRecord
  belongs_to :job, touch: true
  belongs_to :user
end
