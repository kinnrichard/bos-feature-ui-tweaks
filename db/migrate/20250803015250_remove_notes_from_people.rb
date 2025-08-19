class RemoveNotesFromPeople < ActiveRecord::Migration[8.0]
  def change
    remove_column :people, :notes, :text
  end
end
