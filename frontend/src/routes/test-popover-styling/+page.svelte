<script lang="ts">
  import JobStatusButton from '$lib/components/layout/JobStatusButton.svelte';
  import BasePopover from '$lib/components/ui/BasePopover.svelte';
  import PopoverMenu from '$lib/components/ui/PopoverMenu.svelte';
  
  // Mock job for testing
  let mockJob = $state({
    id: '123',
    status: 'in_progress'
  });
  
  // Test options with various states
  const testOptions = [
    { id: 'title', value: 'title', label: 'Test Menu', header: true },
    { id: 'option1', value: 'option1', label: 'Option 1', icon: '📝' },
    { id: 'option2', value: 'option2', label: 'Option 2 (Selected)', icon: '✅' },
    { id: 'option3', value: 'option3', label: 'Option 3', icon: '🔧' },
    { id: 'divider', divider: true },
    { id: 'option4', value: 'option4', label: 'Option 4', icon: '⚡' },
    { id: 'option5', value: 'option5', label: 'Option 5 (Disabled)', icon: '🚫', disabled: true }
  ];
  
  let selectedValue = $state('option2');
  let lastAction = $state('');
  
  function handleSelect(value: string) {
    selectedValue = value;
    lastAction = `Selected: ${value}`;
  }
  
  async function handleStatusChange(newStatus: string) {
    mockJob.status = newStatus;
    lastAction = `Job status changed to: ${newStatus}`;
  }
</script>

<div class="test-container">
  <h1>Popover Styling Test</h1>
  
  <div class="test-section">
    <h2>1. Job Status Button</h2>
    <p>Test the actual JobStatusButton with all requested styling changes:</p>
    
    <div class="test-item">
      <JobStatusButton job={mockJob} onStatusChange={handleStatusChange} />
      <span class="status-info">Current status: {mockJob.status}</span>
    </div>
    
    <div class="checklist">
      <h3>Verify:</h3>
      <ul>
        <li>✓ Title styled like menu item (same height, spacing, font)</li>
        <li>✓ Title has invisible icon space for text alignment</li>
        <li>✓ No extra padding around the menu</li>
        <li>✓ Blue background on keyboard focus (use arrow keys)</li>
        <li>✓ Selected item shows blue background when focused</li>
        <li>✓ White text and text shadow on focused items</li>
      </ul>
    </div>
  </div>
  
  <div class="test-section">
    <h2>2. Test PopoverMenu</h2>
    <p>Direct PopoverMenu test with various states:</p>
    
    <BasePopover>
      {#snippet trigger({ popover })}
        <button 
          class="test-button"
          use:popover.button
        >
          Open Test Menu
        </button>
      {/snippet}
      
      {#snippet children({ close })}
        <PopoverMenu
          options={testOptions}
          selected={selectedValue}
          onSelect={handleSelect}
          onClose={close}
          showCheckmarks={true}
          showIcons={true}
          iconPosition="left"
          enableKeyboard={true}
          autoFocus={true}
        />
      {/snippet}
    </BasePopover>
    
    <div class="checklist">
      <h3>Verify:</h3>
      <ul>
        <li>✓ Header looks like a menu item (not uppercase/small)</li>
        <li>✓ Selected item (Option 2) shows checkmark</li>
        <li>✓ Keyboard navigation highlights items in blue</li>
        <li>✓ Selected+focused shows blue background</li>
        <li>✓ Disabled item cannot be selected</li>
      </ul>
    </div>
  </div>
  
  <div class="action-log">
    <h3>Last Action:</h3>
    <p>{lastAction || 'No action yet'}</p>
  </div>
</div>

<style>
  .test-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  h1 {
    margin-bottom: 2rem;
  }
  
  .test-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: 2rem;
    margin-bottom: 2rem;
  }
  
  .test-section h2 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .test-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.5rem 0;
  }
  
  .status-info {
    color: var(--text-secondary);
  }
  
  .test-button {
    padding: 10px 20px;
    background: var(--accent-blue);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    cursor: default;
    font-weight: 500;
    transition: background 0.15s;
  }
  
  .test-button:hover {
    background: var(--accent-blue-hover);
  }
  
  .checklist {
    margin-top: 2rem;
    padding: 1rem;
    background: var(--bg-tertiary);
    border-radius: var(--radius-md);
  }
  
  .checklist h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
  }
  
  .checklist ul {
    margin: 0;
    padding-left: 1.5rem;
  }
  
  .checklist li {
    margin: 0.5rem 0;
    color: var(--text-secondary);
  }
  
  .action-log {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }
  
  .action-log h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }
  
  .action-log p {
    margin: 0;
    font-family: monospace;
    color: var(--text-secondary);
  }
</style>