class CreateNotes < ActiveRecord::Migration[8.0]
  def change
    create_table :notes do |t|
      t.references :notable, polymorphic: true, null: false
      t.references :user, null: false, foreign_key: true
      t.text :content

      t.timestamps
    end
  end
end
