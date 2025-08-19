class AddFieldsToPeople < ActiveRecord::Migration[8.0]
  def change
    add_column :people, :name_preferred, :string
    add_column :people, :name_pronunciation_hint, :string
    add_column :people, :is_active, :boolean, default: true
  end
end
