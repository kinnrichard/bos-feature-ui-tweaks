class MakeTaskPositionRequired < ActiveRecord::Migration[8.0]
  def up
    change_column_null :tasks, :position, false
  end

  def down
    change_column_null :tasks, :position, true
  end
end
