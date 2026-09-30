import React, { useState, useEffect } from 'react';
import {
  Vote,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  MapPin,
  ChevronRight,
  Printer,
  Sparkles,
  Lock,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { CandidateItem, ElectionInfo, VoteReceipt } from '../../types';

export const VoterApp: React.FC = () => {
  const { user } = useAuth();
  const [election, setElection] = useState<ElectionInfo | null>(null);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [voteReceipt, setVoteReceipt] = useState<{
    reference: string;
    votedAt: string;
    electionName: string;
  } | null>(null);

  // Voting flow state
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string>('00 Days 00 Hours 00 Mins 00 Secs');

  // Load election data & candidate ballot
  const loadData = async () => {
    try {
      const elecRes = await api.elections.getActive();
      setElection(elecRes.election);

      if (elecRes.election) {
        const candRes = await api.elections.getCandidates(elecRes.election.id);
        setCandidates(candRes.candidates);

        // Check if voter already cast ballot
        const statusRes = await api.elections.getVotingStatus();
        if (statusRes.hasVoted) {
          setHasVoted(true);
          setVoteReceipt({
            reference: statusRes.transactionReference || 'VOTE-REF-REGISTERED',
            votedAt: statusRes.votedAt || new Date().toISOString(),
            electionName: statusRes.electionName || elecRes.election.name,
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to load voter data', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer logic
  useEffect(() => {
    if (!election) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      let targetTime = new Date(election.startDatetime).getTime();

      if (election.status === 'ACTIVE') {
        targetTime = new Date(election.endDatetime).getTime();
      }

      const diff = targetTime - now;

      if (diff <= 0 || isNaN(diff)) {
        setCountdown('00 Days 00 Hours 00 Mins 00 Secs');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${String(days).padStart(2, '0')} Days ${String(hours).padStart(2, '0')} Hours ${String(
          minutes
        ).padStart(2, '0')} Minutes ${String(seconds).padStart(2, '0')} Seconds`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [election]);

  const handleSelectCandidate = (candidate: CandidateItem) => {
    if (hasVoted) return;
    setSelectedCandidate(candidate);
    setShowConfirmModal(true);
    setSubmitError(null);
  };

  const handleConfirmVote = async () => {
    if (!selectedCandidate || !election) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res: VoteReceipt = await api.elections.vote(election.id, selectedCandidate.id);
      setHasVoted(true);
      setVoteReceipt({
        reference: res.transactionReference,
        votedAt: res.votedAt,
        electionName: res.electionName || election.name,
      });
      setShowConfirmModal(false);
      setSelectedCandidate(null);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit vote.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-full">
      {/* Mobile Top App Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Vote className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>National Voter Portal</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-[10px] text-slate-400">
              Voter ID: <span className="font-mono text-indigo-300 font-semibold">{user?.voterId || user?.voterRecord?.voter_id || 'HOUSE-102-001'}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-medium text-slate-200">{user?.name}</div>
          <div className="text-[10px] text-slate-400">
            {user?.voterRecord?.house_number ? `House ${user.voterRecord.house_number} · ${user.voterRecord.ward}` : 'Ward 1 · Verified'}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 p-4 space-y-4 pb-20">
        {/* Prominent Election Status & Countdown Banner */}
        <div className="rounded-2xl p-4 bg-slate-800/80 border border-slate-700/80 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              {election?.name || 'Local Community Election 2026'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {election?.date ? new Date(election.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '10 Oct 2026'}
            </span>
          </div>

          {/* Conditional Countdown Display */}
          {election?.status === 'UPCOMING' ? (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Election starts in
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-white tracking-tight bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-700 text-center">
                {countdown}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Voting hours: {election.startTime} – {election.endTime}
              </p>
            </div>
          ) : election?.status === 'ACTIVE' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-sm font-bold text-emerald-400">Voting is LIVE</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Closes at {election.endTime}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Polls are currently open. Please review candidate credentials below and cast your secret ballot.
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-center py-1">
              <div className="text-sm font-bold text-slate-300">Voting has ended</div>
              <p className="text-xs text-slate-400">
                Polls closed at {election?.endTime || '06:00 PM'}. Official tally calculations are underway by the commission.
              </p>
            </div>
          )}
        </div>

        {/* POST-VOTE SUCCESS RECEIPT / ALREADY VOTED STATE */}
        {hasVoted && voteReceipt ? (
          <div className="rounded-2xl p-5 bg-gradient-to-b from-emerald-950/60 to-slate-900 border border-emerald-500/40 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Vote Successfully Submitted</h3>
                <p className="text-xs text-emerald-300 font-mono">Status: Sealed & Cryptographically Verified</p>
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Election:</span>
                <span className="font-semibold text-white">{voteReceipt.electionName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Voter ID:</span>
                <span className="font-mono text-indigo-300 font-semibold">{user?.voterId || 'HOUSE-102-001'}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">Transaction Reference:</span>
                <span className="font-mono text-emerald-400 font-bold tracking-wider">{voteReceipt.reference}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Recorded Timestamp:</span>
                <span className="text-slate-300 font-mono text-[11px]">
                  {new Date(voteReceipt.votedAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Single-Vote Guarantee:</strong> In accordance with electoral law, you have already voted in this election. Further voting attempts are strictly locked.
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Ballot Receipt</span>
              </button>
            </div>
          </div>
        ) : (
          /* ACTIVE VOTING BALLOT LIST */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Official Ballot: Candidate Nominations
              </h2>
              <span className="text-[11px] text-slate-400">
                {candidates.length} Registered Leaders
              </span>
            </div>

            {election?.status !== 'ACTIVE' ? (
              <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 text-center space-y-2">
                <Lock className="w-8 h-8 text-slate-500 mx-auto" />
                <div className="text-sm font-semibold text-slate-300">«Voting has not started yet.»</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Voting will automatically unlock once the configured election start window arrives. You may review the candidates below.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-300">
                «Select your preferred candidate/leader to cast your secret ballot.»
              </p>
            )}

            {/* Candidate Cards Grid */}
            <div className="space-y-3">
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm hover:border-slate-600 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Candidate Photo */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-700 border border-slate-600 shrink-0">
                      <img
                        src={cand.photo}
                        alt={cand.candidateName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback container
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white truncate">
                          {cand.candidateName}
                        </h3>
                        <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/70 border border-indigo-800 px-1.5 py-0.2 rounded">
                          Ballot #{cand.ballotNumber}
                        </span>
                      </div>
                      <div className="text-xs text-indigo-300 font-medium mt-0.5">
                        {cand.partyOrSlate}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          House {cand.houseNumber} · {cand.ward}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Manifesto */}
                  <div className="bg-slate-900/60 rounded-xl p-2.5 text-[11px] text-slate-300 leading-relaxed border border-slate-800">
                    <span className="font-semibold text-slate-400">Platform: </span>
                    {cand.manifesto}
                  </div>

                  {/* Vote Action Button */}
                  <button
                    onClick={() => handleSelectCandidate(cand)}
                    disabled={election?.status !== 'ACTIVE' || hasVoted}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      hasVoted
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : election?.status === 'ACTIVE'
                        ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Vote className="w-4 h-4" />
                    <span>{hasVoted ? 'Ballot Already Cast' : `Vote for ${cand.candidateName}`}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* VOTE CONFIRMATION MODAL / BOTTOM SHEET */}
      {showConfirmModal && selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Grab handle for mobile */}
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden -mt-2 mb-2"></div>

            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-white">Confirm Your Vote</h2>
              <p className="text-xs text-slate-400">Official Democratic Balloting Verification</p>
            </div>

            {/* Candidate Card Summary */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-700 shrink-0">
                <img
                  src={selectedCandidate.photo}
                  alt={selectedCandidate.candidateName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-xs text-indigo-400 font-mono">Ballot #{selectedCandidate.ballotNumber}</div>
                <div className="text-sm font-bold text-white truncate">{selectedCandidate.candidateName}</div>
                <div className="text-xs text-slate-300">{selectedCandidate.partyOrSlate}</div>
              </div>
            </div>

            {/* Mandatory Warning as specified in Rule 12 */}
            <div className="p-3.5 bg-amber-950/60 border border-amber-700/80 rounded-xl text-xs text-amber-200 flex items-start gap-2.5 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                «Please verify your selection before submitting. Your vote cannot be changed after submission.»
              </p>
            </div>

            {submitError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVote}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <Vote className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording Ballot...' : 'Confirm Vote'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
