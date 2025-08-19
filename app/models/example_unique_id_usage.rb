# Example of how to use UniqueID in your models
#
# EXAMPLE 1: Basic usage with defaults
# class Invoice < ApplicationRecord
#   include HasUniqueId
# end
#
# EXAMPLE 2: Custom prefix and suffix
# class User < ApplicationRecord
#   include HasUniqueId
#
#   unique_id prefix: "USR-", suffix: "-A", minimum_length: 8
# end
#
# EXAMPLE 3: Without checksum for simpler IDs
# class Order < ApplicationRecord
#   include HasUniqueId
#
#   unique_id prefix: "ORD", use_checksum: false, minimum_length: 10
# end
#
# EXAMPLE 4: Store the ID in a custom column
# class Customer < ApplicationRecord
#   include HasUniqueId
#
#   unique_id prefix: "CUST-"
#
#   # Add this column to your migration:
#   # t.string :identifier
# end
#
# USAGE IN CONSOLE:
# invoice = Invoice.create(amount: 100)
# invoice.generated_id  # => "123456789" (with checksum)
#
# user = User.create(name: "John")
# user.generated_id     # => "USR-12345678-A"
#
# order = Order.create
# order.generated_id    # => "ORD1234567890" (no checksum)
#
# DIRECT USAGE WITHOUT A MODEL:
# unique_id = UniqueId.generate(prefix: "TMP-", minimum_length: 6)
# unique_id.generated_id  # => "TMP-123456"
