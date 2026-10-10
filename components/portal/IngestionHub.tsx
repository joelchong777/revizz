"use client";

import React, { useState, useEffect, useRef } from "react";
import { StagingPaper, StagingQuestion, validateStagingPaper } from "@/types/ingestion";
import IngestionQuestionNav from "./IngestionQuestionNav";
import IngestionQuestionEditor from "./IngestionQuestionEditor";

type TabMode = "studio" | "sql" | "json";
type PublishStatus = "idle" | "validating" | "publishing" | "success" | "error";

export default function IngestionHub() {
  const [paper, setPaper] = useState<StagingPaper | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<TabMode>("studio");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishMessage, setPublishMessage] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const questions = paper?.questions || [];
  const syllabusTopics = paper?.syllabus_topics || [];

  useEffect(() => {
    // Initial fetch
    fetch("/api/ingest/staged-paper?id=0455_s24_12")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load preset");
        return res.json();
      })
      .then((data) => {
        const paperData = data?.paper || data;
        setPaper(paperData);
      })
      .catch((err) => {
        console.error(err);
        setPaper({
          subject: { code: "0455", name: "Economics", icon: "📈" },
          paper: { series: "s", paper_code: "12", year: 2024 },
          syllabus_topics: [],
          questions: [],
        });
      });
  }, []);

  const handleLoadPreset = () => {
    fetch("/api/ingest/staged-paper?id=0455_s24_12")
      .then((res) => res.json())
      .then((data) => {
        const paperData = data?.paper || data;
        setPaper(paperData);
      })
      .catch(console.error);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const paperData = json?.paper || json;
        setPaper(paperData);
      } catch (err) {
        console.error("Failed to parse JSON", err);
      }
    };
    reader.readAsText(file);
  };

  const validateSchema = () => {
    if (!paper) return;
    const result = validateStagingPaper(paper);
    if (result.success) {
      alert("Validation successful!");
    } else {
      alert("Validation errors:\\n" + result.errors?.join("\\n"));
    }
  };

  const generateSQL = () => {
    if (!paper) return "";
    let sql = `-- Batch SQL for ${paper.subject?.code || ""} ${paper.paper?.series || ""}${paper.paper?.year || ""} ${paper.paper?.paper_code || ""}\\n\\n`;
    (paper.questions || []).forEach((q) => {
      sql += `INSERT INTO questions (question_number, stem) VALUES (${q.question_number}, $stem_${q.question_number}$${q.stem_markdown}$stem_${q.question_number}$);\\n`;
    });
    return sql;
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!paper) return;
    const result = validateStagingPaper(paper);
    if (!result.success) {
      alert("Fix validation errors before exporting:\\n" + result.errors?.join("\\n"));
      return;
    }
    downloadFile(JSON.stringify(paper, null, 2), "paper.json", "application/json");
  };

  const handleExportSQL = () => {
    downloadFile(generateSQL(), "batch.sql", "text/plain");
  };

  const handlePushLive = async () => {
    if (!paper) return;
    setPublishStatus("validating");
    const result = validateStagingPaper(paper);
    if (!result.success) {
      setPublishStatus("error");
      setPublishMessage(result.errors?.join(", ") || "Validation failed");
      return;
    }

    setPublishStatus("publishing");
    try {
      const res = await fetch("/api/ingest/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paper),
      });
      if (!res.ok) throw new Error("Publish failed");
      setPublishStatus("success");
      setPublishMessage("Successfully published!");
    } catch (err: any) {
      setPublishStatus("error");
      setPublishMessage(err.message || "Unknown error");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5ead8] font-body p-8 flex flex-col gap-6">
      {/* Top Header */}
      <header className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] shadow-offset-4 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="font-heading text-2xl text-[#201e1d]">Ingestion Hub</h1>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-full text-sm font-bold text-[#c67139]">Economics 0455</span>
            <span className="px-3 py-1 bg-[#f0fae1] border-2 border-[#201e1d] rounded-full text-sm font-bold text-[#8fa073]">s24</span>
            <span className="px-3 py-1 bg-[#ffc6a5] border-2 border-[#201e1d] rounded-full text-sm font-bold text-[#201e1d]">12</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleLoadPreset}
            className="px-4 py-2 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d] transition-all"
          >
            Load Preset
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-[#ccdbb2] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d] transition-all"
          >
            Upload JSON
          </button>
          <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col gap-6">
        {/* Tabs & Action Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] shadow-offset-4 p-4">
          <div className="flex gap-2">
            {(["studio", "sql", "json"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 border-2 border-[#201e1d] rounded-xl font-bold transition-all shadow-offset-2 active:translate-y-0.5 active:shadow-none uppercase ${
                  activeTab === tab ? "bg-[#c67139] text-white" : "bg-white text-[#201e1d]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={validateSchema} className="px-4 py-2 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d]">Validate Schema</button>
            <button onClick={handleExportJSON} className="px-4 py-2 bg-[#f0fae1] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d]">Export JSON</button>
            <button onClick={handleExportSQL} className="px-4 py-2 bg-[#ccdbb2] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d]">Export Batch SQL</button>
            <button onClick={handlePushLive} className="px-4 py-2 bg-[#8fa073] text-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold">Push to Supabase Live</button>
            <button onClick={() => window.open('/play', '_blank')} className="px-4 py-2 bg-[#ffc6a5] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d]">Test in Game</button>
          </div>
        </div>

        {/* Publish Status Feedback */}
        {publishStatus !== "idle" && (
          <div className={`p-4 border-2 border-[#201e1d] rounded-xl font-bold ${
            publishStatus === 'validating' || publishStatus === 'publishing' ? 'bg-[#ffe1d0] text-[#c67139]' :
            publishStatus === 'success' ? 'bg-[#f0fae1] text-[#8fa073]' : 'bg-[#ffc6a5] text-red-600'
          }`}>
            Status: {publishStatus.toUpperCase()} {publishMessage && `- ${publishMessage}`}
          </div>
        )}

        {/* Workspace Area */}
        <div className="flex-1 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] shadow-offset-4 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          {activeTab === "studio" && paper && (
            <>
              <div className="w-full md:w-1/3 xl:w-1/4 border-b-2 md:border-b-0 md:border-r-2 border-[#201e1d] p-4 bg-[#f9f4ed] overflow-y-auto">
                <IngestionQuestionNav
                  questions={questions}
                  selectedIdx={selectedIdx}
                  onSelectIdx={setSelectedIdx}
                  expectedCount={questions.length || 30}
                  syllabusTopics={syllabusTopics}
                />
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-[#f9f4ed]">
                {questions[selectedIdx] ? (
                  <IngestionQuestionEditor
                    question={questions[selectedIdx]}
                    questionIndex={selectedIdx}
                    totalQuestions={questions.length}
                    syllabusTopics={syllabusTopics}
                    onChange={(newQ: StagingQuestion) => {
                      const newQuestions = [...questions];
                      newQuestions[selectedIdx] = newQ;
                      setPaper({ ...paper, questions: newQuestions });
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[#8fa073] font-bold">Select a question or add one</div>
                )}
              </div>
            </>
          )}

          {activeTab === "sql" && (
            <div className="p-6 flex-1 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="font-heading text-xl">Batch SQL Preview</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(generateSQL())} className="px-3 py-1 bg-white border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 font-bold text-sm">Copy SQL</button>
                </div>
              </div>
              <textarea
                readOnly
                value={generateSQL()}
                className="w-full flex-1 p-4 bg-black text-[#ccdbb2] font-mono text-sm border-2 border-[#201e1d] rounded-xl focus:outline-none"
              />
            </div>
          )}

          {activeTab === "json" && (
            <div className="p-6 flex-1 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="font-heading text-xl">Raw JSON</h2>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard.writeText(JSON.stringify(paper, null, 2))} className="px-3 py-1 bg-white border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 font-bold text-sm">Copy JSON</button>
                </div>
              </div>
              <textarea
                readOnly
                value={JSON.stringify(paper, null, 2)}
                className="w-full flex-1 p-4 bg-black text-[#ffe1d0] font-mono text-sm border-2 border-[#201e1d] rounded-xl focus:outline-none"
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
