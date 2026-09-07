"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Sparkles,
  ShieldCheck,
  Plus,
  Trash2,
  WifiOff,
} from "lucide-react";
import { offlineQueue } from "@/features/offline/offline-queue";

const SECTIONS = [
  { id: "complaint", label: "1. Chief Complaint" },
  { id: "hpi", label: "2. HPI" },
  { id: "history", label: "3. Past & Personal" },
  { id: "meds", label: "4. Meds & Allergies" },
  { id: "exam", label: "5. Examination" },
  { id: "plan", label: "6. Assessment & Plan" },
];

export default function NewCasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId") || "";

  const [activeSection, setActiveSection] = useState(0);
  const [patientId, setPatientId] = useState(patientIdParam);
  const [caseType, setCaseType] = useState<"general" | "ayush">("general");
  const [patientLanguage, setPatientLanguage] = useState("en");

  // Form Fields
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

  // Persistence State
  const [savedCaseId, setSavedCaseId] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill patient if query param exists or fallback to first synthetic patient
  useEffect(() => {
    if (!patientId) {
      setPatientId("11111111-1111-4111-8111-111111111111");
    }
  }, [patientId]);

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
      pastHistory: { chronicConditions: chronicConditions || null },
      familyHistory: { notes: familyHistory || null },
      personalHistory: { diet, sleep },
      medicationHistory: medications.map((m) => ({ ...m, source: "patient" })),
      allergyHistory: allergies.map((a) => ({ ...a, source: "patient", severity: "Moderate" })),
      examination: {
        blood_pressure: bloodPressure || null,
        pulse: pulse || null,
        temperature: temperature || null,
        spo2: spo2 || null,
        notes: examNotes || null,
      },
      assessmentPlan: {
        summary: assessmentSummary || null,
        plan: treatmentPlan || null,
      },
      status,
      provenance: {
        chief_complaint: "patient",
        hpi: "patient",
        medications: "patient",
        examination: "clinician",
        assessment_plan: "clinician",
      },
    };
  };

  const handleSaveDraft = async () => {
    if (!chiefComplaint || chiefComplaint.trim().length < 3) {
      setErrorMsg("Please enter at least a brief chief complaint to save a draft.");
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);

    // If browser is offline, enqueue directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      offlineQueue.enqueue("cases", "create", buildPayload("draft"));
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
        offlineQueue.enqueue("cases", "create", buildPayload("draft"));
        setLastSavedTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (Offline Queued)");
      } else {
        setErrorMsg(err.message || "Failed to save draft");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!chiefComplaint || chiefComplaint.trim().length < 3) {
      setErrorMsg("Chief complaint is required before finalization.");
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
        await fetch(`/api/cases/${caseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("draft")),
        });
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-surface-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/doctor/patients" className="hover:text-slate-800">
              Patients
            </Link>
            <span>/</span>
            <span>New Case Taking</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-clinical-600" />
            Clinical Intake &amp; Case Form
          </h1>
        </div>

        {/* Save Draft & Status */}
        <div className="flex items-center gap-3">
          {lastSavedTime && (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Saved {lastSavedTime}
            </span>
          )}

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-surface-50 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5 text-clinical-600" />
            {isSaving ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={handleFinalize}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Finalize Case
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Progress & Section Navigation */}
      <div className="rounded-xl border border-surface-200 bg-white p-2 shadow-sm">
        <nav className="flex flex-wrap gap-1">
          {SECTIONS.map((sec, idx) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(idx)}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeSection === idx
                  ? "bg-clinical-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-surface-100"
              }`}
            >
              {sec.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm sm:p-8">
        {/* SECTION 0: Chief Complaint */}
        {activeSection === 0 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Chief Complaint &amp; Intake Mode</h2>
              <p className="text-xs text-slate-500 mt-0.5">Capture patient&apos;s primary complaint in their own words</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Stream</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCaseType("general")}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      caseType === "general"
                        ? "border-clinical-600 bg-clinical-50 text-clinical-900 font-bold"
                        : "border-surface-200 text-slate-600"
                    }`}
                  >
                    <div className="text-xs">General / Allopathic</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Standard clinical OPD history</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaseType("ayush")}
                    className={`rounded-lg border p-3 text-left transition-all ${
                      caseType === "ayush"
                        ? "border-ayush-600 bg-ayush-50 text-ayush-900 font-bold"
                        : "border-surface-200 text-slate-600"
                    }`}
                  >
                    <div className="text-xs">AYUSH Assessment</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Dashavidha Pariksha &amp; Ahara-Vihara</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language Mode</label>
                <select
                  value={patientLanguage}
                  onChange={(e) => setPatientLanguage(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 py-2.5 px-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
                >
                  <option value="en">English</option>
                  <option value="te">Telugu (తెలుగు)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Normalized Chief Complaint *
              </label>
              <textarea
                rows={3}
                required
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Persistent dry cough for 2 weeks with throat irritation, worse at night"
                className="block w-full rounded-lg border border-surface-200 p-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Raw Patient Verbatim (Preserve Original Spoken Phrase)
              </label>
              <input
                type="text"
                value={rawPatientComplaint}
                onChange={(e) => setRawPatientComplaint(e.target.value)}
                placeholder="e.g. రెండు వారాలుగా గొంతులో మంట, దగ్గు ఎక్కువగా వస్తోంది"
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Provenance rule: Patient wording is retained for clinical fidelity.
              </span>
            </div>
          </div>
        )}

        {/* SECTION 1: HPI */}
        {activeSection === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">History of Present Illness (HPI)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Structured analysis of symptom progression</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Onset</label>
                <input
                  type="text"
                  value={onset}
                  onChange={(e) => setOnset(e.target.value)}
                  placeholder="e.g. Acute 3 days ago / Gradual over 2 weeks"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 14 days"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Character / Nature</label>
                <input
                  type="text"
                  value={character}
                  onChange={(e) => setCharacter(e.target.value)}
                  placeholder="e.g. Dry, hacking / Burning / Sharp"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                >
                  <option value="Mild">Mild</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Severe">Severe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aggravating Factors</label>
                <input
                  type="text"
                  value={aggravatingFactors}
                  onChange={(e) => setAggravatingFactors(e.target.value)}
                  placeholder="e.g. Cold drinks, exertion, night time"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relieving Factors</label>
                <input
                  type="text"
                  value={relievingFactors}
                  onChange={(e) => setRelievingFactors(e.target.value)}
                  placeholder="e.g. Warm water, rest, sitting upright"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: Past & Personal History */}
        {activeSection === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Past, Family &amp; Personal History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Chronic conditions, hereditary risks, and lifestyle factors</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Past Medical &amp; Surgical History</label>
              <textarea
                rows={2}
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="e.g. Hypertension (5 years), Appendectomy in 2018"
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Family Medical History</label>
              <input
                type="text"
                value={familyHistory}
                onChange={(e) => setFamilyHistory(e.target.value)}
                placeholder="e.g. Father has Type 2 Diabetes; Mother has Hypertension"
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary Habits</label>
                <select
                  value={diet}
                  onChange={(e) => setDiet(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                >
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Non-Vegetarian">Non-Vegetarian</option>
                  <option value="Eggetarian">Eggetarian</option>
                  <option value="Vegan">Vegan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sleep Pattern</label>
                <select
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                >
                  <option value="Normal">Normal (7-8 hours)</option>
                  <option value="Disturbed">Disturbed / Insomnia</option>
                  <option value="Decreased">Decreased (&lt;5 hours)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: Meds & Allergies */}
        {activeSection === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Current Medications &amp; Known Allergies</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ongoing treatments and adverse drug reactions</p>
            </div>

            {/* Medications List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Current Medications</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="Medicine name (e.g. Metformin 500mg)"
                  className="block flex-1 rounded-lg border border-surface-200 p-2 text-xs"
                />
                <input
                  type="text"
                  value={newMedDose}
                  onChange={(e) => setNewMedDose(e.target.value)}
                  placeholder="Dosage (e.g. 1 tab BD)"
                  className="block w-40 rounded-lg border border-surface-200 p-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addMedication}
                  className="rounded-lg bg-clinical-600 px-3 py-2 text-xs font-semibold text-white hover:bg-clinical-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {medications.length > 0 ? (
                <div className="space-y-2 pt-2">
                  {medications.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-surface-200 p-2.5 text-xs bg-surface-50">
                      <div>
                        <strong>{m.name}</strong> — <span className="text-slate-500">{m.dose}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No current medications added.</p>
              )}
            </div>

            {/* Allergies List */}
            <div className="space-y-3 pt-4 border-t border-surface-200">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Known Allergies</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAllergySubstance}
                  onChange={(e) => setNewAllergySubstance(e.target.value)}
                  placeholder="Substance (e.g. Penicillin, Peanuts, Dust)"
                  className="block flex-1 rounded-lg border border-surface-200 p-2 text-xs"
                />
                <input
                  type="text"
                  value={newAllergyReaction}
                  onChange={(e) => setNewAllergyReaction(e.target.value)}
                  placeholder="Reaction (e.g. Urticaria / Rash)"
                  className="block w-40 rounded-lg border border-surface-200 p-2 text-xs"
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {allergies.length > 0 ? (
                <div className="space-y-2 pt-2">
                  {allergies.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-rose-200 p-2.5 text-xs bg-rose-50/50">
                      <div className="text-rose-900">
                        <strong>{a.substance}</strong> — <span>{a.reaction}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAllergies(allergies.filter((_, idx) => idx !== i))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No known drug/food allergies reported.</p>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: Physical Examination */}
        {activeSection === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Vitals &amp; Physical Examination</h2>
              <p className="text-xs text-slate-500 mt-0.5">Recorded by clinician during consultation</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Pressure (mmHg)</label>
                <input
                  type="text"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  placeholder="120/80"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pulse (bpm)</label>
                <input
                  type="text"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="72"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Temperature (&deg;F)</label>
                <input
                  type="text"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="98.6"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SpO2 (%)</label>
                <input
                  type="text"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                  placeholder="98"
                  className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Examination Findings</label>
              <textarea
                rows={3}
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
                placeholder="e.g. Chest: Clear bilaterally. Throat: Mild erythema, no tonsillar exudates."
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
              />
            </div>
          </div>
        )}

        {/* SECTION 5: Assessment & Plan */}
        {activeSection === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Clinician Assessment &amp; Treatment Plan</h2>
              <p className="text-xs text-slate-500 mt-0.5">Physician-owned conclusions, prescription, and counselling</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Impression / Summary</label>
              <textarea
                rows={3}
                value={assessmentSummary}
                onChange={(e) => setAssessmentSummary(e.target.value)}
                placeholder="e.g. Upper respiratory tract allergy with dry cough. No signs of infection."
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Management &amp; Prescription Plan</label>
              <textarea
                rows={4}
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                placeholder="e.g. Tab Levocetirizine 5mg 1 tab OD at bedtime x 7 days. Warm saline gargles. Return if fever develops."
                className="block w-full rounded-lg border border-surface-200 p-2.5 text-sm"
              />
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="mt-8 flex items-center justify-between border-t border-surface-200 pt-5">
          <button
            type="button"
            disabled={activeSection === 0}
            onClick={() => setActiveSection(Math.max(0, activeSection - 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Previous Section
          </button>

          {activeSection < SECTIONS.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveSection(Math.min(SECTIONS.length - 1, activeSection + 1))}
              className="inline-flex items-center gap-1 rounded-lg bg-clinical-600 px-4 py-2 text-xs font-semibold text-white hover:bg-clinical-700"
            >
              Next: {SECTIONS[activeSection + 1].label} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={isSaving}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Finalize Consultation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
