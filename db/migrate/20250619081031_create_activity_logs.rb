class CreateActivityLogs < ActiveRecord::Migration[8.0]
  def change
    create_table :activity_logs do |t|
      t.references :user, null: false, foreign_key: true
      t.string :action
      t.references :loggable, polymorphic: true, null: false
      t.jsonb :metadata

      t.timestamps
    end
  end
end
