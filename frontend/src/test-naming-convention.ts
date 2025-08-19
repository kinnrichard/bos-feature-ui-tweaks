// Test file to verify ESLint naming convention rules
// import JobReactive from '$lib/models/generated/job'; // Commented out - Epic-008 migration

// ✅ This should be fine - TypeScript file using ReactiveModel
// const jobs = JobReactive.all();

// This would trigger a warning if we were in a .js file:
// ReactiveModel usage in non-Svelte files should show ESLint warning