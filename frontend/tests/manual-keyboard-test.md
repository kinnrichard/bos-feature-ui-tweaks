# Manual Keyboard Navigation Test for JobStatusButton

## Test Setup
1. Start the development server: `npm run dev`
2. Login and navigate to a job detail page (e.g., `/jobs/[job-id]`)
3. Look for the job status button in the toolbar (shows an emoji)

## Tests to Perform

### 1. No Blue Focus Rings
- [ ] Click the job status button to open the popover
- [ ] Verify NO blue outline appears on any menu items
- [ ] Only a gray background should highlight the focused item

### 2. Arrow Key Navigation
- [ ] Press DOWN arrow - first item should highlight
- [ ] Press DOWN multiple times - highlight should move down
- [ ] Press UP arrow - highlight should move up
- [ ] At the bottom, press DOWN - should wrap to top
- [ ] At the top, press UP - should wrap to bottom

### 3. No Background Interference
- [ ] While popover is open, press UP/DOWN arrows
- [ ] The task list behind should NOT move or respond
- [ ] Only the popover menu should respond to arrow keys

### 4. Selection with Keyboard
- [ ] Navigate to a different status with arrow keys
- [ ] Press SPACE - status should change and popover should close
- [ ] Open again and navigate to another status
- [ ] Press ENTER - status should change and popover should close

### 5. Escape to Close
- [ ] Open the popover
- [ ] Press ESC - popover should close without changing status

## Expected Behavior Summary
- ✅ No blue focus rings anywhere
- ✅ Gray background highlights for keyboard navigation
- ✅ Arrow keys only affect popover, not background
- ✅ Space/Enter selects and closes
- ✅ ESC closes without selection
- ✅ Wrap-around navigation at list boundaries