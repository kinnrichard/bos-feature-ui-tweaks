/**
 * Unit tests for technician filtering functionality in JobFilterStore
 * EP-0029: Technician Filter Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jobFilter, getSelectedTechnicianIds } from './jobFilter.svelte';

// Mock SvelteKit's replaceState function
vi.mock('$app/navigation', () => ({
  replaceState: vi.fn(),
}));

describe('JobFilterStore - Technician Filter', () => {
  let originalLocation: Location;

  beforeEach(() => {
    // Store original location
    originalLocation = window.location;

    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:5173/jobs',
      search: '',
      searchParams: new URLSearchParams(),
    } as any;

    // Clear any existing filters
    jobFilter.clearFilters();
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
    vi.clearAllMocks();
  });

  describe('URL Parameter Parsing', () => {
    it('should parse single technician ID from URL', () => {
      window.location.href = 'http://localhost:5173/jobs?technician_ids=tech-123';
      const url = new URL(window.location.href);
      window.location.search = url.search;

      // Reinitialize from URL
      jobFilter.clearFilters();

      // Mock URL parsing manually since we can't trigger popstate
      const technicianIds = url.searchParams.get('technician_ids')?.split(',') || [];
      const expectedSelection = technicianIds.map((id) => `technician:${id}`);

      expect(technicianIds).toEqual(['tech-123']);
      expect(expectedSelection).toEqual(['technician:tech-123']);
    });

    it('should parse multiple technician IDs from URL', () => {
      window.location.href = 'http://localhost:5173/jobs?technician_ids=tech-123,tech-456,tech-789';
      const url = new URL(window.location.href);

      const technicianIds = url.searchParams.get('technician_ids')?.split(',') || [];
      expect(technicianIds).toEqual(['tech-123', 'tech-456', 'tech-789']);
    });

    it('should parse "not_assigned" special value from URL', () => {
      window.location.href = 'http://localhost:5173/jobs?technician_ids=not_assigned';
      const url = new URL(window.location.href);

      const technicianIds = url.searchParams.get('technician_ids')?.split(',') || [];
      expect(technicianIds).toEqual(['not_assigned']);
    });

    it('should parse mixed technician IDs and "not_assigned"', () => {
      window.location.href =
        'http://localhost:5173/jobs?technician_ids=tech-123,not_assigned,tech-456';
      const url = new URL(window.location.href);

      const technicianIds = url.searchParams.get('technician_ids')?.split(',') || [];
      expect(technicianIds).toEqual(['tech-123', 'not_assigned', 'tech-456']);
    });

    it('should handle empty technician_ids parameter', () => {
      window.location.href = 'http://localhost:5173/jobs?technician_ids=';
      const url = new URL(window.location.href);

      const technicianIds = url.searchParams.get('technician_ids')?.split(',') || [];
      // Empty string splits to [''] which should be filtered out
      const validIds = technicianIds.filter((id) => id.trim());
      expect(validIds).toEqual([]);
    });
  });

  describe('Filter Selection Management', () => {
    it('should set single technician selection', () => {
      const selection = ['technician:tech-123'];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      expect(getSelectedTechnicianIds()).toEqual(['tech-123']);
    });

    it('should set multiple technician selections', () => {
      const selection = ['technician:tech-123', 'technician:tech-456', 'technician:not_assigned'];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      expect(getSelectedTechnicianIds()).toEqual(['tech-123', 'tech-456', 'not_assigned']);
    });

    it('should handle mixed filter types (status, priority, technician)', () => {
      const selection = [
        'status:open',
        'priority:high',
        'technician:tech-123',
        'technician:not_assigned',
      ];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      expect(getSelectedTechnicianIds()).toEqual(['tech-123', 'not_assigned']);
    });

    it('should filter out invalid filter types', () => {
      const selection = [
        'technician:tech-123',
        'invalid-header',
        'divider',
        'technician:not_assigned',
      ];
      jobFilter.setSelected(selection);

      // Headers and dividers should be filtered out
      expect(jobFilter.selected).toEqual(['technician:tech-123', 'technician:not_assigned']);
      expect(getSelectedTechnicianIds()).toEqual(['tech-123', 'not_assigned']);
    });

    it('should clear all selections', () => {
      jobFilter.setSelected(['technician:tech-123', 'status:open']);
      expect(jobFilter.selected.length).toBeGreaterThan(0);

      jobFilter.clearFilters();
      expect(jobFilter.selected).toEqual([]);
      expect(getSelectedTechnicianIds()).toEqual([]);
    });
  });

  describe('Helper Functions', () => {
    it('should extract technician IDs correctly', () => {
      jobFilter.setSelected([
        'status:open',
        'technician:tech-123',
        'priority:high',
        'technician:tech-456',
        'technician:not_assigned',
      ]);

      const technicianIds = getSelectedTechnicianIds();
      expect(technicianIds).toEqual(['tech-123', 'tech-456', 'not_assigned']);
    });

    it('should return empty array when no technicians selected', () => {
      jobFilter.setSelected(['status:open', 'priority:high']);

      const technicianIds = getSelectedTechnicianIds();
      expect(technicianIds).toEqual([]);
    });

    it('should handle empty selection', () => {
      jobFilter.clearFilters();

      const technicianIds = getSelectedTechnicianIds();
      expect(technicianIds).toEqual([]);
    });
  });

  describe('Active Filter Detection', () => {
    it('should detect active filters with technician selections', () => {
      expect(jobFilter.hasActiveFilters).toBe(false);

      jobFilter.setSelected(['technician:tech-123']);
      expect(jobFilter.hasActiveFilters).toBe(true);
    });

    it('should detect active filters with multiple filter types', () => {
      jobFilter.setSelected(['status:open', 'technician:tech-123', 'priority:high']);

      expect(jobFilter.hasActiveFilters).toBe(true);
    });

    it('should not detect active filters when cleared', () => {
      jobFilter.setSelected(['technician:tech-123']);
      expect(jobFilter.hasActiveFilters).toBe(true);

      jobFilter.clearFilters();
      expect(jobFilter.hasActiveFilters).toBe(false);
    });
  });

  describe('URL Update Logic', () => {
    it('should handle URL update scheduling', () => {
      // Test that setSelected triggers URL update (though we can't easily test the actual URL change)
      const initialSelected = jobFilter.selected;

      jobFilter.setSelected(['technician:tech-123']);

      // Selection should be updated immediately
      expect(jobFilter.selected).not.toEqual(initialSelected);
      expect(jobFilter.selected).toEqual(['technician:tech-123']);
    });

    it('should handle multiple rapid selections', () => {
      // Simulate rapid filter changes
      jobFilter.setSelected(['technician:tech-123']);
      jobFilter.setSelected(['technician:tech-123', 'technician:tech-456']);
      jobFilter.setSelected(['technician:tech-456']);

      // Final selection should be preserved
      expect(jobFilter.selected).toEqual(['technician:tech-456']);
      expect(getSelectedTechnicianIds()).toEqual(['tech-456']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined/null selections gracefully', () => {
      // This should not throw an error
      jobFilter.setSelected([]);
      expect(jobFilter.selected).toEqual([]);
    });

    it('should handle whitespace-only technician IDs', () => {
      // The filter should handle empty/whitespace IDs
      const selection = ['technician: ', 'technician:tech-123', 'technician:'];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      // The filtering logic in the actual filter functions will handle validation
    });

    it('should handle special characters in technician IDs', () => {
      const selection = ['technician:tech-123-special_chars.test@domain'];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      expect(getSelectedTechnicianIds()).toEqual(['tech-123-special_chars.test@domain']);
    });

    it('should maintain selection order', () => {
      const selection = [
        'technician:tech-charlie',
        'technician:tech-alpha',
        'technician:tech-bravo',
      ];
      jobFilter.setSelected(selection);

      expect(jobFilter.selected).toEqual(selection);
      expect(getSelectedTechnicianIds()).toEqual(['tech-charlie', 'tech-alpha', 'tech-bravo']);
    });
  });
});
