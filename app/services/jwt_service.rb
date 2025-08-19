class JwtService
  class << self
    def encode(payload, exp = 2.weeks.from_now)
      payload[:exp] = exp.to_i
      payload[:iat] = Time.current.to_i
      payload[:jti] ||= SecureRandom.uuid # Generate JWT ID only if not provided

      ::JWT.encode(payload, secret_key, "HS256")
    end

    def decode(token)
      decoded = ::JWT.decode(token, secret_key, true, { algorithm: "HS256" })[0]
      HashWithIndifferentAccess.new(decoded)
    rescue ::JWT::DecodeError => e
      raise_decode_error(e)
    end

    def decode_without_verification(token)
      ::JWT.decode(token, nil, false)[0]
    rescue ::JWT::DecodeError
      nil
    end

    private

    def secret_key
      Rails.application.credentials.secret_key_base || Rails.application.secret_key_base
    end

    def raise_decode_error(error)
      case error.class.name
      when "JWT::ExpiredSignature"
        raise error.class, "Token has expired"
      when "JWT::InvalidIatError"
        raise error.class, "Token issued at future time"
      when "JWT::VerificationError"
        raise error.class, "Token signature is invalid"
      else
        raise error.class, "Token is invalid"
      end
    end
  end
end
