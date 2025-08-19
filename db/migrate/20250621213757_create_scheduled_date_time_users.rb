class CreateScheduledDateTimeUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :scheduled_date_time_users do |t|
      t.references :scheduled_date_time, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      t.timestamps
    end

    add_index :scheduled_date_time_users, [ :scheduled_date_time_id, :user_id ],
              unique: true, name: 'index_scheduled_date_time_users_unique'
  end
end
