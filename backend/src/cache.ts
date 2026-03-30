interface CacheEntry<TValue> {
  expiresAt: number;
  value: TValue;
}

export class MemoryCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  get(key: string): TValue | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: TValue, ttlMs: number): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }
}
