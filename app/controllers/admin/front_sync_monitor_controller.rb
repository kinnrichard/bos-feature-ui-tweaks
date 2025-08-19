class Admin::FrontSyncMonitorController < ApplicationController
  before_action :require_admin

  def index
    @sync_logs = FrontSyncLog.includes(:user)
                            .recent_first
                            .limit(50)

    @sync_logs = filter_logs(@sync_logs) if params[:filter].present?

    @sync_status = FrontSyncMonitorService.sync_status
    @health_metrics = FrontSyncMonitorService.health_metrics
    @performance_stats = FrontSyncMonitorService.performance_stats
    @circuit_breaker_status = FrontSyncMonitorService.circuit_breaker_status
  end

  def show
    @sync_log = FrontSyncLog.find(params[:id])
  end

  def trigger_sync
    respond_to do |format|
      begin
        sync_type = params[:sync_type] || "full"
        user = current_user

        case sync_type
        when "contacts"
          FrontContactsSyncJob.perform_later(user)
          message = "Contacts sync job queued successfully"
        when "conversations"
          FrontConversationsSyncJob.perform_later(user)
          message = "Conversations sync job queued successfully"
        when "full"
          FrontContactsSyncJob.perform_later(user)
          FrontConversationsSyncJob.perform_later(user)
          message = "Full sync jobs queued successfully"
        else
          raise ArgumentError, "Invalid sync type: #{sync_type}"
        end

        format.json { render json: { success: true, message: message } }
        format.html { redirect_to admin_front_sync_monitor_index_path, notice: message }
      rescue => e
        Rails.logger.error "Manual sync trigger failed: #{e.message}"
        format.json { render json: { success: false, error: e.message }, status: :unprocessable_entity }
        format.html { redirect_to admin_front_sync_monitor_index_path, alert: "Sync failed: #{e.message}" }
      end
    end
  end

  def reset_circuit_breaker
    respond_to do |format|
      begin
        FrontSyncService.reset_circuit_breaker

        format.json { render json: { success: true, message: "Circuit breaker reset successfully" } }
        format.html { redirect_to admin_front_sync_monitor_index_path, notice: "Circuit breaker reset successfully" }
      rescue => e
        Rails.logger.error "Circuit breaker reset failed: #{e.message}"
        format.json { render json: { success: false, error: e.message }, status: :unprocessable_entity }
        format.html { redirect_to admin_front_sync_monitor_index_path, alert: "Reset failed: #{e.message}" }
      end
    end
  end

  def api_status
    render json: {
      sync_status: FrontSyncMonitorService.sync_status,
      health_metrics: FrontSyncMonitorService.health_metrics,
      circuit_breaker: FrontSyncMonitorService.circuit_breaker_status
    }
  end

  private

  def filter_logs(logs)
    logs = logs.where(sync_type: params[:filter][:sync_type]) if params[:filter][:sync_type].present?
    logs = logs.where(status: params[:filter][:status]) if params[:filter][:status].present?
    logs = logs.where("created_at >= ?", params[:filter][:from_date]) if params[:filter][:from_date].present?
    logs = logs.where("created_at <= ?", params[:filter][:to_date]) if params[:filter][:to_date].present?
    logs = logs.where(user_id: params[:filter][:user_id]) if params[:filter][:user_id].present?
    logs
  end

  def require_admin
    # Implement your admin authentication logic here
    # This is a placeholder - adjust based on your auth system
    unless current_user&.admin?
      redirect_to root_path, alert: "Access denied"
    end
  end
end
