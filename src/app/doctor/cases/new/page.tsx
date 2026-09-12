"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";
import { offlineQueue } from "@/features/offline/offline-queue";
import { CaseHeader } from "@/components/cases/new-case-sections/CaseHeader";
import { ChiefComplaintSection } from "@/components/cases/new-case-sections/ChiefComplaintSection";
import { HpiSection } from "@/components/cases/new-case-sections/HpiSection";
import { HistorySection } from "@/components/cases/new-case-sections/HistorySection";
import { MedicationAllergySection } from "@/components/cases/new-case-sections/MedicationAllergySection";
import { ExaminationSection } from "@/components/cases/new-case-sections/ExaminationSection";
import { AssessmentPlanSection } from "@/components/cases/new-case-sections/AssessmentPlanSection";
import { CaseActionBar } from "@/components/cases/new-case-sections/CaseActionBar";

// Lazy-load heavy AYUSH Dashavidha Pariksha section to optimize initial render bundle
const AyushSection = dynamic(
  () => import("@/components/cases/new-case-sections/AyushSection").then((mod) => mod.AyushSection),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500 animate-pulse">
        <span>Loading AYUSH Dashavidha Pariksha module...</span>
      </div>
    ),
    ssr: false,
  }
);

export default function NewCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId") || "";

  const [activeSection, setActiveSection] = useState(0);
  const [patientId, setPatientId] = useState(patientIdParam);
  const [caseType, setCaseType] = useState<"general" | "ayush">("general");
  const [patientLanguage, setPatientLanguage] = useState("en");

  // Dynamic sections based on clinical case type
  const sections = [
    { id: "complaint", label: "1. Chief Complaint" },
    { id: "hpi", label: "2. HPI" },
    { id: "history", label: "3. Past & Personal" },
    { id: "meds", label: "4. Meds & Allergies" },
    { id: "exam", label: "5. Examination" },
    ...(caseType === "ayush" ? [{ id: "ayush", label: "6. AYUSH Pariksha" }] : []),
    { id: "plan", label: caseType === "ayush" ? "7. Assessment & Plan" : "6. Assessment & Plan" },
  ];
  const currentSectionId = sections[activeSection]?.id || "complaint";

  // Form Fields: Chief Complaint
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [rawPatientComplaint, setRawPatientComplaint] = useState("");

  // HPI
  const [onset, setOnset] = useState("");
  const [duration, setDuration] = useState("");
  const [character, setCharacter] = useState("");
  const [location, setLocation] = useState("");
  const [radiation, setRadiation] = useState("");
  const [severity, setSeverity] = useState("Moderate");
  const [aggravatingFactors, setAggravatingFactors] = useState("");
  const [relievingFactors, setRelievingFactors] = useState("");

  // History
  const [chronicConditions, setChronicConditions] = useState("");
  const [familyHistory, setFamilyHistory] = useState("");
  const [diet, setDiet] = useState("Vegetarian");
  const [sleep, setSleep] = useState("Normal");

  // Meds & Allergies
  const [medications, setMedications] = useState<{ name: string; dose: string }[]>([]);
  const [newMedName, setNewMedName] = useState("");
  const [newMedDose, setNewMedDose] = useState("");

  const [allergies, setAllergies] = useState<{ substance: string; reaction: string }[]>([]);
  const [newAllergySubstance, setNewAllergySubstance] = useState("");
  const [newAllergyReaction, setNewAllergyReaction] = useState("");

  // Examination
  const [bloodPressure, setBloodPressure] = useState("120/80");
  const [pulse, setPulse] = useState("72");
  const [temperature, setTemperature] = useState("98.6");
  const [spo2, setSpo2] = useState("98");
  const [examNotes, setExamNotes] = useState("");

  // Plan
  const [assessmentSummary, setAssessmentSummary] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");

  // AYUSH Dashavidha Pariksha State
  const [prakriti, setPrakriti] = useState("Vata-Pitta");
  const [vikriti, setVikriti] = useState("Vata Prakopa");
  const [sara, setSara] = useState("Madhyama");
  const [samhanana, setSamhanana] = useState("Madhyama");
  const [pramana, setPramana] = useState("Madhyama");
  const [satmya, setSatmya] = useState("Madhyama");
  const [sattva, setSattva] = useState("Pravara");
  const [aharaShakti, setAharaShakti] = useState("Madhyama (Samagni)");
  const [vyayamaShakti, setVyayamaShakti] = useState("Madhyama");
  const [vaya, setVaya] = useState("Madhyama (Adult)");
  const [dietaryHabits, setDietaryHabits] = useState("");
  const [dailyRoutine, setDailyRoutine] = useState("");

  // Persistence State
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  const [localDraftKey] = useState(() => crypto.randomUUID());
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement | null>(null);

  const [patientList, setPatientList] = useState<Array<{ id: string; full_name: string; patient_code?: string; age?: number; gender?: string }>>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // Load facility patients to populate selection
  useEffect(() => {
    let isMounted = true;
    async function loadPatients() {
      setIsLoadingPatients(true);
      try {
        const res = await fetch("/api/patients?pageSize=50");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.patients && data.patients.length > 0) {
            setPatientList(data.patients);
            // If no patient ID is set, or if set to the synthetic demo mock, auto-select first real patient
            if (!patientIdParam || patientIdParam === "11111111-1111-4111-8111-111111111111") {
              setPatientId(data.patients[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load facility patients for new case:", err);
      } finally {
        if (isMounted) setIsLoadingPatients(false);
      }
    }
    loadPatients();
    return () => {
      isMounted = false;
    };
  }, [patientIdParam]);

  // Adjust activeSection if out of bounds (e.g. toggling AYUSH mode)
  useEffect(() => {
    if (activeSection >= sections.length) {
      setActiveSection(sections.length - 1);
    }
  }, [sections.length, activeSection]);

  const buildPayload = (status: "draft" | "final" = "draft") => {
    return {
      patientId,
      caseType,
      patientLanguage,
      chiefComplaint,
      rawPatientComplaint: rawPatientComplaint || null,
      hpi: {
        onset: onset || null,
        duration: duration || null,
        character: character || null,
        location: location || null,
        radiation: radiation || null,
        severity: severity || null,
        aggravating_factors: aggravatingFactors || null,
        relieving_factors: relievingFactors || null,
      },
      pastHistory: {
        chronic_conditions: chronicConditions ? chronicConditions.split(",").map((s) => s.trim()) : [],
        family_history: familyHistory || null,
        diet: diet || null,
        sleep: sleep || null,
      },
      medications: medications.map((m) => ({ name: m.name, dosage: m.dose, status: "active" })),
      allergies: allergies.map((a) => ({ substance: a.substance, reaction: a.reaction, severity: "moderate" })),
      physicalExamination: {
        vitals: {
          blood_pressure: bloodPressure || null,
          pulse: pulse ? parseInt(pulse, 10) : null,
          temperature: temperature ? parseFloat(temperature) : null,
          spo2: spo2 ? parseInt(spo2, 10) : null,
        },
        general_notes: examNotes || null,
      },
      assessmentPlan: {
        summary: assessmentSummary || null,
        plan: treatmentPlan || null,
      },
      ayushAssessment: caseType === "ayush" ? {
        prakriti: prakriti || null,
        vikriti: vikriti || null,
        sara: sara || null,
        samhanana: samhanana || null,
        pramana: pramana || null,
        satmya: satmya || null,
        sattva: sattva || null,
        ahara_shakti: aharaShakti || null,
        vyayama_shakti: vyayamaShakti || null,
        vaya: vaya || null,
        ahara_vihara: (dietaryHabits || dailyRoutine) ? {
          dietary_habits: dietaryHabits || null,
          daily_routine: dailyRoutine || null,
        } : null,
        source: "clinician" as const,
      } : null,
      status,
    };
  };

  const handleSaveDraft = async () => {
    if (!patientId || patientId === "11111111-1111-4111-8111-111111111111") {
      setErrorMsg("Please select a valid patient before saving the case draft.");
      errorRef.current?.focus();
      return;
    }

    if (!chiefComplaint.trim()) {
      setErrorMsg("Please enter at least a brief chief complaint to save a draft.");
      errorRef.current?.focus();
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);

    // If browser is offline, enqueue directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (savedCaseId) {
        offlineQueue.enqueue("cases", "update", { id: savedCaseId, ...buildPayload("draft") });
      } else {
        offlineQueue.enqueue(
          "cases",
          "create",
          buildPayload("draft"),
          `draft-${patientId}-${localDraftKey}`
        );
      }
      setLastSavedTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (Offline Queued)");
      setIsSaving(false);
      return;
    }

    try {
      if (savedCaseId) {
        // Update existing draft
        const res = await fetch(`/api/cases/${savedCaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("draft")),
        });
        if (!res.ok) throw new Error("Failed to update draft");
      } else {
        // Create new draft
        const res = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("draft")),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save draft");
        setSavedCaseId(data.case.id);
      }

      setLastSavedTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err: any) {
      // Network error fallback to offline queue
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (savedCaseId) {
          offlineQueue.enqueue("cases", "update", { id: savedCaseId, ...buildPayload("draft") });
        } else {
          offlineQueue.enqueue(
            "cases",
            "create",
            buildPayload("draft"),
            `draft-${patientId}-${localDraftKey}`
          );
        }
        setLastSavedTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (Offline Queued)");
      } else {
        setErrorMsg(err.message || "Failed to save draft");
        errorRef.current?.focus();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!patientId || patientId === "11111111-1111-4111-8111-111111111111") {
      setErrorMsg("Please select a valid patient before finalizing the case.");
      errorRef.current?.focus();
      return;
    }

    if (!chiefComplaint || chiefComplaint.trim().length < 3) {
      setErrorMsg("Chief complaint is required before finalization (at least 3 characters).");
      errorRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      let caseId = savedCaseId;
      if (!caseId) {
        const createRes = await fetch("/api/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("draft")),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || "Failed to create case");
        caseId = createData.case.id;
      } else {
        const updateRes = await fetch(`/api/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("draft")),
        });
        if (!updateRes.ok) {
          const updateData = await updateRes.json().catch(() => ({}));
          throw new Error(updateData.error || "Failed to persist draft prior to finalization");
        }
      }

      // Finalize action
      const finalizeRes = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize" }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error || "Failed to finalize case");

      router.push(`/doctor/cases/${caseId}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to finalize case");
      errorRef.current?.focus();
      setIsSaving(false);
    }
  };

  const addMedication = () => {
    if (!newMedName.trim()) return;
    setMedications([...medications, { name: newMedName.trim(), dose: newMedDose.trim() || "As directed" }]);
    setNewMedName("");
    setNewMedDose("");
  };

  const addAllergy = () => {
    if (!newAllergySubstance.trim()) return;
    setAllergies([...allergies, { substance: newAllergySubstance.trim(), reaction: newAllergyReaction.trim() || "Reaction noted" }]);
    setNewAllergySubstance("");
    setNewAllergyReaction("");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Case Header Component */}
      <CaseHeader
        patientId={patientId}
        patientList={patientList}
        onSelectPatient={setPatientId}
        isLoadingPatients={isLoadingPatients}
        caseType={caseType}
        setCaseType={setCaseType}
        patientLanguage={patientLanguage}
        setPatientLanguage={setPatientLanguage}
        savedCaseId={savedCaseId}
        lastSavedTime={lastSavedTime}
        isSaving={isSaving}
      />

      {/* Action shortcuts bar for quick save / finalize */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSaving}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-clinical-500 disabled:opacity-50 transition-colors"
        >
          <Save className="h-4 w-4 text-clinical-600" aria-hidden="true" />
          <span>{isSaving ? "Saving Draft..." : "Save Draft"}</span>
        </button>

        <button
          type="button"
          onClick={handleFinalize}
          disabled={isSaving}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-700 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>Finalize Consultation</span>
        </button>
      </div>

      {/* Accessible Error Alert Banner */}
      {errorMsg && (
        <div
          ref={errorRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="rounded-lg bg-red-50 border border-red-200 p-4 text-xs text-red-700 flex items-start gap-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">Action Required</h3>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Progress & Section Navigation with Accessible Tabs Roles */}
      <div className="rounded-xl border border-surface-200 bg-white p-2 shadow-sm">
        <nav role="tablist" aria-label="Clinical intake sections" className="flex flex-wrap gap-1">
          {sections.map((sec, idx) => (
            <button
              key={sec.id}
              role="tab"
              id={`tab-${sec.id}`}
              aria-selected={activeSection === idx}
              aria-controls={`tabpanel-${sec.id}`}
              onClick={() => setActiveSection(idx)}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-clinical-500 ${
                activeSection === idx
                  ? sec.id === "ayush"
                    ? "bg-ayush-700 text-white shadow-sm"
                    : "bg-clinical-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-surface-100"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content Panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${currentSectionId}`}
        aria-labelledby={`tab-${currentSectionId}`}
        className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm sm:p-8"
      >
        {/* SECTION: Chief Complaint */}
        {currentSectionId === "complaint" && (
          <ChiefComplaintSection
            chiefComplaint={chiefComplaint}
            setChiefComplaint={setChiefComplaint}
            rawPatientComplaint={rawPatientComplaint}
            setRawPatientComplaint={setRawPatientComplaint}
            patientLanguage={patientLanguage}
          />
        )}

        {/* SECTION: HPI */}
        {currentSectionId === "hpi" && (
          <HpiSection
            onset={onset}
            setOnset={setOnset}
            duration={duration}
            setDuration={setDuration}
            character={character}
            setCharacter={setCharacter}
            location={location}
            setLocation={setLocation}
            radiation={radiation}
            setRadiation={setRadiation}
            severity={severity}
            setSeverity={setSeverity}
            aggravatingFactors={aggravatingFactors}
            setAggravatingFactors={setAggravatingFactors}
            relievingFactors={relievingFactors}
            setRelievingFactors={setRelievingFactors}
          />
        )}

        {/* SECTION: Past & Personal History */}
        {currentSectionId === "history" && (
          <HistorySection
            chronicConditions={chronicConditions}
            setChronicConditions={setChronicConditions}
            familyHistory={familyHistory}
            setFamilyHistory={setFamilyHistory}
            diet={diet}
            setDiet={setDiet}
            sleep={sleep}
            setSleep={setSleep}
          />
        )}

        {/* SECTION: Meds & Allergies */}
        {currentSectionId === "meds" && (
          <MedicationAllergySection
            medications={medications}
            setMedications={setMedications}
            newMedName={newMedName}
            setNewMedName={setNewMedName}
            newMedDose={newMedDose}
            setNewMedDose={setNewMedDose}
            addMedication={addMedication}
            allergies={allergies}
            setAllergies={setAllergies}
            newAllergySubstance={newAllergySubstance}
            setNewAllergySubstance={setNewAllergySubstance}
            newAllergyReaction={newAllergyReaction}
            setNewAllergyReaction={setNewAllergyReaction}
            addAllergy={addAllergy}
          />
        )}

        {/* SECTION: Physical Examination */}
        {currentSectionId === "exam" && (
          <ExaminationSection
            bloodPressure={bloodPressure}
            setBloodPressure={setBloodPressure}
            pulse={pulse}
            setPulse={setPulse}
            temperature={temperature}
            setTemperature={setTemperature}
            spo2={spo2}
            setSpo2={setSpo2}
            examNotes={examNotes}
            setExamNotes={setExamNotes}
          />
        )}

        {/* SECTION: AYUSH Dashavidha Pariksha */}
        {currentSectionId === "ayush" && (
          <AyushSection
            prakriti={prakriti}
            setPrakriti={setPrakriti}
            vikriti={vikriti}
            setVikriti={setVikriti}
            sara={sara}
            setSara={setSara}
            samhanana={samhanana}
            setSamhanana={setSamhanana}
            pramana={pramana}
            setPramana={setPramana}
            satmya={satmya}
            setSatmya={setSatmya}
            sattva={sattva}
            setSattva={setSattva}
            aharaShakti={aharaShakti}
            setAharaShakti={setAharaShakti}
            vyayamaShakti={vyayamaShakti}
            setVyayamaShakti={setVyayamaShakti}
            vaya={vaya}
            setVaya={setVaya}
            dietaryHabits={dietaryHabits}
            setDietaryHabits={setDietaryHabits}
            dailyRoutine={dailyRoutine}
            setDailyRoutine={setDailyRoutine}
          />
        )}

        {/* SECTION: Assessment & Plan */}
        {currentSectionId === "plan" && (
          <AssessmentPlanSection
            assessmentSummary={assessmentSummary}
            setAssessmentSummary={setAssessmentSummary}
            treatmentPlan={treatmentPlan}
            setTreatmentPlan={setTreatmentPlan}
          />
        )}

        {/* Navigation & Finalize Bar */}
        <CaseActionBar
          activeSection={activeSection}
          sectionsCount={sections.length}
          nextSectionLabel={sections[activeSection + 1]?.label}
          onPrevious={() => setActiveSection(Math.max(0, activeSection - 1))}
          onNext={() => setActiveSection(Math.min(sections.length - 1, activeSection + 1))}
          onFinalize={handleFinalize}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
