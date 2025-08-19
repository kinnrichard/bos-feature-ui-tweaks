class RemoveAuthorForeignKeyFromFrontMessages < ActiveRecord::Migration[8.0]
  def change
    # Remove the incorrect foreign key constraint that prevents polymorphic associations
    # The author can be either a FrontContact or FrontTeammate (polymorphic)
    # but this constraint was forcing it to only be FrontContact
    remove_foreign_key :front_messages, column: :author_id if foreign_key_exists?(:front_messages, column: :author_id)
  end
end
