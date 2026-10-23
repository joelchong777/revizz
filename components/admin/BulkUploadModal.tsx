'use client';

import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, Download, Copy, Check, CheckCircle2, AlertTriangle } from 'lucide-react';
import { authFetch } from '../../lib/authFetch';
import {
  BULK_CHUNK_SIZE,
  BULK_TEMPLATE_PATH,
  validateBulkRows,
  type BulkInviteResult,
  type BulkUserRow,
} from '@/lib/bulkInvites';

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'pick' | 'preview' | 'sending' | 'results';

const csvCell = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function BulkUploadModal({ open, onClose, onComplete }: BulkUploadModalProps) {
  const [step, setStep] = useState<Step>('pick');
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof validateBulkRows> | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BulkInviteResult[]>([]);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = parsed?.rows ?? [];
  const errors = parsed?.errors ?? [];

  const counts = useMemo(() => {
    const c = { invited: 0, unsent: 0, skipped: 0, failed: 0 };
    for (const r of results) {
      if (r.status === 'invited') {
        if (r.emailSent) c.invited++;
        else c.unsent++;
      } else if (r.status === 'skipped') c.skipped++;
      else c.failed++;
    }
    return c;
  }, [results]);

  if (!open) return null;

  const reset = () => {
    setStep('pick');
    setFileError(null);
    setFileName('');
    setParsed(null);
    setProgress(0);
    setResults([]);
  };

  const handleClose = () => {
    if (step === 'sending') return;
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    setFileError(null);
    if (/\.xlsx?$/i.test(file.name)) {
      setFileError('Save the sheet as CSV (File > Save As > CSV) and upload that.');
      return;
    }
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
      setFileError('Please choose a .csv file.');
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setParsed(validateBulkRows(text));
    setStep('preview');
  };

  const handleSend = async () => {
    if (rows.length === 0) return;
    setStep('sending');
    setProgress(0);
    const all: BulkInviteResult[] = [];
    for (let i = 0; i < rows.length; i += BULK_CHUNK_SIZE) {
      const chunk: BulkUserRow[] = rows.slice(i, i + BULK_CHUNK_SIZE);
      const failChunk = (reason: string) =>
        chunk.map<BulkInviteResult>((r) => ({
          line: r.line,
          email: r.email,
          status: 'failed',
          reason,
          emailSent: false,
        }));
      try {
        const res = await authFetch('/api/admin/users/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success && Array.isArray(json.results)) {
          all.push(...(json.results as BulkInviteResult[]));
        } else {
          all.push(...failChunk(json?.error || `Request failed (HTTP ${res.status})`));
        }
      } catch (e) {
        all.push(...failChunk(e instanceof Error ? e.message : 'Network error'));
      }
      setProgress(Math.min(i + chunk.length, rows.length));
    }
    setResults(all);
    setStep('results');
  };

  const handleCopy = async (r: BulkInviteResult) => {
    if (!r.inviteLink) return;
    try {
      await navigator.clipboard.writeText(r.inviteLink);
      setCopiedLine(r.line);
      setTimeout(() => setCopiedLine(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleDownloadResults = () => {
    const lines = [
      'line,email,status,reason,inviteLink',
      ...results.map((r) =>
        [
          String(r.line),
          csvCell(r.email),
          r.status === 'invited' && !r.emailSent ? 'invited (email not sent)' : r.status,
          csvCell(r.reason || ''),
          csvCell(r.inviteLink || ''),
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-invite-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDone = () => {
    onComplete();
    reset();
    onClose();
  };

  const nonOk = results.filter((r) => r.status !== 'invited' || !r.emailSent);

  return (
    <div className="fixed inset-0 z-50 bg-[#201e1d]/50 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-[#fcfaf6] border-2 border-[#201e1d] rounded-t-3xl sm:rounded-3xl shadow-offset-3 overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#f5ead8] border-b-2 border-[#201e1d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-offset-1">
              {step === 'results' ? <CheckCircle2 className="w-5 h-5 text-[#166534]" /> : <Upload className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-black text-base text-[#201e1d]">Bulk Upload Users</h3>
              <p className="text-[11px] text-[#645c50]">Invite many students or teachers from one CSV file.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={step === 'sending'}
            aria-label="Close"
            className="p-1 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-white text-[#645c50] hover:text-[#201e1d] cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {step === 'pick' && (
            <>
              <div className="flex flex-col gap-1.5">
                <a
                  href={BULK_TEMPLATE_PATH}
                  download
                  className="self-start px-3 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#e0d6c5] flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download template</span>
                </a>
                <p className="text-xs text-[#645c50]">
                  Fill in email, full_name, role (student or teacher) and cohort. Save as CSV.
                </p>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed border-[#201e1d] p-8 text-center transition-colors ${
                  dragOver ? 'bg-[#ccdbb2]' : 'bg-white hover:bg-[#faf7f2]'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto mb-2 text-[#645c50]" />
                <p className="text-sm font-bold text-[#201e1d]">Drop a CSV here, or tap to choose a file</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              {fileError && (
                <p role="alert" className="text-xs font-bold text-[#9f1239] bg-[#fecdd3] border-2 border-[#201e1d] rounded-xl px-3 py-2">
                  {fileError}
                </p>
              )}
            </>
          )}

          {step === 'preview' && parsed && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="text-[#645c50] font-mono truncate max-w-full">{fileName}</span>
                <span className="px-2 py-1 rounded-lg border-2 border-[#201e1d] bg-[#ccdbb2] text-[#166534]">{rows.length} ready</span>
                <span className={`px-2 py-1 rounded-lg border-2 border-[#201e1d] ${errors.length ? 'bg-[#fecdd3] text-[#9f1239]' : 'bg-white text-[#645c50]'}`}>
                  {errors.length} with problems
                </span>
              </div>

              {rows.length > 0 && (
                <div className="border-2 border-[#201e1d] rounded-xl bg-white overflow-auto max-h-56">
                  <table className="w-full text-xs min-w-[460px]">
                    <thead className="bg-[#f5ead8] sticky top-0">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-[#645c50]">
                        <th className="py-1.5 px-3">Email</th>
                        <th className="py-1.5 px-3">Name</th>
                        <th className="py-1.5 px-3">Role</th>
                        <th className="py-1.5 px-3">Cohort</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#201e1d]/10">
                      {rows.map((r) => (
                        <tr key={r.line}>
                          <td className="py-1.5 px-3 font-mono">{r.email}</td>
                          <td className="py-1.5 px-3">{r.fullName || '-'}</td>
                          <td className="py-1.5 px-3">{r.role}</td>
                          <td className="py-1.5 px-3">{r.cohort}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {errors.length > 0 && (
                <ul className="border-2 border-[#201e1d] rounded-xl bg-[#fff1f2] max-h-40 overflow-auto divide-y divide-[#201e1d]/10 text-xs">
                  {errors.map((er, i) => (
                    <li key={`${er.line}-${i}`} className="px-3 py-1.5 text-[#9f1239] flex gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        Row {er.line}: {er.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-[#645c50]">
                Each person gets a draft account and an email invite. They set their own password the first time they sign in.
              </p>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 cursor-pointer"
                >
                  Choose another file
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={rows.length === 0}
                  className="px-4 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-heading font-black text-xs shadow-offset-1 hover:bg-[#b8c99d] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send {rows.length} invite{rows.length === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}

          {step === 'sending' && (
            <div className="py-6 space-y-3">
              <p className="text-sm font-bold text-[#201e1d]">
                Sending {progress} / {rows.length}
              </p>
              <div className="h-4 rounded-full border-2 border-[#201e1d] bg-white overflow-hidden">
                <div
                  className="h-full bg-[#ccdbb2] transition-all duration-300"
                  style={{ width: `${rows.length ? (progress / rows.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-[#645c50]">Keep this window open until it finishes.</p>
            </div>
          )}

          {step === 'results' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Invited', n: counts.invited, bg: 'bg-[#ccdbb2]' },
                  { label: 'Emails not sent', n: counts.unsent, bg: 'bg-[#fef08a]' },
                  { label: 'Skipped', n: counts.skipped, bg: 'bg-[#eee7db]' },
                  { label: 'Failed', n: counts.failed, bg: 'bg-[#fecdd3]' },
                ].map((c) => (
                  <div key={c.label} className={`${c.bg} border-2 border-[#201e1d] rounded-xl py-2 shadow-offset-1`}>
                    <div className="font-heading font-black text-lg text-[#201e1d]">{c.n}</div>
                    <div className="text-[10px] font-bold text-[#645c50]">{c.label}</div>
                  </div>
                ))}
              </div>

              {nonOk.length > 0 && (
                <ul className="border-2 border-[#201e1d] rounded-xl bg-white max-h-56 overflow-auto divide-y divide-[#201e1d]/10 text-xs">
                  {nonOk.map((r) => (
                    <li key={`${r.line}-${r.email}`} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <span className="min-w-0">
                        <span className="font-mono break-all">Row {r.line}: {r.email}</span>
                        <span className="block text-[#645c50]">
                          {r.status === 'invited' ? 'Email not sent' : r.status === 'skipped' ? 'Skipped' : 'Failed'}
                          {r.reason ? `: ${r.reason}` : ''}
                        </span>
                      </span>
                      {!r.emailSent && r.inviteLink && (
                        <button
                          type="button"
                          onClick={() => handleCopy(r)}
                          className="self-start sm:self-auto shrink-0 px-2.5 py-1 rounded-lg bg-[#eee7db] border-2 border-[#201e1d] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          {copiedLine === r.line ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copiedLine === r.line ? 'Copied' : 'Copy invite link'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDownloadResults}
                  className="px-4 py-2 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download results CSV
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-4 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-heading font-black text-xs shadow-offset-1 hover:bg-[#b8c99d] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default BulkUploadModal;
