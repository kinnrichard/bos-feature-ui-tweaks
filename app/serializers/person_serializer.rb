class PersonSerializer
  include FastJsonapi::ObjectSerializer

  attributes :name, :title, :is_active, :name_preferred, :name_pronunciation_hint,
             :created_at, :updated_at

  belongs_to :client
  has_many :contact_methods
  has_many :people_groups, through: :people_group_memberships

  attribute :display_name do |person|
    person.name_preferred.presence || person.name
  end

  attribute :active_contact_methods do |person|
    person.contact_methods.map do |cm|
      {
        id: cm.id,
        contact_type: cm.contact_type,
        value: cm.value,
        formatted_value: cm.formatted_value
      }
    end
  end

  attribute :groups do |person|
    person.people_groups.map do |group|
      {
        id: group.id,
        name: group.name,
        is_department: group.is_department
      }
    end
  end
end
