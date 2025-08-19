export interface DragActionOptions {
  onSort?: (event: DragSortEvent) => void;
  onStart?: (event: DragStartEvent) => void;
  onBeforeStart?: (event: DragStartEvent) => void;
  onEnd?: (event: DragEndEvent) => void;
  onMove?: (event: DragMoveEvent) => boolean | void;
}

export interface DragStartEvent {
  item: HTMLElement;
  items: HTMLElement[];
  from: HTMLElement;
}

export interface DragEndEvent {
  item: HTMLElement;
  items: HTMLElement[];
  from: HTMLElement;
  to: HTMLElement | null;
  newIndex: number;
  oldIndex: number;
  dropZone: DropZoneInfo | null;
}

export interface DragSortEvent extends DragEndEvent {}

export interface DragMoveEvent {
  dragged: HTMLElement;
  related: HTMLElement;
  dropZone: DropZoneInfo | null;
}

export type DropZoneInfo = {
  mode: 'reorder' | 'nest';
  position?: 'above' | 'below';
  targetElement: HTMLElement;
  targetTaskId?: string;
};

let dragState: {
  isDragging: boolean;
  draggedElements: HTMLElement[];
  draggedData: string[];
  currentDropZone: DropZoneInfo | null;
  dragContainer: HTMLElement | null;
} = {
  isDragging: false,
  draggedElements: [],
  draggedData: [],
  currentDropZone: null,
  dragContainer: null
};

