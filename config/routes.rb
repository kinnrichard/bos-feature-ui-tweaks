Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Mount GoodJob dashboard in development
  if Rails.env.development?
    mount GoodJob::Engine => "/good_job"
  end

  # Mount Action Cable for WebSocket connections
  # mount ActionCable.server => "/cable"

  # API v1 namespace
  namespace :api do
    namespace :v1 do
      # Health check endpoint
      get "health", to: "health#show"

      # CSRF test endpoint for development debugging
      get "csrf_test", to: "health#csrf_test" if Rails.env.development?

      # CSRF token endpoint removed - tests now use production /health endpoint

      # Authentication endpoints
      namespace :auth do
        post "login", to: "sessions#create"
        post "refresh", to: "sessions#refresh"
        post "logout", to: "sessions#destroy"
      end

      # Zero JWT token endpoint
      get "zero/token", to: "zero_tokens#create"
      post "zero/token", to: "zero_tokens#create"

      # WebSocket connection info
      get "websocket/connection_info", to: "websocket#connection_info"

      # API documentation
      get "documentation", to: "documentation#index"

      # Test endpoints (available in test and development environments for integration testing)
      if Rails.env.test? || Rails.env.development?
        namespace :test do
          post :reset_database
          post :seed_database
          get :verify_data
          post :begin_transaction
          post :rollback_transaction
          post :commit_transaction
          delete :cleanup
          delete :cleanup_entity
        end
      end

      # Resource endpoints
      resources :users, only: [ :index ] do
        collection do
          get :me
        end
      end
      resources :clients

      resources :jobs do
        resources :tasks do
          collection do
            patch :batch_reorder
            patch :batch_reorder_relative
            get :batch_details
            post :rebalance
          end
          member do
            patch :reorder
            patch :update_status
            get :details
            patch :assign
            post :notes, action: :add_note
          end
        end
        member do
          patch :technicians, to: "jobs#update_technicians"
        end
      end
    end
  end

  # Health check is handled in config.ru to bypass Rails middleware

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  # get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  # get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Authentication routes
  get "login", to: "sessions#new", as: :login
  post "login", to: "sessions#create"
  delete "logout", to: "sessions#destroy", as: :logout

  # Admin routes
  namespace :admin do
    resources :front_sync_monitor, only: [ :index, :show ] do
      collection do
        post :trigger_sync
        post :reset_circuit_breaker
        get :api_status
      end
    end
  end

  # Defines the root path route ("/")
  root "home#show"
end
