import { useState } from "react";
import { EmailData, SendLog, SendProgress, UserProfile } from "@/lib/types";
import { createMimeMessage, replacePlaceholders, sendEmail } from "@/lib/gmail";
import { toast } from "sonner";

export function useEmailCampaign() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress>({ sent: 0, total: 0, failed: 0 });
  const [logs, setLogs] = useState<SendLog[]>([]);

  const sendCampaign = async (
    token: string, 
    user: UserProfile, 
    data: Record<string, string>[], 
    subject: string, 
    body: string, 
    attachments: File[]
  ) => {
    setSending(true);
    setLogs([]);
    const total = data.length;
    setProgress({ sent: 0, total, failed: 0 });

    const fromName = user.given_name && user.family_name 
        ? `${user.given_name} ${user.family_name}` 
        : user.name;

    // Gmail API rate limiting: max ~100 emails/minute to be safe
    let baseDelay = 1000; // 1 second between emails
    let consecutiveErrors = 0;

    for (let i = 0; i < total; i++) {
        const row = data[i];
        const recipientEmail = row.EMAIL || row.Email || "";
        
        if (!recipientEmail) {
             setLogs(prev => [...prev, { status: 'info', msg: `Skipped row ${i+1}: Missing Email`, timestamp: new Date() }]);
             toast.info(`Skipped row ${i+1}: Missing email address`);
             continue;
        }

        try {
            const processedSubject = replacePlaceholders(subject, row);
            const processedBody = replacePlaceholders(body, row).replace(/\n/g, '<br>');
            const rawMessage = await createMimeMessage({
                to: recipientEmail,
                subject: processedSubject,
                body: processedBody,
                from: { name: fromName, email: user.email },
                attachments: attachments
            });

            await sendEmail(token, rawMessage);
            setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
            setLogs(prev => [...prev, { status: 'success', msg: `Sent to ${recipientEmail}`, timestamp: new Date() }]);
            consecutiveErrors = 0; // Reset error counter on success
            
        } catch (error: unknown) {
            console.error(error);
            consecutiveErrors++;
            setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            
            // Parse error message safely
            let errorMsg = "Unknown error";
            if (error instanceof Error) {
                errorMsg = error.message;
            } else if (typeof error === 'string') {
                errorMsg = error;
            } else if (typeof error === 'object' && error !== null && 'message' in error) {
                 errorMsg = String((error as any).message);
            } else {
                 errorMsg = String(error);
            }
            const isRateLimit = errorMsg.toLowerCase().includes('rate') || 
                               errorMsg.toLowerCase().includes('quota') ||
                               errorMsg.toLowerCase().includes('429');
            
            setLogs(prev => [...prev, { status: 'error', msg: `Failed ${recipientEmail}: ${errorMsg}`, timestamp: new Date() }]);
            
            // Show toast for errors
            if (isRateLimit) {
                toast.error(`Rate limit hit! Slowing down...`, {
                    description: `Failed to send to ${recipientEmail}`
                });
                baseDelay = Math.min(baseDelay * 2, 10000); // Exponential backoff, max 10s
            } else {
                toast.error(`Failed to send to ${recipientEmail}`, {
                    description: errorMsg
                });
            }
            
            // Stop campaign if too many consecutive errors
            if (consecutiveErrors >= 5) {
                toast.error('Too many consecutive errors. Campaign paused.', {
                    description: 'Please check your connection and try again.'
                });
                setSending(false);
                return;
            }
        }
        
        // Adaptive delay based on errors
        const delay = consecutiveErrors > 0 ? baseDelay * (consecutiveErrors + 1) : baseDelay;
        await new Promise(r => setTimeout(r, delay));
    }
    
    setSending(false);
    
    // Show final summary
    const finalProgress = { 
        sent: total - progress.failed - consecutiveErrors, 
        failed: progress.failed + consecutiveErrors 
    };
    
    if (finalProgress.failed === 0) {
        toast.success(`Campaign complete!`, {
            description: `Successfully sent ${finalProgress.sent} email${finalProgress.sent !== 1 ? 's' : ''}`
        });
    } else {
        toast.warning(`Campaign finished with errors`, {
            description: `Sent: ${finalProgress.sent}, Failed: ${finalProgress.failed}`
        });
    }
  };

  const resetCampaign = () => {
    setLogs([]);
    setProgress({ sent: 0, total: 0, failed: 0 });
    setSending(false);
  };

  return { sending, progress, logs, sendCampaign, resetCampaign };
}
