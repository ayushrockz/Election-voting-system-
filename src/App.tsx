import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DeviceFrame } from './components/common/DeviceFrame';
import { ForcePasswordChangeModal } from './components/auth/ForcePasswordChangeModal';
import { EmailOutboxModal } from './components/common/EmailOutboxModal';
import { AdminPortal } from './components/admin/AdminPortal';
import { VoterApp } from './components/voter/VoterApp';
import { LeaderApp } from './components/leader/LeaderApp';
import { DeviceType } from './types';
import { api } from './api/client';
import {
  ShieldCheck,
  Vote,
  UserCheck,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  KeyRound,
  FileCheck,
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, role, login, isLoading, quickSwitch } = useAuth();
  const [deviceType, setDeviceType] = useState<DeviceType>('RESPONSIVE');
  const [showOutbox, setShowOutbox] = useState<boolean>(false);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [activeElectionStatus, setActiveElectionStatus] = useState<string>('ACTIVE');

  // Login form state
  const [loginTab, setLoginTab] = useState<'ADMIN' | 'LEADER' | 'VOTER'>('ADMIN');
  const [identifier, setIdentifier] = useState('admin@election.gov.in');
  const [password, setPassword] = useState('AdminPassword@2026');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submittingLogin, setSubmittingLogin] = useState(false);

  // Poll outbox count and election status
  const refreshStatus = async () => {
    try {
      const elecRes = await api.elections.getActive();
      if (elecRes.election) {
        setActiveElectionStatus(elecRes.election.status);
      }
      const outboxRes = await api.admin.getOutbox();
      setOutboxCount(outboxRes.outbox.length);
    } catch {
      //
    }
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (targetTab: 'ADMIN' | 'LEADER' | 'VOTER') => {
    setLoginTab(targetTab);
    setLoginError(null);
    if (targetTab === 'ADMIN') {
      setIdentifier('admin@election.gov.in');
      setPassword('AdminPassword@2026');
      setDeviceType('RESPONSIVE');
    } else if (targetTab === 'LEADER') {
      setIdentifier('ananya.sharma@council.org');
      setPassword('LeaderPassword@2026');
      setDeviceType('IOS');
    } else {
      setIdentifier('aarav.voter@gmail.com');
      setPassword('Voter@102A');
      setDeviceType('IOS');
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmittingLogin(true);
    try {
      await login(identifier, password, loginTab);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmittingLogin(false);
    }
  };

  const handleToggleElectionStatus = async (mode: 'AUTO' | 'FORCE_ACTIVE' | 'FORCE_UPCOMING' | 'FORCE_COMPLETED') => {
    try {
      const active = await api.elections.getActive();
      if (active.election) {
        await api.admin.updateElection(active.election.id, { timeOverrideMode: mode });
        refreshStatus();
      }
    } catch (err: any) {
      console.error('Failed to override status', err);
    }
  };

  // If user is not authenticated, render the Secure Login Portal
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Secure Election Portal
            </h1>
            <p className="text-xs text-slate-400">
              Role-Based Access Control · Aadhaar Encryption · Single-Vote Relational Protection
            </p>
          </div>

          {/* Role selector tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleTabChange('ADMIN')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginTab === 'ADMIN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
            <button
              onClick={() => handleTabChange('LEADER')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginTab === 'LEADER'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Leader</span>
            </button>
            <button
              onClick={() => handleTabChange('VOTER')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                loginTab === 'VOTER'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Vote className="w-3.5 h-3.5" />
              <span>Voter</span>
            </button>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {loginTab === 'VOTER'
                  ? 'Voter ID / Registered Mobile / Email'
                  : loginTab === 'LEADER'
                  ? 'Leader Login ID or Email'
                  : 'Admin Email or Username'}
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter credentials"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <span className="text-[11px] text-indigo-400 hover:underline cursor-pointer">
                  Forgot Password?
                </span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submittingLogin}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <span>{submittingLogin ? 'Authenticating...' : `Sign In as ${loginTab}`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credential Buttons */}
          <div className="border-t border-slate-800 pt-4">
            <span className="text-[11px] text-slate-400 block mb-2 font-medium">
              1-Click Fast Demonstration Profiles:
            </span>
            <div className="flex flex-col gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => quickSwitch('ADMIN')}
                className="text-left p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex justify-between items-center text-slate-300"
              >
                <span>👑 Super Admin Dashboard</span>
                <code className="text-[10px] text-indigo-400 font-mono">admin@election.gov.in</code>
              </button>
              <button
                type="button"
                onClick={() => quickSwitch('LEADER')}
                className="text-left p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex justify-between items-center text-slate-300"
              >
                <span>🏛️ Leader Ananya Sharma</span>
                <code className="text-[10px] text-amber-400 font-mono">ananya.sharma@council.org</code>
              </button>
              <button
                type="button"
                onClick={() => quickSwitch('VOTER')}
                className="text-left p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 flex justify-between items-center text-slate-300"
              >
                <span>🗳️ Voter Aarav Gupta (House 102)</span>
                <code className="text-[10px] text-emerald-400 font-mono">HOUSE-102-001</code>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DeviceFrame
      deviceType={deviceType}
      onDeviceChange={setDeviceType}
      onOpenOutbox={() => setShowOutbox(true)}
      outboxCount={outboxCount}
      activeElectionStatus={activeElectionStatus}
      onToggleElectionStatus={handleToggleElectionStatus}
    >
      {/* First-time login mandatory password update modal */}
      <ForcePasswordChangeModal />

      {/* Dispatched notification emails viewer modal */}
      <EmailOutboxModal isOpen={showOutbox} onClose={() => setShowOutbox(false)} />

      {/* Role-Specific View */}
      {role === 'ADMIN' && <AdminPortal />}
      {role === 'LEADER' && <LeaderApp />}
      {role === 'VOTER' && <VoterApp />}
    </DeviceFrame>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
