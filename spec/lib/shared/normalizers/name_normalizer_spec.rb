require 'rails_helper'

RSpec.describe Shared::Normalizers::NameNormalizer do
  describe '.normalize' do
    it 'removes accents from names' do
      expect(described_class.normalize('Café')).to eq('CAFE')
      expect(described_class.normalize('niño')).to eq('NINO')
      expect(described_class.normalize('François')).to eq('FRANCOIS')
    end

    it 'handles complex Unicode characters' do
      expect(described_class.normalize('Zürich')).to eq('ZURICH')
      expect(described_class.normalize('São Paulo')).to eq('SAOPAULO')
      expect(described_class.normalize('Köln')).to eq('KOLN')
    end

    it 'converts to uppercase' do
      expect(described_class.normalize('test')).to eq('TEST')
      expect(described_class.normalize('MiXeD')).to eq('MIXED')
    end

    it 'removes special characters and spaces' do
      expect(described_class.normalize('ABC & Co.')).to eq('ABCCO')
      expect(described_class.normalize('Test-Name')).to eq('TESTNAME')
      expect(described_class.normalize('Name (with) [brackets]')).to eq('NAMEWITHBRACKETS')
      expect(described_class.normalize('Name @ Company')).to eq('NAMECOMPANY')
    end

    it 'handles nil values' do
      expect(described_class.normalize(nil)).to be_nil
    end

    it 'handles empty strings' do
      expect(described_class.normalize('')).to be_nil
    end

    it 'removes all whitespace' do
      expect(described_class.normalize('  spaced   out  ')).to eq('SPACEDOUT')
      expect(described_class.normalize("line\nbreak")).to eq('LINEBREAK')
      expect(described_class.normalize("tab\tseparated")).to eq('TABSEPARATED')
    end

    it 'keeps only alphanumeric characters' do
      expect(described_class.normalize('Test123')).to eq('TEST123')
      expect(described_class.normalize('!@#$%^&*()')).to eq('')
    end
  end
end
