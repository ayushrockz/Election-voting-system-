import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Mail,
  ShieldCheck,
  UserCheck,
  Vote,
  Clock,
  RotateCw,
  LogOut,
  Wifi,
  BatteryCharging,
  Signal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DeviceType, UserRole } from '../../types';

interface DeviceFrameProps {
  deviceType: DeviceType;
  onDeviceChange: (type: DeviceType) => void;
  onOpenOutbox: () => void;
  outboxCount: number;
  activeElectionStatus?: string;
  onToggleElectionStatus?: (mode: 'AUTO' | 'FORCE_ACTIVE' | 'FORCE_UPCOMING' | 'FORCE_COMPLETED') => void;
  children: React.ReactNode;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  deviceType,
  onDeviceChange,
  onOpenOutbox,
  outboxCount,
  activeElectionStatus,
  onToggleElectionStatus,
  children,
}) => {
  const { user, role, logout, quickSwitch } = useAuth();
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState('09:41');

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
      {/* Top Universal Control Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-600/30">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
              Secure Election OS
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-1.5 py-0.2 rounded">
                v2.6 Cloud
              </span>
            </div>
          </div>
        </div>

        {/* Viewport / Device Switcher */}
        <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
          <button
            onClick={() => onDeviceChange('IOS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              deviceType === 'IOS'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Simulate iPhone 16 Pro Viewport"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>iPhone 16</span>
          </button>
          <button
            onClick={() => onDeviceChange('ANDROID')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              deviceType === 'ANDROID'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Simulate Android Material 3 Viewport"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Android Pixel</span>
          </button>
          <button
            onClick={() => onDeviceChange('RESPONSIVE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              deviceType === 'RESPONSIVE'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Full Screen / Tablet Console"
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Full Display</span>
          </button>
        </div>

        {/* Election Simulator Controls */}
        {onToggleElectionStatus && (
          <div className="hidden lg:flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              State:
            </span>
            <button
              onClick={() => onToggleElectionStatus('FORCE_ACTIVE')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeElectionStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Live Active
            </button>
            <button
              onClick={() => onToggleElectionStatus('FORCE_UPCOMING')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeElectionStatus === 'UPCOMING'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => onToggleElectionStatus('FORCE_COMPLETED')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeElectionStatus === 'COMPLETED'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed
            </button>
          </div>
        )}

        {/* User Role Quick Switcher & Outbox Drawer Trigger */}
        <div className="flex items-center gap-2">
          {/* Outbox Notifications Button */}
          <button
            onClick={onOpenOutbox}
            className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 flex items-center gap-1.5 text-xs font-medium"
            title="View Dispatched Notification Emails (Credentials & Receipts)"
          >
            <Mail className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Mail Outbox</span>
            {outboxCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500 text-white">
                {outboxCount}
              </span>
            )}
          </button>

          {/* Quick Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/70 border border-indigo-700/60 hover:border-indigo-500 text-indigo-200 text-xs font-medium transition-all"
            >
              {role === 'ADMIN' && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
              {role === 'LEADER' && <UserCheck className="w-3.5 h-3.5 text-amber-400" />}
              {role === 'VOTER' && <Vote className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="font-semibold">
                {role === 'ADMIN' ? 'Admin Portal' : role === 'LEADER' ? 'Leader Mode' : 'Voter Mode'}
              </span>
              <span className="text-[10px] text-indigo-400">▼</span>
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl p-1.5 z-50">
                <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Switch Active Role Test
                </div>
                <button
                  onClick={() => {
                    quickSwitch('ADMIN');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors ${
                    role === 'ADMIN' ? 'bg-indigo-600/30 text-indigo-200 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <div>
                    <div>Super Admin / Commissioner</div>
                    <div className="text-[10px] text-slate-500">Full control & telemetry</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    quickSwitch('LEADER');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors ${
                    role === 'LEADER' ? 'bg-amber-600/30 text-amber-200 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <div>
                    <div>Leader (Ananya Sharma)</div>
                    <div className="text-[10px] text-slate-500">Ward 1 candidate profile</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    quickSwitch('VOTER');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2.5 transition-colors ${
                    role === 'VOTER' ? 'bg-emerald-600/30 text-emerald-200 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Vote className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div>Voter (Aarav Gupta)</div>
                    <div className="text-[10px] text-slate-500">House 102 · Cast vote</div>
                  </div>
                </button>
                <div className="border-t border-slate-800 my-1"></div>
                <button
                  onClick={() => {
                    logout();
                    setShowRoleMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 text-rose-400 hover:bg-rose-950/40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out of Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        {deviceType === 'RESPONSIVE' ? (
          <div className="w-full max-w-7xl h-full min-h-[85vh]">{children}</div>
        ) : deviceType === 'IOS' ? (
          /* Realistic iPhone 16 Pro Frame */
          <div className="relative w-[393px] h-[852px] bg-slate-950 rounded-[54px] shadow-2xl p-3 border-[5px] border-slate-800 ring-1 ring-slate-700/60 flex flex-col shrink-0 select-none overflow-hidden">
            {/* Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-40 flex items-center justify-between px-2.5 text-[9px] text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700"></span>
              <span className="w-2 h-2 rounded-full bg-indigo-500/80 animate-pulse"></span>
            </div>

            {/* iOS Status Bar */}
            <div className="h-10 pt-2 px-6 flex items-center justify-between text-xs font-semibold text-slate-300 z-30 select-none">
              <span>{currentTime}</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            {/* iOS App Screen */}
            <div className="flex-1 bg-slate-900 rounded-[44px] overflow-y-auto relative flex flex-col text-slate-100">
              {children}
            </div>

            {/* iOS Home Indicator Bar */}
            <div className="h-5 flex items-center justify-center pt-1 z-30">
              <div className="w-36 h-1 bg-slate-500/50 rounded-full"></div>
            </div>
          </div>
        ) : (
          /* Realistic Android Material 3 Frame */
          <div className="relative w-[412px] h-[860px] bg-slate-950 rounded-[40px] shadow-2xl p-3 border-[5px] border-slate-800 ring-1 ring-slate-700/60 flex flex-col shrink-0 select-none overflow-hidden">
            {/* Android Punch-hole Camera */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-40 border border-slate-800"></div>

            {/* Android Status Bar */}
            <div className="h-8 pt-1 px-5 flex items-center justify-between text-xs text-slate-400 z-30 font-mono">
              <span className="font-sans font-medium text-slate-300">{currentTime}</span>
              <div className="flex items-center gap-2">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <span className="text-[11px] font-bold text-slate-300">89%</span>
              </div>
            </div>

            {/* Android App Screen */}
            <div className="flex-1 bg-slate-900 rounded-[30px] overflow-y-auto relative flex flex-col text-slate-100">
              {children}
            </div>

            {/* Android Gesture Bar */}
            <div className="h-5 flex items-center justify-center pt-1 z-30">
              <div className="w-24 h-1 bg-slate-600 rounded-full"></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
