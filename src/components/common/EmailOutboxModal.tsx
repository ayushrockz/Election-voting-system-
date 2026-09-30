import React, { useState, useEffect } from 'react';
import { Mail, X, CheckCircle, Clock, Key, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { EmailOutboxItem } from '../../types';
import { api } from '../../api/client';

interface EmailOutboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailOutboxModal: React.FC<EmailOutboxModalProps> = ({ isOpen, onClose }) => {
  const [emails, setEmails] = useState<EmailOutboxItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailOutboxItem | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOutbox = async () => {
    setLoading(true);
    try {
      const res = await api.admin.getOutbox();
      setEmails(res.outbox);
      if (res.outbox.length > 0 && !selectedEmail) {
        setSelectedEmail(res.outbox[0]);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutbox();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Election Mail Outbox Dispatcher
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.2 rounded">
                  {emails.length} Dispatched
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Audited transactional emails: Welcome credentials, Temporary passwords, Activation links, & Vote receipts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOutbox}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
              title="Refresh Outbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split List & Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Email List */}
          <div className="w-2/5 border-r border-slate-800 bg-slate-900/60 overflow-y-auto">
            {emails.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No emails dispatched yet. Create a voter or leader or cast a vote to generate notifications.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {emails.map((mail) => (
                  <button
                    key={mail.id}
                    onClick={() => setSelectedEmail(mail)}
                    className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1 ${
                      selectedEmail?.id === mail.id
                        ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-200 truncate">{mail.recipientName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(mail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-indigo-300 font-medium truncate">{mail.subject}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1">
                      {mail.templateType === 'ACCOUNT_CREATION' && (
                        <span className="bg-amber-950 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded font-mono">
                          Credentials & Pass
                        </span>
                      )}
                      {mail.templateType === 'VOTE_CONFIRMATION' && (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono">
                          Receipt
                        </span>
                      )}
                      <span className="text-slate-500 truncate">{mail.recipientEmail}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Email Preview */}
          <div className="w-3/5 bg-slate-950 overflow-y-auto p-5 flex flex-col">
            {selectedEmail ? (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Subject:</span>
                    <span className="font-bold text-slate-100">{selectedEmail.subject}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">To:</span>
                    <span className="text-indigo-300 font-medium">
                      {selectedEmail.recipientName} &lt;{selectedEmail.recipientEmail}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Timestamp:</span>
                    <span className="text-slate-300 font-mono text-[11px]">
                      {new Date(selectedEmail.sentAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Template:</span>
                    <span className="text-emerald-400 font-mono text-[11px]">{selectedEmail.templateType}</span>
                  </div>
                </div>

                {/* Rendered HTML Container */}
                <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner bg-slate-900 p-2">
                  <div
                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Select an email from the left column to view its cryptographic contents.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
