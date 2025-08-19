# Environment Setup Guide

This guide shows different approaches to manage environment variables across all services (Rails, Zero, Frontend) from a single source.

## **Option 1: Foreman (Recommended - Already Set Up!)**

You already have everything needed! Just run:

```bash
# Install the new gems
bundle install

# Start all services with one command
./bin/dev
```

This will:
✅ Load environment variables from `.env.development`
✅ Start Rails server on port 3000
✅ Start Zero cache server on port 4848
✅ Start frontend dev server on port 5173
✅ Start CSS watching

### How it works:
- `bin/dev` loads environment variables from `.env.development`
- `Procfile.dev` defines all services to start
- Foreman starts everything with the same environment

### Benefits:
- ✅ Single command to start everything
- ✅ All services share the same environment
- ✅ Logs are color-coded and labeled
- ✅ Ctrl+C stops everything cleanly

## **Option 2: npm Scripts with Concurrently**

If you prefer npm-based workflow:

```bash
# Install concurrently
npm install --save-dev concurrently

# Add to package.json scripts:
{
  "scripts": {
    "dev": "concurrently \"npm:dev:*\"",
    "dev:rails": "source .env.development && rails server -b 0.0.0.0",
    "dev:zero": "source .env.development && npx zero-cache --upstream-db postgres://claude@localhost:5432/bos_development --cvr-db postgres://claude@localhost:5432/bos_development_cvr --change-db postgres://claude@localhost:5432/bos_development_cdb --auth-secret $ZERO_AUTH_SECRET --replica-file /tmp/zero-replica.db --port 4848 --change-streamer-port 4849 --log-level info",
    "dev:frontend": "cd frontend && npm run dev"
  }
}

# Start everything:
npm run dev
```

## **Option 3: direnv (Auto-loading)**

For automatic environment loading when entering the directory:

```bash
# Install direnv (macOS)
brew install direnv

# Add to your shell profile (~/.zshrc or ~/.bashrc)
eval "$(direnv hook zsh)"

# Create .envrc file (same as .env.development but different name)
cp .env.development .envrc

# Allow direnv to load it
direnv allow

# Now environment variables are automatically loaded when you cd into the project
```

## **Option 4: Custom Shell Script**

Create a simple startup script:

```bash
# Create start-dev.sh
cat > start-dev.sh << 'EOF'
#!/bin/bash

# Load environment variables
source .env.development

echo "🔑 Using ZERO_AUTH_SECRET: $ZERO_AUTH_SECRET"

# Start services in background
echo "🚀 Starting Zero cache server..."
npx zero-cache \
  --upstream-db postgres://claude@localhost:5432/bos_development \
  --cvr-db postgres://claude@localhost:5432/bos_development_cvr \
  --change-db postgres://claude@localhost:5432/bos_development_cdb \
  --auth-secret $ZERO_AUTH_SECRET \
  --replica-file /tmp/zero-replica.db \
  --port 4848 \
  --change-streamer-port 4849 \
  --log-level info &

echo "🚀 Starting Rails server..."
rails server -b 0.0.0.0 &

echo "🚀 Starting frontend..."
cd frontend && npm run dev &

echo "✅ All services started! Press Ctrl+C to stop all."
wait
EOF

chmod +x start-dev.sh
./start-dev.sh
```

## **Option 5: Docker Compose**

For a containerized approach:

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  rails:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.development
    depends_on:
      - postgres
      - zero

  zero:
    image: rocicorp/zero-cache
    ports:
      - "4848:4848"
      - "4849:4849"
    env_file:
      - .env.development
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: bos_development
      POSTGRES_USER: claude
      POSTGRES_PASSWORD: ""

# Start with:
docker-compose -f docker-compose.dev.yml up
```

## **Current Setup (.env.development)**

Your environment file contains:

```bash
# Zero Configuration
ZERO_UPSTREAM_DB="postgresql://claude:@127.0.0.1/bos_development"
ZERO_CVR_DB="postgresql://claude:@127.0.0.1/bos_development_cvr"
ZERO_CHANGE_DB="postgresql://claude:@127.0.0.1/bos_development_cdb"
ZERO_AUTH_SECRET="zerosecretkey_dev_only_change_in_production"
NEXT_PUBLIC_ZERO_CACHE_PUBLIC_SERVER="http://localhost:4848"
```

## **Updated Procfile.dev**

Your process file now includes all services:

```
web: bin/rails server -p 3000 -b 0.0.0.0
css: bin/rails dartsass:watch
zero: npx zero-cache --upstream-db postgres://claude@localhost:5432/bos_development --cvr-db postgres://claude@localhost:5432/bos_development_cvr --change-db postgres://claude@localhost:5432/bos_development_cdb --auth-secret $ZERO_AUTH_SECRET --replica-file /tmp/zero-replica.db --port 4848 --change-streamer-port 4849 --log-level info
frontend: cd frontend && npm run dev
```

## **Updated bin/dev Script**

Your startup script now:
- Loads Kamal secrets (if available)
- Loads `.env.development` environment variables
- Shows the loaded `ZERO_AUTH_SECRET`
- Starts all services with foreman

## **Recommended Daily Workflow**

```bash
# Single command to start everything
./bin/dev

# Or with specific services only
./bin/dev web,zero  # Only Rails and Zero
./bin/dev frontend  # Only frontend
```

## **Environment Variable Priority**

1. **Kamal secrets** (`.kamal/secrets.development.real`) - Production-like secrets
2. **Local environment** (`.env.development`) - Development defaults  
3. **System environment** - Manual exports

## **Adding New Environment Variables**

1. Add to `.env.development`
2. Restart with `./bin/dev`
3. All services automatically get the new variables

## **Production Considerations**

- Use **Kamal secrets** for production
- **Never commit** `.env.development` with real secrets
- Use **different secrets** for each environment
- Consider **encrypted secrets** for sensitive values

## **Troubleshooting**

### Environment not loading
```bash
# Check what's loaded
./bin/dev | grep "ZERO_AUTH_SECRET"

# Manual check
source .env.development && echo $ZERO_AUTH_SECRET
```

### Foreman not found
```bash
# Install foreman
gem install foreman

# Or add to Gemfile and bundle install
```

### Services not starting
```bash
# Check individual services
source .env.development && rails server  # Test Rails
source .env.development && npx zero-cache --help  # Test Zero
```

The **Foreman approach (Option 1)** is recommended because it's the Rails standard, handles logging well, and you already have it set up!