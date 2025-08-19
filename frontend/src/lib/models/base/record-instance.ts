/**
 * RecordInstance base class for legacy compatibility
 * This is a temporary bridge to support generated Zero.js files
 * until they can be updated to use Epic-008 patterns
 */

export interface ZeroMutations<T> {
  update: (id: string, data: Partial<T>) => Promise<{ id: string }>;
  delete: (id: string) => Promise<{ id: string }>;
  undiscard?: (id: string) => Promise<{ id: string }>;
}

/**
 * Legacy RecordInstance class for backward compatibility
 * @deprecated Use Epic-008 ActiveRecord/ReactiveRecord patterns instead
 */
export abstract class RecordInstance<T extends { id: string }> {
  protected abstract mutations: ZeroMutations<T>;

  constructor(public data: T) {}

  /**
   * Update this record
   */
  async update(updates: Partial<T>): Promise<{ id: string }> {
    const result = await this.mutations.update(this.data.id, updates);
    return result;
  }

  /**
   * Delete (discard) this record
   */
  async delete(): Promise<{ id: string }> {
    return await this.mutations.delete(this.data.id);
  }

  /**
   * Soft delete this record
   */
  async discard(): Promise<boolean> {
    try {
      await this.mutations.delete(this.data.id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restore this record from soft deletion
   */
  async restore(): Promise<{ id: string }> {
    if (this.mutations.undiscard) {
      return await this.mutations.undiscard(this.data.id);
    }
    throw new Error('Undiscard not supported for this record type');
  }

  /**
   * Get the record ID
   */
  get id(): string {
    return this.data.id;
  }
}

// ZeroMutations type is already exported at line 7 above