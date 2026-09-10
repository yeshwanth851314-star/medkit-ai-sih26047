import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { offlineQueueItemSchema, OfflineQueueItem } from "@/features/offline/types";
import { offlineQueue } from "@/features/offline/offline-queue";
import { logAuditEvent } from "@/features/security/audit-service";
import { createCaseDraft, updateCaseDraft } from "@/features/cases/case-service";
import { registerPatient } from "@/features/patients/patient-service";
import {
  createDocument,
  updateDocument,
  getDocumentById,
  reserveIdempotencyKey,
  updateSyncMutationStatus,
  recordProcessedIdempotencyKey,
} from "@/lib/db/supabase";
import { requirePatientAccess, requireCaseAccess } from "@/lib/auth/object-guard";
import { MedicalDocument } from "@/types/database";

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

      // Server-side atomic idempotency check: prevents concurrent duplicate execution
      if (item.idempotencyKey) {
        const payloadHash = crypto
          .createHash("sha256")
          .update(JSON.stringify(item.payload || {}))
          .digest("hex");

        const reservation = await reserveIdempotencyKey({
          key: item.idempotencyKey,
          userId: auth.user.id,
          entity: item.entity,
          action: item.action,
          payloadHash,
          actorOrToken: auth.user,
        });

        if (!reservation.claimed) {
          if (reservation.status === "conflict") {
            failed.push({
              id: item.id,
              error: "CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH: The idempotency key was previously reserved with a different payload.",
            });
            continue;
          }
          if (reservation.status === "completed" || reservation.status === "in_progress") {
            succeeded.push(item.id);
            continue;
          }
        }
      }

      try {
        let targetResourceId = item.payload?.id || item.payload?.caseId || item.payload?.patientId;

        if (item.entity === "cases") {
          // 1. Role boundary: Staff members cannot create or update clinical cases
          if (auth.user.role === "staff") {
            throw new Error("ROLE_UNAUTHORIZED: Staff members cannot create or update clinical cases.");
          }

          if (item.action === "create") {
            const patientId = item.payload.patientId || item.payload.patient_id;
            if (!patientId) {
              throw new Error("INVALID_PAYLOAD: Case creation requires patientId.");
            }
            // Facility boundary check
            const patientCheck = await requirePatientAccess(auth.user, patientId);
            if (!patientCheck.authorized) {
              throw new Error("FACILITY_ACCESS_DENIED: Cannot create case for patient outside assigned facility.");
            }
            const created = await createCaseDraft(item.payload as any, auth.user.id, auth.user);
            targetResourceId = created?.id || targetResourceId;
          } else if (item.action === "update") {
            const caseId = item.payload.id || item.payload.caseId;
            if (!caseId) {
              throw new Error("INVALID_PAYLOAD: Update operation requires caseId.");
            }
            // Facility boundary check
            const caseCheck = await requireCaseAccess(auth.user, caseId);
            if (!caseCheck.authorized) {
              throw new Error("FACILITY_ACCESS_DENIED: Cannot update case outside assigned facility.");
            }
            await updateCaseDraft(caseId, item.payload, {
              expectedUpdatedAt: item.payload?.expectedUpdatedAt,
              actor: auth.user,
            });
            targetResourceId = caseId;
          }
        } else if (item.entity === "patients") {
          if (item.action === "create") {
            const registered = await registerPatient(item.payload as any, {
              facilityId: auth.user.facilityId || undefined,
              actor: auth.user,
            });
            targetResourceId = registered?.patient?.id || targetResourceId;
          } else {
            throw new Error("Patient updates are not permitted via offline sync.");
          }
        } else if (item.entity === "documents") {
          let patientId = item.payload.patientId || item.payload.patient_id;

          if (item.action === "update") {
            const docId = item.payload.id || item.payload.documentId;
            if (!docId) {
              throw new Error("INVALID_PAYLOAD: Update operation requires documentId.");
            }

            // Resolve target document from database to verify authentic parent patient ownership
            const existingDoc = await getDocumentById(docId, auth.user);
            if (!existingDoc) {
              throw new Error("NOT_FOUND: Target document record not found for update.");
            }

            if (patientId && patientId !== existingDoc.patient_id) {
              throw new Error("CONFLICT: Supplied patientId does not match stored document patient.");
            }
            patientId = existingDoc.patient_id;

            const patientCheck = await requirePatientAccess(auth.user, patientId);
            if (!patientCheck.authorized) {
              throw new Error("FACILITY_ACCESS_DENIED: Cannot mutate document for patient outside assigned facility.");
            }

            // Allowlist fields for document update
            const allowedUpdates: Partial<MedicalDocument> = {};
            if (item.payload.extracted_data !== undefined) allowedUpdates.extracted_data = item.payload.extracted_data;
            if (item.payload.extractedData !== undefined) allowedUpdates.extracted_data = item.payload.extractedData;
            if (item.payload.processing_status !== undefined) allowedUpdates.processing_status = item.payload.processing_status;
            if (item.payload.processingStatus !== undefined) allowedUpdates.processing_status = item.payload.processingStatus;
            if (item.payload.ocr_confidence !== undefined) allowedUpdates.ocr_confidence = item.payload.ocr_confidence;
            if (item.payload.ocrConfidence !== undefined) allowedUpdates.ocr_confidence = item.payload.ocrConfidence;

            await updateDocument(docId, allowedUpdates, auth.user);
            targetResourceId = docId;
          } else if (item.action === "create") {
            if (!patientId) {
              throw new Error("INVALID_PAYLOAD: Document creation requires patientId.");
            }
            const patientCheck = await requirePatientAccess(auth.user, patientId);
            if (!patientCheck.authorized) {
              throw new Error("FACILITY_ACCESS_DENIED: Cannot mutate document for patient outside assigned facility.");
            }
            const doc = await createDocument(item.payload as any, auth.user);
            targetResourceId = doc?.id || targetResourceId;
          }
        } else if (item.entity === "transcripts") {
          throw new Error("UNSUPPORTED_ENTITY: Standalone transcripts are not supported for offline sync. Transcripts must be submitted within case drafts.");
        } else {
          throw new Error(`UNSUPPORTED_ENTITY: Entity type '${item.entity}' is not supported for offline sync.`);
        }

        if (item.idempotencyKey) {
          await updateSyncMutationStatus({
            key: item.idempotencyKey,
            status: "completed",
            resourceId: targetResourceId,
            actorOrToken: auth.user,
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
          actorOrToken: auth.user,
        });
      } catch (err: any) {
        if (item.idempotencyKey) {
          await updateSyncMutationStatus({
            key: item.idempotencyKey,
            status: "failed",
            resourceId: item.payload?.id || item.payload?.caseId,
            errorMessage: err.message,
            actorOrToken: auth.user,
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
