import { describe, it, expect, beforeEach } from "vitest";
import { offlineQueue } from "../../src/features/offline/offline-queue";

describe("Phase 16: Performance, Offline Caching & Fallback Resilience Tests", () => {
  beforeEach(() => {
    offlineQueue.clearAll();
  });

  it("enqueues case drafts safely when offline", () => {
    const item = offlineQueue.enqueue("cases", "create", {
      patient_id: "patient-offline-01",
      chief_complaint: "Acute onset headache and blurred vision",
      status: "draft",
    });

    expect(item.id).toBeDefined();
    expect(item.entity).toBe("cases");
    expect(item.syncStatus).toBe("pending");
    expect(item.retryCount).toBe(0);

    const pending = offlineQueue.getPendingItems();
    expect(pending.length).toBe(1);
    expect(pending[0].payload.chief_complaint).toBe("Acute onset headache and blurred vision");
  });

  it("successfully processes pending queue when network connectivity restores", async () => {
    offlineQueue.enqueue("patients", "create", {
      full_name: "Gopal Krishna",
      phone: "+919876543299",
    });

    offlineQueue.enqueue("cases", "create", {
      chief_complaint: "Fever and generalized myalgia",
    });

    expect(offlineQueue.getPendingItems().length).toBe(2);

    // Simulate online sync handler
    const mockSyncHandler = async () => true;
    const result = await offlineQueue.processSync(mockSyncHandler);

    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(offlineQueue.getPendingItems().length).toBe(0);

    // Clean up synced
    offlineQueue.clearSynced();
    expect(offlineQueue.getAllItems().length).toBe(0);
  });

  it("handles repeated sync failures gracefully with retry counting", async () => {
    offlineQueue.enqueue("cases", "update", {
      id: "case-01",
      notes: "Offline clinician note",
    });

    const failingHandler = async () => {
      throw new Error("503 Service Unavailable");
    };

    // First attempt
    await offlineQueue.processSync(failingHandler);
    let items = offlineQueue.getAllItems();
    expect(items[0].retryCount).toBe(1);
    expect(items[0].syncStatus).toBe("pending");
    expect(items[0].lastError).toContain("503");

    // Second attempt
    await offlineQueue.processSync(failingHandler);
    items = offlineQueue.getAllItems();
    expect(items[0].retryCount).toBe(2);

    // Third attempt triggers 'failed' status to avoid infinite blocking
    await offlineQueue.processSync(failingHandler);
    items = offlineQueue.getAllItems();
    expect(items[0].retryCount).toBe(3);
    expect(items[0].syncStatus).toBe("failed");
  });

  it("enforces idempotency and prevents duplicate items with identical idempotencyKey", () => {
    const key = "idempotency-token-12345";
    const first = offlineQueue.enqueue(
      "cases",
      "create",
      { chief_complaint: "Intermittent palpitations" },
      key
    );

    const second = offlineQueue.enqueue(
      "cases",
      "create",
      { chief_complaint: "Intermittent palpitations" },
      key
    );

    expect(first.id).toBe(second.id);
    expect(offlineQueue.getAllItems().length).toBe(1);
  });

  it("rejects unsupported entity types with clean error", () => {
    expect(() => {
      offlineQueue.enqueue("billing" as any, "create", { amount: 500 });
    }).toThrow(/UNSUPPORTED_ENTITY/i);
  });

  it("rejects update operations missing target record ID", () => {
    expect(() => {
      offlineQueue.enqueue("cases", "update", { notes: "Missing case ID" });
    }).toThrow(/INVALID_PAYLOAD/i);
  });

  it("minimizes payload for PHI-safe audit logging", () => {
    const item = offlineQueue.enqueue("patients", "create", {
      full_name: "Venkat Rao",
      phone: "+91-98765-43210",
      patient_id: "pat-999",
      address: "Private address",
    });

    const minimized = offlineQueue.minimizePayloadForAudit(item);
    expect(minimized.queueId).toBe(item.id);
    expect(minimized.entity).toBe("patients");
    expect(minimized.recordId).toBe("pat-999");
    expect(minimized.fieldCount).toBe(4);
    // Verified PHI fields are not exposed in minimized metadata
    expect(minimized.full_name).toBeUndefined();
    expect(minimized.phone).toBeUndefined();
    expect(minimized.address).toBeUndefined();
  });
});