export function nativeDrag(node: HTMLElement, options: DragActionOptions = {}) {
  let dragOverElement: HTMLElement | null = null;

  function handleDragStart(event: DragEvent) {
    if (!event.target || !event.dataTransfer) return;
    
    // Use event delegation - find the draggable element
    const draggedElement = (event.target as HTMLElement).closest('[data-task-id]') as HTMLElement;
    if (!draggedElement) return;
    
    // Prevent dragging non-editable tasks (e.g., discarded tasks)
    if (draggedElement.classList.contains('non-editable')) {
      event.preventDefault();
      return;
    }
    
    const taskId = draggedElement.getAttribute('data-task-id');
    if (!taskId) return;
    
    // Blur any contenteditable elements to prevent edit mode appearance during drag
    const contentEditable = draggedElement.querySelector('[contenteditable="true"]') as HTMLElement;
    if (contentEditable && contentEditable === document.activeElement) {
      contentEditable.blur();
    }

    // Get all selected elements for multi-drag
    const selectedElements = Array.from(node.querySelectorAll('.task-selected-for-drag')) as HTMLElement[];
    const elementsToAdd = selectedElements.length > 0 && selectedElements.includes(draggedElement) 
      ? selectedElements 
      : [draggedElement];

    dragState.isDragging = true;
    dragState.draggedElements = elementsToAdd;
    dragState.draggedData = elementsToAdd.map(el => el.getAttribute('data-task-id') || '');
    dragState.dragContainer = node;

    // Call onBeforeStart callback BEFORE applying any styling changes
    options.onBeforeStart?.({
      item: draggedElement,
      items: elementsToAdd,
      from: node
    });

    // Add dragging class to elements (opacity handled by CSS)
    elementsToAdd.forEach(el => {
      el.classList.add('task-dragging');
    });

    // Set drag data
    event.dataTransfer.setData('text/plain', dragState.draggedData.join(','));
    event.dataTransfer.effectAllowed = 'move';

    // Create custom drag image
    const dragImage = createDragImage(elementsToAdd);
    event.dataTransfer.setDragImage(dragImage, 0, 0);

    options.onStart?.({
      item: draggedElement,
      items: elementsToAdd,
      from: node
    });
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (!dragState.isDragging || !event.target) return;

    const targetElement = (event.target as HTMLElement).closest('[data-task-id]') as HTMLElement;
    if (!targetElement || dragState.draggedElements.includes(targetElement)) return;

    // Clear previous feedback
    clearAllVisualFeedback();

    // Detect drop zone
    const dropZone = detectDropZone(targetElement, event);
    if (!dropZone) return;

    // Debug logging
    dragState.currentDropZone = dropZone;
    dragOverElement = targetElement;

    // Show visual feedback
    if (dropZone.mode === 'reorder') {
      addDropIndicator(targetElement, dropZone.position!);
    } else if (dropZone.mode === 'nest') {
      addNestHighlight(targetElement);
    }

    // Call onMove callback
    options.onMove?.({
      dragged: dragState.draggedElements[0],
      related: targetElement,
      dropZone
    });
  }

  function handleDragLeave(event: DragEvent) {
    // Only clear feedback if we're leaving the entire container
    if (!node.contains(event.relatedTarget as Node)) {
      clearAllVisualFeedback();
      dragState.currentDropZone = null;
      dragOverElement = null;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    if (!dragState.isDragging) return;

    const dropZone = dragState.currentDropZone;
    const targetElement = dragOverElement;

    if (dropZone && targetElement) {
      let newIndex = Array.from(node.children).indexOf(targetElement);
      const oldIndex = Array.from(node.children).indexOf(dragState.draggedElements[0]);

      // Adjust newIndex based on drop position for reordering
      if (dropZone.mode === 'reorder' && dropZone.position === 'below') {
        newIndex += 1;
      }

      options.onSort?.({
        item: dragState.draggedElements[0],
        items: dragState.draggedElements,
        from: node,
        to: node,
        newIndex,
        oldIndex,
        dropZone
      });
    }

    handleDragEnd();
  }

  function handleDragEnd() {
    if (!dragState.isDragging) return;

    // Store references before they're cleared
    const elementsToRestore = [...dragState.draggedElements];
    
    // Restore dragged elements with fade-in animation
    requestAnimationFrame(() => {
      elementsToRestore.forEach(el => {
        // Add animation class before removing dragging class
        el.classList.add('task-drag-ending');
        el.classList.remove('task-dragging');
        
        // Remove animation class after animation completes
        setTimeout(() => {
          el.classList.remove('task-drag-ending');
        }, 1000); // Match animation duration
      });
    });

    clearAllVisualFeedback();

    options.onEnd?.({
      item: dragState.draggedElements[0],
      items: dragState.draggedElements,
      from: node,
      to: dragOverElement ? node : null,
      newIndex: dragOverElement ? Array.from(node.children).indexOf(dragOverElement) : -1,
      oldIndex: Array.from(node.children).indexOf(dragState.draggedElements[0]),
      dropZone: dragState.currentDropZone
    });

    // Reset state
    dragState.isDragging = false;
    dragState.draggedElements = [];
    dragState.draggedData = [];
    dragState.currentDropZone = null;
    dragState.dragContainer = null;
    dragOverElement = null;
  }

  // Set draggable attribute on all current and future task elements
  function setupDraggableAttributes() {
    const draggableElements = node.querySelectorAll('[data-task-id]');
    draggableElements.forEach(el => {
      // Only make tasks draggable if they're not marked as non-editable
      const isNonEditable = el.classList.contains('non-editable');
      el.setAttribute('draggable', isNonEditable ? 'false' : 'true');
    });
  }

  // Add container event listeners (using event delegation for dragstart)
  node.addEventListener('dragstart', handleDragStart); // Event delegation
  node.addEventListener('dragover', handleDragOver);
  node.addEventListener('dragleave', handleDragLeave);
  node.addEventListener('drop', handleDrop);
  node.addEventListener('dragend', handleDragEnd);

  // Initial setup - only set draggable attributes
  setupDraggableAttributes();

  return {
    update(newOptions: DragActionOptions) {
      Object.assign(options, newOptions);
      // Re-setup draggable attributes for any new elements
      setupDraggableAttributes();
    },
    destroy() {
      node.removeEventListener('dragstart', handleDragStart);
      node.removeEventListener('dragover', handleDragOver);
      node.removeEventListener('dragleave', handleDragLeave);
      node.removeEventListener('drop', handleDrop);
      node.removeEventListener('dragend', handleDragEnd);
    }
  };
}

function detectDropZone(targetElement: HTMLElement, event: DragEvent): DropZoneInfo | null {
  const rect = targetElement.getBoundingClientRect();
  const relativeY = event.clientY - rect.top;
  const heightRatio = relativeY / rect.height;
  const taskId = targetElement.getAttribute('data-task-id');

  // Drop zones: Top 30% = reorder above, Bottom 30% = reorder below, Middle 40% = nest
  if (heightRatio <= 0.3) {
    return {
      mode: 'reorder',
      position: 'above',
      targetElement,
      targetTaskId: taskId || undefined
    };
  } else if (heightRatio >= 0.7) {
    return {
      mode: 'reorder',
      position: 'below',
      targetElement,
      targetTaskId: taskId || undefined
    };
  } else {
    return {
      mode: 'nest',
      targetElement,
      targetTaskId: taskId || undefined
    };
  }
}

function createDragImage(elements: HTMLElement[]): HTMLElement {
  const dragImage = document.createElement('div');
  dragImage.style.cssText = `
    position: absolute;
    top: -1000px;
    left: -1000px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    color: #374151;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    z-index: 9999;
  `;

  const firstElement = elements[0];
  const title = firstElement.querySelector('.task-title')?.textContent || 'Task';
  
  if (elements.length === 1) {
    dragImage.textContent = title;
  } else {
    dragImage.innerHTML = `${title} <span style="background: #3b82f6; color: white; border-radius: 12px; padding: 2px 8px; font-size: 12px; margin-left: 8px;">+${elements.length - 1}</span>`;
  }

  document.body.appendChild(dragImage);
  
  // Clean up after a delay
  setTimeout(() => {
    if (dragImage.parentNode) {
      dragImage.parentNode.removeChild(dragImage);
    }
  }, 1000);

  return dragImage;
}

export function addDropIndicator(targetElement: HTMLElement, position: 'above' | 'below') {
  removeDropIndicator();
  
  const indicator = document.createElement('div');
  indicator.className = 'drag-drop-indicator';
  indicator.style.cssText = `
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #007AFF, #0099FF);
    border-radius: 2px;
    opacity: 1;
    box-shadow: 0 1px 4px rgba(0, 122, 255, 0.4);
    pointer-events: none;
    z-index: 1000;
  `;
  
  const rect = targetElement.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  
  indicator.style.left = rect.left + scrollLeft + 'px';
  indicator.style.width = rect.width + 'px';
  indicator.style.top = (position === 'above' ? rect.top : rect.bottom) + scrollTop + 'px';
  
  document.body.appendChild(indicator);
}

export function addNestHighlight(targetElement: HTMLElement) {
  removeNestHighlight();
  targetElement.classList.add('drag-nest-target');
}

export function removeDropIndicator() {
  const indicator = document.querySelector('.drag-drop-indicator');
  if (indicator) {
    indicator.remove();
  }
}

export function removeNestHighlight() {
  const highlighted = document.querySelector('.drag-nest-target');
  if (highlighted) {
    highlighted.classList.remove('drag-nest-target');
  }
}

function removeMultiDragBadges() {
  const badges = document.querySelectorAll('.multi-drag-badge');
  badges.forEach(badge => badge.remove());
}

export function clearAllVisualFeedback() {
  removeDropIndicator();
  removeNestHighlight();
  removeMultiDragBadges();
}