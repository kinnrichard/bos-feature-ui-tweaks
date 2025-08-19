class AddMetadataToNotes < ActiveRecord::Migration[8.0]
  def change
    add_column :notes, :metadata, :jsonb
  end
end
