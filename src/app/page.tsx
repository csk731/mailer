"use client";

import React, { useState, useEffect } from "react";
import { TableEditor } from "@/components/TableEditor";
import { EmailComposer } from "@/components/EmailComposer";
import { EmailPreview } from "@/components/EmailPreview";
import { Mail, Send, CheckCircle, AlertCircle, Loader2, Key, ChevronRight, Sparkles, Download, ShieldCheck, Trash2, Gauge, RotateCcw, Eye, EyeOff, Clock, Pause, Play, RefreshCw, Info, User, X } from "lucide-react";
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
  const { token, user, logout, checkTokenValidity, secondsRemaining, extendSession, invalidateSession } = useAuth();
  const { 
    sending, 
    isPaused, 
    authExpired, 
    progress, 
    logs, 
    failedRecipients, 
    sendCampaign, 
    pauseCampaign, 
    resumeCampaign, 
    resetCampaign 
  } = useEmailCampaign();
  
  /* Flow Management: 1=Compose, 2=Review */
  const [activeStep, setActiveStep] = useState(1);
  const [validating, setValidating] = useState(false);
  const [throttleMs, setThrottleMs] = useState<number>(1000);
  const [privacyMode, setPrivacyMode] = useState(false);

  const formatSessionTimer = (secs: number | null) => {
    if (secs === null) return null;
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  /* Pure In-Memory Data & Editor State (Zero Disk Persistence) */
  const [columns, setColumns] = useState<string[]>(["EMAIL"]);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);

  /* Exit Confirmation (Prevent accidental tab close or page reload) */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        const shouldWarn = !!user || data.length > 0 || !!subject || !!body || sending;
        
        if (shouldWarn) {
            e.preventDefault();
            e.returnValue = ''; 
            return '';
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, data.length, subject, body, sending]);

  const logsSectionRef = React.useRef<HTMLDivElement>(null);

  const handleSend = async (targetData: Record<string, string>[] = data) => {
      if (!checkTokenValidity()) return;
      if (!token || !user) return;

      let trimmedDataForSend: Record<string, string>[] = [];
      const isValid = validateCampaign(
          { data: targetData, columns, subject, body, attachments }, 
          (trimmed) => { trimmedDataForSend = trimmed; }
      );
      if (!isValid || trimmedDataForSend.length === 0) return;

      const speedLabel = throttleMs === 1000 ? 'Normal (1s delay)' : throttleMs === 2000 ? 'Relaxed (2s delay)' : 'Safe Mode (3s delay)';

      const confirmMsg = [
          `⚠️ CONFIRM EMAIL CAMPAIGN`,
          ``,
          `You are about to send ${trimmedDataForSend.length} personalized email(s) from ${user.email}.`,
          ``,
          `• Subject: "${subject}"`,
          `• Total Recipients: ${trimmedDataForSend.length}`,
          `• Attachments: ${attachments.length} file(s)`,
          `• Pacing Speed: ${speedLabel}`,
          ``,
          `Emails will be sent immediately. Once sent, this action cannot be recalled.`,
          ``,
          `Do you want to proceed?`
      ].join('\n');

      if (!confirm(confirmMsg)) {
          return;
      }

      // Scroll to logs slightly after state update
      setTimeout(() => {
          logsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      await sendCampaign(token, user, trimmedDataForSend, subject, body, attachments, throttleMs);
  };

  const handleRetryFailed = async () => {
      if (!checkTokenValidity()) return;
      if (!token || !user || failedRecipients.length === 0) return;

      if (!confirm(`Retry sending to ${failedRecipients.length} failed recipient(s)?`)) {
          return;
      }

      setTimeout(() => {
          logsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      await sendCampaign(token, user, failedRecipients, subject, body, attachments, throttleMs);
  };

  const handleDownloadLogs = () => {
      const logContent = logs.map(l => `[${l.timestamp?.toLocaleTimeString() || new Date().toLocaleTimeString()}] ${l.status.toUpperCase()}: ${l.msg}`).join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mailer-log-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const reviewSectionRef = React.useRef<HTMLDivElement>(null);

  const handleGlobalReset = () => {
    const confirmMsg = [
        `⚠️ CLEAR SESSION WORKSPACE`,
        ``,
        `This will clear all active session data:`,
        `• ${data.length} recipient row(s)`,
        `• Custom spreadsheet columns (${columns.join(', ')})`,
        `• Subject & message body templates`,
        `• ${attachments.length} attached file(s)`,
        ``,
        `Are you sure you want to clear your current workspace?`
    ].join('\n');

    if (!confirm(confirmMsg)) {
        return;
    }
    
    // Clear in-memory State
    setColumns(["EMAIL"]);
    setData([]);
    setSubject("");
    setBody("");
    setAttachments([]);
    resetCampaign();

    // Always return to compose mode
    setActiveStep(1);
    
    toast.success("Workspace cleared");
  };

  const handleComposerReset = () => {
      if(!subject && !body && attachments.length === 0) return;
      
      const confirmMsg = [
          `⚠️ CLEAR EMAIL COMPOSER`,
          ``,
          `This will discard:`,
          `• Subject: "${subject || '(empty)'}"`,
          `• Message body template`,
          `• ${attachments.length} attachment(s)`,
          ``,
          `Are you sure you want to clear the composer?`
      ].join('\n');

      if (!confirm(confirmMsg)) {
          return;
      }
      setSubject("");
      setBody("");
      setAttachments([]);
      toast.success("Composer cleared");
  };

  const handleTableReset = () => {
    if(data.length === 0) return;
    
    const confirmMsg = [
        `⚠️ CLEAR RECIPIENTS TABLE`,
        ``,
        `Are you sure you want to delete all ${data.length} recipient row(s)?`,
        `This will clear all rows and reset columns to default (NAME, EMAIL).`
    ].join('\n');

    if(!confirm(confirmMsg)) {
        return;
    }
    setData([]);
    setColumns(["NAME", "EMAIL"]);
    toast.success("Recipients table cleared");
  };

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
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          {/* Main Bar */}
          <div className="h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
            {/* Left: Brand & Desktop Badges */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="font-bold text-base sm:text-xl md:text-2xl tracking-tight font-[family-name:var(--font-bitcount)] truncate">
                {user ? `${user.given_name.split(' ')[0]}'s Mailer` : 'Mailer'}
              </span>

              {/* Desktop Session Badge */}
              <div 
                className={cn(
                  "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono select-none transition-all shrink-0",
                  secondsRemaining !== null && secondsRemaining < 300 
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                )}
                title="Time remaining for your active session. When it reaches 0, you can extend or reconnect."
              >
                <Clock size={12} className="shrink-0" />
                <span>
                  {secondsRemaining !== null ? `${formatSessionTimer(secondsRemaining)} remaining` : 'Session Active'}
                </span>
                {secondsRemaining !== null && secondsRemaining < 300 && (
                  <button 
                    onClick={extendSession}
                    className="ml-1 px-1.5 py-0.5 bg-amber-500 text-black font-semibold rounded text-[10px] hover:bg-amber-400 cursor-pointer"
                    title="Extend session duration"
                  >
                    Extend
                  </button>
                )}
              </div>

              {/* Desktop Privacy Mode Toggle */}
              <button
                onClick={() => {
                  setPrivacyMode(!privacyMode);
                  toast.info(privacyMode ? "Privacy mode disabled" : "Privacy mode enabled", {
                    description: privacyMode ? "Contact details are now visible." : "Contact details are blurred for safe screen-sharing."
                  });
                }}
                className={cn(
                  "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-sans transition-all border select-none cursor-pointer shrink-0",
                  privacyMode 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                )}
                title="Toggle Privacy Mode (blurs emails on screen for presentations / screen sharing)"
              >
                {privacyMode ? <EyeOff size={12} className="text-amber-400" /> : <Eye size={12} />}
                <span>{privacyMode ? "Privacy On" : "Privacy"}</span>
              </button>
            </div>
            
            {/* Right: User & Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-3 pl-1.5 sm:pl-3 border-l border-border/50">
                  {/* Unified Profile & Info Button (Desktop & Mobile) */}
                  <button
                    onClick={() => setShowProfileModal(!showProfileModal)}
                    className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-full bg-muted/40 hover:bg-muted/80 border border-border/60 transition-all cursor-pointer select-none group"
                    title="View Account Details & Session Info"
                    aria-label="View Account Details"
                  >
                    {user?.picture ? (
                      <img 
                        src={user.picture} 
                        alt={user.name || "Profile"} 
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover shrink-0 ring-1 ring-emerald-400/50"
                      />
                    ) : (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0">
                        {user?.given_name?.[0] || user?.name?.[0] || 'U'}
                      </div>
                    )}
                    
                    <div className="text-left hidden md:block leading-tight">
                      <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">{user?.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">{user?.email}</div>
                    </div>

                    <Info size={13} className="text-muted-foreground group-hover:text-indigo-400 transition-colors shrink-0" />
                  </button>

                  <button 
                     onClick={logout}
                     className="text-[11px] sm:text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer"
                  >
                      End Session
                  </button>
              </div>
              
              <button
                 onClick={handleGlobalReset}
                 disabled={sending}
                 className={cn(
                     "p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer",
                     sending && "opacity-50 cursor-not-allowed pointer-events-none"
                 )}
                 title={sending ? "Cannot clear data while sending" : "Clear All Data"}
              >
                  <Trash2 size={15} className="sm:w-[17px] sm:h-[17px]" />
              </button>
            </div>
          </div>

          {/* Mobile Secondary Status Strip (Strictly 2 items, 100% responsive on <= 360px) */}
          <div className="md:hidden flex items-center justify-between gap-2 py-1.5 border-t border-border/40 text-[11px]">
              {/* Mobile Live Countdown */}
              <div 
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono select-none transition-all",
                  secondsRemaining !== null && secondsRemaining < 300 
                    ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                )}
              >
                <Clock size={11} className="shrink-0" />
                <span>
                  {secondsRemaining !== null ? `${formatSessionTimer(secondsRemaining)} left` : 'Session Active'}
                </span>
                {secondsRemaining !== null && secondsRemaining < 300 && (
                  <button 
                    onClick={extendSession}
                    className="ml-1 px-1 py-0.2 bg-amber-500 text-black font-semibold rounded text-[9px] hover:bg-amber-400 cursor-pointer"
                  >
                    Extend
                  </button>
                )}
              </div>

              {/* Mobile Privacy Toggle */}
              <button
                onClick={() => {
                  setPrivacyMode(!privacyMode);
                  toast.info(privacyMode ? "Privacy mode disabled" : "Privacy mode enabled", {
                    description: privacyMode ? "Contact details are now visible." : "Contact details are blurred for safe screen-sharing."
                  });
                }}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-sans transition-all border select-none cursor-pointer",
                  privacyMode 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300 shadow-sm"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {privacyMode ? <EyeOff size={11} className="text-amber-400" /> : <Eye size={11} />}
                <span>{privacyMode ? "Privacy On" : "Privacy Off"}</span>
              </button>
          </div>
        </div>

        {/* User Account Info Popover Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" 
              onClick={() => setShowProfileModal(false)} 
            />
            <div className="relative z-10 w-full max-w-xs bg-popover border border-border rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Account & Session</span>
                </div>
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile Picture, Full Name & Email */}
              <div className="flex flex-col items-center text-center space-y-2 pt-1">
                {user?.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name || "Profile"} 
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-full border-2 border-primary/30 shadow-md object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-2xl shadow-md">
                    {user?.given_name?.[0] || user?.name?.[0] || 'U'}
                  </div>
                )}
                <div className="space-y-0.5 max-w-full">
                  <h4 className="font-bold text-base text-foreground truncate">{user?.name}</h4>
                  <p className="text-xs text-muted-foreground break-all">{user?.email}</p>
                </div>
              </div>

              {/* Session Meta */}
              <div className="bg-muted/40 border border-border/50 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Session Time Left:</span>
                  <span className="font-mono font-bold text-foreground">
                    {secondsRemaining !== null ? `${formatSessionTimer(secondsRemaining)}` : 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Privacy Mode:</span>
                  <span className={cn("font-medium", privacyMode ? "text-amber-400" : "text-foreground")}>
                    {privacyMode ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Storage:</span>
                  <span className="text-emerald-400 font-medium">Temporary Workspace</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                {secondsRemaining !== null && secondsRemaining < 300 && (
                  <button
                    onClick={() => { extendSession(); setShowProfileModal(false); }}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Extend Session (60m)
                  </button>
                )}
                <button
                  onClick={() => { setShowProfileModal(false); logout(); }}
                  className="w-full py-2.5 bg-destructive/10 hover:bg-destructive/20 text-red-400 font-semibold rounded-xl text-xs transition-colors border border-red-500/20 cursor-pointer"
                >
                  End Session & Disconnect
                </button>
              </div>
            </div>
          </div>
        )}
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
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Add your contacts and personalized data for each person.</p>
                        </div>
                        {data.length > 0 && (
                             <button
                                onClick={handleTableReset}
                                className="text-[10px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors self-end shrink-0 mb-1"
                            >
                                Clear All Rows
                            </button>
                        )}
                </div>
                <TableEditor columns={columns} setColumns={setColumns} data={data} setData={setData} privacyMode={privacyMode} />
            </div>

            <div className="w-full h-px bg-border/50" />

                {/* SECTION 2: COMPOSER */}
                <div className="space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Compose Message</h2>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Write your email template. Use variables like <code>{`{{NAME}}`}</code> to personalize each message.</p>
                    </div>
                     {(subject || body || attachments.length > 0) && (
                        <button
                            onClick={handleComposerReset}
                            className="text-[10px] font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-full transition-colors self-end shrink-0 mb-1"
                        >
                            Clear Message
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
                <div className="flex justify-end pt-4 sm:pt-8">
                    <button 
                        onClick={validateAndProceed} 
                        disabled={validating}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-lg font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                        {validating ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Preparing Preview...
                            </>
                        ) : (
                            <>
                                Review & Send <ChevronRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            )}
        </div >

        {/* REVIEW SECTION (Visible only in Step 2) */}
        {activeStep === 2 && (
            <div ref={reviewSectionRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 border-t border-dashed border-border/50 pt-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Review Your Emails</h2>
                        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Preview how your email will look for each of your <b>{data.length} recipient{data.length !== 1 ? 's' : ''}</b>.</p>
                    </div>

                    {/* Throttle Speed Selector */}
                    <div className="flex items-center gap-2 text-xs bg-muted/40 border border-border px-3 py-1.5 rounded-lg">
                        <Gauge size={13} className="text-indigo-400" />
                        <span className="text-muted-foreground">Pacing:</span>
                        <select
                            value={throttleMs}
                            onChange={(e) => setThrottleMs(Number(e.target.value))}
                            disabled={sending}
                            className="bg-background border border-border text-foreground text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value={1000}>Normal (1s delay)</option>
                            <option value={2000}>Relaxed (2s delay)</option>
                            <option value={3000}>Safe Mode (3s delay)</option>
                        </select>
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
                        handleSend();
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
                                    {/* Campaign Controls */}
                                    {sending && (
                                        <button 
                                            onClick={pauseCampaign}
                                            className="flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 transition-colors bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-md border border-amber-500/20 shadow-sm cursor-pointer"
                                            title="Pause Campaign"
                                        >
                                            <Pause size={12} />
                                            Pause
                                        </button>
                                    )}

                                    {isPaused && !authExpired && (
                                        <button 
                                            onClick={() => resumeCampaign(token || undefined)}
                                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-md border border-emerald-500/20 shadow-sm cursor-pointer animate-pulse"
                                            title="Resume Campaign"
                                        >
                                            <Play size={12} />
                                            Resume
                                        </button>
                                    )}

                                    {authExpired && (
                                        <button 
                                            onClick={() => {
                                                extendSession();
                                                setTimeout(() => resumeCampaign(), 1500);
                                            }}
                                            className="flex items-center gap-1.5 text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 transition-colors px-3 py-1.5 rounded-md shadow-md cursor-pointer animate-pulse"
                                            title="Renew Google Session & Resume Campaign"
                                        >
                                            <RefreshCw size={12} />
                                            Renew & Resume
                                        </button>
                                    )}

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

                            {/* Mid-Campaign Auth Expired Banner */}
                            {authExpired && (
                                <div className="p-4 rounded-lg border mb-6 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/10 border-amber-500/30 text-amber-200 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                                        <span>
                                            <strong>Connection Paused:</strong> Your Google connection timed out. Click <strong>Reconnect & Resume</strong> to continue sending where you left off without duplicates.
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            extendSession();
                                            setTimeout(() => resumeCampaign(), 1500);
                                        }}
                                        className="px-3 py-1.5 bg-amber-500 text-black font-semibold rounded text-xs hover:bg-amber-400 transition-colors shrink-0 shadow-sm cursor-pointer"
                                    >
                                        Reconnect & Resume
                                    </button>
                                </div>
                            )}

                            {/* Campaign Paused Banner */}
                            {isPaused && !authExpired && (
                                <div className="p-4 rounded-lg border mb-6 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-indigo-500/10 border-indigo-500/30 text-indigo-200 animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2">
                                        <Pause size={16} className="text-indigo-400 shrink-0" />
                                        <span>
                                            <strong>Campaign Paused:</strong> Sending is paused at recipient {progress.sent + progress.failed + 1} of {progress.total}. Click <strong>Resume</strong> when ready.
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => resumeCampaign(token || undefined)}
                                        className="px-3 py-1.5 bg-indigo-500 text-white font-semibold rounded text-xs hover:bg-indigo-400 transition-colors shrink-0 shadow-sm cursor-pointer"
                                    >
                                        Resume Campaign
                                    </button>
                                </div>
                            )}

                            {/* Campaign Completed Banner */}
                            {!sending && !isPaused && progress.total > 0 && (progress.sent + progress.failed === progress.total) && (
                                <div className={cn(
                                    "p-4 rounded-lg border mb-6 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300",
                                    progress.failed === 0 
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                                        : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                                )}>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={16} className={progress.failed === 0 ? "text-emerald-400" : "text-amber-400"} />
                                        <span>
                                            {progress.failed === 0 
                                                ? `Campaign complete! All ${progress.sent} emails were dispatched successfully.`
                                                : `Campaign finished: ${progress.sent} sent, ${progress.failed} failed.`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                        {failedRecipients.length > 0 && (
                                            <button 
                                                onClick={handleRetryFailed}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-black font-semibold rounded text-xs hover:bg-amber-400 transition-colors shadow-sm"
                                            >
                                                <RotateCcw size={12} />
                                                Retry Failed ({failedRecipients.length})
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleDownloadLogs}
                                            className="underline hover:no-underline font-medium text-xs"
                                        >
                                            Save Delivery Report
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar */}
                            <div className="space-y-2 mb-6">
                            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                <span>{sending ? 'Sending Campaign...' : 'Completed'}</span>
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
                                    <span className="opacity-40 select-none">
                                        [{log.timestamp?.toLocaleTimeString() ?? new Date().toLocaleTimeString()}]
                                    </span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

      </main>
    </div>
  );
}
