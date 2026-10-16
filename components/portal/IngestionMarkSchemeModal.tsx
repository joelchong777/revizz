"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  ClipboardPaste,
  Wand2,
  RefreshCw,
  X,
  Check,
  Loader2,
  ShieldCheck,
  Search,
  ArrowRight,
} from "lucide-react";
import type { StagingPaper } from "@/types/ingestion";
import type { MarkSchemeVerificationReport, QuestionMismatch } from "@/lib/ingestion/markSchemeChecker";
import { remediatePaperWithMarkScheme } from "@/lib/ingestion/markSchemeRemediator";

export interface IngestionMarkSchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: StagingPaper | null;
  onApplyFix: (fixedPaper: StagingPaper) => void;
  onVerificationSuccess?: (report: MarkSchemeVerificationReport) => void;
}

type TabType = "auto" | "upload" | "paste";

export default function IngestionMarkSchemeModal({
  isOpen,
  onClose,
  paper,
  onApplyFix,
  onVerificationSuccess,
}: IngestionMarkSchemeModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MarkSchemeVerificationReport | null>(null);
  const [lastMsAnswers, setLastMsAnswers] = useState<Record<number, any> | null>(null);

  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste tab state
  const [pastedText, setPastedText] = useState("");

  // Fix state
  const [fixing, setFixing] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const paperId =
    paper?.id ||
    `${paper?.subject?.code || "0455"}_${paper?.paper?.series || "s"}${String(paper?.paper?.year || 2024).slice(-2)}_${paper?.paper?.paper_code || "11"}`;

  const sourceMsFilename =
    paper?.source_ms_filename ||
    `${paper?.subject?.code || "0455"}_${paper?.paper?.series || "s"}${String(paper?.paper?.year || 2024).slice(-2)}_ms_${paper?.paper?.paper_code || "11"}.pdf`;

  const handleVerifyAuto = async () => {
    if (!paper) return;
    setLoading(true);
    setError(null);
    setFixSuccessMessage(null);

    try {
      const res = await fetch("/api/ingest/verify-ms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Auto-discovery failed to locate a valid mark scheme.");
      }

      setReport(data.report);
      if (data.report.status === "perfect_match" && onVerificationSuccess) {
        onVerificationSuccess(data.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify paper with mark scheme.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUpload = async () => {
    if (!paper || !selectedFile) {
      setError("Please choose a Mark Scheme PDF file to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    setFixSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("paper", JSON.stringify(paper));
      formData.append("ms_file", selectedFile);

      const res = await fetch("/api/ingest/verify-ms", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process uploaded mark scheme PDF.");
      }

      setReport(data.report);
      if (data.report.status === "perfect_match" && onVerificationSuccess) {
        onVerificationSuccess(data.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify uploaded PDF.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPasted = async () => {
    if (!paper || !pastedText.trim()) {
      setError("Please paste mark scheme text into the box.");
      return;
    }
    setLoading(true);
    setError(null);
    setFixSuccessMessage(null);

    try {
      const res = await fetch("/api/ingest/verify-ms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper,
          rawMsText: pastedText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not parse any answers from pasted text.");
      }

      setReport(data.report);
      if (data.report.status === "perfect_match" && onVerificationSuccess) {
        onVerificationSuccess(data.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify pasted mark scheme text.");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFixAll = async () => {
    if (!paper || !report || report.mismatches.length === 0) return;
    setFixing(true);
    setError(null);

    try {
      // Build MarkSchemeMap from mismatches and existing correct options
      const msMap: Record<number, any> = {};

      // Seed with staged correct keys
      for (const q of paper.questions) {
        const correctOpt = q.options.find((o) => o.is_correct);
        if (correctOpt) {
          msMap[q.question_number] = correctOpt.label;
        }
      }

      // Override with verified mark scheme expected keys
      for (const m of report.mismatches) {
        if (m.expectedKey) {
          msMap[m.questionNumber] = m.expectedKey;
        }
      }

      // Execute client-side remediation
      const remediation = remediatePaperWithMarkScheme(paper, msMap);

      if (remediation.fixedCount > 0) {
        onApplyFix(remediation.fixedPaper);
        setFixSuccessMessage(
          `Successfully auto-fixed ${remediation.fixedCount} question(s) and re-aligned distractor analysis!`
        );

        // Also trigger backend re-verification
        setTimeout(async () => {
          try {
            const reRes = await fetch("/api/ingest/verify-ms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paper: remediation.fixedPaper,
                answers: msMap,
              }),
            });
            const reData = await reRes.json();
            if (reData.success && reData.report) {
              setReport(reData.report);
              if (onVerificationSuccess && reData.report.status === "perfect_match") {
                onVerificationSuccess(reData.report);
              }
            }
          } catch {
            // Non-critical
          }
        }, 300);
      } else {
        setError("No auto-remediations could be performed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to auto-remediate paper.");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-3xl shadow-[4px_4px_0_#201e1d] w-full max-w-3xl max-h-[92vh] flex flex-col my-auto overflow-hidden font-body text-[#201e1d]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b-2 border-[#201e1d] bg-[#f2ecdf]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#feebc8] border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_#201e1d]">
              <ShieldCheck className="w-6 h-6 text-[#c67139]" />
            </div>
            <div>
              <h2 className="font-heading text-xl sm:text-2xl text-[#201e1d] flex items-center gap-2">
                Mark Scheme Checker
              </h2>
              <p className="text-xs text-[#645c50] font-bold">
                Verify staged questions against official Cambridge Mark Schemes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[#201e1d]"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-5 pt-4 border-b-2 border-[#201e1d] bg-[#f9f4ed]">
          <button
            type="button"
            onClick={() => {
              setActiveTab("auto");
              setError(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t-2 border-x-2 border-[#201e1d] transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "auto"
                ? "bg-white text-[#201e1d] translate-y-[2px] shadow-none"
                : "bg-[#e8dfcf] text-[#645c50] hover:bg-[#ede4d5]"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Auto-Detect</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("upload");
              setError(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t-2 border-x-2 border-[#201e1d] transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "upload"
                ? "bg-white text-[#201e1d] translate-y-[2px] shadow-none"
                : "bg-[#e8dfcf] text-[#645c50] hover:bg-[#ede4d5]"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("paste");
              setError(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t-2 border-x-2 border-[#201e1d] transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "paste"
                ? "bg-white text-[#201e1d] translate-y-[2px] shadow-none"
                : "bg-[#e8dfcf] text-[#645c50] hover:bg-[#ede4d5]"
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste Text</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
          {/* Active Tab Panel */}
          {activeTab === "auto" && (
            <div className="p-4 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_#201e1d] flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-heading text-sm text-[#201e1d]">Paper Auto-Discovery</h4>
                  <p className="text-xs text-[#645c50] font-medium">
                    Automatically searches subject archives and staging directories for:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleVerifyAuto}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-[#c67139] hover:bg-[#ab5e2a] active:translate-y-0.5 active:shadow-none text-white text-xs font-bold flex items-center justify-center gap-2 border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>{loading ? "Verifying..." : "Run Auto-Detect"}</span>
                </button>
              </div>
              <div className="p-2.5 bg-[#f9f4ed] border border-[#201e1d]/40 rounded-xl font-mono text-xs flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#c67139]" />
                <span className="font-bold text-[#201e1d]">{sourceMsFilename}</span>
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.[0]) {
                    setSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 text-center transition-all ${
                  isDragging
                    ? "border-[#c67139] bg-[#ffe1d0]/30"
                    : "border-[#201e1d] bg-white hover:bg-[#fcfaf7]"
                }`}
              >
                <div className="p-3 bg-[#feebc8] border-2 border-[#201e1d] rounded-full shadow-[2px_2px_0_#201e1d]">
                  <UploadCloud className="w-6 h-6 text-[#c67139]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#201e1d]">
                    Drag &amp; drop Mark Scheme PDF here, or browse
                  </p>
                  <p className="text-[11px] text-[#645c50]">Supports Cambridge MCQ Mark Scheme PDFs</p>
                </div>
                <input
                  type="file"
                  id="ms-pdf-file-input"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                <label
                  htmlFor="ms-pdf-file-input"
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] cursor-pointer"
                >
                  Choose File
                </label>
              </div>

              {selectedFile && (
                <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex items-center justify-between gap-2 shadow-[2px_2px_0_#201e1d]">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileText className="w-4 h-4 text-[#c67139] flex-shrink-0" />
                    <span className="text-xs font-bold text-[#201e1d] truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-[#645c50] font-mono">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyUpload}
                    disabled={loading}
                    className="px-3.5 py-1.5 rounded-lg bg-[#c67139] hover:bg-[#ab5e2a] text-white text-xs font-bold border-2 border-[#201e1d] shadow-[1px_1px_0_#201e1d] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{loading ? "Verifying..." : "Verify PDF"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "paste" && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Paste Mark Scheme Text (Single or Multi-Column)
                </label>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`1 D 1\n2 B 1\n3 B 1\n... or 1 A 16 C 2 B 17 D`}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-2xl p-3 text-xs font-mono text-[#201e1d] shadow-[2px_2px_0_#201e1d] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>
              <button
                type="button"
                onClick={handleVerifyPasted}
                disabled={loading || !pastedText.trim()}
                className="self-end px-4 py-2 rounded-xl bg-[#c67139] hover:bg-[#ab5e2a] active:translate-y-0.5 active:shadow-none text-white text-xs font-bold flex items-center gap-2 border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                <span>{loading ? "Verifying..." : "Verify Text"}</span>
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3 bg-[#fee2e2] border-2 border-[#201e1d] rounded-2xl flex items-center gap-2 text-xs text-[#991b1b] font-bold shadow-[2px_2px_0_#201e1d]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {fixSuccessMessage && (
            <div className="p-3 bg-[#dcfce7] border-2 border-[#201e1d] rounded-2xl flex items-center gap-2 text-xs text-[#166534] font-bold shadow-[2px_2px_0_#201e1d]">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{fixSuccessMessage}</span>
            </div>
          )}

          {/* Verification Results Report */}
          {report && (
            <div className="flex flex-col gap-4">
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-2xl border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  report.status === "perfect_match"
                    ? "bg-[#dcfce7]"
                    : report.status === "mismatches_found"
                    ? "bg-[#fef3c7]"
                    : "bg-[#e0f2fe]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl border-2 border-[#201e1d] ${
                      report.status === "perfect_match"
                        ? "bg-[#86efac]"
                        : report.status === "mismatches_found"
                        ? "bg-[#fcd34d]"
                        : "bg-[#7dd3fc]"
                    }`}
                  >
                    {report.status === "perfect_match" ? (
                      <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[#92400e]" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-heading text-sm sm:text-base font-bold text-[#201e1d]">
                      {report.status === "perfect_match"
                        ? `${report.matchedCount} / ${report.totalQuestions} (100%) Matched`
                        : `${report.mismatchCount} Mismatch${report.mismatchCount > 1 ? "es" : ""} Detected`}
                    </h3>
                    <p className="text-xs text-[#645c50] font-medium">{report.summary}</p>
                  </div>
                </div>

                {report.mismatches.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoFixAll}
                    disabled={fixing}
                    className="px-4 py-2 rounded-xl bg-[#16a34a] hover:bg-[#15803d] active:translate-y-0.5 active:shadow-none text-white text-xs font-bold border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {fixing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>{fixing ? "Fixing..." : "Auto-Fix All Mismatches"}</span>
                  </button>
                )}
              </div>

              {/* Mismatches Detail List */}
              {report.mismatches.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-[#645c50]">
                    Question Discrepancies ({report.mismatches.length})
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    {report.mismatches.map((m) => (
                      <div
                        key={m.questionNumber}
                        className="p-3.5 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_#201e1d] flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#201e1d] text-white font-mono text-xs font-bold">
                              Q{m.questionNumber}
                            </span>
                            <span className="text-xs font-bold text-[#201e1d]">
                              {m.mismatchTypes.includes("key_mismatch")
                                ? "Answer Key Mismatch"
                                : m.mismatchTypes.includes("no_correct_option")
                                ? "Missing Answer"
                                : "Pedagogical Tagging Issue"}
                            </span>
                          </div>

                          {/* Staged vs Expected Badge */}
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                            <span
                              className="px-2 py-0.5 rounded-lg bg-[#fee2e2] text-[#991b1b] border border-[#201e1d]"
                              title="Current staged option"
                            >
                              Staged: {m.stagedKey || "None"}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#645c50]" />
                            <span
                              className="px-2 py-0.5 rounded-lg bg-[#dcfce7] text-[#166534] border border-[#201e1d]"
                              title="Official Cambridge mark scheme answer"
                            >
                              MS: {m.expectedKey}
                            </span>
                          </div>
                        </div>

                        {m.stemSnippet && (
                          <p className="text-xs text-[#645c50] line-clamp-2 italic">
                            &ldquo;{m.stemSnippet}&rdquo;
                          </p>
                        )}

                        <p className="text-[11px] text-[#201e1d] font-medium bg-[#f9f4ed] p-2 rounded-xl border border-[#201e1d]/20">
                          {m.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-[#201e1d] bg-[#f2ecdf] flex items-center justify-between">
          <div className="text-[11px] text-[#645c50] font-mono">
            {report?.sourceMsPath ? `Source: ${report.sourceMsPath.split("/").slice(-2).join("/")}` : "Cambridge Examination Suite"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
