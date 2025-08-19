class BusinessLogicError < StandardError
  attr_reader :code

  def initialize(message = "Business logic error", code: "BUSINESS_LOGIC_ERROR")
    @code = code
    super(message)
  end
end
