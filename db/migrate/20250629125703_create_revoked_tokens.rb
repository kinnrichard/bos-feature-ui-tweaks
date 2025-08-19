class CreateRevokedTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :revoked_tokens, id: :uuid do |t|
      t.string :jti, null: false
      t.references :user, null: false, foreign_key: true
      t.string :user_uuid, null: false
      t.datetime :revoked_at, null: false
      t.datetime :expires_at, null: false

      t.timestamps
    end

    add_index :revoked_tokens, :jti, unique: true
    add_index :revoked_tokens, :expires_at
    add_index :revoked_tokens, :user_uuid
  end
end
