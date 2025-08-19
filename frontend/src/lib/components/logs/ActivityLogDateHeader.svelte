<script lang="ts">
  interface Props {
    date: Date | string;
  }

  let { date }: Props = $props();

  const dateObj = $derived(typeof date === 'string' ? new Date(date) : date);

  const formattedDate = $derived(() => {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(today);
    const dayBeforeYesterday = new Date(today);
    const oneWeekAgo = new Date(today);
    
    // Set up comparison dates
    today.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    dayBeforeYesterday.setHours(0, 0, 0, 0);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(dateObj);
    compareDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((today.getTime() - compareDate.getTime()) / (1000 * 60 * 60 * 24));

    if (compareDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else if (daysDiff >= 2 && daysDiff <= 6) {
      // Show day name for recent days
      return dateObj.toLocaleDateString('en-US', { 
        weekday: 'long' 
      });
    } else if (daysDiff >= 7 && daysDiff <= 13) {
      return 'Last Week';
    } else if (compareDate.getTime() >= oneWeekAgo.getTime()) {
      // Recent dates with day and date
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } else {
      // Older dates with full format
      const currentYear = now.getFullYear();
      const logYear = dateObj.getFullYear();
      
      if (logYear === currentYear) {
        // Same year - don't show year
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'long',
          day: 'numeric'
        });
      } else {
        // Different year - show full date
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
  });
</script>

<div class="date-header">
  <span class="date-text">{formattedDate()}</span>
  <div class="date-line"></div>
</div>

<style>
  .date-header {
    display: flex;
    align-items: center;
    margin: 1.5rem 0 1rem;
    position: relative;
  }

  .date-text {
    background-color: var(--bg-primary);
    padding: 0 0.75rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    z-index: 1;
  }

  .date-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--border-primary);
    top: 50%;
    transform: translateY(-50%);
  }
</style>