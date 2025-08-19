---
epic_id: EP-0011
title: "Rails Backend to backend/ Folder Migration"
description: "Restructure monorepo by moving Rails application from root to dedicated backend/ directory for improved organization and separation of concerns"
status: planning
priority: high
assignee: "BOS Engineering Team"
created_date: 2025-07-31T00:00:00.000Z
updated_date: 2025-07-31T01:00:00.000Z
estimated_tokens: 0
actual_tokens: 0
ai_context: []
sync_status: local
related_issues: []
dependencies: []
completion_percentage: 0
---

# EP-0011: Rails Backend to backend/ Folder Migration Epic

## 🎯 Epic Overview

**Epic ID**: EP-0011  
**Title**: Rails Backend to backend/ Folder Migration  
**Status**: Planning  
**Priority**: High  
**Estimated Duration**: 2-3 weeks  
**Team**: BOS Engineering Team  

## 📋 Executive Summary

### Overview
This epic covers the comprehensive migration of the Rails backend application from the repository root to a dedicated `backend/` directory. This restructuring will improve monorepo organization, clarify separation of concerns between frontend and backend, and align with common monorepo patterns.

### Current State
```
/bos (Rails at root)
├── app/           (Rails MVC)
├── config/        (Rails config)
├── db/            (Database)
├── frontend/      (SvelteKit app)
├── lib/           (Rails libraries)
└── ...other Rails directories
```

### Target State
```
/bos (Clean monorepo root)
├── backend/       (Rails application)
│   ├── app/
│   ├── config/
│   ├── db/
│   └── ...all Rails directories
├── frontend/      (SvelteKit app)
└── ...shared tooling at root
```

### Success Criteria
- ✅ All Rails code organized under `backend/` directory
- ✅ Development workflow (`bin/dev`) works seamlessly
- ✅ ReactiveRecord generator functions with correct paths
- ✅ All tests pass without modification
- ✅ CI/CD pipelines execute successfully
- ✅ Deployment process functions correctly
- ✅ Zero.js integration continues working
- ✅ Kamal deployment commands work with new paths
- ✅ No regression in functionality
- ✅ Clear documentation for new structure
- ✅ Team onboarding materials updated

## 🚀 Implementation Phases

### Phase 1: Planning & Analysis (2-3 days)
**Priority**: P0  
**Dependencies**: None  
**Status**: Planning  

#### Deliverables
1. **Comprehensive File Inventory**
   - Complete list of Rails directories to move
   - Identification of all configuration files requiring updates
   - Mapping of script and tool dependencies

2. **Impact Analysis**
   - Frontend integration points
   - CI/CD pipeline modifications needed
   - Deployment configuration changes
   - Development workflow impacts

3. **Migration Script Design**
   - Automated migration script planning
   - Rollback strategy definition
   - Testing approach documentation

#### Tasks Breakdown
- [ ] Inventory all Rails-specific directories at root
- [ ] Analyze configuration files for path dependencies
- [ ] Map all scripts referencing Rails paths
- [ ] Document frontend-backend integration points
- [ ] Review CI/CD workflows for required changes
- [ ] Create migration checklist
- [ ] Design automated migration script

### Phase 2: Backend Migration (3-4 days)
**Priority**: P0  
**Dependencies**: Phase 1 completion  
**Status**: Not Started  

#### Deliverables
1. **Directory Structure Creation**
   ```bash
   backend/
   ├── app/
   ├── bin/
   ├── config/
   ├── db/
   ├── lib/
   ├── public/
   ├── spec/
   ├── test/
   ├── tmp/
   ├── vendor/
   ├── Gemfile
   ├── Gemfile.lock
   ├── Rakefile
   └── config.ru
   ```

2. **Rails Application Migration**
   - All Rails files moved to backend/
   - Internal Rails configurations updated
   - Relative paths within Rails maintained

3. **Configuration Updates**
   - Rails internal paths updated
   - Asset pipeline configurations
   - Database connection settings

