# FxChecksum implementation
# Based on the FileMaker algorithm used in the legacy system
# Processes digits right-to-left with incrementing position indices
# Note: This is a variant of Verhoeff, not standard Verhoeff
module FxChecksum
  extend self

  # Permutation table
  P_TABLE = "01234567891576283094580379614289160435279453126870428657390127938064157046913258".freeze

  # Dihedral group D5 multiplication table
  D_TABLE = "0123456789123406789523401789563401289567401239567859876043216598710432765982104387659321049876543210".freeze

  # Calculate checksum using FileMaker algorithm
  # @param numeric_string [String] the base number to calculate checksum for
  # @param index [Integer] position index (used internally for recursion)
  # @param checksum [Integer] current checksum value (used internally for recursion)
  # @return [Integer] the calculated checksum value
  def calculate(numeric_string, index = 0, checksum = 0)
    # Get rightmost digit
    n = numeric_string[-1].to_i

    # Calculate permutation value
    p_start = 10 * (index % 8) + n
    p = P_TABLE[p_start].to_i

    # Calculate dihedral multiplication
    d_start = 10 * checksum + p
    d = D_TABLE[d_start].to_i

    # Process remaining string
    len = numeric_string.length
    next_string = numeric_string[0...-1]

    if len > 1
      calculate(next_string, index + 1, d)
    else
      d
    end
  end

  # Check if a number has a valid checksum
  # @param full_number [String] the complete number including checksum
  # @param prefix [String] optional prefix to remove
  # @param suffix [String] optional suffix to remove
  # @return [Boolean] true if the checksum is valid
  def valid?(full_number, prefix: nil, suffix: nil)
    return false if full_number.to_s.length < 2

    # Remove prefix and suffix if provided
    numeric_part = full_number.to_s
    numeric_part = numeric_part.delete_prefix(prefix.to_s) if prefix
    numeric_part = numeric_part.delete_suffix(suffix.to_s) if suffix

    return false if numeric_part.empty? || numeric_part.length < 2

    # Split into base and checksum digit
    base = numeric_part[0...-1]
    last_digit = numeric_part[-1].to_i

    # Calculate what the checksum should be
    calculated_checksum = calculate(base)

    # Valid if calculated checksum matches last digit
    calculated_checksum == last_digit
  end
end
