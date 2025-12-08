"use client";

import React, { useRef, useState } from "react";
import { Paperclip, X, Sparkles, FileIcon, Mail, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EmailComposerProps {
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  attachments: File[];
  setAttachments: (files: File[]) => void;
  columns: string[];
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB Gmail limit

export function EmailComposer({
  subject,
  setSubject,
  body,
  setBody,
  attachments,
  setAttachments,
  columns,
}: EmailComposerProps) {
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Track last focused element to know where to insert variable
  const [lastFocused, setLastFocused] = useState<'subject' | 'body' | null>(null);

  const insertVariable = (variable: string) => {
    // Determine target based on active element or last focused state
    const activeEl = document.activeElement;
    let target = lastFocused;
    
    // If user is actively typing in one of them, prioritize that
    if (activeEl === subjectInputRef.current) target = 'subject';
    if (activeEl === bodyTextareaRef.current) target = 'body';

    if (!target) {
        toast.info("Please click Subject or Body", {
            description: "Click where you want to insert the variable first."
        });
        // Default focus to body for better UX if they just forgot
        bodyTextareaRef.current?.focus();
        setLastFocused('body');
        return;
    }

    const placeholder = `{{${variable}}}`;

    if (target === 'subject' && subjectInputRef.current) {
         const input = subjectInputRef.current;
         const start = input.selectionStart || 0;
         const end = input.selectionEnd || 0;
         const newVal = subject.slice(0, start) + placeholder + subject.slice(end);
         setSubject(newVal);
         
         // Restore cursor and focus
         setTimeout(() => {
           input.focus();
           const newCursorPos = start + placeholder.length;
           input.setSelectionRange(newCursorPos, newCursorPos);
         }, 0);
    } else if (target === 'body' && bodyTextareaRef.current) {
         const textarea = bodyTextareaRef.current;
         const start = textarea.selectionStart || 0;
         const end = textarea.selectionEnd || 0;
         const newVal = body.slice(0, start) + placeholder + body.slice(end);
         setBody(newVal);
         
         // Restore cursor and focus
         setTimeout(() => {
           textarea.focus();
           const newCursorPos = start + placeholder.length;
           textarea.setSelectionRange(newCursorPos, newCursorPos);
         }, 0);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Variable Chips Toolbar */}
      <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest pl-1">
             <Sparkles size={10} className="text-indigo-400" /> 
             <span>Data Variables</span>
        </div>
        <div className="flex justify-between items-start gap-4">
             <div className="flex flex-wrap gap-2">
            {columns.map((col) => (
            <button
                key={col}
                onMouseDown={(e) => e.preventDefault()} // Prevent losing focus from input/textarea
                onClick={() => insertVariable(col)}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/20 transition-all select-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                title={`Insert {{${col}}} into message`}
            >
                <span className="opacity-50 text-[10px] group-hover:opacity-100 transition-opacity">{`{{`}</span>
                {col}
                <span className="opacity-50 text-[10px] group-hover:opacity-100 transition-opacity">{`}}`}</span>
            </button>
            ))}
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-0 bg-background rounded-lg border border-border shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-ring transition-all">
         
         {/* Subject Line */}
         <div className="relative border-b border-border/50">
           <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Type size={14} />
           </div>
           <input
             ref={subjectInputRef}
             type="text"
             value={subject}
             onChange={(e) => setSubject(e.target.value)}
             onFocus={() => setLastFocused('subject')}
             placeholder="Subject Line"
             className="w-full bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 pl-10 focus:outline-none focus:bg-muted/30 transition-colors font-medium"
           />
         </div>

         {/* Body Textarea */}
         <div className="relative flex-1 min-h-[350px] bg-background">
            <textarea
                ref={bodyTextareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setLastFocused('body')}
                placeholder="Write your message here..."
                className="w-full h-full min-h-[350px] bg-transparent text-foreground px-4 py-4 focus:outline-none resize-y font-sans text-[14px] leading-relaxed placeholder:text-muted-foreground"
                style={{ lineHeight: '1.6' }}
            />
         </div>

          {/* Attachments Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-1 w-full sm:w-auto overflow-hidden">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-indigo-400 cursor-pointer transition-colors px-2 py-1.5 rounded hover:bg-background active:scale-95 transition-transform select-none shrink-0">
                      <Paperclip size={14} />
                      <span>Attach Files</span>
                      <input 
                         type="file" 
                         multiple 
                         className="hidden" 
                         onChange={(e) => {
                             const files = Array.from(e.target.files || []);
                             const totalSize = [...attachments, ...files].reduce((sum, f) => sum + f.size, 0);
                             
                             if (totalSize > MAX_ATTACHMENT_SIZE) {
                                 const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
                                 toast.error("Attachments too large", {
                                     description: `Total size (${totalMB}MB) exceeds Gmail's 25MB limit`
                                 });
                                 e.target.value = ''; // Reset file input
                                 return;
                             }
                             
                             setAttachments([...attachments, ...files]);
                             e.target.value = ''; // Reset for re-selection
                         }}
                      />
                  </label>
                  
                  {/* File List */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-fade-right">
                      {attachments.map((file, i) => (
                          <div key={file.name + i} className="flex items-center gap-2 pl-2 pr-1 py-1 rounded bg-background border border-border text-[11px] text-foreground animate-in fade-in zoom-in duration-200 shrink-0 group select-none">
                              <FileIcon size={10} className="text-muted-foreground" />
                              <span className="truncate max-w-[120px]">{file.name}</span>
                              <span className="text-muted-foreground text-[9px] px-1">{(file.size / 1024).toFixed(0)}KB</span>
                              <button 
                                onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} 
                                className="ml-1 p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-destructive transition-colors"
                              >
                                  <X size={10} />
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
              
              <div className="text-[10px] text-muted-foreground font-mono pl-4 shrink-0">
                  {attachments.length > 0 ? `${attachments.length} files` : 'Plain text'}
              </div>
          </div>
       </div>
       
       <style jsx>{`
         .mask-fade-right {
             mask-image: linear-gradient(to right, black 90%, transparent 100%);
         }
         .no-scrollbar::-webkit-scrollbar {
             display: none;
         }
         .no-scrollbar {
             -ms-overflow-style: none;
             scrollbar-width: none;
         }
       `}</style>
    </div>
  );
}
