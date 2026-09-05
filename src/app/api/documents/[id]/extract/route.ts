import { NextResponse } from "next/server";
import { processDocumentExtraction } from "@/features/documents/document-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const extraction = await processDocumentExtraction(id);
    return NextResponse.json({ extraction });
  } catch (err: any) {
    console.error("GET extraction error:", err);
    return NextResponse.json({ error: "Failed to fetch document extraction" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const extraction = await processDocumentExtraction(id);
    return NextResponse.json({ extraction });
  } catch (err: any) {
    console.error("POST extraction error:", err);
    return NextResponse.json({ error: "Failed to run document extraction" }, { status: 500 });
  }
}
