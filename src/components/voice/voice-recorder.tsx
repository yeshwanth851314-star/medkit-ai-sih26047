"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square, Play, RefreshCw, AlertCircle, CheckCircle2, Languages, Edit3, Volume2 } from "lucide-react";
import { TranscriptionResult } from "@/features/voice/types";

export function VoiceRecorder({
  language = "en",
  intakeToken,
  onTranscriptionConfirmed,
  onCancel,
}: {
  language?: "en" | "te" | "hi" | "ta" | "kn" | string;
  intakeToken?: string | null;
  onTranscriptionConfirmed: (transcript: string, translation?: string) => void;
  onCancel?: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch (_) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    };
  }, []);

  const startRecording = async () => {
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasPermission(false);
        setErrorMessage("Microphone not supported on this browser/device. Please use touch or text input.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);
      setIsRecording(true);
      setRecordingDuration(0);
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size > 0) {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64Data = (reader.result as string)?.split(",")[1];
            fetchTranscription(undefined, base64Data, mimeType);
          };
        } else {
          fetchTranscription();
        }
      };

      mediaRecorder.start(250); // Slice into 250ms chunks

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setHasPermission(false);
      setErrorMessage("Microphone permission denied. Fallback to manual text or touch selection is active.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const fetchTranscription = async (mockId?: string, audioBase64?: string, mimeType?: string) => {
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(intakeToken ? { "x-intake-token": intakeToken } : {}),
        },
        body: JSON.stringify({
          language,
          mockId,
          audioBase64,
          mimeType: mimeType || "audio/webm",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");

      setTranscriptionResult(data.transcription);
      setEditedTranscript(data.transcription.rawTranscript);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process audio transcription");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleConfirm = () => {
    if (!editedTranscript.trim()) return;
    onTranscriptionConfirmed(editedTranscript, transcriptionResult?.englishTranslation || undefined);
  };

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-surface-200 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-clinical-600" />
            Speech-to-Text Clinical Modality
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Voice is an input modality. The transcript must be reviewed before entering the clinical record.
          </p>
        </div>

        <span className="rounded-full bg-surface-100 border border-surface-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          Lang: {language === "te" ? "Telugu (తెలుగు)" : "English"}
        </span>
      </div>

      {/* Permission or Hardware Error */}
      {errorMessage && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Graceful Fallback:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Recording Stage */}
      {!transcriptionResult ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <div className="relative">
            {isRecording && (
              <span className="absolute -inset-2 rounded-full bg-red-400 opacity-75 animate-ping" />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? "Stop audio recording" : "Start audio recording"}
              className={`relative flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all focus:outline-none focus:ring-4 focus:ring-clinical-300 ${
                isRecording ? "bg-red-600 hover:bg-red-700" : "bg-clinical-600 hover:bg-clinical-700"
              }`}
            >
              {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-7 w-7" />}
            </button>
          </div>

          <div className="text-center">
            <span className="text-xs font-bold text-slate-800">
              {isRecording ? `Recording... (${recordingDuration}s)` : "Tap to Speak"}
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isRecording ? "Click square button when finished speaking" : "Describe your symptoms naturally in your chosen language"}
            </p>
          </div>

          {isTranscribing && (
            <div className="flex items-center gap-2 text-xs font-semibold text-clinical-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Transcribing and normalizing audio...</span>
            </div>
          )}

          {/* Synthetic Demo Shortcuts */}
          <div className="pt-4 border-t border-surface-200 w-full">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center mb-2">
              SIH Demo Audio Simulations (Instant Testing)
            </span>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fetchTranscription("tr-0001")}
                className="rounded-md border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-surface-100"
              >
                English Dry Cough (97%)
              </button>
              <button
                type="button"
                onClick={() => fetchTranscription("tr-0002")}
                className="rounded-md border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-surface-100"
              >
                Telugu Chest Pain (94%)
              </button>
              <button
                type="button"
                onClick={() => fetchTranscription("tr-0003")}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900 hover:bg-amber-100"
              >
                Noisy Audio Warning (42%)
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Review & Correction Stage */
        <div className="space-y-4">
          {transcriptionResult.warning && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Low Confidence Alert:</strong> {transcriptionResult.warning}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="voice-transcript-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Captured Transcript (Editable by Patient / Clinician)
              </label>
              <span className="text-xs text-slate-500">
                Confidence: {Math.round(transcriptionResult.confidence * 100)}%
              </span>
            </div>
            <textarea
              id="voice-transcript-input"
              rows={3}
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              aria-label="Captured Transcript"
              className="block w-full rounded-xl border border-surface-200 p-3 text-sm focus:border-clinical-600 focus:ring-1 focus:ring-clinical-600"
            />
          </div>

          {transcriptionResult.englishTranslation && (
            <div className="rounded-xl bg-surface-50 p-3 border border-surface-200 text-xs">
              <span className="font-bold text-slate-700 block mb-0.5">Clinical English Translation:</span>
              <span className="text-slate-900 italic">{transcriptionResult.englishTranslation}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-surface-200">
            <button
              type="button"
              onClick={() => {
                setTranscriptionResult(null);
                setEditedTranscript("");
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Record Again
            </button>

            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-surface-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-clinical-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-clinical-700 shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Transcript
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
