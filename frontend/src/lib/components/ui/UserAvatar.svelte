<script lang="ts">
  // Enhanced props interface
  interface UserData {
    id?: string | number;
    name?: string;
    email?: string;
    avatar_url?: string;
    color?: string;
    // Legacy support
    attributes?: {
      name?: string;
      initials?: string;
      avatar_style?: string;
      avatar_url?: string;
    };
  }

  let {
    user,
    size = 'medium' as 'small' | 'medium' | 'large' | 'xlarge' | 'xs' | 'normal',
    shape = 'circle' as 'circle' | 'square',
    showTooltip = false,
    showBorder = false,
    clickable = false,
    onClick,
    className = '',
    style = '',
    overlap = false,
    overlapOrder = 0,
  }: {
    user?: UserData;
    size?: 'small' | 'medium' | 'large' | 'xlarge' | 'xs' | 'normal';
    shape?: 'circle' | 'square';
    showTooltip?: boolean;
    showBorder?: boolean;
    clickable?: boolean;
    onClick?: (user: UserData) => void;
    className?: string;
    style?: string;
    overlap?: boolean;
    overlapOrder?: number;
  } = $props();

  // Map legacy size names to new sizes
  const sizeMap = {
    xs: 'small',
    normal: 'medium',
  } as const;

  const mappedSize = $derived(sizeMap[size as keyof typeof sizeMap] || size);

  // Get user name from various sources
  const userName = $derived(user?.name || user?.attributes?.name || user?.email || 'Unknown User');

  // Generate initials
  const initials = $derived(() => {
    // Use provided initials if available (legacy support)
    if (user?.attributes?.initials) {
      return user.attributes.initials;
    }

    const source = user?.name || user?.attributes?.name || user?.email || '';

    if (!source) return '?';

    // Handle email format
    if (!user?.name && !user?.attributes?.name && user?.email) {
      return user.email.charAt(0).toUpperCase();
    }

    // Handle full names
    const parts = source.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Single name or word
    return source.slice(0, 2).toUpperCase();
  });

  // Avatar style mapping - these match the user avatar styles in the system
  const avatarStyles = {
    red: 'var(--accent-red)',
    blue: 'var(--accent-blue)',
    green: 'var(--accent-green)',
    orange: 'var(--accent-orange)',
    purple: 'var(--accent-purple)',
    gray: 'var(--text-secondary)',
    teal: 'var(--accent-teal)',
  };

  // Generate color from user ID or use provided color
  const backgroundColor = $derived(() => {
    // Direct color provided
    if (user?.color) return user.color;

    // Legacy avatar style
    if (user?.attributes?.avatar_style) {
      return (
        avatarStyles[user.attributes.avatar_style as keyof typeof avatarStyles] || avatarStyles.blue
      );
    }

    // Generate from ID
    if (!user?.id) return avatarStyles.blue;

    const colors = Object.values(avatarStyles);
    const index =
      typeof user.id === 'number'
        ? user.id % colors.length
        : parseInt(String(user.id), 36) % colors.length;

    return colors[index] || avatarStyles.blue;
  });

  // Get avatar URL from various sources
  const avatarUrl = $derived(user?.avatar_url || user?.attributes?.avatar_url);

  // Handle image loading errors
  let imageError = $state(false);

  // Size classes
  const sizeClasses = {
    small: 'avatar--small',
    medium: 'avatar--medium',
    large: 'avatar--large',
    xlarge: 'avatar--xlarge',
  };

  const sizeClass = $derived(
    sizeClasses[mappedSize as keyof typeof sizeClasses] || sizeClasses.medium
  );
</script>

{#if clickable}
  <button
    type="button"
    class="user-avatar {sizeClass} {className}"
    class:avatar--circle={shape === 'circle'}
    class:avatar--square={shape === 'square'}
    class:avatar--clickable={clickable}
    class:avatar--border={showBorder}
    class:avatar--overlap={overlap}
    style="background-color: {backgroundColor()}; {style}"
    style:z-index={overlap ? overlapOrder : undefined}
    onclick={() => onClick?.(user)}
    title={!showTooltip ? userName : undefined}
  >
    {#if avatarUrl && !imageError}
      <img
        src={avatarUrl}
        alt={userName}
        onerror={() => (imageError = true)}
        loading="lazy"
        class="avatar-image"
      />
    {:else}
      <span class="user-initials">{initials()}</span>
    {/if}
  </button>
{:else}
  <div
    class="user-avatar {sizeClass} {className}"
    class:avatar--circle={shape === 'circle'}
    class:avatar--square={shape === 'square'}
    class:avatar--border={showBorder}
    class:avatar--overlap={overlap}
    style="background-color: {backgroundColor()}; {style}"
    style:z-index={overlap ? overlapOrder : undefined}
    title={!showTooltip ? userName : undefined}
  >
    {#if avatarUrl && !imageError}
      <img
        src={avatarUrl}
        alt={userName}
        onerror={() => (imageError = true)}
        loading="lazy"
        class="avatar-image"
      />
    {:else}
      <span class="user-initials">{initials()}</span>
    {/if}
  </div>
{/if}

<style>
  .user-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: white;
    text-shadow: 0.5px 0.5px 2px rgba(0, 0, 0, 0.75);
    position: relative;
    flex-shrink: 0;
    border: none;
    padding: 0;
    overflow: hidden;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.4),
      0 1px 2px rgba(0, 0, 0, 0.2);
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  /* Shape variants */
  .avatar--circle {
    border-radius: 50%;
  }

  .avatar--square {
    border-radius: 6px;
  }

  /* Border variant */
  .avatar--border {
    box-shadow:
      0 0 0 2px var(--bg-primary),
      0 0 0 3px var(--border-primary);
  }

  /* Clickable variant */
  button.avatar--clickable {
  }

  button.avatar--clickable:active {
    transform: scale(0.95);
  }

  /* Size variants */
  .avatar--small {
    width: 24px;
    height: 24px;
  }

  .avatar--medium {
    width: 32px;
    height: 32px;
  }

  .avatar--large {
    width: 40px;
    height: 40px;
  }

  .avatar--xlarge {
    width: 56px;
    height: 56px;
  }

  /* Overlap styles for avatar groups */
  .avatar--overlap:not(:first-child) {
    margin-left: -6px;
  }

  .avatar--overlap.avatar--border {
    box-shadow: 0 0 0 2px var(--bg-primary);
  }

  /* Image styles */
  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Initial styles */
  .user-initials {
    text-transform: uppercase;
    color: white;
    font-weight: 600;
    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.75);
    line-height: 1;
  }

  /* Size-specific font sizes */
  .avatar--small .user-initials {
    font-size: 10px;
  }

  .avatar--medium .user-initials {
    font-size: 14px;
  }

  .avatar--large .user-initials {
    font-size: 16px;
  }

  .avatar--xlarge .user-initials {
    font-size: 20px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .user-avatar {
      transition: none;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .user-avatar {
      border: 2px solid currentColor;
    }

    .avatar--border {
      box-shadow:
        0 0 0 3px var(--bg-primary),
        0 0 0 4px currentColor;
    }
  }

  /* Dark mode adjustments */
  @media (prefers-color-scheme: dark) {
    .user-initials {
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    }
  }
</style>
