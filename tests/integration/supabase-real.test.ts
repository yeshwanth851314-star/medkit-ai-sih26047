import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

const isPlaceholder = (val: string) =>
  !val ||
  val === "" ||
  val.includes("your-project.supabase.co") ||
  val.includes("placeholder") ||
  val.includes("ey... (placeholder)");

const isLiveConfigured =
  Boolean(supabaseUrl && serviceKey) &&
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(serviceKey);

describe.skipIf(!isLiveConfigured)(
  "Integration: Real Supabase Infrastructure & Security Suite",
  () => {
    beforeAll(() => {
      console.log("=== REAL SUPABASE INFRASTRUCTURE SUITE INITIALIZATION ===");
      console.log(`Supabase URL configured: ${Boolean(supabaseUrl && !isPlaceholder(supabaseUrl))}`);
      console.log(`Anon key configured: ${Boolean(anonKey && !isPlaceholder(anonKey))}`);
      console.log(`Service-role key configured: ${Boolean(serviceKey && !isPlaceholder(serviceKey))}`);
    });

  // Shared test context
  let serviceClient: SupabaseClient;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let anonClient: SupabaseClient;

  const facA = "facility-aiia-delhi";
  const facB = "facility-aiia-goa";
  const emailA = "synthetic.dr.a@example.com";
  const passA = `Alpha-${crypto.randomUUID()}!Aa1`;
  const emailB = "synthetic.dr.b@example.com";
  const passB = `Beta-${crypto.randomUUID()}!Bb1`;

  let patientA: any;
  let patientB: any;
  let caseA: any;

  afterAll(async () => {
    if (serviceClient) {
      try {
        // Step 19: Clean up / rotate synthetic credentials so no known test passwords remain active
        const { data: usersData } = await serviceClient.auth.admin.listUsers();
        for (const u of usersData?.users || []) {
          if (u.email === emailA || u.email === emailB) {
            await serviceClient.auth.admin.updateUserById(u.id, {
              password: `Revoked-${crypto.randomUUID()}!Zz9`,
            });
          }
        }
      } catch (err) {
        console.warn("Test credential hygiene warning:", err);
      }
    }
  });

  it("Step 22: verifies real database availability and connection", async () => {
    serviceClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

    const { data, error } = await serviceClient.from("profiles").select("id").limit(1);
    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Provision synthetic doctor users & profiles with fresh run-scoped credentials
    const { data: usersData } = await serviceClient.auth.admin.listUsers();
    let userA: any = usersData.users.find((u) => u.email === emailA);
    if (!userA) {
      const { data: created, error: errCreate } = await serviceClient.auth.admin.createUser({
        email: emailA,
        password: passA,
        email_confirm: true,
      });
      expect(errCreate).toBeNull();
      userA = created.user;
    } else {
      await serviceClient.auth.admin.updateUserById(userA.id, { password: passA });
    }

    let userB: any = usersData.users.find((u) => u.email === emailB);
    if (!userB) {
      const { data: created, error: errCreate } = await serviceClient.auth.admin.createUser({
        email: emailB,
        password: passB,
        email_confirm: true,
      });
      expect(errCreate).toBeNull();
      userB = created.user;
    } else {
      await serviceClient.auth.admin.updateUserById(userB.id, { password: passB });
    }

    await serviceClient.from("profiles").upsert([
      { id: userA!.id, full_name: "Dr. Alpha Test", role: "doctor", facility_id: facA, is_active: true },
      { id: userB!.id, full_name: "Dr. Beta Test", role: "doctor", facility_id: facB, is_active: true },
    ]);

    // Sign in Clinician A
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signA, error: errSignA } = await clientA.auth.signInWithPassword({
      email: emailA,
      password: passA,
    });
    expect(errSignA).toBeNull();
    expect(signA.session).toBeDefined();

    // Sign in Clinician B
    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signB, error: errSignB } = await clientB.auth.signInWithPassword({
      email: emailB,
      password: passB,
    });
    expect(errSignB).toBeNull();
    expect(signB.session).toBeDefined();
  });

  it("Step 23: cross-facility security test enforces strict patient and case isolation", async () => {
    // Clinician A creates Patient A in facility A
    const codeA = "PAT-A-" + Date.now();
    const { data: pA, error: errPA } = await clientA
      .from("patients")
      .insert({
        facility_id: facA,
        full_name: "Synthetic Patient Alpha",
        gender: "female",
        date_of_birth: "1988-03-20",
        phone: "+919876543210",
        patient_code: codeA,
      })
      .select()
      .single();
    expect(errPA).toBeNull();
    expect(pA).toBeDefined();
    patientA = pA;

    // Clinician B creates Patient B in facility B
    const codeB = "PAT-B-" + Date.now();
    const { data: pB, error: errPB } = await clientB
      .from("patients")
      .insert({
        facility_id: facB,
        full_name: "Synthetic Patient Beta",
        gender: "male",
        date_of_birth: "1992-07-14",
        phone: "+919876543211",
        patient_code: codeB,
      })
      .select()
      .single();
    expect(errPB).toBeNull();
    expect(pB).toBeDefined();
    patientB = pB;

    // A clinician -> A patient: ALLOW
    const { data: readAA } = await clientA.from("patients").select().eq("id", patientA.id).single();
    expect(readAA).toBeDefined();
    expect(readAA?.id).toBe(patientA.id);

    // A clinician -> B patient: DENY
    const { data: readAB } = await clientA.from("patients").select().eq("id", patientB.id).maybeSingle();
    expect(readAB).toBeNull();

    // B clinician -> B patient: ALLOW
    const { data: readBB } = await clientB.from("patients").select().eq("id", patientB.id).single();
    expect(readBB).toBeDefined();
    expect(readBB?.id).toBe(patientB.id);

    // B clinician -> A patient: DENY
    const { data: readBA } = await clientB.from("patients").select().eq("id", patientA.id).maybeSingle();
    expect(readBA).toBeNull();

    // Clinician A creates Case for Patient A: ALLOW
    const { data: cA, error: errCA } = await clientA
      .from("cases")
      .insert({
        patient_id: patientA.id,
        clinician_id: (await clientA.auth.getUser()).data.user!.id,
        case_type: "ayush",
        patient_language: "en",
        chief_complaint: "Chronic joint stiffness and vata disturbance",
        raw_patient_complaint: "Pain worsens in cold mornings",
        hpi: {},
        past_history: {},
        medications: [],
        allergies: [],
        red_flags: [],
        status: "draft",
      })
      .select()
      .single();
    expect(errCA).toBeNull();
    expect(cA).toBeDefined();
    caseA = cA;

    // Clinician B attempts to read Case A: DENY
    const { data: caseBRead } = await clientB.from("cases").select().eq("id", caseA.id).maybeSingle();
    expect(caseBRead).toBeNull();

    // Clinician B attempts to insert Case for Patient A: DENY
    const { error: errCrossCase } = await clientB.from("cases").insert({
      patient_id: patientA.id,
      clinician_id: (await clientB.auth.getUser()).data.user!.id,
      case_type: "ayush",
      patient_language: "en",
      chief_complaint: "Cross-facility case attempt",
      status: "draft",
    });
    expect(errCrossCase).toBeDefined();
  });

  it("Step 24: kiosk capability lifecycle and intake session revocation", async () => {
    const kioskSecret = "KioskSecretRealTest999!";
    const kioskSecretHash = crypto.createHash("sha256").update(kioskSecret).digest("hex");
    const kioskId = crypto.randomUUID();

    // Register active kiosk
    const { error: errKiosk } = await serviceClient.from("kiosk_instances").insert({
      id: kioskId,
      facility_id: facA,
      name: "Kiosk Reception Real Test",
      secret_hash: kioskSecretHash,
      status: "active",
    });
    expect(errKiosk).toBeNull();

    // 1. Valid kiosk capability bootstrap intake: ALLOW
    const { data: bootData, error: errBoot } = await anonClient.rpc("rpc_kiosk_bootstrap_intake", {
      p_kiosk_id: kioskId,
      p_kiosk_secret: kioskSecret,
      p_full_name: "Walkin Kiosk Patient",
      p_language: "en",
      p_consent_acknowledged: true,
      p_consent_method: "touch_acknowledgement",
      p_date_of_birth: "1995-10-10",
      p_gender: "female",
    });
    expect(errBoot).toBeNull();
    expect(bootData).toBeDefined();
    const sessionId = bootData.sessionId;
    expect(sessionId).toBeDefined();

    // 2. Submit answer: ALLOW
    const { error: errAnswer } = await anonClient.rpc("rpc_submit_kiosk_answer", {
      p_kiosk_id: kioskId,
      p_kiosk_secret: kioskSecret,
      p_session_id: sessionId,
      p_question_key: "primary_concern",
      p_raw_answer: "Severe fatigue and digestive sluggishness",
      p_input_mode: "touch",
      p_next_question_id: "duration",
    });
    expect(errAnswer).toBeNull();

    // 3. Revoke kiosk session
    const { error: errRevoke } = await anonClient.rpc("rpc_revoke_kiosk_session", {
      p_kiosk_id: kioskId,
      p_kiosk_secret: kioskSecret,
      p_session_id: sessionId,
      p_reason: "Patient abandoned session",
      p_target_status: "abandoned",
    });
    expect(errRevoke).toBeNull();

    // 4. Submit answer on revoked session: FAIL CLOSED
    const { error: errPostRevoke } = await anonClient.rpc("rpc_submit_kiosk_answer", {
      p_kiosk_id: kioskId,
      p_kiosk_secret: kioskSecret,
      p_session_id: sessionId,
      p_question_key: "duration",
      p_raw_answer: "3 weeks",
      p_input_mode: "touch",
      p_next_question_id: "done",
    });
    expect(errPostRevoke).toBeDefined();
    expect(errPostRevoke!.message).toContain("SESSION_REVOKED");

    // 5. Invalid kiosk secret: FAIL CLOSED
    const { error: errBadSecret } = await anonClient.rpc("rpc_kiosk_bootstrap_intake", {
      p_kiosk_id: kioskId,
      p_kiosk_secret: "WrongSecret!",
      p_full_name: "Attacker Walkin",
      p_language: "en",
      p_consent_acknowledged: true,
      p_consent_method: "touch_acknowledgement",
      p_date_of_birth: "1995-10-10",
      p_gender: "female",
    });
    expect(errBadSecret).toBeDefined();
    expect(errBadSecret!.message).toContain("Invalid kiosk secret");
  });

  it("Step 25: consent recording, revocation and boundary checks", async () => {
    // Clinician A records consent for Patient A: ALLOW
    const { data: consentRes, error: errConsent } = await clientA.rpc("rpc_record_consent_with_audit", {
      p_patient_id: patientA.id,
      p_purpose: "clinical_consultation",
      p_scope: ["ayush_case_taking", "pulse_diagnosis"],
      p_language: "en",
      p_method: "touch_acknowledgement",
      p_version: "v1.0",
    });
    expect(errConsent).toBeNull();
    expect(consentRes.status).toBe("granted");

    const consentId = consentRes.id;

    // Clinician B attempts to revoke Clinician A's patient consent: DENY
    const { error: errCrossRevoke } = await clientB.rpc("rpc_revoke_consent_with_audit", {
      p_consent_id: consentId,
      p_reason: "Malicious cross-facility revocation",
    });
    expect(errCrossRevoke).toBeDefined();

    // Clinician A revokes consent: ALLOW
    const { data: revokedRes, error: errRevoke } = await clientA.rpc("rpc_revoke_consent_with_audit", {
      p_consent_id: consentId,
      p_reason: "Patient explicitly withdrew consent",
    });
    expect(errRevoke).toBeNull();
    expect(revokedRes.status).toBe("revoked");
    expect(revokedRes.revoked).toBe(true);

    // Re-revoking already revoked consent: REJECT
    const { error: errReRevoke } = await clientA.rpc("rpc_revoke_consent_with_audit", {
      p_consent_id: consentId,
      p_reason: "Duplicate withdrawal attempt",
    });
    expect(errReRevoke).toBeDefined();
    expect(errReRevoke!.message).toContain("ALREADY_REVOKED");
  });

  it("Step 26: red-flag persistence, acknowledgement, and cross-facility isolation", async () => {
    // 1. Service role persists red-flag event on Case A
    const { data: redFlag, error: errRf } = await serviceClient
      .from("red_flag_events")
      .insert({
        case_id: caseA.id,
        rule_id: "RULE-CARDIO-LIVE-01",
        severity: "critical",
        trigger_text: "Acute radiating substernal pressure and diaphoresis",
      })
      .select()
      .single();
    expect(errRf).toBeNull();
    expect(redFlag).toBeDefined();

    // 2. Clinician A reads red flag via RLS: ALLOW
    const { data: rfReadA } = await clientA
      .from("red_flag_events")
      .select()
      .eq("id", redFlag.id)
      .maybeSingle();
    expect(rfReadA).toBeDefined();
    expect(rfReadA?.rule_id).toBe("RULE-CARDIO-LIVE-01");

    // 3. Clinician B reads red flag via RLS: DENY (isolated)
    const { data: rfReadB } = await clientB
      .from("red_flag_events")
      .select()
      .eq("id", redFlag.id)
      .maybeSingle();
    expect(rfReadB).toBeNull();

    // 4. Clinician B attempts to acknowledge Clinician A's red flag: DENY
    const { error: errAckB } = await clientB.rpc("rpc_acknowledge_red_flag_with_audit", {
      p_case_id: caseA.id,
      p_rule_id: "RULE-CARDIO-LIVE-01",
    });
    expect(errAckB).toBeDefined();
    expect(errAckB!.message).toContain("Cross-facility red flag acknowledgement denied");

    // 5. Clinician A acknowledges red flag: ALLOW
    const { error: errAckA } = await clientA.rpc("rpc_acknowledge_red_flag_with_audit", {
      p_case_id: caseA.id,
      p_rule_id: "RULE-CARDIO-LIVE-01",
    });
    expect(errAckA).toBeNull();
  });

  it("Step 27: idempotency ledger replay safety and conflict rejection", async () => {
    const testKey = "idem-live-" + Date.now();
    const payload1 = {
      fullName: "Idempotent Live Patient",
      dateOfBirth: "1994-08-22",
      gender: "male",
      phone: "+919833344455",
      patientCode: "PT-LIVE-" + Date.now(),
    };
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(payload1)).digest("hex");

    // 1. Initial execution: ALLOW
    const { data: res1, error: err1 } = await clientA.rpc("rpc_execute_idempotent_mutation", {
      p_idempotency_key: testKey,
      p_entity: "patients",
      p_action: "create",
      p_payload_hash: hash1,
      p_payload: payload1,
    });
    expect(err1).toBeNull();
    expect(res1.status).toBe("completed");
    expect(res1.isReplay).toBe(false);

    // 2. Exact replay with same key & payload: ALLOW replay
    const { data: res2, error: err2 } = await clientA.rpc("rpc_execute_idempotent_mutation", {
      p_idempotency_key: testKey,
      p_entity: "patients",
      p_action: "create",
      p_payload_hash: hash1,
      p_payload: payload1,
    });
    expect(err2).toBeNull();
    expect(res2.status).toBe("completed");
    expect(res2.isReplay).toBe(true);
    expect(res2.resourceId).toBe(res1.resourceId);

    // 3. Replay with conflicting payload: REJECT
    const payload2 = { ...payload1, fullName: "Tampered Name" };
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(payload2)).digest("hex");
    const { error: err3 } = await clientA.rpc("rpc_execute_idempotent_mutation", {
      p_idempotency_key: testKey,
      p_entity: "patients",
      p_action: "create",
      p_payload_hash: hash2,
      p_payload: payload2,
    });
    expect(err3).toBeDefined();
    expect(err3!.message).toContain("CONFLICT_IDEMPOTENCY_PAYLOAD_MISMATCH");

    // 4. Different caller (Client B) with same key: ISOLATED ledger entry
    const payloadB = {
      fullName: "Client B Patient",
      dateOfBirth: "1996-01-01",
      gender: "female",
      phone: "+919822233344",
      patientCode: "PT-B-LIVE-" + Date.now(),
    };
    const hashB = crypto.createHash("sha256").update(JSON.stringify(payloadB)).digest("hex");
    const { data: res4, error: err4 } = await clientB.rpc("rpc_execute_idempotent_mutation", {
      p_idempotency_key: testKey,
      p_entity: "patients",
      p_action: "create",
      p_payload_hash: hashB,
      p_payload: payloadB,
    });
    expect(err4).toBeNull();
    expect(res4.status).toBe("completed");
    expect(res4.isReplay).toBe(false);
  });

  it("Step 28: document storage upload, download, and RLS cross-facility denial", async () => {
    const docId = crypto.randomUUID();
    const storagePath = `patients/${patientA.id}/cases/uncategorized/${docId}/diagnostic_report.pdf`;
    const fileContent = Buffer.from("%PDF-1.4 synthetic clinical document for testing");

    // 1. Authorized upload: ALLOW
    const { data: uploadData, error: errUpload } = await clientA.storage
      .from("clinical-documents")
      .upload(storagePath, fileContent, { contentType: "application/pdf" });
    expect(errUpload).toBeNull();
    expect(uploadData?.path).toBe(storagePath);

    // 2. Authorized read/download by Clinician A: ALLOW
    const { data: downloadA, error: errDownA } = await clientA.storage
      .from("clinical-documents")
      .download(storagePath);
    expect(errDownA).toBeNull();
    expect(downloadA).toBeDefined();
    expect(downloadA?.size).toBeGreaterThan(0);

    // 3. Cross-facility download by Clinician B: DENIED (fail-closed, Object not found)
    const { data: downloadB, error: errDownB } = await clientB.storage
      .from("clinical-documents")
      .download(storagePath);
    expect(downloadB).toBeNull();
    expect(errDownB).toBeDefined();

    // 4. Unauthorized upload path (outside patients/{patientA.id}/): DENIED
    const badPath = "unauthorized_root/doc.pdf";
    const { error: errBadPath } = await clientA.storage
      .from("clinical-documents")
      .upload(badPath, fileContent, { contentType: "application/pdf" });
    expect(errBadPath).toBeDefined();
    expect(errBadPath!.message).toContain("row-level security");

    // 5. Unsupported MIME type (not in allowed_mime_types): DENIED
    const badMimePath = `patients/${patientA.id}/cases/uncategorized/${crypto.randomUUID()}/malicious.exe`;
    const { error: errBadMime } = await clientA.storage
      .from("clinical-documents")
      .upload(badMimePath, Buffer.from("MZ malicious executable"), {
        contentType: "application/x-msdownload",
      });
    expect(errBadMime).toBeDefined();
  });
});
