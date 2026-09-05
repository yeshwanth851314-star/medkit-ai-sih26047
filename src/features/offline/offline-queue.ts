import { OfflineEntity, OfflineQueueItem, offlineQueueItemSchema } from "./types";

class OfflineQueueManager {
  private queue: OfflineQueueItem[] = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem("medkit_offline_queue");
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      } catch {
        // Fallback to in-memory queue
      }
    }
  }

  private persist() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("medkit_offline_queue", JSON.stringify(this.queue));
      } catch {
        // Storage might be full or restricted
      }
    }
  }

  enqueue(
    entity: OfflineEntity,
    action: "create" | "update",
    payload: Record<string, any>
  ): OfflineQueueItem {
    const item: OfflineQueueItem = {
      id: crypto.randomUUID(),
      entity,
      action,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      syncStatus: "pending",
      lastError: null,
    };

    const validated = offlineQueueItemSchema.parse(item);
    this.queue.push(validated as OfflineQueueItem);
    this.persist();
    return validated as OfflineQueueItem;
  }

  getPendingItems(): OfflineQueueItem[] {
    return this.queue.filter((i) => i.syncStatus === "pending");
  }

  getAllItems(): OfflineQueueItem[] {
    return [...this.queue];
  }

  async processSync(
    syncHandler: (item: OfflineQueueItem) => Promise<boolean>
  ): Promise<{ syncedCount: number; failedCount: number }> {
    let syncedCount = 0;
    let failedCount = 0;

    for (const item of this.queue) {
      if (item.syncStatus === "pending") {
        try {
          const success = await syncHandler(item);
          if (success) {
            item.syncStatus = "synced";
            syncedCount++;
          } else {
            item.retryCount += 1;
            if (item.retryCount >= 3) {
              item.syncStatus = "failed";
            }
            failedCount++;
          }
        } catch (err: any) {
          item.retryCount += 1;
          item.lastError = err?.message || "Sync network failure";
          if (item.retryCount >= 3) {
            item.syncStatus = "failed";
          }
          failedCount++;
        }
      }
    }

    this.persist();
    return { syncedCount, failedCount };
  }

  clearSynced(): void {
    this.queue = this.queue.filter((i) => i.syncStatus !== "synced");
    this.persist();
  }

  clearAll(): void {
    this.queue = [];
    this.persist();
  }
}

export const offlineQueue = new OfflineQueueManager();
