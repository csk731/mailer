"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, User, Mail, Send, Loader2, ArrowLeft } from "lucide-react";
import { replacePlaceholders } from "@/lib/gmail";
import { cn } from "@/lib/utils";

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
              <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
              <div className="text-sm font-medium text-muted-foreground hidden sm:block">
                  Preview Mode
              </div>
           </div>
           
           <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
               <button 
                  onClick={handlePrev} 
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous Recipient"
               >
                   <ChevronLeft size={20} />
               </button>
               <span className="text-sm font-mono text-muted-foreground w-12 text-center">
                   {currentIndex + 1} / {data.length}
               </span>
               <button 
                  onClick={handleNext} 
                  disabled={currentIndex === data.length - 1}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Recipient"
               >
                   <ChevronRight size={20} />
               </button>
           </div>
       </div>

       {/* Email Preview Card */}
       <div className="bg-white dark:bg-[#0c0c0e] border border-border rounded-xl shadow-lg ring-1 ring-black/5 overflow-hidden">
           {/* Fake Window Controls */}
           <div className="bg-muted/30 border-b border-border p-3 flex gap-2">
               <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
               <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
               <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
           </div>
           
           <div className="p-8 space-y-6">
                <div className="space-y-1 pb-4 border-b border-border/50">
                    <div className="flex gap-4 items-baseline">
                        <span className="text-muted-foreground w-16 text-sm shrink-0 font-medium">From:</span>
                        <span className="text-sm text-foreground">
                            {sender?.name} <span className="text-muted-foreground">&lt;{sender?.email}&gt;</span>
                        </span>
                    </div>
                    <div className="flex gap-4 items-baseline">
                        <span className="text-muted-foreground w-16 text-sm shrink-0 font-medium">To:</span>
                        <span className="text-sm text-foreground bg-muted/50 px-2 py-0.5 rounded break-all">{currentRecipient.EMAIL}</span>
                    </div>
                     <div className="flex gap-4 items-baseline">
                        <span className="text-muted-foreground w-16 text-sm shrink-0 font-medium">Subject:</span>
                        <span className="text-sm font-semibold text-foreground break-words">{subject}</span>
                    </div>
                </div>
                
                <div className="prose prose-sm dark:prose-invert max-w-none min-h-[100px] whitespace-pre-wrap font-sans text-slate-300 leading-relaxed">
                    {body}
                </div>

                {attachments.length > 0 && (
                     <div className="pt-4 border-t border-border/50 mt-6">
                         <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                             <Mail size={12} /> {attachments.length} Attachment{attachments.length !== 1 && 's'}
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {attachments.map((file, i) => (
                                 <div key={file.name + i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 group select-none">
                                     <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                         <Mail size={16} /> {/* Generic file icon fallback */}
                                     </div>
                                     <div className="flex flex-col">
                                         <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{file.name}</span>
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
       <div className="flex items-center justify-end pt-4">
           
           <div className="flex flex-col items-end gap-2">
                <button
                    onClick={onSend}
                    disabled={sending}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {sending ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            Launch Campaign <Send size={18} />
                        </>
                    )}
                </button>
                <span className="text-[10px] text-muted-foreground">
                    You are mostly ready. Click launch to start sending.
                </span>
           </div>
       </div>
    </div>
  );
}
