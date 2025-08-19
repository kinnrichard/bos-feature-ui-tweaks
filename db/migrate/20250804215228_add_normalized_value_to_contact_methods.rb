class AddNormalizedValueToContactMethods < ActiveRecord::Migration[8.0]
  def change
    # Add normalized_value column (nullable initially for safe rollout)
    add_column :contact_methods, :normalized_value, :string, null: true

    # Add index on normalized_value for efficient lookups
    add_index :contact_methods, :normalized_value

    # Add compound index on [normalized_value, contact_type] for type-specific queries
    add_index :contact_methods, [ :normalized_value, :contact_type ], name: 'index_contact_methods_on_normalized_value_and_type'
  end
end
