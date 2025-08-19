class CreateParsedEmails < ActiveRecord::Migration[8.0]
  def change
    create_table :parsed_emails, id: :uuid do |t|
      # Polymorphic association
      t.references :parseable, polymorphic: true, null: false, index: true, type: :uuid

      # Plain text components
      t.text :plain_message              # Reply only (no quotes, no signature)
      t.text :plain_signature            # Just the signature

      # HTML components
      t.text :html_message               # Reply only (no quotes, no signature)
      t.text :html_signature             # Just the signature

      # Metadata
      t.string :parse_options            # JSON of what was requested to parse
      t.datetime :parsed_at
      t.string :parser_version
      t.text :parse_errors               # JSON of any errors by field

      # Performance optimization
      t.string :content_hash             # For cache deduplication

      t.timestamps
    end

    # Indexes for performance
    add_index :parsed_emails, :content_hash
    add_index :parsed_emails, :parsed_at
  end
end
