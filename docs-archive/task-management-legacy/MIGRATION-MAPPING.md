# Task Management System Migration Mapping

This document maps the legacy task management system (in docs/epics and docs/stories) to the new AI TrackDown system (in tasks/).

## Migration Date: 2025-07-19

## Epic Mapping

| Legacy ID | Legacy Title | AI TrackDown ID | Status |
|-----------|--------------|-----------------|---------|
| epic-012 | Replace Custom Logging with Secure Debug System | EP-0002 | Active → Active |
| Epic-016 | Implement Axios Interceptors for Seamless Token Management | EP-0003 | Backlog → Backlog |
| Epic-017 | Zero.js Client with Rails Backend Integration | EP-0004 | Backlog → Backlog |

## Story to Issue Mapping

| Legacy Story | Legacy Title | AI TrackDown ID | Status |
|--------------|--------------|-----------------|---------|
| 008.1 | Implement ReactiveRecord Base Class | ISS-0001 | In-Progress → Active |
| 008.2 | Complete Epic-008 Model Generation | ISS-0002 | In-Progress → Active |
| 008.3 | Legacy Pattern Cleanup and Component Migration | ISS-0003 | In-Progress → Active |

## Notes

- The migration epic itself is tracked as EP-0001
- Completed epics and stories were archived for historical reference
- All active and backlog work has been migrated to AI TrackDown
- The legacy system used various naming conventions (Epic-XXX, epic-XXX, Story-X.X)
- AI TrackDown uses consistent naming: EP-XXXX (epics), ISS-XXXX (issues), TSK-XXXX (tasks)

## Legacy Structure Archive

The complete legacy task management structure has been archived at:
- `docs/archive/task-management-legacy/epics/`
- `docs/archive/task-management-legacy/stories/`

This includes:
- 15 completed epics
- 3 epics in various states (active/backlog)
- 30+ stories in various states
- All associated documentation and context