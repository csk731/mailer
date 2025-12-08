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
  let result = template;
  // Match {{ Key }} patterns with generous whitespace allowance
  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  
  result = result.replace(regex, (match, key) => {
    const trimmedKey = key.trim();
    const upperKey = trimmedKey.toUpperCase(); // Convert to uppercase for matching
    // Use the value if found, otherwise keep the match (so user sees the broken tag)
    return data[upperKey] !== undefined ? data[upperKey] : match; 
  });
  
  return result;
}

export async function createMimeMessage(data: EmailData): Promise<string> {
  const boundary = "foo_bar_baz";
  const parts: string[] = [];

  // Headers
  const fromHeader = data.from 
    ? `From: "${data.from.name}" <${data.from.email}>` 
    : `From: me`;
  parts.push(fromHeader);
  parts.push(`To: ${data.to}`);
  parts.push(`Subject: ${data.subject}`);
  parts.push(`MIME-Version: 1.0`);
  parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  parts.push(``);

  // Body part
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: text/html; charset="UTF-8"`);
  parts.push(`Content-Transfer-Encoding: 7bit`);
  parts.push(``);
  parts.push(data.body);
  parts.push(``);

  // Attachments
  if (data.attachments && data.attachments.length > 0) {
    for (const file of data.attachments) {
      const base64Content = await fileToBase64(file);
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${file.type}; name="${file.name}"`);
      parts.push(`Content-Transfer-Encoding: base64`);
      parts.push(`Content-Disposition: attachment; filename="${file.name}"`);
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
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to send email");
  }

  return response.json();
}
