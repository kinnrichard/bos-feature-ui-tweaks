<script lang="ts">
  interface Props {
    name: string;
    size?: 'small' | 'medium' | 'large';
    customClass?: string;
  }

  let { name, size = 'medium', customClass = '' }: Props = $props();

  // Get initials from name
  function getInitials(fullName: string): string {
    if (!fullName) return '?';

    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    // Take first letter of first name and last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Generate a consistent color based on the name
  function getColorFromName(name: string): string {
    if (!name) return '#6B7280'; // Default gray

    const colors = [
      '#EF4444', // red
      '#F59E0B', // amber
      '#10B981', // emerald
      '#3B82F6', // blue
      '#8B5CF6', // violet
      '#EC4899', // pink
      '#14B8A6', // teal
      '#F97316', // orange
    ];

    // Simple hash function to get consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  const initials = $derived(getInitials(name));
  const backgroundColor = $derived(getColorFromName(name));

  const sizeClasses = {
    small: 'avatar-small',
    medium: 'avatar-medium',
    large: 'avatar-large',
  };
</script>

<div
  class="person-avatar {sizeClasses[size]} {customClass}"
  style="background-color: {backgroundColor}"
  aria-label="{name} avatar"
>
  {initials}
</div>

<style>
  .person-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: white;
    font-weight: 600;
    flex-shrink: 0;
    user-select: none;
  }

  .avatar-small {
    width: 32px;
    height: 32px;
    font-size: 0.75rem;
  }

  .avatar-medium {
    width: 40px;
    height: 40px;
    font-size: 0.875rem;
  }

  .avatar-large {
    width: 64px;
    height: 64px;
    font-size: 1.25rem;
  }
</style>
