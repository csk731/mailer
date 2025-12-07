"use client";

import React, { useState, useEffect } from "react";
import { TableEditor } from "@/components/TableEditor";
import { EmailComposer } from "@/components/EmailComposer";
import { EmailPreview } from "@/components/EmailPreview";
import { Mail, Send, CheckCircle, AlertCircle, Loader2, Key, ChevronRight, Sparkles, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailCampaign } from "@/hooks/useEmailCampaign";
import { toast } from "sonner";
import { validateCampaign } from "@/lib/validators";

import { useAuth } from "@/context/AuthContext";

declare global {
  interface Window {
    google: any;
  }
}

export default function Home() {
  const { token, user, logout, checkTokenValidity } = useAuth();
  const { sending, progress, logs, sendCampaign, resetCampaign } = useEmailCampaign();
  
  /* Flow Management: 1=Compose, 2=Review */
  const [activeStep, setActiveStep] = useState(1);
  const [validating, setValidating] = useState(false);

  /* Data & Editor State */
  const [columns, setColumns] = useState<string[]>(["NAME", "EMAIL"]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [isRestored, setIsRestored] = useState(false);

  // Restore Form State (Scoped)
  useEffect(() => {
    if (!user?.email) return;

    try {
        const savedColumns = localStorage.getItem(`draft_columns_${user.email}`);
        const savedData = localStorage.getItem(`draft_data_${user.email}`);
        const savedSubject = localStorage.getItem(`draft_subject_${user.email}`);
        const savedBody = localStorage.getItem(`draft_body_${user.email}`);

        if (savedColumns) setColumns(JSON.parse(savedColumns));
        if (savedData) setData(JSON.parse(savedData));
        if (savedSubject) setSubject(savedSubject);
        if (savedBody) setBody(savedBody);
    } catch (err) {
        console.error("Failed to restore draft", err);
    } finally {
        setIsRestored(true);
    }
  }, [user]);

  // Save Form State (Scoped)
  useEffect(() => {
    if (!user?.email || !isRestored) return;

    try {
        localStorage.setItem(`draft_columns_${user.email}`, JSON.stringify(columns));
        localStorage.setItem(`draft_data_${user.email}`, JSON.stringify(data));
        localStorage.setItem(`draft_subject_${user.email}`, subject);
        localStorage.setItem(`draft_body_${user.email}`, body);
    } catch (err) {
        console.error("Failed to save draft", err);
    }
  }, [user, columns, data, subject, body, isRestored]);

  const logsSectionRef = React.useRef<HTMLDivElement>(null);

  const handleSend = async () => {
      // 1. Guard: Check active session expiry
      if (!checkTokenValidity()) return;
      if (!token || !user) return;

      // 2. Guard: Re-Validate everything (Extra Cautious)
      // We pass a dummy callback because we just want the boolean result and toasts
      const isValid = validateCampaign(
          { data, columns, subject, body, attachments }, 
          () => {} 
      );
      if (!isValid) return;

      // 3. Guard: Explicit User Confirmation
      if (!confirm(`Are you sure you want to send this campaign to ${data.length} recipients?\n\nThis action cannot be undone.`)) {
          return;
      }

      // Scroll to logs slightly after state update
      setTimeout(() => {
          logsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      await sendCampaign(token, user, data, subject, body, attachments);
  };

  const handleDownloadLogs = () => {
      const logContent = logs.map(l => `[${l.timestamp?.toLocaleTimeString() || new Date().toLocaleTimeString()}] ${l.status.toUpperCase()}: ${l.msg}`).join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-logs-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const reviewSectionRef = React.useRef<HTMLDivElement>(null);

  // NOTE: The above logic has a flaw: if validateCampaign finds errors, the callback isn't called,
  // so setValidating(false) inside the callback won't run.
  // We need to refactor this slightly or assume validateCampaign returns something. 
  // Let's stick to the simplest effective UI change for now:
  // JUST wrapping the button content. The validation is currently sync so it blocks.
  // If we want a spinner, we need to defer execution.
  
  const validateAndProceed = () => {
      setValidating(true);
      // Small timeout to allow UI to update and show loading state if dataset is large
      setTimeout(() => {
        const isValid = validateCampaign(
            { data, columns, subject, body, attachments },
            (trimmedData) => {
                setData(trimmedData);
                setActiveStep(2);
                setValidating(false);
                // Wait for render then scroll
                setTimeout(() => {
                    reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        );
        
        // If validation failed, reset loading state immediately
        if (!isValid) {
            setValidating(false);
        }
      }, 500); 
  };
  
  // NOTE: Auth/Loading states are now handled by AuthContext wrapper.
  // We can assume user & token exist here.

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="font-bold text-lg tracking-tight">
                {user ? `${user.given_name}'s Mailer` : 'Mailer'}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 pl-4 border-l border-border/50">
                 <div className="text-right hidden md:block">
                     <div className="text-xs font-medium text-foreground">{user?.name}</div>
                     <div className="text-[10px] text-muted-foreground">{user?.email}</div>
                 </div>
                 <button 
                    onClick={logout}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 px-3 py-1.5 rounded transition-colors"
                 >
                     Log Out
                 </button>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-12">
        
        {/* COMPOSE SECTION (Always Visible, Disabled in Step 2) */}
        <div className={cn(
            "space-y-12 transition-all duration-500",
            activeStep === 2 && "opacity-40 pointer-events-none grayscale-[0.5]"
        )}>
            {/* SECTION 1: TABLE */}
            <div className="space-y-4">
                <div className="flex items-end justify-between">
                        <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Recipients</h2>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Add your contacts and custom data columns.</p>
                        </div>
                </div>
                <TableEditor columns={columns} setColumns={setColumns} data={data} setData={setData} />
            </div>

            <div className="w-full h-px bg-border/50" />

                {/* SECTION 2: COMPOSER */}
                <div className="space-y-4">
                    <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Compose Message</h2>
                    <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Write your email using placeholder variables like <code>{`{{Name}}`}</code>.</p>
                    </div>
                <EmailComposer 
                    subject={subject}
                    setSubject={setSubject}
                    body={body}
                    setBody={setBody}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    columns={columns}
                />
            </div>

            {/* ACTION BUTTON (Only visible in Step 1) */}
            {activeStep === 1 && (
                <div className="flex justify-end pt-8">
                    <button 
                        onClick={validateAndProceed} 
                        disabled={validating}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {validating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                Review Campaign <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>

        {/* REVIEW SECTION (Visible only in Step 2) */}
        {activeStep === 2 && (
            <div ref={reviewSectionRef} className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 border-t border-dashed border-border/50 pt-12">
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Review Campaign</h2>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Preview exactly what your <b>{data.length} recipients</b> will see.</p>
                    </div>
                </div>
                
                {/* PREVIEW COMPONENT */}
                <EmailPreview 
                    subjectTemplate={subject}
                    bodyTemplate={body}
                    data={data}
                    attachments={attachments}
                    sender={user}
                    sending={sending}
                    onBack={() => {
                        resetCampaign(); // Reset progress when going back
                        setActiveStep(1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onSend={() => {
                        if(confirm(`Are you sure you want to send emails to ${data.length} recipients?`)) {
                            handleSend();
                        }
                    }}
                />
                
                {/* SEND PROGRESS (Campaign Monitor) */}
                {(sending || progress.total > 0) && (
                    <div ref={logsSectionRef} className="w-full bg-[#0c0c0e] border border-border rounded-xl p-6 shadow-2xl mt-8 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        {sending ? <Loader2 className="animate-spin text-blue-500" /> : <div className="w-2 h-2 bg-green-500 rounded-full" />}
                                        Progress
                                    </h3>
                                    {/* Download Logs Button */}
                                    <button 
                                        onClick={handleDownloadLogs}
                                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-md border border-white/5"
                                        title="Download Logs"
                                    >
                                        <Download size={12} />
                                        Logs
                                    </button>
                                </div>
                                <div className="flex gap-4 text-xs font-mono">
                                    <span className="text-green-400">SENT: {progress.sent}</span>
                                    <span className="text-red-400">FAILED: {progress.failed}</span>
                                    <span className="text-slate-500">TOTAL: {progress.total}</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                <span>Progress</span>
                                <span>{Math.round(((progress.sent + progress.failed) / (progress.total || 1)) * 100)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${((progress.sent + progress.failed) / (progress.total || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                        
                        {/* Logs */}
                        <div className="bg-black/50 rounded border border-white/5 p-3 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar">
                            {logs.length === 0 && <span className="text-slate-600 italic"> waiting for logs...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className={cn(
                                    "py-0.5 flex gap-2 border-b border-white/5 last:border-0",
                                    log.status === 'success' ? "text-green-400" : 
                                    log.status === 'error' ? "text-red-400" : "text-blue-300"
                                )}>
                                    <span className="opacity-40 select-none">[{new Date().toLocaleTimeString()}]</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #1e1e24; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #3f3f46; 
            border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
