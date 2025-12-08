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
import { Trash2 } from "lucide-react";

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
    // If no user, user logged out -> Clear everything to prevent leakage
    if (!user?.email) {
        setColumns(["NAME", "EMAIL"]);
        setData([]);
        setSubject("");
        setBody("");
        setAttachments([]);
        setIsRestored(false);
        return;
    }

    try {
        const savedColumns = localStorage.getItem(`draft_columns_${user.email}`);
        const savedData = localStorage.getItem(`draft_data_${user.email}`);
        const savedSubject = localStorage.getItem(`draft_subject_${user.email}`);
        const savedBody = localStorage.getItem(`draft_body_${user.email}`);

        // STRICT RESTORE: If saved data exists, load it. If NOT, reset to defaults.
        // This ensures User B doesn't see User A's data if User B has no draft.
        setColumns(savedColumns ? JSON.parse(savedColumns) : ["NAME", "EMAIL"]);
        setData(savedData ? JSON.parse(savedData) : []);
        setSubject(savedSubject || "");
        setBody(savedBody || "");
        // Attachments cannot be restored from localStorage
        setAttachments([]); 
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
    } catch (err: any) {
        console.error("Failed to save draft", err);
        // QuotaExceededError check (browsers name it differently)
        if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
             toast.warning("Auto-save failed: Storage full", {
                 description: "Your browser's local storage is full. Changes may not be saved if you refresh."
             });
        }
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


    const handleGlobalReset = () => {
    if (!confirm("Are you sure you want to clear all data? This will remove all recipients, composer content, and saved drafts for this account.")) {
        return;
    }
    
    // Clear State
    setColumns(["NAME", "EMAIL"]);
    setData([]);
    setSubject("");
    setBody("");
    setAttachments([]);
    
    // Clear Local Storage
    if(user?.email) {
        localStorage.removeItem(`draft_columns_${user.email}`);
        localStorage.removeItem(`draft_data_${user.email}`);
        localStorage.removeItem(`draft_subject_${user.email}`);
        localStorage.removeItem(`draft_body_${user.email}`);
    }
    
    toast.success("All data cleared successfully");
  };

  const handleComposerReset = () => {
      if(!subject && !body && attachments.length === 0) return;
      
      if (!confirm("Are you sure you want to clear the composer? Your subject, body, and attachments will be removed.")) {
          return;
      }
      setSubject("");
      setBody("");
      setAttachments([]);
      toast.success("Composer cleared");
  }

  const handleTableReset = () => {
    if(data.length === 0) return;
    
    if(!confirm("Are you sure you want to clear recipients table? This cannot be undone.")) {
        return;
    }
    setData([]);
    setColumns(["NAME", "EMAIL"]);
    toast.success("Recipients table cleared");
  }

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
    <div className="min-h-screen text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Navbar */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="font-bold text-lg sm:text-xl md:text-2xl tracking-tight font-[family-name:var(--font-bitcount)]">
                {user ? `${user.given_name.split(' ')[0]}'s Mailer` : 'Mailer'}
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
             
             <button
                onClick={handleGlobalReset}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                title="Clear All Data"
             >
                 <Trash2 size={18} />
             </button>

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
                        {data.length > 0 && (
                             <button
                                onClick={handleTableReset}
                                className="text-[10px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors self-end shrink-0 mb-1"
                            >
                                Clear Recipients
                            </button>
                        )}
                </div>
                <TableEditor columns={columns} setColumns={setColumns} data={data} setData={setData} />
            </div>

            <div className="w-full h-px bg-border/50" />

                {/* SECTION 2: COMPOSER */}
                <div className="space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Compose Message</h2>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Write your email using placeholder variables like <code>{`{{NAME}}`}</code>.</p>
                    </div>
                     {(subject || body || attachments.length > 0) && (
                        <button
                            onClick={handleComposerReset}
                            className="text-[10px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors self-end shrink-0 mb-1"
                        >
                            Clear Form
                        </button>
                    )}
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
                        className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {validating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                Review <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div >

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
                    <div ref={logsSectionRef} className="w-full bg-card border border-border rounded-xl p-6 shadow-2xl mt-8 ring-1 ring-indigo-500/20 animate-in fade-in zoom-in-95 duration-500">
                            <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        {sending ? <Loader2 className="animate-spin text-indigo-400" /> : <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />}
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
                                    <span className="text-emerald-400 font-medium">SENT: {progress.sent}</span>
                                    <span className="text-rose-400 font-medium">FAILED: {progress.failed}</span>
                                    <span className="text-zinc-500">TOTAL: {progress.total}</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                <span>Progress</span>
                                <span>{Math.round(((progress.sent + progress.failed) / (progress.total || 1)) * 100)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                                    style={{ width: `${((progress.sent + progress.failed) / (progress.total || 1)) * 100}%` }}
                                />
                            </div>
                        </div>
                        
                        {/* Logs */}
                        <div className="bg-zinc-950/50 rounded border border-white/5 p-3 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar">
                            {logs.length === 0 && <span className="text-zinc-600 italic"> waiting for logs...</span>}
                            {logs.map((log, i) => (
                                <div key={i} className={cn(
                                    "py-0.5 flex gap-2 border-b border-white/5 last:border-0",
                                    log.status === 'success' ? "text-emerald-400/90" : 
                                    log.status === 'error' ? "text-rose-400/90" : "text-indigo-300/80"
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
