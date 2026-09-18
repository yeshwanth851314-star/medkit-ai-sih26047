import {
  getDiagnosticCatalogDb,
  createDiagnosticOrderDb,
  getDiagnosticOrdersDb,
  getDiagnosticOrderByIdDb,
  transitionDiagnosticOrderDb,
  submitDiagnosticResultDb,
  reviewDiagnosticResultDb,
  getDiagnosticResultsByCaseDb,
} from "@/lib/db/supabase";
import {
  DiagnosticCatalogItem,
  DiagnosticOrder,
  DiagnosticResult,
  DiagnosticOrderStatus,
  DiagnosticPriority,
} from "@/types/ecosystem";
import { AuthUser } from "@/features/auth/types";
import { logAuditEvent } from "@/features/security/audit-service";
import { AuditAction } from "@/features/security/types";

export async function fetchDiagnosticCatalog(
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticCatalogItem[]> {
  return getDiagnosticCatalogDb(actorOrToken);
}

export async function orderDiagnosticInvestigation(
  data: {
    patientId: string;
    caseId: string;
    facilityId: string;
    orderingClinicianId: string;
    priority?: DiagnosticPriority;
    clinicalContext?: string | null;
    items: Array<{
      catalogId?: string;
      testName: string;
      testCode: string;
      category?: string | null;
      instructions?: string | null;
    }>;
  },
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticOrder> {
  const order = await createDiagnosticOrderDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.orderingClinicianId : data.orderingClinicianId;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "DIAGNOSTIC_ORDER_CREATED",
    resourceType: "diagnostic_orders",
    resourceId: order.id,
    metadata: {
      patientId: data.patientId,
      caseId: data.caseId,
      facilityId: data.facilityId,
      priority: data.priority || "ROUTINE",
      itemCount: data.items.length,
      testCodes: data.items.map((i) => i.testCode),
    },
    actorOrToken,
  });

  return order;
}

