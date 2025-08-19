---
title: "New Developer Getting Started Guide"
description: "Complete onboarding guide for new developers joining the bŏs project"
last_updated: "2025-07-17"
status: "active"
category: "getting-started"
tags: ["onboarding", "new-developer", "environment-setup", "first-contribution"]
---

# New Developer Getting Started Guide

> **Welcome to the bŏs project! This guide will take you from zero to productive contributor.**

## 🎯 Objectives
After completing this guide, you will:
- Have a fully functional development environment
- Understand the project architecture and codebase
- Have made your first successful contribution
- Know how to navigate the development workflow

## 📋 Prerequisites
- Basic knowledge of TypeScript/JavaScript
- Familiarity with Git version control
- Understanding of web development concepts
- Development machine with admin access

## 📚 Quick Context

**bŏs** is a client/job/task management system for IT company technicians. The system tracks:
- **Clients** - Companies being served
- **Jobs** - Work orders and projects
- **Tasks** - Individual work items
- **Devices** - IT equipment per client
- **People** - Client contacts and personnel

### Technology Stack
- **Frontend**: SvelteKit + TypeScript + Tailwind CSS
- **Backend**: Rails 8.0.2 + Ruby 3.4.4 + PostgreSQL
- **Testing**: Playwright (frontend) + Rails Minitest (backend)
- **Deployment**: Kamal + Docker

---

## 🚀 Phase 1: Environment Setup (30-60 minutes)

### 1.1 Clone and Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd bos

# Install Ruby dependencies
bundle install

# Set up database
rails db:create
rails db:migrate
rails db:seed

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 1.2 Verify Backend Setup
```bash
# Start Rails server
rails server -b 0.0.0.0 > /dev/null 2>&1 &

# Test API endpoint
curl http://localhost:3000/api/v1/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 1.3 Verify Frontend Setup
```bash
# Start development server
cd frontend
npm run dev

# Open browser to http://localhost:5173
# Should see the bŏs login page
```

### 1.4 Verify Testing Setup
```bash
# Run backend tests
rails test

# Run frontend tests
cd frontend
npm test
```

### ✅ Verification Checklist
- [ ] Backend server starts without errors
- [ ] Frontend development server starts
- [ ] Login page loads in browser
- [ ] All tests pass
- [ ] API health endpoint responds

---

## 🏗️ Phase 2: Architecture Understanding (60-90 minutes)

### 2.1 Project Structure Overview
```
bos/
├── app/                    # Rails backend application
│   ├── controllers/api/v1/ # API endpoints
│   ├── models/            # Business logic and database models
│   ├── serializers/       # JSON response formatting
│   └── services/          # Business logic services
├── frontend/              # SvelteKit frontend application
│   ├── src/lib/           # Reusable components and utilities
│   ├── src/routes/        # Page components and routing
│   └── tests/             # Playwright tests
├── docs/                  # Documentation
└── config/                # Application configuration
```

### 2.2 Key Architecture Concepts

#### Frontend Architecture
- **SvelteKit**: Full-stack framework with file-based routing
- **TypeScript**: Type-safe JavaScript with excellent tooling
- **Tailwind CSS**: Utility-first CSS framework
- **Reactive State**: Svelte stores for global state management

#### Backend Architecture
- **Rails API**: JSON-only API following REST conventions
- **PostgreSQL**: Primary database with UUID primary keys
- **JWT Authentication**: Stateless authentication system
- **Service Objects**: Business logic encapsulation

#### Data Flow
```
Frontend (SvelteKit) → API (Rails) → Database (PostgreSQL)
```

### 2.3 Core Business Models

#### Client
- Represents companies or organizations served
- Has many jobs, devices, and people
- Tracks billing information and contact details

#### Job
- Work orders or projects for clients
- Has many tasks and can have assigned technicians
- Tracks priority, status, and due dates

#### Task
- Individual work items within jobs
- Can be hierarchical (parent/child relationships)
- Supports drag-and-drop reordering

#### Device
- IT equipment associated with clients
- Tracks hardware details and maintenance history

#### Person
- Contacts and personnel at client organizations
- Can have multiple contact methods (email, phone, etc.)

### 2.4 Essential Reading
1. **[Frontend Architecture](../architecture/frontend-architecture.md)** - Svelte patterns
2. **[Backend Architecture](../architecture/backend-architecture.md)** - Rails API patterns
3. **[Database Schema](../architecture/database-schema.md)** - Data relationships
4. **[API Specification](../api/api-specification.md)** - Endpoint documentation

---

## 🛠️ Phase 3: Development Workflow (45-60 minutes)

### 3.1 Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes...

# Stage and commit changes
git add .
git commit -m "feat: description of changes —CC"

# Push to remote
git push origin feature/your-feature-name

# Create pull request via GitHub
```

### 3.2 Code Quality Checks
```bash
# Frontend type checking and linting
cd frontend
npm run check      # TypeScript type checking
npm run lint       # ESLint code quality
npm run format     # Prettier code formatting

# Backend code quality
cd ..
rubocop -A         # Ruby code style fixes
```

