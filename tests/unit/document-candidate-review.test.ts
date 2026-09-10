import { describe, it, expect, beforeEach } from "vitest";
import {
  processDocumentExtraction,
  reviewExtractionCandidate,
  confirmExtractionMedication,
  SYNTHETIC_DOCUMENT_FIXTURES,
} from "../../src/features/documents/document-service";

describe("Stage 1: Durable Candidate-Level Document Extraction Review", () => {
  beforeEach(() => {
    // Reset synthetic fixtures to clean candidate state
    if (SYNTHETIC_DOCUMENT_FIXTURES["doc-0001"]) {
      SYNTHETIC_DOCUMENT_FIXTURES["doc-0001"].status = "extracted";
      SYNTHETIC_DOCUMENT_FIXTURES["doc-0001"].extractedData.medications = [
        {
          id: "cand-med-01",
          name: "Levocetirizine 5mg",
          dosage: "1 tablet once daily at bedtime",
          duration: "10 days",
          pageRef: 1,
          confidence: 0.98,
          status: "candidate",
        },
        {
          id: "cand-med-02",
          name: "Paracetamol 650mg",
          dosage: "1 tablet SOS for fever",
          duration: "3 days",
          pageRef: 1,
          confidence: 0.94,
          status: "candidate",
        },
      ];
    }
  });

  it("extracts candidates with stable candidate IDs and explicit candidate status", async () => {
    const extraction = await processDocumentExtraction("doc-0001");
    expect(extraction).toBeDefined();
    const meds = extraction.extractedData.medications;
    expect(meds.length).toBe(2);
    expect(meds[0].id).toBe("cand-med-01");
    expect(meds[0].status).toBe("candidate");
    expect(meds[1].id).toBe("cand-med-02");
    expect(meds[1].status).toBe("candidate");
  });

  it("accepts candidate medication using stable candidateId and records verifier audit timestamp", async () => {
    const updated = await reviewExtractionCandidate("doc-0001", {
      candidateId: "cand-med-01",
      candidateType: "medication",
      action: "accept",
      verifierId: "usr-doc-0001",
    });

    const targetMed = updated.extractedData.medications.find(
      (m: any) => m.id === "cand-med-01"
    );
    expect(targetMed).toBeDefined();
    expect(targetMed.status).toBe("verified");
    expect(targetMed.verified_by).toBe("usr-doc-0001");
    expect(targetMed.verified_at).toBeDefined();

    const remainingMed = updated.extractedData.medications.find(
      (m: any) => m.id === "cand-med-02"
    );
    expect(remainingMed.status).toBe("candidate");
    expect(updated.status).toBe("review");
  });

  it("edits candidate dosage and marks as verified with audit record", async () => {
    const updated = await reviewExtractionCandidate("doc-0001", {
      candidateId: "cand-med-02",
      candidateType: "medication",
      action: "edit",
      updatedValue: "650mg TDS after food",
      verifierId: "usr-doc-0001",
    });

    const targetMed = updated.extractedData.medications.find(
      (m: any) => m.id === "cand-med-02"
    );
    expect(targetMed.dosage).toBe("650mg TDS after food");
    expect(targetMed.status).toBe("verified");
    expect(targetMed.verified_by).toBe("usr-doc-0001");
  });

  it("rejects candidate medication and records rejection audit", async () => {
    const updated = await reviewExtractionCandidate("doc-0001", {
      candidateId: "cand-med-02",
      candidateType: "medication",
      action: "reject",
      verifierId: "usr-doc-0001",
    });

    const targetMed = updated.extractedData.medications.find(
      (m: any) => m.id === "cand-med-02"
    );
    expect(targetMed.status).toBe("rejected");
    expect(targetMed.rejected_by).toBe("usr-doc-0001");
    expect(targetMed.rejected_at).toBeDefined();
  });

  it("verifies and confirms lab tests candidates by candidateId", async () => {
    const updated = await reviewExtractionCandidate("doc-0002", {
      candidateId: "cand-test-01",
      candidateType: "test",
      action: "accept",
      verifierId: "usr-doc-0001",
    });

    const targetTest = updated.extractedData.tests.find(
      (t: any) => t.id === "cand-test-01"
    );
    expect(targetTest).toBeDefined();
    expect(targetTest.status).toBe("verified");
    expect(targetTest.verified_by).toBe("usr-doc-0001");
  });

  it("fails closed when reviewing a candidate identifier not present in document", async () => {
    await expect(
      reviewExtractionCandidate("doc-0001", {
        candidateId: "nonexistent-cand-999",
        action: "accept",
      })
    ).rejects.toThrow(/is not an extraction candidate/);
  });

  it("retains confirmed status for legacy single-medication verification compatibility", async () => {
    const confirmed = await confirmExtractionMedication("doc-0001", "Levocetirizine 5mg");
    expect(confirmed.status).toBe("confirmed");
    const med = confirmed.extractedData.medications.find(
      (m: any) => m.name === "Levocetirizine 5mg"
    );
    expect(med?.status).toBe("verified");
  });
});
