import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { offlineQueueItemSchema, OfflineQueueItem } from "@/features/offline/types";
import { offlineQueue } from "@/features/offline/offline-queue";
import { logAuditEvent } from "@/features/security/audit-service";
import { createCaseDraft, updateCaseDraft } from "@/features/cases/case-service";
import { registerPatient } from "@/features/patients/patient-service";
import { createDocument, updateDocument, isIdempotencyKeyProcessed, recordProcessedIdempotencyKey } from "@/lib/db/supabase";

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

      // Server-side persistent idempotency check: survives process restarts and cold starts
      if (item.idempotencyKey) {
        const alreadyDone = await isIdempotencyKeyProcessed(item.idempotencyKey);
        if (alreadyDone) {
          succeeded.push(item.id);
          continue;
        }
      }

      try {
        let targetResourceId = item.payload?.id || item.payload?.caseId || item.payload?.patientId;

        if (item.entity === "cases") {
          if (item.action === "create") {
            const created = await createCaseDraft(item.payload as any, auth.user.id);
            targetResourceId = created?.id || targetResourceId;
          } else if (item.action === "update") {
            const caseId = item.payload.id || item.payload.caseId;
            if (!caseId) {
              throw new Error("INVALID_PAYLOAD: Update operation requires caseId.");
            }
            await updateCaseDraft(caseId, item.payload);
            targetResourceId = caseId;
          }
        } else if (item.entity === "patients") {
          if (item.action === "create") {
            const registered = await registerPatient(item.payload as any);
            targetResourceId = registered?.patient?.id || targetResourceId;
          } else {
            throw new Error("Patient updates are not permitted via offline sync.");
          }
        } else if (item.entity === "documents") {
          if (item.action === "create") {
            const doc = await createDocument(item.payload as any);
            targetResourceId = doc?.id || targetResourceId;
          } else if (item.action === "update") {
            const docId = item.payload.id || item.payload.documentId;
            if (!docId) {
              throw new Error("INVALID_PAYLOAD: Update operation requires documentId.");
            }
            await updateDocument(docId, item.payload);
            targetResourceId = docId;
          }
        } else if (item.entity === "transcripts") {
          // Transcripts are captured within case or draft intake
        } else {
          throw new Error(`UNSUPPORTED_ENTITY: Entity type '${item.entity}' is not supported for offline sync.`);
        }

        if (item.idempotencyKey) {
          await recordProcessedIdempotencyKey({
            key: item.idempotencyKey,
            userId: auth.user.id,
            entity: item.entity,
            action: item.action,
            resourceId: targetResourceId,
            status: "completed",
          });
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
        if (item.idempotencyKey) {
          await recordProcessedIdempotencyKey({
            key: item.idempotencyKey,
            userId: auth.user.id,
            entity: item.entity,
            action: item.action,
            resourceId: item.payload?.id || item.payload?.caseId,
            status: "failed",
            errorMessage: err.message,
          });
        }

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
