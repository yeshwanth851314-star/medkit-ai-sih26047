import { z } from "zod";

export type OfflineEntity = "cases" | "patients" | "transcripts" | "documents";

export interface OfflineQueueItem {
  id: string;
  entity: OfflineEntity;
  action: "create" | "update";
  payload: Record<string, any>;
  timestamp: string;
  retryCount: number;
  syncStatus: "pending" | "synced" | "failed";
  lastError?: string | null;
}

export const offlineQueueItemSchema = z.object({
  id: z.string().uuid(),
  entity: z.enum(["cases", "patients", "transcripts", "documents"]),
  action: z.enum(["create", "update"]),
  payload: z.record(z.any()),
  timestamp: z.string(),
  retryCount: z.number().int().min(0).default(0),
  syncStatus: z.enum(["pending", "synced", "failed"]).default("pending"),
  lastError: z.string().optional().nullable(),
});
