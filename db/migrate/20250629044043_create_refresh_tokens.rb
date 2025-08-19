class CreateRefreshTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :refresh_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.string :jti, null: false
      t.string :family_id, null: false
      t.datetime :expires_at, null: false
      t.string :device_fingerprint
      t.datetime :revoked_at

      t.timestamps
    end
    add_index :refresh_tokens, :jti, unique: true
    add_index :refresh_tokens, :family_id
    add_index :refresh_tokens, [ :user_id, :family_id ]
  end
end
