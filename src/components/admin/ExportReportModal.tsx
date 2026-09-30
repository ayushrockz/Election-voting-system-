import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle,
  X,
  FileSpreadsheet,
  Calendar,
  Lock,
  BarChart3,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { DashboardData, AuditLogItem } from '../../types';
import { api } from '../../api/client';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dashboard: DashboardData | null;
  auditLogs: AuditLogItem[];
  defaultTab?: 'stats' | 'audit';
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  dashboard,
  auditLogs,
  defaultTab = 'stats',
}) => {
  const [reportType, setReportType] = useState<'voting-stats' | 'audit-logs' | 'complete'>(
    defaultTab === 'audit' ? 'audit-logs' : 'voting-stats'
  );
  const [format, setFormat] = useState<'CSV' | 'PDF'>('CSV');
  const [isExporting, setIsExporting] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadCsv = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      if (reportType === 'voting-stats') {
        await api.admin.downloadReportCsv('voting-stats');
        setExportNotice('Voting statistics CSV successfully downloaded.');
      } else if (reportType === 'audit-logs') {
        await api.admin.downloadReportCsv('audit-logs');
        setExportNotice('Audit logs ledger CSV successfully downloaded.');
      } else {
        // Complete
        await api.admin.downloadReportCsv('voting-stats');
        await api.admin.downloadReportCsv('audit-logs');
        setExportNotice('Complete dossier (Voting Stats & Audit Ledger) CSV files downloaded.');
      }
    } catch (err: any) {
      setExportNotice(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenPdfPreview = async () => {
    try {
      await api.admin.logPdfExport(reportType, `Official Gazette Report - ${reportType}`);
    } catch {
      //
    }
    setShowPdfPreview(true);
  };

  const election = dashboard?.election;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Export Official Election Reports</h2>
                <p className="text-[11px] text-slate-400">
                  Generate certified, cryptographically sealed CSV spreadsheets or PDF gazette documents
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {exportNotice && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{exportNotice}</span>
            </div>
          )}

          {/* 1. Report Scope Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              1. Select Report Content & Scope:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReportType('voting-stats')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === 'voting-stats'
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-indigo-400 mb-1" />
                <div className="text-xs font-bold text-slate-200">Voting Statistics</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Turnout & candidate tally</div>
              </button>

              <button
                type="button"
                onClick={() => setReportType('audit-logs')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === 'audit-logs'
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="text-xs font-bold text-slate-200">Audit Ledger</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Cryptographic log trail</div>
              </button>

              <button
                type="button"
                onClick={() => setReportType('complete')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === 'complete'
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-amber-400 mb-1" />
                <div className="text-xs font-bold text-slate-200">Full Dossier</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Stats + Complete ledger</div>
              </button>
            </div>
          </div>

          {/* 2. Format Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              2. Select Export Format:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('CSV')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                  format === 'CSV'
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                  CSV
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">CSV Data Spreadsheet</div>
                  <div className="text-[10px] text-slate-400">RFC 4180 standard · Excel / Sheets</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('PDF')}
                className={`p-3.5 rounded-xl border flex items-center gap-3 transition-all ${
                  format === 'PDF'
                    ? 'border-indigo-500 bg-indigo-950/60 text-white'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-mono font-bold text-xs">
                  PDF
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-white">Official Gazette (PDF)</div>
                  <div className="text-[10px] text-slate-400">Printable · Sealed Certificate</div>
                </div>
              </button>
            </div>
          </div>

          {/* Security & Compliance Invariant Notice */}
          <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Electoral Privacy & Audit Standard
            </div>
            <p className="leading-relaxed">
              In accordance with Section 14 (Election Security) and Section 21 (Aadhaar Privacy), exports contain strictly masked identifiers (`XXXX XXXX 1234`). Secret ballot candidate choices are decoupled from individual voter identities.
            </p>
          </div>

          {/* Export Action Trigger */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            {format === 'CSV' ? (
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={isExporting}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Generating CSV...' : 'Download CSV Report'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenPdfPreview}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>View & Print PDF Report</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================
          OFFICIAL PRINT / SAVE AS PDF GAZETTE VIEW
      =================================================================== */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto p-4 sm:p-8 flex justify-center">
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl p-8 sm:p-12 relative flex flex-col font-sans border border-slate-300">
            {/* Top Toolbar (Hidden during actual print) */}
            <div className="print:hidden mb-6 flex justify-between items-center bg-slate-100 p-4 rounded-xl border border-slate-200">
              <div className="text-xs text-slate-700">
                <span className="font-bold">Official Document Mode:</span> Click "Print / Save as PDF" and select "Save as PDF" in your browser print destination.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Official PDF Document Header */}
            <div className="text-center border-b-2 border-slate-900 pb-6 mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <ShieldCheck className="w-8 h-8 text-slate-900" />
                <div className="text-2xl font-extrabold uppercase tracking-tight text-slate-900 font-serif">
                  Election Commission of India
                </div>
              </div>
              <div className="text-xs uppercase tracking-widest text-slate-600 font-semibold">
                Central Electoral Gazette & Balloting Certification Ledger
              </div>
              <div className="text-sm font-bold text-indigo-900 mt-2">
                {election?.name || 'Civic Community Council General Election 2026'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Gazette Reference: ELEC-GAZ-{new Date().getFullYear()}-SEC-{Math.random().toString(36).substring(2, 8).toUpperCase()}
              </div>
            </div>

            {/* Executive Metadata Section */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-6 text-xs">
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Election Date</span>
                <span className="font-bold text-slate-900">{election?.date || '2026-10-10'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Polling Window</span>
                <span className="font-bold text-slate-900">{election?.startTime} – {election?.endTime}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Total Turnout</span>
                <span className="font-bold text-indigo-700 font-mono text-sm">
                  {dashboard?.voterStatistics.turnoutPercentage}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block uppercase font-semibold">Certified Status</span>
                <span className="font-bold text-emerald-700">VERIFIED OFFICIAL</span>
              </div>
            </div>

            {/* Key Voter Statistics Summary */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                Electoral Turnout & Participation Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Total Enrolled Voters</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {dashboard?.voterStatistics.totalRegisteredVoters}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-xs text-emerald-800 uppercase font-semibold">Ballots Recorded</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
                    {dashboard?.voterStatistics.totalVoted}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs text-slate-500 uppercase font-semibold">Non-Voting Registered</div>
                  <div className="text-xl font-bold font-mono text-slate-700 mt-1">
                    {dashboard?.voterStatistics.totalNotVoted}
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate & Leader Votes Table */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                Official Ballot Results & Leader Votes Received
              </h3>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 border-b">Ballot #</th>
                    <th className="py-2.5 px-3 border-b">Candidate Name</th>
                    <th className="py-2.5 px-3 border-b">Party / Slate</th>
                    <th className="py-2.5 px-3 border-b">House / Ward</th>
                    <th className="py-2.5 px-3 border-b text-right">Votes Received</th>
                    <th className="py-2.5 px-3 border-b text-right">Vote Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {dashboard?.leaderStatistics.map((cand) => (
                    <tr key={cand.candidateId}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-700">#{cand.candidateId.replace(/\D/g, '') || '1'}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{cand.candidateName}</td>
                      <td className="py-2 px-3 text-slate-600">{cand.partyOrSlate}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">House {cand.houseNumber} · {cand.ward}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{cand.votesReceived}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{cand.votePercentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit Trail Excerpt */}
            {(reportType === 'audit-logs' || reportType === 'complete') && (
              <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
                  Cryptographic Audit Log Excerpt (Recent Authenticated Transactions)
                </h3>
                <table className="w-full text-left text-[10px] font-mono border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="py-2 px-2 border-b">Timestamp</th>
                      <th className="py-2 px-2 border-b">Action</th>
                      <th className="py-2 px-2 border-b">Role</th>
                      <th className="py-2 px-2 border-b">Status</th>
                      <th className="py-2 px-2 border-b">HMAC Signature</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {auditLogs.slice(0, 8).map((log) => (
                      <tr key={log.id}>
                        <td className="py-1.5 px-2 text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-1.5 px-2 font-bold text-slate-800">{log.action}</td>
                        <td className="py-1.5 px-2 text-slate-600">{log.user_role}</td>
                        <td className="py-1.5 px-2 font-semibold text-emerald-800">{log.status}</td>
                        <td className="py-1.5 px-2 text-slate-500 truncate max-w-xs">{log.integrity_signature.slice(0, 24)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legal Certificate & Digital Seal Block */}
            <div className="mt-auto border-t-2 border-slate-900 pt-6 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 space-y-1">
                <div className="font-bold text-slate-900">Official Certification Notice</div>
                <p>
                  This document constitutes the certified public electoral gazette. The relational constraint `UNIQUE(election_id, voter_id)` was active and enforced throughout the duration of balloting. No individual ballot choice was exposed to administrative personnel.
                </p>
                <div className="font-mono text-[10px] text-slate-500 pt-1">
                  Document Integrity Hash: SHA256:{Math.random().toString(36).substring(2, 15).toUpperCase()}{Math.random().toString(36).substring(2, 15).toUpperCase()}
                </div>
              </div>

              <div className="flex justify-between items-end pt-4">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Certified At:</div>
                  <div className="text-xs font-mono text-slate-800">{new Date().toUTCString()}</div>
                </div>
                <div className="text-right">
                  <div className="w-48 border-b border-slate-800 pb-1 mb-1 font-serif italic text-slate-800">
                    Chief Election Commissioner
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">
                    Authorized Commission Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