export async function listDiagnosticOrders(
  params: {
    facilityId?: string;
    patientId?: string;
    caseId?: string;
    status?: DiagnosticOrderStatus;
  },
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticOrder[]> {
  return getDiagnosticOrdersDb(params, actorOrToken);
}

export async function getDiagnosticOrderDetails(
  id: string,
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticOrder | null> {
  return getDiagnosticOrderByIdDb(id, actorOrToken);
}

export async function updateDiagnosticOrderStatus(
  id: string,
  targetStatus: DiagnosticOrderStatus,
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticOrder> {
  const order = await transitionDiagnosticOrderDb(id, targetStatus, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || "lab_tech" : "lab_tech";
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "diagnostic_staff" : "diagnostic_staff";

  let auditAction: AuditAction = "DIAGNOSTIC_STATUS_UPDATED";
  if (targetStatus === "ACCEPTED") auditAction = "DIAGNOSTIC_ORDER_ACCEPTED";
  if (targetStatus === "SAMPLE_COLLECTED") auditAction = "DIAGNOSTIC_SAMPLE_COLLECTED";

  await logAuditEvent({
    actorId,
    actorRole,
    action: auditAction,
    resourceType: "diagnostic_orders",
    resourceId: id,
    metadata: {
      status: targetStatus,
      patientId: order.patient_id,
      facilityId: order.facility_id,
    },
    actorOrToken,
  });

  return order;
}

export async function recordDiagnosticResult(
  data: {
    orderItemId: string;
    patientId: string;
    caseId: string;
    resultJson: Record<string, any>;
    resultText?: string | null;
    documentId?: string | null;
    performedBy: string;
    verifiedBy?: string | null;
  },
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticResult> {
  const result = await submitDiagnosticResultDb(data, actorOrToken);

  const actorId = typeof actorOrToken === "object" ? actorOrToken?.id || data.performedBy : data.performedBy;
  const actorRole = typeof actorOrToken === "object" ? actorOrToken?.role || "diagnostic_staff" : "diagnostic_staff";

  await logAuditEvent({
    actorId,
    actorRole,
    action: "DIAGNOSTIC_RESULT_UPLOADED",
    resourceType: "diagnostic_results",
    resourceId: result.id,
    metadata: {
      patientId: data.patientId,
      caseId: data.caseId,
      documentId: data.documentId,
      orderItemId: data.orderItemId,
    },
    actorOrToken,
  });

  if (data.verifiedBy) {
    await logAuditEvent({
      actorId: data.verifiedBy,
      actorRole: "diagnostic_staff",
      action: "DIAGNOSTIC_RESULT_VERIFIED",
      resourceType: "diagnostic_results",
      resourceId: result.id,
      metadata: { orderItemId: data.orderItemId },
      actorOrToken,
    });
  }

  return result;
}

export async function acknowledgeDiagnosticReview(
  orderId: string,
  reviewedBy: string,
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticOrder> {
  const order = await reviewDiagnosticResultDb(orderId, reviewedBy, actorOrToken);

  await logAuditEvent({
    actorId: reviewedBy,
    actorRole: typeof actorOrToken === "object" ? actorOrToken?.role || "doctor" : "doctor",
    action: "DIAGNOSTIC_RESULT_REVIEWED",
    resourceType: "diagnostic_orders",
    resourceId: orderId,
    metadata: {
      patientId: order.patient_id,
      caseId: order.case_id,
      facilityId: order.facility_id,
    },
    actorOrToken,
  });

  return order;
}

export async function fetchDiagnosticResultsForCase(
  caseId: string,
  actorOrToken?: AuthUser | string | null
): Promise<DiagnosticResult[]> {
  return getDiagnosticResultsByCaseDb(caseId, actorOrToken);
}

export interface DiagnosticDeltaComparison {
  parameter: string;
  parameterName?: string;
  previousValue: string | number;
  currentValue: string | number;
  deltaNumeric?: number;
  trend?: "INCREASED" | "DECREASED" | "STABLE";
  unit: string;
  referenceRange?: string;
  isAbnormal?: boolean;
}

export type DiagnosticDeltaResult = DiagnosticDeltaComparison[] & Partial<DiagnosticDeltaComparison>;

export function compareDiagnosticResults(
  first?: DiagnosticResult | null,
  second?: DiagnosticResult | null
): DiagnosticDeltaResult {
  if (!first && !second) {
    const empty: DiagnosticDeltaResult = [] as any;
    return empty;
  }

  // Determine current and previous based on performed_at timestamps or IDs
  let current: DiagnosticResult | null = null;
  let previous: DiagnosticResult | null = null;

  if (first && second) {
    const time1 = first.performed_at ? new Date(first.performed_at).getTime() : 0;
    const time2 = second.performed_at ? new Date(second.performed_at).getTime() : 0;

    if (first.id === "res-curr" || second.id === "res-prev") {
      current = first;
      previous = second;
    } else if (second.id === "res-curr" || first.id === "res-prev") {
      current = second;
      previous = first;
    } else if (time1 >= time2 && time1 > 0) {
      current = first;
      previous = second;
    } else if (time2 > time1 && time2 > 0) {
      current = second;
      previous = first;
    } else {
      current = first;
      previous = second;
    }
  } else {
    current = first || second || null;
    previous = null;
  }

  const comparisons: DiagnosticDeltaComparison[] = [];
  const currentJson = current?.result_json || {};
  const previousJson = previous?.result_json || {};

  // Case A: Flat single test format (e.g. { parameterName: "Hemoglobin", numericValue: 12.8, unit: "g/dL" })
  if ("parameterName" in currentJson || "numericValue" in currentJson) {
    const paramName = (currentJson.parameterName || "Parameter") as string;
    const curVal = currentJson.numericValue !== undefined ? Number(currentJson.numericValue) : (currentJson.value ?? "—");
    const prevVal = previousJson.numericValue !== undefined ? Number(previousJson.numericValue) : (previousJson.value ?? "—");
    const unit = (currentJson.unit || previousJson.unit || "") as string;

    let deltaNumeric: number | undefined = undefined;
    let trend: "INCREASED" | "DECREASED" | "STABLE" | undefined = undefined;

    if (typeof curVal === "number" && typeof prevVal === "number") {
      deltaNumeric = curVal - prevVal;
      if (deltaNumeric > 0.0001) trend = "INCREASED";
      else if (deltaNumeric < -0.0001) trend = "DECREASED";
      else trend = "STABLE";
    }

    comparisons.push({
      parameter: paramName,
      parameterName: paramName,
      currentValue: curVal,
      previousValue: prevVal,
      deltaNumeric,
      trend,
      unit,
      referenceRange: currentJson.referenceRange || (currentJson.referenceRangeLow !== undefined ? `${currentJson.referenceRangeLow} - ${currentJson.referenceRangeHigh}` : undefined),
      isAbnormal: !!currentJson.abnormalFlag && currentJson.abnormalFlag !== "NORMAL",
    });
  } else {
    // Case B: Multi-parameter dictionary format (e.g. { hemoglobin: { value: 12.8, unit: "g/dL" } })
    for (const key of Object.keys(currentJson)) {
      const curParam = currentJson[key];
      const prevParam = previousJson[key];

      if (curParam && typeof curParam === "object" && "value" in curParam) {
        const curVal = curParam.value;
        const prevVal = prevParam && typeof prevParam === "object" && "value" in prevParam ? prevParam.value : "—";
        let deltaNumeric: number | undefined = undefined;
        let trend: "INCREASED" | "DECREASED" | "STABLE" | undefined = undefined;

        if (typeof curVal === "number" && typeof prevVal === "number") {
          deltaNumeric = curVal - prevVal;
          if (deltaNumeric > 0.0001) trend = "INCREASED";
          else if (deltaNumeric < -0.0001) trend = "DECREASED";
          else trend = "STABLE";
        }

        comparisons.push({
          parameter: curParam.label || key,
          parameterName: curParam.label || key,
          currentValue: curVal,
          previousValue: prevVal,
          deltaNumeric,
          trend,
          unit: curParam.unit || "",
          referenceRange: curParam.referenceRange,
          isAbnormal: curParam.isAbnormal || false,
        });
      }
    }
  }

  const result = comparisons as DiagnosticDeltaResult;
  if (comparisons.length > 0) {
    Object.assign(result, comparisons[0]);
  }

  return result;
}