#### Tasks Breakdown
- [ ] Create backend/ directory structure
- [ ] Move Rails application directories
- [ ] Move Rails configuration files
- [ ] Update Rails internal path references
- [ ] Move Gemfile and Gemfile.lock
- [ ] Update bundler configuration
- [ ] Update ReactiveRecord generator default output_dir path (from `frontend/src/lib/models` to `../frontend/src/lib/models`)
- [ ] Update scripts/zero-dev-server.js config path reference
- [ ] Update bin/setup Rails command paths (`bin/rails db:prepare`, `bin/rails log:clear`)
- [ ] Update bin/test-servers Rails server path
- [ ] Verify Rails console functionality
- [ ] Test Rails server startup

### Phase 3: Integration Updates (2-3 days)
**Priority**: P0  
**Dependencies**: Phase 2 completion  
**Status**: Not Started  

#### Deliverables
1. **Root Configuration Updates**
   ```ruby
   # Updated config.ru
   require_relative "backend/config/environment"
   
   # Updated Rakefile
   require_relative "backend/config/application"
   ```

2. **Development Environment Updates**
   - Procfile.dev modifications
   - bin/dev script updates
   - Docker configuration changes
   - Development scripts migration

3. **CI/CD Pipeline Updates**
   - GitHub Actions workflow modifications
   - Test runner path updates
   - Linting tool configurations
   - Security scan configurations

4. **Deployment Configuration Updates**
   - Kamal deployment configurations
   - Docker build context updates
   - Environment variable adjustments

#### Tasks Breakdown
- [ ] Update root config.ru
- [ ] Update root Rakefile
- [ ] Modify Procfile.dev for new paths
- [ ] Update Dockerfile with new structure
- [ ] Update .github/workflows/ci.yml
- [ ] Update .github/workflows/deploy-dev.yml
- [ ] Modify bin/dev script (including generator paths)
- [ ] Update bin/setup script
- [ ] Update package.json scripts
- [ ] Modify Zero.js server configuration
- [ ] Update Kamal deployment command paths in config/deploy.yml (console, dbc, routes, migrate, seed, reset, dbsetup)
- [ ] Update Kamal deployment command paths in config/deploy.development.yml
- [ ] Update .git/config textconv path for credentials diff
- [ ] Verify scripts/shared-lint.sh path detection logic
- [ ] Update any hardcoded Rails paths in test files

### Phase 4: Validation & Documentation (2-3 days)
**Priority**: P1  
**Dependencies**: Phase 3 completion  
**Status**: Not Started  

#### Deliverables
1. **Comprehensive Testing**
   - Development environment validation
   - CI/CD pipeline execution
   - Deployment process testing
   - Integration testing

2. **Documentation Updates**
   - README.md updates
   - Development setup guide
   - Deployment documentation
   - Architecture diagrams

3. **Team Handoff**
   - Migration guide for developers
   - Troubleshooting documentation
   - Team training materials

#### Tasks Breakdown
- [ ] Run full test suite
- [ ] Validate development workflow
- [ ] Test ReactiveRecord generator with new paths (`rails generate zero:active_models`)
- [ ] Verify bin/setup works from backend/ directory
- [ ] Test complete development workflow: bin/dev → generator → server startup
- [ ] Test CI/CD pipelines
- [ ] Perform deployment dry-run
- [ ] Validate Kamal commands work with new backend/ paths
- [ ] Update project README
- [ ] Update development documentation
- [ ] Create migration troubleshooting guide
- [ ] Conduct team walkthrough
- [ ] Archive old configuration references

## 📊 Detailed Task Breakdown

### Configuration File Updates

#### Root Level Files
| File | Changes Required | Priority |
|------|-----------------|----------|
| config.ru | Update require path to backend/config/environment | P0 |
| Rakefile | Update require path to backend/config/application | P0 |
| Dockerfile | Update WORKDIR and COPY paths | P0 |
| Procfile.dev | Update Rails server path | P0 |
| package.json | Update script references to backend | P1 |
| .gitignore | Add backend-specific ignores | P2 |

#### CI/CD Files
| File | Changes Required | Priority |
|------|-----------------|----------|
| .github/workflows/ci.yml | Update Ruby tool paths | P0 |
| .github/workflows/deploy-dev.yml | Update deployment context | P0 |
| .github/workflows/playwright.yml | Verify no changes needed | P1 |

