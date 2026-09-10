import { NextResponse } from "next/server";
import { getDocumentById, getDocumentSignedUrl } from "@/lib/db/supabase";
import { requireApiAuth } from "@/lib/auth/api-guard";
import { requireDocumentAccess } from "@/lib/auth/object-guard";
import { logAuditEvent } from "@/features/security/audit-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const { id } = await params;
    const docCheck = await requireDocumentAccess(auth.user, id);
    if (!docCheck.authorized) {
      return docCheck.errorResponse;
    }

    const doc = await getDocumentById(id, auth.user);
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const wantsSignedUrl = searchParams.get("signedUrl") === "true" || searchParams.get("download") === "true";

    let signedUrl: string | null = null;
    if (wantsSignedUrl && doc.storage_path) {
      signedUrl = await getDocumentSignedUrl(doc.storage_path, 300, auth.user); // 5-minute expiry
    }

    await logAuditEvent({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "READ_DOCUMENT",
      resourceType: "documents",
      resourceId: id,
      metadata: { requestedSignedUrl: wantsSignedUrl },
      actorOrToken: auth.user,
    });

    return NextResponse.json({ document: doc, signedUrl });
  } catch (err: any) {
    console.error("GET /api/documents/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}