### 3.3 Testing Workflow
```bash
# Run all tests
npm run test       # Frontend Playwright tests
rails test         # Backend Rails tests

# Run specific test categories
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e         # End-to-end tests only

# Run tests with browser visible (debugging)
npm run test:headed
```

### 3.4 Development Servers
```bash
# Start all development servers
rails server -b 0.0.0.0 > /dev/null 2>&1 &  # Backend API
cd frontend && npm run dev                    # Frontend dev server

# Access points:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:3000
```

---

## 🎯 Phase 4: First Contribution (60-90 minutes)

### 4.1 Choose a Starter Task
Good first contribution options:
- **Fix a typo or improve documentation**
- **Add a small UI improvement**
- **Write additional tests for existing functionality**
- **Fix a minor bug from the issue tracker**

### 4.2 Make Your First Change

#### Example: Add a New Button to Job Detail Page

1. **Locate the relevant files:**
   ```bash
   # Frontend job detail page
   frontend/src/routes/jobs/[id]/+page.svelte
   
   # Backend job controller
   app/controllers/api/v1/jobs_controller.rb
   ```

2. **Make the change:**
   ```svelte
   <!-- Add to job detail page -->
   <button class="btn btn-primary" on:click={handleExampleAction}>
     Example Action
   </button>
   ```

3. **Add corresponding functionality:**
   ```javascript
   function handleExampleAction() {
     console.log('Example action triggered');
     // Add your functionality here
   }
   ```

4. **Write a test:**
   ```javascript
   // frontend/tests/jobs/example-action.spec.ts
   import { test, expect } from '@playwright/test';
   
   test('example action button works', async ({ page }) => {
     await page.goto('/jobs/1');
     await page.click('button:text("Example Action")');
     // Add assertions
   });
   ```

### 4.3 Test Your Changes
```bash
# Run tests to ensure nothing breaks
npm test

# Check code quality
npm run check && npm run lint

# Start dev server and manually test
npm run dev
```

### 4.4 Submit Your Change
```bash
# Commit your changes
git add .
git commit -m "feat: add example action button to job detail page —CC"

# Push and create pull request
git push origin feature/add-example-action
```

---

## 📈 Phase 5: Next Steps (Ongoing)

### 5.1 Immediate Next Steps
1. **Explore the codebase** - Look at existing components and patterns
2. **Read more documentation** - Architecture guides and technical decisions
3. **Join team communications** - Slack, meetings, code reviews
4. **Pick up your first real task** - From the project backlog

### 5.2 Learning Path Progression
- **Week 1-2**: Complete onboarding, make first contributions
- **Week 3-4**: Take on small features, learn testing patterns
- **Week 5-8**: Contribute to larger features, understand architecture
- **Week 9+**: Lead features, mentor other new developers

### 5.3 Key Resources for Continued Learning
- **[Development Guides](../development/)** - Advanced development patterns
- **[Testing Documentation](../testing/)** - Comprehensive testing approaches
- **[Architecture Decisions](../architecture/decisions/)** - Technical decision records
- **[Team Processes](../processes/)** - Team workflow and communication

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Environment Setup Issues
```bash
# Ruby version issues
rbenv install 3.4.4
rbenv global 3.4.4

# Node version issues
nvm install 18
nvm use 18

# Database connection issues
rails db:reset
rails db:seed
```

#### Development Server Issues
```bash
# Port already in use
pkill -f "rails server"
pkill -f "npm run dev"

# Clear caches
rm -rf tmp/cache
rm -rf node_modules/.cache
```

#### Test Failures
```bash
# Reset test database
RAILS_ENV=test rails db:reset

# Clear Playwright cache
npx playwright install

# Run single test for debugging
npm test -- --grep "specific test name"
```

### Getting Help
- **[FAQ](./faq.md)** - Common questions and answers
- **[Troubleshooting Guide](./troubleshooting.md)** - Detailed problem solutions
- **Team Slack** - Real-time help from team members
- **GitHub Issues** - Report bugs or request features

---

## ✅ Success Criteria

You've successfully completed new developer onboarding when you can:
- [ ] Set up and run the development environment independently
- [ ] Navigate the codebase and understand the architecture
- [ ] Make code changes following project conventions
- [ ] Write and run tests for your changes
- [ ] Submit pull requests following the team workflow
- [ ] Participate in code reviews and team discussions

---

## 📚 Additional Resources

### Essential Documentation
- **[Coding Standards](../architecture/coding-standards.md)** - Code style and conventions
- **[API Documentation](../api/README.md)** - Complete API reference
- **[Testing Guide](../testing/README.md)** - Comprehensive testing strategies

### Learning Resources
- **[SvelteKit Tutorial](https://learn.svelte.dev/)** - Official Svelte tutorial
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)** - TypeScript documentation
- **[Rails API Guide](https://guides.rubyonrails.org/api_app.html)** - Rails API development

### Tools and Extensions
- **VS Code Extensions**: Svelte, TypeScript, Tailwind CSS
- **Browser Extensions**: Svelte DevTools, React DevTools
- **CLI Tools**: GitHub CLI, Rails CLI, npm scripts

---

**Welcome to the team! You're now ready to start contributing to the bŏs project.**

*Remember: Don't hesitate to ask questions. The team is here to help you succeed.*