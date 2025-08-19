---
title: "DevOps Engineer Getting Started Guide"
description: "Complete guide for DevOps engineers working with the bŏs deployment and infrastructure"
last_updated: "2025-07-17"
status: "active"
category: "getting-started"
tags: ["devops", "deployment", "infrastructure", "kamal", "docker", "monitoring"]
---

# DevOps Engineer Getting Started Guide

> **Master the bŏs infrastructure: from local development to production deployment**

## 🎯 Objectives
After completing this guide, you will:
- Understand the bŏs infrastructure architecture and deployment strategy
- Know how to manage deployments using Kamal
- Be able to set up monitoring, logging, and alerting systems
- Understand security best practices and compliance requirements
- Know how to optimize performance and scalability

## 📋 Prerequisites
- Strong understanding of containerization and Docker
- Experience with cloud platforms (AWS, GCP, Azure)
- Knowledge of CI/CD pipelines and automation
- Familiarity with monitoring and logging tools
- Understanding of security best practices

## 🏗️ Infrastructure Architecture Overview

### Technology Stack
- **Kamal**: Deployment orchestration
- **Docker**: Containerization
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **Traefik**: Load balancing and SSL termination
- **GitHub Actions**: CI/CD automation
- **Monitoring**: Prometheus, Grafana, AlertManager

### Deployment Architecture
```
Internet → Traefik (Load Balancer) → bŏs Application Containers
                                   ↓
                              PostgreSQL Database
                                   ↓
                                Redis Cache
```

### Infrastructure Components
- **Application Servers**: Dockerized Rails API and frontend
- **Database**: PostgreSQL with read replicas
- **Cache Layer**: Redis for sessions and caching
- **Load Balancer**: Traefik with SSL termination
- **Monitoring**: Prometheus metrics collection
- **Logging**: Centralized logging with structured logs
- **Backup**: Automated database and file backups

---

## 🚀 Phase 1: Environment Setup (45-60 minutes)

### 1.1 Kamal Installation and Configuration
```bash
# Install Kamal
gem install kamal

# Initialize Kamal in project
kamal init

# Verify installation
kamal version
```

### 1.2 Kamal Configuration
```yaml
# config/deploy.yml
service: bos
image: bos/app

servers:
  web:
    - 1.1.1.1
    - 1.1.1.2
  job:
    - 1.1.1.3
    - 1.1.1.4

registry:
  server: registry.digitalocean.com
  username: your-registry-username
  password:
    - KAMAL_REGISTRY_PASSWORD

builder:
  arch: amd64
  cache:
    type: gha
    options: mode=max

volumes:
  - "/var/lib/postgresql/data:/var/lib/postgresql/data"
  - "/var/log/app:/rails/log"

env:
  clear:
    DB_HOST: 1.1.1.10
    REDIS_URL: redis://1.1.1.11:6379
  secret:
    - RAILS_MASTER_KEY
    - DATABASE_PASSWORD
    - REDIS_PASSWORD
    - JWT_SECRET

traefik:
  image: traefik:v2.10
  host_port: 80
  args:
    entryPoints.web.address: ":80"
    entryPoints.websecure.address: ":443"
    certificatesResolvers.letsencrypt.acme.email: "admin@example.com"
    certificatesResolvers.letsencrypt.acme.storage: "/letsencrypt/acme.json"
    certificatesResolvers.letsencrypt.acme.httpchallenge: true
    certificatesResolvers.letsencrypt.acme.httpchallenge.entrypoint: "web"

accessories:
  db:
    image: postgres:15
    host: 1.1.1.10
    volumes:
      - /var/lib/postgresql/data:/var/lib/postgresql/data
    env:
      POSTGRES_USER: bos
      POSTGRES_DB: bos_production
      POSTGRES_PASSWORD:
        - DATABASE_PASSWORD
    
  redis:
    image: redis:7-alpine
    host: 1.1.1.11
    volumes:
      - /var/lib/redis:/data
    cmd: redis-server --appendonly yes --requirepass $REDIS_PASSWORD

  prometheus:
    image: prom/prometheus:latest
    host: 1.1.1.12
    volumes:
      - /etc/prometheus:/etc/prometheus
      - /var/lib/prometheus:/prometheus
    cmd: |
      --config.file=/etc/prometheus/prometheus.yml
      --storage.tsdb.path=/prometheus
      --web.console.libraries=/etc/prometheus/console_libraries
      --web.console.templates=/etc/prometheus/consoles
      --web.enable-lifecycle
      --web.external-url=https://prometheus.example.com
```

