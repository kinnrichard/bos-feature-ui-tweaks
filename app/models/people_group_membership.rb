class PeopleGroupMembership < ApplicationRecord
  include Loggable

  belongs_to :person
  belongs_to :people_group

  validates :person_id, uniqueness: { scope: :people_group_id }
  validate :same_client_validation

  private

  def same_client_validation
    return unless person && people_group

    if person.client_id != people_group.client_id
      errors.add(:base, "Person and PeopleGroup must belong to the same client")
    end
  end
end
