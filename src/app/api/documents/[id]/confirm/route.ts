import { NextResponse } from "next/server";
import { confirmExtractionMedication } from "@/features/documents/document-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { medicationName } = body;

    if (!medicationName) {
      return NextResponse.json({ error: "medicationName is required" }, { status: 400 });
    }

    const updated = await confirmExtractionMedication(id, medicationName);
    return NextResponse.json({ success: true, extraction: updated });
  } catch (err: any) {
    console.error("POST confirm error:", err);
    return NextResponse.json({ error: "Failed to confirm extraction field" }, { status: 500 });
  }
}
