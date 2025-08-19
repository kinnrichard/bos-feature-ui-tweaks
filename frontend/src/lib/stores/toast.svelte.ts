/**
 * Global toast notification store
 * Manages display of toast messages for rate limiting, errors, success, etc.
 */

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

class ToastStore {
  private toasts = $state<Toast[]>([]);
  
  get currentToast() {
    return this.toasts[0];
  }
  
  show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type, duration };
    
    this.toasts = [...this.toasts, toast];
    
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
  
  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
  
  error(message: string, duration = 5000) {
    this.show(message, 'error', duration);
  }
  
  success(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }
  
  warning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  }
  
  info(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }
}

export const toastStore = new ToastStore();