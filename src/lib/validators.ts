
import { toast } from "sonner";

export interface CampaignData {
    data: Record<string, string>[];
    columns: string[];
    subject: string;
    body: string;
    attachments: File[];
}

export function validateCampaign(
    { data, columns, subject, body, attachments }: CampaignData,
    onSuccess: (trimmedData: Record<string, string>[]) => void
) {
    // 1. Deep Trim all data
    const trimmedData = data.map(row => {
        const newRow: Record<string, string> = {};
        columns.forEach(col => {
            newRow[col] = (row[col] || "").trim();
        });
        return newRow;
    });

    // 2. Validation Checks
    if (data.length === 0) {
        toast.error("Please add at least one recipient to the table.");
        return false;
    }

    const hasEmptyFields = trimmedData.some(row =>
        columns.some(col => !row[col] || !row[col].trim())
    );
    if (hasEmptyFields) {
        toast.error("All table cells must be filled before proceeding.");
        return false;
    }

    const invalidEmails = trimmedData.filter(row => {
        // Case-insensitive check for email column
        const emailKey = Object.keys(row).find(k => k.toUpperCase() === 'EMAIL');
        const email = emailKey ? row[emailKey] : "";
        return email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    });
    
    if (invalidEmails.length > 0) {
        toast.error(`${invalidEmails.length} invalid email(s) found. Please fix them.`);
        return false;
    }

    // Check for Duplicate Recipients (Case-insensitive)
    const emailCounts = new Map<string, number>();
    trimmedData.forEach(row => {
        const emailKey = Object.keys(row).find(k => k.toUpperCase() === 'EMAIL');
        if (emailKey && row[emailKey]) {
            const email = row[emailKey].toLowerCase();
            emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
        }
    });

    const duplicates = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
        const dupList = duplicates.map(([email, _]) => email).slice(0, 3).join(", ");
        const extra = duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : "";
        toast.error(`Duplicate recipients found: ${dupList}${extra}`, {
            description: "Please ensure all email addresses are unique."
        });
        return false;
    }

    // Check Attachment Size (Max 25MB total)
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    const totalSize = attachments.reduce((acc, file) => acc + file.size, 0);

    if (totalSize > MAX_SIZE) {
        toast.error("Attachments too large!", {
            description: `Total size is ${(totalSize / (1024 * 1024)).toFixed(1)}MB. Limit is 25MB.`
        });
        return false;
    }

    // Check for Gmail Blocked File Types
    // https://support.google.com/mail/answer/6590
    const BLOCKED_EXTENSIONS = [
        '.ADE', '.ADP', '.APK', '.APPX', '.BAT', '.CAB', '.CHM', '.CMD', '.COM', '.CPL', 
        '.DLL', '.DMG', '.EXE', '.HTA', '.INS', '.ISP', '.ISO', '.JAR', '.JS', '.JSE', 
        '.LIB', '.LNK', '.MDE', '.MSC', '.MSI', '.MSP', '.MST', '.NSH', '.PIF', '.PS1', 
        '.SCR', '.SCT', '.SHB', '.SYS', '.VB', '.VBE', '.VBS', '.VXD', '.WSC', '.WSF', '.WSH'
    ];

    const blockedFiles = attachments.filter(file => {
        const ext = '.' + file.name.split('.').pop()?.toUpperCase();
        return BLOCKED_EXTENSIONS.includes(ext);
    });

    if (blockedFiles.length > 0) {
        toast.error("File type not allowed by Gmail", {
            description: `Gmail does not allow sending files with these extensions: ${blockedFiles.map(f => f.name).join(', ')}. Please remove them.`
        });
        return false;
    }

    if (!subject.trim()) {
        toast.error("Please enter a subject line.");
        return false;
    }
    if (!body.trim()) {
        toast.error("Please write a message in the email composer.");
        return false;
    }

    // 3. Validate placeholders (supports {{KEY}} and {{KEY|fallback}})
    const placeholderRegex = /\{\{\s*([^}|]+)(?:\|[^}]*)?\s*\}\}/g;
    const subjectPlaceholders = [...subject.matchAll(placeholderRegex)].map(m => m[1].trim()).filter(p => p.length > 0);
    const bodyPlaceholders = [...body.matchAll(placeholderRegex)].map(m => m[1].trim()).filter(p => p.length > 0);

    const emptyPlaceholderRegex = /\{\{\s*\|?\s*\}\}/g;
    if (emptyPlaceholderRegex.test(subject) || emptyPlaceholderRegex.test(body)) {
        toast.error("Empty variable tag found", {
            description: "Please remove empty {{}} tags or add a variable name like {{NAME}}."
        });
        return false;
    }

    const allPlaceholders = [...new Set([...subjectPlaceholders, ...bodyPlaceholders])].map(p => p.toUpperCase());
    const availableColumns = columns.map(c => c.toUpperCase());
    const invalidPlaceholders = allPlaceholders.filter(p => !availableColumns.includes(p));

    // Failures return false
    if (invalidPlaceholders.length > 0) {
        toast.error(`Unknown variable${invalidPlaceholders.length !== 1 ? 's' : ''}: ${invalidPlaceholders.map(p => `{{${p}}}`).join(', ')}`, {
            description: `Available table columns: ${columns.join(', ')}`
        });
        return false;
    }

    // Success
    onSuccess(trimmedData);
    return true;
}
