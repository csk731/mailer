import { useState, useRef } from "react";
import { EmailData, SendLog, SendProgress, UserProfile } from "@/lib/types";
import { createMimeMessage, replacePlaceholders, sendEmail } from "@/lib/gmail";
import { escapeHtml } from "@/lib/utils";
import { toast } from "sonner";

interface CampaignContext {
  token: string;
  user: UserProfile;
  data: Record<string, string>[];
  subject: string;
  body: string;
  attachments: File[];
  throttleMs: number;
  startIndex: number;
}

export function useEmailCampaign() {
  const [sending, setSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [progress, setProgress] = useState<SendProgress>({ sent: 0, total: 0, failed: 0 });
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [failedRecipients, setFailedRecipients] = useState<Record<string, string>[]>([]);

  const pauseRequestedRef = useRef(false);
  const campaignContextRef = useRef<CampaignContext | null>(null);

  const runQueue = async (ctx: CampaignContext) => {
    setSending(true);
    setIsPaused(false);
    setAuthExpired(false);
    pauseRequestedRef.current = false;

    const { token, user, data, subject, body, attachments, throttleMs, startIndex } = ctx;
    const total = data.length;

    let sentCount = progress.sent;
    let failedCount = progress.failed;
    const currentFailed = [...failedRecipients];

    const fromName = user.given_name && user.family_name 
        ? `${user.given_name} ${user.family_name}` 
        : user.name;

    let baseDelay = throttleMs;
    let consecutiveErrors = 0;

    for (let i = startIndex; i < total; i++) {
        // Check if user requested pause
        if (pauseRequestedRef.current) {
            campaignContextRef.current = { ...ctx, startIndex: i };
            setIsPaused(true);
            setSending(false);
            toast.info("Campaign paused", { description: `Paused at recipient ${i + 1} of ${total}.` });
            return;
        }

        const row = data[i];
        const recipientEmail = row.EMAIL || row.Email || "";
        
        if (!recipientEmail) {
             setLogs(prev => [...prev, { status: 'info', msg: `Skipped row ${i+1}: Missing Email`, timestamp: new Date() }]);
             failedCount++;
             currentFailed.push(row);
             setFailedRecipients([...currentFailed]);
             setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
             continue;
        }

        try {
            const escapedRow: Record<string, string> = {};
            Object.keys(row).forEach(k => { escapedRow[k] = escapeHtml(row[k]); });

            const processedSubject = replacePlaceholders(subject, escapedRow);
            const processedBody = replacePlaceholders(escapeHtml(body), escapedRow)
                .replace(/\n/g, '<br>');
            const rawMessage = await createMimeMessage({
                to: recipientEmail,
                subject: processedSubject,
                body: processedBody,
                from: { name: fromName, email: user.email },
                attachments: attachments
            });

            await sendEmail(token, rawMessage);
            sentCount++;
            setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
            setLogs(prev => [...prev, { status: 'success', msg: `Sent to ${recipientEmail}`, timestamp: new Date() }]);
            consecutiveErrors = 0;
            
        } catch (error: any) {
            console.error(error);
            const isAuth = error?.status === 401 || (error?.message && error.message.includes('401'));

            if (isAuth) {
                // Immediate 401 handling: pause and request session renewal
                campaignContextRef.current = { ...ctx, startIndex: i };
                setAuthExpired(true);
                setIsPaused(true);
                setSending(false);
                toast.error("Connection paused", {
                    description: "Your Google session timed out. Click 'Reconnect & Resume' to continue."
                });
                return;
            }

            consecutiveErrors++;
            failedCount++;
            currentFailed.push(row);
            setFailedRecipients([...currentFailed]);
            setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            
            let errorMsg = error?.message || "Unknown error";
            const isRateLimit = errorMsg.toLowerCase().includes('rate') || 
                               errorMsg.toLowerCase().includes('quota') ||
                               errorMsg.toLowerCase().includes('429');
            
            setLogs(prev => [...prev, { status: 'error', msg: `Failed ${recipientEmail}: ${errorMsg}`, timestamp: new Date() }]);
            
            if (isRateLimit) {
                toast.error(`Sending limit reached. Slowing down...`, {
                    description: `Failed to send to ${recipientEmail}`
                });
                baseDelay = Math.min(baseDelay * 2, 10000);
            } else {
                toast.error(`Failed to send to ${recipientEmail}`, {
                    description: errorMsg
                });
            }
            
            if (consecutiveErrors >= 5) {
                campaignContextRef.current = { ...ctx, startIndex: i + 1 };
                toast.error('Too many consecutive errors. Campaign paused.', {
                    description: 'Please check your connection and try again.'
                });
                setIsPaused(true);
                setSending(false);
                return;
            }
        }
        
        const delay = consecutiveErrors > 0 ? baseDelay * (consecutiveErrors + 1) : baseDelay;
        await new Promise(r => setTimeout(r, delay));
    }
    
    setSending(false);
    setIsPaused(false);
    campaignContextRef.current = null;
    
    if (failedCount === 0) {
        toast.success(`Campaign complete!`, {
            description: `Successfully sent ${sentCount} email${sentCount !== 1 ? 's' : ''}`
        });
    } else {
        toast.warning(`Campaign finished with errors`, {
            description: `Sent: ${sentCount}, Failed: ${failedCount}`
        });
    }
  };

  const sendCampaign = async (
    token: string, 
    user: UserProfile, 
    data: Record<string, string>[], 
    subject: string, 
    body: string, 
    attachments: File[],
    throttleMs: number = 1000
  ) => {
    setLogs([]);
    setFailedRecipients([]);
    setProgress({ sent: 0, total: data.length, failed: 0 });

    const ctx: CampaignContext = {
      token,
      user,
      data,
      subject,
      body,
      attachments,
      throttleMs,
      startIndex: 0
    };
    campaignContextRef.current = ctx;
    await runQueue(ctx);
  };

  const pauseCampaign = () => {
    pauseRequestedRef.current = true;
  };

  const resumeCampaign = async (newToken?: string) => {
    if (!campaignContextRef.current) return;
    const ctx = {
      ...campaignContextRef.current,
      token: newToken || campaignContextRef.current.token
    };
    campaignContextRef.current = ctx;
    await runQueue(ctx);
  };

  const resetCampaign = () => {
    pauseRequestedRef.current = false;
    campaignContextRef.current = null;
    setLogs([]);
    setProgress({ sent: 0, total: 0, failed: 0 });
    setFailedRecipients([]);
    setSending(false);
    setIsPaused(false);
    setAuthExpired(false);
  };

  return { 
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
  };
}
