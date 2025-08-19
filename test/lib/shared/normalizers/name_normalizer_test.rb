require "test_helper"

class NameNormalizerTest < ActiveSupport::TestCase
  test "removes accents from names" do
    assert_equal "CAFE", Shared::Normalizers::NameNormalizer.normalize("Café")
    assert_equal "NINO", Shared::Normalizers::NameNormalizer.normalize("niño")
    assert_equal "FRANCOIS", Shared::Normalizers::NameNormalizer.normalize("François")
  end

  test "handles complex Unicode characters" do
    assert_equal "ZURICH", Shared::Normalizers::NameNormalizer.normalize("Zürich")
    assert_equal "SAOPAULO", Shared::Normalizers::NameNormalizer.normalize("São Paulo")
    assert_equal "KOLN", Shared::Normalizers::NameNormalizer.normalize("Köln")
  end

  test "converts to uppercase" do
    assert_equal "TEST", Shared::Normalizers::NameNormalizer.normalize("test")
    assert_equal "MIXED", Shared::Normalizers::NameNormalizer.normalize("MiXeD")
  end

  test "removes special characters and spaces" do
    assert_equal "ABCCO", Shared::Normalizers::NameNormalizer.normalize("ABC & Co.")
    assert_equal "TESTNAME", Shared::Normalizers::NameNormalizer.normalize("Test-Name")
    assert_equal "NAMEWITHBRACKETS", Shared::Normalizers::NameNormalizer.normalize("Name (with) [brackets]")
    assert_equal "NAMECOMPANY", Shared::Normalizers::NameNormalizer.normalize("Name @ Company")
  end

  test "handles nil values" do
    assert_nil Shared::Normalizers::NameNormalizer.normalize(nil)
  end

  test "handles empty strings" do
    assert_nil Shared::Normalizers::NameNormalizer.normalize("")
  end

  test "removes all whitespace" do
    assert_equal "SPACEDOUT", Shared::Normalizers::NameNormalizer.normalize("  spaced   out  ")
    assert_equal "LINEBREAK", Shared::Normalizers::NameNormalizer.normalize("line\nbreak")
    assert_equal "TABSEPARATED", Shared::Normalizers::NameNormalizer.normalize("tab\tseparated")
  end

  test "keeps only alphanumeric characters" do
    assert_equal "TEST123", Shared::Normalizers::NameNormalizer.normalize("Test123")
    assert_nil Shared::Normalizers::NameNormalizer.normalize("!@#$%^&*()")
  end
end
