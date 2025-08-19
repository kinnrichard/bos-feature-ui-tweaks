class CreateFrontTags < ActiveRecord::Migration[8.0]
  def change
    create_table :front_tags, id: :uuid do |t|
      t.string :front_id, null: false
      t.string :name, null: false
      t.string :highlight
      t.text :description
      t.boolean :is_private, default: false
      t.boolean :is_visible_in_conversation_lists, default: false
      t.decimal :created_at_timestamp, precision: 15, scale: 3
      t.decimal :updated_at_timestamp, precision: 15, scale: 3
      t.references :parent_tag, null: true, foreign_key: { to_table: :front_tags }, type: :uuid

      t.timestamps
    end
    add_index :front_tags, :front_id, unique: true
    add_index :front_tags, :name
  end
end