### 1.3 Docker Configuration
```dockerfile
# Dockerfile
FROM ruby:3.4.4-slim

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      nodejs \
      npm \
      git && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /rails

# Copy Gemfile and install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install --deployment --without development test

# Copy application code
COPY . .

# Precompile assets
RUN bundle exec rails assets:precompile

# Create non-root user
RUN groupadd -r app && useradd -r -g app app
RUN chown -R app:app /rails
USER app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

### 1.4 Docker Compose for Local Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/bos_development
      - REDIS_URL=redis://redis:6379
      - RAILS_ENV=development
    depends_on:
      - db
      - redis
    volumes:
      - .:/rails
      - bundle:/usr/local/bundle
    command: bundle exec rails server -b 0.0.0.0

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=bos_development
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  bundle:
```

---

## 🔄 Phase 2: CI/CD Pipeline Setup (60-75 minutes)

### 2.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: registry.digitalocean.com
  IMAGE_NAME: bos/app

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bos_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.4.4
          bundler-cache: true

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci

      - name: Run tests
        env:
          RAILS_ENV: test
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/bos_test
        run: |
          bundle exec rails db:create
          bundle exec rails db:migrate
          bundle exec rails test

      - name: Run frontend tests
        run: |
          cd frontend
          npm run test:unit

      - name: Build frontend
        run: |
          cd frontend
          npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.image.outputs.image }}
      digest: ${{ steps.build.outputs.digest }}
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.DIGITALOCEAN_TOKEN }}
          password: ${{ secrets.DIGITALOCEAN_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Output image
        id: image
        run: |
          echo "image=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - uses: actions/checkout@v4

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.4.4

      - name: Install Kamal
        run: gem install kamal

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H ${{ secrets.SERVER_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy with Kamal
        env:
          KAMAL_REGISTRY_PASSWORD: ${{ secrets.DIGITALOCEAN_TOKEN }}
          RAILS_MASTER_KEY: ${{ secrets.RAILS_MASTER_KEY }}
          DATABASE_PASSWORD: ${{ secrets.DATABASE_PASSWORD }}
          REDIS_PASSWORD: ${{ secrets.REDIS_PASSWORD }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
        run: |
          kamal deploy

      - name: Run post-deployment tasks
        run: |
          kamal app exec 'bundle exec rails db:migrate'
          kamal app exec 'bundle exec rails assets:precompile'

  notify:
    needs: [test, build, deploy]
    runs-on: ubuntu-latest
    if: always()
    
    steps:
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### 2.2 Deployment Scripts
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

echo "🚀 Starting deployment..."

# Pre-deployment checks
echo "⏳ Running pre-deployment checks..."
kamal app exec 'bundle exec rails runner "puts Rails.env"'

# Database migration
echo "⏳ Running database migrations..."
kamal app exec 'bundle exec rails db:migrate'

# Asset precompilation
echo "⏳ Precompiling assets..."
kamal app exec 'bundle exec rails assets:precompile'

# Health check
echo "⏳ Performing health check..."
for i in {1..10}; do
  if curl -f http://localhost:3000/health; then
    echo "✅ Health check passed"
    break
  fi
  echo "⏳ Health check failed, retrying in 5 seconds..."
  sleep 5
done

# Post-deployment tasks
echo "⏳ Running post-deployment tasks..."
kamal app exec 'bundle exec rails runner "Rails.cache.clear"'

echo "✅ Deployment completed successfully!"
```

### 2.3 Rollback Strategy
```bash
#!/bin/bash
# scripts/rollback.sh

set -e

echo "🔄 Starting rollback..."

# Get previous version
PREVIOUS_VERSION=$(kamal app images --limit 2 | tail -1 | awk '{print $1}')

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "❌ No previous version found"
  exit 1
fi

echo "🔄 Rolling back to version: $PREVIOUS_VERSION"

# Deploy previous version
kamal deploy --version $PREVIOUS_VERSION

# Verify rollback
echo "⏳ Verifying rollback..."
for i in {1..10}; do
  if curl -f http://localhost:3000/health; then
    echo "✅ Rollback successful"
    break
  fi
  echo "⏳ Rollback verification failed, retrying in 5 seconds..."
  sleep 5
done

echo "✅ Rollback completed successfully!"
```

---

## 📊 Phase 3: Monitoring and Observability (60-75 minutes)

### 3.1 Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'bos-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'traefik'
    static_configs:
      - targets: ['traefik:8082']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

### 3.2 Alert Rules
```yaml
# monitoring/alert_rules.yml
groups:
  - name: bos-app
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: DatabaseConnectionFailure
        expr: up{job="postgres"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection failure"
          description: "PostgreSQL database is down"

      - alert: RedisConnectionFailure
        expr: up{job="redis"} == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Redis connection failure"
          description: "Redis cache is down"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is {{ $value }}%"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value | humanizePercentage }} full"
```

### 3.3 Grafana Dashboard
```json
{
  "dashboard": {
    "title": "bŏs Application Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active connections"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes",
            "legendFormat": "RSS Memory"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      }
    ]
  }
}
```

### 3.4 Application Metrics
```ruby
# app/controllers/concerns/metrics.rb
module Metrics
  extend ActiveSupport::Concern
  
  included do
    around_action :track_request_metrics
  end
  
  private
  
  def track_request_metrics
    start_time = Time.current
    
    begin
      yield
    ensure
      duration = Time.current - start_time
      
      # Track response time
      PROMETHEUS.histogram(
        :http_request_duration_seconds,
        { method: request.method, path: request.path, status: response.status },
        duration
      )
      
      # Track request count
      PROMETHEUS.counter(
        :http_requests_total,
        { method: request.method, path: request.path, status: response.status }
      ).increment
      
      # Track error rate
      if response.status >= 500
        PROMETHEUS.counter(
          :http_errors_total,
          { method: request.method, path: request.path, status: response.status }
        ).increment
      end
    end
  end
end
```

### 3.5 Logging Configuration
```ruby
# config/initializers/logging.rb
require 'syslog/logger'

if Rails.env.production?
  # Use structured logging in production
  Rails.logger = ActiveSupport::TaggedLogging.new(
    Syslog::Logger.new('bos-app', Syslog::LOG_LOCAL0)
  )
  
  # Configure log level
  Rails.logger.level = Logger::INFO
  
  # Add request tracking
  Rails.application.configure do
    config.log_tags = [
      :request_id,
      -> request { "#{request.remote_ip}" },
      -> request { "#{request.method} #{request.path}" }
    ]
  end
end

# Custom log formatter
class StructuredLogFormatter
  def call(severity, timestamp, progname, msg)
    {
      timestamp: timestamp.utc.iso8601,
      level: severity,
      message: msg,
      service: 'bos-app',
      environment: Rails.env
    }.to_json + "\n"
  end
end

Rails.logger.formatter = StructuredLogFormatter.new if Rails.env.production?
```

---

## 🔒 Phase 4: Security and Compliance (45-60 minutes)

### 4.1 Security Hardening
```yaml
# security/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Ruby security scan
        run: |
          gem install bundler-audit
          bundle-audit check --update

      - name: JavaScript security scan
        run: |
          cd frontend
          npm audit --audit-level moderate

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build image
        run: docker build -t bos-app .
      
      - name: Scan image
        uses: anchore/scan-action@v3
        with:
          image: bos-app
          fail-build: true
          severity-cutoff: high

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Secret scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
```

### 4.2 SSL/TLS Configuration
```yaml
# traefik/traefik.yml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web

tls:
  options:
    default:
      sslProtocols:
        - TLSv1.2
        - TLSv1.3
      cipherSuites:
        - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
        - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
        - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
```

### 4.3 Firewall Configuration
```bash
#!/bin/bash
# scripts/setup-firewall.sh

# Basic firewall setup
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH
ufw allow ssh

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow database connections (restrict to app servers)
ufw allow from 10.0.0.0/24 to any port 5432
ufw allow from 10.0.0.0/24 to any port 6379

# Allow monitoring
ufw allow from 10.0.0.0/24 to any port 9090
ufw allow from 10.0.0.0/24 to any port 3001

# Enable firewall
ufw --force enable

# Show status
ufw status verbose
```

### 4.4 Backup Strategy
```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "📦 Starting backup process..."

# Database backup
echo "⏳ Backing up database..."
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > "$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sql.gz"

# Application files backup
echo "⏳ Backing up application files..."
tar -czf "$BACKUP_DIR/app_files_$(date +%Y%m%d_%H%M%S).tar.gz" /app/storage

# Upload to cloud storage
echo "⏳ Uploading to cloud storage..."
aws s3 sync $BACKUP_DIR s3://bos-backups/$(date +%Y%m%d)/

# Cleanup old backups (keep 30 days)
echo "⏳ Cleaning up old backups..."
find /backups -type d -mtime +30 -exec rm -rf {} \;

echo "✅ Backup completed successfully!"
```

---

## 📈 Phase 5: Performance Optimization (45-60 minutes)

### 5.1 Database Optimization
```ruby
# config/database.yml - Production optimizations
production:
  adapter: postgresql
  database: bos_production
  username: <%= ENV['DB_USER'] %>
  password: <%= ENV['DB_PASSWORD'] %>
  host: <%= ENV['DB_HOST'] %>
  port: <%= ENV['DB_PORT'] || 5432 %>
  
  # Connection pool settings
  pool: <%= ENV['DB_POOL'] || 20 %>
  timeout: 5000
  checkout_timeout: 5
  reaping_frequency: 10
  
  # Performance settings
  prepared_statements: true
  advisory_locks: true
  
  # Read replica configuration
  replica:
    adapter: postgresql
    database: bos_production
    username: <%= ENV['DB_REPLICA_USER'] %>
    password: <%= ENV['DB_REPLICA_PASSWORD'] %>
    host: <%= ENV['DB_REPLICA_HOST'] %>
    port: <%= ENV['DB_REPLICA_PORT'] || 5432 %>
    pool: <%= ENV['DB_REPLICA_POOL'] || 10 %>
    replica: true
```

### 5.2 Redis Configuration
```redis
# redis/redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Network
tcp-keepalive 300
timeout 0

# Clients
maxclients 10000

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Security
requirepass strong_password_here
```

### 5.3 Application Performance Tuning
```ruby
# config/initializers/performance.rb

# Optimize Active Record
ActiveRecord::Base.connection.execute("SET statement_timeout = '30s'")

# Configure caching
Rails.application.configure do
  config.cache_store = :redis_cache_store, {
    url: ENV['REDIS_URL'],
    compress: true,
    compress_threshold: 1024,
    expires_in: 1.day
  }
end

# Configure session storage
Rails.application.config.session_store :redis_session_store, {
  key: '_bos_session',
  redis: {
    url: ENV['REDIS_URL'],
    expire_after: 1.week
  }
}

# Optimize JSON serialization
Oj.optimize_rails

# Configure Puma
workers = Integer(ENV.fetch('WEB_CONCURRENCY', 2))
threads_count = Integer(ENV.fetch('RAILS_MAX_THREADS', 5))
threads threads_count, threads_count

worker_processes workers
preload_app!

before_fork do
  ActiveRecord::Base.connection_pool.disconnect!
end

on_worker_boot do
  ActiveRecord::Base.establish_connection
end
```

### 5.4 CDN Configuration
```yaml
# CDN configuration for static assets
cdn:
  provider: aws
  bucket: bos-assets
  region: us-east-1
  distribution_id: E1234567890ABC
  
  # Asset optimization
  gzip_compression: true
  brotli_compression: true
  cache_control: "public, max-age=31536000"
  
  # Image optimization
  image_optimization:
    webp_conversion: true
    progressive_jpeg: true
    quality: 85
```

---

## 🔧 Phase 6: Troubleshooting and Maintenance (30-45 minutes)

### 6.1 Common Issues and Solutions

#### Application Won't Start
```bash
# Check logs
kamal app logs

# Check container status
docker ps -a

# Verify environment variables
kamal app exec env

# Check database connectivity
kamal app exec 'bundle exec rails runner "puts ActiveRecord::Base.connection.active?"'
```

#### Database Connection Issues
```bash
# Check database status
pg_isready -h $DB_HOST -p $DB_PORT

# Check connection count
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections
kamal app exec 'bundle exec rails runner "ActiveRecord::Base.connection_pool.disconnect!"'
```

#### High Memory Usage
```bash
# Check memory usage
kamal app exec 'free -h'

# Check application memory
kamal app exec 'ps aux --sort=-%mem | head'

# Restart application
kamal app restart
```

### 6.2 Maintenance Scripts
```bash
#!/bin/bash
# scripts/maintenance.sh

set -e

echo "🔧 Starting maintenance tasks..."

# Update system packages
echo "⏳ Updating system packages..."
apt-get update && apt-get upgrade -y

# Clean up Docker
echo "⏳ Cleaning up Docker..."
docker system prune -f
docker volume prune -f

# Vacuum database
echo "⏳ Vacuuming database..."
kamal app exec 'bundle exec rails runner "ActiveRecord::Base.connection.execute(\"VACUUM ANALYZE\")"'

# Clear application cache
echo "⏳ Clearing application cache..."
kamal app exec 'bundle exec rails runner "Rails.cache.clear"'

# Rotate logs
echo "⏳ Rotating logs..."
logrotate -f /etc/logrotate.conf

# Check disk space
echo "⏳ Checking disk space..."
df -h

echo "✅ Maintenance completed successfully!"
```

### 6.3 Health Check Scripts
```bash
#!/bin/bash
# scripts/health-check.sh

set -e

echo "🏥 Running health checks..."

# Application health
echo "⏳ Checking application health..."
if curl -f http://localhost:3000/health; then
  echo "✅ Application is healthy"
else
  echo "❌ Application health check failed"
  exit 1
fi

# Database health
echo "⏳ Checking database health..."
if pg_isready -h $DB_HOST -p $DB_PORT; then
  echo "✅ Database is healthy"
else
  echo "❌ Database health check failed"
  exit 1
fi

# Redis health
echo "⏳ Checking Redis health..."
if redis-cli -h $REDIS_HOST ping | grep -q PONG; then
  echo "✅ Redis is healthy"
else
  echo "❌ Redis health check failed"
  exit 1
fi

echo "✅ All health checks passed!"
```

---

## 📚 Phase 7: Documentation and Resources (15-30 minutes)

### 7.1 Infrastructure Documentation
```markdown
# Infrastructure Documentation

## Architecture Overview
- **Application**: Rails API + SvelteKit frontend
- **Database**: PostgreSQL with read replicas
- **Cache**: Redis for sessions and caching
- **Load Balancer**: Traefik with SSL termination
- **Monitoring**: Prometheus + Grafana + AlertManager

## Deployment Process
1. Code is pushed to main branch
2. GitHub Actions runs tests and builds Docker image
3. Kamal deploys to production servers
4. Health checks verify deployment
5. Notifications sent to team

## Monitoring and Alerts
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards and visualization
- **AlertManager**: Alert routing and notifications
- **Slack**: Real-time alerts

## Security
- **SSL/TLS**: Automated certificate management
- **Firewall**: Restrictive rules with necessary ports
- **Secrets**: Environment variables and encrypted storage
- **Backups**: Daily automated backups to cloud storage

## Maintenance
- **Updates**: Monthly security updates
- **Monitoring**: 24/7 automated monitoring
- **Backups**: Daily backups with 30-day retention
- **Health Checks**: Continuous health monitoring
```

### 7.2 Runbooks
```markdown
# Runbook: Database Issues

## Symptoms
- Application can't connect to database
- High database response times
- Database connection errors in logs

## Diagnosis
1. Check database server status
2. Verify connection parameters
3. Check connection pool usage
4. Review database logs

## Resolution
1. Restart database if necessary
2. Adjust connection pool settings
3. Scale database resources
4. Review and optimize slow queries

## Prevention
- Monitor connection pool usage
- Set up database alerts
- Regular performance reviews
- Implement connection pooling
```

### 7.3 Essential Resources
- **[Kamal Documentation](https://kamal-deploy.org/)** - Deployment orchestration
- **[Docker Best Practices](https://docs.docker.com/develop/best-practices/)** - Container optimization
- **[Prometheus Documentation](https://prometheus.io/docs/)** - Monitoring and alerting
- **[PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)** - Database optimization

---

## ✅ Success Criteria

You've successfully completed DevOps engineer onboarding when you can:
- [ ] Deploy and manage applications using Kamal
- [ ] Set up comprehensive monitoring and alerting
- [ ] Implement security best practices and compliance
- [ ] Optimize performance and scalability
- [ ] Troubleshoot infrastructure issues effectively
- [ ] Maintain robust backup and disaster recovery procedures

---

## 🔧 Troubleshooting

### Common Issues

#### Deployment Failures
```bash
# Check deployment logs
kamal app logs

# Verify configuration
kamal config validate

# Check server connectivity
kamal server exec 'echo "Server is accessible"'
```

#### Monitoring Issues
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:3000/metrics

# Check Grafana datasources
curl http://localhost:3001/api/datasources
```

#### Performance Issues
```bash
# Check resource usage
top
htop
iotop

# Analyze slow queries
tail -f /var/log/postgresql/postgresql.log

# Monitor application metrics
curl http://localhost:3000/metrics | grep http_request_duration
```

---

**You're now ready to manage world-class infrastructure for the bŏs system!**

*Remember: Infrastructure is the foundation of great software - build it strong, monitor it closely, and scale it wisely.*