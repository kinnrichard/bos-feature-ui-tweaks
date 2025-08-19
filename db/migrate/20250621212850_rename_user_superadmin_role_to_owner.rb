class RenameUserSuperadminRoleToOwner < ActiveRecord::Migration[8.0]
  def up
    # Update existing superadmin users to owner
    execute <<-SQL
      UPDATE users#{' '}
      SET role = 3#{' '}
      WHERE role = 3
    SQL

    # Note: We're keeping the same numeric value (3) for the role
    # Only the Rails enum name is changing from :superadmin to :owner
  end

  def down
    # No action needed since we're only changing the enum name in Rails
    # The database values remain the same
  end
end