#### Script Updates
| Script | Changes Required | Priority |
|------|-----------------|----------|
| bin/dev | Update to use backend/Procfile.dev and generator paths | P0 |
| bin/setup | Update Rails setup paths (`bin/rails db:prepare`, `bin/rails log:clear`) | P0 |
| bin/test-servers | Update Rails server path for test environment | P0 |
| scripts/zero-dev-server.js | Update config path references (zero-config.json location) | P0 |
| scripts/shared-lint.sh | Update Ruby file paths and backend detection logic | P1 |
| scripts/claude-lint-hook.sh | Update Rails paths | P1 |

#### Generator Updates
| Generator | Changes Required | Priority |
|------|-----------------|----------|
| ReactiveRecord Generator | Update default output_dir from `frontend/src/lib/models` to `../frontend/src/lib/models` | P0 |

#### Deployment Configuration Updates
| File | Changes Required | Priority |
|------|-----------------|----------|
| config/deploy.yml | Update all kamal exec command paths (console, dbc, routes, migrate, seed, reset, dbsetup) | P0 |
| config/deploy.development.yml | Update all kamal exec command paths | P0 |
| .git/config | Update textconv path for credentials diff | P1 |

### Directory Migration Map

```bash
# Source → Destination
./app/         → ./backend/app/
./bin/         → ./backend/bin/
./config/      → ./backend/config/
./db/          → ./backend/db/
./lib/         → ./backend/lib/
./log/         → ./backend/log/
./public/      → ./backend/public/
./spec/        → ./backend/spec/
./test/        → ./backend/test/
./tmp/         → ./backend/tmp/
./vendor/      → ./backend/vendor/
./Gemfile      → ./backend/Gemfile
./Gemfile.lock → ./backend/Gemfile.lock
./.ruby-version → ./backend/.ruby-version
```

## 🎯 Success Metrics & KPIs

### Technical Metrics
- **Test Coverage**: Maintain 100% of existing test coverage
- **CI/CD Success Rate**: 100% pipeline success post-migration
- **Performance**: No degradation in application performance
- **Development Velocity**: No increase in setup or build times

### Process Metrics
- **Migration Duration**: Complete within 2-3 week timeline
- **Rollback Time**: < 30 minutes if issues arise
- **Documentation Coverage**: 100% of changes documented
- **Team Adoption**: 100% of team comfortable with new structure

### Quality Metrics
- **Zero Downtime**: No production impact during migration
- **Bug Introduction**: Zero new bugs from migration
- **Code Quality**: Maintain or improve code quality scores

## 🔧 Technical Dependencies

### External Dependencies
- Ruby version compatibility maintained
- Rails framework version unchanged
- PostgreSQL connection strings preserved
- Redis configuration maintained
- Zero.js integration preserved

### Internal Dependencies
- Frontend API endpoints unchanged
- Shared scripts compatibility
- Development tool configurations
- Deployment pipeline integrity

## 🚨 Risks & Mitigation

### High Priority Risks

#### Risk 1: ReactiveRecord Generator Path Issues
**Impact**: Critical  
**Probability**: High  
**Mitigation**:
- Test generator with new paths before migration
- Update generator configuration early in Phase 2
- Ensure bin/dev startup includes generator test
- Document generator path changes clearly

#### Risk 2: Development Workflow Disruption
**Impact**: High  
**Probability**: Medium  
**Mitigation**:
- Comprehensive testing of bin/dev workflow
- Test all development scripts (bin/setup, bin/test-servers)
- Clear documentation of changes
- Pair programming during initial adoption

#### Risk 3: CI/CD Pipeline Failures
**Impact**: High  
**Probability**: Medium  
**Mitigation**:
- Test all workflows in feature branch
- Gradual rollout with monitoring
- Maintain rollback capability

#### Risk 4: Deployment Configuration Issues
**Impact**: Critical  
**Probability**: Low  
**Mitigation**:
- Test deployment in staging environment
- Test all Kamal commands with new paths
- Maintain old configuration backup
- Document all deployment changes

### Medium Priority Risks

#### Risk 5: Path Reference Bugs
**Impact**: Medium  
**Probability**: High  
**Mitigation**:
- Comprehensive grep for path references
- Special attention to generator paths
- Automated testing of all endpoints
- Code review focus on path changes

