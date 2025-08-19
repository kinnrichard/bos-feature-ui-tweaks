class CreateUniqueIds < ActiveRecord::Migration[8.0]
  def change
    create_table :unique_ids do |t|
      t.string :prefix
      t.string :suffix
      t.integer :minimum_length, default: 5
      t.boolean :use_checksum, default: true
      t.string :generated_id, null: false

      # Polymorphic association to track which model is using this ID
      t.references :identifiable, polymorphic: true, index: true

      t.timestamps
    end

    # Ensure generated IDs are unique
    add_index :unique_ids, :generated_id, unique: true
  end
end
