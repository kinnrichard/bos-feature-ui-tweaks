class CreateFrontAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :front_attachments, id: :uuid do |t|
      t.references :front_message, null: false, foreign_key: true, type: :uuid
      t.string :filename
      t.string :content_type
      t.string :url
      t.integer :size
      t.jsonb :metadata

      t.timestamps
    end
  end
end