#### Risk 6: Zero.js Configuration Issues
**Impact**: Medium  
**Probability**: Medium  
**Mitigation**:
- Test Zero.js server with new config paths
- Verify zero-config.json is found correctly
- Test development server startup thoroughly

#### Risk 7: Team Adoption Challenges
**Impact**: Medium  
**Probability**: Low  
**Mitigation**:
- Team walkthrough session
- Pair programming support
- Quick reference guide creation

## 📅 Timeline & Milestones

### Week 1
- **Day 1-2**: Phase 1 - Planning & Analysis
- **Day 3-5**: Phase 2 - Backend Migration (Part 1)

### Week 2
- **Day 1-2**: Phase 2 - Backend Migration (Part 2)
- **Day 3-5**: Phase 3 - Integration Updates

### Week 3
- **Day 1-2**: Phase 4 - Validation & Documentation
- **Day 3**: Team handoff and training
- **Day 4-5**: Buffer for issues and refinements

### Key Milestones
- **Milestone 1**: Migration plan approved (Day 2)
- **Milestone 2**: Backend successfully moved (Day 7)
- **Milestone 3**: All integrations updated (Day 10)
- **Milestone 4**: Full validation complete (Day 12)
- **Milestone 5**: Team handoff complete (Day 13)

## 🔄 Migration Strategy

### Approach: Big Bang Migration
- Single coordinated migration effort
- Feature branch for all changes
- Comprehensive testing before merge
- Clear rollback strategy

### Migration Steps
1. Create feature branch: `feature/backend-folder-migration`
2. Run automated migration script
3. Manual configuration updates
4. Comprehensive testing
5. Team review and approval
6. Merge to main branch
7. Monitor for issues
8. Document lessons learned

### Rollback Plan
1. Maintain backup of current structure
2. Git revert capability preserved
3. Automated rollback script prepared
4. < 30 minute rollback execution

## 📋 Definition of Done

### Phase 1 Completion Criteria
- [ ] All Rails directories inventoried
- [ ] All configuration dependencies mapped
- [ ] Migration script created and tested
- [ ] Team approval on approach

### Phase 2 Completion Criteria
- [ ] All Rails files in backend/ directory
- [ ] Rails server starts successfully
- [ ] Rails console functions properly
- [ ] ReactiveRecord generator updated with correct paths
- [ ] bin/setup and bin/test-servers updated
- [ ] Zero.js configuration paths updated
- [ ] All Rails tests pass

### Phase 3 Completion Criteria
- [ ] Development environment fully functional
- [ ] CI/CD pipelines execute successfully
- [ ] Deployment configurations updated
- [ ] Kamal commands updated and tested
- [ ] Git config updated for credentials diff
- [ ] All script paths verified
- [ ] Integration tests pass

### Phase 4 Completion Criteria
- [ ] All documentation updated
- [ ] Team training completed
- [ ] Production deployment successful
- [ ] Post-migration monitoring stable

### Epic Completion Criteria
- [ ] All phases completed successfully
- [ ] Zero production incidents
- [ ] Team productivity restored
- [ ] Documentation comprehensive
- [ ] Lessons learned documented

## 📞 Epic Coordination

### Stakeholders
- **Epic Owner**: Engineering Lead
- **Technical Lead**: Senior Rails Developer
- **Frontend Lead**: Senior Frontend Developer
- **DevOps Lead**: Infrastructure Engineer
- **QA Lead**: Quality Assurance Engineer

### Communication Plan
- **Daily Standups**: Progress updates during migration
- **Phase Reviews**: End of each phase checkpoint
- **Slack Channel**: #rails-backend-migration
- **Documentation**: Confluence migration page

### Meeting Schedule
- **Kickoff Meeting**: Phase 1, Day 1
- **Phase 1 Review**: Phase 1, Day 3
- **Phase 2 Review**: Phase 2, Day 4
- **Phase 3 Review**: Phase 3, Day 3
- **Retrospective**: Phase 4, Day 3

### Success Celebration
- Team lunch after successful migration
- Technical blog post about migration approach
- Sharing lessons learned with wider engineering org