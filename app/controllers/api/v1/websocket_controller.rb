class Api::V1::WebsocketController < Api::V1::BaseController
  before_action :authenticate_request

  # GET /api/v1/websocket/connection_info
  def connection_info
    render json: {
      data: {
        type: "websocket_connection",
        attributes: {
          url: websocket_url,
          protocol: request.ssl? ? "wss" : "ws",
          auth_token: generate_cable_token
        }
      }
    }
  end

  private

  def websocket_url
    protocol = request.ssl? ? "wss" : "ws"
    host = request.host
    port = request.port

    # Don't include port for standard ports
    if (request.ssl? && port == 443) || (!request.ssl? && port == 80)
      "#{protocol}://#{host}/cable"
    else
      "#{protocol}://#{host}:#{port}/cable"
    end
  end

  def generate_cable_token
    # Generate a short-lived token specifically for WebSocket authentication
    JwtService.encode(
      {
        user_id: current_user.id,
        purpose: "cable",
        exp: 1.hour.from_now
      }
    )
  end
end
