class CreateScheduledDateTimes < ActiveRecord::Migration[8.0]
  def change
    create_table :scheduled_date_times do |t|
      t.references :schedulable, polymorphic: true, null: false
      t.string :scheduled_type, null: false
      t.date :scheduled_date, null: false
      t.time :scheduled_time
      t.text :notes

      t.timestamps
    end

    add_index :scheduled_date_times, [ :schedulable_type, :schedulable_id, :scheduled_type ],
              name: 'index_scheduled_date_times_on_schedulable_and_type'
    add_index :scheduled_date_times, :scheduled_date
    add_index :scheduled_date_times, :scheduled_type
  end
end
