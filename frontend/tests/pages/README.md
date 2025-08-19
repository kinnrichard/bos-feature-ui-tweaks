# Page Tests

Comprehensive test suite for the 4 main application pages, built with professional patterns and real API integration.

## 🚀 Quick Start

All tests are pre-configured with `serial` mode for reliable execution - no need to specify `--workers=1`!

### Run All Page Tests
```bash
npx playwright test tests/pages/
```

### Run Individual Pages
```bash
# Jobs List (/jobs)
npx playwright test tests/pages/jobs-list.spec.ts

# Job Detail (/jobs/[id])
npx playwright test tests/pages/jobs-detail.spec.ts

# System Logs (/logs)
npx playwright test tests/pages/logs-system.spec.ts

# Client Logs (/clients/[id]/logs)
npx playwright test tests/pages/logs-client.spec.ts
```

### Debug Mode
```bash
# Visual test runner
npx playwright test tests/pages/jobs-list.spec.ts --ui

# Watch browser execution
npx playwright test tests/pages/jobs-list.spec.ts --headed

# Enable debug logging
DEBUG_PAGE_TESTS=true npx playwright test tests/pages/jobs-list.spec.ts
```

## 📂 Test Structure

Each test file provides comprehensive coverage:

- **Core Functionality**: Data loading, component rendering, page structure
- **Real-time Updates**: Zero.js integration testing  
- **Error Handling**: API failures, invalid IDs, network issues
- **User Experience**: Mobile responsiveness, accessibility, performance
- **Integration**: Cross-component functionality and navigation

## 🔧 Helper Infrastructure

- **`PageTestWrapper`**: Professional test wrapper with console monitoring
- **`LogsTestHelper`**: Specialized functionality for activity logs testing
- **`JobsTestHelper`**: Specialized functionality for jobs and tasks testing

## ✅ Quality Standards

- Zero console errors (Svelte warnings properly filtered)
- Real API integration with automatic cleanup
- Cross-browser testing (Chromium, Firefox, WebKit)
- Professional error reporting and debugging
- Mobile responsiveness validation

## 🗂️ Replaces Deprecated Tests

These professional tests replace the problematic ones moved to `/deprecated`:

- ✅ `jobs-list.spec.ts` → replaces `jobs.spec.ts`
- ✅ `jobs-detail.spec.ts` → replaces `task-drag-drop.spec.ts` & `task-drag-drop-multiselect.spec.ts`
- ✅ `logs-system.spec.ts` → new comprehensive system logs testing
- ✅ `logs-client.spec.ts` → new comprehensive client-specific logs testing

## 🛠️ Troubleshooting

If tests fail with selector issues, the selectors in the helper files may need adjustment to match your DOM Structure. Check:

- `tests/pages/helpers/jobs-test-helper.ts` for jobs-related selectors
- `tests/pages/helpers/logs-test-helper.ts` for logs-related selectors  
- `tests/pages/helpers/page-test-wrapper.ts` for general page patterns

The test infrastructure is solid - any failures are typically just DOM selector mismatches that are easy to fix.