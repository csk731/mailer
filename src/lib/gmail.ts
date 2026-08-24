import { base64Encode } from "./utils";

export interface Recipient {
  [key: string]: string;
}

export interface EmailData {
  to: string;
  subject: string;
  body: string; // HTML allowed
  from?: { name: string; email: string };
  attachments?: File[];
}

export const REQUIRED_SCOPE = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

export function replacePlaceholders(template: string, data: Recipient): string {
  // Match {{ Key }} or {{ Key|fallback }} patterns with generous whitespace allowance
  const regex = /\{\{\s*([^}|]+)(?:\|([^}]*))?\s*\}\}/g;
  
  return template.replace(regex, (match, key, fallback) => {
    const trimmedKey = key.trim();
    const upperKey = trimmedKey.toUpperCase();
    const foundKey = Object.keys(data).find(k => k.toUpperCase() === upperKey);
    const val = foundKey ? data[foundKey] : (data[upperKey] ?? data[trimmedKey]);
    if (val !== undefined && val !== null && val.trim() !== '') {
      return val;
    }
    return fallback !== undefined ? fallback : match;
  });
}

export async function createMimeMessage(data: EmailData): Promise<string> {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const parts: string[] = [];

  // Defense-in-depth: Sanitize against MIME & Header Injection
  const cleanSubject = (data.subject || "").replace(/[\r\n]+/g, " ").trim();
  const cleanTo = (data.to || "").replace(/[\r\n]+/g, "").trim();
  const cleanFromName = (data.from?.name || "").replace(/[\r\n"]+/g, "").trim();
  const cleanFromEmail = (data.from?.email || "").replace(/[\r\n]+/g, "").trim();

  // Headers
  const fromHeader = cleanFromEmail
    ? `From: "${cleanFromName}" <${cleanFromEmail}>` 
    : `From: me`;
  parts.push(fromHeader);
  parts.push(`To: ${cleanTo}`);
  parts.push(`Subject: ${cleanSubject}`);
  parts.push(`MIME-Version: 1.0`);
  parts.push(`X-Mailer: Mailer/1.0`);
  parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  parts.push(``);

  // Body part
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: text/html; charset="UTF-8"`);
  const bodyBase64 = btoa(unescape(encodeURIComponent(data.body)));
  parts.push(`Content-Transfer-Encoding: base64`);
  parts.push(``);
  parts.push(bodyBase64);
  parts.push(``);

  // Attachments
  if (data.attachments && data.attachments.length > 0) {
    for (const file of data.attachments) {
      const cleanFileName = file.name.replace(/[\r\n"]+/g, "_");
      const base64Content = await fileToBase64(file);
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${file.type || 'application/octet-stream'}; name="${cleanFileName}"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push(`Content-Disposition: attachment; filename="${cleanFileName}"`);
      parts.push(``);
      parts.push(base64Content);
      parts.push(``);
    }
  }

  parts.push(`--${boundary}--`);

  return base64Encode(parts.join("\r\n"));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function sendEmail(accessToken: string, rawMessage: string) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: rawMessage,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Failed to send email (HTTP ${response.status})`;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson.error?.message || errorMsg;
    } catch {}

    if (response.status === 401) {
      const err = new Error(`401: ${errorMsg}`);
      (err as any).status = 401;
      throw err;
    }

    const err = new Error(errorMsg);
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}
