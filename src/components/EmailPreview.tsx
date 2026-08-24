"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Mail, Send, Loader2, ArrowLeft, SendHorizontal } from "lucide-react";
import { replacePlaceholders, createMimeMessage, sendEmail } from "@/lib/gmail";
import { cn, escapeHtml } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface EmailPreviewProps {
  subjectTemplate: string;
  bodyTemplate: string;
  data: Record<string, string>[];
  attachments: File[];
  sender: { name: string; email: string; } | null;
  onSend: () => void;
  onBack: () => void;
  sending: boolean;
}

export function EmailPreview({ 
  subjectTemplate, 
  bodyTemplate, 
  data, 
  attachments,
  sender,
  onSend, 
  onBack,
  sending
}: EmailPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendingTest, setSendingTest] = useState(false);
  const { token, user, checkTokenValidity } = useAuth();

  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const currentKeys = new Set(attachments.map(f => f.name + f.size));
    for (const [key, url] of objectUrlsRef.current.entries()) {
        if (!currentKeys.has(key)) {
            URL.revokeObjectURL(url);
            objectUrlsRef.current.delete(key);
        }
    }
    attachments.forEach(f => {
        const key = f.name + f.size;
        if (!objectUrlsRef.current.has(key)) {
            objectUrlsRef.current.set(key, URL.createObjectURL(f));
        }
    });
    return () => {
        objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        objectUrlsRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  const currentRecipient = data[currentIndex];
  
  // Memoize the interpolated content for the current recipient
  const { subject, body } = useMemo(() => {
    if (!currentRecipient) return { subject: "", body: "" };
    
    return {
        subject: replacePlaceholders(subjectTemplate, currentRecipient),
        body: replacePlaceholders(bodyTemplate, currentRecipient)
    };
  }, [subjectTemplate, bodyTemplate, currentRecipient]);

  if (!currentRecipient) {
    return <div className="text-center py-10 text-muted-foreground">No recipients found.</div>;
  }

  const handleNext = () => {
    if (currentIndex < data.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const handleSendTestToSelf = async () => {
    if (!checkTokenValidity() || !token || !user) {
      toast.error("Authentication required", { description: "Please ensure your session is active." });
      return;
    }
    setSendingTest(true);
    try {
      const escapedRecipient: Record<string, string> = {};
      Object.keys(currentRecipient).forEach(k => {
        escapedRecipient[k] = escapeHtml(currentRecipient[k]);
      });
      const processedSubject = `[TEST] ${replacePlaceholders(subjectTemplate, escapedRecipient)}`;
      const processedBody = replacePlaceholders(escapeHtml(bodyTemplate), escapedRecipient).replace(/\n/g, '<br>');

      const rawMessage = await createMimeMessage({
        to: user.email,
        subject: processedSubject,
        body: processedBody,
        from: { name: `${user.name} (Test Preview)`, email: user.email },
        attachments: attachments
      });

      await sendEmail(token, rawMessage);
      toast.success("Test email sent!", {
        description: `Check your inbox at ${user.email} to verify formatting.`
      });
    } catch (err: unknown) {
      console.error(err);
      let errorMsg = "Please check your network connection.";
      if (err instanceof Error) errorMsg = err.message;
      toast.error("Failed to send test email", { description: errorMsg });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="w-full space-y-6">
       {/* Header / Navigation Controls */}
       <div className="flex flex-col sm:flex-row items-center justify-between bg-card border border-border rounded-xl p-4 shadow-sm gap-4 sm:gap-0">
           <div className="flex items-center gap-4 w-full sm:w-auto justify-center sm:justify-start">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                  <ArrowLeft size={16} />
                  Back to Edit
              </button>
              <div className="h-4 sm:h-6 w-px bg-border mx-1 sm:mx-2" />
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Preview Mode
              </div>
           </div>
           
           <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
               <button 
                  onClick={handlePrev} 
                  disabled={currentIndex === 0}
                   className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                   title="Previous Recipient"
                   aria-label="Previous recipient"
               >
                   <ChevronLeft size={18} />
               </button>
               
               <select
                  value={currentIndex}
                  onChange={(e) => setCurrentIndex(Number(e.target.value))}
                  className="bg-background border border-border text-foreground text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500/50 cursor-pointer font-mono max-w-[220px] truncate"
                  title="Jump to recipient"
               >
                  {data.map((r, idx) => (
                    <option key={idx} value={idx}>
                      {idx + 1}. {r.NAME ? `${r.NAME} (${r.EMAIL})` : r.EMAIL}
                    </option>
                  ))}
               </select>

               <button 
                  onClick={handleNext} 
                  disabled={currentIndex === data.length - 1}
                   className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                   title="Next Recipient"
                   aria-label="Next recipient"
               >
                   <ChevronRight size={18} />
               </button>
           </div>
       </div>

       {/* Email Preview Card */}
       <div className="bg-card border border-border rounded-xl shadow-lg ring-1 ring-black/5 overflow-hidden">
           {/* Window Header */}
            <div className="bg-muted/30 border-b border-border p-3 flex gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/30" />
                <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
            </div>
           
           <div className="p-4 sm:p-8 space-y-6 font-sans">
                <div className="space-y-2 pb-4 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start sm:items-baseline">
                        <span className="text-muted-foreground w-16 text-xs sm:text-sm shrink-0 font-medium">From:</span>
                        <span className="text-xs sm:text-sm text-foreground break-all">
                            {sender?.name} <span className="text-muted-foreground">&lt;{sender?.email}&gt;</span>
                        </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start sm:items-baseline">
                        <span className="text-muted-foreground w-16 text-xs sm:text-sm shrink-0 font-medium">To:</span>
                        <span className="text-xs sm:text-sm text-foreground bg-indigo-500/10 text-indigo-100 border border-indigo-500/20 px-2 py-0.5 rounded break-all shadow-sm">{currentRecipient.EMAIL}</span>
                    </div>
                     <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 items-start sm:items-baseline">
                        <span className="text-muted-foreground w-16 text-xs sm:text-sm shrink-0 font-medium">Subject:</span>
                        <span className="text-foreground font-medium break-all tracking-wide text-xs sm:text-sm">{subject}</span>
                    </div>
                </div>
                
                <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed break-words">
                    {body}
                </div>

                {attachments.length > 0 && (
                     <div className="pt-4 border-t border-border/50 mt-6">
                         <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                             <Mail size={12} /> {attachments.length} Attachment{attachments.length !== 1 && 's'}
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {attachments.map((file, i) => (
                                 <div 
                                    key={file.name + i} 
                                    onClick={() => {
                                      const key = file.name + file.size;
                                      const url = objectUrlsRef.current.get(key);
                                      if (url) window.open(url, '_blank');
                                  }}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 group select-none cursor-pointer hover:bg-muted/50 hover:border-indigo-500/30 hover:shadow-sm transition-all"
                                    title="Click to preview file"
                                 >
                                     <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                         <Mail size={16} />
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-xs font-medium text-foreground truncate max-w-[150px] group-hover:text-indigo-400 transition-colors">{file.name}</span>
                                         <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                )}
           </div>
       </div>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
            <button
                onClick={handleSendTestToSelf}
                disabled={sending || sendingTest}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-background border border-border text-foreground px-5 py-3 rounded-lg font-medium hover:bg-muted transition-all shadow-sm disabled:opacity-50 text-sm"
                title={`Send a test email for ${currentRecipient.NAME || currentRecipient.EMAIL} to your inbox (${user?.email})`}
            >
                {sendingTest ? (
                    <>
                        <Loader2 size={16} className="animate-spin text-indigo-400" />
                        Sending Test...
                    </>
                ) : (
                    <>
                        <SendHorizontal size={16} className="text-indigo-400" />
                        Send Test to Me
                    </>
                )}
            </button>
            
            <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
                 <button
                     onClick={onSend}
                     disabled={sending}
                     className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                 >
                     {sending ? (
                         <>
                             <Loader2 size={18} className="animate-spin" />
                             Sending Emails...
                         </>
                     ) : (
                         <>
                             Send Emails <Send size={18} />
                         </>
                     )}
                 </button>
                 <span className="text-[11px] text-muted-foreground text-center sm:text-right">
                     Emails are sent directly from your connected Gmail account.
                 </span>
            </div>
        </div>
    </div>
  );
}
