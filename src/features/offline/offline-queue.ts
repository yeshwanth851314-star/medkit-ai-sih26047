import { OfflineEntity, OfflineQueueItem, offlineQueueItemSchema } from "./types";

class OfflineQueueManager {
  private queue: OfflineQueueItem[] = [];
  private currentActorId: string = "default";

  constructor() {
    this.loadFromStorage();
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("storage", (e) => {
        if (e.key === this.getStorageKey()) {
          this.loadFromStorage();
        }
      });
    }
  }

  public setActor(actorId?: string | null): void {
    const nextActor = actorId && actorId.trim() ? actorId.trim() : "default";
    if (this.currentActorId !== nextActor) {
      this.currentActorId = nextActor;
      this.loadFromStorage();
    }
  }

  public getStorageKey(): string {
    return `medkit_offline_queue_${this.currentActorId}`;
  }

  private loadFromStorage() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(this.getStorageKey());
        if (stored) {
          this.queue = JSON.parse(stored);
        } else {
          this.queue = [];
        }
      } catch {
        this.queue = [];
      }
    }
  }

  private persist() {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(this.getStorageKey(), JSON.stringify(this.queue));
      } catch {
        // Storage might be full or restricted
      }
    }
  }

  public clearUserQueue(actorId?: string | null): void {
    const key = actorId ? `medkit_offline_queue_${actorId.trim()}` : this.getStorageKey();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
    if (!actorId || actorId === this.currentActorId) {
      this.queue = [];
    }
  }

  enqueue(
    entity: OfflineEntity,
    action: "create" | "update",
    payload: Record<string, any>,
    idempotencyKey?: string
  ): OfflineQueueItem {
    const ALLOWED_ENTITIES: OfflineEntity[] = ["cases", "patients", "transcripts", "documents"];
    if (!ALLOWED_ENTITIES.includes(entity)) {
      throw new Error(`UNSUPPORTED_ENTITY: Entity type '${entity}' is not supported for offline sync.`);
    }

    if (action === "update") {
      const targetId =
        payload.id || payload.caseId || payload.patientId || payload.case_id || payload.patient_id;
      if (!targetId) {
        throw new Error("INVALID_PAYLOAD: Update operation requires target record ID.");
      }
    }

    // Idempotency check: if an item with the same idempotencyKey already exists, update payload and return existing
    if (idempotencyKey) {
      const existing = this.queue.find((i) => i.idempotencyKey === idempotencyKey);
      if (existing) {
        existing.payload = { ...existing.payload, ...payload };
        existing.timestamp = new Date().toISOString();
        this.persist();
        return existing;
      }
    }

    // Deduplicate offline draft updates targeting the same record ID
    if (action === "update") {
      const targetId =
        payload.id || payload.caseId || payload.patientId || payload.case_id || payload.patient_id;
      const existingPending = this.queue.find(
        (i) =>
          i.syncStatus === "pending" &&
          i.entity === entity &&
          i.action === "update" &&
          (i.payload?.id === targetId ||
            i.payload?.caseId === targetId ||
            i.payload?.patientId === targetId ||
            i.payload?.case_id === targetId ||
            i.payload?.patient_id === targetId)
      );
      if (existingPending) {
        existingPending.payload = { ...existingPending.payload, ...payload };
        existingPending.timestamp = new Date().toISOString();
        this.persist();
        return existingPending;
      }
    }

    const item: OfflineQueueItem = {
      id: crypto.randomUUID(),
      idempotencyKey: idempotencyKey || crypto.randomUUID(),
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

  minimizePayloadForAudit(item: OfflineQueueItem): Record<string, any> {
    return {
      queueId: item.id,
      idempotencyKey: item.idempotencyKey,
      entity: item.entity,
      action: item.action,
      recordId:
        item.payload?.id ||
        item.payload?.caseId ||
        item.payload?.patientId ||
        item.payload?.case_id ||
        item.payload?.patient_id ||
        null,
      fieldCount: item.payload ? Object.keys(item.payload).length : 0,
      timestamp: item.timestamp,
    };
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

  markSynced(id: string): void {
    const item = this.queue.find((i) => i.id === id);
    if (item) {
      item.syncStatus = "synced";
      this.persist();
    }
  }

  markFailed(id: string, error: string): void {
    const item = this.queue.find((i) => i.id === id);
    if (item) {
      item.retryCount += 1;
      item.lastError = error;
      if (item.retryCount >= 3) {
        item.syncStatus = "failed";
      }
      this.persist();
    }
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
