class JobPerson < ApplicationRecord
  belongs_to :job, touch: true
  belongs_to :person
end
