class AddTitleToPeople < ActiveRecord::Migration[8.0]
  def change
    add_column :people, :title, :string
  end
end
