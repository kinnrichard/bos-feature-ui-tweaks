class PeopleGroup < ApplicationRecord
  include Loggable

  belongs_to :client
  has_many :people_group_memberships, dependent: :destroy
  has_many :people, through: :people_group_memberships

  validates :name, presence: true, uniqueness: { scope: :client_id }
  validates :is_department, inclusion: { in: [ true, false ] }

  scope :departments, -> { where(is_department: true) }
  scope :non_departments, -> { where(is_department: false) }
end
