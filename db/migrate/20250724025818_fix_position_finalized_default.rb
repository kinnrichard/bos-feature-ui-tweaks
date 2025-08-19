class FixPositionFinalizedDefault < ActiveRecord::Migration[8.0]
  def change
    # Change the default value of position_finalized from true to false
    # This ensures new tasks will have their positions calculated
    change_column_default :tasks, :position_finalized, from: true, to: false
  end
end
