import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { offlineQueueItemSchema, OfflineQueueItem } from "@/features/offline/types";
import { offlineQueue } from "@/features/offline/offline-queue";
import { logAuditEvent } from "@/features/security/audit-service";
import { createCaseDraft, updateCaseDraft } from "@/features/cases/case-service";
import { registerPatient } from "@/features/patients/patient-service";
import { createDocument, updateDocument } from "@/lib/db/supabase";

// Global cache to ensure idempotency across replay attempts
const processedIdempotencyKeys = new Set<string>();

export async function POST(request: Request) {
  const auth = await requireApiAuth(request, {
    allowedRoles: ["doctor", "clinician", "staff", "admin"],
  });
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const items: OfflineQueueItem[] = body.items || [];

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload: 'items' array required." }, { status: 400 });
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const rawItem of items) {
      const parseResult = offlineQueueItemSchema.safeParse(rawItem);
      if (!parseResult.success) {
        failed.push({
          id: rawItem?.id || "unknown",
          error: `Schema validation error: ${parseResult.error.issues.map((i) => i.message).join(", ")}`,
        });
        continue;
      }

      const item = parseResult.data;

      // Idempotency check: if already processed, report success without re-executing
      if (item.idempotencyKey && processedIdempotencyKeys.has(item.idempotencyKey)) {
        succeeded.push(item.id);
        continue;
      }

      try {
        if (item.entity === "cases") {
          if (item.action === "create") {
            await createCaseDraft(item.payload as any, auth.user.id);
          } else if (item.action === "update") {
            const caseId = item.payload.id || item.payload.caseId;
            await updateCaseDraft(caseId, item.payload);
          }
        } else if (item.entity === "patients") {
          if (item.action === "create") {
            await registerPatient(item.payload as any);
          } else {
            throw new Error("Patient updates are not permitted via offline sync.");
          }
        } else if (item.entity === "documents") {
          if (item.action === "create") {
            await createDocument(item.payload as any);
          } else if (item.action === "update") {
            const docId = item.payload.id || item.payload.documentId;
            await updateDocument(docId, item.payload);
          }
        } else if (item.entity === "transcripts") {
          // Transcripts are captured within case or draft intake
        } else {
          throw new Error(`UNSUPPORTED_ENTITY: Entity type '${item.entity}' is not supported.`);
        }

        if (item.idempotencyKey) {
          processedIdempotencyKeys.add(item.idempotencyKey);
        }

        succeeded.push(item.id);

        // Audit sync operation with PHI minimized payload
        await logAuditEvent({
          actorId: auth.user.id,
          actorRole: auth.user.role,
          action: "SYNC_OFFLINE_OPERATION",
          resourceType: item.entity,
          resourceId: item.id,
          metadata: offlineQueue.minimizePayloadForAudit(item as OfflineQueueItem),
        });
      } catch (err: any) {
        failed.push({
          id: item.id,
          error: err.message || "Failed to process sync item",
        });
      }
    }

    return NextResponse.json({
      processed: items.length,
      succeeded,
      failed,
    });
  } catch (err: any) {
    console.error("POST /api/sync error:", err);
    return NextResponse.json({ error: "Failed to process offline sync" }, { status: 500 });
  }
}
